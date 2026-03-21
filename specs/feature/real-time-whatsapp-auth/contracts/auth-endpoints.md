# API Contracts: WhatsApp Auth Endpoints

## GET /api/v1/auth/qr

**Service**: wsa-backend-api (Fly.io)
**Auth**: `x-internal-key` header required
**Purpose**: Get current WhatsApp session status + QR code

### Response (HTTP 200 always)

```json
{
  "connectionState": "CONNECTED | QR_CODE_READY | AUTHENTICATING | DISCONNECTED | ERROR",
  "status": "<raw WPPConnect status string>",
  "connected": true,
  "qrcode": "data:image/png;base64,...",
  "session": "whatsapp-sales-agent",
  "checkedAt": "2026-03-21T02:45:00.000Z",
  "error": "<only present when connectionState is ERROR>"
}
```

### State Examples

**QR_CODE_READY**:
```json
{ "connectionState": "QR_CODE_READY", "status": "QRCODE", "connected": false, "qrcode": "data:image/png;base64,iVBOR...", "session": "whatsapp-sales-agent", "checkedAt": "..." }
```

**CONNECTED**:
```json
{ "connectionState": "CONNECTED", "status": "isLogged", "connected": true, "qrcode": null, "session": "whatsapp-sales-agent", "checkedAt": "..." }
```

**ERROR**:
```json
{ "connectionState": "ERROR", "status": "ERROR", "connected": false, "qrcode": null, "session": "whatsapp-sales-agent", "checkedAt": "...", "error": "WPPConnect unreachable after 3 attempts: timeout of 8000ms exceeded" }
```

---

## POST /api/v1/auth/start-session  ← NEW

**Service**: wsa-backend-api (Fly.io)
**Auth**: `x-internal-key` header required
**Purpose**: Close existing session and start a fresh one (triggers new QR cycle)

### Request

No body required.

### Response (HTTP 200)

```json
{
  "ok": true,
  "connectionState": "DISCONNECTED"
}
```

On error:
```json
{
  "ok": false,
  "connectionState": "ERROR",
  "error": "close-session failed: timeout"
}
```

### Behavior

1. Calls WPPConnect `POST /api/{session}/close-session` (ignores errors — session may already be closed)
2. Waits 1500ms
3. Calls WPPConnect `POST /api/{session}/{secret}/start-session`
4. Returns `connectionState` derived from start-session response, or `ERROR` if unreachable

---

## Frontend API Routes (Next.js)

### GET /api/whatsapp

**Purpose**: Proxy to `BACKEND_API_URL/api/v1/auth/qr`
**Returns**: Same shape as `GET /api/v1/auth/qr` above
**Polling client**: SWR in `WhatsAppClient` component

### POST /api/whatsapp

**Purpose**: Proxy to `BACKEND_API_URL/api/v1/auth/start-session`
**Body**: none
**Returns**: `{ ok: boolean, connectionState: ConnectionState, error?: string }`
**Caller**: `DisconnectedPanel` "Iniciar Vinculación" + `QrPanel` "Reintentar" buttons
