# Contract: CORS Policy — backend-api

**Service**: backend-api (Express)
**Applies to**: All routes under `/api/v1/*`
**Standard**: CORS W3C Recommendation

---

## Allowed Origins

| Origin | Environment |
|--------|-------------|
| `https://frontend-rho-one-21.vercel.app` | Production |
| `http://localhost:3000` | Development |
| `http://localhost:3001` | Development |
| `http://127.0.0.1:*` | Development |

---

## Allowed Methods

`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`

---

## Allowed Headers

| Header | Purpose |
|--------|---------|
| `Content-Type` | JSON request bodies |
| `Authorization` | Bearer tokens (WPPConnect passthrough) |
| `X-Requested-With` | XHR detection |
| `x-internal-key` | Service-to-service authentication |

---

## Preflight Behavior

```http
OPTIONS /api/v1/leads HTTP/1.1
Origin: https://frontend-rho-one-21.vercel.app
Access-Control-Request-Method: GET
Access-Control-Request-Headers: x-internal-key

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://frontend-rho-one-21.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-internal-key
Access-Control-Max-Age: 86400
Vary: Origin
```

---

## Credentials

`credentials: false` — No cookies. Authentication uses `x-internal-key` header.

---

## Implementation Notes

1. CORS middleware must be mounted **before** `authMiddleware` in `index.ts` so that OPTIONS preflight requests return 204 without requiring the `x-internal-key` header.
2. The `/health` endpoint already bypasses `authMiddleware` and is not affected.
3. The `/api/v1/webhook` path bypasses `authMiddleware` (WPPConnect callback) and should also be excluded from strict CORS.

---

## Dependency

```bash
npm install cors @types/cors
```

Or use the built-in Express handling:
```typescript
// No npm cors package needed if using manual header setting
res.header('Access-Control-Allow-Origin', allowedOrigin);
```

Recommended: use `cors` npm package for cleaner configuration and `Vary: Origin` handling.
