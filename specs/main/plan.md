# Implementation Plan: Sales Closer Engine v2

**Branch**: `feature/sales-closer-engine-v2` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification — Sales Closer Engine v2 (evolución de captación pasiva a motor de cierre)

---

## Summary

Transform the existing passive-capture LangGraph agent into a **High-Performance Sales Closer** by injecting hyper-local Colombian property inventory (Mock-RAG), redesigning the conversational persona with closing logic (CTA-first responses, objection-handling), enriching lead persistence with urgency level and neighborhood preference, and hardening the system against inventory-query failures via graceful fallback — all without touching WPPConnect stability or the Next.js dashboard.

**Technical approach**: Add a `InventoryService` (pure Python, file-based) that loads `data/inventory_colombia.json` at startup, expose a `query_inventory` tool callable from `generate_response` and `evaluate_lead` nodes, update system prompt templates to embed CTA instructions and objection-handling logic, add two Prisma columns (`slotNeighborhood`, `urgencyLevel`) with a non-destructive migration, and document every new function with sales-rationale docstrings.

---

## Technical Context

**Language/Version**: Python 3.11 (agent-langgraph) · TypeScript 5.x (backend-api) · Next.js 14 (frontend)
**Primary Dependencies**: LangGraph 0.2.x, Groq SDK, FastAPI, Pydantic-settings, Prisma 5.x, Express 4.x
**Storage**: Neon PostgreSQL (via Prisma + AsyncPostgresSaver), `data/inventory_colombia.json` (file-based mock-RAG, read-only at runtime)
**Testing**: pytest (agent) · Jest/Supertest (backend-api)
**Target Platform**: Fly.io (agent-langgraph + backend-api) · Vercel (frontend)
**Project Type**: Multi-service web application (Python FastAPI + Node.js REST API + Next.js dashboard)
**Performance Goals**: Agent response latency ≤ 3s p95 · Inventory query ≤ 50ms (in-process, no network) · Dashboard poll 2500ms already in place
**Constraints**: No WPPConnect config changes · No dashboard regressions · No destructive Prisma migrations · All new code documented with commercial-logic docstrings
**Scale/Scope**: ~100 concurrent leads · Inventory dataset ~50 properties across 4 cities

---

## Constitution Check

*Note: Project constitution file is unpopulated (template placeholders only). Applying inferred principles from CLAUDE.md and user requirements.*

| Gate | Status | Notes |
|------|--------|-------|
| No regression on WPPConnect | ✅ PASS | Inventory + prompt changes are isolated to agent-langgraph service |
| No regression on dashboard | ✅ PASS | No frontend changes in this feature |
| Non-destructive DB migration | ✅ PASS | Only `ADD COLUMN` operations; existing rows default to `NULL` |
| Secrets remain env-driven | ✅ PASS | JSON inventory is static data, no secrets involved |
| All new code documented | ✅ REQUIRED | Enforce via docstrings with sales-rationale explanation |
| Conventional commits on feature branch | ✅ REQUIRED | Branch: `feature/sales-closer-engine-v2` |

---

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              # This file
├── research.md          # Phase 0 output — Mock-RAG, CTA psychology, schema decisions
├── data-model.md        # Phase 1 output — Inventory JSON schema + Prisma additions
├── quickstart.md        # Phase 1 output — Dev setup for the new feature
├── contracts/           # Phase 1 output
│   ├── inventory-query.md    # InventoryService query contract
│   └── agent-state-v2.md     # Updated AgentState contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code Changes (repository root)

```text
data/
└── inventory_colombia.json        # NEW — Single Source of Truth for property inventory

services/agent-langgraph/src/
├── tools/
│   ├── real_estate_kb.py          # UNCHANGED — market-level knowledge base
│   └── inventory_service.py       # NEW — Mock-RAG: loads + queries inventory_colombia.json
├── graph/
│   ├── state.py                   # MODIFIED — add preferred_neighborhood, urgency_level fields
│   ├── nodes/
│   │   ├── generate_response.py   # MODIFIED — inject inventory results + CTA logic
│   │   └── evaluate_lead.py       # MODIFIED — use urgency_level in scoring
│   └── graph.py                   # UNCHANGED — routing logic stays the same
├── prompts/
│   ├── system_prompt.py           # MODIFIED — add CTA instructions, objection-handling template
│   └── slot_prompt.py             # MODIFIED — add preferred_neighborhood slot extraction
└── main.py                        # MODIFIED — initialize InventoryService at startup

services/backend-api/
└── prisma/
    └── schema.prisma              # MODIFIED — add slotNeighborhood, urgencyLevel columns
    └── migrations/                # NEW — migration for the two new columns
```

**Structure Decision**: Web application (Option 2). All changes are concentrated in `agent-langgraph` (Python, AI logic) and `backend-api` (Prisma schema). The `frontend` and `wppconnect-config` services are untouched.

---

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| `InventoryService` class (new file) | Encapsulates JSON load + filter logic; mockable in tests | Inline dict in prompt template makes unit testing impossible and the 50-property dataset too large to embed in every prompt call |
| Separate `data/` directory at repo root | Single source of truth shared by agent + future admin tools | Storing in `src/tools/` would make it agent-only; marketing or admin tools may need to read/write the same data |
| Two new Prisma columns | ISO 25010 Functional Suitability — persist urgency + neighborhood for advisor routing | Storing in free-form `agentNotes` would make structured queries impossible |

---

## Implementation Phases

### Phase 0 — Research (complete → see research.md)

- [x] Mock-RAG patterns for file-based inventory in LangGraph agents
- [x] CTA injection strategies in LLM system prompts
- [x] Colombian professional real estate modisms + sales psychology
- [x] Prisma non-destructive migration patterns for Neon
- [x] LangGraph node modification patterns (preserving existing routing)

### Phase 1 — Design & Contracts (complete → see artifacts below)

- [x] `data/inventory_colombia.json` schema definition → `data-model.md`
- [x] `InventoryService` query API → `contracts/inventory-query.md`
- [x] Updated `AgentState` additions → `contracts/agent-state-v2.md`
- [x] Prisma schema additions → `data-model.md`
- [x] Development quickstart → `quickstart.md`

### Phase 2 — Tasks (next step → run /speckit.tasks)

See `tasks.md` (generated by `/speckit.tasks` command).
