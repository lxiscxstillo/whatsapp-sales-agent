"""
generate_response node — Sales Closer Engine v2.

Commercial rationale:
    Upgraded from a passive responder to an active sales closer. Key additions:
    1. InventoryService query: fetches matching properties from Mock-RAG inventory
       and injects them into the system prompt as specific, credible property data.
    2. CTA injection: every warm/hot lead response ends with a concrete closing action
       (visit proposal, videocall offer, or urgency framing) computed per lead stage.
    3. Objection handling: when the lead objects to price, adjacent-zone alternatives
       are fetched from the inventory and offered as a bridge to keep the conversation.
    4. Three-layer fallback: inventory failure, empty results, LLM timeout — the
       agent always responds, never exposes errors to leads.
"""

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.runnables import RunnableConfig

from ..state import AgentState
from ...config import settings
from ...prompts.system_prompt import build_system_prompt
from .slot_check import get_next_slot_question
from ...tools.real_estate_kb import retrieve_market_context
from ...tools.inventory_service import InventoryService, format_inventory_for_prompt
from ...utils.logger import get_logger
from ...utils.sanitize import sanitize_user_input

logger = get_logger(__name__)

_responder_llm = ChatGroq(
    model=settings.responder_model,
    temperature=settings.responder_temperature,
    max_tokens=250,
    api_key=settings.groq_api_key,
)

# User-facing fallback messages — never expose internal errors to leads.
_FALLBACK_TIMEOUT = (
    "Estoy procesando mucha información en este momento, dame un momento por favor 🙏"
)
_FALLBACK_GENERIC = (
    "Disculpa, tuve un problema técnico. ¿Me puedes repetir lo que necesitas?"
)

# Price objection keywords — triggers adjacent-zone alternative lookup.
# Commercial rationale: explicit keyword list avoids adding an LLM call for detection,
# keeping latency dominated by the single responder call. False positives are harmless
# (offering an alternative is always useful when price is discussed).
_PRICE_OBJECTION_KEYWORDS = [
    "caro", "costoso", "presupuesto", "precio", "mucho dinero",
    "no tengo", "muy alto", "económico", "más barato", "barato",
    "excede", "supera", "no me alcanza", "no llego",
]


def _price_objection_detected(message: str) -> bool:
    """
    Check if the latest lead message contains price-related objection keywords.

    Commercial rationale:
        Keyword matching is preferred over an LLM classifier here because:
        1. Latency: this runs before the responder LLM call — a second LLM call
           would add ~1–2s to every response.
        2. Availability: keyword matching has 100% uptime; an LLM classifier
           could time out, breaking the objection-handling flow entirely.
        False positives (offering an alternative when price wasn't objected to)
        are acceptable — the agent presents a cheaper option, which is useful
        regardless of context.

    Args:
        message: Raw text of the latest HumanMessage.

    Returns:
        True if the message likely contains a price objection.
    """
    message_lower = message.lower()
    return any(kw in message_lower for kw in _PRICE_OBJECTION_KEYWORDS)


def _compute_cta_instruction(
    interest_level: int,
    last_intent: str,
    has_city: bool,
    needs_handoff: bool,
) -> str:
    """
    Compute the Call-to-Action instruction for the system prompt closing section.

    Commercial rationale:
        CTAs are calibrated by lead stage to avoid two commercial failure modes:
        1. Over-pushing cold leads (interest_level=1) with visit proposals —
           signals a scripted bot and damages trust before rapport is built.
        2. Under-closing hot leads (level 4-5) — the window of high intent is
           short; failing to propose a concrete next step loses the conversion.

        The CTA is injected as a dedicated prompt section (not appended in code)
        so the LLM integrates it naturally into conversational prose rather than
        producing a mechanical "¿Le gustaría agendar?" suffix on every message.

    Args:
        interest_level: Current lead score 1–5 from evaluate_lead.
        last_intent: Most recent intent classification from detect_intent.
        has_city: Whether lead has provided city or preferred_neighborhood.
        needs_handoff: True = handoff node takes over; skip CTA to avoid conflicts.

    Returns:
        CTA instruction string injected into {cta_instruction} template variable.
        Empty string when handoff node will handle the closing.
    """
    if needs_handoff:
        # Commercial rationale: handoff node generates its own warm closing
        # message. Injecting a CTA here would create duplicate or conflicting
        # closing language in the same turn.
        return ""

    if last_intent == "HIGH_INTEREST" or interest_level >= 4:
        return (
            "El prospecto tiene ALTA intención. Proponga AHORA una visita o videollamada "
            "con urgencia positiva: 'Las unidades en esa zona se están moviendo rápido — "
            "¿Le parece si coordinamos una visita para esta semana?' o '¿Cuándo tendría "
            "disponibilidad para una videollamada de 15 minutos?' Use tono entusiasta."
        )

    if interest_level >= 3 and has_city:
        return (
            "El prospecto está en fase de consideración activa. Al final de su respuesta, "
            "proponga agendar una visita o llamada de forma natural: '¿Le parece si agendamos "
            "una visita para el jueves? Con gusto le acompaño en ese proceso.' "
            "Intégrelo conversacionalmente, no como cierre forzado."
        )

    if last_intent == "OBJECTION":
        return (
            "Después de presentar la alternativa de barrio (si existe en el inventario), "
            "proponga: '¿Le gustaría que le cuente más sobre ese sector? Podemos coordinar "
            "una visita esta semana para que lo conozca en persona.' Cierre con empatía."
        )

    # Cold lead — only a discovery question; no visit proposal yet
    return (
        "El prospecto es nuevo o tiene bajo interés. Cierre con UNA pregunta de descubrimiento "
        "para el dato más prioritario. NO proponga visita ni llamada — es demasiado pronto."
    )


def generate_response(state: AgentState, config: RunnableConfig | None = None) -> dict:
    """
    Generate a natural, persuasive reply — Sales Closer Engine v2.

    Commercial rationale:
        This node is the commercial engine of the conversation:
        1. Retrieves matching inventory properties (Mock-RAG) to ground responses
           in real (simulated) property data — IDs, prices, unique arguments.
        2. Computes a stage-appropriate CTA so warm/hot leads always receive a
           concrete next-step proposal, not just an open question.
        3. Detects price objections and triggers adjacent-zone alternative lookup
           to keep the conversation going when budget is a barrier.

    Fallback architecture (ISO 25010 Reliability — Fault Tolerance):
        Layer 1: InventoryService not injected in config → inventory_block = "" →
                 agent uses real_estate_kb.py general market knowledge.
        Layer 2: Inventory loaded but query returns 0 results → same as Layer 1.
        Layer 3: Inventory load failed at startup (JSON missing/malformed) →
                 query_succeeded=False → same as Layer 1.
        Layer 4: Groq API timeout → returns _FALLBACK_TIMEOUT message.
        Layer 5: Any other exception → returns _FALLBACK_GENERIC message.
        In all cases, conversation continues — leads never see internal errors.

    Args:
        state: AgentState with messages, slots, lead_status, interest_level, etc.
        config: LangGraph config dict. Expects config["configurable"]["inventory"]
            to be an InventoryService instance. None or missing key = no inventory.

    Returns:
        dict: {"messages": [AIMessage]} with the generated conversational reply.
    """
    logger.info(
        "generate_response.start",
        extra={"node": "generate_response", "lead_status": state.get("lead_status", "unknown")},
    )

    messages = state.get("messages", [])
    slots = state.get("slots", {})
    lead_status = state.get("lead_status", "new")
    interest_level = state.get("interest_level", 1)
    last_intent = state.get("last_intent", "") or ""
    needs_handoff = state.get("needs_handoff", False)

    # Build conversation history (last 8 turns; user messages sanitized for injection safety)
    history_lines = []
    history_msgs = []
    for msg in messages[-16:]:
        if isinstance(msg, HumanMessage):
            safe_content = sanitize_user_input(str(msg.content))
            history_lines.append(f"Prospecto: {safe_content}")
            history_msgs.append(HumanMessage(content=safe_content))
        elif isinstance(msg, AIMessage):
            history_lines.append(f"Valentina: {msg.content}")
            history_msgs.append(AIMessage(content=msg.content))

    conversation_history = "\n".join(history_lines[:-1]) if len(history_lines) > 1 else "(inicio)"

    # Extract latest user message for objection detection
    latest_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            latest_message = str(msg.content)
            break

    # Determine next slot to ask
    next_slot, next_question = get_next_slot_question(dict(slots))
    next_slot_question = (
        f"La siguiente pregunta prioritaria es sobre '{next_slot}': {next_question}"
        if next_slot
        else "Ya tienes suficiente información — orienta hacia agendar o cerrar."
    )

    if lead_status == "hot" or interest_level >= 4:
        response_instruction = (
            "El lead tiene alta intención. Muéstrate entusiasmada, menciona datos concretos "
            "del inventario o mercado si los tienes, y propón el siguiente paso concreto."
        )
    else:
        response_instruction = (
            "Responde naturalmente. Si tienes propiedades del inventario relevantes, menciona "
            "máximo 2 de forma conversacional. Luego haz la siguiente pregunta prioritaria."
        )

    # ── Layer 1: Market-level knowledge base ─────────────────────────────────
    market_context = retrieve_market_context(
        city=slots.get("city"),
        zone=slots.get("zone"),
        property_type=slots.get("property_type"),
        intent=slots.get("intent"),
        budget_numeric=slots.get("budget_numeric"),
    )

    # ── Layer 2: Mock-RAG inventory query ─────────────────────────────────────
    # Commercial rationale: inventory is passed via LangGraph configurable so the
    # node remains stateless and unit-testable with a mocked InventoryService.
    inventory: InventoryService | None = None
    if config:
        inventory = config.get("configurable", {}).get("inventory")

    inventory_properties_block = ""
    inventory_alternative_block = ""

    if inventory is not None:
        is_price_objection = (
            last_intent == "OBJECTION" and _price_objection_detected(latest_message)
        )
        result = inventory.query(
            city=slots.get("city"),
            zone=slots.get("preferred_neighborhood") or slots.get("zone"),
            budget_max=slots.get("budget_numeric"),
            property_type=slots.get("property_type"),
            limit=3,
            include_alternatives=is_price_objection,
        )
        if result.query_succeeded:
            inventory_properties_block = format_inventory_for_prompt(result.properties)
            inventory_alternative_block = format_inventory_for_prompt(result.alternatives)
            logger.info(
                "generate_response.inventory_query",
                extra={
                    "node": "generate_response",
                    "total_matches": result.total_matches,
                    "alternatives_found": len(result.alternatives),
                    "price_objection_mode": is_price_objection,
                },
            )
        else:
            # Layer 3 fallback: inventory load failed — use market knowledge only
            logger.warning(
                "generate_response.inventory_unavailable — using real_estate_kb fallback",
                extra={"node": "generate_response"},
            )

    # ── CTA Computation ───────────────────────────────────────────────────────
    has_city = bool(slots.get("city") or slots.get("preferred_neighborhood"))
    cta_instruction = _compute_cta_instruction(
        interest_level=interest_level,
        last_intent=last_intent,
        has_city=has_city,
        needs_handoff=needs_handoff,
    )

    # ── System prompt assembly ────────────────────────────────────────────────
    system_content = build_system_prompt(
        known_slots=dict(slots),
        next_slot_question=next_slot_question,
        response_instruction=response_instruction,
        conversation_history=conversation_history,
        market_context=market_context,
        inventory_properties=inventory_properties_block,
        inventory_alternative=inventory_alternative_block,
        cta_instruction=cta_instruction,
        history_turns=min(8, len(history_lines)),
    )

    llm_messages = [SystemMessage(content=system_content)] + history_msgs

    try:
        response = _responder_llm.invoke(llm_messages)
        response_text = str(response.content).strip()

        logger.info(
            "generate_response.success",
            extra={
                "node": "generate_response",
                "response_length": len(response_text),
                "interest_level": interest_level,
                "cta_active": bool(cta_instruction and "NO proponga visita" not in cta_instruction),
                "inventory_injected": bool(inventory_properties_block),
            },
        )
        return {"messages": [AIMessage(content=response_text)]}

    except Exception as e:
        error_class = type(e).__name__
        is_timeout = (
            "Timeout" in error_class
            or "timeout" in str(e).lower()
            or "timed out" in str(e).lower()
        )
        if is_timeout:
            logger.warning(
                "generate_response.timeout",
                extra={"node": "generate_response", "error_class": error_class},
            )
            return {"messages": [AIMessage(content=_FALLBACK_TIMEOUT)]}

        logger.error(
            "generate_response.failed",
            exc_info=True,
            extra={"node": "generate_response", "error_class": error_class, "error": str(e)},
        )
        return {"messages": [AIMessage(content=_FALLBACK_GENERIC)]}
