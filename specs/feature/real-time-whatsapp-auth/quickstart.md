# Quickstart: Real-Time WhatsApp Auth Flow — Test Scenarios

## Scenario 1 — QR Code Detected Within 2s of Scan

**Setup**: WPPConnect running, session in QR_CODE_READY state, browser at `/dashboard/whatsapp`

**Steps**:
1. Observe QrPanel is showing with countdown
2. On your phone: WhatsApp → Settings → Linked Devices → Link Device → scan QR
3. Watch the browser — **do not refresh**

**Expected** (after fix):
- Within 2s: QrPanel disappears, AuthenticatingPanel appears briefly
- Within 5s: ConnectedPanel appears with animated green check
- `fly logs -a wsa-backend-api`: `connectionState: "AUTHENTICATING"` then `"CONNECTED"` within 2-3 log lines

---

## Scenario 2 — DISCONNECTED State Shows "Iniciar Vinculación"

**Setup**: Backend running, WPPConnect session not started (fresh deploy)

**Steps**:
```bash
# Force DISCONNECTED state: close the session
fly ssh console --app wppconnect-sales-agent -C "curl -s http://localhost:21465/api/whatsapp-sales-agent/close-session -X POST -H 'Authorization: Bearer $TOKEN'"
```
Then visit `/dashboard/whatsapp`

**Expected**:
- DisconnectedPanel shows with "Iniciar Vinculación" button (NOT "Generando QR…")
- Clicking the button triggers `POST /api/whatsapp` → backend proxies to `start-session`
- Within 10s: panel transitions to QR_CODE_READY

---

## Scenario 3 — QR Timeout (60s) Shows Reintentar

**Setup**: QR_CODE_READY state shown, do NOT scan

**Expected after 60s**:
- "Reintentar" button appears in QrPanel
- Clicking it calls POST /api/whatsapp → new QR cycle starts
- Countdown resets to 60s

---

## Scenario 4 — POST /api/whatsapp Proxies via Backend

**Verify via curl**:
```bash
curl -X POST https://frontend-rho-one-21.vercel.app/api/whatsapp
# Should return: { "ok": true, "connectionState": "DISCONNECTED" }
# Should NOT timeout (Vercel serverless 10s limit)
```

**Check backend logs** (`fly logs -a wsa-backend-api`):
```
POST /api/v1/auth/start-session called
```

---

## Scenario 5 — GET /api/whatsapp Returns connectionState

```bash
curl https://frontend-rho-one-21.vercel.app/api/whatsapp
# Expected:
{
  "connectionState": "CONNECTED",  ← NEW FIELD
  "status": "isLogged",
  "connected": true,
  "qrcode": null,
  "session": "whatsapp-sales-agent",
  "checkedAt": "2026-03-21T..."
}
```

---

## Scenario 6 — Success Animation on First Connect

**Setup**: Session in QR_CODE_READY, open DevTools → Performance tab

**Expected on scan**:
- ConnectedPanel mount triggers scale animation on the green check icon: `0.6 → 1.1 → 1.0` with spring easing
- Animation runs once (not on every re-render)
- No jank — Framer Motion uses GPU-composited transform

---

## Manual cURL Tests

```bash
# Check current state via backend directly
curl -H "x-internal-key: e96d1d760b748dd25858ea1f186606119d20e04d8bde32866ad20f0f80d49f93" \
  https://wsa-backend-api.fly.dev/api/v1/auth/qr

# Start a new session via backend
curl -X POST \
  -H "x-internal-key: e96d1d760b748dd25858ea1f186606119d20e04d8bde32866ad20f0f80d49f93" \
  https://wsa-backend-api.fly.dev/api/v1/auth/start-session
```
