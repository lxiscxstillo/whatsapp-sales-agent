# Tasks: Agente de Ventas Inmobiliarias en WhatsApp

**Input**: Design documents from `/specs/001-whatsapp-sales-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md, contracts/wppconnect-webhook.md, quickstart.md
**Tests**: No incluidos (no se solicitó TDD en el spec)

**Organization**: Tasks agrupadas por User Story para habilitar implementación y testing independiente de cada historia.

## Format: `[ID] [P?] [Story?] Description — file/path`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias bloqueantes)
- **[Story]**: A qué User Story pertenece la tarea (US1, US2, US3, US4)
- Sin label de Story en Setup y Foundational

---

## Phase 1: Setup (Infraestructura Compartida)

**Purpose**: Inicialización del proyecto, estructura de directorios, Docker, variables de entorno.

**Rama**: `chore/docker-setup`

- [X] T001 Crear estructura de directorios del proyecto: `services/backend-api/`, `services/agent-langgraph/`, `services/combined/`, `services/frontend/`, `wppconnect-config/`
- [X] T002 [P] Crear `docker-compose.yml` con servicios: postgres, wppconnect, agent-langgraph, backend-api, frontend — siguiendo spec Sección 7
- [X] T003 [P] Crear `docker-compose.dev.yml` con overrides de desarrollo (hot reload, puertos expuestos) — `docker-compose.dev.yml`
- [X] T004 [P] Crear `.env.example` con todas las variables requeridas: `GROQ_API_KEY`, `LANGCHAIN_API_KEY`, `WPPCONNECT_SECRET_KEY`, `POSTGRES_*`, `INTERNAL_API_KEY`, `BACKEND_API_URL` — `.env.example`
- [X] T005 [P] Crear `services/backend-api/Dockerfile` multi-etapa (deps / builder / runner con Node.js 20 Alpine) — `services/backend-api/Dockerfile`
- [X] T006 [P] Crear `services/agent-langgraph/Dockerfile` con Python 3.11-slim + uvicorn — `services/agent-langgraph/Dockerfile`
- [X] T007 [P] Crear `services/frontend/Dockerfile` multi-etapa con Next.js standalone output — `services/frontend/Dockerfile`
- [X] T008 [P] Crear `services/combined/Dockerfile` con Node.js 20 base + Python 3.11 + supervisord — `services/combined/Dockerfile`
- [X] T009 [P] Crear `services/combined/supervisord.conf` con procesos: backend-api (puerto 3001) y agent-langgraph (puerto 8000) — `services/combined/supervisord.conf`
- [X] T010 [P] Crear script de entrypoint para WPPConnect que genera `config.ts` dinámicamente desde variables de entorno — `wppconnect-config/entrypoint.sh`

**Checkpoint**: `docker compose up` levanta todos los contenedores sin errores de build.

---

## Phase 2: Foundational (Prerequisitos Bloqueantes)

**Purpose**: Infraestructura de datos y esqueletos de servicio que DEBEN estar completos antes de cualquier User Story.

**⚠️ CRÍTICO**: Ninguna User Story puede comenzar hasta completar esta fase.

**Ramas**: `chore/db-schema` (Prisma) + inicio de `feature/whatsapp-integration` (skeleton)

### Backend API — Skeleton

- [X] T011 Inicializar proyecto Node.js + TypeScript en `services/backend-api/`: `package.json`, `tsconfig.json`, `package-lock.json` con dependencias: `express`, `@prisma/client`, `zod`, `axios`, `winston` — `services/backend-api/package.json`
- [X] T012 [P] Crear `services/backend-api/src/config.ts` con todas las variables de entorno tipadas y validadas con zod: `DATABASE_URL`, `WPPCONNECT_URL`, `WPPCONNECT_SECRET_KEY`, `WPPCONNECT_SESSION`, `AGENT_URL`, `LANGCHAIN_API_KEY`, `INTERNAL_API_KEY`
- [X] T013 [P] Crear `services/backend-api/src/utils/logger.ts` con logger estructurado (Winston) que emite eventos JSON con los campos: `event`, `timestamp`, `leadId`, `messageId`, `langsmithRunId`
- [X] T014 Crear `services/backend-api/src/middleware/error.middleware.ts` con handler global de errores (4xx y 5xx) y formato estándar `{ error, details }`
- [X] T015 Crear `services/backend-api/src/middleware/auth.middleware.ts` que valida el header `x-internal-key` contra `INTERNAL_API_KEY` del entorno
- [X] T016 Crear `services/backend-api/src/index.ts` con Express app: registra middlewares (auth, error), monta rutas placeholder, arranca en puerto 3001, conecta Prisma Client al startup

### Base de Datos — Prisma Schema

- [X] T017 Inicializar Prisma en `services/backend-api/`: `npx prisma init`, configurar `datasource db` con `provider = "postgresql"` — `services/backend-api/prisma/schema.prisma`
- [X] T018 Definir modelo `Lead` completo en `services/backend-api/prisma/schema.prisma`: todos los campos de slots como columnas planas, enum `LeadStatus` (NEW/QUALIFYING/HOT/HANDOFF/PAUSED/CLOSED), campo `ambiguityCount`, índices en `status`, `createdAt`, `isHandoffRequested`
- [X] T019 Definir modelo `Message` en `services/backend-api/prisma/schema.prisma`: campos `wppMessageId` (@unique), `direction` (enum), `senderType` (enum), `langsmithRunId`, `isAmbiguous`, `rawPayload` (Json), índices en `(leadId, createdAt)` y `wppMessageId`
- [ ] T020 Generar migración inicial: `npx prisma migrate dev --name init` — `services/backend-api/prisma/migrations/`
- [ ] T021 Generar Prisma Client: `npx prisma generate` — verificar que `@prisma/client` está disponible en `services/backend-api/node_modules`

### Agent Python — Skeleton

- [X] T022 Inicializar proyecto Python en `services/agent-langgraph/`: `requirements.txt` con `fastapi`, `uvicorn`, `langgraph`, `langchain-groq`, `langchain-core`, `langgraph-checkpoint-postgres`, `pydantic` — `services/agent-langgraph/requirements.txt`
- [X] T023 [P] Crear `services/agent-langgraph/src/config.py` con variables de entorno tipadas: `GROQ_API_KEY`, `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2`, `LANGSMITH_PROJECT`, `DATABASE_URL`
- [X] T024 [P] Crear `services/agent-langgraph/src/graph/state.py` con `LeadSlots` TypedDict (9 slots) y `AgentState` TypedDict: `messages` (Annotated con `add_messages`), `slots`, `lead_status`, `ambiguity_counter`, `last_intent`, `needs_handoff`, `lead_id`, `interest_level`
- [X] T025 Crear `services/agent-langgraph/src/main.py` con FastAPI app: endpoint `POST /agent/process` (schema de request/response per `contracts/rest-api.md`), inicialización de `AsyncPostgresSaver` al startup con `await checkpointer.setup()`

**Checkpoint**: `docker compose up postgres backend-api agent-langgraph` arranca sin errores. `GET /api/v1/leads` retorna `[]`. `POST /agent/process` retorna 503 (sin modelos aún — es esperado).

---

## Phase 3: User Story 1 — Atención Inicial Automatizada (P1) 🎯 MVP

**Goal**: Un lead escribe por WhatsApp → el agente responde automáticamente en < 5 segundos con tono natural. El lead queda registrado en DB con `status: QUALIFYING`.

**Independent Test**: Enviar mensaje desde número de prueba → verificar respuesta en WhatsApp + lead en DB con `status: QUALIFYING` + mensaje en tabla `messages`.

**Rama**: `feature/whatsapp-integration`

### WPPConnect Gateway

- [X] T026 [US1] Crear `services/backend-api/src/services/wppconnect.service.ts` con métodos: `sendMessage(phone: string, text: string)` → `POST /api/{session}/send-message` a WPPConnect, `generateToken()` → `POST /api/{session}/{secretKey}/generate-token`, manejo de errores con retry (1 intento) y timeout de 8s
- [X] T027 [US1] Crear `services/backend-api/src/routes/webhook.route.ts` con `POST /api/v1/webhook/message`: validar schema con zod (campos requeridos: `id`, `from`, `body`, `type`, `timestamp`, `fromMe`, `isGroup`), filtrar `isGroup: true` y `fromMe: true`, filtrar `type !== "chat"` con respuesta de fallback textual

### Lead & Message Services

- [X] T028 [P] [US1] Crear `services/backend-api/src/services/lead.service.ts` con métodos: `findOrCreate(phone: string)` → upsert en tabla `Lead`, `updateStatus(id, status)`, `updateSlots(id, slots)`, `updateHandoff(id, reason)`, `updateAmbiguityCount(id, count)`
- [X] T029 [P] [US1] Crear `services/backend-api/src/services/message.service.ts` con métodos: `create(data)` → insert en tabla `Message`, `findByLeadId(leadId, pagination)` → historial paginado, `existsByWppId(wppMessageId)` → verificación de idempotencia

### Agent Client & Webhook Orchestration

- [X] T030 [US1] Crear `services/backend-api/src/services/agent.service.ts` como cliente HTTP al agente Python: método `process(payload)` → `POST http://localhost:8000/agent/process` (o `AGENT_URL`), timeout de 15s, manejo de error 503 con mensaje de fallback predefinido
- [X] T031 [US1] Implementar orquestación completa en `services/backend-api/src/routes/webhook.route.ts`: (1) verificar idempotencia con `message.service.existsByWppId`, (2) upsert del lead, (3) si `lead.status === HANDOFF` → no invocar agente, (4) invocar agente, (5) persistir mensaje inbound + outbound, (6) actualizar slots y estado del lead, (7) enviar respuesta via WPPConnect, (8) emitir evento `message.received` y `message.sent` al logger

### LangGraph — Nodo Básico de Respuesta

- [X] T032 [US1] Crear `services/agent-langgraph/src/prompts/system_prompt.py` con la personalidad del agente: asesor inmobiliario colombiano natural y conversacional, reglas de no repetición de preguntas, slots ya conocidos incluidos en contexto
- [X] T033 [US1] Crear `services/agent-langgraph/src/graph/nodes/receive_message.py`: normaliza texto entrante, carga `lead_id` y `lead_status` en el estado del grafo
- [X] T034 [US1] Crear `services/agent-langgraph/src/graph/nodes/detect_intent.py`: usa `llama-3.1-8b-instant` con `with_structured_output` para clasificar intent (8 valores posibles), fuerza `AMBIGUOUS` si `confidence < 0.6`
- [X] T035 [US1] Crear `services/agent-langgraph/src/graph/nodes/generate_response.py`: usa `llama-3.3-70b-versatile` con system prompt + slots conocidos + historial (últimos 8 turnos), temperatura 0.7, max_tokens 200
- [X] T036 [US1] Crear `services/agent-langgraph/src/graph/graph.py` con grafo mínimo: `receive_message → detect_intent → generate_response → END` (sin slot_check ni evaluate_lead aún — se añaden en US2), compilar con `AsyncPostgresSaver`, `thread_id = phone`
- [X] T037 [US1] Conectar el grafo en `services/agent-langgraph/src/main.py`: implementar el endpoint `POST /agent/process` que invoca `graph.ainvoke({"messages": [HumanMessage(content=message)]}, config={"configurable": {"thread_id": phone}})` y retorna el response en el schema definido

**Checkpoint**: US1 completamente funcional. Lead escribe → agente responde en < 5s → registro en DB correcto.

---

## Phase 4: User Story 2 — Calificación Completa y Handoff Automático (P1)

**Goal**: El agente extrae los 9 slots durante la conversación, calcula `interestLevel` y hace handoff automático cuando detecta alta intención. El agente NO responde a leads en HANDOFF.

**Independent Test**: Simular 5-6 mensajes cubriendo slots obligatorios + urgencia alta → `status: HANDOFF`, `interestLevel >= 4`, `isHandoffRequested: true` en DB.

**Rama**: `feature/lead-qualification`

### Slot Extraction & Evaluation

- [X] T038 [P] [US2] Crear `services/agent-langgraph/src/prompts/slot_prompt.py` con prompt de extracción estructurada: instrucciones para identificar los 9 slots, regla de normalización de budget a número entero COP, regla de no repetición
- [X] T039 [P] [US2] Crear `services/agent-langgraph/src/graph/nodes/slot_check.py`: usa `llama-3.1-8b-instant` con `with_structured_output` para extraer/actualizar slots del mensaje, implementa regla de overwrite (si lead contradice slot existente), retorna lista de slots faltantes y próximo slot prioritario según tabla P1/P2/P3/P4
- [X] T040 [US2] Crear `services/agent-langgraph/src/graph/nodes/evaluate_lead.py`: calcula `interest_level` (1–5) según: completitud de slots P1/P2 (+1 por cada uno), urgencia < 1 mes (+2), señales HIGH_INTEREST (+1); retorna `needs_handoff = True` si `interest_level >= 4`

### Handoff Node & System

- [X] T041 [US2] Crear `services/agent-langgraph/src/graph/nodes/handoff.py`: prepara mensaje de cierre cálido para el lead, establece `needs_handoff = True`, `lead_status = "handoff"` en el estado del grafo
- [X] T042 [US2] Actualizar `services/agent-langgraph/src/graph/graph.py` con el grafo completo: `receive_message → detect_intent → [slot_check | handoff | fallback] → evaluate_lead → [handoff | generate_response] → END`, agregar edges condicionales según intent y `needs_handoff`
- [X] T043 [US2] Actualizar response schema en `services/agent-langgraph/src/main.py` para incluir: `updatedSlots`, `interestLevel`, `triggerHandoff`, `handoffReason`, `langsmithRunId` (extraído de `config["run_id"]` del grafo)
- [X] T044 [US2] Actualizar orquestación en `services/backend-api/src/routes/webhook.route.ts`: si response incluye `triggerHandoff: true` → llamar `lead.service.updateHandoff()` y emitir evento `lead.handoff` al logger
- [X] T045 [US2] Actualizar `services/backend-api/src/services/lead.service.ts` con método `syncSlotsFromAgent(leadId, updatedSlots)` que hace upsert selectivo de slots (solo sobreescribe si el valor nuevo no es null), guarda `slotBudgetNumeric` cuando `updatedSlots.budgetNumeric` está disponible

### Leads REST API (necesario para US3 — agregar aquí como prereq)

- [X] T046 [P] [US2] Crear `services/backend-api/src/routes/leads.route.ts` con `GET /api/v1/leads` (paginado, filtro por `status`, sort por `createdAt_desc` o `interestLevel_desc`) y `GET /api/v1/leads/:id` (detalle con slots anidados en objeto `slots`)
- [X] T047 [P] [US2] Implementar `PATCH /api/v1/leads/:id` en `services/backend-api/src/routes/leads.route.ts`: validar con zod, prohibir `status: "new"` manual, actualizar `agentNotes`, `assignedTo`, y slots parciales; emitir evento de log
- [X] T048 [P] [US2] Implementar `GET /api/v1/leads/:id/messages` con paginación y `POST /api/v1/leads/:id/messages` (mensaje manual `senderType: "human"`) en `services/backend-api/src/routes/leads.route.ts`: el manual no invoca al agente, llama directamente a `wppconnect.service.sendMessage()` y persiste en DB con `senderType: HUMAN`
- [X] T049 [P] [US2] Crear `services/backend-api/src/routes/handoff.route.ts` con `POST /api/v1/leads/:id/handoff`: validar estado (409 si ya está en HANDOFF), actualizar lead, emitir evento `lead.handoff`, retornar `{ handoff: true }`

**Checkpoint**: US2 funcional. Conversación completa de calificación termina en HANDOFF automático. API REST devuelve leads y mensajes correctamente.

---

## Phase 5: User Story 3 — Gestión desde el Panel Web (P2)

**Goal**: El asesor ve todos los leads con estado e información clave, abre el historial de conversación y envía mensajes manuales desde el panel.

**Independent Test**: Desde el panel, abrir un lead en HANDOFF, enviar mensaje manual → lead lo recibe en WhatsApp + historial actualizado con `senderType: HUMAN`.

**Rama**: `feature/leads-interface`

### Next.js Setup & Route Handlers

- [X] T050 [US3] Inicializar Next.js 14 App Router en `services/frontend/`: `create-next-app` con TypeScript, Tailwind CSS, App Router; configurar `next.config.js` con `output: "standalone"` — `services/frontend/package.json`
- [ ] T051 [P] [US3] Instalar shadcn/ui en `services/frontend/`: `npx shadcn-ui@latest init`; agregar componentes: `table`, `badge`, `sheet`, `scroll-area`, `textarea`, `button`, `dialog` — `services/frontend/components/ui/`
- [X] T052 [P] [US3] Crear Route Handlers como proxy al backend Railway (ocultan `BACKEND_API_URL` del cliente): `services/frontend/src/app/api/leads/route.ts` (GET), `services/frontend/src/app/api/leads/[id]/route.ts` (GET, PATCH), `services/frontend/src/app/api/leads/[id]/messages/route.ts` (GET, POST), `services/frontend/src/app/api/leads/[id]/handoff/route.ts` (POST) — todos usan `fetch(BACKEND_API_URL, { headers: { 'x-internal-key': INTERNAL_API_KEY } })`

### Dashboard Components

- [X] T053 [P] [US3] Crear `services/frontend/src/components/StatusBadge.tsx`: badge con colores por `LeadStatus` (NEW=gray, QUALIFYING=blue, HOT=orange, HANDOFF=red+pulse, PAUSED=yellow, CLOSED=green)
- [X] T054 [P] [US3] Crear `services/frontend/src/components/LeadRow.tsx`: fila de tabla con campos: nombre (o teléfono si no hay nombre), StatusBadge, tipo de inmueble, ciudad, presupuesto, nivel de interés (★), tiempo desde último mensaje
- [X] T055 [P] [US3] Crear `services/frontend/src/components/MessageBubble.tsx`: burbuja de mensaje con alineación diferenciada (izquierda=lead, derecha azul=agente, derecha verde=humano), timestamp absoluto, indicador de `isAmbiguous`

### Dashboard Pages

- [X] T056 [US3] Crear `services/frontend/src/app/dashboard/layout.tsx` (Server Component): sidebar con conteo de leads por estado, link de navegación al dashboard; y `services/frontend/src/app/dashboard/page.tsx` para render inicial del servidor
- [X] T057 [US3] Crear `services/frontend/src/app/dashboard/LeadsListClient.tsx` (`"use client"`): usa `useSWR("/api/leads", fetcher, { refreshInterval: 4000 })`, tabla con shadcn/ui `Table`, columnas de `LeadRow`, filtro por status, click en fila navega a `dashboard/[leadId]`
- [X] T058 [US3] Crear `services/frontend/src/app/dashboard/[leadId]/page.tsx` (Server Component, fetch inicial) y `ConversationClient.tsx` (`"use client"`): usa `useSWR` con `refreshInterval: 2000`, `ScrollArea` con `MessageBubble` por cada mensaje, auto-scroll al último mensaje cuando la lista crece
- [X] T059 [US3] Crear `services/frontend/src/app/dashboard/[leadId]/ReplyForm.tsx` (`"use client"`): `Textarea` controlado + `Button` "Enviar", `POST /api/leads/:id/messages` con `{ body, senderType: "human" }`, loading state durante envío, limpiar textarea al confirmar envío exitoso
- [X] T060 [US3] Crear `services/frontend/src/app/dashboard/[leadId]/page.tsx` completo: combina panel de slots del lead (nombre, city, budget, intent, etc.) + `ConversationClient` + `ReplyForm` en layout de dos columnas

**Checkpoint**: US3 funcional. Panel carga lista de leads, abre conversación, envía mensaje manual correctamente.

---

## Phase 6: User Story 4 — Manejo de Mensajes Ambiguos (P2)

**Goal**: El agente maneja mensajes poco claros sin romper la conversación. Tras 3 ambigüedades consecutivas escala automáticamente a HANDOFF.

**Independent Test**: Enviar 3 mensajes consecutivos incomprensibles → lead pasa a HANDOFF + evento `agent.ambiguous_message` con `ambiguityCount: 3` en logs.

**Rama**: `feature/handoff-system` (subfuncionalidad)

- [X] T061 [US4] Crear `services/agent-langgraph/src/graph/nodes/fallback.py`: si `ambiguity_counter < 3` → retorna `fallback_action: "ASK_CLARIFICATION"` con mensaje amigable; si `ambiguity_counter >= 3` → retorna `fallback_action: "ESCALATE_HANDOFF"`; mensajes `OFF_TOPIC` redirigen sin incrementar el contador
- [X] T062 [US4] Actualizar `services/agent-langgraph/src/graph/graph.py`: añadir edge condicional desde `detect_intent` a `fallback` cuando `intent in [AMBIGUOUS, OFF_TOPIC, UNKNOWN]`; añadir edge desde `fallback` a `handoff` cuando `fallback_action == ESCALATE_HANDOFF`
- [X] T063 [US4] Actualizar `services/backend-api/src/routes/webhook.route.ts`: sincronizar `ambiguityCount` del lead en DB con el valor retornado por el agente, emitir evento `agent.ambiguous_message` cuando `isFallback: true`
- [X] T064 [US4] Crear `services/backend-api/src/services/lead.service.ts` → método `resetAmbiguityCount(leadId)` llamado cuando el agente retorna `isFallback: false` (mensaje claro procesado)

**Checkpoint**: US4 funcional. 3 mensajes ambiguos consecutivos escalan a HANDOFF. Mensajes off-topic redirigen amablemente sin escalar.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Observabilidad completa, refinamiento de prompts, contenedor combinado para Railway.

**Ramas**: `feature/human-like-responses`, `feature/langsmith-observability`, `chore/docker-setup` (combined)

### LangSmith & Logging

- [X] T065 [P] Verificar que `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY` están en el entorno del agente y que cada invocación del grafo aparece en LangSmith Studio con todos los nodos visibles — `services/agent-langgraph/src/config.py`
- [X] T066 [P] Asegurar que `langsmithRunId` se extrae del resultado del grafo y se incluye en el response de `/agent/process`; actualizar `services/backend-api/src/routes/webhook.route.ts` para guardarlo en `Message.langsmithRunId` en DB
- [X] T067 [P] Emitir el catálogo completo de 9 eventos JSON desde `services/backend-api/src/utils/logger.ts`: `message.received`, `agent.intent_detected`, `lead.slots_updated`, `lead.slot_overwritten`, `agent.ambiguous_message`, `lead.evaluated`, `lead.handoff`, `message.sent`, `agent.error` — cada evento con los campos exactos del spec Sección 6

### Refinamiento de Prompts

- [X] T068 Iterar sobre `services/agent-langgraph/src/prompts/system_prompt.py`: añadir instrucciones específicas de manejo de objeciones (presupuesto, tiempo, duda, desinterés), variaciones en el orden de preguntas para sonar menos como formulario, ejemplos de tono colombiano natural
- [X] T069 Iterar sobre `services/agent-langgraph/src/prompts/intent_prompt.py`: añadir ejemplos few-shot de cada intent (2-3 por categoría) para mejorar accuracy de clasificación; ajustar umbral de confianza si hay falsos positivos de AMBIGUOUS

### Contenedor Combinado para Railway

- [X] T070 Implementar `services/combined/Dockerfile`: imagen base Node.js 20, instalar Python 3.11 + pip + supervisord via apk/apt, copiar y buildear ambos servicios, copiar `supervisord.conf`
- [ ] T071 Verificar que `docker compose up` con el contenedor `combined` levanta ambos procesos (Node.js en 3001, Python en 8000) y que el backend puede llamar al agente via `http://localhost:8000` internamente

### Validación Final E2E

- [X] T072 Ejecutar el Checklist de Demo E2E completo (spec Sección 9): 7 flujos, verificar cada checkpoint, documentar resultados en `specs/001-whatsapp-sales-agent/checklists/e2e-results.md`
- [X] T073 Actualizar `quickstart.md` con cualquier corrección descubierta durante E2E + instrucciones de despliegue en Railway y Vercel con pasos exactos

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └──> Phase 2 (Foundational)   ⚠️ BLOQUEA todo
         ├──> Phase 3 (US1 - P1) 🎯 MVP mínimo
         │      └──> Phase 4 (US2 - P1)
         │             └──> Phase 5 (US3 - P2)  ← puede empezar en paralelo con US2 si hay 2 devs
         └──> Phase 6 (US4 - P2)               ← puede empezar después de Phase 3
                └──> Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depende de | Puede paralelizarse con |
|-------|------------|------------------------|
| US1 (P1) | Phase 2 | — |
| US2 (P1) | US1 (agente base) | US3 parcialmente (Route Handlers independientes) |
| US3 (P2) | Phase 2 (API REST T046-T049) | US2 desde T050 |
| US4 (P2) | US1 (grafo base) + US2 (handoff) | US3 |

### Dentro de Cada User Story

- Servicios/modelos antes de rutas
- Nodos del grafo antes del grafo completo
- Route Handlers de Next.js antes de los Client Components
- Client Components antes de las páginas

### Oportunidades Paralelas por Story

**US1**: T026 y T028-T029 pueden correr en paralelo (archivos distintos)
**US2**: T038-T039 en paralelo (slot_prompt + slot_check), T046-T049 en paralelo (4 routes distintas)
**US3**: T051-T052 en paralelo, T053-T055 en paralelo (3 componentes distintos)
**Phase 7**: T065-T067 en paralelo (logging independiente), T068-T069 en paralelo (prompts distintos)

---

## Parallel Example: User Story 2

```
# Una vez US1 está completo, iniciar en paralelo:
Agente A: T038 (slot_prompt.py)
Agente B: T039 (slot_check.py node)

# Luego en paralelo:
Agente A: T040 (evaluate_lead.py)
Agente B: T046 (leads GET routes)

# Luego en paralelo:
Agente A: T041-T043 (handoff node + graph + response schema)
Agente B: T047-T049 (PATCH/POST/handoff routes)
```

---

## Implementation Strategy

### MVP Mínimo (US1 solamente — ~5 días)

1. Completar Phase 1 (Setup) + Phase 2 (Foundational)
2. Completar Phase 3 (US1)
3. **PARAR Y VALIDAR**: Lead escribe → agente responde → registro en DB
4. Demo con conversación de 3-4 turnos básicos

### Entrega Incremental Completa

1. Phase 1 + Phase 2 → fundación lista
2. Phase 3 (US1) → demo básico de WhatsApp ✓
3. Phase 4 (US2) → calificación completa + handoff automático ✓
4. Phase 5 (US3) → panel web operativo ✓
5. Phase 6 (US4) → manejo de ambigüedad ✓
6. Phase 7 (Polish) → producción lista para Railway/Vercel ✓

### Estrategia de Equipo (2 devs)

```
Dev A: Phase 1 → Phase 2 backend → Phase 3 (WhatsApp + agente básico)
Dev B: Phase 2 DB schema → Phase 4 (LangGraph completo) → Phase 5 (Frontend)
Reunión de integración: después de cada Phase
```

---

## Notes

- `[P]` = archivos distintos, sin dependencias bloqueantes entre sí
- `[US#]` label mapea cada tarea a su User Story para trazabilidad
- Cada User Story debe ser completable y testeable de forma independiente
- Commitear después de cada tarea o grupo lógico (máx. 3 tareas por commit)
- Usar la rama Git correspondiente por cada fase (ver spec Sección 8)
- Verificar el E2E Checklist (spec Sección 9) después de completar US2
- Los paths de archivos son absolutos respecto al root del proyecto

---

## Resumen de Tareas

| Phase | Story | Tareas | Ramas |
|-------|-------|--------|-------|
| Phase 1: Setup | — | T001–T010 (10 tareas) | `chore/docker-setup` |
| Phase 2: Foundational | — | T011–T025 (15 tareas) | `chore/db-schema`, inicio `feature/whatsapp-integration` |
| Phase 3: US1 | US1 (P1) | T026–T037 (12 tareas) | `feature/whatsapp-integration` |
| Phase 4: US2 | US2 (P1) | T038–T049 (12 tareas) | `feature/lead-qualification` |
| Phase 5: US3 | US3 (P2) | T050–T060 (11 tareas) | `feature/leads-interface` |
| Phase 6: US4 | US4 (P2) | T061–T064 (4 tareas) | `feature/handoff-system` |
| Phase 7: Polish | — | T065–T073 (9 tareas) | `feature/human-like-responses`, `feature/langsmith-observability` |
| **Total** | | **73 tareas** | **8 ramas** |

**Oportunidades paralelas identificadas**: 28 tareas marcadas con `[P]`
**MVP mínimo (US1)**: Phases 1-3 = 37 tareas
