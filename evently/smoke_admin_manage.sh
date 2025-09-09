#!/usr/bin/env bash
# Evently Admin Manage Smoke: update, deactivate, delete (and edge-cases)

set -euo pipefail
BASE="${BASE:-http://localhost:8000}"

# docker compose helper
DC="docker compose"
if ! $DC ps >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    DC="sudo docker compose"
    $DC ps >/dev/null 2>&1 || DC=""
  else
    DC=""
  fi
fi

tmpfile(){ mktemp /tmp/evently_admin_manage.XXXXXX; }
show(){ if command -v jq >/dev/null 2>&1; then jq . "$1" || cat "$1"; else cat "$1"; fi; }
expect(){ code="$1"; out="$2"; shift 2; for e in "$@"; do [ "$code" = "$e" ] && return 0; done; echo "❌ HTTP $code (expected: $*)"; show "$out"; exit 1; }

# http <METHOD> <URL> <OUT> [JSON] [TOKEN]
# http <METHOD> <URL> <OUT> [JSON] [TOKEN]
http(){
  m="$1"; u="$2"; o="$3"; body="${4:-}"; tok="${5:-}"
  headers=()
  [ -n "$tok" ] && headers+=(-H "Authorization: Bearer $tok")
  if [ -n "$body" ]; then
    curl -sS -X "$m" "$u" -H 'Content-Type: application/json' "${headers[@]}" -d "$body" -o "$o" -w "%{http_code}"
  else
    curl -sS -X "$m" "$u" "${headers[@]}" -o "$o" -w "%{http_code}"
  fi
}


echo "1) Health"
OUT=$(tmpfile); CODE=$(http GET "$BASE/healthz" "$OUT"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"

echo "2) Ensure ADMIN_TOKEN (bootstrap if needed)"
ensure_admin(){
  if [ -n "${ADMIN_TOKEN:-}" ]; then
    P=$(tmpfile); C=$(http GET "$BASE/admin/analytics/summary?refresh=1" "$P" "" "$ADMIN_TOKEN" || true)
    if [ "$C" = "200" ]; then echo "   using provided ADMIN_TOKEN"; rm -f "$P"; return; fi
    rm -f "$P"; echo "   provided token invalid; refreshing…"
  fi
  [ -z "$DC" ] && { echo "❌ need docker compose to bootstrap admin"; exit 1; }
  ADM="admin_$(date +%s)@example.com"
  O=$(tmpfile); CODE=$(http POST "$BASE/auth/signup" "$O" "{\"name\":\"Admin\",\"email\":\"$ADM\",\"password\":\"root\"}"); expect "$CODE" "$O" 200; rm -f "$O"
  $DC exec -T db psql -U postgres -d evently -c "UPDATE users SET role='admin' WHERE email='${ADM}';" >/dev/null
  ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADM\",\"password\":\"root\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])'); export ADMIN_TOKEN
  echo "   bootstrapped $ADM"
}
ensure_admin

echo "3) Admin creates a manageable event (capacity=3)"
OUT=$(tmpfile)
CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Manage Smoke","venue":"A","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":3}' "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 200; show "$OUT"
EID=$(jq -r .id "$OUT"); rm -f "$OUT"
echo "   -> EID=$EID"

echo "4) PATCH update name+venue+capacity (to 5)"
OUT=$(tmpfile)
CODE=$(http PATCH "$BASE/admin/events/$EID" "$OUT" '{"name":"Managed v1","venue":"Hall X","capacity":5}' "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"

echo "5) Create a regular user and book qty=2 for the event"
UE="user_$(date +%s)@example.com"
O=$(tmpfile); CODE=$(http POST "$BASE/auth/signup" "$O" "{\"name\":\"U\",\"email\":\"$UE\",\"password\":\"secret\"}"); expect "$CODE" "$O" 200; rm -f "$O"
USER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$UE\",\"password\":\"secret\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
OUT=$(tmpfile)
CODE=$(http POST "$BASE/events/$EID/book" "$OUT" '{"qty":2}' "$USER_TOKEN")
expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"

echo "6) PATCH capacity below booked_count (to 1) → expect 409"
OUT=$(tmpfile)
CODE=$(http PATCH "$BASE/admin/events/$EID" "$OUT" '{"capacity":1}' "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 409; show "$OUT"; rm -f "$OUT"

echo "7) Deactivate event → status should become 'inactive'"
OUT=$(tmpfile)
CODE=$(http POST "$BASE/admin/events/$EID/deactivate" "$OUT" "" "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"

echo "8) Try booking while inactive → expect 409 'Event not active'"
OUT=$(tmpfile)
CODE=$(http POST "$BASE/events/$EID/book" "$OUT" '{"qty":1}' "$USER_TOKEN")
expect "$CODE" "$OUT" 409; show "$OUT"; rm -f "$OUT"

echo "9) Reactivate via PATCH status=active"
OUT=$(tmpfile)
CODE=$(http PATCH "$BASE/admin/events/$EID" "$OUT" '{"status":"active"}' "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"

echo "10) DELETE event that has bookings → expect 409"
OUT=$(tmpfile)
CODE=$(http DELETE "$BASE/admin/events/$EID" "$OUT" "" "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 409; show "$OUT"; rm -f "$OUT"

echo "11) Create new event with no bookings and delete → expect 204 then 404 on GET"
OUT=$(tmpfile)
CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Delete Me","venue":"B","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":4}' "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 200; DID=$(jq -r .id "$OUT"); rm -f "$OUT"
OUT=$(tmpfile)
CODE=$(http DELETE "$BASE/admin/events/$DID" "$OUT" "" "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 204; rm -f "$OUT"
OUT=$(tmpfile)
CODE=$(http GET "$BASE/events/$DID" "$OUT"); expect "$CODE" "$OUT" 404; show "$OUT"; rm -f "$OUT"

echo
echo "✅ Admin manage endpoints smoke test passed."
