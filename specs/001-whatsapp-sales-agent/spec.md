# Feature Specification: Agente de Ventas Inmobiliarias en WhatsApp

**Feature Branch**: `001-whatsapp-sales-agent`
**Created**: 2026-03-17
**Updated**: 2026-03-18
**Status**: In Review — Gap Closure Post-Auditoría
**Input**: Agente autónomo de ventas inmobiliarias conectado a WhatsApp con calificación de leads, handoff humano y trazabilidad completa.

---

## 1. Resumen Ejecutivo

### Descripción del Producto

Un agente conversacional de ventas inmobiliarias que opera a través de WhatsApp, capaz de atender prospectos de forma autónoma las 24 horas. El agente califica leads, extrae datos clave del prospecto, detecta intención de compra o arriendo, maneja objeciones básicas y escala a un asesor humano cuando la oportunidad comercial lo amerita.

### Problema que Resuelve

Las empresas inmobiliarias pierden prospectos por demoras en la atención inicial: leads que escriben fuera del horario laboral, equipos comerciales saturados y seguimiento manual poco sistemático. El agente cubre esta brecha atendiendo de inmediato, cualificando automáticamente y priorizando los leads más calientes para el equipo humano.

### Propuesta de Valor

- **Atención 24/7** sin costo incremental por volumen.
- **Calificación automática** de cada lead con los datos clave para el proceso comercial.
- **Handoff inteligente** al equipo humano cuando la oportunidad está madura.
- **Trazabilidad completa** de cada conversación para auditoría y mejora continua.
- **Interfaz operativa** que permite al equipo ver el estado de todos los leads e intervenir manualmente.

### Tecnologías Seleccionadas

| Componente           | Tecnología                     | Justificación                              |
|----------------------|--------------------------------|--------------------------------------------|
| Mensajería           | WPPConnect                     | Integración WhatsApp sin API oficial       |
| Orquestación agente  | LangGraph                      | Flujos conversacionales con estado         |
| Modelo de lenguaje   | Groq (Llama 3 / Mixtral)       | API gratuita, baja latencia                |
| Observabilidad       | LangSmith Studio               | Trazabilidad y debugging de agentes LLM    |
| Persistencia         | PostgreSQL + Prisma ORM        | Relacional, tipado, migraciones seguras    |
| Backend API          | Node.js (Express/Fastify)      | Ecosistema WPPConnect y LangChain.js       |
| Frontend             | Next.js                        | Deploy en Vercel, SSR y API routes         |
| Infraestructura      | Docker + Railway + Vercel      | Despliegue en planes gratuitos             |

### Alcance del MVP

**Incluido:**
- Recepción y respuesta de mensajes WhatsApp vía WPPConnect.
- Flujo conversacional LangGraph con calificación de lead.
- Persistencia de leads y mensajes en PostgreSQL.
- Handoff al equipo humano cuando el lead está listo.
- Interfaz web básica: lista de leads, historial, respuesta manual.
- Logs de eventos y trazabilidad en LangSmith.

**Excluido del MVP:**
- CRM completo o pipeline de ventas avanzado.
- Integración con catálogo de propiedades.
- Reportes analíticos avanzados.
- Soporte multiempresa (multi-tenant).
- Autenticación avanzada del panel (MVP usa credenciales simples).

---

## 2. Diagrama de Alto Nivel — Servicios y Responsabilidades

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PLATAFORMA WHATSAPP                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Mensajes entrantes/salientes
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICIO: wppconnect-server                                        │
│  - Mantiene sesión activa de WhatsApp (headless browser/puppeteer)  │
│  - Expone webhook HTTP para mensajes entrantes                      │
│  - Recibe comandos HTTP para enviar mensajes salientes              │
│  Puerto: 21465                                                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Webhook POST /message-received
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICIO: backend-api  (Node.js)                                   │
│  - Recibe webhooks de WPPConnect                                    │
│  - Persiste mensajes en DB                                          │
│  - Invoca el agente LangGraph                                       │
│  - Envía respuestas de vuelta a WPPConnect                          │
│  - Expone REST API para el frontend                                 │
│  - Emite logs de eventos a LangSmith                                │
│  Puerto: 3001                                                        │
│                                                                     │
│  Sub-módulos:                                                        │
│  ├── whatsapp-gateway    (bridge WPPConnect <-> backend)            │
│  ├── agent-runner        (invoca LangGraph por conversación)        │
│  ├── lead-service        (CRUD + slot management)                   │
│  ├── message-service     (persistencia de mensajes)                 │
│  └── langsmith-logger    (trazabilidad de eventos)                  │
└────────────┬──────────────────────────┬─────────────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐  ┌──────────────────────────────────────┐
│  SERVICIO: PostgreSQL  │  │  SERVICIO: LangSmith (externo)       │
│  - Tabla leads         │  │  - Trazas de ejecución del agente    │
│  - Tabla messages      │  │  - Visualización en LangSmith Studio │
│  Puerto: 5432          │  │  - Alertas y monitoreo               │
└────────────────────────┘  └──────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICIO: agent-langgraph  (Python + LangGraph)                   │
│  - Expone endpoint HTTP para procesar mensajes                      │
│  - Orquesta el flujo conversacional por nodos                       │
│  - Nodos: detect_intent -> slot_check -> generate_response ->       │
│           fallback | handoff | respond                              │
│  - Conecta con Groq API (LLM)                                       │
│  - Reporta trazas a LangSmith                                       │
│  Puerto: 8000                                                        │
└─────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICIO: frontend  (Next.js — Deploy: Vercel)                     │
│  - Lista de leads con estado y datos clave                          │
│  - Historial de conversación por lead                               │
│  - Envío de mensajes manuales por el asesor humano                  │
│  - Indicador visual de handoff pendiente                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo de un Mensaje Entrante

```
Lead escribe por WhatsApp
  -> WPPConnect captura el mensaje
  -> POST /webhook/message al backend-api
  -> backend-api persiste mensaje (tabla messages)
  -> backend-api llama a agent-langgraph con historial + slots actuales
  -> LangGraph ejecuta grafo: detect_intent -> slot_check -> respond/fallback/handoff
  -> LangGraph retorna texto de respuesta + slots actualizados + nuevo estado del lead
  -> backend-api actualiza lead en DB (slots + estado)
  -> backend-api llama WPPConnect para enviar respuesta
  -> backend-api registra evento en LangSmith
  -> Frontend refleja cambios (polling o WebSocket)
```

---

## 3. API — Especificación de Endpoints

### Base URLs
- **Backend API (público)**: `https://[railway-domain]/api/v1`
- **Agent LangGraph (interno)**: `http://agent-langgraph:8000`

---

### 3.1 Webhook — Mensajes Entrantes de WhatsApp

#### `POST /webhook/message`

Recibe mensajes entrantes de WPPConnect. Uso exclusivo del servicio WPPConnect.

**Request Body:**
```json
{
  "id": "msg_abc123",
  "from": "573001234567@c.us",
  "to": "573009876543@c.us",
  "body": "Hola, estoy interesado en un apartamento",
  "type": "chat",
  "timestamp": 1710700000,
  "isGroupMsg": false
}
```

**Response 200:**
```json
{ "status": "received", "messageId": "msg_abc123" }
```

**Response 400:**
```json
{ "error": "Invalid payload", "details": "Missing field: from" }
```

---

### 3.2 Leads

#### `GET /leads`

Lista todos los leads con información básica y estado actual.

**Query Params:**

| Parámetro | Tipo   | Descripción                                                            |
|-----------|--------|------------------------------------------------------------------------|
| status    | string | Filtrar por: `new`, `qualifying`, `hot`, `handoff`, `paused`, `closed` |
| page      | number | Paginación (default: 1)                                                |
| limit     | number | Items por página (default: 20, max: 100)                               |

**Response 200:**
```json
{
  "data": [
    {
      "id": "lead_001",
      "phone": "573001234567",
      "name": "Carlos Mendoza",
      "status": "hot",
      "interestLevel": 4,
      "propertyType": "apartamento",
      "city": "Medellín",
      "budget": "300000000",
      "intent": "comprar",
      "isHandoffRequested": false,
      "lastMessageAt": "2026-03-17T14:30:00Z",
      "createdAt": "2026-03-17T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### `GET /leads/:id`

Detalle completo de un lead incluyendo todos los slots.

**Response 200:**
```json
{
  "id": "lead_001",
  "phone": "573001234567",
  "name": "Carlos Mendoza",
  "status": "hot",
  "interestLevel": 4,
  "isHandoffRequested": true,
  "handoffAt": "2026-03-17T14:35:00Z",
  "handoffReason": "high_interest",
  "assignedTo": null,
  "agentNotes": null,
  "slots": {
    "propertyType": "apartamento",
    "city": "Medellín",
    "zone": "El Poblado",
    "budget": "300000000",
    "intent": "comprar",
    "bedrooms": "3",
    "urgency": "2 meses",
    "mainNeed": "cercania a colegios",
    "objections": ["presupuesto ajustado"]
  },
  "createdAt": "2026-03-17T10:00:00Z",
  "updatedAt": "2026-03-17T14:35:00Z"
}
```

---

#### `PATCH /leads/:id`

Actualiza campos del lead (notas, estado, slots) desde el panel del asesor.

**Request Body:**
```json
{
  "status": "closed",
  "agentNotes": "Cerrado: compro apartamento en Laureles",
  "slots": {
    "budget": "280000000"
  }
}
```

**Response 200:**
```json
{ "id": "lead_001", "updated": true }
```

---

#### `GET /leads/:id/messages`

Historial completo de mensajes de una conversación.

**Response 200:**
```json
{
  "leadId": "lead_001",
  "messages": [
    {
      "id": "msg_001",
      "direction": "inbound",
      "body": "Hola, me interesa un apartamento",
      "timestamp": "2026-03-17T10:00:00Z",
      "senderType": "lead"
    },
    {
      "id": "msg_002",
      "direction": "outbound",
      "body": "Hola! Con gusto te ayudo. En que ciudad estas buscando?",
      "timestamp": "2026-03-17T10:00:05Z",
      "senderType": "agent"
    }
  ]
}
```

---

#### `POST /leads/:id/messages`

Envía un mensaje manual desde el panel del asesor humano.

**Request Body:**
```json
{
  "body": "Hola Carlos, soy Juan del equipo comercial. Podemos agendar una visita manana?",
  "senderType": "human"
}
```

**Response 200:**
```json
{ "messageId": "msg_099", "sent": true }
```

---

### 3.3 Handoff

#### `POST /leads/:id/handoff`

Marca manualmente un lead para handoff al equipo humano.

**Request Body:**
```json
{
  "reason": "Lead listo para agenda de visita",
  "assignedTo": "juan@empresa.com"
}
```

**Response 200:**
```json
{ "leadId": "lead_001", "handoff": true }
```

---

### 3.4 Agente (Endpoint Interno)

#### `POST /agent/process`  *(servicio agent-langgraph, puerto 8000 — no expuesto públicamente)*

Invocado por backend-api para procesar un mensaje con el grafo LangGraph.

**Request Body:**
```json
{
  "leadId": "lead_001",
  "phone": "573001234567",
  "message": "Tengo un presupuesto de 300 millones",
  "conversationHistory": [
    { "role": "user", "content": "Hola, me interesa un apartamento" },
    { "role": "assistant", "content": "Hola! En que ciudad estas buscando?" }
  ],
  "currentSlots": {
    "propertyType": "apartamento",
    "city": null,
    "budget": null
  },
  "leadStatus": "qualifying",
  "ambiguityCount": 0
}
```

**Response 200:**
```json
{
  "response": "Perfecto, 300 millones es un buen presupuesto para Medellin! Estas pensando en comprar o arrendar?",
  "updatedSlots": {
    "propertyType": "apartamento",
    "city": null,
    "budget": "300000000"
  },
  "newLeadStatus": "qualifying",
  "interestLevel": 2,
  "intent": "SLOT_INFO",
  "triggerHandoff": false,
  "isFallback": false,
  "confidence": 0.92
}
```

---

## 4. DB Schema — Prisma

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------------------------------------------------------------------
// LEAD
// Representa un prospecto unico identificado por su numero de WhatsApp.
// ---------------------------------------------------------------------
model Lead {
  id                 String     @id @default(cuid())
  phone              String     @unique          // "+573001234567" — identificador primario
  name               String?                    // Extraido del slot name durante la conversacion
  status             LeadStatus @default(NEW)
  interestLevel      Int?       @db.SmallInt    // 1-5 (1=frio, 5=muy caliente)
  isHandoffRequested Boolean    @default(false)
  handoffAt          DateTime?
  handoffReason      String?
  assignedTo         String?                    // Email del asesor humano asignado
  agentNotes         String?                    // Notas libres del asesor desde el panel
  ambiguityCount     Int        @default(0)     // Mensajes ambiguos consecutivos acumulados

  // ── SLOTS: informacion extraida por el agente ─────────────────────
  slotPropertyType   String?    // "casa", "apartamento", "lote", "oficina", "local", "otro"
  slotCity           String?    // Ciudad o zona principal
  slotZone           String?    // Barrio o zona especifica dentro de la ciudad
  slotBudget         String?    // Presupuesto en texto libre (ej. "300 millones")
  slotBudgetNumeric  BigInt?    // Presupuesto normalizado en pesos colombianos
  slotIntent         String?    // "comprar" | "arrendar"
  slotBedrooms       String?    // Numero de habitaciones o descripcion
  slotUrgency        String?    // Plazo o urgencia expresado por el lead
  slotMainNeed       String?    // Necesidad principal identificada
  slotObjections     String[]   // Lista de objeciones detectadas

  // ── Metadatos ─────────────────────────────────────────────────────
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  messages           Message[]

  @@index([status])
  @@index([createdAt])
  @@index([isHandoffRequested])
}

enum LeadStatus {
  NEW          // Primer contacto, sin calificacion aun
  QUALIFYING   // El agente esta recopilando informacion
  HOT          // Lead con alta intencion de compra/arriendo detectada
  HANDOFF      // Listo para asesor humano — agente deja de responder automaticamente
  PAUSED       // Lead que dejo de responder (sin actividad > 48 h)
  CLOSED       // Proceso comercial cerrado (ganado o perdido)
}

// ---------------------------------------------------------------------
// MESSAGE
// Registro inmutable de cada mensaje de la conversacion.
// ---------------------------------------------------------------------
model Message {
  id              String     @id @default(cuid())
  leadId          String
  lead            Lead       @relation(fields: [leadId], references: [id], onDelete: Cascade)
  wppMessageId    String?    @unique            // ID original de WPPConnect (idempotencia)
  direction       Direction                     // INBOUND | OUTBOUND
  senderType      SenderType                    // LEAD | AGENT | HUMAN
  body            String                        // Contenido del mensaje
  isAmbiguous     Boolean    @default(false)    // El agente marco este mensaje como ambiguo
  rawPayload      Json?                         // Payload raw de WPPConnect (para debugging)
  langsmithRunId  String?                       // Run ID de LangSmith para correlacion
  createdAt       DateTime   @default(now())

  @@index([leadId, createdAt])
  @@index([direction])
  @@index([wppMessageId])
}

enum Direction {
  INBOUND
  OUTBOUND
}

enum SenderType {
  LEAD    // Mensaje enviado por el prospecto
  AGENT   // Mensaje generado automaticamente por el agente LLM
  HUMAN   // Mensaje enviado manualmente por un asesor humano
}
```

### Notas sobre el Schema

- **Slots como columnas planas**: Los slots se almacenan como columnas individuales (no como JSON) para permitir filtros y ordenamientos eficientes desde el frontend.
- **Idempotencia**: `wppMessageId` tiene `@unique` para evitar duplicar mensajes si WPPConnect reenvía el webhook.
- **Trazabilidad**: `langsmithRunId` en cada mensaje permite cruzar conversaciones en DB con trazas en LangSmith Studio.
- **Contador de ambigüedad**: `ambiguityCount` en el Lead (no en el mensaje) se reinicia a 0 cuando el lead envía un mensaje claro.

---

## 5. Flujo de Conversación — Nodos LangGraph

### Grafo Principal: `real_estate_agent_graph`

```
[START]
   |
   v
[receive_message]          <- Prepara el estado inicial del grafo
   |
   v
[detect_intent]            <- Clasifica la intencion del mensaje
   |
   |--- intent: GREETING / PROPERTY_INQUIRY / SLOT_INFO / OBJECTION
   |                         -> [slot_check]
   |
   |--- intent: HANDOFF_REQUEST / HIGH_INTEREST
   |                         -> [handoff]
   |
   +--- intent: AMBIGUOUS / OFF_TOPIC / UNKNOWN
                            -> [fallback]

[slot_check]               <- Identifica que slots faltan y cuales actualizar
   |
   |--- slots incompletos  -> [generate_response]  (pregunta por siguiente slot)
   |
   +--- slots suficientes  -> [evaluate_lead]

[evaluate_lead]            <- Calcula nivel de interes y determina si hacer handoff
   |
   |--- interestLevel >= 4 -> [handoff]
   |
   +--- interestLevel < 4  -> [generate_response]  (continua calificando)

[fallback]                 <- Maneja mensajes ambiguos u off-topic
   |
   |--- ambiguityCount < 3 -> [generate_response]  (pide aclaracion amable)
   |
   +--- ambiguityCount >= 3 -> [handoff]           (escala a humano)

[handoff]                  <- Prepara transicion a asesor humano
   |
   +--------------------> [generate_response]  (mensaje de despedida + aviso)

[generate_response]        <- Genera el texto de respuesta con Groq LLM
   |
   +--------------------> [END]
```

---

### Descripción de Cada Nodo

#### `receive_message`
- **Entrada**: Mensaje raw + historial de conversación + slots actuales + estado del lead.
- **Salida**: Estado del grafo inicializado.
- **Lógica**: Normaliza el texto, descarta mensajes de grupos (`isGroupMsg: true`), carga contexto del lead.

---

#### `detect_intent`
- **Entrada**: Mensaje del lead + últimos 5 turnos del historial.
- **Salida**: `intent` clasificado + `confidence` (0–1).

| Intent               | Descripción                                               |
|----------------------|-----------------------------------------------------------|
| `GREETING`           | Saludo inicial sin información específica                 |
| `PROPERTY_INQUIRY`   | Pregunta sobre tipo de inmueble, zona o precio            |
| `SLOT_INFO`          | El lead proporciona datos sobre sus preferencias          |
| `OBJECTION`          | Expresa dudas, limitaciones de presupuesto o tiempo       |
| `HIGH_INTEREST`      | Señales claras de querer avanzar (visita, firma, reunión) |
| `HANDOFF_REQUEST`    | Pide hablar con una persona explícitamente                |
| `AMBIGUOUS`          | Mensaje poco claro o inentendible                         |
| `OFF_TOPIC`          | Tema completamente fuera del contexto inmobiliario        |

- Si `confidence < 0.6`, el nodo fuerza `intent: AMBIGUOUS`.

---

#### `slot_check`
- **Entrada**: Slots actuales + intent + mensaje del lead.
- **Salida**: Lista de slots faltantes, slots a actualizar, próximo slot prioritario.

**Prioridades de extracción de slots:**

| Slot            | Prioridad | Obligatorio MVP |
|-----------------|-----------|-----------------|
| `propertyType`  | P1        | Sí              |
| `intent`        | P1        | Sí              |
| `city`          | P2        | Sí              |
| `budget`        | P2        | Sí              |
| `name`          | P2        | Sí              |
| `bedrooms`      | P3        | Condicional     |
| `urgency`       | P3        | No              |
| `mainNeed`      | P4        | No              |

**Regla de overwrite**: Si el lead contradice un slot ya guardado, el agente sobreescribe el valor, confirma el cambio en la respuesta y registra el evento `lead.slot_overwritten`.

**Regla de no repetición**: El agente nunca vuelve a preguntar por un slot ya completado, salvo que el lead lo contradiga explícitamente.

---

#### `evaluate_lead`
- **Entrada**: Slots completos + historial completo.
- **Salida**: `interestLevel` (1–5) + `shouldHandoff` (booleano).
- **Criterios de puntuación**:
  - Completitud de slots obligatorios (+1 por cada slot completado de los 5 P1/P2).
  - Urgencia con plazo corto (menos de 1 mes: +2).
  - Señales de alta intención (visita, preaprobación, familia: +1 adicional).
  - `interestLevel >= 4` activa `shouldHandoff = true`.

---

#### `fallback`
- **Entrada**: Mensaje + `ambiguityCount` actual.
- **Salida**: Tipo de acción: `ASK_CLARIFICATION` o `ESCALATE_HANDOFF`.
- **Lógica**:
  - 1.ª y 2.ª ambigüedad → solicita aclaración natural.
  - 3.ª ambigüedad → escala a handoff con mensaje de cierre.
  - `ambiguityCount` se reinicia a 0 cuando llega un mensaje claro.
  - Mensajes `OFF_TOPIC` redirigen amablemente sin incrementar el contador.

---

#### `handoff`
- **Entrada**: Estado del lead + razón del handoff.
- **Salida**: Lead actualizado + mensaje de cierre para el lead.
- **Lógica**:
  - Actualiza en DB: `status = HANDOFF`, `isHandoffRequested = true`, `handoffAt = now()`.
  - Genera mensaje cálido para el lead ("Un asesor te contactará pronto").
  - El agente deja de responder automáticamente a leads en `HANDOFF`.

---

#### `generate_response`
- **Entrada**: Intent + slots + acción determinada + historial.
- **Salida**: Texto de respuesta para el lead.
- **Lógica**:
  - Usa Groq API (modelo configurable, default: `llama-3.1-8b-instant`).
  - System prompt con personalidad: natural, conversacional, comercial, inmobiliario colombiano.
  - Incluye resumen de slots conocidos para evitar repetir preguntas.
  - Incluye el próximo slot prioritario a preguntar.
  - Historial de los últimos 8 turnos para contexto.
  - Temperatura: 0.7 | Max tokens: 200 (respuestas concisas para WhatsApp).

---

### Estados del Lead y Transiciones

```
NEW -----------> QUALIFYING -----------> HOT -----------> HANDOFF
                      |                   |
                      +-------------------+
                                |
                                v
                             PAUSED
                                |
                                v
                             CLOSED
```

| Transición              | Condición de Disparo                                        |
|-------------------------|-------------------------------------------------------------|
| `NEW -> QUALIFYING`     | Primer mensaje procesado por el agente                      |
| `QUALIFYING -> HOT`     | `interestLevel >= 4` en `evaluate_lead`                     |
| `HOT -> HANDOFF`        | `shouldHandoff = true` o solicitud explícita del lead       |
| `QUALIFYING -> HANDOFF` | 3 mensajes ambiguos consecutivos o solicitud explícita      |
| `ANY -> PAUSED`         | Sin actividad del lead por más de 48 horas                  |
| `PAUSED -> QUALIFYING`  | Lead retoma la conversación                                 |
| `ANY -> CLOSED`         | Marcado manualmente por el asesor desde el panel            |

---

## 6. Eventos a Loggear — Trazabilidad con LangSmith

### Estrategia de Logging

Cada procesamiento de mensaje genera:
1. Una **traza en LangSmith** con el grafo LangGraph completo (nodos, inputs/outputs, latencias, tokens).
2. Un **evento de aplicación** en el servidor para auditoría.
3. El `langsmithRunId` se guarda en el registro de `Message` en DB para correlación cruzada.

---

### Catálogo de Eventos (JSON)

#### Mensaje Recibido
```json
{
  "event": "message.received",
  "timestamp": "2026-03-17T14:30:00.123Z",
  "leadId": "lead_001",
  "phone": "573001234567",
  "messageId": "msg_099",
  "wppMessageId": "3EB0ABC123",
  "bodyPreview": "Hola, estoy buscando un apartamento de 3 habitaciones"
}
```

#### Intención Detectada
```json
{
  "event": "agent.intent_detected",
  "timestamp": "2026-03-17T14:30:00.456Z",
  "leadId": "lead_001",
  "messageId": "msg_099",
  "intent": "SLOT_INFO",
  "confidence": 0.91,
  "langsmithRunId": "run_lngs_abc123",
  "nodeLatencyMs": 312
}
```

#### Slots Actualizados
```json
{
  "event": "lead.slots_updated",
  "timestamp": "2026-03-17T14:30:00.700Z",
  "leadId": "lead_001",
  "changedSlots": {
    "bedrooms": { "prev": null, "new": "3" },
    "propertyType": { "prev": null, "new": "apartamento" }
  },
  "slotsOverwritten": false
}
```

#### Slot Sobreescrito (Overwrite)
```json
{
  "event": "lead.slot_overwritten",
  "timestamp": "2026-03-17T14:35:00.100Z",
  "leadId": "lead_001",
  "slot": "city",
  "prevValue": "Medellin",
  "newValue": "Bogota",
  "triggerMessage": "Ah no, mejor busco en Bogota"
}
```

#### Mensaje Ambiguo Detectado
```json
{
  "event": "agent.ambiguous_message",
  "timestamp": "2026-03-17T14:40:00.000Z",
  "leadId": "lead_001",
  "messageId": "msg_110",
  "ambiguityCount": 2,
  "rawMessage": "si, lo que le dije antes",
  "fallbackAction": "ASK_CLARIFICATION"
}
```

#### Evaluación de Lead
```json
{
  "event": "lead.evaluated",
  "timestamp": "2026-03-17T14:42:00.000Z",
  "leadId": "lead_001",
  "interestLevel": 4,
  "slotsCompleted": ["propertyType", "city", "budget", "intent", "name"],
  "slotsMissing": ["urgency", "mainNeed"],
  "shouldHandoff": true
}
```

#### Handoff Iniciado
```json
{
  "event": "lead.handoff",
  "timestamp": "2026-03-17T14:42:05.000Z",
  "leadId": "lead_001",
  "phone": "573001234567",
  "reason": "high_interest",
  "triggeredBy": "agent",
  "slots": {
    "name": "Carlos Mendoza",
    "propertyType": "apartamento",
    "city": "Medellin",
    "budget": "300000000",
    "intent": "comprar",
    "bedrooms": "3"
  },
  "interestLevel": 4
}
```

#### Respuesta Enviada (Agente)
```json
{
  "event": "message.sent",
  "timestamp": "2026-03-17T14:42:06.000Z",
  "leadId": "lead_001",
  "messageId": "msg_111",
  "senderType": "AGENT",
  "bodyPreview": "Perfecto Carlos! Un asesor de nuestro equipo...",
  "totalLatencyMs": 1843,
  "tokensUsed": 87
}
```

#### Respuesta Manual (Asesor Humano)
```json
{
  "event": "message.sent",
  "timestamp": "2026-03-17T15:00:00.000Z",
  "leadId": "lead_001",
  "messageId": "msg_120",
  "senderType": "HUMAN",
  "sentBy": "juan@empresa.com",
  "bodyPreview": "Hola Carlos, soy Juan del equipo comercial..."
}
```

#### Error del Agente
```json
{
  "event": "agent.error",
  "timestamp": "2026-03-17T14:50:00.000Z",
  "leadId": "lead_001",
  "messageId": "msg_115",
  "errorType": "llm_timeout",
  "errorMessage": "Groq API request timed out after 10000ms",
  "fallbackTriggered": true,
  "langsmithRunId": "run_lngs_xyz789"
}
```

---

## 7. Dockerfiles y docker-compose

### Estructura de Directorios

```
whatsapp-sales-agent/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── services/
│   ├── backend-api/
│   │   └── Dockerfile
│   ├── agent-langgraph/
│   │   └── Dockerfile
│   └── frontend/
│       └── Dockerfile
```

---

### `services/backend-api/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# Etapa 1: Dependencias de produccion
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Etapa 2: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 3: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
RUN npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

---

### `services/agent-langgraph/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### `services/frontend/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# Etapa 1: Dependencias
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Etapa 2: Build Next.js
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etapa 3: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

### `docker-compose.yml` (Producción / Railway)

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  wppconnect:
    image: wppconnect/wppconnect-server:latest
    restart: unless-stopped
    ports:
      - "21465:21465"
    environment:
      - WPPCONNECT_SECRET_KEY=${WPPCONNECT_SECRET_KEY}
      - WEBHOOK_URL=http://backend-api:3001/webhook/message
    volumes:
      - wppconnect_tokens:/app/tokens
      - wppconnect_userdata:/app/userDataDir
    networks:
      - internal
      - external

  agent-langgraph:
    build:
      context: ./services/agent-langgraph
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - LANGCHAIN_API_KEY=${LANGCHAIN_API_KEY}
      - LANGCHAIN_TRACING_V2=true
      - LANGCHAIN_PROJECT=${LANGSMITH_PROJECT}
    networks:
      - internal
    depends_on:
      postgres:
        condition: service_healthy

  backend-api:
    build:
      context: ./services/backend-api
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - WPPCONNECT_URL=http://wppconnect:21465
      - WPPCONNECT_SECRET_KEY=${WPPCONNECT_SECRET_KEY}
      - AGENT_URL=http://agent-langgraph:8000
      - LANGCHAIN_API_KEY=${LANGCHAIN_API_KEY}
      - LANGSMITH_PROJECT=${LANGSMITH_PROJECT}
    networks:
      - internal
      - external
    depends_on:
      postgres:
        condition: service_healthy
      agent-langgraph:
        condition: service_started

  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    networks:
      - external

volumes:
  postgres_data:
  wppconnect_tokens:
  wppconnect_userdata:

networks:
  internal:
    driver: bridge
  external:
    driver: bridge
```

---

### `docker-compose.dev.yml` (Desarrollo Local — Override)

```yaml
version: "3.9"

services:
  postgres:
    ports:
      - "5432:5432"

  backend-api:
    volumes:
      - ./services/backend-api:/app
      - /app/node_modules
    command: npm run dev
    environment:
      - NODE_ENV=development

  agent-langgraph:
    volumes:
      - ./services/agent-langgraph:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    volumes:
      - ./services/frontend:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev
    environment:
      - NODE_ENV=development
```

---

### `.env.example`

```env
# PostgreSQL
POSTGRES_USER=realestate_user
POSTGRES_PASSWORD=changeme_strong_password
POSTGRES_DB=realestate_db

# WPPConnect
WPPCONNECT_SECRET_KEY=your_secret_key_here

# Groq API (https://console.groq.com)
GROQ_API_KEY=gsk_your_groq_api_key_here

# LangSmith (https://smith.langchain.com)
LANGCHAIN_API_KEY=ls__your_langsmith_key_here
LANGSMITH_PROJECT=whatsapp-sales-agent

# Frontend (URL del backend desplegado en Railway)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1
```

---

## 8. Estrategia de Ramas Git

### Convención de Nombres

```
<tipo>/<descripcion-en-kebab-case>
```

| Tipo       | Uso                                                          |
|------------|--------------------------------------------------------------|
| `feature`  | Nueva funcionalidad                                          |
| `fix`      | Corrección de bug o comportamiento incorrecto                |
| `chore`    | Configuración, infraestructura, CI/CD, sin lógica de negocio |
| `docs`     | Documentación únicamente                                     |
| `refactor` | Reestructuración sin cambio de comportamiento externo        |

---

### Mapa de Ramas del Proyecto

| Rama                               | Prioridad | Descripción                                                    |
|------------------------------------|-----------|----------------------------------------------------------------|
| `main`                             | —         | Producción estable. Solo recibe merges desde `develop`.        |
| `develop`                          | —         | Integración continua. Todas las features hacen PR aquí.        |
| `chore/docker-setup`               | P0        | docker-compose, Dockerfiles, .env.example                      |
| `chore/db-schema`                  | P0        | Prisma schema inicial y migraciones base                       |
| `feature/whatsapp-integration`     | P1        | WPPConnect server + webhook handler en backend-api             |
| `feature/lead-qualification`       | P1        | Agente LangGraph completo: grafo, slots, evaluación            |
| `feature/handoff-system`           | P1        | Estados de lead, lógica de handoff, pausa de respuesta         |
| `feature/human-like-responses`     | P2        | Refinamiento de prompts, manejo de objeciones, tono natural    |
| `feature/leads-interface`          | P2        | Frontend Next.js: lista, historial y respuesta manual          |
| `feature/langsmith-observability`  | P3        | Integración LangSmith, eventos de log, correlación DB          |
| `fix/message-context-bug`          | Ad hoc    | Corrección de pérdida de contexto conversacional               |
| `fix/lead-parser-error`            | Ad hoc    | Corrección de errores en extracción de slots                   |

---

### Flujo de Trabajo Git

```
develop <-------------------------------------------------------------- main
   |                                                                      ^
   +-- chore/docker-setup          --> PR review --> merge develop        |
   +-- chore/db-schema             --> PR review --> merge develop        |
   +-- feature/whatsapp-integration --> PR review --> merge develop       |
   +-- feature/lead-qualification  --> PR review --> merge develop        |
   +-- feature/leads-interface     --> PR review --> merge develop        |
   +-- ...                                                                |
                                          Release PR: develop --> main ---+
```

**Reglas:**
1. Nunca commitear directamente a `main` ni a `develop`.
2. Cada PR a `develop` debe incluir descripción de cambios y cómo probar.
3. Los commits siguen Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
4. Los PRs requieren al menos una revisión antes de merge.
5. `main` solo recibe merges de `develop` cuando hay una versión demo-lista y estable.

---

### Convención de Commits

```
<tipo>(<scope>): <descripcion corta en infinitivo>

[cuerpo opcional: contexto del cambio]

[footer: referencias a issues si aplica]
```

**Ejemplos:**
```
feat(whatsapp): configure WPPConnect webhook receiver
feat(agent): implement detect_intent node with Groq classification
feat(leads): add slot overwrite logic with event logging
fix(agent): prevent repeated slot questions on context reload
fix(parser): handle null budget slot when lead provides range text
chore(docker): add multi-stage Dockerfile for backend-api
chore(db): add initial Prisma schema with Lead and Message models
```

---

## 9. Checklist de Demo E2E

### Prerequisitos

- [ ] `docker-compose up` ejecuta sin errores desde cero.
- [ ] WPPConnect muestra QR y se escanea exitosamente con número de prueba.
- [ ] PostgreSQL responde y migraciones Prisma están aplicadas.
- [ ] LangSmith Studio muestra el proyecto activo y recibiendo trazas.
- [ ] Variables de entorno correctamente configuradas en `.env`.

### Flujo 1 — Primer Contacto y Calificación

- [ ] Lead escribe "Hola" → agente responde con saludo natural en menos de 5 segundos.
- [ ] Lead menciona tipo de inmueble → slot `propertyType` guardado, agente no vuelve a preguntar.
- [ ] Lead dice ciudad → slot `city` guardado en DB.
- [ ] Lead da presupuesto → slot `budget` guardado en DB.
- [ ] Lead cambia de ciudad → slot `city` sobreescrito, agente confirma el cambio.
- [ ] En el panel web, el lead aparece con `status: QUALIFYING` y los slots visibles.

### Flujo 2 — Tono y Naturalidad

- [ ] Las respuestas del agente suenan conversacionales, no robóticas.
- [ ] El agente no repite preguntas ya respondidas en la misma sesión.
- [ ] Agente maneja "no tengo mucho presupuesto" con respuesta comercial apropiada.
- [ ] Agente maneja "lo pienso y te escribo" sin insistir agresivamente.

### Flujo 3 — Detección de Alta Intención y Handoff

- [ ] Lead indica urgencia alta + presupuesto confirmado → `interestLevel >= 4` en DB.
- [ ] Agente envía mensaje de handoff cálido al lead.
- [ ] Lead aparece en panel con `status: HANDOFF` e indicador visual destacado.
- [ ] Agente NO responde mensajes adicionales del lead en estado HANDOFF.

### Flujo 4 — Mensajes Ambiguos

- [ ] Mensaje incomprensible 1 → agente pide aclaración amablemente.
- [ ] Mensaje incomprensible 2 → agente intenta de nuevo.
- [ ] Mensaje incomprensible 3 → agente escala a handoff.
- [ ] Evento `agent.ambiguous_message` con `ambiguityCount: 3` visible en logs.

### Flujo 5 — Respuesta Manual del Asesor

- [ ] Asesor selecciona lead en HANDOFF desde el panel.
- [ ] Asesor escribe y envía mensaje manual.
- [ ] Lead recibe el mensaje en WhatsApp desde el mismo número.
- [ ] En historial del lead, el mensaje aparece con senderType `HUMAN` diferenciado visualmente.

### Flujo 6 — Observabilidad LangSmith

- [ ] En LangSmith Studio, cada mensaje procesado tiene una traza con todos los nodos.
- [ ] La traza muestra latencia por nodo y tokens consumidos.
- [ ] El `langsmithRunId` en tabla `messages` coincide con la traza en LangSmith.

### Flujo 7 — Despliegue

- [ ] Backend accesible en URL pública de Railway.
- [ ] Frontend accesible en URL de Vercel.
- [ ] WPPConnect mantiene sesión activa tras reinicio del contenedor.
- [ ] Frontend conecta correctamente con el backend en Railway.
- [ ] Todo el sistema corre usando únicamente planes gratuitos.

---

## 10. User Scenarios & Testing

### User Story 1 — Atención Inicial Automatizada (P1)

Un prospecto escribe por primera vez al WhatsApp de la empresa. El agente responde de inmediato con un tono natural y conversacional, inicia la calificación y extrae los primeros slots sin que el lead sienta que habla con un bot.

**Why this priority**: Sin esto, el sistema no tiene valor. Es el punto de entrada de todos los flujos.

**Independent Test**: Enviar un mensaje desde un número de prueba y verificar que el agente responde en menos de 5 segundos y el lead aparece en DB con `status: QUALIFYING`.

**Acceptance Scenarios**:

1. **Given** un lead escribe "Hola" por primera vez, **When** el mensaje llega al sistema, **Then** el agente responde con saludo natural en menos de 5 segundos y el lead queda registrado en DB con `status: QUALIFYING`.
2. **Given** un lead menciona que busca un apartamento de 3 habitaciones en Medellín, **When** el agente procesa el mensaje, **Then** los slots `propertyType`, `bedrooms` y `city` quedan guardados en DB y el agente no vuelve a preguntar por ellos.
3. **Given** un lead proporciona presupuesto en lenguaje natural ("unos 300 palos"), **When** el agente procesa, **Then** `slotBudget` se guarda como texto y `slotBudgetNumeric` se normaliza a `300000000`.

---

### User Story 2 — Calificación Completa y Handoff Automático (P1)

Después de varios turnos de conversación, el lead ha proporcionado la información clave y muestra alta intención. El agente detecta esto, actualiza el estado y envía el mensaje de cierre para el seguimiento humano.

**Why this priority**: El handoff al equipo humano es el objetivo comercial principal del sistema.

**Independent Test**: Simular 5–6 mensajes cubriendo slots obligatorios + expresar urgencia alta → verificar `status: HANDOFF`, `interestLevel >= 4` e `isHandoffRequested: true` en DB.

**Acceptance Scenarios**:

1. **Given** el lead ha completado slots obligatorios y expresa urgencia alta, **When** el agente evalúa, **Then** `interestLevel` es 4 o 5 y envía mensaje de cierre de handoff.
2. **Given** el lead está en estado HANDOFF, **When** escribe un nuevo mensaje, **Then** el agente NO responde automáticamente.
3. **Given** el lead pide explícitamente hablar con una persona, **When** el agente procesa el mensaje, **Then** el lead pasa inmediatamente a `status: HANDOFF` independientemente del `interestLevel`.

---

### User Story 3 — Gestión desde el Panel Web (P2)

El asesor comercial abre la interfaz, ve todos los leads con su estado y prioridad, revisa el historial de un lead en HANDOFF y envía un mensaje de seguimiento personalizado.

**Why this priority**: Sin el panel, el equipo no tiene visibilidad ni puede actuar sobre los leads calificados.

**Independent Test**: Desde el panel, abrir un lead en HANDOFF, enviar mensaje manual y verificar que el lead lo recibe en WhatsApp y el historial del panel se actualiza.

**Acceptance Scenarios**:

1. **Given** existen 10 leads en distintos estados, **When** el asesor abre el panel, **Then** ve todos los leads con nombre, estado, nivel de interés y último mensaje ordenados.
2. **Given** el asesor selecciona un lead, **When** ve el historial, **Then** los mensajes están ordenados cronológicamente y se distinguen visualmente los mensajes del lead, del agente y del humano.
3. **Given** el asesor escribe un mensaje desde el panel, **When** hace clic en enviar, **Then** el lead recibe el mensaje en WhatsApp en menos de 3 segundos.

---

### User Story 4 — Manejo de Mensajes Ambiguos (P2)

El lead envía mensajes poco claros. El agente los maneja de forma natural sin romper la conversación, y escala a handoff después de 3 ambigüedades consecutivas.

**Why this priority**: Sin este manejo, el agente falla ante inputs inesperados y rompe la experiencia del lead.

**Independent Test**: Enviar 3 mensajes consecutivos incomprensibles → verificar que el lead pasa a HANDOFF y el evento con `ambiguityCount: 3` aparece en los logs.

**Acceptance Scenarios**:

1. **Given** el lead envía texto incomprensible, **When** el agente procesa, **Then** responde con una solicitud de aclaración natural (no un error genérico).
2. **Given** el lead ha enviado 2 mensajes ambiguos consecutivos, **When** envía un tercero ambiguo, **Then** el agente cierra con mensaje de handoff y el lead pasa a `status: HANDOFF`.
3. **Given** el lead envía un mensaje off-topic (ej. pregunta sobre el clima), **When** el agente procesa, **Then** redirige amablemente al contexto inmobiliario sin contar como ambigüedad.

---

### Edge Cases

- ¿Qué pasa si WPPConnect cae? Los mensajes durante la caída se pierden. El sistema retoma al reconectarse.
- ¿Qué pasa si Groq API devuelve error o timeout? El agente responde con un mensaje de fallback predefinido y registra el evento `agent.error`.
- ¿Qué pasa si el mismo lead escribe de nuevo después de HANDOFF? El mensaje queda registrado en DB pero el agente no responde automáticamente; el asesor lo ve en el panel.
- ¿Qué pasa si el lead contradice un slot? El slot se sobreescribe y se registra el evento `lead.slot_overwritten`.
- ¿Qué pasa si el lead envía una imagen o audio? El agente responde que solo puede procesar texto en este momento.
- ¿Qué pasa si llegan múltiples mensajes rápidos del mismo lead? El sistema los procesa en orden por `leadId` (cola por lead).
- ¿Qué pasa con mensajes de grupos de WhatsApp? Se ignoran (`isGroupMsg: true` → descartado en `receive_message`).
- ¿Qué pasa si el mismo `wppMessageId` llega dos veces? El sistema lo ignora por la restricción `@unique` en DB (idempotencia garantizada).

---

## 11. Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE recibir y procesar mensajes de WhatsApp de leads en menos de 5 segundos.
- **FR-002**: El sistema DEBE responder automáticamente a leads en estado `NEW`, `QUALIFYING` y `HOT`.
- **FR-003**: El sistema DEBE extraer y persistir los 9 slots definidos cuando el lead los proporcione en la conversación.
- **FR-004**: El sistema DEBE detectar y sobreescribir slots cuando el lead proporcione información que contradiga un slot ya guardado.
- **FR-005**: El sistema DEBE calcular `interestLevel` (1–5) después de cada turno de conversación.
- **FR-006**: El sistema DEBE transicionar automáticamente un lead a `status: HANDOFF` cuando `interestLevel >= 4`.
- **FR-007**: El sistema DEBE detener las respuestas automáticas a leads en estado `HANDOFF`.
- **FR-008**: El sistema DEBE manejar mensajes ambiguos sin errores, escalando a HANDOFF tras 3 ambigüedades consecutivas.
- **FR-009**: El sistema DEBE ignorar mensajes de grupos de WhatsApp (`isGroupMsg: true`).
- **FR-010**: El sistema DEBE garantizar idempotencia: un mismo `wppMessageId` no puede procesarse dos veces.
- **FR-011**: Los asesores DEBEN poder enviar mensajes manuales a cualquier lead desde el panel web.
- **FR-012**: El sistema DEBE registrar un evento de log JSON para cada acción relevante del agente.
- **FR-013**: Cada procesamiento de mensaje DEBE generar una traza en LangSmith con todos los nodos ejecutados.
- **FR-014**: El panel web DEBE mostrar todos los leads con slots, estado e historial de conversación.
- **FR-015**: El sistema DEBE manejar mensajes de voz e imagen con un mensaje de fallback textual predefinido.

### Key Entities

- **Lead**: Prospecto único identificado por número de WhatsApp. Contiene estado de calificación, todos los slots extraídos y metadata de handoff.
- **Message**: Registro inmutable de cada mensaje de la conversación, con dirección, tipo de remitente y correlación con LangSmith.
- **Slot**: Fragmento de información extraído del lead (propertyType, city, budget, etc.). Almacenado como columnas del Lead para consultas eficientes.
- **ConversationState**: Estado en memoria del grafo LangGraph para una sesión activa. Incluye historial (últimos 8 turnos), slots actuales y contadores de ambigüedad.

---

## 12. Success Criteria

### Measurable Outcomes

- **SC-001**: El agente responde a mensajes de leads en menos de 5 segundos el 95% de las veces bajo carga normal.
- **SC-002**: El 80% de los leads que interactúan más de 3 turnos tienen al menos 4 de los 5 slots obligatorios completados.
- **SC-003**: Los leads con alta intención son detectados y marcados para handoff sin ninguna intervención humana.
- **SC-004**: El panel web carga la lista de leads en menos de 2 segundos con hasta 100 leads activos.
- **SC-005**: Un asesor puede enviar un mensaje manual y el lead lo recibe en WhatsApp en menos de 3 segundos.
- **SC-006**: El 100% de las conversaciones procesadas tienen una traza visible en LangSmith Studio.
- **SC-007**: El sistema maneja el 100% de los mensajes ambiguos sin errores no manejados ni caídas del servicio.
- **SC-008**: El sistema completo puede desplegarse desde cero con `docker-compose up` en menos de 5 minutos.
- **SC-009**: Backend en Railway y frontend en Vercel están operativos usando únicamente planes gratuitos.
- **SC-010**: El historial de commits muestra uso de ramas `feature/*`, `fix/*` y `chore/*` para cada funcionalidad diferenciada.

---

## Assumptions

1. **Número de WhatsApp**: La empresa dispone de un número de WhatsApp Business para conectar via WPPConnect (escaneando QR).
2. **Volumen MVP**: El sistema está dimensionado para hasta ~50 leads activos simultáneos (plan gratuito Railway).
3. **Idioma**: El agente opera en español colombiano por defecto. Sin soporte multiidioma en MVP.
4. **Autenticación del panel**: El panel web MVP usa credenciales simples (usuario/contraseña en `.env`) sin gestión de roles.
5. **Notificaciones de handoff**: En MVP la notificación al equipo es visual en el panel (indicador). Sin integración de email o Slack.
6. **Modelo LLM**: Se usa `llama-3.1-8b-instant` de Groq como modelo por defecto, configurable vía variable de entorno.
7. **Persistencia de sesión WPPConnect**: Los tokens de sesión se persisten en volumen Docker. Si se pierden, se re-escanea el QR.
8. **Moneda**: Presupuesto en pesos colombianos (COP) por defecto.
9. **Zona horaria**: Los timestamps del panel se muestran en UTC-5 (Colombia).
10. **Cola de mensajes**: En MVP no hay cola de mensajes (RabbitMQ/Redis); el procesamiento secuencial por `leadId` se maneja con un lock simple en memoria del backend-api.

---

## 13. Gap Closure — Auditoría Post-Implementación (2026-03-18)

> Esta sección formaliza los hallazgos de la auditoría técnica realizada el 2026-03-18 contra la Historia de Usuario original. El núcleo funcional del sistema está implementado al 100%. Los gaps identificados son exclusivamente de **despliegue, convención y arquitectura de arranque**. Las tareas de cierre se detallan en `tasks.md` Phase 8.

---

### 13.1 Estado de Cumplimiento por Criterio de Aceptación

| Criterio HU | Descripción | Estado | Gap |
|---|---|---|---|
| Criterio 1 | Conexión WhatsApp — recibe y responde | ✅ COMPLETO | — |
| Criterio 2 | Continuidad conversacional — no repite preguntas | ✅ COMPLETO | — |
| Criterio 3 | Tono humano — suena como persona real | ✅ COMPLETO | — |
| Criterio 4 | Calificación del lead — extrae y almacena slots | ✅ COMPLETO | — |
| Criterio 5 | Contexto inmobiliario — tipo, presupuesto, zona, finalidad | ✅ COMPLETO | — |
| Criterio 6 | Manejo de objeciones — 5 tipos cubiertos | ✅ COMPLETO | — |
| Criterio 7 | Detección de interés — interest_level >= 4 → handoff | ✅ COMPLETO | — |
| Criterio 8 | Visualización básica — panel web con leads y conversaciones | ✅ COMPLETO | — |
| Criterio 9 | Despliegue Railway/Vercel — backend y frontend en producción | ❌ FALTANTE | Sin railway.toml ni vercel.json |
| Criterio 10 | Buenas prácticas Git — ramas `feature/*`, `fix/*` | ⚠️ PARCIAL | Se usó `feat/*` en lugar de `feature/*` |
| Criterio 11 | Arquitectura escalable — modular y mantenible | ✅ COMPLETO | Fix menor: BigInt, entrypoint |

---

### 13.2 Gap 1 — Convención de Ramas Git

**Problema detectado:** El repositorio usa el prefijo `feat/` en lugar del prefijo `feature/` especificado en la Historia de Usuario. Las ramas existentes afectadas son:

| Rama actual (incorrecta) | Rama correcta según HU |
|---|---|
| `feat/agent-langgraph` | `feature/lead-qualification` |
| `feat/backend-api` | `feature/whatsapp-integration` |
| `feat/database-schema` | (migrada a `chore/db-schema` — correcto) |
| `feat/frontend-dashboard` | `feature/leads-interface` |

**Adicionalmente:** No existe ninguna rama `fix/*` en el historial, lo que impide evidenciar el manejo de correcciones en ramas separadas (requerimiento explícito de la HU).

**Resolución:**
- Crear ramas `feature/*` con la convención exacta a partir de este punto. Las ramas `feat/*` existentes se conservan como historial; los nuevos desarrollos parten de ramas con nombre correcto.
- Crear al menos dos ramas `fix/*` para correcciones concretas (ver Gap 4 y 5), generando así el historial de `fix/*` que el evaluador buscará.

**Ramas nuevas requeridas:**

```
feature/deployment-config       ← railway.toml, vercel.json, README.md
fix/startup-migrations          ← entrypoint Prisma + BigInt serialization
fix/wppconnect-railway-limits   ← documentación de limitaciones y workaround
docs/env-setup                  ← .env.example completo y documentado
```

---

### 13.3 Gap 2 — Configuración de Despliegue Railway

**Problema detectado:** No existe `railway.toml` ni ningún manifiesto de Railway en el repositorio. El Criterio 9 es bloqueante para la entrega.

**Decisión de arquitectura:** Dado que WPPConnect requiere 512MB–1.5GB RAM (Puppeteer/Chromium) y Railway plan gratuito otorga 512MB por servicio, **WPPConnect no puede correr en Railway**. La arquitectura de despliegue se ajusta así:

| Servicio | Plataforma | Notas |
|---|---|---|
| `backend-api` + `agent-langgraph` | Railway (contenedor `combined`) | Fusionados con supervisord. ~$8-12/mes |
| `postgresql` | Railway Plugin | PostgreSQL managed, incluido en Hobby plan |
| `wppconnect` | Fly.io free tier o VPS externo | Railway no soporta la RAM necesaria |
| `frontend` | Vercel Hobby | Deploy directo sin Docker |

**Archivos a crear:**

```
railway.toml                              ← Root: apunta al servicio combined
services/combined/railway.toml            ← Configuración del combined container
```

**Especificación de `railway.toml` (root):**

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "services/combined/Dockerfile"

[deploy]
startCommand = "supervisord -c /etc/supervisord.conf"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[environments.production.variables]
PORT = "3001"
NODE_ENV = "production"
```

**Endpoint de health check requerido:** `GET /health` en `backend-api` que retorna `{ status: "ok", version: "1.0.0", timestamp: ISO8601 }` con HTTP 200. Railway lo usa para determinar si el deploy fue exitoso.

---

### 13.4 Gap 3 — Configuración de Despliegue Vercel

**Problema detectado:** El `Dockerfile` del frontend usa `output: "standalone"` de Next.js, que genera un servidor Node.js autónomo. Este modo es correcto para Docker/Railway pero **innecesario en Vercel**, que hace build directo del framework.

**Para Vercel, `output: "standalone"` debe estar ausente o condicional.**

**Archivos a crear/modificar:**

```
vercel.json                               ← Root del repo
services/frontend/next.config.js          ← Condicionar output:standalone
```

**Especificación de `vercel.json`:**

```json
{
  "framework": "nextjs",
  "buildCommand": "cd services/frontend && npm run build",
  "outputDirectory": "services/frontend/.next",
  "installCommand": "cd services/frontend && npm ci",
  "devCommand": "cd services/frontend && npm run dev",
  "env": {
    "BACKEND_API_URL": "@backend_api_url",
    "INTERNAL_API_KEY": "@internal_api_key",
    "NEXT_PUBLIC_API_URL": "@next_public_api_url"
  }
}
```

**Modificación de `next.config.js`:**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone' solo cuando se construye para Docker/Railway
  // En Vercel, la plataforma gestiona el output directamente
  ...(process.env.BUILD_TARGET === 'docker' && { output: 'standalone' }),
};

module.exports = nextConfig;
```

**Procedimiento de secrets en Vercel:**
- Definir en Vercel Dashboard → Project → Settings → Environment Variables:
  - `BACKEND_API_URL` = URL pública del backend Railway
  - `INTERNAL_API_KEY` = clave interna compartida
  - `NEXT_PUBLIC_API_URL` = URL pública de la API del backend

---

### 13.5 Gap 4 — Fix de Arquitectura: Entrypoint y Prisma Migrations

**Problema detectado:** El `Dockerfile` del backend actualmente instalado en el repositorio usa `CMD ["npm", "run", "start"]` sin ejecutar `npx prisma migrate deploy` antes. En un deploy fresco en Railway, la base de datos no tendrá las tablas y el servicio fallará en runtime.

**El spec en Sección 7 ya especifica el CMD correcto:**
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

**Pero el Dockerfile actual en el repositorio no lo implementa.** Este es el fix de la rama `fix/startup-migrations`.

**Verificación:** Al hacer `docker compose up` desde cero (sin volumen previo), el backend debe:
1. Esperar a que PostgreSQL esté healthy (ya implementado con `depends_on`).
2. Ejecutar `npx prisma migrate deploy` antes de arrancar Express.
3. Arrancar Express exitosamente en el puerto 3001.

---

### 13.6 Gap 5 — Fix de Arquitectura: BigInt Serialization

**Problema detectado:** El campo `slotBudgetNumeric` se almacena como `BigInt` en PostgreSQL (tipo `BIGINT`) y Prisma lo retorna como `BigInt` nativo de JavaScript. `JSON.stringify()` lanza `TypeError: Do not know how to serialize a BigInt` al serializar la respuesta de la API.

**Escenario de falla:** `GET /api/v1/leads` o `GET /api/v1/leads/:id` cuando `slotBudgetNumeric` tiene valor → respuesta 500.

**Fix requerido en `services/backend-api/src/index.ts`:**

```typescript
// Patch global para serialización BigInt en JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
```

**Alternativa más explícita** (preferida para código claro):

```typescript
// En cada route que retorne leads, transformar antes de res.json():
function serializeLead(lead: Lead) {
  return {
    ...lead,
    slotBudgetNumeric: lead.slotBudgetNumeric?.toString() ?? null,
  };
}
```

**Rama:** `fix/startup-migrations` (agrupa ambos fixes de startup).

---

### 13.7 Gap 6 — Documentación de Variables de Entorno y README

**Problema detectado:** El `.env.example` existente en el spec (Sección 7) lista las variables sin instrucciones de obtención. El repositorio carece de `README.md` en el root con instrucciones de setup, lo cual es requerimiento explícito de la HU ("instrucciones claras para replicar el entorno").

**`.env.example` requerido** — Variables faltantes que deben añadirse:

| Variable | Descripción | Cómo obtener |
|---|---|---|
| `POSTGRES_USER` | Usuario PostgreSQL | Definir libremente |
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL | Generar contraseña segura |
| `POSTGRES_DB` | Nombre de la DB | Definir libremente |
| `WPPCONNECT_SECRET_KEY` | Clave secreta de WPPConnect | Generar UUID o string aleatorio |
| `WPPCONNECT_SESSION` | Nombre de la sesión WPP | Definir libremente (ej: `mi-empresa`) |
| `GROQ_API_KEY` | API key de Groq | https://console.groq.com → API Keys |
| `LANGCHAIN_API_KEY` | API key de LangSmith | https://smith.langchain.com → Settings → API Keys |
| `LANGSMITH_PROJECT` | Nombre del proyecto en LangSmith | Crear proyecto en LangSmith Studio |
| `INTERNAL_API_KEY` | Clave interna frontend↔backend | Generar UUID (ej: `openssl rand -hex 32`) |
| `BACKEND_API_URL` | URL del backend (server-side Next.js) | `http://localhost:3001` en local; URL Railway en prod |
| `NEXT_PUBLIC_API_URL` | URL del backend (client-side Next.js) | Igual que BACKEND_API_URL para local |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | Construida de las variables POSTGRES_* |

**`README.md` requerido** — Secciones mínimas:

```
# WhatsApp Sales Agent
## Arquitectura (diagrama ASCII)
## Stack tecnológico
## Prerequisitos (Docker, Node.js 20, Python 3.11)
## Setup local (paso a paso con docker-compose)
## Variables de entorno (referencia a .env.example)
## Cómo escanear el QR de WhatsApp
## Despliegue en Railway (pasos exactos)
## Despliegue en Vercel (pasos exactos)
## Acceso al panel web
## LangSmith Studio — cómo ver las trazas
```

---

### 13.8 Riesgos de Despliegue — Registro Formal

Los siguientes riesgos identificados en la auditoría se registran formalmente para que sean tenidos en cuenta en el despliegue:

| ID | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R-001 | WPPConnect excede RAM de Railway plan gratuito (512MB) | ALTO | Desplegar WPPConnect en Fly.io free tier (256MB disponibles — suficiente para sesión estable) |
| R-002 | Pérdida de sesión WhatsApp en cada restart de Railway | ALTO | Usar volumen persistente de Railway (disponible en Hobby plan); documentar proceso de re-escaneo de QR |
| R-003 | Crédito mensual Railway agotado por múltiples servicios | MEDIO | Fusión backend+agent en contenedor combined (ya en plan); PostgreSQL como plugin Railway (sin cargo adicional) |
| R-004 | Timeout de agente (15s) demasiado corto en horas pico de Groq | MEDIO | Incrementar `AGENT_HTTP_TIMEOUT` a 25s; implementar mensaje de "procesando..." al lead si supera 10s |
| R-005 | Frontend Vercel timeout 10s en serverless functions (Route Handlers) | BAJO | Los Route Handlers solo son proxy liviano (<200ms); el agente no es invocado desde Vercel |

---

### 13.9 Criterios de Aceptación para el Gap Closure

Antes de considerar el sistema listo para entrega, verificar:

- [X] **GAP-1**: Existe al menos una rama `feature/*` y dos ramas `fix/*` en el historial del repositorio (`feature/deployment-config`, `fix/startup-migrations`, `fix/wppconnect-railway-limits`).
- [X] **GAP-2**: `railway.toml` existe en el root apuntando a `services/combined/Dockerfile`. Healthcheck configurado en `/health` (público, antes de authMiddleware). Response: `{ status, version, timestamp }`.
- [X] **GAP-3**: `vercel.json` existe en el root con framework nextjs y env vars por referencia. `next.config.js` activa `output:standalone` solo con `BUILD_TARGET=docker`.
- [X] **GAP-4**: `services/backend-api/entrypoint.sh` ejecuta `npx prisma migrate deploy` con check de exit code antes de `node dist/index.js`. Dockerfile usa el entrypoint como CMD. Prisma CLI disponible en runtime via reinstall post-prune.
- [X] **GAP-5**: `BigInt.prototype.toJSON` patch implementado al inicio de `index.ts` (antes de cualquier import de Prisma). `slotBudgetNumeric` se serializa como string en JSON.
- [X] **GAP-6**: `README.md` en root con arquitectura ASCII, stack table, setup local paso a paso, guías de despliegue Railway/Fly.io/Vercel, y referencia a `.env.example` completo.
