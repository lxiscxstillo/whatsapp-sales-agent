# Feature Spec: Production Integrity Hardening (P0 Incident Response)

**Feature ID**: production-integrity-final
**Date**: 2026-03-20
**Priority**: P0 — Critical Production Incident
**Author**: SRE / Senior Fullstack Architect

---

## Problem Statement

The WhatsApp Sales Agent system is experiencing a P0 multi-vector production incident:

1. **WPPConnect session failure**: Puppeteer headless browser not starting correctly on Fly.io micro-VMs, causing OOM errors and preventing QR code generation.
2. **Frontend stale data**: Next.js Server Components serving cached HTML; leads dashboard reflects outdated lead statuses.
3. **Integration errors (404/500)**: CORS policy not configured on backend-api, causing potential cross-origin failures when browser makes direct requests. WPPConnect webhook URL hardcoded in config.json (not env-driven).
4. **Circuit breaker absent**: Frontend shows empty console errors when backend is unreachable instead of user-friendly maintenance state.
5. **Polling too slow**: Lead status changes (NEW → QUALIFYING → HOT) not reflected fast enough for real-estate advisors.

---

## Requirements

### R1 — Headless Browser Hardening
- Inject Puppeteer flags: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-accelerated-2d-canvas`, `--no-first-run`, `--no-zygote`, `--single-process`, `--disable-gpu`
- Ensure WPPConnect fly.toml has health check endpoint configured
- `auto_stop_machines = false` must remain to preserve WebSocket connections

### R2 — QR Endpoint with Retry
- Expose a dedicated `/api/v1/auth/qr` route in backend-api that:
  - Fetches QR from WPPConnect `/status-session`
  - Returns `{ status, qrcode, connected }` with retry on failure (max 3 attempts, 500ms delay)
  - Frontend consumes this endpoint for QR rendering

### R3 — CORS Policy
- Add CORS middleware to backend-api allowing origin `https://frontend-rho-one-21.vercel.app`
- Allowed headers: `Content-Type`, `Authorization`, `X-Requested-With`, `x-internal-key`
- Allowed methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- Preflight cache: 24h

### R4 — Neon/Prisma Connection Hardening
- `DATABASE_URL` must include `?sslmode=require&connection_limit=5&pool_timeout=0` parameters
- Prisma client must pass `datasources.db.url` with SSL config
- Document the required Neon connection string format

### R5 — Frontend Cache Elimination
- Add `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` to `/dashboard/page.tsx`
- Ensure all Next.js Server Components that render lead data opt out of static caching

### R6 — Reactive Polling (2500ms)
- Change `LeadsListClient` `refreshInterval` from 4000ms → 2500ms
- Change `StatsGrid` polling to 2500ms
- `WhatsAppPage` polling already adaptive — no change needed

### R7 — Circuit Breaker / Maintenance Mode
- Frontend: after 3 consecutive failed health pings to backend, display `MaintenancePanel` component
- `MaintenancePanel` shows "Mantenimiento Temporal" state with retry countdown instead of raw error
- Circuit breaker state: `CLOSED` (normal) → `OPEN` (maintenance) → `HALF_OPEN` (testing recovery)

### R8 — LangGraph Handoff Integrity (ISO 25010 — Functional Suitability)
- Verify `lead_id` flows correctly through all LangGraph nodes
- Ensure `thread_id = req.phone` is consistent across all agent invocations
- Confirm handoff node preserves `lead_id` in state output (no state key drop on `handoff` → `END` transition)

### R9 — ENV Discrepancy Audit
- Document all environment variables required per service
- Flag hardcoded values in config.json that must be env-driven
- Provide patched wppconnect config.ts that overrides secretKey and webhookUrl from env at startup

---

## Out of Scope
- Adding new LangGraph nodes or lead qualification logic
- Migrating from Neon to another database provider
- Changing the WhatsApp provider from WPPConnect to another service
- UI redesign of the dashboard

---

## Success Criteria
1. WPPConnect starts cleanly on Fly.io and QR code renders in frontend within 30s of cold start
2. Lead status changes reflect in dashboard within 3 seconds
3. Backend unreachable → frontend shows "Mantenimiento Temporal" instead of blank/error
4. All environment variables are validated at startup with no hardcoded secrets
5. Handoff node output always includes non-null `lead_id` in state
