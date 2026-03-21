# Feature Spec: Sales Closer Engine v2

**Feature ID**: sales-closer-engine-v2
**Date**: 2026-03-21
**Priority**: P1 — Strategic Feature Evolution
**Author**: Principal AI Solution Architect & Lead Conversational Engineer
**Supersedes**: production-integrity-final (2026-03-20) — production is stable, evolving to sales closing

---

## Problem Statement

The WhatsApp Sales Agent operates as a passive lead-capture bot: it qualifies leads and routes them to advisors, but does not actively close. Conversion rates are limited because:

1. **No hyper-local knowledge**: The agent lacks property-level inventory data for specific neighborhoods in Pasto (Palermo, Maridíaz, etc.), making responses generic and low-trust.
2. **No Call-to-Action logic**: The agent never proposes a visit or a call — it waits for the lead to ask.
3. **No objection handling**: When a lead says "es muy caro", the agent has no mechanism to offer an adjacent-zone alternative.
4. **Incomplete lead profiling**: Neighborhood preference and urgency level are not persisted in structured form for advisor routing.
5. **No sales persona**: The tone is neutral; it does not project hyper-local authority or Colombian professional real estate vocabulary.

---

## Requirements

### R1 — Mock-RAG Property Inventory
- Create `data/inventory_colombia.json` as Single Source of Truth for simulated property data.
- Include properties for **Pasto** (Palermo, Maridíaz, Avenida Panamericana, Tamasagra, Anganoy, El Prado, San Ignacio), **Bogotá** (Chicó, Cedritos), **Medellín** (El Poblado, Laureles), **Cali** (Pance).
- Each record: `id`, `type`, `city`, `zone`, `price_cop`, `price_display`, `area_m2`, `bedrooms`, `bathrooms`, `amenities`, `unique_selling_argument`, `stratum`, `status`, `contact_advisor`.
- Implement `InventoryService` (Python, in-process) that loads the JSON at startup and exposes a `query()` method.
- Graceful fallback: if JSON fails to load, `query()` returns `[]` and the agent uses general market knowledge.

### R2 — Sales Closer Persona & CTA Logic
- Update `system_prompt.py` to project: executive tone, empathy, Colombian professional modisms ("Con mucho gusto", "Sector de alta valorización").
- Inject `{inventory_properties}` block into every prompt when matching properties exist.
- Inject `{cta_instruction}` variable computed dynamically per lead stage:
  - `interest_level >= 3`: propose a visit.
  - `interest_level >= 4` or `HIGH_INTEREST`: propose videocall or immediate visit with positive urgency.
  - `OBJECTION` + price keyword: offer adjacent-zone alternative.
  - Cold lead (level 1): ask discovery question only.

### R3 — Objection Handling via Adjacent Zones
- Implement zone adjacency map in `InventoryService` (e.g., Palermo ↔ Maridíaz ↔ El Prado).
- When `last_intent == OBJECTION` and price-related keyword detected, query alternatives in adjacent zones and inject as `{inventory_alternative}`.

### R4 — Extended Lead Profiling (ISO 25010 Functional Suitability)
- Add `preferred_neighborhood: Optional[str]` slot — extracted in `slot_check` when lead names a specific barrio.
- Add `urgency_level: Optional[str]` slot — normalized enum computed in `evaluate_lead` from raw `urgency` text.
  - Values: `"inmediata"`, `"1-3_meses"`, `"3-6_meses"`, `"mas_de_6_meses"`, `"no_definida"`.
- Add two nullable Prisma columns: `slotNeighborhood`, `urgencyLevel`.
- Map both new slots in `webhook.route.ts` lead persistence.

### R5 — Reliability Hardening (ISO 25010 Reliability)
- Implement three-layer fallback: JSON load failure → empty query → LLM timeout (existing).
- All `InventoryService` errors logged at WARNING (never ERROR/exception) — agent never crashes on inventory issues.

### R6 — Maintainability (ISO 25010 Maintainability)
- All new functions documented with JSDoc/Docstrings explaining the **commercial logic rationale**, not just technical behavior.

---

## Out of Scope
- Adding new LangGraph graph nodes (routing in `graph.py` unchanged)
- Vector database or embedding-based semantic search
- UI changes to the Next.js dashboard
- Changes to WPPConnect configuration
- Migrating from Groq to another LLM provider

---

## Success Criteria
1. Agent responds with specific property data (ID, price, amenities) when lead mentions Palermo or any tracked neighborhood.
2. Every agent response to a warm lead (interest_level ≥ 3) includes a CTA proposing a visit or call.
3. When lead objects to price, agent offers an alternative property in an adjacent zone.
4. `slotNeighborhood` and `urgencyLevel` columns populated in Neon DB for qualifying leads.
5. If `inventory_colombia.json` is deleted at runtime, agent continues responding using general market knowledge (no crash, no error surfaced to user).
6. All new Python functions have docstrings with a "Commercial rationale:" section.
7. WPPConnect session, QR flow, and dashboard remain 100% operational after deployment.
