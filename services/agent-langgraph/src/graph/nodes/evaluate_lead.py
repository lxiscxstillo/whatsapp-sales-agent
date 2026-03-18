"""
evaluate_lead node — calculates interest_level and determines if handoff is needed.
Interest level 1-5 based on slot completeness and intent signals.
"""

from ..state import AgentState


def evaluate_lead(state: AgentState) -> dict:
    """
    Calculate interest_level (1-5) and set needs_handoff if >= 4.

    Scoring:
    - Each P1 slot filled (property_type, intent): +1 each (max +2)
    - Each P2 slot filled (name, city, budget): +0.5 each (max +1.5)
    - Urgency < 1 month keywords: +1.5
    - HIGH_INTEREST intent in last message: +1
    - Total capped at 5
    """
    slots = state.get("slots", {})
    last_intent = state.get("last_intent", "")
    current_interest = state.get("interest_level", 1)

    score = 1.0  # base

    # P1 slots
    if slots.get("property_type"):
        score += 1.0
    if slots.get("intent"):
        score += 1.0

    # P2 slots
    if slots.get("name"):
        score += 0.5
    if slots.get("city"):
        score += 0.5
    if slots.get("budget"):
        score += 0.5

    # Urgency signal
    urgency = str(slots.get("urgency") or "").lower()
    urgency_keywords = [
        "semana", "semanas", "mes", "dias", "días", "urgente",
        "pronto", "ya", "inmediato", "inmediata", "esta semana",
        "este mes", "30 días", "30 dias",
    ]
    if any(kw in urgency for kw in urgency_keywords):
        score += 1.5

    # HIGH_INTEREST intent
    if last_intent == "HIGH_INTEREST":
        score += 1.0

    # Clamp to 5
    interest_level = min(5, int(score))
    needs_handoff = interest_level >= 4

    handoff_reason = None
    if needs_handoff:
        if last_intent == "HIGH_INTEREST":
            handoff_reason = "high_interest_signal"
        elif "urgente" in urgency or any(kw in urgency for kw in urgency_keywords):
            handoff_reason = "urgent_timeline"
        else:
            handoff_reason = "qualified_lead"

    return {
        "interest_level": interest_level,
        "needs_handoff": needs_handoff,
        "handoff_reason": handoff_reason,
    }
