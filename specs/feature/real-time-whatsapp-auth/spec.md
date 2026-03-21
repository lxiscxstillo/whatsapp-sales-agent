# Spec: Real-Time WhatsApp Authentication Flow

**Branch**: `feature/real-time-whatsapp-auth` | **Date**: 2026-03-21
**Priority**: P0 — Core connection flow

## Problem Statement

The WhatsApp QR connection flow has UX and reliability gaps:
1. The backend returns raw WPPConnect status strings (`isLogged`, `QRCODE`, `notLogged`…) — no normalized semantic state for the frontend to drive a clean state machine
2. The frontend `RestartingPanel` handles both "session not started" and "initializing" with the same UI — confusing for the operator
3. QR polling is 20s — the operator has to wait up to 20s to see confirmation after scanning
4. No success animation when connection is established
5. `POST /api/whatsapp` (restart session) calls WPPConnect directly from Vercel — bypasses the backend security layer and times out when WPPConnect is slow

---

## User Stories

### US1 — Normalized Connection State API [P1]

**As** the frontend,
**I want** the backend to return a normalized `connectionState` enum instead of raw WPPConnect strings,
**So that** I can drive a deterministic 5-state UI without brittle string comparisons.

**States**:
```
DISCONNECTED   — session not started, browser closed, mobile disconnected
QR_CODE_READY  — QR code generated, waiting for phone scan
AUTHENTICATING — QR just scanned, syncing session
CONNECTED      — session active (isLogged)
ERROR          — backend cannot reach WPPConnect
```

**Acceptance Criteria**:
- `GET /api/v1/auth/qr` returns `connectionState: ConnectionState` alongside existing fields
- Mapping: `isLogged → CONNECTED`, `QRCODE → QR_CODE_READY`, `qrReadSuccess|SYNCING → AUTHENTICATING`, `notLogged|browserClose|desconnectedMobile|serverClose|qrReadFail|autocloseCalled|unknown → DISCONNECTED`
- Existing `status` and `connected` fields preserved for backward compatibility

---

### US2 — Backend-Proxied Session Start [P1]

**As** the frontend,
**I want** a `POST /api/v1/auth/start-session` endpoint on the backend,
**So that** I never call WPPConnect directly from Vercel (which bypasses auth and times out on cold start).

**Acceptance Criteria**:
- `POST /api/v1/auth/start-session`: calls WPPConnect `close-session` then `start-session` with proper auth
- Returns `{ ok: boolean, connectionState: ConnectionState, error?: string }`
- Protected by `x-internal-key` middleware (same as all backend routes)
- Frontend `POST /api/whatsapp` route proxies to this endpoint

---

### US3 — 5-State WhatsApp Connection Card [P1]

**As** the dashboard operator,
**I want** a clear, self-explanatory connection card with a distinct panel for each state,
**So that** I know exactly what to do without reading a manual.

**States → UI**:
| State | Panel | Primary CTA |
|---|---|---|
| `ERROR` | Red card, "Sin conexión con WPPConnect", spinner | Reintentando… |
| `DISCONNECTED` | White card, "Desconectado", phone icon | "Iniciar Vinculación" button |
| `QR_CODE_READY` | White card, QR image, 3-step instructions | Countdown progress bar |
| `AUTHENTICATING` | Amber card, "Autenticando…", pulse animation | (none) |
| `CONNECTED` | Green card, "Agente Activo", pulsing dot | (none) |

**Acceptance Criteria**:
- Each state renders its own isolated panel component
- `DISCONNECTED` shows "Iniciar Vinculación" button that triggers `POST /api/whatsapp`
- `QR_CODE_READY` polling is **2 seconds** (detect scan within 2s of user action)
- `CONNECTED` panel shows animated success checkmark on first render (Framer Motion)
- `AUTHENTICATING` panel shows pulse/spinner, no user action needed
- `CONNECTED` → `DISCONNECTED` transition (unexpected disconnect) resets to DISCONNECTED panel

---

### US4 — QR Timeout & Clean Restart [P2]

**As** the dashboard operator,
**I want** the QR code to show a "Reintentar" button after 60 seconds without a scan,
**So that** I can cleanly restart the process without manual intervention.

**Acceptance Criteria**:
- If `connectionState === 'QR_CODE_READY'` persists for ≥ 60s, show "Reintentar" CTA
- Clicking "Reintentar" calls `POST /api/whatsapp` → `start-session` → new QR cycle
- Timer resets when a new QR is received (`checkedAt` changes)

---

### US5 — Agent Guard (Webhook Protection) [P2]

**As** the system,
**I want** the webhook route to document why the agent guard is implicit,
**So that** future engineers don't add unnecessary WPPConnect status checks.

**Note**: WPPConnect only fires `onmessage` webhooks when the session is `isLogged`. If a message reaches `POST /api/v1/webhook/message`, WPPConnect IS connected by definition. The explicit guard is therefore not needed in `webhook.route.ts` — but this behavior should be documented.

**Acceptance Criteria**:
- Add a comment to `webhook.route.ts` documenting the implicit connection guarantee
- No code change needed

---

## Out of Scope

- Redis/DB storage for QR codes (status-session polling is sufficient)
- Confetti library (Framer Motion animated check is sufficient)
- Phone name display (WPPConnect status-session does not return pushname reliably)
- `onQRCode` event listener / WebSocket / SSE stream (polling at 2s is acceptable)
- Welcome message sent to new leads on first connection (requires DB tracking of "first ever session")
