# whatsapp-sales-agent Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-18

## Active Technologies

- Node.js 20 (backend API) + Python 3.11 (LangGraph agent) (001-whatsapp-sales-agent)

## Project Structure

```text
src/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

Node.js 20 (backend API) + Python 3.11 (LangGraph agent): Follow standard conventions

## Recent Changes

- 001-whatsapp-sales-agent: Added Node.js 20 (backend API) + Python 3.11 (LangGraph agent)

<!-- MANUAL ADDITIONS START -->
## Architecture Overview

Multi-service WhatsApp real estate sales agent:
- **services/backend-api/** — Node.js/Express: webhook handler, REST API, Prisma ORM
- **services/agent-langgraph/** — Python/FastAPI: LangGraph conversational agent (port 8000)
- **services/combined/** — Railway production: Node.js + Python in one container via supervisord
- **services/frontend/** — Next.js App Router: leads dashboard, Tailwind + shadcn/ui
- **wppconnect-config/** — WPPConnect Server config (mounted as volume)

## Key Technical Decisions

- LangGraph `AsyncPostgresSaver` (same PostgreSQL) for conversation state across requests
- `thread_id = sender_phone` for per-lead conversation isolation
- Two Groq models: `llama-3.1-8b-instant` (classification) + `llama-3.3-70b-versatile` (responses)
- SWR `refreshInterval: 4000` for frontend real-time updates (no WebSocket needed)
- Next.js Route Handlers proxy all backend calls (hide Railway URL from client)
- Services backend+agent merged into one Railway container to fit free tier costs

## Database

- PostgreSQL 15 via Railway plugin
- Prisma ORM with migrations in `services/backend-api/prisma/`
- Tables: `Lead`, `Message` + LangGraph internal tables (`checkpoints`, `checkpoint_writes`)
- Run migrations: `docker compose exec backend-api npx prisma migrate dev`

## Local Dev Commands

```bash
# Start all services with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Backend only (Node.js)
cd services/backend-api && npm run dev

# Agent only (Python)
cd services/agent-langgraph && uvicorn src.main:app --reload --port 8000

# Frontend only
cd services/frontend && npm run dev

# Prisma Studio (DB GUI)
cd services/backend-api && npx prisma studio
```

## Environment Variables

Copy `.env.example` to `.env`. Required:
- `GROQ_API_KEY` — from console.groq.com
- `LANGCHAIN_API_KEY` — from smith.langchain.com
- `WPPCONNECT_SECRET_KEY` — shared secret for WPPConnect auth
- `POSTGRES_USER/PASSWORD/DB` — local PostgreSQL credentials

## Git Branch Convention

- `feature/*` — new functionality
- `fix/*` — bug fixes
- `chore/*` — infrastructure, config
- All PRs target `develop`, then `develop` → `main` for releases
<!-- MANUAL ADDITIONS END -->
