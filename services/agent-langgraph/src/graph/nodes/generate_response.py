"""
generate_response node — generates a natural, conversational reply.
Uses llama-3.3-70b-versatile for higher quality responses.
Enriched with real estate market knowledge base (RAG-style retrieval).
"""

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from ..state import AgentState
from ...config import settings
from ...prompts.system_prompt import build_system_prompt
from .slot_check import get_next_slot_question
from ...tools.real_estate_kb import retrieve_market_context
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


def generate_response(state: AgentState) -> dict:
    """
    Generate a natural, conversational reply for the lead.

    Builds a system prompt enriched with:
    - Known slot context (to avoid repeating questions).
    - Next priority slot question.
    - Real estate market data (RAG retrieval from real_estate_kb).
    - Last 8 turns of conversation history (sanitized for prompt injection).

    Then calls the Groq LLM (llama-3.3-70b-versatile) and returns the response
    as an AIMessage appended to the graph state.

    Args:
        state: AgentState containing:
            - messages (list): Full conversation history (HumanMessage + AIMessage).
            - slots (dict): Currently known slot values.
            - lead_status (str): Current lead status (e.g., "new", "qualifying", "hot").

    Returns:
        dict with key:
            - messages (list[AIMessage]): Single-element list with the generated reply.

    Behavior on Groq timeout (groq.APITimeoutError / httpx.TimeoutException):
        Returns a patient wait message: _FALLBACK_TIMEOUT.
        Logs a WARNING with event "generate_response.timeout".

    Behavior on any other exception:
        Returns a generic apology message: _FALLBACK_GENERIC.
        Logs an ERROR with full traceback via exc_info=True.

    Security:
        User messages (HumanMessage) are passed through sanitize_user_input()
        before being injected into the system prompt conversation history.
        This defends against prompt injection attempts. AIMessage content is
        NOT sanitized as it is agent-generated.
    """
    logger.info(
        "generate_response.start",
        extra={"node": "generate_response", "lead_status": state.get("lead_status", "unknown")},
    )

    messages = state.get("messages", [])
    slots = state.get("slots", {})
    lead_status = state.get("lead_status", "new")

    # Build conversation history string (last 8 turns)
    # USER messages are sanitized to prevent prompt injection.
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

    # Determine next slot to ask
    next_slot, next_question = get_next_slot_question(dict(slots))

    next_slot_question = (
        f"La siguiente pregunta prioritaria es sobre '{next_slot}': {next_question}"
        if next_slot
        else "Ya tienes suficiente información — orienta hacia agendar o cerrar."
    )

    if lead_status == "hot":
        response_instruction = "El lead tiene alta intención. Muéstrate entusiasmada, menciona datos concretos del mercado si los tienes, y propón el siguiente paso concreto (agendar visita, enviar portafolio)."
    else:
        response_instruction = "Responde naturalmente. Si tienes contexto de mercado relevante, úsalo para dar información concreta y confiable. Luego haz la siguiente pregunta prioritaria de forma conversacional."

    # ── RAG: Recuperar contexto de mercado ───────────────────────────────────
    market_context = retrieve_market_context(
        city=slots.get("city"),
        zone=slots.get("zone"),
        property_type=slots.get("property_type"),
        intent=slots.get("intent"),
        budget_numeric=slots.get("budget_numeric"),
    )

    # Build system prompt with market knowledge injected
    system_content = build_system_prompt(
        known_slots=dict(slots),
        next_slot_question=next_slot_question,
        response_instruction=response_instruction,
        conversation_history=conversation_history,
        market_context=market_context,
        history_turns=min(8, len(history_lines)),
    )

    # Build messages for LLM
    llm_messages = [SystemMessage(content=system_content)] + history_msgs

    try:
        response = _responder_llm.invoke(llm_messages)
        response_text = str(response.content).strip()

        logger.info(
            "generate_response.success",
            extra={
                "node": "generate_response",
                "response_length": len(response_text),
            },
        )

        return {
            "messages": [AIMessage(content=response_text)],
        }

    except Exception as e:
        # Detect Groq / HTTP timeout specifically for a better user experience.
        error_class = type(e).__name__
        is_timeout = (
            "Timeout" in error_class
            or "timeout" in str(e).lower()
            or "timed out" in str(e).lower()
        )

        if is_timeout:
            logger.warning(
                "generate_response.timeout — Groq API timed out, returning wait message",
                extra={"node": "generate_response", "error_class": error_class},
            )
            return {
                "messages": [AIMessage(content=_FALLBACK_TIMEOUT)],
            }

        logger.error(
            "generate_response.failed — unexpected error, returning generic fallback",
            exc_info=True,
            extra={"node": "generate_response", "error_class": error_class, "error": str(e)},
        )
        return {
            "messages": [AIMessage(content=_FALLBACK_GENERIC)],
        }
