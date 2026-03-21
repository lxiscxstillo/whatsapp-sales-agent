# Contract: AgentState v2 (Sales Closer Engine)

**Service**: agent-langgraph (Python)
**Module**: `services/agent-langgraph/src/graph/state.py`
**Purpose**: Documents the full updated `AgentState` and `LeadSlots` TypedDicts for the Sales Closer Engine v2, including additions and their commercial rationale.

---

## `LeadSlots` TypedDict (updated)

```python
class LeadSlots(TypedDict, total=False):
    """
    Structured data extracted from lead conversations.

    All fields are Optional (total=False) — backward compatible with existing
    LangGraph checkpoints. New fields default to None if not yet extracted.
    """

    # --- Existing fields (v1, UNCHANGED) ---
    name: Optional[str]
    """Lead's full name or first name."""

    city: Optional[str]
    """City of interest: 'Pasto', 'Bogotá', 'Medellín', 'Cali', etc."""

    zone: Optional[str]
    """General zone or area within the city."""

    property_type: Optional[str]
    """Normalized type: 'casa' | 'apartamento' | 'lote' | 'oficina' | 'local' | 'otro'"""

    budget: Optional[str]
    """Raw budget text as expressed by lead: '300 millones', 'hasta 500'."""

    budget_numeric: Optional[int]
    """Normalized budget in COP: 300_000_000."""

    intent: Optional[str]
    """Transaction intent: 'comprar' | 'arrendar'."""

    bedrooms: Optional[str]
    """Number of bedrooms as string: '2', '3', '4+'."""

    urgency: Optional[str]
    """Raw urgency text: 'lo antes posible', 'para fin de año'."""

    main_need: Optional[str]
    """Primary motivation: 'inversión', 'primera vivienda', 'mudanza laboral', etc."""

    objections: Optional[list[str]]
    """Accumulated objections detected: ['precio alto', 'zona muy lejos']."""

    # --- NEW: Sales Closer Engine v2 ---
    preferred_neighborhood: Optional[str]
    """
    Specific barrio/neighborhood preference stated by lead.
    Commercial rationale: More granular than `zone` — enables hyper-local
    inventory matching (e.g., 'Palermo' vs. general 'norte de Pasto').
    Extracted in slot_check when lead names a specific barrio.
    """

    urgency_level: Optional[str]
    """
    Normalized urgency for structured advisor queries and lead prioritization.
    Computed in evaluate_lead from raw `urgency` slot.

    Values:
        'inmediata'      — Lead needs property within days/weeks
        '1-3_meses'      — 1 to 3 months horizon
        '3-6_meses'      — 3 to 6 months horizon
        'mas_de_6_meses' — More than 6 months or unspecified long-term
        'no_definida'    — Urgency not yet expressed

    Commercial rationale: Advisors sort leads by urgency_level DESC + interest_level DESC
    to prioritize callbacks. Storing raw text in `urgency` would require NLP at query time.
    """
```

---

## `AgentState` TypedDict (full, v2)

```python
class AgentState(TypedDict):
    """
    Full LangGraph conversation state for the Sales Closer Engine.

    Persisted per thread_id (= lead phone number) in PostgreSQL via AsyncPostgresSaver.
    All fields are preserved across conversation turns unless explicitly overwritten.
    """

    messages: Annotated[list[BaseMessage], add_messages]
    """LangChain message history with add_messages reducer (appends, never replaces)."""

    slots: LeadSlots
    """Structured data extracted from conversation — see LeadSlots above."""

    lead_status: Literal["new", "qualifying", "hot", "handoff", "paused", "closed"]
    """Current lead status in the sales funnel."""

    ambiguity_counter: int
    """Consecutive ambiguous messages. Resets on any clear intent. Triggers handoff at 3."""

    last_intent: Optional[str]
    """
    Intent from most recent detect_intent call.
    Values: GREETING | PROPERTY_INQUIRY | SLOT_INFO | OBJECTION |
            HIGH_INTEREST | HANDOFF_REQUEST | AMBIGUOUS | OFF_TOPIC
    """

    last_confidence: float
    """Confidence score (0.0–1.0) of last intent classification. <0.6 forces AMBIGUOUS."""

    needs_handoff: bool
    """True when evaluate_lead determines human advisor should take over."""

    handoff_reason: Optional[str]
    """Reason for handoff: 'high_interest' | 'explicit_request' | 'max_ambiguity'."""

    fallback_action: Optional[str]
    """
    Action taken in fallback node:
    'ASK_CLARIFICATION' | 'ESCALATE_HANDOFF' | 'OFF_TOPIC_REDIRECT' | None
    """

    lead_id: str
    """PostgreSQL Lead row cuid. Reset from request on every invocation (idempotent)."""

    interest_level: int
    """
    1–5 scoring computed by evaluate_lead.
    1 = cold, 3 = warm, 4–5 = hot (triggers handoff consideration).
    """

    is_fallback: bool
    """True if the last processed message was ambiguous or off-topic."""
```

---

## State Flow Through Nodes (v2)

```
receive_message
  └─ Initializes: messages, slots.objections=[], lead_status, ambiguity_counter, lead_id

detect_intent
  └─ Updates: last_intent, last_confidence
  └─ May update: ambiguity_counter (if AMBIGUOUS and confidence < 0.6)

slot_check
  └─ Updates: slots (merges new extractions, detects contradictions)
  └─ NEW: may set slots.preferred_neighborhood if barrio named

evaluate_lead
  └─ Updates: interest_level, needs_handoff, handoff_reason
  └─ NEW: computes and sets slots.urgency_level from slots.urgency

generate_response  ← MODIFIED in v2
  └─ Calls InventoryService.query(city, preferred_neighborhood, budget_numeric, property_type)
  └─ Builds CTA instruction based on interest_level + last_intent
  └─ Injects {inventory_properties}, {inventory_alternative}, {cta_instruction} into system prompt
  └─ Updates: messages (appends AIMessage response)
  └─ Updates: lead_status (qualifying or hot based on interest_level)

handoff
  └─ Updates: messages (appends handoff AIMessage), lead_status="handoff"

fallback
  └─ Updates: messages (appends clarification AIMessage), ambiguity_counter, fallback_action
  └─ Updates: is_fallback=True
```

---

## Backend API State Synchronization

After every `graph.ainvoke()` call, `main.py` returns `ProcessResponse`. The backend-api (`webhook.route.ts`) maps these fields to Prisma columns:

| `ProcessResponse` field | Prisma `Lead` column |
|------------------------|---------------------|
| `updated_slots.name` | `Lead.name` |
| `updated_slots.city` | `Lead.slotCity` |
| `updated_slots.zone` | `Lead.slotZone` |
| `updated_slots.preferred_neighborhood` | `Lead.slotNeighborhood` ← NEW |
| `updated_slots.property_type` | `Lead.slotPropertyType` |
| `updated_slots.budget` | `Lead.slotBudget` |
| `updated_slots.budget_numeric` | `Lead.slotBudgetNumeric` |
| `updated_slots.intent` | `Lead.slotIntent` |
| `updated_slots.bedrooms` | `Lead.slotBedrooms` |
| `updated_slots.urgency` | `Lead.slotUrgency` |
| `updated_slots.urgency_level` | `Lead.urgencyLevel` ← NEW |
| `updated_slots.main_need` | `Lead.slotMainNeed` |
| `updated_slots.objections` | `Lead.slotObjections` |
| `interest_level` | `Lead.interestLevel` |
| `trigger_handoff` | `Lead.isHandoffRequested` |

The `ProcessResponse` schema in `main.py` must include `preferred_neighborhood` and `urgency_level` in `updated_slots`.
