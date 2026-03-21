# Research: Real-Time WhatsApp Authentication Flow

## Finding 1: WPPConnect `status-session` raw status values

**Decision**: Map all WPPConnect raw statuses → 5-value `ConnectionState` enum

**Rationale**:
WPPConnect returns the following status values from `/api/{session}/status-session`:

| Raw WPPConnect Status | Mapped ConnectionState |
|---|---|
| `isLogged` | `CONNECTED` |
| `QRCODE` | `QR_CODE_READY` |
| `qrReadSuccess` | `AUTHENTICATING` |
| `SYNCING` | `AUTHENTICATING` |
| `notLogged` | `DISCONNECTED` |
| `browserClose` | `DISCONNECTED` |
| `desconnectedMobile` | `DISCONNECTED` |
| `serverClose` | `DISCONNECTED` |
| `qrReadFail` | `DISCONNECTED` |
| `autocloseCalled` | `DISCONNECTED` |
| `unknown` (default) | `DISCONNECTED` |
| (backend can't reach WPPConnect) | `ERROR` |

**Where confirmed**: `specs/main/contracts/qr-endpoint.md`, `specs/main/data-model.md`

**Alternatives considered**:
- Pass raw status to frontend and let it map: Rejected — frontend would need to know WPPConnect internals; breaks if WPPConnect changes status names upstream

---

## Finding 2: QR polling frequency for instant scan detection

**Decision**: Poll at 2000ms when `connectionState === 'QR_CODE_READY'`

**Rationale**:
- Current 20s interval (QR_REFRESH_INTERVAL) was designed to avoid unnecessary refreshes when QR is shown. But the dominant use case is: QR is shown → user scans → UI should react immediately.
- WPPConnect transitions: `QRCODE → qrReadSuccess → SYNCING → isLogged` — full cycle takes 3-8 seconds after scan
- At 2s polling, detection latency = 2s max. At 20s, latency = up to 20s.
- 2s polling from Vercel serverless → backend-api → WPPConnect: each call is ~200-500ms. Load is negligible.
- SWR `dedupingInterval: 2000` prevents duplicate requests if multiple tabs are open.

**Alternatives considered**:
- WebSocket/SSE stream: Much higher complexity (WPPConnect doesn't expose SSE; would require backend subscription model). Rejected for 2s polling which is sufficient.
- 5s polling: Acceptable but 3s extra delay feels sluggish on the "did it work?" moment.

---

## Finding 3: Backend-proxied session start (POST /api/v1/auth/start-session)

**Decision**: Move session restart to backend-api, frontend calls `BACKEND_API_URL/api/v1/auth/start-session` via the internal proxy

**Rationale**:
- Current `POST /api/whatsapp` in Vercel route.ts calls WPPConnect directly: `close-session → start-session`
- Problem 1: Vercel serverless has 10s timeout; the `close-session + delay(1500) + start-session` sequence can exceed this when WPPConnect is cold.
- Problem 2: Frontend (Vercel) stores the WPPConnect token directly. On Vercel (stateless serverless), `let tokenCache` doesn't persist across invocations — every request re-generates the token.
- Problem 3: Direct WPPConnect access from frontend bypasses the backend's `x-internal-key` auth layer.
- Fly.io backend has persistent memory between requests (single machine, no cold starts) → token cache works correctly.

**Alternatives considered**:
- Keep frontend direct access with longer timeout: Vercel Pro has 60s limit, free tier is 10s. Rejected.
- Add WPPCONNECT_URL directly to backend env (already there): Just need to add the new endpoint.

---

## Finding 4: Success animation approach

**Decision**: Framer Motion `scale: [0.6, 1.1, 1.0]` + `opacity: [0, 1]` on the ConnectedPanel's green check icon, with a brief border glow

**Rationale**:
- Framer Motion is already installed (v11, used in `page.tsx`)
- A confetti library (canvas-confetti) would add ~15KB and is overkill for a dashboard
- The `initial`/`animate` props on the ConnectedPanel card already exist — extending them with a keyframe spring for the check icon is ~3 lines
- The `animate-ping` dot already exists on the ConnectedPanel — the success state is visually rich enough without confetti

**Alternatives considered**:
- `canvas-confetti` npm package: Adds dependency, bundle weight, and requires dynamic import. Rejected.
- CSS keyframes: Works but Framer Motion spring physics looks more polished. Rejected.

---

## Finding 5: QR timeout — 60s UX protection

**Decision**: Track QR display start time in `useRef`, show "Reintentar" after 60s of continuous `QR_CODE_READY` state

**Rationale**:
- WPPConnect regenerates the QR code itself every ~60s (WA protocol)
- If the user doesn't scan within 60s, showing a "Reintentar" button (triggering `start-session`) gives them a clean restart instead of silently cycling QRs
- Implementation: `qrStartedAt = useRef<number>(0)` — reset when `connectionState` leaves `QR_CODE_READY`, set when it enters. A `useEffect` timer fires after 60s.

**Alternatives considered**:
- Keep cycling indefinitely: Acceptable but confusing — the user sees QR codes changing without understanding why.
- Use the existing `countdown` hook: That hook tracks the 20s QR refresh cycle, not the 60s session timeout. Different concept.

---

## Finding 6: Agent implicit connection guarantee (Phase 3 / US5)

**Decision**: Document the implicit guarantee in `webhook.route.ts` — no code change needed

**Rationale**:
- WPPConnect's webhook `onmessage` event only fires when the session state is `isLogged` (CONNECTED)
- If a POST reaches `webhook.route.ts`, WPPConnect IS connected by definition
- Adding a connection status check in the webhook would require an async HTTP call to WPPConnect on EVERY incoming message — adding ~200ms latency and a potential cascade failure point
- The existing guards (`fromMe`, `isGroupMsg`, `HANDOFF/PAUSED/CLOSED`) are sufficient

**How to apply**: Add a doc comment at the top of the webhook handler. No functional change.
