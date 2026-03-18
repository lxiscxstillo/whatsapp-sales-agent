# WhatsApp Sales Agent — Agente Autónomo de Ventas Inmobiliarias

Agente conversacional de ventas inmobiliarias conectado a WhatsApp. Califica
prospectos de forma autónoma, extrae datos clave, detecta intención de compra
y escala al equipo humano cuando el lead está listo. Construido con LangGraph,
Groq, WPPConnect y Next.js.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     PLATAFORMA WHATSAPP                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ mensajes entrantes / salientes
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  wppconnect-server  (Fly.io)                                │
│  Puppeteer + Chromium headless — sesión WhatsApp Web        │
│  Puerto: 21465                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ webhook POST /api/v1/webhook/message
                           ▼
┌──────────────────────────────────────────────┐
│  combined container  (Railway)               │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  backend-api  (Node.js / Express)       │ │
│  │  - Recibe webhooks WPPConnect           │ │
│  │  - Persiste leads y mensajes (Prisma)   │ │
│  │  - Invoca agente LangGraph              │ │
│  │  - REST API para el frontend            │ │
│  │  Puerto: 3001                           │ │
│  └────────────────┬────────────────────────┘ │
│                   │ HTTP localhost:8000        │
│  ┌────────────────▼────────────────────────┐ │
│  │  agent-langgraph  (Python / FastAPI)    │ │
│  │  - LangGraph StateGraph (7 nodos)       │ │
│  │  - Groq LLM (llama-3.3-70b)            │ │
│  │  - LangSmith tracing                   │ │
│  │  - PostgreSQL checkpointer             │ │
│  │  Puerto: 8000 (interno)                │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────┘
                           │
              ┌────────────▼────────────┐
              │  PostgreSQL  (Railway)  │
              │  leads + messages       │
              │  + LangGraph state      │
              └─────────────────────────┘

┌──────────────────────────────────────────────┐
│  frontend  (Vercel)                          │
│  Next.js 14 App Router                       │
│  - Lista de leads con estado e interés       │
│  - Historial de conversación                 │
│  - Envío manual de mensajes                  │
│  - Botón de handoff                          │
└──────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Componente | Tecnología | Versión | Plataforma |
|---|---|---|---|
| Frontend | Next.js + React | 14 / 18 | Vercel |
| Backend API | Node.js + Express | 20 LTS | Railway |
| Agente LLM | Python + FastAPI | 3.11 | Railway |
| Orquestación | LangGraph | 0.2+ | — |
| Modelo LLM | Groq (llama-3.3-70b-versatile) | — | Groq API |
| Observabilidad | LangSmith Studio | — | LangSmith Cloud |
| WhatsApp | WPPConnect Server | latest | Fly.io |
| Base de datos | PostgreSQL + Prisma | 15 / 5.11 | Railway Plugin |
| Infraestructura | Docker + supervisord | — | Railway |

---

## Prerequisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Cuenta gratuita en [Groq](https://console.groq.com) — para obtener `GROQ_API_KEY`
- Cuenta gratuita en [LangSmith](https://smith.langchain.com) — para `LANGCHAIN_API_KEY`
- Un número de WhatsApp disponible para escanear el QR de WPPConnect
- (Producción) Cuenta en [Railway](https://railway.app) y [Vercel](https://vercel.com) y [Fly.io](https://fly.io)

---

## Setup Local

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_ORG/whatsapp-sales-agent.git
cd whatsapp-sales-agent
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y rellena:
- `GROQ_API_KEY` — obtenla en https://console.groq.com
- `LANGCHAIN_API_KEY` — obtenla en https://smith.langchain.com
- `WPPCONNECT_SECRET_KEY` — genera con `openssl rand -hex 24`
- `INTERNAL_API_KEY` — genera con `openssl rand -hex 32`

El resto de variables ya tienen valores válidos para local.

### 3. Levantar servicios con Docker Compose

```bash
# Producción local (todos los servicios)
docker compose up --build

# Desarrollo con hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Los servicios arrancados son:

| Servicio | URL local | Descripción |
|---|---|---|
| frontend | http://localhost:3000 | Panel web de leads |
| backend-api | http://localhost:3001 | REST API |
| backend-api health | http://localhost:3001/health | Healthcheck (sin auth) |
| agent-langgraph | http://localhost:8000 | Agente LangGraph (interno) |
| postgres | localhost:5432 | Base de datos |
| wppconnect | http://localhost:21465 | Gateway WhatsApp |

### 4. Escanear el QR de WhatsApp

```bash
# 1. Esperar a que WPPConnect esté listo (ver logs)
docker compose logs -f wppconnect

# 2. Abrir el panel de WPPConnect
open http://localhost:21465

# 3. Ir a "Start Session" y escanear el QR con WhatsApp en tu teléfono:
#    WhatsApp → Configuración → Dispositivos vinculados → Vincular dispositivo
```

### 5. Verificar que el sistema funciona

```bash
# Health check del backend
curl http://localhost:3001/health
# { "status": "ok", "version": "1.0.0", "timestamp": "..." }

# Listar leads (vacío inicialmente)
curl http://localhost:3001/api/v1/leads \
  -H "x-internal-key: dev_internal_key_change_in_prod"
# { "data": [], "total": 0 }

# Enviar un mensaje de prueba desde WhatsApp al número conectado
# → el agente debe responder en menos de 5 segundos
```

---

## Despliegue en Producción

### Backend en Railway

1. Crear cuenta en https://railway.app
2. Crear nuevo proyecto → "Deploy from GitHub repo"
3. Conectar este repositorio
4. Railway detecta `railway.toml` en el root y usa `services/combined/Dockerfile`
5. Añadir **PostgreSQL Plugin**: Railway Dashboard → tu proyecto → "+ New" → PostgreSQL
   - Railway inyecta `DATABASE_URL` automáticamente
6. Configurar variables de entorno en Railway Dashboard → Variables:

```
GROQ_API_KEY=gsk_...
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_TRACING_V2=true
LANGSMITH_PROJECT=whatsapp-sales-agent
WPPCONNECT_URL=https://wppconnect-sales-agent.fly.dev
WPPCONNECT_SECRET_KEY=tu_clave_wppconnect
WPPCONNECT_SESSION=tu-sesion
INTERNAL_API_KEY=tu_clave_interna
NODE_ENV=production
PYTHONUNBUFFERED=1
```

7. Railway hace deploy automáticamente. El healthcheck en `/health` confirma el arranque.
8. Tu backend estará disponible en: `https://TU-APP.railway.app`

### WPPConnect en Fly.io

WPPConnect **no puede correr en Railway** por limitaciones de RAM (Chromium requiere
512MB-1.5GB). Ver instrucciones completas en [`wppconnect-config/DEPLOYMENT.md`](./wppconnect-config/DEPLOYMENT.md).

```bash
# Resumen rápido:
cd wppconnect-config
fly launch --no-deploy --name wppconnect-sales-agent --region gru
# Editar fly.toml según DEPLOYMENT.md
fly volumes create wppconnect_tokens --size 1 --region gru
fly volumes create wppconnect_userdata --size 2 --region gru
fly secrets set WPPCONNECT_SECRET_KEY="tu_clave" WEBHOOK_URL="https://tu-app.railway.app/api/v1/webhook/message"
fly deploy
```

### Frontend en Vercel

1. Crear cuenta en https://vercel.com
2. "Add New Project" → importar este repositorio
3. Vercel detecta `vercel.json` en el root con la configuración de Next.js
4. Configurar variables de entorno en Vercel Dashboard → Project Settings → Environment Variables:

```
BACKEND_API_URL     = https://TU-APP.railway.app
INTERNAL_API_KEY    = tu_clave_interna  (misma que en Railway)
NEXT_PUBLIC_API_URL = https://TU-APP.railway.app/api/v1
```

5. Deploy → el frontend estará en `https://TU-APP.vercel.app`

---

## Variables de Entorno

Ver [`.env.example`](./.env.example) para la lista completa con descripción e instrucciones
de obtención de cada variable.

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | Cadena de conexión PostgreSQL |
| `GROQ_API_KEY` | ✅ | API key de Groq para el LLM |
| `LANGCHAIN_API_KEY` | ✅ | API key de LangSmith |
| `WPPCONNECT_SECRET_KEY` | ✅ | Clave WPPConnect |
| `INTERNAL_API_KEY` | ✅ | Clave compartida frontend↔backend |
| `WPPCONNECT_URL` | ✅ | URL del servidor WPPConnect |
| `WPPCONNECT_SESSION` | ✅ | Nombre de la sesión WhatsApp |
| `LANGSMITH_PROJECT` | ✅ | Nombre del proyecto en LangSmith |
| `NEXT_PUBLIC_API_URL` | ✅ | URL pública del backend (client-side) |
| `BACKEND_API_URL` | ✅ | URL del backend (server-side Next.js) |

---

## LangSmith Studio — Observabilidad

Cada mensaje procesado genera una traza en LangSmith con todos los nodos del grafo
LangGraph: `receive_message → detect_intent → slot_check → evaluate_lead →
generate_response / handoff / fallback`.

1. Ir a https://smith.langchain.com
2. Seleccionar el proyecto `whatsapp-sales-agent`
3. Ver trazas en tiempo real con latencia por nodo y tokens consumidos
4. El campo `langsmithRunId` en la tabla `messages` de la DB coincide con el ID de
   cada traza para correlación cruzada

---

## API Reference

Ver [`specs/001-whatsapp-sales-agent/contracts/rest-api.md`](./specs/001-whatsapp-sales-agent/contracts/rest-api.md)
para la especificación completa de endpoints, schemas de request/response y ejemplos.

Endpoints principales:

```
GET  /health                          → Healthcheck (sin auth)
GET  /api/v1/leads                    → Lista de leads paginada
GET  /api/v1/leads/:id                → Detalle de un lead con slots
PATCH /api/v1/leads/:id               → Actualizar notas / slots manualmente
GET  /api/v1/leads/:id/messages       → Historial de conversación
POST /api/v1/leads/:id/messages       → Enviar mensaje manual (senderType: HUMAN)
POST /api/v1/leads/:id/handoff        → Escalar manualmente a asesor humano
POST /api/v1/webhook/message          → Webhook de WPPConnect (no requiere auth)
```

Todos los endpoints (excepto `/health` y `/webhook`) requieren el header:
```
x-internal-key: TU_INTERNAL_API_KEY
```

---

## Convención de Ramas Git

```
feature/<descripcion>   → nueva funcionalidad
fix/<descripcion>       → corrección de bug
chore/<descripcion>     → infraestructura, CI/CD, configuración
docs/<descripcion>      → documentación únicamente
```

Flujo: `feature/* → develop → main` via Pull Requests.

---

## Licencia

MIT
