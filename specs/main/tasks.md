# Tasks: Production Integrity Hardening

**Branch**: `feature/production-integrity-final`
**Input**: Design documents from `specs/main/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**ISO 25010 Compliance Tracking**: Each phase marks its quality characteristics.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: User story label (US1–US4)
- All file paths are relative to repo root

---

## Phase 1 — Setup & ENV Audit (Foundational)

> **Goal**: Ensure all Fly.io secrets and environment variables are correctly set before any code change is deployed.
> **ISO 25010**: Security (Confidentiality), Reliability (Fault Tolerance)
> **Independent test**: `fly secrets list --app <each-app>` shows all required vars; DATABASE_URL includes `sslmode=require`

- [x] T001 Audit Fly.io secrets for `wppconnect-sales-agent`: verify `WPPCONNECT_SECRET_KEY` and `WEBHOOK_URL` are set as secrets (not hardcoded in config.json)
- [x] T002 Audit Fly.io secrets for `wsa-backend-api`: verify `DATABASE_URL` includes `?sslmode=require`, `AGENT_URL` is `https://wsa-agent-langgraph.fly.dev` (not localhost default), `WPPCONNECT_URL`, `WPPCONNECT_SECRET_KEY`, `WPPCONNECT_SESSION`, `INTERNAL_API_KEY` are all set
- [x] T003 Audit Fly.io secrets for `wsa-agent-langgraph`: verify `DATABASE_URL` uses direct Neon connection (not pooler), includes `?sslmode=require`, `GROQ_API_KEY` is set
- [x] T004 Audit Vercel environment variables for frontend: verify `BACKEND_API_URL`, `INTERNAL_API_KEY`, `WPPCONNECT_URL`, `WPPCONNECT_SECRET_KEY`, `WPPCONNECT_SESSION` are all set
- [x] T005 Document all confirmed/missing ENV vars in `specs/main/data-model.md` under the ENV audit section, marking each as ✅ confirmed or ❌ missing

---

## Phase 2 — US1: Fly.io Infrastructure Hardening

> **Goal**: WPPConnect starts cleanly on Fly.io micro-VMs; QR code renders in frontend within 30s; CORS allows Vercel origin.
> **User Stories**: R1 (Headless Browser), R2 (QR Endpoint), R3 (CORS)
> **ISO 25010**: Reliability (Fault Tolerance, Availability), Security (Integrity), Performance Efficiency

### Independent test criteria
- WPPConnect Puppeteer starts without OOM — visible in `fly logs --app wppconnect-sales-agent`
- `curl -H "x-internal-key: $KEY" https://wsa-backend-api.fly.dev/api/v1/auth/qr` returns `{ status, connected, qrcode }`
- `curl -v -X OPTIONS -H "Origin: https://frontend-rho-one-21.vercel.app" https://wsa-backend-api.fly.dev/api/v1/leads` returns `204` with `Access-Control-Allow-Origin` header

### Tasks

- [x] T006 [US1] Add `--single-process` flag to `createOptions.args` array in `wppconnect-config/config.json` (place after `--no-zygote`)
- [x] T007 [US1] Add health check to `wppconnect-config/fly.toml`: add `[[services.http_checks]]` block with `interval = "30s"`, `timeout = "10s"`, `grace_period = "20s"`, `path = "/"`, `method = "get"` targeting the WPPConnect health endpoint
- [x] T008 [P] [US1] Create `services/backend-api/src/middleware/cors.middleware.ts`: export `corsMiddleware` using the `cors` npm package, allowing origin `https://frontend-rho-one-21.vercel.app` and regex `/^http:\/\/localhost(:\d+)?$/`, methods `GET POST PUT PATCH DELETE OPTIONS`, headers `Content-Type Authorization X-Requested-With x-internal-key`, `maxAge: 86400`, `credentials: false`
- [x] T009 [US1] Install `cors` and `@types/cors` packages in `services/backend-api/`: run `npm install cors @types/cors`
- [x] T010 [US1] Mount `corsMiddleware` in `services/backend-api/src/index.ts` BEFORE `authMiddleware` (line ~27) so OPTIONS preflight requests return 204 without auth check
- [x] T011 [P] [US1] Create `services/backend-api/src/routes/auth.route.ts`: implement `GET /qr` handler that calls WPPConnect `/api/{session}/status-session` with Bearer token, retries up to 3 times on 5xx/network error with 500ms and 1000ms delays, returns `{ status, connected, qrcode, session, checkedAt, error? }`
- [x] T012 [US1] Mount `authRouter` in `services/backend-api/src/index.ts` at path `/api/v1/auth`
- [x] T013 [US1] Update `services/frontend/src/app/api/whatsapp/route.ts` GET handler: replaced direct WPPConnect call with proxied call to `${BACKEND_API_URL}/api/v1/auth/qr`

---

## Phase 3 — US2: Data Layer Hardening (Neon + Prisma)

> **Goal**: Prisma connects to Neon with SSL enforced; no connection pool exhaustion under load.
> **User Stories**: R4 (Neon/Prisma Connection)
> **ISO 25010**: Reliability (Fault Tolerance), Security (Confidentiality — TLS in transit)

### Independent test criteria
- `fly ssh console --app wsa-backend-api -C "node -e \"require('./dist/services/prisma.client')\""` exits 0 without SSL errors
- Backend health endpoint returns `{ status: 'ok' }` after fresh deploy with updated DATABASE_URL

### Tasks

- [x] T014 [US2] Update `services/backend-api/src/services/prisma.client.ts`: add explicit `datasources` override to `PrismaClient` constructor
- [x] T015 [US2] Update `services/backend-api/prisma/schema.prisma`: add comment documenting required Neon pooler URL format
- [x] T016 [US2] Update `services/backend-api/src/config.ts`: add non-fatal warning if `sslmode=require` missing from DATABASE_URL

---

## Phase 4 — US3: Frontend UX Hardening

> **Goal**: Lead status changes visible within 3s; WhatsApp page shows maintenance state when backend unreachable; no stale cached data.
> **User Stories**: R5 (Cache Elimination), R6 (Reactive Polling), R7 (Circuit Breaker)
> **ISO 25010**: Usability (User Error Protection, User Interface Aesthetics), Reliability (Fault Tolerance), Performance Efficiency

### Independent test criteria
- Browser DevTools Network tab shows `/api/leads` polled every ~2.5s
- Stopping `wsa-backend-api` → WhatsApp page transitions to "Mantenimiento Temporal" after ~15s (3 failures × 5s interval)
- Dashboard page source shows no `Cache-Control: s-maxage` headers (force-dynamic confirmed)

### Tasks

- [x] T017 [US3] Add `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` to `services/frontend/src/app/dashboard/page.tsx`
- [x] T018 [P] [US3] Update `services/frontend/src/app/dashboard/LeadsListClient.tsx`: `refreshInterval: 4000` → `2500`
- [x] T019 [P] [US3] Update `services/frontend/src/app/dashboard/StatsGrid.tsx`: `refreshInterval: 5000` → `2500`
- [x] T020 [US3] Create `services/frontend/src/components/MaintenancePanel.tsx`: circuit breaker UI component with OPEN/HALF_OPEN states
- [x] T021 [US3] Update `services/frontend/src/app/dashboard/whatsapp/page.tsx`: integrate circuit breaker (FAILURE_THRESHOLD=3, RECOVERY_DELAY=30s) with MaintenancePanel

---

## Phase 5 — US4: ISO 25010 Quality Verification

> **Goal**: Confirm handoff integrity and functional suitability per ISO 25010.
> **User Stories**: R8 (LangGraph Handoff Integrity)
> **ISO 25010**: Functional Suitability (Functional Correctness, Functional Completeness)
> **Note**: Research phase confirmed this is already correct — this phase documents and verifies only.

### Independent test criteria
- `grep -r "lead_id" services/agent-langgraph/src/` shows `lead_id` in `state.py` TypedDict and `main.py` initial_state
- Handoff node output dict in `handoff.py` does NOT need to include `lead_id` (LangGraph carries forward unmodified state keys) — confirm this behavior is documented

### Tasks

- [x] T022 [US4] Add ISO 25010 docstring to `services/agent-langgraph/src/graph/nodes/handoff.py` documenting lead_id preservation behavior
- [x] T023 [P] [US4] Add ISO 25010 docstring to `services/agent-langgraph/src/main.py` documenting thread_id/lead_id semantics
- [x] T024 [P] [US4] Add ISO 25010 comment to `services/backend-api/src/routes/webhook.route.ts` step 10 documenting handoff flow

---

## Phase 6 — Polish & Cross-Cutting Concerns

> **Goal**: Final integration check, error message consistency, and branch preparation.
> **ISO 25010**: Maintainability (Modifiability, Analysability), Portability (Installability)

- [x] T025 Update `services/backend-api/src/index.ts`: added `HEAD /health` endpoint alongside existing `GET /health`
- [x] T026 [P] Update `specs/main/tasks.md` (this file): all tasks marked complete
- [x] T027 [P] Create branch `feature/production-integrity-final`: done
- [x] T028 Stage and commit all changes on branch `feature/production-integrity-final`

---

## Dependency Graph

```
Phase 1 (ENV Audit) ──► Phase 2 (Infra: US1)
                    ──► Phase 3 (Neon: US2)     [independent]
                    ──► Phase 4 (Frontend: US3)  [independent]
                    ──► Phase 5 (ISO: US4)        [independent, audit-only]

Phase 2 completes ──► Phase 6 (Polish)
Phase 3 completes ──►
Phase 4 completes ──►
Phase 5 completes ──►
```

**Key dependencies:**
- T009 (npm install cors) must complete before T008 (create cors.middleware.ts) can be compiled
- T011 (auth.route.ts) must complete before T012 (mount route in index.ts)
- T020 (MaintenancePanel component) must complete before T021 (circuit breaker integration)

---

## Parallel Execution Examples

### US1 — Run in parallel after T009 (npm install):
```
T008 (cors.middleware.ts)  ──┐
T011 (auth.route.ts)       ──┼──► T010 (mount cors) + T012 (mount auth route) ──► T013 (update frontend)
T007 (fly.toml health)     ──┘
```

### US3 — Run in parallel:
```
T017 (force-dynamic)   ──┐
T018 (LeadsListClient) ──┼──► T021 (circuit breaker integration)
T019 (StatsGrid)       ──┤
T020 (MaintenancePanel)──┘
```

### US4 — All parallel:
```
T022 (handoff.py docstring)  ──┐
T023 (main.py docstring)     ──┼──► T028 (commit)
T024 (webhook.route comment) ──┘
```

---

## Implementation Strategy

### MVP (Minimum Viable Patch — deploy immediately)
1. **T006**: `--single-process` flag → fixes OOM crash (1 line change, zero risk)
2. **T002**: Verify `AGENT_URL` env var → fixes silent agent 500 errors (no code change)
3. **T017**: `force-dynamic` on dashboard page → fixes stale data (2 line change, zero risk)
4. **T018 + T019**: Polling 2500ms → reactive lead status (2 line changes)

These 4 changes address the most critical P0 symptoms with minimal blast radius.

### Full Hardening Sprint (complete all phases)
Phase 1 → Phase 2 (T006–T013) → Phase 3 (T014–T016) → Phase 4 (T017–T021) → Phase 5 (T022–T024) → Phase 6 (T025–T028)

---

## ISO 25010 Compliance Summary

| Quality Characteristic | Tasks | Status |
|------------------------|-------|--------|
| Functional Suitability (Correctness) | T022, T023, T024 | ✅ Verified — compliant |
| Reliability (Fault Tolerance) | T006, T007, T011, T021 | ✅ Implemented |
| Reliability (Availability) | T007, T025 | ✅ Implemented |
| Security (Confidentiality) | T008, T010, T001–T004 | ✅ Implemented |
| Performance Efficiency | T018, T019 | ✅ Implemented (2500ms polling) |
| Usability (User Error Protection) | T020, T021 | ✅ Implemented (MaintenancePanel) |
| Maintainability | T015, T016, T022–T024 | ✅ Implemented |
