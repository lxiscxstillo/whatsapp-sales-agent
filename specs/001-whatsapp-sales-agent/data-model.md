# Data Model: Agente de Ventas Inmobiliarias en WhatsApp

**Branch**: `001-whatsapp-sales-agent`
**Date**: 2026-03-18
**Phase**: 1 — Design

---

## Entidades del Dominio

### 1. Lead

Representa un prospecto inmobiliario único, identificado por su número de WhatsApp.

**Campos:**

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | `String (cuid)` | No | Identificador interno |
| `phone` | `String (unique)` | No | Número WhatsApp normalizado (`573001234567`) |
| `name` | `String` | Sí | Nombre extraído por el agente |
| `status` | `LeadStatus (enum)` | No | Estado actual en el pipeline |
| `interestLevel` | `Int (1–5)` | Sí | Calculado por el agente en cada turno |
| `isHandoffRequested` | `Boolean` | No | True cuando el agente o el lead pide atención humana |
| `handoffAt` | `DateTime` | Sí | Timestamp del handoff |
| `handoffReason` | `String` | Sí | `"high_interest"` / `"explicit_request"` / `"max_ambiguity"` |
| `assignedTo` | `String` | Sí | Email del asesor asignado manualmente |
| `agentNotes` | `String` | Sí | Notas libres del asesor desde el panel |
| `ambiguityCount` | `Int` | No | Contador de mensajes ambiguos consecutivos (reset a 0 con mensaje claro) |
| `slotPropertyType` | `String` | Sí | `"casa"` / `"apartamento"` / `"lote"` / `"oficina"` / `"local"` / `"otro"` |
| `slotCity` | `String` | Sí | Ciudad o zona principal de búsqueda |
| `slotZone` | `String` | Sí | Barrio o zona específica |
| `slotBudget` | `String` | Sí | Presupuesto en texto libre (ej. "300 millones") |
| `slotBudgetNumeric` | `BigInt` | Sí | Presupuesto normalizado en COP |
| `slotIntent` | `String` | Sí | `"comprar"` / `"arrendar"` |
| `slotBedrooms` | `String` | Sí | Número de habitaciones o descripción libre |
| `slotUrgency` | `String` | Sí | Plazo expresado por el lead |
| `slotMainNeed` | `String` | Sí | Necesidad principal identificada |
| `slotObjections` | `String[]` | No (array vacío) | Lista de objeciones detectadas |
| `createdAt` | `DateTime` | No | Auto-generado |
| `updatedAt` | `DateTime` | No | Auto-actualizado |

**Relaciones:**
- `Lead 1 → N Message`

**Validaciones:**
- `phone` debe ser un número de WhatsApp válido (formato `c.us`).
- `interestLevel` debe estar en rango 1–5 si se define.
- `ambiguityCount` nunca puede ser negativo.
- `slotIntent` solo acepta `"comprar"` o `"arrendar"`.

**Índices:**
- `status` — para filtrar por estado en el panel
- `createdAt` — para ordenar por fecha
- `isHandoffRequested` — para filtrar leads que requieren atención

---

### 2. Message

Registro **inmutable** de cada mensaje de la conversación. No se eliminan ni modifican después de creados.

**Campos:**

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | `String (cuid)` | No | Identificador interno |
| `leadId` | `String (FK)` | No | Referencia al Lead |
| `wppMessageId` | `String (unique)` | Sí | ID original de WPPConnect — garantiza idempotencia |
| `direction` | `Direction (enum)` | No | `INBOUND` / `OUTBOUND` |
| `senderType` | `SenderType (enum)` | No | `LEAD` / `AGENT` / `HUMAN` |
| `body` | `String` | No | Contenido del mensaje |
| `isAmbiguous` | `Boolean` | No | True si el agente clasificó este mensaje como ambiguo |
| `rawPayload` | `JSON` | Sí | Payload raw de WPPConnect (para debugging) |
| `langsmithRunId` | `String` | Sí | Run ID de LangSmith para correlación cruzada |
| `createdAt` | `DateTime` | No | Auto-generado (timestamp del mensaje) |

**Validaciones:**
- `body` no puede estar vacío.
- `direction: INBOUND` implica `senderType: LEAD`.
- `direction: OUTBOUND` implica `senderType: AGENT` o `senderType: HUMAN`.
- `wppMessageId` es único cuando definido (previene duplicados por re-entregas del webhook).

**Índices:**
- `(leadId, createdAt)` — para cargar historial ordenado
- `direction` — para filtrar mensajes entrantes/salientes
- `wppMessageId` — para verificar idempotencia rápidamente

---

### 3. AgentState (LangGraph — No persiste en tablas de negocio)

Estado en memoria del grafo LangGraph, persistido automáticamente por `AsyncPostgresSaver` en tablas internas de LangGraph (no tablas de negocio).

```python
class LeadSlots(TypedDict):
    name: Optional[str]
    city: Optional[str]
    zone: Optional[str]
    property_type: Optional[str]  # "casa"|"apartamento"|"lote"|"oficina"|"local"|"otro"
    budget: Optional[str]         # texto libre
    budget_numeric: Optional[int] # normalizado en COP
    intent: Optional[str]         # "comprar" | "arrendar"
    bedrooms: Optional[str]
    urgency: Optional[str]
    main_need: Optional[str]
    objections: Optional[list[str]]

class AgentState(TypedDict):
    # Historial de mensajes — reducer add_messages (siempre append, nunca reemplaza)
    messages: Annotated[list[BaseMessage], add_messages]

    # Slots extraídos del lead
    slots: LeadSlots

    # Estado del pipeline del lead
    lead_status: Literal["new", "qualifying", "hot", "handoff", "paused", "closed"]

    # Contador de ambigüedad — se reinicia en 0 con cada mensaje claro
    ambiguity_counter: int

    # Último intent clasificado (para routing y debugging)
    last_intent: Optional[str]

    # Flag para disparar el nodo handoff
    needs_handoff: bool

    # ID del lead en PostgreSQL (para actualizar slots/estado en DB)
    lead_id: str

    # Nivel de interés calculado (1–5)
    interest_level: int
```

**Notas de persistencia:**
- `thread_id = sender_phone` (ej: `"573001234567"`)
- `AsyncPostgresSaver` crea sus propias tablas en el mismo PostgreSQL (`checkpoints`, `checkpoint_writes`)
- No requiere tablas adicionales en el schema de negocio

---

## Enums

### `LeadStatus`

| Valor | Descripción |
|-------|-------------|
| `NEW` | Primer contacto, sin calificación |
| `QUALIFYING` | Agente recopilando información |
| `HOT` | Alta intención detectada (interestLevel >= 4) |
| `HANDOFF` | Asignado a asesor humano — sin respuestas automáticas |
| `PAUSED` | Sin actividad > 48h |
| `CLOSED` | Proceso cerrado (ganado o perdido) |

### `Direction`

| Valor | Descripción |
|-------|-------------|
| `INBOUND` | Mensaje del lead hacia el sistema |
| `OUTBOUND` | Mensaje del sistema hacia el lead |

### `SenderType`

| Valor | Descripción |
|-------|-------------|
| `LEAD` | Enviado por el prospecto |
| `AGENT` | Generado por el agente LLM |
| `HUMAN` | Enviado manualmente por un asesor humano |

---

## Transiciones de Estado del Lead

```
NEW
 └──> QUALIFYING    (primer mensaje procesado por el agente)
       ├──> HOT     (interestLevel >= 4)
       │     └──> HANDOFF  (shouldHandoff = true | solicitud explícita)
       └──> HANDOFF (3 mensajes ambiguos consecutivos | solicitud explícita)

Cualquier estado ──> PAUSED  (sin actividad > 48 horas)
PAUSED ──> QUALIFYING         (lead retoma la conversación)
Cualquier estado ──> CLOSED   (marcado manualmente por asesor)
```

**Reglas de negocio en transiciones:**
1. `HANDOFF` es un estado terminal para el agente automático. El agente NO genera respuestas para leads en HANDOFF.
2. Un asesor humano puede reabrir un lead cambiando su estado a `QUALIFYING` desde el panel.
3. `PAUSED` se establece via tarea programada (cron job), no por el agente.

---

## Reglas de Slot Management

### Regla de No-Repetición
El agente nunca vuelve a preguntar por un slot ya completado (valor no-null en `AgentState.slots`), a menos que el lead lo contradiga explícitamente.

### Regla de Overwrite
Si el lead proporciona información que contradice un slot existente:
1. El agente sobreescribe el slot con el nuevo valor.
2. El agente confirma el cambio en su respuesta.
3. Se emite el evento `lead.slot_overwritten` con `{ slot, prevValue, newValue }`.

### Prioridad de Llenado de Slots

| Prioridad | Slot | Condición |
|-----------|------|-----------|
| P1 | `property_type` | Siempre |
| P1 | `intent` | Siempre (comprar/arrendar) |
| P2 | `name` | Siempre |
| P2 | `city` | Siempre |
| P2 | `budget` | Siempre |
| P3 | `bedrooms` | Solo si `property_type` es casa/apartamento |
| P3 | `urgency` | Si el lead muestra alta intención |
| P4 | `zone` | Refinamiento post-city |
| P4 | `main_need` | Para personalizar respuestas |

### Normalización de Budget
- Input: `"300 millones"`, `"300M"`, `"trescientos millones"`, `"300.000.000"`
- `slotBudget`: texto original del lead
- `slotBudgetNumeric`: entero en COP (ej: `300000000`)
- Si el lead da rango: se usa el valor mínimo del rango como `slotBudgetNumeric`

---

## Diagrama Entidad-Relación

```
┌─────────────────────────────────────┐
│                LEAD                 │
├─────────────────────────────────────┤
│ id (PK)                             │
│ phone (UNIQUE)                      │
│ name                                │
│ status (enum)                       │
│ interestLevel                       │
│ isHandoffRequested                  │
│ handoffAt                           │
│ ambiguityCount                      │
│ slot_property_type                  │
│ slot_city                           │
│ slot_zone                           │
│ slot_budget                         │
│ slot_budget_numeric                 │
│ slot_intent                         │
│ slot_bedrooms                       │
│ slot_urgency                        │
│ slot_main_need                      │
│ slot_objections[]                   │
│ createdAt                           │
│ updatedAt                           │
└──────────────┬──────────────────────┘
               │ 1:N
               ▼
┌─────────────────────────────────────┐
│               MESSAGE               │
├─────────────────────────────────────┤
│ id (PK)                             │
│ leadId (FK → Lead.id)               │
│ wppMessageId (UNIQUE, nullable)     │
│ direction (enum)                    │
│ senderType (enum)                   │
│ body                                │
│ isAmbiguous                         │
│ rawPayload (JSON)                   │
│ langsmithRunId                      │
│ createdAt                           │
└─────────────────────────────────────┘

Tablas internas de LangGraph (AsyncPostgresSaver):
┌──────────────────┐  ┌─────────────────────────┐
│   checkpoints    │  │   checkpoint_writes     │
│ (thread_id,      │  │ (thread_id, checkpoint_ │
│  checkpoint_id,  │  │  id, task_id, idx,      │
│  metadata, ...)  │  │  channel, value, ...)   │
└──────────────────┘  └─────────────────────────┘
```
