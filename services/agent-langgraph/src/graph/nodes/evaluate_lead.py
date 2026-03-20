"""
evaluate_lead node — calculates interest_level and determines if handoff is needed.
Interest level 1-5 based on slot completeness and intent signals.
"""

from ...utils.logger import get_logger
from ..state import AgentState

logger = get_logger(__name__)

# Safe fallback returned when evaluation fails unexpectedly.
_FALLBACK_RESULT = {
    "interest_level": 1,
    "needs_handoff": False,
    "handoff_reason": None,
}


def evaluate_lead(state: AgentState) -> dict:
    """
    Calculate interest_level (1-5) and set needs_handoff if >= 4.

    Args:
        state: AgentState containing:
            - slots (dict): Extracted lead slots (property_type, intent, name, city, budget, urgency).
            - last_intent (str): Most recent intent classification from detect_intent.
            - interest_level (int): Current interest level (used only for context; recalculated here).

    Returns:
        dict with keys:
            - interest_level (int): Recalculated score clamped to [1, 5].
            - needs_handoff (bool): True when score >= 4 AND at least one qualifying signal exists.
            - handoff_reason (str | None): One of "high_interest_signal", "urgent_timeline",
              "qualified_lead", or None if no handoff.

    Behavior on failure:
        If any unexpected exception occurs, logs the error at ERROR level and returns
        _FALLBACK_RESULT ({interest_level: 1, needs_handoff: False, handoff_reason: None})
        to prevent the LangGraph node from crashing the conversation flow.

    Scoring:
        - Each P1 slot filled (property_type, intent): +1 each (max +2)
        - Each P2 slot filled (name, city, budget): +0.5 each (max +1.5)
        - Urgency < 1 month keywords: +1.5
        - HIGH_INTEREST intent in last message: +1
        - Total capped at 5
    """
    try:
        logger.info(
            "evaluate_lead.start",
            extra={"node": "evaluate_lead"},
        )

        slots = state.get("slots", {})
        last_intent = state.get("last_intent", "")

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

        # Handoff requires a qualifying signal — score alone is not enough.
        # Prevents premature handoff after just intent + name + city (score=4 base).
        has_urgency = any(kw in urgency for kw in urgency_keywords)
        has_budget = bool(slots.get("budget"))
        has_high_interest = last_intent == "HIGH_INTEREST"

        needs_handoff = interest_level >= 4 and (has_budget or has_urgency or has_high_interest)

        handoff_reason = None
        if needs_handoff:
            if has_high_interest:
                handoff_reason = "high_interest_signal"
            elif has_urgency:
                handoff_reason = "urgent_timeline"
            else:
                handoff_reason = "qualified_lead"

        logger.info(
            "evaluate_lead.result",
            extra={
                "node": "evaluate_lead",
                "interest_level": interest_level,
                "needs_handoff": needs_handoff,
                "handoff_reason": handoff_reason,
            },
        )

        return {
            "interest_level": interest_level,
            "needs_handoff": needs_handoff,
            "handoff_reason": handoff_reason,
        }

    except Exception as e:
        logger.error(
            "evaluate_lead node failed unexpectedly — returning safe fallback",
            exc_info=True,
            extra={"node": "evaluate_lead", "error": str(e)},
        )
        return _FALLBACK_RESULT
