# syntax=docker/dockerfile:1

# ── Stage 1: Build TypeScript + generate Prisma client ───────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
# Install ALL deps (dev + prod) so typescript and prisma CLI are available
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm run build && npx prisma generate

# Prune devDependencies — keeps prisma CLI + @prisma/client for migrate deploy
# Note: prisma CLI is needed at runtime for 'prisma migrate deploy', so we
# install it in production as well via the postinstall lifecycle.
RUN npm prune --production
# Re-add prisma CLI explicitly so the runner stage can run `migrate deploy`
RUN npm install --no-save prisma@$(node -e "console.log(require('./node_modules/prisma/package.json').version)")

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

# Copy built artifacts and production node_modules (includes prisma CLI)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

COPY package*.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001

# entrypoint.sh runs: prisma migrate deploy && node dist/index.js
CMD ["./entrypoint.sh"]
