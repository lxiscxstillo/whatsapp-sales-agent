# syntax=docker/dockerfile:1
# Combined container: Node.js backend-api (port 3001) + Python agent-langgraph (port 8000)
# Used for Railway production to reduce service count within free tier

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
RUN npm ci --only=production

COPY services/backend-api/package*.json ./
RUN npm ci
COPY services/backend-api/tsconfig.json ./
COPY services/backend-api/src ./src
COPY services/backend-api/prisma ./prisma
RUN npx prisma generate && npm run build

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

EXPOSE 3001 8000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
