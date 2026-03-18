"""
receive_message node — normalizes input and loads initial state.
Entry point for every incoming WhatsApp message.
"""

from ..state import AgentState


def receive_message(state: AgentState) -> dict:
    """
    Normalizes the incoming message and ensures state has proper defaults.
    The actual message is already in state['messages'] (injected before graph call).
    """
    # Ensure slots dict has all keys initialized
    slots = state.get("slots", {})
    if "objections" not in slots or slots.get("objections") is None:
        slots["objections"] = []

    return {
        "slots": slots,
        "is_fallback": False,
        "fallback_action": None,
        "needs_handoff": False,
        "handoff_reason": None,
    }
