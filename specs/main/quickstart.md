# Quickstart: Deploying Production Integrity Patches

**Branch**: `feature/production-integrity-final`
**Target**: Fly.io + Vercel production environment

---

## Prerequisites

- `fly` CLI authenticated (`fly auth login`)
- Vercel CLI or dashboard access
- Access to all Fly.io app secrets
- Node.js 20+ for local verification

---

## Step 1: WPPConnect Hardening

```bash
# 1a. Deploy updated config.json (adds --single-process flag)
cd wppconnect-config
fly deploy --app wppconnect-sales-agent

# 1b. Verify health
fly logs --app wppconnect-sales-agent
# Look for: "Session started" or QR generation logs
```

---

## Step 2: Backend-API — CORS + QR Endpoint

```bash
cd services/backend-api

# 2a. Install cors package (if not already installed)
npm install cors @types/cors

# 2b. Deploy
fly deploy --app wsa-backend-api

# 2c. Verify CORS
curl -v -X OPTIONS \
  -H "Origin: https://frontend-rho-one-21.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-internal-key" \
  https://wsa-backend-api.fly.dev/api/v1/leads
# Expected: 204 with Access-Control-Allow-Origin header

# 2d. Verify QR endpoint
curl -H "x-internal-key: $INTERNAL_API_KEY" \
  https://wsa-backend-api.fly.dev/api/v1/auth/qr
# Expected: { status: "...", connected: bool, qrcode: "..." or null }
```

---

## Step 3: Verify ENV Variables

```bash
# Check backend-api secrets
fly secrets list --app wsa-backend-api
# Required: DATABASE_URL, WPPCONNECT_URL, WPPCONNECT_SECRET_KEY,
#           WPPCONNECT_SESSION, AGENT_URL, INTERNAL_API_KEY

# Verify DATABASE_URL includes SSL params
fly ssh console --app wsa-backend-api -C \
  "node -e \"console.log(process.env.DATABASE_URL.includes('sslmode=require'))\""
# Expected: true

# Verify AGENT_URL is not localhost
fly ssh console --app wsa-backend-api -C \
  "node -e \"console.log(process.env.AGENT_URL)\""
# Expected: https://wsa-agent-langgraph.fly.dev
```

---

## Step 4: Frontend Deployment

```bash
# Deploy via Vercel (automatic on git push to main after PR merge)
git push origin feature/production-integrity-final
# Open PR → merge → Vercel auto-deploys

# Or manual trigger:
cd services/frontend
vercel --prod

# Verify leads polling
# Open browser devtools → Network tab → filter "/api/leads"
# Expected: request every ~2.5 seconds
```

---

## Step 5: End-to-End Verification

### WhatsApp Connection Test
1. Open `https://frontend-rho-one-21.vercel.app/dashboard/whatsapp`
2. Expected: QR code renders within 30 seconds (if not logged in)
3. Scan QR → Expected: panel transitions to "Conectado" within 10s

### Circuit Breaker Test
1. Stop WPPConnect service temporarily: `fly scale count 0 --app wppconnect-sales-agent`
2. Open WhatsApp page → after 3 polling cycles (~15s), expect `MaintenancePanel`
3. Restart: `fly scale count 1 --app wppconnect-sales-agent`
4. After 30s, expect automatic recovery to normal state

### Lead Status Reactivity Test
1. Send a WhatsApp message to the registered number
2. Open `https://frontend-rho-one-21.vercel.app/dashboard`
3. Expected: Lead appears within 3 seconds

---

## Rollback Plan

If any service fails after deployment:

```bash
# WPPConnect
fly deploy --app wppconnect-sales-agent --image registry.fly.io/wppconnect-sales-agent:previous

# Backend-API
fly deploy --app wsa-backend-api --image registry.fly.io/wsa-backend-api:previous

# Frontend — revert commit and redeploy via Vercel
git revert HEAD
git push origin main
```

---

## Monitoring Post-Deploy

```bash
# Watch all service logs
fly logs --app wppconnect-sales-agent &
fly logs --app wsa-backend-api &
fly logs --app wsa-agent-langgraph &

# Health checks
watch -n 5 'curl -s https://wsa-backend-api.fly.dev/health | jq'
watch -n 5 'curl -s https://wsa-agent-langgraph.fly.dev/health | jq'
```
