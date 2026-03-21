"""
evaluate_lead node — calculates interest_level, determines handoff, and normalizes urgency_level.

Sales Closer Engine v2 additions:
    - normalize_urgency_level(): converts raw urgency text to a structured enum value
      ('inmediata', '1-3_meses', '3-6_meses', 'mas_de_6_meses', 'no_definida').
      Commercial rationale: advisors sort their pipeline by urgency_level DESC +
      interest_level DESC to prioritize callbacks. Storing raw text would require NLP
      at query time; the normalized enum enables efficient SQL filtering.
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

# Urgency normalization map — maps keyword patterns to structured enum values.
# Commercial rationale: raw urgency text ("lo antes posible", "para fin de año")
# is stored in slotUrgency for human readability. The normalized urgencyLevel
# enables dashboard queries like WHERE urgencyLevel='inmediata' ORDER BY interestLevel DESC.
_URGENCY_PATTERNS: list[tuple[list[str], str]] = [
    (
        ["inmediato", "inmediata", "ya", "urgente", "lo antes posible", "cuanto antes",
         "esta semana", "dias", "días", "semana"],
        "inmediata",
    ),
    (
        ["próximo mes", "proximo mes", "1 mes", "2 meses", "3 meses", "este mes",
         "30 días", "30 dias", "mes", "meses"],
        "1-3_meses",
    ),
    (
        ["3 a 6 meses", "4 meses", "5 meses", "6 meses", "medio año"],
        "3-6_meses",
    ),
    (
        ["fin de año", "el año que viene", "próximo año", "proximo año",
         "más de 6 meses", "mas de 6 meses", "largo plazo", "sin prisa"],
        "mas_de_6_meses",
    ),
]


def normalize_urgency_level(raw_urgency: str | None) -> str:
    """
    Convert raw urgency text extracted by the agent into a normalized enum value.

    Commercial rationale:
        The normalized urgency_level is persisted in the Lead.urgencyLevel DB column
        alongside the raw Lead.slotUrgency text. This separation serves different
        use cases:
        - slotUrgency: shown verbatim to advisors for human context
        - urgencyLevel: used in SQL ORDER BY / WHERE filters in the advisor dashboard
        The two-column approach avoids running NLP at query time and keeps the
        dashboard fast even with thousands of leads.

    Args:
        raw_urgency: The raw urgency string extracted by slot_check
            (e.g., "lo antes posible", "para fin de año"). None or empty = no_definida.

    Returns:
        One of: "inmediata", "1-3_meses", "3-6_meses", "mas_de_6_meses", "no_definida".
    """
    if not raw_urgency:
        return "no_definida"

    urgency_lower = raw_urgency.lower().strip()

    for keywords, level in _URGENCY_PATTERNS:
        if any(kw in urgency_lower for kw in keywords):
            return level

    return "no_definida"


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

        # Normalize urgency level for structured DB queries (Sales Closer Engine v2)
        urgency_level = normalize_urgency_level(slots.get("urgency"))

        logger.info(
            "evaluate_lead.result",
            extra={
                "node": "evaluate_lead",
                "interest_level": interest_level,
                "needs_handoff": needs_handoff,
                "handoff_reason": handoff_reason,
                "urgency_level": urgency_level,
            },
        )

        # Return urgency_level as a slot update so it is persisted via the slots dict
        updated_slots = dict(slots)
        updated_slots["urgency_level"] = urgency_level

        return {
            "interest_level": interest_level,
            "needs_handoff": needs_handoff,
            "handoff_reason": handoff_reason,
            "slots": updated_slots,
        }

    except Exception as e:
        logger.error(
            "evaluate_lead node failed unexpectedly — returning safe fallback",
            exc_info=True,
            extra={"node": "evaluate_lead", "error": str(e)},
        )
        return _FALLBACK_RESULT
