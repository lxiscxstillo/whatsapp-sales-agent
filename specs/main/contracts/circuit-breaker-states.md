# Contract: Frontend Circuit Breaker — WhatsApp Status Page

**Component**: `WhatsAppClient` in `services/frontend/src/app/dashboard/whatsapp/page.tsx`
**Pattern**: Client-side Circuit Breaker (Fowler, 2014)

---

## State Definitions

### CLOSED (Normal Operation)
- SWR polling active
- All existing panels render normally: `SkeletonPanel`, `ConnectedPanel`, `QrPanel`, `RestartingPanel`, `ErrorPanel`
- `failureCount < 3`

### OPEN (Maintenance Mode)
- SWR polling paused (no requests to backend)
- `MaintenancePanel` renders
- Triggered after `failureCount >= 3` consecutive SWR errors
- Automatically transitions to `HALF_OPEN` after 30 seconds

### HALF_OPEN (Recovery Test)
- One test request sent to backend
- `MaintenancePanel` renders with "Verificando conexión…" subtitle
- Success → `CLOSED`; Failure → `OPEN` (reset 30s timer)

---

## MaintenancePanel Component Contract

### Props
```typescript
interface MaintenancePanelProps {
  state: 'OPEN' | 'HALF_OPEN';
  retryIn?: number;          // seconds until next retry (for countdown display)
  onManualRetry: () => void; // callback for manual retry button
}
```

### Rendered content

```
[Wrench icon — amber]
"Mantenimiento Temporal"
"El servicio de WhatsApp está temporalmente inaccesible.
 Se reintentará la conexión en {retryIn}s"

[Button: "Reintentar ahora"]
```

### States

| `state` | Icon color | Subtitle | Button visible |
|---------|-----------|----------|----------------|
| `OPEN` | amber | "Reintentando en {retryIn}s" | Yes |
| `HALF_OPEN` | blue | "Verificando conexión…" | No (spinner) |

---

## SWR Integration

```typescript
useSWR('/api/whatsapp', fetcher, {
  // Adaptive interval: poll fast on HALF_OPEN test, slow on CLOSED
  refreshInterval: circuitState === 'HALF_OPEN' ? 0 : /* existing adaptive logic */,

  onError: (_error, _key, _config) => {
    failureCount.current += 1;
    if (failureCount.current >= FAILURE_THRESHOLD) {
      setCircuitState('OPEN');
      openedAt.current = Date.now();
    }
  },

  onSuccess: () => {
    failureCount.current = 0;
    setCircuitState('CLOSED');
  },
});
```

### Constants
```typescript
const FAILURE_THRESHOLD = 3;        // failures before OPEN
const RECOVERY_DELAY_MS = 30_000;   // ms before HALF_OPEN
```

---

## Error Classification

| Error type | Circuit behavior |
|-----------|-----------------|
| Network error (ECONNREFUSED) | Count toward threshold |
| HTTP 500 (server error) | Count toward threshold |
| HTTP 401 (auth error) | Count toward threshold |
| HTTP 200 with `status: "ERROR"` | Count toward threshold |
| HTTP 200 with `status: "notLogged"` | **Does NOT count** — WPPConnect is alive |
| HTTP 200 with `status: "browserClose"` | **Does NOT count** — WPPConnect alive, Puppeteer crashed |

The circuit breaker distinguishes "service unreachable" from "service reachable but in error state". Only the former triggers `OPEN`.
