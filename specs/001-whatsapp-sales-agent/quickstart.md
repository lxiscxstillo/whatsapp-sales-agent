# Quickstart: Agente de Ventas Inmobiliarias en WhatsApp

**Branch**: `001-whatsapp-sales-agent`
**Date**: 2026-03-18

Guía para levantar el proyecto completo en un entorno de desarrollo local en menos de 10 minutos.

---

## Prerequisitos

| Herramienta | Versión Mínima | Verificar |
|-------------|---------------|-----------|
| Docker Desktop | 24.x | `docker --version` |
| Docker Compose | v2.x | `docker compose version` |
| Node.js | 20.x | `node --version` |
| Python | 3.11+ | `python --version` |
| Git | 2.x | `git --version` |

**Cuentas externas requeridas:**
- [Groq Console](https://console.groq.com) — API key gratuita
- [LangSmith](https://smith.langchain.com) — API key gratuita
- Número de WhatsApp disponible para escanear el QR (puede ser personal o de prueba)

---

## 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/whatsapp-sales-agent.git
cd whatsapp-sales-agent
git checkout 001-whatsapp-sales-agent
```

---

## 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores reales:

```env
# PostgreSQL
POSTGRES_USER=realestate_user
POSTGRES_PASSWORD=mi_password_seguro
POSTGRES_DB=realestate_db

# WPPConnect
WPPCONNECT_SECRET_KEY=mi_clave_secreta_aqui
WPPCONNECT_SESSION=my-whatsapp-session

# Groq API — https://console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# LangSmith — https://smith.langchain.com
LANGCHAIN_API_KEY=ls__xxxxxxxxxxxxxxxxxxxx
LANGSMITH_PROJECT=whatsapp-sales-agent

# Backend
INTERNAL_API_KEY=clave_interna_entre_servicios

# Frontend (URL del backend en local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
BACKEND_API_URL=http://localhost:3001/api/v1
```

---

## 3. Configurar WPPConnect

El archivo `config.ts` de WPPConnect debe generarse antes de levantar el contenedor:

```bash
# Desde la raíz del proyecto
mkdir -p wppconnect-config
# El entrypoint script lo genera automáticamente con las vars de entorno
# Para desarrollo, crearlo manualmente:
cat > wppconnect-config/config.ts << 'EOF'
export default {
  secretKey: process.env.WPPCONNECT_SECRET_KEY || 'changeme',
  port: '21465',
  deviceName: 'Asesor Inmobiliario Dev',
  tokenStoreType: 'file',
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://host.docker.internal:3001/api/v1/webhook/message',
    readMessage: true,
    ignore: ['status@broadcast'],
    allUnreadOnStart: false,
  }
}
EOF
```

**Nota para macOS/Linux**: `host.docker.internal` puede no estar disponible. Usar la IP de la interfaz docker (`172.17.0.1` en Linux) o usar la red interna de docker-compose.

---

## 4. Levantar servicios con Docker Compose

```bash
# Levantar todo (desarrollo — con hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Solo base de datos (para desarrollar backend localmente sin Docker)
docker compose up postgres -d
```

Servicios levantados:
- PostgreSQL en `localhost:5432`
- WPPConnect en `localhost:21465`
- backend-api + agent-langgraph en `localhost:3001` y `localhost:8000`
- frontend en `localhost:3000`

---

## 5. Escanear el QR de WhatsApp

1. Abrir `http://localhost:21465` en el browser.
2. En la interfaz de WPPConnect, iniciar la sesión con el nombre configurado.
3. Escanear el QR con el teléfono (WhatsApp → Dispositivos vinculados → Vincular dispositivo).
4. Esperar confirmación "Session connected".

**El QR solo se escanea una vez** — los tokens se persisten en el volumen `wppconnect_tokens`.

---

## 6. Aplicar migraciones de base de datos

```bash
# Si el backend está en Docker:
docker compose exec backend-api npx prisma migrate dev

# Si el backend está corriendo localmente:
cd services/backend-api
DATABASE_URL="postgresql://realestate_user:mi_password@localhost:5432/realestate_db" \
  npx prisma migrate dev
```

---

## 7. Verificar que todo funciona

```bash
# Verificar backend-api
curl http://localhost:3001/api/v1/leads

# Verificar agent-langgraph
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -d '{"leadId":"test","phone":"573001234567","message":"Hola","leadStatus":"new"}'

# Verificar frontend
open http://localhost:3000
```

---

## 8. Enviar primer mensaje de prueba

1. Desde el número escaneado, enviar un mensaje al número de WhatsApp configurado.
2. En los logs del backend (`docker compose logs backend-api -f`), debería aparecer el webhook recibido.
3. El agente debe responder en WhatsApp en menos de 5 segundos.
4. En el panel `http://localhost:3000`, el lead debe aparecer con `status: QUALIFYING`.
5. En LangSmith Studio, debe haber una nueva traza con todos los nodos ejecutados.

---

## Comandos Útiles

```bash
# Ver logs de todos los servicios
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend-api
docker compose logs -f agent-langgraph

# Reiniciar un servicio
docker compose restart backend-api

# Acceder a la DB directamente
docker compose exec postgres psql -U realestate_user -d realestate_db

# Abrir Prisma Studio (GUI de la DB)
cd services/backend-api
npx prisma studio

# Ejecutar migraciones de Prisma
docker compose exec backend-api npx prisma migrate dev --name "descripcion"

# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes (CUIDADO: borra sesión WhatsApp y DB)
docker compose down -v
```

---

## Estructura de Servicios en Desarrollo vs Producción

| Aspecto | Desarrollo (local) | Producción (Railway) |
|---------|-------------------|---------------------|
| backend + agent | 2 contenedores separados | 1 contenedor con supervisord |
| WPPConnect config | `config.ts` manual | Generado por entrypoint script |
| Frontend | `localhost:3000` con hot reload | Vercel |
| Database | PostgreSQL local | Railway PostgreSQL plugin |
| Logs | `docker compose logs` | Railway dashboard |
| Trazas LangSmith | Mismo — LangSmith es externo | Mismo |

---

## Troubleshooting

**El QR no aparece / WPPConnect no arranca:**
- Verificar que los volúmenes Docker tienen permisos correctos.
- Revisar logs: `docker compose logs wppconnect`.
- Verificar que el `config.ts` fue montado correctamente.

**El agente no responde a mensajes:**
- Verificar que el webhook URL en `config.ts` apunta al backend correcto.
- Verificar que el backend está recibiendo el POST: `docker compose logs backend-api`.
- Verificar que Groq API key es válida.

**Error de conexión a PostgreSQL:**
- Verificar que el servicio postgres está running: `docker compose ps postgres`.
- Verificar que las variables `POSTGRES_USER/PASSWORD/DB` coinciden en backend y postgres.

**LangSmith no recibe trazas:**
- Verificar que `LANGCHAIN_TRACING_V2=true` está en el entorno del agente.
- Verificar que `LANGCHAIN_API_KEY` es válida.
- LangSmith puede tardar 30–60 segundos en mostrar nuevas trazas.

**Error BigInt en Prisma (slotBudgetNumeric):**
- Asegurarse de que el valor numérico se convierte con `BigInt(value)` antes del upsert.
- Si la UI necesita mostrar el valor, serializar con `.toString()`.

---

## Despliegue en Railway + Vercel (Producción)

### Railway — 3 servicios

**Servicio 1: PostgreSQL**
- En Railway dashboard → "Add Plugin" → PostgreSQL
- Railway genera `DATABASE_URL` automáticamente

**Servicio 2: WPPConnect**
```
Dockerfile: services/combined no lo incluye — deploy separado
Image: wppconnect/wppconnect-server:latest
Variables:
  WPPCONNECT_SECRET_KEY=<secreto>
  WEBHOOK_URL=https://<railway-backend-url>/api/v1/webhook/message
Volumes: tokens, config, userDataDir (Railway persistent volumes)
```

**Servicio 3: Backend + Agent (combinado)**
```
Dockerfile: services/combined/Dockerfile
Variables (todas las del .env.example más):
  DATABASE_URL=<Railway PostgreSQL URL>
  WPPCONNECT_URL=https://<railway-wppconnect-url>
  AGENT_URL=http://localhost:8000   ← interno en el mismo contenedor
  PORT=3001
  NODE_ENV=production
```

### Vercel — Frontend

```bash
# Desde la raíz del proyecto
cd services/frontend
vercel

# Variables de entorno en Vercel dashboard:
BACKEND_API_URL=https://<railway-backend-url>
INTERNAL_API_KEY=<mismo valor que en Railway>
```

**Nota**: El `next.config.js` ya tiene `output: "standalone"` para optimizar el build de Vercel.
