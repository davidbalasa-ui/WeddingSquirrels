#!/usr/bin/env bash
# Idempotently provision and start a local PostgreSQL server for the
# Cloud Agent development environment. Safe to run repeatedly (install + start).
#
# The production app uses Neon Postgres; locally we run a self-contained
# PostgreSQL cluster owned by the current user so no external database or
# secret is required to develop against the app.
set -euo pipefail

PGDATA="${PGDATA:-$HOME/pgdata}"
PGSOCK="${PGSOCK:-$HOME/pgsock}"
PGPORT="${PGPORT:-5432}"
DB_NAME="${DB_NAME:-wedding}"
DB_USER="${DB_USER:-wedding}"
DB_PASS="${DB_PASS:-wedding}"

# 1. Ensure the PostgreSQL server binaries are installed.
if ! ls /usr/lib/postgresql/*/bin/pg_ctl >/dev/null 2>&1; then
  echo "[db] Installing PostgreSQL..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
export PATH="$PGBIN:$PATH"

mkdir -p "$PGSOCK"

# 2. Initialize the cluster once (trust auth is fine for a local dev instance).
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[db] Initializing cluster at $PGDATA"
  initdb -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 >/dev/null
  {
    echo "port = $PGPORT"
    echo "listen_addresses = 'localhost'"
    echo "unix_socket_directories = '$PGSOCK'"
  } >> "$PGDATA/postgresql.conf"
fi

# 3. Start the server if it is not already running.
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[db] Starting PostgreSQL"
  pg_ctl -D "$PGDATA" -l "$HOME/pg.log" -o "-p $PGPORT" -w start
fi

# 4. Wait until it is accepting connections.
for _ in $(seq 1 30); do
  pg_isready -h localhost -p "$PGPORT" >/dev/null 2>&1 && break
  sleep 1
done

# 5. Ensure the application role and database exist.
psql -h localhost -p "$PGPORT" -U postgres -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || psql -h localhost -p "$PGPORT" -U postgres -c \
    "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS' SUPERUSER;"
psql -h localhost -p "$PGPORT" -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || psql -h localhost -p "$PGPORT" -U postgres -c \
    "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "[db] PostgreSQL ready on localhost:$PGPORT (database=$DB_NAME, user=$DB_USER)"
