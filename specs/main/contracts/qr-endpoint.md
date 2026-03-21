# Contract: GET /api/v1/auth/qr

**Service**: backend-api (Express)
**Consumer**: Frontend Next.js route handler (`/api/whatsapp/route.ts`)
**Purpose**: Fetch WhatsApp session status and QR code from WPPConnect with retry logic

---

## Request

```
GET /api/v1/auth/qr
Authorization: x-internal-key: {INTERNAL_API_KEY}
```

No request body. No query parameters.

---

## Response — Success

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "notLogged",
  "connected": false,
  "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "session": "asesor-inmobiliario",
  "checkedAt": "2026-03-20T15:30:00.000Z"
}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "isLogged",
  "connected": true,
  "qrcode": null,
  "session": "asesor-inmobiliario",
  "checkedAt": "2026-03-20T15:30:00.000Z"
}
```

### `status` field values

| Value | Meaning | `connected` |
|-------|---------|-------------|
| `isLogged` | Session active | `true` |
| `notLogged` | Session not started or QR pending | `false` |
| `qrReadSuccess` | QR just scanned, authenticating | `false` |
| `browserClose` | Puppeteer process crashed | `false` |
| `desconnectedMobile` | Phone disconnected from session | `false` |
| `serverClose` | WPPConnect server restarting | `false` |
| `ERROR` | Backend could not reach WPPConnect | `false` |

---

## Response — Error

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ERROR",
  "connected": false,
  "qrcode": null,
  "session": "asesor-inmobiliario",
  "checkedAt": "2026-03-20T15:30:00.000Z",
  "error": "WPPConnect unreachable after 3 attempts: connect ECONNREFUSED"
}
```

> **Note**: Returns HTTP 200 even on error to prevent frontend circuit breaker from triggering on transient WPPConnect restarts. The `status: "ERROR"` field triggers the frontend error state instead.

---

## Retry Policy (backend-internal)

```
Attempt 1 → WPPConnect /status-session
  On 5xx or network error:
    Wait 500ms → Attempt 2
    Wait 1000ms → Attempt 3
    If all fail: return { status: "ERROR", error: "..." }
  On 200: return immediately
```

---

## Auth

The `/api/v1/auth/qr` endpoint requires `x-internal-key` header.
The WPPConnect token is managed internally by backend-api (not exposed to frontend).

---

## Migration from current architecture

**Before**: `services/frontend/src/app/api/whatsapp/route.ts` calls WPPConnect directly
**After**: Same frontend route handler calls `{BACKEND_API_URL}/api/v1/auth/qr`

The frontend route handler's `getToken()` function and direct WPPConnect calls are replaced by a single authenticated call to the backend's QR endpoint.
