#!/usr/bin/env bash
# Clean all DB tables but keep exactly one admin user: rahul@example.com
# - Creates rahul@example.com with password 'root' if missing
# - Promotes Rahul to admin
# - Truncates all public tables EXCEPT "users" (CASCADE)
# - Deletes all rows from users where email != 'rahul@example.com'
# - Resets all sequences in public schema
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ please install $1"; exit 1; }; }
need jq
need python3
need sudo
need docker
need curl

http(){ # http <METHOD> <URL> <OUT> [JSON]
  local m="$1" u="$2" o="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$m" "$u" -H 'Content-Type: application/json' -d "$body" -o "$o" -w "%{http_code}"
  else
    curl -sS -X "$m" "$u" -o "$o" -w "%{http_code}"
  fi
}

echo "0) Health check..."
OUT=$(mktemp); CODE=$(http GET "$BASE/healthz" "$OUT"); [ "$CODE" = "200" ] || { echo "❌ healthz $CODE"; cat "$OUT"; exit 1; }
cat "$OUT"; rm -f "$OUT"

RAHUL_EMAIL="rahul@example.com"
RAHUL_PASS="root"

echo "1) Ensure rahul@example.com exists (create if missing)…"
# Try a signup; if already exists most backends return 400/409 — ignore and proceed.
RAW=$(mktemp)
SC=$(curl -sS -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
       -d "{\"name\":\"Rahul\",\"email\":\"$RAHUL_EMAIL\",\"password\":\"$RAHUL_PASS\"}" \
       -o "$RAW" -w "%{http_code}" || true)
if [ "$SC" = "200" ] || [ "$SC" = "201" ]; then
  echo "   ✓ Created $RAHUL_EMAIL"
elif [ "$SC" = "400" ] || [ "$SC" = "409" ]; then
  echo "   (User likely exists) -> proceeding"
else
  echo "   (Signup response $SC) -> proceeding anyway"
fi
rm -f "$RAW"

echo "2) Promote Rahul to admin and clean DB (keep only Rahul in users)…"
sudo docker compose exec -T db psql -U postgres -d evently -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- 2a) Make sure Rahul is admin (if the column/role exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='role'
  ) THEN
    UPDATE public.users SET role='admin' WHERE email='rahul@example.com';
  END IF;
END$$;

-- 2b) TRUNCATE all public tables EXCEPT users (CASCADE)
DO $$
DECLARE
  t record;
  stmt text;
BEGIN
  FOR t IN
    SELECT quote_ident(schemaname) AS sch, quote_ident(tablename) AS tbl
    FROM pg_tables
    WHERE schemaname='public' AND tablename <> 'users'
  LOOP
    stmt := format('TRUNCATE TABLE %s.%s CASCADE;', t.sch, t.tbl);
    EXECUTE stmt;
  END LOOP;
END$$;

-- 2c) Delete every user except Rahul
DELETE FROM public.users WHERE email <> 'rahul@example.com';

-- 2d) Reset all sequences in public schema
DO $$
DECLARE
  s record;
  stmt text;
BEGIN
  FOR s IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema='public'
  LOOP
    stmt := format('ALTER SEQUENCE %I.%I RESTART WITH 1;', s.sequence_schema, s.sequence_name);
    EXECUTE stmt;
  END LOOP;
END$$;

COMMIT;
SQL

echo "   ✓ DB cleaned (all tables except users truncated; only Rahul remains in users)."

echo "3) Quick verification:"
sudo docker compose exec -T db psql -U postgres -d evently -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users count (should be 1)' AS check, COUNT(*) FROM public.users;
SELECT 'rahul present (should be 1)' AS check, COUNT(*) FROM public.users WHERE email='rahul@example.com';
-- Show a few public tables left after truncation (if they exist)
DO $$
DECLARE
  r record;
  q text;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'users' ORDER BY tablename LOOP
    q := format('SELECT ''table ' || r.tablename || ' count'' AS check, COUNT(*) FROM public.%I;', r.tablename);
    EXECUTE q;
  END LOOP;
END$$;
SQL

echo
echo "✅ Clean complete. Only admin 'rahul@example.com' remains; everything else cleared."
