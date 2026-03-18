"""
handoff node — prepares the closing message and sets handoff state.
After this node, the lead will no longer receive automatic responses.
"""

from langchain_core.messages import AIMessage

from ..state import AgentState


# Warm closing messages for different handoff reasons
HANDOFF_MESSAGES = {
    "high_interest_signal": (
        "¡Excelente! Veo que estás muy interesado/a. Voy a conectarte de inmediato con uno de "
        "nuestros asesores especializados para que te brinden una atención personalizada. "
        "Te contactarán muy pronto. ¡Gracias por tu interés! 🏠"
    ),
    "urgent_timeline": (
        "Entiendo que tienes urgencia. Voy a transferirte con un asesor disponible ahora mismo "
        "para que te ayude a encontrar lo que necesitas lo antes posible. ¡En breve te contactan! 🏠"
    ),
    "qualified_lead": (
        "¡Perfecto! Ya tengo toda la información que necesito. Voy a asignarte con un asesor "
        "de nuestra empresa quien te ayudará a encontrar exactamente lo que estás buscando. "
        "Te contactarán pronto. ¡Gracias por escribirnos! 🏠"
    ),
    "ambiguity_escalation": (
        "Parece que estoy teniendo dificultades para entenderte bien. Voy a conectarte con "
        "un asesor humano que te pueda ayudar mejor. ¡En breve te contactan! 😊"
    ),
    "user_request": (
        "Claro, con mucho gusto. Te voy a conectar con uno de nuestros asesores. "
        "Estarán contigo en breve. ¡Gracias! 😊"
    ),
}

DEFAULT_HANDOFF_MESSAGE = (
    "Voy a transferirte con uno de nuestros asesores para darte una atención más personalizada. "
    "¡Te contactarán muy pronto! 🏠"
)


def handoff(state: AgentState) -> dict:
    """Set handoff state and generate warm closing message."""
    handoff_reason = state.get("handoff_reason") or "qualified_lead"

    closing_message = HANDOFF_MESSAGES.get(handoff_reason, DEFAULT_HANDOFF_MESSAGE)

    return {
        "messages": [AIMessage(content=closing_message)],
        "needs_handoff": True,
        "lead_status": "handoff",
        "is_fallback": False,
    }
