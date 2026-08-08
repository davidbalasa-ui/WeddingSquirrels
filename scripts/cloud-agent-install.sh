#!/usr/bin/env bash
# Cloud Agent install: refresh dependencies and prepare the local database.
# Runs after the repository is checked out. Must be idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Local PostgreSQL server (installs/initializes/starts as needed).
bash scripts/cloud-agent-db.sh

# 2. Local dev environment file (never overwrite an existing one).
#    DATABASE_URL points at the local Postgres from cloud-agent-db.sh.
if [ ! -f .env ]; then
  SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 48)"
  cat > .env <<EOF
# Local Cloud Agent dev environment (local Postgres). Not for production.
DATABASE_URL="postgresql://wedding:wedding@localhost:5432/wedding?sslmode=disable"
PIN_SESSION_SECRET="$SECRET"
EOF
  echo "[install] Wrote .env for local development"
fi

# 3. Install dependencies (postinstall runs `prisma generate`).
npm ci

# 4. Sync the schema and seed baseline data (PIN accounts, people, calendar).
#    The full seed also imports Excel spreadsheets from ~/Downloads when present;
#    they are private, so seeding degrades gracefully without them.
npm run db:push
npm run db:seed
