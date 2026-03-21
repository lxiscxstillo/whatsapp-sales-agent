from __future__ import annotations

from typing import Annotated, Literal, Optional
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class LeadSlots(TypedDict, total=False):
    """Slots extracted from the lead during conversation."""
    name: Optional[str]
    city: Optional[str]
    zone: Optional[str]
    property_type: Optional[str]   # "casa"|"apartamento"|"lote"|"oficina"|"local"|"otro"
    budget: Optional[str]          # Free text e.g. "300 millones"
    budget_numeric: Optional[int]  # Normalized in COP
    intent: Optional[str]          # "comprar" | "arrendar"
    bedrooms: Optional[str]
    urgency: Optional[str]
    main_need: Optional[str]
    objections: Optional[list[str]]
    # --- Sales Closer Engine v2 ---
    preferred_neighborhood: Optional[str]  # Specific barrio preference (e.g. "Palermo")
    # Commercial rationale: More granular than `zone` — enables hyper-local inventory
    # matching. Extracted in slot_check when the lead names a specific barrio.
    urgency_level: Optional[str]  # Normalized: "inmediata"|"1-3_meses"|"3-6_meses"|"mas_de_6_meses"|"no_definida"
    # Commercial rationale: Advisors sort by urgency_level DESC + interest_level DESC to
    # prioritize callbacks. Raw `urgency` text would require NLP at query time.


def default_slots() -> LeadSlots:
    return LeadSlots(
        name=None,
        city=None,
        zone=None,
        property_type=None,
        budget=None,
        budget_numeric=None,
        intent=None,
        bedrooms=None,
        urgency=None,
        main_need=None,
        objections=[],
        preferred_neighborhood=None,
        urgency_level=None,
    )


class AgentState(TypedDict):
    """Full state of the LangGraph agent for one conversation thread."""

    # Message history — add_messages reducer: always appends, never replaces
    messages: Annotated[list[BaseMessage], add_messages]

    # Extracted lead slots (partial dict is fine; None = not yet collected)
    slots: LeadSlots

    # Lead pipeline status
    lead_status: Literal["new", "qualifying", "hot", "handoff", "paused", "closed"]

    # Consecutive ambiguous messages counter (resets to 0 on clear message)
    ambiguity_counter: int

    # Last detected intent (for routing and debugging)
    last_intent: Optional[str]

    # Detected intent confidence (0.0 - 1.0)
    last_confidence: float

    # Flag to trigger handoff node
    needs_handoff: bool

    # Handoff reason
    handoff_reason: Optional[str]

    # Fallback action type
    fallback_action: Optional[str]  # "ASK_CLARIFICATION" | "ESCALATE_HANDOFF" | None

    # Lead ID in PostgreSQL (for DB updates by the caller)
    lead_id: str

    # Interest level calculated by evaluate_lead (1-5)
    interest_level: int

    # Whether the last message was ambiguous
    is_fallback: bool
