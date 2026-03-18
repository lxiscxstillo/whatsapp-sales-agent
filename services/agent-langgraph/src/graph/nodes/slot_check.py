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

_extractor_llm = ChatGroq(
    model=settings.classifier_model,
    temperature=0.0,
    api_key=settings.groq_api_key,
).with_structured_output(SlotExtraction)

# Slot priority order (P1 first)
SLOT_PRIORITY = [
    "property_type",
    "intent",
    "name",
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
    Returns (slot_name, question_to_ask) for the next missing priority slot.
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
    """Extract slots from latest message and update state."""
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

        return {
            "slots": updated_slots,
            "contradicts_slot": result.contradicts_slot,
        }

    except Exception:
        # On extraction error, return current slots unchanged
        return {}
