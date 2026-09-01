#!/usr/bin/env bash
set -euo pipefail

# Vercel build: generate Prisma client and build Next.js.
# Schema sync to Neon is documented as a manual step in README.md
# (`npx prisma db push` from a trusted machine), not on every deploy.
bash scripts/prisma-generate.sh
npm run build
