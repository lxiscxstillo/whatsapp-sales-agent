#!/bin/sh
# Entrypoint for backend-api container.
# Runs Prisma migrations before starting the server so that the DB schema
# is always up to date on container startup (including first deploy to Railway).
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "[entrypoint] ERROR: Prisma migration failed. Aborting startup."
  exit 1
fi

echo "[entrypoint] Migrations complete. Starting backend-api..."
exec node dist/index.js
