#!/usr/bin/env bash
set -euo pipefail

# Prisma Client generation reads prisma.config.ts but does not connect to the
# database. Preview installs may intentionally have no production credentials,
# so provide a non-routable URL only for this generation process.
DATABASE_URL="${DATABASE_URL:-postgresql://build:build@localhost:5432/build}" npx prisma generate
