# Research: Agente de Ventas Inmobiliarias en WhatsApp

**Branch**: `001-whatsapp-sales-agent`
**Date**: 2026-03-18
**Phase**: 0 — Research & Decision Log

---

## Resumen de Decisiones Clave

| # | Decisión | Justificación |
|---|----------|---------------|
| R-001 | **Merged service**: Node.js API + Python LangGraph en un solo contenedor Railway | Railway free tier: 4 servicios independientes costarían ~$18-26/mes vs $5 de crédito incluido |
| R-002 | **AsyncPostgresSaver** para checkpointing de LangGraph | Persistencia de estado entre requests, usa mismo PostgreSQL, sobrevive reinicios |
| R-003 | **Dos modelos Groq**: `llama-3.1-8b-instant` (clasificación) + `llama-3.3-70b-versatile` (respuestas) | 8b rápido para clasificación estructurada; 70b para tono humano en respuestas |
| R-004 | **SWR con polling** (refreshInterval: 4000ms) para actualizaciones del frontend | Más simple que SSE/WebSocket, compatible con Vercel Hobby timeout, no requiere infraestructura extra |
| R-005 | **Tailwind CSS + shadcn/ui** para el frontend | Sin bundle overhead, compatible con App Router, componentes copiados al proyecto |
| R-006 | **WPPConnect como servicio Railway separado** (siempre activo) | No puede tolerar cold starts: pierde sesión WhatsApp y requiere re-escanear QR |
| R-007 | **Route Handlers de Next.js** como proxy al backend Railway | Oculta URL y credenciales del backend, elimina problemas de CORS |
| R-008 | **`thread_id = sender_phone`** para aislamiento de conversaciones en LangGraph | Identificador único natural por lead, compatible con AsyncPostgresSaver |

---

## R-001 — Arquitectura de Servicios en Railway Free Tier

**Problema**: El spec original definía 4 servicios independientes (backend-api Node.js, agent-langgraph Python, WPPConnect, PostgreSQL). En Railway Hobby plan ($5/mes de crédito), cada servicio con 512 MB RAM consume ~$5-7/mes, resultando en un costo total de ~$18-26/mes.

**Investigación**:
- Railway Hobby plan: $5/mes incluido, servicios facturados por consumo (CPU + RAM)
- Sin límite en número de servicios, pero todos comparten el crédito de $5
- PostgreSQL plugin: ~$1-2/mes para < 1 GB de datos
- WPPConnect: DEBE estar siempre activo (mantiene sesión WhatsApp Web)
- Node.js + Python pueden coexistir en un solo contenedor usando `supervisord`

**Decisión**: Fusionar Node.js backend-api y Python agent-langgraph en un solo contenedor Railway usando `supervisord` como process manager.

```
Railway (Hobby ~$8-12/mes total):
  Service 1: wppconnect         (siempre activo, ~$5-7/mes)
  Service 2: backend + agent    (Node.js puerto 3001 + Python puerto 8000, ~$5-7/mes)
  Service 3: PostgreSQL plugin  (~$1-2/mes)

Vercel (Hobby - gratis):
  Next.js frontend
```

**Impacto en el proyecto**:
- El Dockerfile del servicio combinado usa imagen base Node.js, instala Python en el mismo layer.
- `supervisord` arranca ambos procesos al iniciar el contenedor.
- La comunicación Node.js ↔ Python sigue siendo HTTP local (localhost:8000), igual que estaba diseñado.
- Reduce servicios de 4 a 3, bajando el costo estimado de ~$20/mes a ~$8-12/mes.

**Alternativa rechazada**: Separar en 4 contenedores Railway — costo impractical en free tier.

---

## R-002 — LangGraph: Persistencia de Estado con AsyncPostgresSaver

**Problema**: Cada mensaje de WhatsApp llega como un request HTTP independiente. LangGraph necesita recordar el historial de conversación y los slots extraídos entre requests.

**Investigación**:

| Opción | Viabilidad |
|--------|-----------|
| `MemorySaver` (in-process) | Solo para dev/tests — se pierde al reiniciar el contenedor |
| `SqliteSaver` | Single-process, no seguro para múltiples workers |
| `AsyncPostgresSaver` | **Recomendado** — misma DB PostgreSQL de Railway, multiprocess-safe, sobrevive reinicios |
| Pasar historial completo en cada request | Anti-patrón — cliente gestiona estado, payloads grandes |

**Decisión**: `AsyncPostgresSaver` conectado al mismo PostgreSQL de Railway.

```python
# Patrón de uso
async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
    graph = workflow.compile(checkpointer=checkpointer)
    # Al startup (una vez):
    await checkpointer.setup()  # Crea tablas de checkpoint en PostgreSQL

# Por cada mensaje entrante:
config = {
    "configurable": {"thread_id": sender_phone},  # ej: "573001234567"
    "metadata": {"channel": "whatsapp", "leadId": lead_id}
}
result = await graph.ainvoke(
    {"messages": [HumanMessage(content=message_text)]},
    config=config
)
```

**Clave**: Solo se pasa el mensaje nuevo en cada `ainvoke`. LangGraph carga automáticamente el estado anterior del checkpointer y lo fusiona via el reducer `add_messages`.

**Impacto**: Las tablas de checkpoint se crean en el mismo PostgreSQL. No se necesita Redis ni memoria externa adicional.

---

## R-003 — Modelos Groq: Estrategia de Dos Modelos

**Problema**: Un único modelo Groq debe balancear velocidad (para clasificación rápida por cada mensaje) y calidad (para respuestas que suenen humanas).

**Investigación**:

| Modelo | Velocidad | Contexto | Mejor Para |
|--------|-----------|----------|------------|
| `llama-3.1-8b-instant` | ~800 tok/s | 128k | Clasificación, extracción estructurada JSON |
| `llama-3.3-70b-versatile` | ~200 tok/s | 128k | Respuestas conversacionales naturales |
| `mixtral-8x7b-32768` | ~500 tok/s | 32k | Descartado — Llama 3.x lo supera en todos los aspectos |

**Decisión**: Estrategia de dos modelos por turno.

```python
from langchain_groq import ChatGroq

# Nodos: detect_intent, slot_check, evaluate_lead
classifier_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)

# Nodo: generate_response
responder_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)
```

- `classifier_llm` siempre corre (intent + slots), usa `with_structured_output` para JSON forzado.
- `responder_llm` corre solo cuando se necesita generar respuesta conversacional.
- Temperatura 0 en clasificador (determinismo), 0.7 en responder (naturalidad).

**Alternativa rechazada**: Un solo modelo 70b para todo — latencia excesiva (~3-5s) para clasificación simple.

---

## R-004 — WPPConnect: Integración con Backend Node.js

**Fuente**: Análisis del código fuente de `wppconnect-team/wppconnect-server`.

### Payload de Webhook (Mensaje Entrante)

```typescript
// POST {webhook_url} con event: "onmessage"
{
  event: "onmessage",
  session: "SESSION_NAME",
  id: "message_id_string",        // ID único del mensaje
  from: "573001234567@c.us",       // Número del lead
  to: "573009876543@c.us",         // Número del agente
  body: "Hola, busco apartamento", // Contenido del mensaje
  type: "chat",                    // "chat" | "image" | "video" | "document" | "ptt"
  timestamp: 1710700000,           // Unix timestamp
  fromMe: false,
  isGroup: false,
  hasMedia: false
}
```

Filtros aplicados en el backend:
- `isGroup: true` → descartar
- `fromMe: true` → descartar (mensajes enviados por nosotros mismos)
- `type !== "chat"` → respuesta de fallback textual
- `event !== "onmessage"` → descartar

### Envío de Mensajes Salientes

```
POST /api/{SESSION_NAME}/send-message
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "573001234567",
  "message": "Texto de respuesta"
}
```

### Autenticación

WPPConnect usa un sistema de tokens basado en bcrypt:
- `secretKey` configurado en `config.ts` (montado como volumen Docker)
- Token = `bcrypt.hash(sessionName + secretKey)`
- Header: `Authorization: Bearer {base64_encoded_bcrypt_token}`
- El token se genera una vez vía `POST /api/{session}/{secretKey}/generate-token`

### Persistencia de Sesión (Volúmenes Docker Requeridos)

```yaml
volumes:
  - ./config.ts:/usr/src/wpp-server/config.ts      # REQUERIDO: configuración
  - wppconnect_tokens:/usr/src/wpp-server/tokens    # REQUERIDO: tokens de sesión
  - wppconnect_userdata:/usr/src/wpp-server/userDataDir  # REQUERIDO: perfil Chromium
```

Sin estos volúmenes, cada reinicio del contenedor requiere re-escanear el QR.

### Variables de Configuración (`config.ts`)

WPPConnect NO usa `.env` para configuración — usa un archivo `config.ts` montado como volumen. Las variables de entorno que sí acepta son: `PORT` y credenciales de AWS S3 (no relevantes aquí).

```typescript
// config.ts (montado en el contenedor)
export default {
  secretKey: process.env.WPPCONNECT_SECRET_KEY || 'your_key_here',
  port: '21465',
  webhook: {
    url: process.env.WEBHOOK_URL,     // URL del backend
    readMessage: true,
    listenAcks: true,
    ignore: ['status@broadcast'],
    allUnreadOnStart: false,
  }
}
```

**Nota importante**: La `config.ts` de WPPConnect debe ser generada dinámicamente al build usando variables de entorno de Railway. Se resuelve con un entrypoint script que genera el archivo antes de arrancar WPPConnect.

---

## R-005 — Frontend Next.js: Actualización en Tiempo Real

**Problema**: El panel de leads necesita actualizaciones near-real-time desde un REST API externo en Railway.

**Decisión**: SWR con `refreshInterval: 4000` (polling cada 4 segundos).

**Justificación**:
- WebSocket no es compatible con Vercel Hobby (requiere servidor persistente)
- SSE via Route Handler tiene el límite de 10s de Vercel Hobby en funciones serverless
- SWR polling es suficiente para un panel operativo (no se requiere <1s de latencia)
- Zero infraestructura adicional

```typescript
// Lista de leads — se actualiza cada 4 segundos
const { data: leads } = useSWR('/api/leads', fetcher, { refreshInterval: 4000 })

// Conversación activa — actualización más frecuente
const { data: messages } = useSWR(
  `/api/leads/${leadId}/messages`,
  fetcher,
  { refreshInterval: 2000 }
)
```

**Llamadas al backend via Route Handlers** (proxy en Next.js para ocultar URL de Railway):
```typescript
// app/api/leads/route.ts (server-side, invisible al cliente)
const res = await fetch(`${process.env.BACKEND_API_URL}/leads`, {
  headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }
})
```

---

## R-006 — Frontend: Stack UI

**Decisión**: Tailwind CSS + shadcn/ui

**Componentes shadcn/ui usados**:
- `Table` — lista de leads
- `Badge` — estado del lead (NEW, QUALIFYING, HOT, HANDOFF, CLOSED)
- `Sheet` — panel lateral de conversación
- `ScrollArea` — historial de mensajes con scroll controlado
- `Textarea` + `Button` — formulario de respuesta manual
- `Dialog` — confirmaciones

**Alternativas rechazadas**:
- MUI: bundle grande (~90kB gzipped), requiere `use client` wrappers extensivos
- Chakra UI: menos components data-dense, no tan optimizado para App Router

---

## R-007 — LangGraph: AgentState TypedDict

**Decisión final** para el estado del grafo:

```python
class LeadSlots(TypedDict):
    name: Optional[str]
    city: Optional[str]
    zone: Optional[str]
    property_type: Optional[str]    # "casa"|"apartamento"|"lote"|"oficina"|"local"|"otro"
    budget: Optional[str]           # texto libre del lead
    budget_numeric: Optional[int]   # normalizado en COP
    intent: Optional[str]           # "comprar" | "arrendar"
    bedrooms: Optional[str]
    urgency: Optional[str]
    main_need: Optional[str]
    objections: Optional[list[str]]

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]  # add_messages reducer
    slots: LeadSlots
    lead_status: Literal["new", "qualifying", "hot", "handoff", "paused", "closed"]
    ambiguity_counter: int
    last_intent: Optional[str]
    needs_handoff: bool
    lead_id: str                    # ID en PostgreSQL para actualizaciones de DB
    interest_level: int             # 1-5
```

**Clave**: Solo `messages` usa reducer (`add_messages`). Todos los demás campos son last-write-wins.

---

## Impacto en el Spec Original

| Cambio | Sección del Spec Afectada | Tipo |
|--------|--------------------------|------|
| Servicios backend+agent fusionados | Sec. 2 (Diagrama), Sec. 7 (Docker) | Arquitectónico |
| `AsyncPostgresSaver` en lugar de estado stateless | Sec. 4 (DB Schema) — tablas de checkpoint adicionales | Aditivo |
| Dos modelos Groq (8b + 70b) en lugar de uno | Sec. 5 (Nodos LangGraph) | Refinamiento |
| WPPConnect config via `config.ts` generada dinámicamente | Sec. 7 (Docker) | Operacional |
| Frontend usa SWR polling (no WebSocket) | Sec. 2, Sec. 9 (E2E checklist) | Refinamiento |
| Route Handlers como proxy al backend | Sec. 3 (API) | Adición |
