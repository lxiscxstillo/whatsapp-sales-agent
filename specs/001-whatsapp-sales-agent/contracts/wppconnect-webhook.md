# WPPConnect Webhook Contract

**Branch**: `001-whatsapp-sales-agent`
**Date**: 2026-03-18
**Source**: Análisis del código fuente de `wppconnect-team/wppconnect-server`

---

## Webhook Entrante (WPPConnect → backend-api)

WPPConnect hace `POST` a la URL configurada en `webhook.url` de `config.ts` cada vez que ocurre un evento.

### Evento: `onmessage` (mensaje texto)

```json
POST {WEBHOOK_URL}
Content-Type: application/json

{
  "event": "onmessage",
  "session": "SESSION_NAME",
  "id": "3EB0C3ABC1234567890A",
  "from": "573001234567@c.us",
  "to": "573009876543@c.us",
  "body": "Hola, estoy buscando un apartamento",
  "type": "chat",
  "timestamp": 1710700000,
  "fromMe": false,
  "isGroup": false,
  "hasMedia": false,
  "isForwarded": false,
  "notifyName": "Carlos M"
}
```

**Campos siempre presentes**: `event`, `session`, `id`, `from`, `body`, `type`, `timestamp`, `fromMe`, `isGroup`.

### Eventos a Ignorar

| Evento | Acción |
|--------|--------|
| Cualquiera con `isGroup: true` | Descartar |
| Cualquiera con `fromMe: true` | Descartar |
| `onack` | Descartar |
| `onpresencechanged` | Descartar |
| `onparticipantschanged` | Descartar |

### Mensajes con Media (`type !== "chat"`)

| Tipo | Acción |
|------|--------|
| `image` | Respuesta: "Por ahora solo puedo procesar texto. ¿Me cuentas qué estás buscando?" |
| `ptt` (audio) | Igual que imagen |
| `video` | Igual que imagen |
| `document` | Igual que imagen |
| `sticker` | Ignorar silenciosamente |

---

## Envío de Mensajes (backend-api → WPPConnect)

### `POST /api/{SESSION_NAME}/send-message`

```
POST http://wppconnect:21465/api/{SESSION_NAME}/send-message
Authorization: Bearer {WPPCONNECT_TOKEN}
Content-Type: application/json

{
  "phone": "573001234567",
  "message": "Texto de respuesta del agente"
}
```

**Response 201 (éxito):**
```json
{
  "status": "success",
  "response": [{
    "id": "3EB0XYZ...",
    "status": "pending"
  }]
}
```

**Notas:**
- `phone` sin `@c.us` — WPPConnect lo agrega internamente.
- El token se genera una vez en el startup via `POST /api/{session}/{secretKey}/generate-token`.
- Implementar retry con backoff exponencial (1 intento adicional) si la primera llamada falla.

---

## Generación de Token (startup)

```
GET /api/{SESSION_NAME}/{SECRET_KEY}/generate-token
```

**Response:**
```json
{
  "status": "Success",
  "session": "SESSION_NAME",
  "token": "base64_bcrypt_token"
}
```

Este token debe almacenarse en la configuración del backend y usarse en todas las llamadas posteriores a WPPConnect.

---

## Configuración de WPPConnect (`config.ts`)

```typescript
// Generado dinámicamente por entrypoint script usando variables de entorno
export default {
  secretKey: "${WPPCONNECT_SECRET_KEY}",
  host: "http://localhost",
  port: "21465",
  deviceName: "Asesor Inmobiliario",
  poweredBy: "WPPConnect-Server",
  tokenStoreType: "file",
  customUserDataDir: "./userDataDir/",
  webhook: {
    url: "${BACKEND_WEBHOOK_URL}",    // URL del backend-api
    readMessage: true,
    listenAcks: false,
    allUnreadOnStart: false,
    ignore: ["status@broadcast"],
    onPresenceChanged: false,
    onParticipantsChanged: false,
    onReactionMessage: false,
    onPollResponse: false,
    onRevokedMessage: false
  }
}
```

**Volúmenes Docker requeridos:**
```yaml
volumes:
  - ./wppconnect-config/config.ts:/usr/src/wpp-server/config.ts
  - wppconnect_tokens:/usr/src/wpp-server/tokens
  - wppconnect_userdata:/usr/src/wpp-server/userDataDir
```
