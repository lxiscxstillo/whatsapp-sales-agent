# Tasks: Sales Closer Engine v2

**Branch**: `feature/sales-closer-engine-v2`
**Input**: Design documents from `specs/main/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**ISO 25010 Coverage**: Functional Suitability · Reliability · Maintainability · Performance Efficiency · Security

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: User story label (US1–US4)
- All file paths are relative to repo root

---

## Phase 1 — Setup & Branch

> **Goal**: Establish feature branch and create the inventory data file that all subsequent phases depend on.
> **Independent test**: `git branch --show-current` returns `feature/sales-closer-engine-v2` · `python3 -c "import json,pathlib; d=json.loads(pathlib.Path('data/inventory_colombia.json').read_text()); print(len(d['properties']))"` prints ≥ 15

- [x] T001 Create and checkout branch `feature/sales-closer-engine-v2` from `main`
- [x] T002 Create directory `data/` at repo root (`.gitkeep` placeholder if needed)
- [x] T003 Create `data/inventory_colombia.json` following the schema in `specs/main/data-model.md` §1: include `version`, `last_updated`, `total_properties`, and `properties` array with ≥ 15 records across Pasto (Palermo, Maridíaz, Avenida Panamericana, Tamasagra, Anganoy, El Prado, San Ignacio), Bogotá (Chicó, Cedritos), Medellín (El Poblado, Laureles), Cali (Pance). Each record must have all fields: `id`, `type`, `city`, `zone`, `price_cop`, `price_display`, `area_m2`, `bedrooms`, `bathrooms`, `amenities`, `unique_selling_argument`, `stratum`, `status`, `contact_advisor`

---

## Phase 2 — US1: Mock-RAG Inventory Engine

> **Goal**: In-process `InventoryService` loads `data/inventory_colombia.json` at FastAPI startup, exposes `query()` for property lookup, and gracefully degrades to `[]` on any file/parse error — conversation never breaks.
> **User Stories**: R1 (Mock-RAG Inventory), R5 (Reliability Fallback)
> **ISO 25010**: Functional Suitability, Reliability (Fault Tolerance), Performance Efficiency
>
> **Independent test criteria**:
> - Agent startup log shows `{"event": "inventory.loaded", "total": N, ...}` (success) or `{"event": "inventory.load_failed", ...}` (graceful failure) — never an exception
> - `POST /agent/process` with `{"message": "busco apartamento en Palermo, Pasto", "city": "Pasto"}` → response body references a property from `PST-xxx` inventory
> - Renaming `data/inventory_colombia.json` temporarily → agent still responds with general market knowledge (no 500 error)

- [x] T004 [US1] Create `services/agent-langgraph/src/tools/inventory_service.py`: define `PropertyRecord` dataclass with all fields from `data-model.md` §4, and `InventoryQueryResult` dataclass with `properties: list[PropertyRecord]`, `alternatives: list[PropertyRecord]`, `query_succeeded: bool`, `total_matches: int`. Add module-level commercial-rationale docstring explaining Mock-RAG pattern choice.
- [x] T005 [US1] Add `ADJACENT_ZONES: dict[str, list[str]]` map to `services/agent-langgraph/src/tools/inventory_service.py` covering all Pasto zones (Palermo↔Maridíaz↔El Prado, Avenida Panamericana↔Tamasagra↔Anganoy, El Prado↔San Ignacio) plus Bogotá (Chicó↔Cedritos), Medellín (El Poblado↔Laureles), Cali (Pance↔Ciudad Jardín). Add inline comment explaining why adjacency is hardcoded (prevents LLM zone hallucination).
- [x] T006 [US1] Implement `InventoryService` class in `services/agent-langgraph/src/tools/inventory_service.py`: `__init__(self, json_path: Path)` calls `_load()` which tries `json.loads(path.read_text())["properties"]` and on ANY exception logs `{"event": "inventory.load_failed", ...}` at WARNING and sets `self._properties = []`. `query(*, city, zone, budget_max, property_type, limit=3, include_alternatives=False)` filters `self._properties` case-insensitively, sorts by `price_cop` ASC, returns `InventoryQueryResult`. On empty result or load failure, `query_succeeded` reflects actual state. Method-level docstrings must include "Commercial rationale:" section.
- [x] T007 [US1] Add `_format_inventory_for_prompt(properties: list[PropertyRecord]) -> str` function to `services/agent-langgraph/src/tools/inventory_service.py`: formats list as `• [ID] Type en Zone — price_display | area_m2 m² | N hab/M baños\n  Amenidades: ...\n  ✨ Argumento: ...` per record, returns empty string for empty list.
- [x] T008 [US1] Update `services/agent-langgraph/src/main.py` lifespan: import `InventoryService` and `Path`, resolve inventory path as `Path(__file__).parent.parent.parent.parent / "data" / "inventory_colombia.json"`, instantiate `app.state.inventory = InventoryService(inventory_path)` inside `@asynccontextmanager async def lifespan(app)` before `yield`. Log `{"event": "inventory.startup_status", "total": len(app.state.inventory._properties)}` at INFO level.

---

## Phase 3 — US2: Sales Closer Persona & CTA Logic

> **Goal**: Agent responds with specific property data from inventory, uses Colombian professional real estate vocabulary, and ends every warm-lead response with a contextual CTA (visit proposal, call proposal, or discovery question).
> **User Stories**: R2 (Sales Closer Persona & CTA Logic)
> **ISO 25010**: Functional Suitability (Functional Appropriateness), Maintainability
>
> **Independent test criteria**:
> - `POST /agent/process` with interest_level=3 and city="Pasto" → response contains "¿Le parece si" or "¿Cuándo" or "agendamos" (CTA detected)
> - `POST /agent/process` with interest_level=1 (new lead) → response asks ONE discovery question, no visit proposal
> - `POST /agent/process` with interest_level=4 → response contains "urgencia" framing ("se están moviendo rápido" or similar)
> - System prompt contains "Con mucho gusto" and "Sector de alta valorización" phrases

- [x] T009 [US2] Rewrite `services/agent-langgraph/src/prompts/system_prompt.py` `SYSTEM_PROMPT_TEMPLATE`: (a) add persona block with Colombian professional modisms ("Con mucho gusto", "Sector de alta valorización", "Zona de gran proyección", "¿Le parece si coordinamos una visita para el jueves?", "Con gusto le acompaño en este proceso"); (b) add `{inventory_properties}` block with instruction "Si hay propiedades disponibles, menciona hasta 2 de forma natural en tu respuesta. Usa el ID para referencia interna"; (c) add `{inventory_alternative}` block with instruction "Si el cliente objeta el precio, ofrece esta alternativa de barrio cercano antes de cerrar"; (d) add `{cta_instruction}` block with instruction "Sigue EXACTAMENTE esta instrucción al cerrar tu respuesta". Keep all existing `{known_slots_summary}`, `{market_context}`, `{next_slot_question}`, `{response_instruction}`, `{conversation_history}` variables unchanged.
- [x] T010 [US2] Add `_compute_cta_instruction(interest_level: int, last_intent: str, has_city: bool) -> str` function to `services/agent-langgraph/src/graph/nodes/generate_response.py`: returns the CTA instruction string per the rules in `specs/main/research.md` §2 (level≥4 or HIGH_INTEREST → immediate visit/videocall; level≥3 + has_city → visit proposal; OBJECTION → alternative bridge; level=1 → single discovery question; needs_handoff=True → empty string). Add "Commercial rationale:" docstring.
- [x] T011 [US2] Add `_price_objection_detected(message: str) -> bool` function to `services/agent-langgraph/src/graph/nodes/generate_response.py`: checks if latest HumanMessage body contains any of `["caro", "costoso", "presupuesto", "precio", "mucho dinero", "no tengo", "muy alto", "económico", "más barato"]` (case-insensitive). Add docstring explaining why explicit keyword check is used over LLM (latency + reliability).
- [x] T012 [US2] Update main response-building logic in `services/agent-langgraph/src/graph/nodes/generate_response.py`: (a) extract `app_state = config.get("configurable", {}).get("app_state")` or use module-level app reference to access `app.state.inventory`; (b) call `inventory.query(city=slots.get("city"), zone=slots.get("preferred_neighborhood") or slots.get("zone"), budget_max=slots.get("budget_numeric"), property_type=slots.get("property_type"), limit=3, include_alternatives=_price_objection_detected(latest_message))`; (c) build `inventory_properties = _format_inventory_for_prompt(result.properties) if result.query_succeeded else ""`; (d) build `inventory_alternative = _format_inventory_for_prompt(result.alternatives) if result.alternatives else ""`; (e) compute `cta_instruction = _compute_cta_instruction(...)`; (f) pass all three new variables into `system_prompt.format(...)`. Keep all existing system prompt variables unchanged.
- [x] T013 [US2] Pass `app.state.inventory` through to `generate_response` node: update `services/agent-langgraph/src/main.py` to pass the inventory service via LangGraph `config["configurable"]` dict when invoking the graph: `config={"configurable": {"thread_id": req.phone, "inventory": app.state.inventory}}`. Update `generate_response.py` to read `inventory = config["configurable"].get("inventory")` with a `None` fallback that skips inventory query gracefully.

---

## Phase 4 — US3: Objection Handling via Adjacent Zones

> **Goal**: When a lead objects to price, the agent proactively offers an alternative property in an adjacent neighborhood — keeping the lead engaged instead of ending the conversation.
> **User Stories**: R3 (Objection Handling)
> **ISO 25010**: Functional Suitability (Functional Completeness), Reliability
>
> **Independent test criteria**:
> - `POST /agent/process` with `last_intent="OBJECTION"`, `message="está muy caro"`, `zone="Palermo"` → response mentions Maridíaz or El Prado property with lower price
> - `POST /agent/process` with `last_intent="OBJECTION"`, `message="está muy caro"`, no zone → response offers general alternative without hallucinating a zone

- [x] T014 [US3] Update `InventoryService.query()` in `services/agent-langgraph/src/tools/inventory_service.py`: when `include_alternatives=True` and `zone` is provided, look up `ADJACENT_ZONES.get(zone, [])`, query each adjacent zone for properties with `price_cop < budget_max * 0.95` (or any available price if no budget set), and populate `result.alternatives`. When zone is None or not in adjacency map, `alternatives = []`. Add docstring explaining the 0.95 multiplier rationale (alternative must be meaningfully cheaper to address the objection).
- [x] T015 [P] [US3] Update `services/agent-langgraph/src/graph/nodes/generate_response.py` `_compute_cta_instruction()`: when `last_intent == "OBJECTION"` AND `_price_objection_detected()` is True, override CTA instruction to: "Después de presentar la alternativa de barrio, proponga: '¿Le gustaría que le cuente más sobre [barrio alternativo]? Podemos coordinar una visita esta semana.'"

---

## Phase 5 — US4: Extended Lead Profiling

> **Goal**: Agent extracts and persists `preferred_neighborhood` (specific barrio preference) and `urgency_level` (normalized enum) in Neon DB — enabling advisors to filter and prioritize leads by location and urgency in the dashboard.
> **User Stories**: R4 (Extended Lead Profiling)
> **ISO 25010**: Functional Suitability (Functional Correctness), Maintainability
>
> **Independent test criteria**:
> - `POST /agent/process` with `message="busco en Palermo"` → `updated_slots.preferred_neighborhood == "Palermo"` in response
> - `POST /agent/process` with `message="lo necesito lo antes posible"` → `updated_slots.urgency_level == "inmediata"` in response
> - `SELECT "slotNeighborhood", "urgencyLevel" FROM "Lead" WHERE phone='...'` returns non-null values after a full conversation turn

- [x] T016 [US4] Update `services/agent-langgraph/src/graph/state.py` `LeadSlots` TypedDict: add `preferred_neighborhood: Optional[str]` and `urgency_level: Optional[str]` fields after the existing `objections` field. Add docstrings for both fields per `specs/main/contracts/agent-state-v2.md` (include "Commercial rationale:" section for each).
- [x] T017 [P] [US4] Update `services/agent-langgraph/src/prompts/slot_prompt.py` `SlotExtraction` Pydantic schema: add `preferred_neighborhood: Optional[str] = None` field with description `"Specific barrio or neighborhood mentioned by the lead (e.g., 'Palermo', 'El Poblado'). Extract ONLY if lead explicitly names a barrio, not just a city."`. Add extraction example to the prompt text showing Pasto barrio recognition.
- [x] T018 [US4] Add `URGENCY_MAPPING` dict and `normalize_urgency_level(raw_urgency: str | None) -> str` function to `services/agent-langgraph/src/graph/nodes/evaluate_lead.py`: map keywords to `"inmediata"`, `"1-3_meses"`, `"3-6_meses"`, `"mas_de_6_meses"`, default `"no_definida"` per `specs/main/research.md` §5. Call `normalize_urgency_level(slots.get("urgency"))` at the end of the evaluate_lead function and add `"urgency_level": normalized_urgency` to the `slots` update dict returned by the node. Add "Commercial rationale:" docstring.
- [x] T019 [US4] Update `services/backend-api/prisma/schema.prisma` `Lead` model: add `slotNeighborhood String?` and `urgencyLevel String?` after existing slot fields. Add inline comments: `// Sales Closer Engine v2: preferred barrio` and `// Sales Closer Engine v2: normalized urgency enum`.
- [x] T020 [US4] Run Prisma migration: `cd services/backend-api && npx prisma migrate dev --name add_lead_neighborhood_urgency`. Verify migration SQL contains only `ALTER TABLE "Lead" ADD COLUMN "slotNeighborhood" TEXT;` and `ALTER TABLE "Lead" ADD COLUMN "urgencyLevel" TEXT;` (no destructive operations).
- [x] T021 [US4] Update `services/agent-langgraph/src/main.py` `ProcessResponse` schema: add `preferred_neighborhood: Optional[str] = None` and `urgency_level: Optional[str] = None` to the `updated_slots` dict construction in the `/agent/process` endpoint handler (map from `output_state["slots"]`).
- [x] T022 [US4] Update lead persistence in `services/backend-api/src/routes/webhook.route.ts` or `services/backend-api/src/services/lead.service.ts`: in the `upsert`/`update` call for lead slots, add `slotNeighborhood: agentResponse.updated_slots?.preferred_neighborhood ?? undefined` and `urgencyLevel: agentResponse.updated_slots?.urgency_level ?? undefined`. Ensure TypeScript interfaces for `AgentResponse` include the two new optional fields.

---

## Phase 6 — Polish & Cross-Cutting Concerns

> **Goal**: Documentation quality gate (ISO 25010 Maintainability), final regression verification, and conventional commit preparation.
> **ISO 25010**: Maintainability (Analysability, Modifiability), Compatibility

- [x] T023 [P] Add "Commercial rationale:" docstrings to ALL new/modified functions in `services/agent-langgraph/src/tools/inventory_service.py` that do not already have them: `__init__`, `_load`, `query`, `_format_inventory_for_prompt`.
- [x] T024 [P] Add "Commercial rationale:" docstrings to ALL new functions in `services/agent-langgraph/src/graph/nodes/generate_response.py`: `_compute_cta_instruction`, `_price_objection_detected`, and the inventory injection block (inline comment block explaining the three-layer fallback).
- [x] T025 [P] Add "Commercial rationale:" docstring to `normalize_urgency_level` in `services/agent-langgraph/src/graph/nodes/evaluate_lead.py` explaining why normalized enum is needed alongside raw `urgency` text.
- [x] T026 [P] Run regression smoke test: verify `services/agent-langgraph` starts with `uvicorn src.main:app --reload` without import errors; verify `services/backend-api` compiles with `npm run build` (no TypeScript errors).
- [x] T027 [P] Update `specs/main/tasks.md` (this file): mark all completed tasks with `[x]` after implementation is done.

---

## Dependency Graph

```
Phase 1 (Setup: T001–T003)
  └──► Phase 2 (US1 InventoryService: T004–T008)   ← requires data/inventory_colombia.json
         └──► Phase 3 (US2 CTA/Persona: T009–T013) ← requires InventoryService in app.state
                └──► Phase 4 (US3 Objection: T014–T015) ← requires query(include_alternatives)

Phase 2 (US1: T004–T008)
  └──► Phase 5 (US4 Extended Profiling: T016–T022) [can run in parallel with Phase 3+4]
         T016 (state.py) → T017 (slot_prompt.py) [parallel]
         T016 (state.py) → T018 (evaluate_lead.py)
         T019 (schema.prisma) → T020 (migration) → T022 (backend mapping)
         T021 (ProcessResponse) requires T016 (state fields exist)

Phase 3–5 complete ──► Phase 6 (Polish: T023–T027)
```

**Key sequential dependencies:**
- T003 (inventory JSON) must exist before T008 (main.py startup loads it)
- T004–T006 (InventoryService class) must complete before T007 (`_format_inventory_for_prompt`) and T013 (configurable injection)
- T008 (main.py lifespan) must complete before T012 (generate_response reads from app.state)
- T019 (schema.prisma) must complete before T020 (prisma migrate)
- T016 (state.py) must complete before T018 (evaluate_lead uses urgency_level key)

---

## Parallel Execution Examples

### Phase 2 — US1 (after T003 data file):
```
T004 (PropertyRecord/InventoryQueryResult dataclasses) ──┐
T005 (ADJACENT_ZONES map)                               ──┼──► T006 (InventoryService class body)
                                                          │      └──► T007 (_format_inventory_for_prompt)
                                                          │      └──► T008 (main.py lifespan init)
```

### Phase 3 — US2 (after T008):
```
T009 (system_prompt.py rewrite) ──────────────────────────┐
T010 (_compute_cta_instruction) ──┐                       │
T011 (_price_objection_detected)──┼──► T012 (wire together) ──► T013 (configurable injection)
```

### Phase 5 — US4 (independent from Phase 3+4, after Phase 2):
```
T016 (state.py slots) ──────────────────────────────────────────┐
T017 (slot_prompt.py) [parallel with T016]                      │
T018 (evaluate_lead normalization) [after T016]                 │
T019 (schema.prisma) ──► T020 (migration) ──► T022 (backend)   ├──► T021 (ProcessResponse)
```

### Phase 6 — Polish (all parallel):
```
T023 (inventory_service docstrings) ──┐
T024 (generate_response docstrings) ──┼──► T027 (mark tasks complete)
T025 (evaluate_lead docstrings)     ──┤
T026 (regression smoke test)        ──┘
```

---

## Implementation Strategy

### MVP — Minimum Viable Closer (deploy-ready increments)

**Increment 1 — Inventory Only** (T001–T008):
Agent can query and surface specific property data in responses. No CTA yet, but factual accuracy dramatically improves. Zero risk to existing behavior (inventory is additive to prompt, fallback if missing).

**Increment 2 — Add CTA Injection** (T009–T013):
Warm and hot leads now receive visit/call proposals. Cold leads still receive discovery questions. Existing conversation routing in `graph.py` is untouched.

**Increment 3 — Objection Handling** (T014–T015):
Price objections are handled with adjacent-zone alternatives. Only activates when `last_intent == OBJECTION` + price keyword detected.

**Increment 4 — Lead Profiling + DB** (T016–T022):
New slots persisted in Neon. Backward-compatible migration (nullable columns). Advisors can now filter by neighborhood and urgency.

**Increment 5 — Documentation** (T023–T027):
ISO 25010 Maintainability gate. No behavior changes.

### No-Regression Guarantee
- `graph.py` routing: **unchanged**
- `wppconnect-config/`: **unchanged**
- `services/frontend/`: **unchanged**
- `detect_intent.py`, `slot_check.py`, `handoff.py`, `fallback.py`: **unchanged**
- All new Prisma columns are nullable with no `DEFAULT` — zero risk on existing rows

---

## ISO 25010 Compliance Summary

| Quality Characteristic | Tasks | Target |
|------------------------|-------|--------|
| Functional Suitability (Appropriateness) | T009–T013, T014–T015 | CTA + inventory in every warm-lead response |
| Functional Suitability (Completeness) | T003, T004–T008 | All 4 cities, 7 Pasto neighborhoods covered |
| Functional Suitability (Correctness) | T016–T022 | Structured slots persisted for advisor queries |
| Reliability (Fault Tolerance) | T006, T008, T012, T013 | Three-layer fallback; agent never crashes on inventory errors |
| Maintainability (Analysability) | T023–T025 | Commercial-rationale docstrings on all new functions |
| Performance Efficiency | T004–T007 | In-process query ≤50ms; no new network dependencies |
| Security | T003 | Inventory JSON is read-only static data; no secrets |
| Compatibility | T019–T020 | Non-destructive migration; backward-compatible schema |
