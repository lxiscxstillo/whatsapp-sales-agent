# Research: Sales Closer Engine v2

**Phase**: 0 — Research
**Date**: 2026-03-21
**Status**: COMPLETE — all unknowns resolved

---

## 1. Mock-RAG Pattern for File-Based Property Inventory

### Decision
Use an **in-process `InventoryService`** class that loads `data/inventory_colombia.json` once at FastAPI startup (lifespan) and exposes a synchronous `query()` method. No vector database required at MVP scale (~50 properties).

### Rationale
- At 50 properties, cosine-similarity search adds latency and infrastructure cost with no accuracy gain.
- File-based loading means **zero network latency**; the bottleneck stays the LLM call (≈1.5–2.5s).
- `InventoryService` is injected into node functions via `app.state`, preserving LangGraph's stateless node design.
- Graceful fallback: if the JSON file fails to load, `InventoryService` returns `[]` and nodes use the existing `real_estate_kb.py` market-level knowledge — conversation never breaks.

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| ChromaDB / FAISS vector store | Adds Dockerfile complexity + cold-start overhead on Fly.io for 50 records |
| Inline Python dict in `real_estate_kb.py` | JSON file at `data/` is accessible to future admin or reporting tools outside the agent |
| Airtable / Notion external API | Network dependency → availability risk; single JSON file is zero-dependency |
| PostgreSQL `Property` table | Valid long-term; premature for MVP demo data — JSON file is faster to iterate |

---

## 2. CTA (Call-to-Action) Injection Strategy

### Decision
Add a `{cta_instruction}` variable to the `system_prompt.py` template. The value is computed in `generate_response.py` based on `interest_level` and `last_intent` before every LLM call.

### CTA Rules by Lead Stage
| Condition | CTA Instruction Injected |
|-----------|--------------------------|
| `interest_level >= 3` AND `city` slot present | "Proponga agendar una visita al inmueble específico para esta semana." |
| `interest_level >= 4` OR `last_intent == HIGH_INTEREST` | "Proponga una videollamada o visita presencial de inmediato usando urgencia positiva: 'Las unidades en esa zona se están moviendo rápido'." |
| `last_intent == OBJECTION` AND price keyword detected | "Ofrezca la alternativa del inventario como solución antes de cerrar su respuesta." |
| `interest_level == 1` (NEW lead) | "Formule una sola pregunta abierta para conocer ciudad y tipo de inmueble. No proponga visita aún." |
| `needs_handoff == True` | "No genere CTA — el nodo handoff tomará el control de este turno." |

### Rationale
- Decoupling the CTA from the base persona means the base persona stays stable while the sales aggressiveness is dynamically calibrated per lead stage.
- A cold lead receiving an immediate "visit proposal" feels pushy; a hot lead NOT receiving a CTA loses momentum.

---

## 3. Objection Handling via Adjacent-Zone Inventory

### Decision
When `last_intent == OBJECTION` and the user message contains price-related keywords (e.g., "caro", "costoso", "presupuesto", "precio"), `generate_response.py` queries `InventoryService` for alternatives in **adjacent zones** using a hardcoded adjacency map.

### Zone Adjacency Map
```python
ADJACENT_ZONES = {
    # Pasto (Nariño)
    "Palermo":             ["Maridíaz", "El Prado"],
    "Maridíaz":            ["Palermo", "San Ignacio"],
    "Avenida Panamericana":["Tamasagra", "Anganoy"],
    "Tamasagra":           ["Avenida Panamericana", "Anganoy"],
    "Anganoy":             ["Tamasagra", "El Prado"],
    "El Prado":            ["Anganoy", "San Ignacio"],
    "San Ignacio":         ["El Prado", "Maridíaz"],
    # Bogotá
    "Chicó":               ["Cedritos", "Rosales"],
    "Cedritos":            ["Chicó", "Santa Bárbara"],
    # Medellín
    "El Poblado":          ["Laureles", "Envigado"],
    "Laureles":            ["El Poblado", "Belén"],
    # Cali
    "Pance":               ["Ciudad Jardín", "El Ingenio"],
}
```

### Rationale
Explicit adjacency prevents the LLM from hallucinating distant zones as "similar" — critical for building trust with buyers who know their city well. Pasto buyers in particular have strong neighborhood identity.

---

## 4. Colombian Professional Real Estate Modisms

### Decision
Embed the following vocabulary directly into the base persona section of `system_prompt.py`:

| Situation | Phrase |
|-----------|--------|
| Acknowledgment | "Con mucho gusto", "Claro que sí" |
| Zone promotion | "Sector de alta valorización", "Zona de gran proyección" |
| Budget bridge | "Tenemos opciones muy interesantes en un rango similar" |
| Urgency (positive) | "Las unidades en esa zona se están moviendo rápido" |
| Appointment proposal | "¿Le parece si coordinamos una visita para el jueves?" |
| Closing warmth | "Con gusto le acompaño en este proceso" |
| Expertise signal | "Conozco muy bien ese sector" |
| Pasto specifics | "Cerca al Galeras", "A pocos minutos de Unicentro Pasto", "Zona del Carnaval" |

### Rationale
Pasto is a strongly regional market. Generic "neutral Spanish" reads as impersonal. Local modisms build trust and project hyper-local expertise.

---

## 5. New Lead Slots: `preferred_neighborhood` and `urgency_level`

### Decision
Add two fields to `LeadSlots` TypedDict and persist them to Neon via two new nullable Prisma columns.

| New Field | Type | Source | Purpose |
|-----------|------|--------|---------|
| `preferred_neighborhood` | `str` | Extracted in `slot_check` from city/zone context | Enables advisor routing by neighborhood specialty |
| `urgency_level` | `str` | Normalized in `evaluate_lead` from raw `urgency` slot | Enables structured SQL queries for lead prioritization |

### `urgency_level` Normalization Rules
```python
URGENCY_MAPPING = {
    # Immediate
    ("inmediato", "ya", "ahora", "urgente", "lo antes posible"): "inmediata",
    # 1–3 months
    ("próximo mes", "1 mes", "2 meses", "3 meses", "este mes"): "1-3_meses",
    # 3–6 months
    ("3 a 6 meses", "medio año", "4 meses", "5 meses", "6 meses"): "3-6_meses",
    # 6+ months
    ("fin de año", "el año que viene", "más de 6 meses", "largo plazo"): "mas_de_6_meses",
    # Default
    None: "no_definida",
}
```

### Why Not Reuse `slotUrgency`
The existing `slotUrgency` stores raw extracted text ("lo antes posible"). `urgencyLevel` stores the normalized enum, enabling `WHERE urgencyLevel = 'inmediata' ORDER BY interestLevel DESC` queries in the advisor panel.

---

## 6. Prisma Non-Destructive Migration Pattern

### Decision
Add two nullable columns via `prisma migrate dev --name add_lead_neighborhood_urgency`. Both columns use `String?` (nullable), so Neon executes `ADD COLUMN` without table rewrites.

### Neon-Safe Checklist
- [x] All new columns nullable — no table rewrite
- [x] No `DROP COLUMN` or `ALTER COLUMN TYPE`
- [x] No unique constraints on existing data
- [x] Migration runs in a single transaction (Prisma default)
- [x] Backward compatible — existing code that doesn't set these columns continues working

---

## 7. LangGraph Node Modification Strategy

### Decision
Modify `generate_response.py` and `evaluate_lead.py` **in-place**. Do NOT add new nodes or change routing in `graph.py`.

### Why No New Nodes
Adding an `inventory_lookup` node would require new routing edges and could break `route_after_evaluate` logic. Since `InventoryService.query()` is synchronous and ≤50ms (in-process), calling it inside `generate_response.py` before building the system prompt is the minimal-change approach.

### State Extension Pattern
```python
# state.py addition — backwards compatible (total=False means all fields optional)
class LeadSlots(TypedDict, total=False):
    # ... existing fields unchanged ...
    preferred_neighborhood: Optional[str]  # NEW
    urgency_level: Optional[str]           # NEW
```

No routing changes needed — `graph.py` is untouched.

---

## 8. Reliability Fallback Architecture

### Three-Layer Fallback
1. **`InventoryService._load()` failure** → `self._properties = []` → `query()` returns `[]` → no `{inventory_properties}` block injected → system prompt uses `real_estate_kb.py` general knowledge.
2. **Empty query results** (no matching properties) → inject empty `{inventory_properties}` → system prompt instruction: "Usa tu conocimiento general del mercado para responder".
3. **LLM timeout in `generate_response`** → existing fallback messages (already implemented) — no change needed.

All three paths are covered by unit tests with mocked `InventoryService`.

---

## 9. ISO 25010 Quality Attribute Coverage

| Quality Attribute | Mechanism |
|-------------------|-----------|
| **Functional Suitability** | `preferred_neighborhood` + `urgencyLevel` persisted in Neon; inventory query returns accurate (mock) data per barrio |
| **Reliability** | Three-layer fallback (§8); no new external network dependency |
| **Maintainability** | All new functions documented with commercial-logic docstrings explaining the sales rationale |
| **Performance Efficiency** | In-process JSON query ≤50ms; no new external service calls in the hot path |
| **Security** | Inventory JSON is read-only; `sanitize.py` already defends user input |
| **Compatibility** | WPPConnect and dashboard untouched; Prisma migration is `ADD COLUMN` only |

---

## 10. Git Workflow

### Decision
All work on branch `feature/sales-closer-engine-v2`. Conventional commit format:

| Change Type | Example Commit |
|-------------|----------------|
| New data file | `feat(data): add inventory_colombia.json with Pasto/Bogotá/Medellín/Cali properties` |
| InventoryService | `feat(agent): implement InventoryService mock-RAG for property lookup` |
| Prompt redesign | `feat(agent): redesign system prompt with sales closer persona and CTA logic` |
| Slot extraction | `feat(agent): add preferred_neighborhood slot extraction in slot_check` |
| Evaluate lead | `feat(agent): normalize urgency_level in evaluate_lead node` |
| Generate response | `feat(agent): inject inventory context and CTA into generate_response` |
| Prisma migration | `feat(backend): add slotNeighborhood and urgencyLevel columns to Lead` |
| State update | `feat(agent): extend AgentState with preferred_neighborhood and urgency_level` |
| Fallback logic | `feat(agent): implement inventory fallback to real_estate_kb on query failure` |
| Documentation | `docs(spec): update spec.md and tasks.md for sales-closer-engine-v2` |
