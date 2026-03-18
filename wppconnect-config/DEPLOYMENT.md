# WPPConnect — Guía de Despliegue

## Por qué WPPConnect NO puede correr en Railway plan gratuito

WPPConnect utiliza **Puppeteer + Chromium headless** para emular el cliente web de
WhatsApp. El proceso del navegador consume entre **512 MB y 1.5 GB de RAM** en
estado estable.

El plan gratuito/Hobby de Railway asigna **512 MB de RAM por servicio**. Al iniciar
Chromium, WPPConnect excede inmediatamente este límite y el proceso es eliminado
(OOMKilled), impidiendo que el servicio arranque de forma estable.

**Solución:** desplegar WPPConnect en **Fly.io** (free tier, hasta 3 máquinas
compartidas con 256 MB cada una — suficiente para una sesión estable con una sola
cuenta de WhatsApp) y apuntar la variable de entorno `WPPCONNECT_URL` del backend
Railway hacia el host de Fly.io.

---

## Opción A: Despliegue en Fly.io (Recomendado para evaluación)

### Prerequisitos

```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Autenticarse (cuenta gratuita en https://fly.io)
fly auth login
```

### 1. Crear la app en Fly.io

```bash
cd wppconnect-config
fly launch --no-deploy --name wppconnect-sales-agent --region gru
# Seleccionar: No crear Postgres, No crear Redis
```

### 2. fly.toml de referencia

Crear `wppconnect-config/fly.toml` con el siguiente contenido:

```toml
app = "wppconnect-sales-agent"
primary_region = "gru"

[build]
  image = "wppconnect/wppconnect-server:latest"

[env]
  PORT = "21465"
  WPPCONNECT_SECRET_KEY = "cambia_esto_por_una_clave_segura"

[http_service]
  internal_port = 21465
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

[mounts]
  source = "wppconnect_tokens"
  destination = "/usr/src/wppconnect/tokens"

[[mounts]]
  source = "wppconnect_userdata"
  destination = "/usr/src/wppconnect/userDataDir"
```

### 3. Crear volúmenes persistentes

```bash
fly volumes create wppconnect_tokens --size 1 --region gru
fly volumes create wppconnect_userdata --size 2 --region gru
```

### 4. Configurar el secreto de WPPConnect

```bash
fly secrets set WPPCONNECT_SECRET_KEY="tu_clave_secreta_aqui"
```

### 5. Configurar el webhook hacia Railway

El webhook debe apuntar al backend Railway para que los mensajes entrantes lleguen:

```bash
# Configurar en fly.toml [env] o via secrets:
fly secrets set WEBHOOK_URL="https://tu-backend.railway.app/api/v1/webhook/message"
```

### 6. Desplegar

```bash
fly deploy
```

### 7. Verificar que el servicio está activo

```bash
fly status
# Debería mostrar: 1 machines running

# Ver logs
fly logs
```

La URL de tu instancia de WPPConnect será:
```
https://wppconnect-sales-agent.fly.dev
```

---

## Conectar Railway con Fly.io

Una vez que WPPConnect está en Fly.io, actualiza la variable de entorno en Railway:

1. Ir a Railway Dashboard → tu proyecto → Variables
2. Actualizar:

```
WPPCONNECT_URL=https://wppconnect-sales-agent.fly.dev
WPPCONNECT_SECRET_KEY=tu_clave_secreta_aqui
WPPCONNECT_SESSION=nombre-de-tu-sesion
```

3. Railway hace redeploy automático al guardar las variables.

---

## Escanear el QR de WhatsApp

Después de que WPPConnect esté corriendo en Fly.io, necesitas vincular tu número:

### Desde el panel de WPPConnect (recomendado)

1. Abrir en el browser: `https://wppconnect-sales-agent.fly.dev`
2. Ir a **Session Manager** → **Start Session**
3. Escanear el QR con WhatsApp en tu teléfono:
   - WhatsApp → Configuración → Dispositivos vinculados → Vincular dispositivo

### Via API (automatizado)

```bash
# 1. Generar token
curl -X POST "https://wppconnect-sales-agent.fly.dev/api/NOMBRE_SESION/TU_CLAVE/generate-token"

# 2. Iniciar sesión (retorna el QR en base64)
curl -X POST "https://wppconnect-sales-agent.fly.dev/api/NOMBRE_SESION/start-session" \
  -H "Authorization: Bearer TU_TOKEN"
```

---

## Re-escaneo de QR si la sesión se pierde

La sesión de WhatsApp se almacena en los volúmenes de Fly.io (`wppconnect_tokens`
y `wppconnect_userdata`). Los volúmenes son **persistentes** en Fly.io, por lo que
un restart normal del contenedor **no** requiere re-escaneo.

Sin embargo, si:
- El volumen fue eliminado manualmente
- Hubo un cambio de región en Fly.io
- WhatsApp cerró la sesión remota (inactividad > 14 días)

...necesitarás re-escanear el QR siguiendo el paso anterior.

**Verificar estado de la sesión:**

```bash
curl "https://wppconnect-sales-agent.fly.dev/api/NOMBRE_SESION/status-session" \
  -H "Authorization: Bearer TU_TOKEN"
# Respuesta esperada: { "status": "isLogged" }
```

---

## Opción B: VPS propio (alternativa más económica a largo plazo)

Si prefieres control total y el plan gratuito de Fly.io no es suficiente para
producción, un VPS básico ($4-6/mes en DigitalOcean, Hetzner o Vultr) con 1-2 GB
de RAM puede alojar WPPConnect de forma estable:

```bash
# En el VPS (Ubuntu 22.04)
docker run -d \
  --name wppconnect \
  --restart unless-stopped \
  -p 21465:21465 \
  -v wppconnect_tokens:/usr/src/wppconnect/tokens \
  -v wppconnect_userdata:/usr/src/wppconnect/userDataDir \
  -e WPPCONNECT_SECRET_KEY="tu_clave" \
  -e WEBHOOK_URL="https://tu-backend.railway.app/api/v1/webhook/message" \
  wppconnect/wppconnect-server:latest
```

Actualiza `WPPCONNECT_URL=http://IP_DE_TU_VPS:21465` en Railway.
