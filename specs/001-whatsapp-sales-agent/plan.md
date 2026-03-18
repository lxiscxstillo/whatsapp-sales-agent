# Implementation Plan: Agente de Ventas Inmobiliarias en WhatsApp

**Branch**: `001-whatsapp-sales-agent` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-whatsapp-sales-agent/spec.md`

---

## Summary

Sistema de agente conversacional de ventas inmobiliarias conectado a WhatsApp. Un lead escribe al número de la empresa y el agente LangGraph (Python) califica al prospecto extrayendo 9 slots clave (tipo de inmueble, ciudad, presupuesto, etc.), detecta alta intención y hace handoff automático al equipo humano. El equipo opera desde un panel Next.js con historial de conversaciones y capacidad de respuesta manual.

**Decisión arquitectónica crítica (post-research):** Los servicios `backend-api` (Node.js) y `agent-langgraph` (Python) se fusionan en un único contenedor Railway usando `supervisord`, reduciendo el costo estimado de ~$20/mes a ~$8-12/mes dentro del plan Hobby de Railway.

---

## Technical Context

**Language/Version**: Node.js 20 (backend API) + Python 3.11 (LangGraph agent)
**Primary Dependencies**:
- Backend: Express/Fastify, Prisma ORM, `@wppconnect-team/wppconnect`
- Agent: LangGraph 0.2+, LangChain, `langchain-groq`, `langgraph-checkpoint-postgres`
- Frontend: Next.js 14+ (App Router), Tailwind CSS, shadcn/ui, SWR

**Storage**: PostgreSQL 15 (Railway plugin) — tablas de negocio (Lead, Message) + tablas internas de LangGraph checkpointer

**Testing**: Jest (Node.js), pytest (Python), Playwright (E2E frontend)

**Target Platform**: Linux container (Railway), Vercel (frontend)

**Performance Goals**:
- Respuesta al lead en < 5 segundos el 95% de las veces
- Panel de leads carga en < 2 segundos con 100 leads activos
- Envío de mensaje manual en < 3 segundos

**Constraints**:
- Railway Hobby plan: ~$5/mes crédito incluido (shared entre todos los servicios)
- Vercel Hobby: serverless function timeout 10s (mitigado: Next.js solo como proxy liviano)
- Sin rate limiting nativo en WPPConnect: implementar en capa Express
- `AsyncPostgresSaver` de LangGraph requiere `await checkpointer.setup()` al startup (crea tablas de checkpoint)

**Scale/Scope**: MVP para ~50 leads activos simultáneos en free tier Railway

---

## Constitution Check

La constitución del proyecto no ha sido definida (archivo `constitution.md` contiene solo el template vacío). No hay principios que violar.

**Gates evaluados manualmente:**

| Gate | Estado | Notas |
|------|--------|-------|
| Complejidad mínima | PASS | Fusión de servicios reduce complejidad operacional |
| Separación de responsabilidades | PASS | 3 capas claras: integración WhatsApp / agente LangGraph / API REST |
| Testabilidad | PASS | Cada servicio tiene interfaz HTTP clara y mockeable |
| Escalabilidad | PASS | Checkpointer PostgreSQL permite múltiples workers en futuro |
| Costo en free tier | PASS (con ajuste) | Fusión de servicios lleva costo a ~$8-12/mes (excede $5 crédito pero es mínimo viable) |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-whatsapp-sales-agent/
├── spec.md              # Especificación completa (/speckit.specify)
├── plan.md              # Este archivo (/speckit.plan)
├── research.md          # Decisiones de investigación (Phase 0)
├── data-model.md        # Modelo de datos y entidades (Phase 1)
├── quickstart.md        # Guía de setup local (Phase 1)
├── tasks.md             # Tareas de implementación (/speckit.specify output, validado en plan)
├── contracts/
│   ├── rest-api.md      # Contrato REST API backend (Phase 1)
│   └── wppconnect-webhook.md  # Contrato webhook WPPConnect (Phase 1)
└── checklists/
    └── requirements.md  # Checklist de calidad del spec
```

### Source Code (repository root)

```text
whatsapp-sales-agent/
├── docker-compose.yml               # Producción (3 servicios Railway + PostgreSQL)
├── docker-compose.dev.yml           # Override desarrollo (hot reload, puertos expuestos)
├── .env.example
├── wppconnect-config/
│   └── config.ts                    # Configuración WPPConnect (generada por entrypoint)
│
├── services/
│   │
│   ├── backend-api/                 # Node.js — API REST + webhook handler
│   │   ├── Dockerfile               # Multi-etapa (deps / builder / runner)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma        # Modelos Lead, Message + enums
│   │   └── src/
│   │       ├── index.ts             # Entry point — Express app + startup
│   │       ├── config.ts            # Variables de entorno tipadas
│   │       ├── routes/
│   │       │   ├── webhook.route.ts # POST /webhook/message
│   │       │   ├── leads.route.ts   # CRUD leads
│   │       │   └── handoff.route.ts # POST /leads/:id/handoff
│   │       ├── services/
│   │       │   ├── lead.service.ts      # CRUD + estado + slot management
│   │       │   ├── message.service.ts   # Persistencia mensajes, idempotencia
│   │       │   ├── agent.service.ts     # Cliente HTTP al agente Python
│   │       │   └── wppconnect.service.ts # Cliente HTTP a WPPConnect
│   │       ├── middleware/
│   │       │   ├── auth.middleware.ts   # Verificación INTERNAL_API_KEY
│   │       │   └── error.middleware.ts  # Error handler global
│   │       └── utils/
│   │           └── logger.ts           # Logger estructurado + eventos LangSmith
│   │
│   ├── agent-langgraph/             # Python — LangGraph agent
│   │   ├── Dockerfile               # Python 3.11-slim + uvicorn
│   │   ├── requirements.txt
│   │   └── src/
│   │       ├── main.py              # FastAPI app + startup (checkpointer.setup())
│   │       ├── graph/
│   │       │   ├── state.py         # AgentState TypedDict + LeadSlots
│   │       │   ├── graph.py         # Definición del grafo LangGraph
│   │       │   └── nodes/
│   │       │       ├── receive_message.py
│   │       │       ├── detect_intent.py   # llama-3.1-8b-instant
│   │       │       ├── slot_check.py
│   │       │       ├── evaluate_lead.py
│   │       │       ├── fallback.py
│   │       │       ├── handoff.py
│   │       │       └── generate_response.py  # llama-3.3-70b-versatile
│   │       ├── prompts/
│   │       │   ├── system_prompt.py   # Personalidad del agente
│   │       │   ├── intent_prompt.py   # Clasificación de intent
│   │       │   └── slot_prompt.py     # Extracción de slots
│   │       └── config.py             # Variables de entorno tipadas
│   │
│   ├── combined/                    # Contenedor fusionado para Railway production
│   │   ├── Dockerfile               # Node.js base + Python + supervisord
│   │   └── supervisord.conf         # Gestiona backend-api (3001) + agent (8000)
│   │
│   └── frontend/                    # Next.js App Router
│       ├── Dockerfile               # Multi-etapa (standalone output)
│       ├── package.json
│       └── src/
│           ├── app/
│           │   ├── layout.tsx           # Root layout + providers
│           │   ├── page.tsx             # Redirect a /dashboard
│           │   ├── dashboard/
│           │   │   ├── layout.tsx       # Sidebar + nav (Server Component)
│           │   │   ├── page.tsx         # Lista de leads (initial fetch Server)
│           │   │   ├── LeadsListClient.tsx  # "use client" — SWR polling
│           │   │   └── [leadId]/
│           │   │       ├── page.tsx             # Conversación (initial fetch Server)
│           │   │       ├── ConversationClient.tsx   # "use client" — SWR + form
│           │   │       └── ReplyForm.tsx        # "use client" — POST mensaje manual
│           │   └── api/                # Route Handlers (proxy al backend Railway)
│           │       ├── leads/
│           │       │   ├── route.ts         # GET /api/leads
│           │       │   └── [id]/
│           │       │       ├── route.ts         # GET+PATCH /api/leads/[id]
│           │       │       ├── messages/
│           │       │       │   └── route.ts     # GET+POST /api/leads/[id]/messages
│           │       │       └── handoff/
│           │       │           └── route.ts     # POST /api/leads/[id]/handoff
│           └── components/
│               ├── LeadRow.tsx          # Fila de lead en la tabla
│               ├── MessageBubble.tsx    # Burbuja de mensaje (inbound/outbound/human)
│               ├── StatusBadge.tsx      # Badge de LeadStatus
│               └── ui/                  # shadcn/ui components (copiados)
```

**Structure Decision**: Arquitectura multi-servicio con separación clara por responsabilidad. En producción (Railway) los servicios `backend-api` y `agent-langgraph` se fusionan en un contenedor `combined` usando `supervisord`. En desarrollo se ejecutan por separado para hot reload independiente.

---

## Complexity Tracking

| Decisión | Por qué necesaria | Alternativa más simple rechazada |
|----------|-------------------|----------------------------------|
| Contenedor fusionado (backend + agent) en Railway | Railway free tier: $5 crédito cubre ~1.5 servicios full-time | 4 servicios separados: costo ~$20/mes, impractical en free tier |
| `AsyncPostgresSaver` en lugar de state stateless | Estado de conversación debe sobrevivir reinicios del contenedor | Pasar historial completo en cada request: payloads O(N) y gestión en cliente |
| Dos modelos Groq (8b + 70b) | Clasificación rápida (8b) + respuestas naturales (70b) | Un solo 70b: latencia ~4-5s por cada mensaje |
| WPPConnect como servicio separado (no fusionado con backend) | Chromium/puppeteer + Node.js + Python en un solo contenedor excede límite de memoria de Railway (512 MB) | Todo en uno: memoria insuficiente, crashes frecuentes |

---

## Implementation Phases Summary

### Phase 0: Infraestructura Base
**Ramas**: `chore/docker-setup`, `chore/db-schema`
- Estructura de directorios del proyecto
- Dockerfiles (dev y producción con `supervisord`)
- docker-compose.yml y docker-compose.dev.yml
- Schema Prisma con migraciones
- Variables de entorno configuradas

### Phase 1: Integración WhatsApp
**Rama**: `feature/whatsapp-integration`
- WPPConnect Server configurado y conectado
- Webhook handler con idempotencia y filtros
- `sendMessage` al lead via WPPConnect REST API
- Persistencia básica de mensajes en DB

### Phase 2: Agente LangGraph
**Rama**: `feature/lead-qualification`
- `AgentState` TypedDict + `AsyncPostgresSaver`
- 7 nodos del grafo (detect_intent → generate_response)
- Integración Groq con dos modelos
- Trazabilidad en LangSmith automática

### Phase 3: Sistema de Handoff
**Rama**: `feature/handoff-system`
- Transiciones de estado del lead
- Pausa de respuestas automáticas en HANDOFF
- Endpoint manual de handoff

### Phase 4: Respuestas Humanas
**Rama**: `feature/human-like-responses`
- Refinamiento de prompts y personalidad
- Manejo de objeciones
- Estrategia de preguntas naturales

### Phase 5: Panel Web
**Rama**: `feature/leads-interface`
- Next.js App Router + shadcn/ui
- Lista de leads con SWR polling
- Historial de conversación
- Formulario de respuesta manual

### Phase 6: Observabilidad
**Rama**: `feature/langsmith-observability`
- Catálogo completo de eventos de log
- Correlación `langsmithRunId` en DB
- Verificación de trazas en LangSmith Studio

---

## Consideraciones de Despliegue en Railway

### Servicio 1: `wppconnect`
```yaml
# Railway config
image: wppconnect/wppconnect-server:latest
healthcheck: GET /api/status
restart: always
volumes: tokens, userDataDir
# Nota: config.ts se genera en entrypoint con envs de Railway
```

### Servicio 2: `backend-combined`
```dockerfile
# services/combined/Dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip supervisor
# ... instalar deps de Node.js y Python
# supervisord.conf: node dist/index.js (3001) + uvicorn main:app (8000)
```

### Servicio 3: PostgreSQL Plugin
- Railway PostgreSQL plugin (managed)
- `DATABASE_URL` inyectada automáticamente por Railway

### Variables de Entorno en Railway

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| `GROQ_API_KEY` | backend-combined | Groq API key |
| `LANGCHAIN_API_KEY` | backend-combined | LangSmith key |
| `LANGCHAIN_TRACING_V2` | backend-combined | `true` |
| `LANGSMITH_PROJECT` | backend-combined | Nombre del proyecto |
| `WPPCONNECT_SECRET_KEY` | wppconnect + backend-combined | Clave compartida |
| `BACKEND_WEBHOOK_URL` | wppconnect | URL pública del servicio backend-combined |
| `DATABASE_URL` | backend-combined | Inyectado por Railway PostgreSQL plugin |
| `INTERNAL_API_KEY` | frontend (Vercel) + backend | Clave para Route Handlers |
| `BACKEND_API_URL` | frontend (Vercel) | URL del servicio backend-combined en Railway |

---

## Artifacts Generados en Phase 1

- [research.md](./research.md) — Decisiones técnicas con justificación
- [data-model.md](./data-model.md) — Entidades, campos, validaciones, transiciones de estado
- [contracts/rest-api.md](./contracts/rest-api.md) — Contrato REST API completo
- [contracts/wppconnect-webhook.md](./contracts/wppconnect-webhook.md) — Contrato webhook WPPConnect
- [quickstart.md](./quickstart.md) — Guía de setup local paso a paso
