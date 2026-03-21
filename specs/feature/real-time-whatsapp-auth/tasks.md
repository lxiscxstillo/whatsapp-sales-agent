# Tasks: Real-Time WhatsApp Authentication Flow

**Branch**: `feature/real-time-whatsapp-auth`
**Input**: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md

---

## Phase 1 — Setup

- [ ] T001 Create and checkout branch `feature/real-time-whatsapp-auth` from `main`

---

## Phase 2 — US1 + US2: Backend Auth Endpoints

> **Goal**: Backend returns normalized `connectionState` enum; new `POST /start-session` endpoint proxies session restart
> **Independent test**: `curl -H "x-internal-key:..." https://wsa-backend-api.fly.dev/api/v1/auth/qr` returns `connectionState` field; `POST /api/v1/auth/start-session` returns `{ ok, connectionState }`
> **ISO 25010**: Reliability (Fault Tolerance), Functional Suitability (Correctness)

- [ ] T002 [US1] Update `services/backend-api/src/routes/auth.route.ts`: add `toConnectionState(rawStatus, hasQrcode)` pure function that maps WPPConnect status strings → `ConnectionState` enum per data-model.md mapping table; add `connectionState` field to the `res.json()` response alongside existing `status`/`connected` fields; add `connectionState: 'ERROR'` to the error response in the catch block
- [ ] T003 [US2] Add `POST /start-session` handler to `services/backend-api/src/routes/auth.route.ts`: calls WPPConnect `close-session` (ignore errors), waits 1500ms, calls `start-session`, returns `{ ok, connectionState }` using `getCachedToken()` for auth; mount the route at `authRouter.post('/start-session', ...)`

---

## Phase 3 — US3 + US4: Frontend 5-State Connection Card

> **Goal**: WhatsApp page shows distinct panel per `connectionState`; QR polls at 2s; success animation on CONNECTED; 60s QR timeout shows Reintentar
> **Independent test**: Browser at /dashboard/whatsapp shows DisconnectedPanel when session is down; shows green animated check within 3s of scanning QR; shows "Reintentar" after 60s of QR being shown
> **ISO 25010**: Usability (Learnability, User Error Protection), Reliability (Fault Tolerance)

- [ ] T004 [P] [US3] Update `services/frontend/src/app/api/whatsapp/route.ts` POST handler: replace the direct WPPConnect close-session + start-session calls with a single proxied call to `${process.env.BACKEND_API_URL}/api/v1/auth/start-session` (with `x-internal-key` header); remove `getToken()` function and `tokenCache` entirely (no longer needed since POST now proxies through backend); keep GET handler unchanged
- [ ] T005 [US3] Rebuild `services/frontend/src/app/dashboard/whatsapp/page.tsx`: (a) add `ConnectionState` type and `connectionState` field to `WhatsAppStatus` interface; (b) replace `RestartingPanel` with `DisconnectedPanel` component — shows phone icon with "Desconectado" title and "Iniciar Vinculación" indigo button that calls `handleRestart()`; (c) add `AuthenticatingPanel` component — amber card with pulsing circle and "Autenticando…" text, no CTA; (d) update `WhatsAppClient` render logic to use `connectionState` from SWR data instead of `data.connected` / `data.qrcode` — map all 5 states to their panels; (e) update SWR `refreshInterval` to use the table from data-model.md (2s for QR_CODE_READY and AUTHENTICATING, 5s for DISCONNECTED/ERROR, 10s for CONNECTED); (f) add success animation to `ConnectedPanel` — wrap the checkmark/phone icon with `motion.div` using `animate={{ scale: [0.6, 1.1, 1] }}` and `transition={{ type: 'spring', duration: 0.5 }}`
- [ ] T006 [US4] Add QR timeout to `services/frontend/src/app/dashboard/whatsapp/page.tsx` `QrPanel` component: add `qrTimeoutExpired` prop (boolean); in `WhatsAppClient`, track QR start time with `qrStartedAt = useRef<number>(0)` — set to `Date.now()` when `connectionState` enters `QR_CODE_READY`, reset to 0 otherwise; use a `useEffect` with 60s timer that sets `qrExpired` state to true; pass `qrTimeoutExpired={qrExpired}` to `QrPanel`; inside `QrPanel`, when `qrTimeoutExpired` is true show an amber "Reintentar" button below the QR image that calls `onRestart` prop

---

## Phase 4 — US5: Agent Guard Documentation

> **Goal**: Document implicit connection guarantee in webhook.route.ts
> **ISO 25010**: Maintainability (Analysability)

- [X] T007 [P] [US5] Add a comment block at line 27 of `services/backend-api/src/routes/webhook.route.ts` (above the route handler opening `try`) documenting: "Connection guarantee: WPPConnect's onmessage event only fires when session state is isLogged (CONNECTED). If this endpoint is reached, WPPConnect IS connected by definition — no additional connection status check is needed."

---

## Phase 5 — Deploy

- [X] T008 [US1] Deploy backend-api: `fly deploy --app wsa-backend-api` from `services/backend-api/`
- [ ] T009 [US3] Commit all frontend changes and push branch — Vercel will create a preview deployment for `feature/real-time-whatsapp-auth`; merge to `main` when validated to trigger production deploy

---

## Dependency Graph

```
T001 (branch) ──►
  T002 (connectionState in auth.route.ts) ──┐
  T003 (start-session endpoint) ────────────┼──► T008 (deploy backend)
                                             │
  T004 (POST proxy in route.ts) ────────────┤
  T005 (5-state page rebuild) ──────────────┼──► T009 (push + preview)
  T006 (QR timeout) ────────────────────────┘
  T007 (webhook comment) [independent]
```

T002 must complete before T008. T005 depends on T004's simplified route (no tokenCache).

---

## ISO 25010 Compliance

| Characteristic | Tasks | What changes |
|---|---|---|
| Functional Suitability (Correctness) | T002, T003 | Normalized API contract |
| Reliability (Fault Tolerance) | T003, T004 | Session restart via backend, no Vercel timeout |
| Usability (Learnability) | T005, T006 | 5 distinct panels, clear CTAs per state |
| Usability (User Error Protection) | T006, T007 | 60s timeout + Reintentar, no silent QR cycling |
| Maintainability (Analysability) | T007 | Webhook connection guarantee documented |
| Performance Efficiency | T005 | 2s polling for instant scan detection |
