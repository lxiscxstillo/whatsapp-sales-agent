# Implementation Plan: Production Integrity Hardening

**Branch**: `feature/production-integrity-final` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/main/spec.md`

---

## Summary

This plan addresses a P0 multi-vector production incident affecting the WhatsApp Sales Agent system. The incident involves WPPConnect session failures (OOM headless browser), frontend stale data from cached Server Components, absent CORS middleware on the backend API, no circuit breaker for unreachable services, and lead status polling too slow for real-time advisor workflows. All four services (WPPConnect on Fly.io, backend-api on Fly.io, agent-langgraph on Fly.io, frontend on Vercel) require targeted patches.

---

## Technical Context

**Language/Version**: TypeScript 5.x (backend-api, frontend), Python 3.11 (agent-langgraph)
**Primary Dependencies**: Express 4.x, Next.js 14, LangGraph 0.2.x, Prisma 5.x, SWR 2.x, WPPConnect-Server-CLI latest
**Storage**: PostgreSQL (Neon Serverless), file-based WPPConnect session tokens on Fly.io volume
**Testing**: Manual integration testing (no automated test suite in scope for this patch)
**Target Platform**: Fly.io (São Paulo, gru region) + Vercel Edge Network
**Project Type**: Microservices web application (4 services)
**Performance Goals**: Lead status updates visible within 3s; QR render within 30s of cold start
**Constraints**: Fly.io micro-VM: 1 shared CPU, 512MB–1GB RAM; Neon free tier: 10 max connections; Vercel serverless: cold start budget ~1s
**Scale/Scope**: Single real-estate agency, ~10–50 concurrent leads, 1 human advisor

---

## Constitution Check

*GATE: Must pass before Phase 0 research.*

> **Note**: The constitution.md in this project is an unfilled template — no project-specific principles have been ratified yet. Proceeding with SRE/production-integrity best practices as the implicit constitution.

**Implicit gates applied:**
- ✅ No backwards-incompatible database schema changes (this is a hardening/patching sprint)
- ✅ All secrets remain in environment variables (no new hardcoded values introduced)
- ✅ Changes are narrowly scoped to the incident surface area (R1–R9 from spec)
- ✅ Complexity justified: Circuit breaker adds 1 client-side component; CORS adds 1 middleware; both are standard production requirements
- ✅ Existing auth flow (`x-internal-key`) preserved

**Complexity Tracking (justified additions):**

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| CORS middleware | Cross-origin requests from Vercel to Fly.io require explicit headers | Browser enforces CORS; cannot be skipped |
| Circuit breaker component | UX requirement: no blank errors when backend down | Error boundary alone doesn't handle retry state |
| `/api/v1/auth/qr` endpoint | Retry logic for QR fetch; decoupled from WPPConnect status endpoint | Frontend calling WPPConnect directly would bypass backend auth |

---

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — audit findings & decisions
├── data-model.md        # Phase 1 output — no schema changes, ENV audit
├── quickstart.md        # Phase 1 output — deployment guide
├── contracts/           # Phase 1 output — API contracts
│   ├── qr-endpoint.md
│   ├── cors-policy.md
│   └── circuit-breaker-states.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (affected files)

```text
wppconnect-config/
├── config.json                          # PATCH: add --single-process flag
└── fly.toml                             # PATCH: add health check

services/backend-api/src/
├── index.ts                             # PATCH: add cors middleware
├── middleware/
│   └── cors.middleware.ts               # NEW: CORS configuration
└── routes/
    └── auth.route.ts                    # NEW: /api/v1/auth/qr endpoint

services/frontend/src/app/
├── dashboard/
│   ├── page.tsx                         # PATCH: add force-dynamic
│   ├── LeadsListClient.tsx              # PATCH: refreshInterval 4000→2500
│   └── StatsGrid.tsx                    # PATCH: refreshInterval →2500
└── dashboard/whatsapp/
    └── page.tsx                         # PATCH: circuit breaker integration

services/frontend/src/components/
└── MaintenancePanel.tsx                 # NEW: maintenance mode UI component
```

---

## Implementation Phases

### Phase 1 — Fly.io Hardening (WPPConnect + Backend)

**P1.1 — Puppeteer flags**
- Add `--single-process` to `createOptions.args` in `wppconnect-config/config.json`
- Rationale: Required for single-CPU Fly.io VMs; prevents fork() failures in containers

**P1.2 — WPPConnect health check**
- Add `[[services.http_checks]]` to `wppconnect-config/fly.toml`
- Endpoint: `GET /api/{session}/{secretKey}/status-session` (or `/` if available)

**P1.3 — CORS middleware**
- Create `services/backend-api/src/middleware/cors.middleware.ts`
- Mount BEFORE `authMiddleware` in `index.ts` so preflight OPTIONS requests pass through
- Allow origin: `https://frontend-rho-one-21.vercel.app`

**P1.4 — QR endpoint with retry**
- Create `services/backend-api/src/routes/auth.route.ts`
- `GET /api/v1/auth/qr` — calls WPPConnect, retries 3x on 5xx, returns `{ status, qrcode, connected }`
- Mount in `index.ts`

### Phase 2 — Neon/Prisma Hardening

**P2.1 — DATABASE_URL validation**
- Audit that `DATABASE_URL` in Fly.io secrets includes `?sslmode=require`
- Document in `specs/main/data-model.md`
- Add `connection_limit=5` if using Neon connection pooler URL

**P2.2 — Prisma datasource override**
- Update `prisma.client.ts` to explicitly pass SSL configuration

### Phase 3 — Frontend Hardening

**P3.1 — Force-dynamic**
- Add `export const dynamic = 'force-dynamic'` to `/dashboard/page.tsx`

**P3.2 — Polling intervals**
- `LeadsListClient.tsx`: `refreshInterval: 4000` → `refreshInterval: 2500`
- `StatsGrid.tsx`: audit and set to 2500ms

**P3.3 — Circuit breaker / MaintenancePanel**
- Create `MaintenancePanel.tsx` component
- WhatsApp page: track consecutive errors; after 3 failures switch to maintenance state

### Phase 4 — ISO 25010 Verification

**P4.1 — LangGraph thread_id audit**
- Confirm `lead_id` is in `AgentState` TypedDict ✅ (already present)
- Confirm `thread_id = req.phone` is used consistently in `main.py` ✅
- Confirm handoff node output dict includes `lead_id` (check that state key is not dropped)

**P4.2 — ENV discrepancy audit**
- Cross-reference all services' required env vars
- Flag any hardcoded values in config files
- Document in `data-model.md`
