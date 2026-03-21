# Data Model: Production Integrity Hardening

**Phase**: 1 — Design
**Date**: 2026-03-20
**Note**: No database schema changes in this feature. This document covers the ENV configuration model and the new circuit breaker state model.

---

## ENV Audit Status (T001–T005)

| Service | Variable | Required | Status |
|---------|----------|----------|--------|
| wppconnect | `WPPCONNECT_SECRET_KEY` | ✅ | ⚠️ Verify — config.json has placeholder "CHANGE_ME" |
| wppconnect | `WEBHOOK_URL` | ✅ | ⚠️ config.json hardcodes `wsa-backend-api.fly.dev` — must be Fly.io secret |
| backend-api | `DATABASE_URL` | ✅ | ⚠️ Must include `?sslmode=require&pgbouncer=true&connection_limit=5` |
| backend-api | `AGENT_URL` | ✅ | ❌ **CRITICAL**: defaults to `http://localhost:8000` — must set `https://wsa-agent-langgraph.fly.dev` |
| backend-api | `WPPCONNECT_URL` | ✅ | ⚠️ Verify set to `https://wppconnect-sales-agent.fly.dev` |
| backend-api | `WPPCONNECT_SECRET_KEY` | ✅ | ⚠️ Verify set |
| backend-api | `WPPCONNECT_SESSION` | Optional | Set or use default `my-whatsapp-session` |
| backend-api | `INTERNAL_API_KEY` | ✅ | ⚠️ Verify set |
| agent-langgraph | `DATABASE_URL` | ✅ | ⚠️ Must be **direct** connection (not pooler), include `?sslmode=require` |
| agent-langgraph | `GROQ_API_KEY` | ✅ | ⚠️ Verify set |
| frontend (Vercel) | `BACKEND_API_URL` | ✅ | ⚠️ Verify set to `https://wsa-backend-api.fly.dev` |
| frontend (Vercel) | `INTERNAL_API_KEY` | ✅ | ⚠️ Verify matches backend-api |
| frontend (Vercel) | `WPPCONNECT_URL` | ✅ | ⚠️ Verify set (used by Next.js route for session restart POST) |
| frontend (Vercel) | `WPPCONNECT_SECRET_KEY` | ✅ | ⚠️ Verify set (used by Next.js route for token generation in POST) |

**Action required before deployment**: Run `fly secrets set AGENT_URL=https://wsa-agent-langgraph.fly.dev --app wsa-backend-api`

---

## 1. Database Schema (No Changes)

The existing Prisma schema in `services/backend-api/prisma/schema.prisma` is correct and requires no modifications. The `Lead` and `Message` models fully support all requirements.

**Relevant existing fields used by this feature:**
- `Lead.status` — transitions: `NEW → QUALIFYING → HOT → HANDOFF`
- `Lead.isHandoffRequested`, `Lead.handoffAt`, `Lead.handoffReason` — handoff tracking
- `Lead.ambiguityCount` — circuit breaker equivalent in agent
- `Message.langsmithRunId` — observability cross-reference

---

## 2. Connection String Model (Neon)

### Format specification

```
# Agent (direct — psycopg async pool)
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# Backend-API (pooled — Prisma)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=0
```

### ENV variable requirements by service

```yaml
# wppconnect-config fly.toml [env] section
WPPCONNECT_SECRET_KEY: "{{ fly secret }}"
WEBHOOK_URL: "https://wsa-backend-api.fly.dev/api/v1/webhook/message"

# backend-api fly.toml [env] section
DATABASE_URL: "postgresql://...@pooler.neon.tech/...?sslmode=require&pgbouncer=true&connection_limit=5"
WPPCONNECT_URL: "https://wppconnect-sales-agent.fly.dev"
WPPCONNECT_SECRET_KEY: "{{ fly secret }}"
WPPCONNECT_SESSION: "asesor-inmobiliario"
AGENT_URL: "https://wsa-agent-langgraph.fly.dev"    # ← CRITICAL: override localhost default
INTERNAL_API_KEY: "{{ fly secret }}"

# agent-langgraph fly.toml [env] section
DATABASE_URL: "postgresql://...@direct.neon.tech/...?sslmode=require"  # direct (not pooler)
GROQ_API_KEY: "{{ fly secret }}"
LANGCHAIN_TRACING_V2: "true"
LANGCHAIN_API_KEY: "{{ fly secret }}"

# frontend Vercel environment variables
BACKEND_API_URL: "https://wsa-backend-api.fly.dev"
INTERNAL_API_KEY: "{{ vercel secret }}"
WPPCONNECT_URL: "https://wppconnect-sales-agent.fly.dev"
WPPCONNECT_SECRET_KEY: "{{ vercel secret }}"
WPPCONNECT_SESSION: "asesor-inmobiliario"
```

---

## 3. Circuit Breaker State Model (Frontend)

### States

```typescript
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;       // consecutive failures
  lastFailureAt: number;      // timestamp of last failure
  retryAfterMs: number;       // delay before HALF_OPEN (30_000ms)
}
```

### Transitions

```
CLOSED (failureCount < 3)
  ─[error]──► failureCount++
  ─[failureCount >= 3]──► OPEN, set lastFailureAt

OPEN
  ─[now - lastFailureAt > retryAfterMs]──► HALF_OPEN

HALF_OPEN
  ─[success]──► CLOSED, failureCount = 0
  ─[error]──► OPEN, reset lastFailureAt
```

### UI mapping

| CircuitState | Component Rendered | User Message |
|-------------|-------------------|--------------|
| `CLOSED` + loading | `SkeletonPanel` | — |
| `CLOSED` + error | `ErrorPanel` | "Sin conexión con WPPConnect" |
| `CLOSED` + connected | `ConnectedPanel` | "Conectado" |
| `CLOSED` + qr | `QrPanel` | "Escanea el código QR" |
| `CLOSED` + transitional | `RestartingPanel` | "Generando QR…" |
| `OPEN` | `MaintenancePanel` | "Mantenimiento Temporal" |
| `HALF_OPEN` | `MaintenancePanel` (with retry indicator) | "Verificando conexión…" |

---

## 4. QR Endpoint Response Schema

```typescript
// GET /api/v1/auth/qr response
interface QrResponse {
  status: 'isLogged' | 'notLogged' | 'browserClose' | 'qrReadSuccess' |
          'qrReadFail' | 'autocloseCalled' | 'desconnectedMobile' | 'serverClose' | 'ERROR';
  connected: boolean;      // true only when status === 'isLogged'
  qrcode: string | null;   // base64 data URI or null
  session: string;         // session name
  checkedAt: string;       // ISO timestamp
  error?: string;          // only present on ERROR status
}
```

---

## 5. CORS Middleware Configuration

```typescript
// Allowed origins
const ALLOWED_ORIGINS = [
  'https://frontend-rho-one-21.vercel.app',
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-internal-key',
];

// Allowed methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
```
