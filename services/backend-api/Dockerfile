# syntax=docker/dockerfile:1

# ── Stage 1: Build TypeScript + generate Prisma client ───────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
# Install all deps (dev included) for TypeScript build and Prisma CLI
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm run build && npx prisma generate

# Keep prisma CLI available at runtime for 'migrate deploy'
# prune devDeps first, then reinstall only the prisma CLI
RUN npm prune --production && \
    npm install --no-save prisma@$(node -e "console.log(require('./node_modules/prisma/package.json').version)")

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3001

# Run Prisma migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
