"""
slot_check node — extracts and updates slots from the latest message.
Uses llama-3.1-8b-instant with structured output.
"""

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from ..state import AgentState, LeadSlots
from ...config import settings
from ...prompts.slot_prompt import (
    SlotExtraction,
    SLOT_SYSTEM_PROMPT,
    SLOT_USER_TEMPLATE,
)
from ...utils.logger import get_logger

logger = get_logger(__name__)

_extractor_llm = ChatGroq(
    model=settings.classifier_model,
    temperature=0.0,
    api_key=settings.groq_api_key,
).with_structured_output(SlotExtraction)

# Slot priority order (P1 first)
SLOT_PRIORITY = [
    "name",
    "property_type",
    "intent",
    "city",
    "budget",
    "bedrooms",
    "urgency",
    "zone",
    "main_need",
]

# Slots only relevant for certain property types
CONDITIONAL_SLOTS = {"bedrooms": ["casa", "apartamento"]}


def get_next_slot_question(slots: dict) -> tuple[str, str]:
    """
    Return the next missing priority slot and its associated question.

    Iterates through SLOT_PRIORITY (P1 → P4) and returns the first unfilled slot.
    Conditional slots (e.g., 'bedrooms') are skipped when they are not applicable
    to the lead's property_type.

    Args:
        slots: Dictionary of currently known slot values. A slot is considered
               "filled" if its value is a non-empty, non-None string.

    Returns:
        Tuple of (slot_name, question_text). Returns ("", "") when all priority
        slots are filled.

    Priority levels:
        P1: property_type, intent
        P2: name, city, budget
        P3: bedrooms (conditional), urgency
        P4: zone, main_need
    """
    questions = {
        "property_type": "¿Qué tipo de inmueble estás buscando? ¿Casa, apartamento, lote, oficina o local?",
        "intent": "¿Estás buscando para comprar o para arrendar?",
        "name": "Por cierto, ¿cómo te llamas?",
        "city": "¿En qué ciudad o zona estás buscando?",
        "budget": "¿Tienes un presupuesto aproximado en mente?",
        "bedrooms": "¿Cuántas habitaciones necesitas?",
        "urgency": "¿Tienes algún plazo o urgencia para encontrar el inmueble?",
        "zone": "¿Hay alguna zona o barrio específico que prefieras?",
        "main_need": "¿Cuál es tu prioridad principal: ubicación, precio, tamaño o algo más?",
    }

    property_type = slots.get("property_type")

    for slot in SLOT_PRIORITY:
        value = slots.get(slot)
        if value:
            continue  # Already filled

        # Skip conditional slots if not applicable
        if slot in CONDITIONAL_SLOTS:
            if property_type and property_type not in CONDITIONAL_SLOTS[slot]:
                continue

        return slot, questions.get(slot, "")

    return "", ""  # All priority slots filled


def slot_check(state: AgentState) -> dict:
    """
    Extract and update lead slots from the most recent user message.

    Calls the Groq LLM (llama-3.1-8b-instant) with structured output to identify
    slot values present in the latest HumanMessage. Only non-null extracted values
    overwrite existing slots (no partial erasure). Tracks slot contradictions when
    a new value differs from the previously stored value.

    Args:
        state: AgentState containing:
            - messages (list): Full conversation history. Only the last HumanMessage
              is analyzed by this node.
            - slots (dict): Currently known slot values from previous turns.

    Returns:
        dict with keys:
            - slots (dict): Updated slot dictionary merging previous and newly
              extracted values. Only non-None new values overwrite existing ones.
            - contradicts_slot (str | None): Name of the slot that was overwritten
              with a contradicting value, if any.
        Returns {} (empty dict) on LLM extraction failure — preserving the current
        slots unchanged in the graph state.

    Behavior on failure:
        If the LLM call raises any exception (timeout, validation error, API error),
        logs the error at ERROR level and returns {} so the graph continues with
        the existing slot state. The conversation is NOT interrupted.
    """
    logger.info(
        "slot_check.start",
        extra={
            "node": "slot_check",
            "current_slot_count": sum(1 for v in state.get("slots", {}).values() if v),
        },
    )

    messages = state.get("messages", [])
    current_slots = dict(state.get("slots", {}))

    # Get latest user message
    latest_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            latest_message = str(msg.content)
            break

    if not latest_message:
        return {}

    # Build known slots context
    known_context_parts = []
    for key, value in current_slots.items():
        if value and key != "objections":
            known_context_parts.append(f"- {key}: {value}")
    known_slots_context = "\n".join(known_context_parts) if known_context_parts else "Ninguno todavía"

    try:
        result: SlotExtraction = _extractor_llm.invoke([
            SystemMessage(content=SLOT_SYSTEM_PROMPT.format(known_slots_context=known_slots_context)),
            HumanMessage(content=SLOT_USER_TEMPLATE.format(message=latest_message)),
        ])

        # Update slots: only overwrite if new value is not None
        updated_slots = dict(current_slots)
        changed = {}

        for field in ["name", "city", "zone", "property_type", "budget", "budget_numeric",
                      "intent", "bedrooms", "urgency", "main_need"]:
            new_val = getattr(result, field, None)
            if new_val is not None:
                prev_val = updated_slots.get(field)
                updated_slots[field] = new_val
                if prev_val != new_val:
                    changed[field] = {"prev": prev_val, "new": new_val}

        # Handle new objection
        if result.new_objection:
            objections = list(updated_slots.get("objections") or [])
            if result.new_objection not in objections:
                objections.append(result.new_objection)
                updated_slots["objections"] = objections

        logger.info(
            "slot_check.result",
            extra={
                "node": "slot_check",
                "slots_updated": len(changed),
                "changed_fields": list(changed.keys()),
            },
        )

        return {
            "slots": updated_slots,
            "contradicts_slot": result.contradicts_slot,
        }

    except Exception as e:
        # On extraction error, return current slots unchanged.
        # Log the failure so it is visible in production logs.
        logger.error(
            "slot_check extraction failed — returning empty update",
            exc_info=True,
            extra={"node": "slot_check", "error": str(e)},
        )
        return {}
