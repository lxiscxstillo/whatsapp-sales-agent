# syntax=docker/dockerfile:1
# Combined container: Node.js backend-api (port 3001) + Python agent-langgraph (port 8000)
# Used for Railway production to reduce service count within the free tier.

FROM node:20-alpine AS base

# Install Python 3.11 and system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    supervisor \
    build-base \
    postgresql-dev \
    python3-dev \
    openssl \
    openssl-dev \
    libc6-compat

# ── Build Node.js backend ──────────────────────────────────────────────────────
WORKDIR /app/backend

COPY services/backend-api/package*.json ./
# Install all deps (including devDeps) needed for the TypeScript build
RUN npm ci

COPY services/backend-api/tsconfig.json ./
COPY services/backend-api/src ./src
COPY services/backend-api/prisma ./prisma
RUN npx prisma generate && npm run build
# Re-add prisma CLI so migrate deploy works at runtime, then prune everything else
RUN npm prune --production && \
    npm install --no-save prisma@$(node -e "console.log(require('./node_modules/prisma/package.json').version)")

# ── Build Python agent ─────────────────────────────────────────────────────────
WORKDIR /app/agent

RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

COPY services/agent-langgraph/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY services/agent-langgraph/src ./src

# ── Final runtime ──────────────────────────────────────────────────────────────
WORKDIR /app

COPY services/combined/supervisord.conf /etc/supervisord.conf
COPY services/backend-api/entrypoint.sh /app/backend/entrypoint.sh
RUN sed -i 's/\r$//' /app/backend/entrypoint.sh && chmod +x /app/backend/entrypoint.sh

EXPOSE 3001 8000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
