#!/usr/bin/env bash
set -euo pipefail

# Vercel build: generate Prisma client, ensure additive schema columns, build Next.js.
bash scripts/prisma-generate.sh

if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" != *"@localhost:5432/build"* ]]; then
  npm run db:directory-schema
fi

npm run build
