# Quickstart: Sales Closer Engine v2

**Branch**: `feature/sales-closer-engine-v2`
**Target**: Local development → Fly.io (agent-langgraph + backend-api)

---

## Prerequisites

- Python 3.11+ with `uvicorn` and `pip`
- Node.js 20+ with `npm`
- `fly` CLI authenticated (`fly auth login`)
- Access to Fly.io secrets for `wsa-agent-langgraph` and `wsa-backend-api`
- Neon DB connection strings (direct for agent, pooled for backend-api)

---

## Step 1: Create Feature Branch

```bash
git checkout main && git pull origin main
git checkout -b feature/sales-closer-engine-v2
```

---

## Step 2: Create Inventory Data File

```bash
# From repo root — create the data directory and inventory file
mkdir -p data
# The full inventory JSON is specified in specs/main/data-model.md
# Create data/inventory_colombia.json following that schema
```

Verify the file loads correctly:
```bash
python3 -c "
import json, pathlib
data = json.loads(pathlib.Path('data/inventory_colombia.json').read_text())
print(f'Loaded {len(data[\"properties\"])} properties')
cities = set(p[\"city\"] for p in data[\"properties\"])
print(f'Cities: {cities}')
"
# Expected: Loaded 15+ properties | Cities: {'Pasto', 'Bogotá', 'Medellín', 'Cali'}
```

---

## Step 3: Update Agent Service

```bash
cd services/agent-langgraph

# 3a. Add InventoryService
# Create src/tools/inventory_service.py (see contracts/inventory-query.md for full spec)

# 3b. Update state.py
# Add preferred_neighborhood and urgency_level to LeadSlots

# 3c. Update slot_prompt.py
# Add preferred_neighborhood to SlotExtraction schema

# 3d. Update evaluate_lead.py
# Add urgency normalization logic

# 3e. Update system_prompt.py
# Add sales closer persona, CTA template variables

# 3f. Update generate_response.py
# Inject InventoryService query + CTA logic

# 3g. Update main.py
# Initialize InventoryService in lifespan
```

---

## Step 4: Run Agent Locally

```bash
cd services/agent-langgraph

# Install dependencies (if new ones added)
pip install -r requirements.txt

# Set environment variables
export GROQ_API_KEY="your-groq-key"
export DATABASE_URL="postgresql://...@direct.neon.tech/...?sslmode=require"

# Run with inventory path pointing to repo root
uvicorn src.main:app --reload --port 8000
```

Verify inventory loads at startup:
```bash
# In agent logs, look for:
# {"event": "inventory.loaded", "total": 15, "cities": ["Pasto", "Bogotá", ...]}
```

Test inventory query via API:
```bash
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "573001234567",
    "message": "Busco apartamento en Palermo, Pasto, presupuesto 300 millones",
    "lead_id": "test-001",
    "lead_status": "new",
    "slots": {},
    "ambiguity_counter": 0,
    "interest_level": 1
  }'
# Expected response: mentions Palermo properties, has a CTA proposing a visit
```

---

## Step 5: Prisma Migration

```bash
cd services/backend-api

# Generate migration (adds slotNeighborhood + urgencyLevel columns)
npx prisma migrate dev --name add_lead_neighborhood_urgency

# Verify migration SQL (should be ADD COLUMN only, no destructive ops)
cat prisma/migrations/*/migration.sql | grep -v "^--"
# Expected:
# ALTER TABLE "Lead" ADD COLUMN "slotNeighborhood" TEXT;
# ALTER TABLE "Lead" ADD COLUMN "urgencyLevel" TEXT;
```

---

## Step 6: Update Backend-API Slot Mapping

```bash
cd services/backend-api

# Update webhook.route.ts or lead.service.ts to map:
# - updated_slots.preferred_neighborhood → slotNeighborhood
# - updated_slots.urgency_level → urgencyLevel

npm run dev
# Verify no TypeScript errors
```

---

## Step 7: Integration Test (Local End-to-End)

```bash
# Terminal 1: Agent
cd services/agent-langgraph && uvicorn src.main:app --reload --port 8000

# Terminal 2: Backend API
cd services/backend-api && npm run dev

# Terminal 3: Test webhook simulation
curl -X POST http://localhost:3001/api/v1/webhook/message \
  -H "Content-Type: application/json" \
  -H "x-internal-key: test-key" \
  -d '{
    "phone": "573001234567",
    "message": "Buenos días, busco apartamento en Pasto, barrio Palermo, presupuesto de 280 millones"
  }'
```

Verify in DB:
```bash
cd services/backend-api
npx prisma studio
# Navigate to Lead table → check slotNeighborhood = "Palermo", urgencyLevel set
```

---

## Step 8: Deploy to Fly.io

```bash
# Deploy agent (inventory_colombia.json must be included in Docker image)
cd services/agent-langgraph
fly deploy --app wsa-agent-langgraph

# Deploy backend-api (run migration before scale-up)
cd services/backend-api
fly deploy --app wsa-backend-api

# Verify migration ran on deploy
fly logs --app wsa-backend-api | grep "migrate"
```

---

## Regression Verification Checklist

After deploying, verify no regression on existing functionality:

```bash
# 1. WPPConnect still running
curl https://wppconnect-sales-agent.fly.dev/status-session/asesor-inmobiliario
# Expected: { status: "isLogged" or "qrReadSuccess" }

# 2. Dashboard loads correctly
curl -I https://frontend-rho-one-21.vercel.app/dashboard
# Expected: 200 OK

# 3. Agent still handles non-inventory messages
curl -X POST https://wsa-agent-langgraph.fly.dev/agent/process \
  -H "Content-Type: application/json" \
  -d '{"phone":"test", "message":"hola", "lead_id":"x", "lead_status":"new", "slots":{}, "ambiguity_counter":0, "interest_level":1}'
# Expected: greeting response, no inventory reference (cold lead)

# 4. Leads API still works
curl -H "x-internal-key: $INTERNAL_API_KEY" \
  https://wsa-backend-api.fly.dev/api/v1/leads
# Expected: JSON array of leads
```

---

## Rollback Plan

```bash
# If agent regression:
fly deploy --app wsa-agent-langgraph --image registry.fly.io/wsa-agent-langgraph:previous

# If backend-api regression (note: migration is non-destructive, no rollback needed for schema):
fly deploy --app wsa-backend-api --image registry.fly.io/wsa-backend-api:previous
```

---

## Conventional Commit Reference

```bash
git commit -m "feat(data): add inventory_colombia.json with Pasto/Bogotá/Medellín/Cali properties"
git commit -m "feat(agent): implement InventoryService mock-RAG for in-process property lookup"
git commit -m "feat(agent): extend AgentState with preferred_neighborhood and urgency_level slots"
git commit -m "feat(agent): add preferred_neighborhood extraction to slot_check"
git commit -m "feat(agent): normalize urgency_level in evaluate_lead node"
git commit -m "feat(agent): redesign system_prompt with sales closer persona and CTA injection"
git commit -m "feat(agent): inject inventory context and dynamic CTA into generate_response"
git commit -m "feat(agent): add three-layer inventory fallback to real_estate_kb"
git commit -m "feat(backend): add slotNeighborhood and urgencyLevel Prisma migration"
git commit -m "feat(backend): map preferred_neighborhood and urgency_level in webhook handler"
git commit -m "docs(spec): update spec.md and tasks.md for sales-closer-engine-v2 completion"
```
