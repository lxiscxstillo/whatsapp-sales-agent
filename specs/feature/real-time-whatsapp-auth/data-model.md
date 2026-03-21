# Data Model: Real-Time WhatsApp Authentication Flow

## Connection State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
              ┌─────▼──────┐     POST start-session        ┌─────▼──────────┐
  boot ──────►│DISCONNECTED│──────────────────────────────►│ QR_CODE_READY  │
              └─────┬──────┘                                └─────┬──────────┘
                    │                                             │ user scans
                    │ unexpected disconnect                       ▼
                    │                                      ┌──────────────────┐
                    │◄─────────────────────────────────────│  AUTHENTICATING  │
                    │                                      └──────┬───────────┘
                    │                                             │ isLogged
                    │◄────────────────────────────────────────────│ (disconnect)
                    │                                      ┌──────▼───────────┐
                    │                                      │    CONNECTED     │
                    │                                      └──────────────────┘
                    │
              ┌─────▼──────┐
              │   ERROR    │  (WPPConnect unreachable)
              └────────────┘
```

## ConnectionState Enum

```typescript
// services/backend-api/src/routes/auth.route.ts
// services/frontend/src/app/dashboard/whatsapp/page.tsx

type ConnectionState =
  | 'CONNECTED'       // isLogged — session active, agent processing messages
  | 'QR_CODE_READY'   // QRCODE — QR generated, waiting for phone scan
  | 'AUTHENTICATING'  // qrReadSuccess | SYNCING — QR scanned, session syncing
  | 'DISCONNECTED'    // notLogged | browserClose | desconnectedMobile | serverClose | qrReadFail | autocloseCalled
  | 'ERROR';          // WPPConnect unreachable (backend returned error)
```

## API Response Schema — GET /api/v1/auth/qr (updated)

```typescript
interface QrStatusResponse {
  // Normalized enum — NEW FIELD
  connectionState: ConnectionState;

  // Existing fields (preserved for backward compat)
  status: string;         // raw WPPConnect status string
  connected: boolean;     // true if connectionState === 'CONNECTED'
  qrcode: string | null;  // data:image/png;base64,... or null
  session: string;        // session name from config
  checkedAt: string;      // ISO timestamp

  // Only present when connectionState === 'ERROR'
  error?: string;
}
```

## API Request/Response Schema — POST /api/v1/auth/start-session (NEW)

```typescript
// Request: no body required

// Response:
interface StartSessionResponse {
  ok: boolean;
  connectionState: ConnectionState;   // state after the start attempt
  error?: string;
}
```

## WPPConnect Status → ConnectionState Mapping

```typescript
function toConnectionState(rawStatus: string, hasQrcode: boolean): ConnectionState {
  switch (rawStatus) {
    case 'isLogged':
      return 'CONNECTED';
    case 'QRCODE':
      return hasQrcode ? 'QR_CODE_READY' : 'DISCONNECTED';
    case 'qrReadSuccess':
    case 'SYNCING':
      return 'AUTHENTICATING';
    case 'notLogged':
    case 'browserClose':
    case 'desconnectedMobile':
    case 'serverClose':
    case 'qrReadFail':
    case 'autocloseCalled':
    default:
      return 'DISCONNECTED';
  }
}
// Note: 'ERROR' is set by the backend catch block when WPPConnect is unreachable
```

## Frontend Polling Intervals by State

| connectionState  | SWR refreshInterval |
|---|---|
| `CONNECTED`      | 10 000 ms |
| `QR_CODE_READY`  | 2 000 ms |
| `AUTHENTICATING` | 2 000 ms |
| `DISCONNECTED`   | 5 000 ms |
| `ERROR`          | 5 000 ms |
| circuit OPEN     | 0 (paused) |

## Frontend Component → State Mapping

| connectionState  | Component Rendered |
|---|---|
| `CONNECTED`      | `ConnectedPanel` (success animation on first mount) |
| `QR_CODE_READY`  | `QrPanel` (QR image + countdown + 60s timeout CTA) |
| `AUTHENTICATING` | `AuthenticatingPanel` (pulse + "Autenticando…") |
| `DISCONNECTED`   | `DisconnectedPanel` ("Iniciar Vinculación" CTA) |
| `ERROR`          | `ErrorPanel` (red card + auto-retry) |
| loading          | `SkeletonPanel` |
