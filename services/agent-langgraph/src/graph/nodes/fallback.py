"""
fallback node — handles ambiguous and off-topic messages.
Tracks consecutive ambiguity count, escalates to handoff after 3.
OFF_TOPIC messages redirect without incrementing the counter.
"""

from langchain_core.messages import AIMessage

from ..state import AgentState

CLARIFICATION_MESSAGES = [
    "Disculpa, no entendí bien tu mensaje. ¿Podrías contarme un poco más sobre el inmueble que estás buscando?",
    "Hmm, no estoy seguro de haber entendido. ¿Me puedes decir qué tipo de propiedad te interesa?",
    "Perdona, no pude captar bien tu mensaje. ¿Estás buscando para comprar o arrendar?",
]

OFF_TOPIC_MESSAGES = [
    "Jajaja, entiendo. Pero me especializo en inmuebles — ¿te puedo ayudar a encontrar casa, apartamento o local? 😊",
    "Ese tema me queda grande, pero lo que sí sé es de inmuebles. ¿En qué puedo ayudarte?",
    "Me gana en ese tema, pero si de inmuebles se trata, ¡cuéntame! ¿Qué estás buscando?",
]


def fallback(state: AgentState) -> dict:
    """
    Handle ambiguous/off-topic messages.
    - AMBIGUOUS: increment counter, escalate at 3
    - OFF_TOPIC: redirect without incrementing
    """
    last_intent = state.get("last_intent", "AMBIGUOUS")
    ambiguity_counter = state.get("ambiguity_counter", 0)

    if last_intent == "OFF_TOPIC":
        # Redirect amicably, do not increment counter
        idx = ambiguity_counter % len(OFF_TOPIC_MESSAGES)
        message = OFF_TOPIC_MESSAGES[idx]
        return {
            "messages": [AIMessage(content=message)],
            "is_fallback": True,
            "fallback_action": "OFF_TOPIC_REDIRECT",
        }

    # AMBIGUOUS — increment counter
    new_counter = ambiguity_counter + 1

    if new_counter >= 3:
        return {
            "ambiguity_counter": new_counter,
            "is_fallback": True,
            "fallback_action": "ESCALATE_HANDOFF",
            "handoff_reason": "ambiguity_escalation",
            "needs_handoff": True,
        }

    # Ask for clarification
    idx = (new_counter - 1) % len(CLARIFICATION_MESSAGES)
    message = CLARIFICATION_MESSAGES[idx]
    return {
        "messages": [AIMessage(content=message)],
        "ambiguity_counter": new_counter,
        "is_fallback": True,
        "fallback_action": "ASK_CLARIFICATION",
    }
