# REST API Contract: Backend API

**Branch**: `001-whatsapp-sales-agent`
**Date**: 2026-03-18
**Base URL**: `https://[railway-domain]/api/v1`
**Auth**: `x-internal-key: {INTERNAL_API_KEY}` en headers (para llamadas desde Next.js Route Handlers)

---

## Convenciones

- Todos los endpoints retornan `Content-Type: application/json`.
- Los errores siguen el formato: `{ "error": string, "details"?: string }`.
- Los timestamps son ISO 8601 UTC.
- La paginación usa `{ data: T[], pagination: { total, page, limit, totalPages } }`.

---

## Webhook

### `POST /api/v1/webhook/message`

Recibe mensajes entrantes de WPPConnect. Solo accesible desde la red interna (WPPConnect → backend-api).

**Request:**
```json
{
  "event": "onmessage",
  "session": "string",
  "id": "string",
  "from": "string (e.g. 573001234567@c.us)",
  "to": "string",
  "body": "string",
  "type": "chat | image | video | document | ptt | sticker",
  "timestamp": "number (unix)",
  "fromMe": "boolean",
  "isGroup": "boolean",
  "hasMedia": "boolean"
}
```

**Lógica de procesamiento:**
1. Si `isGroup: true` o `fromMe: true` → retorna 200 inmediatamente (ignorar).
2. Si `type !== "chat"` → retorna respuesta de fallback textual.
3. Verificar idempotencia por `id` (wppMessageId).
4. Crear o recuperar Lead por `from`.
5. Invocar agente Python.
6. Persiste mensaje y actualiza Lead.
7. Envía respuesta via WPPConnect.

**Response 200:**
```json
{ "status": "received", "messageId": "string" }
```

**Response 400:**
```json
{ "error": "Invalid payload", "details": "Missing field: from" }
```

---

## Leads

### `GET /api/v1/leads`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `string` | — | Filtrar por LeadStatus |
| `page` | `number` | `1` | Página |
| `limit` | `number` | `20` | Max: 100 |
| `sort` | `string` | `createdAt_desc` | `createdAt_asc`, `interestLevel_desc` |

**Response 200:**
```json
{
  "data": [{
    "id": "string",
    "phone": "string",
    "name": "string | null",
    "status": "new | qualifying | hot | handoff | paused | closed",
    "interestLevel": "number | null",
    "slotPropertyType": "string | null",
    "slotCity": "string | null",
    "slotBudget": "string | null",
    "slotIntent": "string | null",
    "isHandoffRequested": "boolean",
    "lastMessageAt": "ISO8601 | null",
    "createdAt": "ISO8601"
  }],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number",
    "totalPages": "number"
  }
}
```

---

### `GET /api/v1/leads/:id`

**Response 200:**
```json
{
  "id": "string",
  "phone": "string",
  "name": "string | null",
  "status": "string",
  "interestLevel": "number | null",
  "isHandoffRequested": "boolean",
  "handoffAt": "ISO8601 | null",
  "handoffReason": "string | null",
  "assignedTo": "string | null",
  "agentNotes": "string | null",
  "ambiguityCount": "number",
  "slots": {
    "propertyType": "string | null",
    "city": "string | null",
    "zone": "string | null",
    "budget": "string | null",
    "budgetNumeric": "number | null",
    "intent": "string | null",
    "bedrooms": "string | null",
    "urgency": "string | null",
    "mainNeed": "string | null",
    "objections": "string[]"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Response 404:**
```json
{ "error": "Lead not found" }
```

---

### `PATCH /api/v1/leads/:id`

Actualización parcial del lead (desde el panel del asesor).

**Request body** (todos los campos son opcionales):
```json
{
  "status": "qualifying | hot | handoff | paused | closed",
  "agentNotes": "string",
  "assignedTo": "string (email)",
  "slots": {
    "propertyType": "string",
    "city": "string",
    "budget": "string"
  }
}
```

**Restricción**: No se puede cambiar a `status: new` desde el panel (solo el agente puede asignar NEW).

**Response 200:**
```json
{ "id": "string", "updated": true }
```

**Response 400:**
```json
{ "error": "Invalid status transition", "details": "Cannot set status to 'new' manually" }
```

---

### `GET /api/v1/leads/:id/messages`

**Query params:**

| Param | Type | Default |
|-------|------|---------|
| `page` | `number` | `1` |
| `limit` | `number` | `50` |

**Response 200:**
```json
{
  "leadId": "string",
  "messages": [{
    "id": "string",
    "direction": "inbound | outbound",
    "senderType": "lead | agent | human",
    "body": "string",
    "isAmbiguous": "boolean",
    "langsmithRunId": "string | null",
    "createdAt": "ISO8601"
  }],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number",
    "totalPages": "number"
  }
}
```

---

### `POST /api/v1/leads/:id/messages`

Envía un mensaje manual desde el panel del asesor.

**Request body:**
```json
{
  "body": "string (required, max 4096 chars)",
  "senderType": "human"
}
```

**Precondición**: El agente automático NO se invoca cuando `senderType: "human"`. El mensaje se persiste con `senderType: HUMAN` y se envía directamente via WPPConnect.

**Response 200:**
```json
{ "messageId": "string", "sent": true }
```

**Response 422:**
```json
{ "error": "Cannot send message", "details": "WPPConnect session not active" }
```

---

### `POST /api/v1/leads/:id/handoff`

Handoff manual desde el panel.

**Request body:**
```json
{
  "reason": "string (opcional)",
  "assignedTo": "string (email, opcional)"
}
```

**Response 200:**
```json
{ "leadId": "string", "handoff": true }
```

**Response 409:**
```json
{ "error": "Lead already in handoff state" }
```

---

## Agent (Interno — no expuesto públicamente)

### `POST /agent/process` *(Puerto 8000, solo accesible vía localhost)*

**Request body:**
```json
{
  "leadId": "string",
  "phone": "string",
  "message": "string",
  "leadStatus": "new | qualifying | hot | handoff"
}
```

**Nota**: No se pasa `conversationHistory` ni `currentSlots` en el body — `AsyncPostgresSaver` los carga automáticamente por `thread_id = phone`.

**Response 200:**
```json
{
  "response": "string (texto a enviar al lead)",
  "updatedSlots": {
    "propertyType": "string | null",
    "city": "string | null",
    "budget": "string | null",
    "budgetNumeric": "number | null",
    "intent": "string | null",
    "bedrooms": "string | null",
    "urgency": "string | null",
    "mainNeed": "string | null",
    "name": "string | null",
    "objections": "string[]"
  },
  "newLeadStatus": "string",
  "interestLevel": "number (1-5)",
  "intent": "string",
  "triggerHandoff": "boolean",
  "handoffReason": "string | null",
  "isFallback": "boolean",
  "ambiguityCount": "number",
  "langsmithRunId": "string"
}
```

**Response 503:**
```json
{ "error": "LLM unavailable", "details": "Groq API timeout" }
```

---

## Errores HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request — payload inválido |
| 404 | Not Found |
| 409 | Conflict — estado inválido para la operación |
| 422 | Unprocessable Entity — lógica de negocio rechaza la operación |
| 500 | Internal Server Error |
| 503 | Service Unavailable — agente Python o WPPConnect no disponibles |
