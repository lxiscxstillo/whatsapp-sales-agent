# whatsapp-sales-agent Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-20

## Active Technologies

- TypeScript 5.x (backend-api, frontend), Python 3.11 (agent-langgraph) + Express 4.x, Next.js 14, LangGraph 0.2.x, Prisma 5.x, SWR 2.x, WPPConnect-Server-CLI latest (main)

## Project Structure

```text
services/
├── agent-langgraph/   # Python FastAPI + LangGraph AI agent (Fly.io: wsa-agent-langgraph)
├── backend-api/       # Node.js Express REST API + Prisma ORM (Fly.io: wsa-backend-api)
└── frontend/          # Next.js 14 App Router dashboard (Vercel)
wppconnect-config/     # WPPConnect WhatsApp service (Fly.io: wppconnect-sales-agent)
specs/main/            # Feature planning artifacts (spec, plan, research, contracts)
```

## Commands

```bash
# Backend API
cd services/backend-api && npm run dev

# Frontend
cd services/frontend && npm run dev

# Agent
cd services/agent-langgraph && uvicorn src.main:app --reload

# Prisma migrations
cd services/backend-api && npx prisma migrate deploy
```

## Code Style

- TypeScript: strict mode, Zod for env validation, Winston for logging
- Python: pydantic-settings for config, structlog-style JSON logging
- No `any` types without justification
- All API responses include explicit TypeScript interfaces

## Recent Changes

- main: Added TypeScript 5.x (backend-api, frontend), Python 3.11 (agent-langgraph) + Express 4.x, Next.js 14, LangGraph 0.2.x, Prisma 5.x, SWR 2.x, WPPConnect-Server-CLI latest

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
