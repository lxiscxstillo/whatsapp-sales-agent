# Research: Production Integrity Hardening

**Phase**: 0 — Audit & Research
**Date**: 2026-03-20
**Status**: COMPLETE — all unknowns resolved

---

## 1. WPPConnect Headless Browser on Fly.io

### Decision
Add `--single-process` flag to Puppeteer `createOptions.args` in `config.json`. Keep all existing flags. No `--headless=new` needed (WPPConnect already handles headless mode internally).

### Current state
```json
"args": [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu"
]
```

### Required addition
```json
"--single-process"
```

### Rationale
- `--single-process` prevents Chromium from spawning separate renderer, GPU, and utility processes, which fail on containers with limited file descriptors and shared-CPU Fly.io VMs.
- Fly.io micro-VMs have `--no-zygote` and `--no-sandbox` as prerequisites; `--single-process` is the final piece that eliminates fork() failures.
- `--disable-gpu` is already present and handles GPU process elimination independently.

### Alternatives considered
- **--headless=new**: Tried on other projects; not needed since WPPConnect server manages headless mode.
- **Increasing VM memory to 2GB**: More expensive, doesn't fix the root cause (process model).
- **--disable-web-security**: Security risk; rejected.

---

## 2. CORS Configuration for Cross-Cloud Calls

### Decision
Add CORS middleware to backend-api Express app. Mount before `authMiddleware`.

### Rationale
Although current architecture routes all browser requests through Next.js API handlers (server-side proxy), there are two scenarios where CORS is needed:
1. WPPConnect direct webhook delivery: not a browser call, CORS not needed here
2. Future direct browser-to-API calls (e.g., SSE for real-time updates): will fail without CORS
3. User-facing error messages in browser devtools may mislead: explicit CORS prevents confusion

The most critical reason: Next.js API routes on Vercel **do** make server-side calls to Fly.io, but if the backend ever returns a redirect (301/302), the browser may follow it — requiring CORS on the final destination.

### Implementation
```typescript
// cors.middleware.ts
import cors from 'cors';

export const corsMiddleware = cors({
  origin: [
    'https://frontend-rho-one-21.vercel.app',
    // Allow localhost for development
    /^http:\/\/localhost(:\d+)?$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-internal-key'],
  maxAge: 86400, // 24h preflight cache
  credentials: false, // No cookies used; internal key in header
});
```

### Alternatives considered
- **Wildcard `*` origin**: Rejected — exposes internal API to all origins
- **No CORS / keep as-is**: Rejected — P0 requirement explicitly calls for hardening

---

## 3. QR Endpoint Architecture

### Decision
Add `GET /api/v1/auth/qr` to backend-api with retry wrapper. Frontend `/api/whatsapp` route handler continues to proxy through Next.js (no direct frontend-to-wppconnect calls).

### Current flow
```
Frontend (browser) → Next.js /api/whatsapp → WPPConnect /status-session (direct)
```

### New flow
```
Frontend (browser) → Next.js /api/whatsapp → backend-api /api/v1/auth/qr → WPPConnect /status-session
                                              [retry logic, auth, normalization here]
```

### Rationale
- Centralizes WPPConnect auth token management in backend-api (single source of truth)
- Retry logic prevents transient WPPConnect startup failures from surfacing to users
- Decouples frontend from WPPConnect URL and auth token details

### Alternatives considered
- **Keep direct call from Next.js route handler**: Simpler but duplicates token management logic; no retry standardization
- **Server-Sent Events (SSE) for QR streaming**: Better UX but scope too large for P0 patch

---

## 4. Neon / Prisma Connection Pooling

### Decision
Document and enforce `?sslmode=require&pgbouncer=true&connection_limit=5` parameters in `DATABASE_URL`. No code change to `PrismaClient` instantiation needed if env var is correct.

### Neon connection string format
```
# Direct connection (use in migrations only)
postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require

# Pooled connection (use in production app runtime)
postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require&pgbouncer=true&connection_limit=5
```

### Prisma requirements for Neon
- Use **pooled** endpoint for backend-api (Node.js long-running process with Prisma connection pool)
- Use **direct** endpoint for `prisma migrate deploy` (run during Docker build/startup)
- `prepare_threshold=0` is set correctly in the Python agent's `AsyncConnectionPool` ✅
- Prisma 5.x handles pgbouncer mode via `?pgbouncer=true` URL parameter

### Current prisma.client.ts
The singleton pattern is correct. The main risk is if `DATABASE_URL` is missing `?sslmode=require`, causing SSL handshake failures on Neon's TLS-required endpoints.

### Alternatives considered
- **@neondatabase/serverless adapter**: Better for Vercel serverless but overkill for backend-api which is a long-running Docker container
- **pgbouncer sidecar on Fly.io**: Too complex for current scale

---

## 5. Frontend Dynamic Rendering & Polling

### Decision
- Add `export const dynamic = 'force-dynamic'` to `/dashboard/page.tsx` (Server Component)
- Change `LeadsListClient` `refreshInterval`: 4000ms → 2500ms
- Change `StatsGrid` `refreshInterval` to 2500ms
- Keep `WhatsAppPage` polling as-is (adaptive interval already implemented)

### Rationale
- Next.js 14 App Router caches Server Component responses by default (static rendering)
- `DashboardPage` uses `searchParams` (dynamic API), which should already opt it out of static caching in Next.js 14.2+, but explicit `force-dynamic` is safer
- 2500ms interval meets the <3s lead status update requirement with buffer for network latency

### Alternatives considered
- **React Query instead of SWR**: Both are equivalent; SWR already installed
- **WebSocket / SSE**: Better for real-time but requires infrastructure changes outside P0 scope
- **1000ms polling**: Would double API calls with minimal UX benefit

---

## 6. Circuit Breaker / Maintenance Mode

### Decision
Implement a lightweight client-side circuit breaker in `WhatsAppPage` using SWR's `onError` callback and a failure counter ref. No external library needed.

### State machine
```
CLOSED (normal) → [3 consecutive errors] → OPEN (maintenance)
OPEN → [retry after 30s] → HALF_OPEN
HALF_OPEN → [success] → CLOSED
HALF_OPEN → [failure] → OPEN
```

### Implementation approach
```typescript
// In WhatsAppClient component
const failureCount = useRef(0);
const [circuitState, setCircuitState] = useState<'CLOSED' | 'OPEN' | 'HALF_OPEN'>('CLOSED');

// SWR onError callback
onError: () => {
  failureCount.current += 1;
  if (failureCount.current >= 3) setCircuitState('OPEN');
}

// SWR onSuccess callback
onSuccess: () => {
  failureCount.current = 0;
  setCircuitState('CLOSED');
}
```

### Alternatives considered
- **cockatiel library**: Proper circuit breaker but adds dependency; overkill for this UI use case
- **Error boundary only**: No retry state management; shows generic error

---

## 7. LangGraph thread_id / Handoff Integrity Audit

### Finding: PASS ✅ (no changes needed)

**thread_id consistency:**
- `main.py` line 162: `thread_id = req.phone` — passed as `config["configurable"]["thread_id"]`
- All LangGraph invocations use the same config key; PostgreSQL checkpointer stores state per `thread_id`
- Phone format: `5491123456789` (stripped of `@c.us` suffix by webhook.route.ts) ✅

**lead_id through handoff:**
- `AgentState` TypedDict includes `lead_id: str` (state.py line 72) ✅
- Handoff node (`handoff.py`) does NOT include `lead_id` in its return dict — this is correct LangGraph behavior because LangGraph only updates the state keys explicitly returned; `lead_id` is preserved from the previous checkpoint state (the `add_messages` reducer merges, non-listed keys are carried forward)
- `main.py` line 171: `"lead_id": req.lead_id` — set in initial_state for every invocation, so even if checkpoint state doesn't have it, it's reset from the request ✅

**Handoff trigger flow:**
```
LangGraph → needs_handoff: True →
main.py returns ProcessResponse(trigger_handoff=True) →
webhook.route.ts step 10: leadService.updateHandoff(lead.id, reason) ✅
```

No thread_id loss detected. Lead_id is idempotently reset on every agent invocation.

---

## 8. ENV Discrepancy Audit

### Complete ENV map by service

#### wppconnect-config
| Variable | Where Used | Current Status |
|----------|------------|----------------|
| `WPPCONNECT_SECRET_KEY` | `config.ts` runtime, `config.json` secretKey field | ⚠️ config.json has placeholder "CHANGE_ME..." |
| `WEBHOOK_URL` | `config.ts` webhook.url | ⚠️ config.json has hardcoded `https://wsa-backend-api.fly.dev/...` |

**Fix**: `config.ts` correctly reads from env and builds the config object at runtime. The `config.json` is the fallback/static file; `start.sh` or the Dockerfile's entrypoint must use `config.ts` (not `config.json`) as the source of truth.

#### services/backend-api
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Must include `?sslmode=require` for Neon |
| `WPPCONNECT_URL` | ✅ | `https://wppconnect-sales-agent.fly.dev` |
| `WPPCONNECT_SECRET_KEY` | ✅ | Same key as WPPConnect service |
| `WPPCONNECT_SESSION` | Optional | Default: `my-whatsapp-session` |
| `AGENT_URL` | ✅ | `https://wsa-agent-langgraph.fly.dev` |
| `INTERNAL_API_KEY` | ✅ | Shared with frontend |
| `LANGCHAIN_API_KEY` | Optional | LangSmith tracing |

#### services/agent-langgraph
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Must be direct connection (not pooled) for async psycopg |
| `GROQ_API_KEY` | ✅ | LLM provider |
| `LANGCHAIN_API_KEY` | Optional | |
| `LANGCHAIN_TRACING_V2` | Optional | |

#### services/frontend
| Variable | Required | Notes |
|----------|----------|-------|
| `BACKEND_API_URL` | ✅ | `https://wsa-backend-api.fly.dev` (server-side only) |
| `INTERNAL_API_KEY` | ✅ | Shared with backend-api |
| `WPPCONNECT_URL` | ✅ | Direct WPPConnect calls from Next.js route handler |
| `WPPCONNECT_SECRET_KEY` | ✅ | Token generation |
| `WPPCONNECT_SESSION` | Optional | |
| `NEXT_PUBLIC_API_URL` | Optional | Client-side base URL (not currently used) |

### Critical discrepancy
`AGENT_URL` in `services/backend-api/src/config.ts` defaults to `http://localhost:8000` — on Fly.io this must be overridden to `https://wsa-agent-langgraph.fly.dev` or internal Fly DNS if services are in the same Fly organization.
