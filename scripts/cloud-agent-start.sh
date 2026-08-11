#!/usr/bin/env bash
# Cloud Agent start: bring up per-boot runtime services.
# Ensures the local PostgreSQL server is running, then returns.
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/cloud-agent-db.sh
