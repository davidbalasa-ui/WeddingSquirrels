#!/usr/bin/env bash
set -euo pipefail

# Vercel build: generate Prisma client and build Next.js.
# Schema sync to Neon is documented as a manual step in README.md
# (`npx prisma db push` from a trusted machine), not on every deploy.
# Prisma generation only needs the schema, but prisma.config.ts validates this
# variable. Preview deployments may intentionally have no production database.
DATABASE_URL="${DATABASE_URL:-postgresql://build:build@localhost:5432/build}" npx prisma generate
npm run build
