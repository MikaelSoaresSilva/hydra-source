#!/usr/bin/env bash
# Aplica as migrações num PostgreSQL local (com stub de auth/storage) e roda os testes de RLS.
# Requer: psql e um servidor PostgreSQL acessível (PGHOST/PGUSER/etc.).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=titan_rls_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f tests/stub_supabase.sql
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d $DB -f tests/rls_test.sql
psql -q -d postgres -c "drop database $DB"
