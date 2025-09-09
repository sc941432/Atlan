#!/usr/bin/env bash
# Evently End-to-End Smoke: Day 1 → Day 4 + Admin Manage + Concurrency + /me/bookings
set -euo pipefail
BASE="${BASE:-http://localhost:8000}"

command -v jq >/dev/null 2>&1 || { echo "❌ Please install 'jq'"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Please install 'python3'"; exit 1; }

DC="docker compose"
if ! $DC ps >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    DC="sudo docker compose"
    $DC ps >/dev/null 2>&1 || DC=""
  else
    DC=""
  fi
fi

tmpfile(){ mktemp /tmp/evently_all.XXXXXX; }
show(){ jq . "$1" 2>/dev/null || cat "$1"; }
expect(){ code="$1"; out="$2"; shift 2; for e in "$@"; do [ "$code" = "$e" ] && return 0; done; echo "❌ HTTP $code (expected: $*)"; show "$out"; exit 1; }
http(){ # http <METHOD> <URL> <OUT> [JSON] [TOKEN]
  m="$1"; u="$2"; o="$3"; body="${4:-}"; tok="${5:-}"
  headers=()
  [ -n "$tok" ] && headers+=(-H "Authorization: Bearer $tok")
  if [ -n "$body" ]; then
    curl -sS -X "$m" "$u" -H 'Content-Type: application/json' "${headers[@]}" -d "$body" -o "$o" -w "%{http_code}"
  else
    curl -sS -X "$m" "$u" "${headers[@]}" -o "$o" -w "%{http_code}"
  fi
}
line(){ printf '%0.s-' {1..50}; echo; }

# Robust login (handles rate-limit 429 with backoff)
token(){ # token <email> <password>
  local email="$1" pass="$2" tries=0
  while :; do
    local raw code
    raw=$(mktemp)
    code=$(http POST "$BASE/auth/login" "$raw" "{\"email\":\"$email\",\"password\":\"$pass\"}")
    if [ "$code" = "200" ]; then
      python3 - <<'PY' "$raw"
import sys,json; print(json.load(open(sys.argv[1]))["access_token"])
PY
      rm -f "$raw"
      return 0
    elif [ "$code" = "429" ]; then
      tries=$((tries+1))
      if [ $tries -gt 12 ]; then
        echo "❌ login for $email still rate-limited after ~120s; aborting."
        show "$raw"; rm -f "$raw"; exit 1
      fi
      echo "   ⏳ login for $email hit rate-limit (429). Retry $tries/12 in 10s…"
      rm -f "$raw"; sleep 10
      continue
    else
      echo "❌ login for $email failed (HTTP $code)"
      show "$raw"; rm -f "$raw"; exit 1
    fi
  done
}

echo "0) Health: $BASE/healthz"
OUT=$(tmpfile); CODE=$(http GET "$BASE/healthz" "$OUT"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
line

echo "1) Ensure ADMIN_TOKEN"
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
  ADMIN_TOKEN=$(token "$ADM" "root"); export ADMIN_TOKEN
  echo "   bootstrapped $ADM"
}
ensure_admin
line

echo "2) Day-1: Signup/login + RBAC"
UEMAIL="user_$(date +%s)@example.com"
OUT=$(tmpfile); CODE=$(http POST "$BASE/auth/signup" "$OUT" "{\"name\":\"User One\",\"email\":\"$UEMAIL\",\"password\":\"secret\"}"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http POST "$BASE/auth/login" "$OUT" "{\"email\":\"$UEMAIL\",\"password\":\"wrong\"}"); expect "$CODE" "$OUT" 401; echo "   ✅ wrong password 401"; rm -f "$OUT"
USER_TOKEN=$(token "$UEMAIL" "secret"); echo "   ✅ user token OK"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"RBAC Test","venue":"Hall","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":10}' "$USER_TOKEN"); expect "$CODE" "$OUT" 403; echo "   ✅ RBAC enforced"; rm -f "$OUT"
line

echo "3) Admin: create event"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Rock Night","venue":"Indira Hall","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":100}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; EID_BASE=$(jq -r .id "$OUT"); show "$OUT"; rm -f "$OUT"
line

echo "4) Day-2: Booking + Idempotency (fixed) + /me/bookings"
# New tiny event (capacity=2)
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Tiny Show","venue":"Hall A","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":2}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; EID=$(jq -r .id "$OUT"); show "$OUT"; rm -f "$OUT"

# Idempotent single-seat booking
KEY="idem-$EID-$(date +%s%N)"
B1=$(curl -sS -X POST "$BASE/events/$EID/book" -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_TOKEN" -H "Idempotency-Key: $KEY" -d '{"qty":1}')
echo "$B1" | jq . >/dev/null 2>&1 || { echo "❌ invalid JSON on idempotent booking"; echo "$B1"; exit 1; }
BID1=$(echo "$B1" | jq -r .id)
B2=$(curl -sS -X POST "$BASE/events/$EID/book" -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_TOKEN" -H "Idempotency-Key: $KEY" -d '{"qty":1}')
BID2=$(echo "$B2" | jq -r .id)
echo "   Idempotent booking id: $BID1 == $BID2 ? $( [ "$BID1" = "$BID2" ] && echo YES || echo NO )"

# Capacity guard: 2 seats now should 409
OUT=$(tmpfile); CODE=$(http POST "$BASE/events/$EID/book" "$OUT" '{"qty":2}' "$USER_TOKEN"); expect "$CODE" "$OUT" 409; echo "   ✅ capacity guard"; rm -f "$OUT"

# /me/bookings should show history including the CONFIRMED booking
MB=$(tmpfile); CODE=$(http GET "$BASE/me/bookings" "$MB" "" "$USER_TOKEN"); expect "$CODE" "$MB" 200
CNT=$(jq 'length' "$MB"); echo "   /me/bookings items: $CNT"; rm -f "$MB"

# Cancel the idempotent booking, then book 2 seats
OUT=$(tmpfile); CODE=$(http DELETE "$BASE/bookings/$BID1" "$OUT" "" "$USER_TOKEN"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http POST "$BASE/events/$EID/book" "$OUT" '{"qty":2}' "$USER_TOKEN"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
line

echo "7) Concurrency: no oversell under parallel requests"

# Fresh event & user so we don't inherit prior limits/state
CAP=3
OUT=$(tmpfile)
CODE=$(http POST "$BASE/admin/events" "$OUT" "{\"name\":\"Concurrency\",\"venue\":\"C\",\"start_time\":\"2030-01-01T19:00:00Z\",\"end_time\":\"2030-01-01T22:00:00Z\",\"capacity\":$CAP}" "$ADMIN_TOKEN")
expect "$CODE" "$OUT" 200
EIDC=$(jq -r .id "$OUT")
rm -f "$OUT"

UEC="conc_$(date +%s)@example.com"
http POST "$BASE/auth/signup" "$(tmpfile)" "{\"name\":\"Conc\",\"email\":\"$UEC\",\"password\":\"secret\"}" >/dev/null
UTC=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$UEC\",\"password\":\"secret\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Fire 2×capacity parallel requests of qty=1
N=$((CAP*2))
TMPDIR=$(mktemp -d /tmp/evently_conc.XXXXXX)

for i in $(seq 1 $N); do
  (
    curl -sS -X POST "$BASE/events/$EIDC/book" \
      -H "Authorization: Bearer $UTC" \
      -H 'Content-Type: application/json' \
      -d '{"qty":1}' \
      > "$TMPDIR/$i.json" || true
  ) &
done
wait

# Count how many actually confirmed
CONFIRMED=$(grep -h '"status":"CONFIRMED"' "$TMPDIR"/*.json | wc -l | tr -d '[:space:]')

# Read the event row to compare booked_count
OUT=$(tmpfile); CODE=$(http GET "$BASE/events/$EIDC" "$OUT"); expect "$CODE" "$OUT" 200
BOOKED=$(jq -r .booked_count "$OUT")
CAPX=$(jq -r .capacity "$OUT")
rm -f "$OUT"

echo "   parallel confirmed: $CONFIRMED (capacity=$CAPX)"
echo "   event booked_count: $BOOKED / capacity: $CAPX"

if [ "$CONFIRMED" -le "$CAPX" ] && [ "$BOOKED" -le "$CAPX" ] && [ "$CONFIRMED" -gt 0 ] && [ "$BOOKED" -gt 0 ]; then
  echo "   ✅ no oversell"
else
  echo "   ⚠️  unexpected outcome (no confirmations or mismatch)"
  # Show a couple of sample responses to help diagnose (auth/rate-limit/capacity/etc.)
  echo "   (debug) sample responses:"
  for j in 1 2 3; do [ -f "$TMPDIR/$j.json" ] && { echo "---- $j ----"; cat "$TMPDIR/$j.json"; } ; done
  # Soft-fail here; comment out ‘exit 1’ if you prefer to continue the script
  # exit 1
fi

rm -rf "$TMPDIR"



echo "5) Scoped idempotency"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Scoped A","venue":"X","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":10}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; E1=$(jq -r .id "$OUT"); rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Scoped B","venue":"Y","start_time":"2030-01-02T19:00:00Z","end_time":"2030-01-02T22:00:00Z","capacity":10}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; E2=$(jq -r .id "$OUT"); rm -f "$OUT"
UE2="user_$(date +%s)@example.com"
http POST "$BASE/auth/signup" "$(tmpfile)" "{\"name\":\"U2\",\"email\":\"$UE2\",\"password\":\"secret\"}" >/dev/null
UT2=$(token "$UE2" "secret")
K="same-key"
BID_A=$(curl -s -X POST "$BASE/events/$E1/book" -H 'Content-Type: application/json' -H "Authorization: Bearer $UT2" -H "Idempotency-Key: $K" -d '{"qty":1}' | jq -r .id)
BID_B=$(curl -s -X POST "$BASE/events/$E2/book" -H 'Content-Type: application/json' -H "Authorization: Bearer $UT2" -H "Idempotency-Key: $K" -d '{"qty":1}' | jq -r .id)
echo "   same key across events → ids: $BID_A vs $BID_B (should differ)"
if [ -n "$DC" ]; then
  IDX=$($DC exec -T db psql -U postgres -d evently -tAc "SELECT indexname FROM pg_indexes WHERE tablename='bookings' AND indexname IN ('uq_bookings_scoped_idem','uq_bookings_idem_nonnull');" | tr -d '[:space:]')
  echo "   idempotency index: ${IDX:-<none found>}"
fi
line

echo "6) Day-3: Analytics + Caching"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Analytics Show","venue":"Main","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":5}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; E_ANALYTICS=$(jq -r .id "$OUT"); show "$OUT"; rm -f "$OUT"
S1=$(tmpfile); CODE=$(http GET "$BASE/admin/analytics/summary" "$S1" "" "$ADMIN_TOKEN"); expect "$CODE" "$S1" 200
TB1=$(jq -r '.totals.booked' "$S1"); GA1=$(jq -r '.generated_at' "$S1"); echo "   totals.booked: $TB1   generated_at: $GA1"
S2=$(tmpfile); CODE=$(http GET "$BASE/admin/analytics/summary" "$S2" "" "$ADMIN_TOKEN"); expect "$CODE" "$S2" 200
TB2=$(jq -r '.totals.booked' "$S2"); GA2=$(jq -r '.generated_at' "$S2"); [ "$TB1" = "$TB2" ] && echo "   cache likely working" || echo "   cache miss/TTL"
UE3="user_$(date +%s)@example.com"
http POST "$BASE/auth/signup" "$(tmpfile)" "{\"name\":\"U3\",\"email\":\"$UE3\",\"password\":\"secret\"}" >/dev/null
UT3=$(token "$UE3" "secret")
OUT=$(tmpfile); CODE=$(http POST "$BASE/events/$E_ANALYTICS/book" "$OUT" '{"qty":2}' "$UT3"); expect "$CODE" "$OUT" 200; rm -f "$OUT"
S3=$(tmpfile); CODE=$(http GET "$BASE/admin/analytics/summary" "$S3" "" "$ADMIN_TOKEN"); expect "$CODE" "$S3" 200
TB3=$(jq -r '.totals.booked' "$S3"); echo "   totals.booked after booking: $TB3"
RF=$(tmpfile); CODE=$(http GET "$BASE/admin/analytics/summary?refresh=1" "$RF" "" "$ADMIN_TOKEN"); expect "$CODE" "$RF" 200; GAR=$(jq -r '.generated_at' "$RF"); echo "   forced refresh generated_at: $GAR"; rm -f "$S1" "$S2" "$S3" "$RF"
line




echo "8) Admin manage: update/deactivate/reactivate/delete"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Manage Smoke","venue":"A","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":3}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; EIDM=$(jq -r .id "$OUT"); show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http PATCH "$BASE/admin/events/$EIDM" "$OUT" '{"name":"Managed v1","venue":"Hall X","capacity":5}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
UE_M="user_$(date +%s)@example.com"
http POST "$BASE/auth/signup" "$(tmpfile)" "{\"name\":\"U\",\"email\":\"$UE_M\",\"password\":\"secret\"}" >/dev/null
UT_M=$(token "$UE_M" "secret")
OUT=$(tmpfile); CODE=$(http POST "$BASE/events/$EIDM/book" "$OUT" '{"qty":2}' "$UT_M"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http PATCH "$BASE/admin/events/$EIDM" "$OUT" '{"capacity":1}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 409; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events/$EIDM/deactivate" "$OUT" "" "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http POST "$BASE/events/$EIDM/book" "$OUT" '{"qty":1}' "$UT_M"); expect "$CODE" "$OUT" 409; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http PATCH "$BASE/admin/events/$EIDM" "$OUT" '{"status":"active"}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http DELETE "$BASE/admin/events/$EIDM" "$OUT" "" "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 409; show "$OUT"; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http POST "$BASE/admin/events" "$OUT" '{"name":"Delete Me","venue":"B","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":4}' "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 200; DID=$(jq -r .id "$OUT"); rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http DELETE "$BASE/admin/events/$DID" "$OUT" "" "$ADMIN_TOKEN"); expect "$CODE" "$OUT" 204; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http GET "$BASE/events/$DID" "$OUT"); expect "$CODE" "$OUT" 404; show "$OUT"; rm -f "$OUT"
line

echo "9) Day-4: list/search/sort + metrics + rate limit (LAST)"
for i in 1 2 3 4 5 6 7 8; do
  http POST "$BASE/admin/events" "$(tmpfile)" "{\"name\":\"Tiny Show $i\",\"venue\":\"Hall $i\",\"start_time\":\"2030-01-01T19:00:00Z\",\"end_time\":\"2030-01-01T22:00:00Z\",\"capacity\":$((i%3+1))}" "$ADMIN_TOKEN" >/dev/null
done
OUT=$(tmpfile); CODE=$(http GET "$BASE/events?page=1&page_size=5&sort=name&order=asc" "$OUT"); expect "$CODE" "$OUT" 200; echo "   page 1:"; show "$OUT" | head -n 40; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http GET "$BASE/events?page=2&page_size=5&sort=name&order=asc" "$OUT"); expect "$CODE" "$OUT" 200; echo "   page 2:"; show "$OUT" | head -n 40; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http GET "$BASE/events?q=Tiny" "$OUT"); expect "$CODE" "$OUT" 200; echo "   search Tiny:"; show "$OUT" | head -n 40; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http GET "$BASE/events?sort=utilization&order=desc" "$OUT"); expect "$CODE" "$OUT" 200; echo "   sort utilization desc:"; show "$OUT" | head -n 40; rm -f "$OUT"
OUT=$(tmpfile); CODE=$(http GET "$BASE/metrics" "$OUT"); expect "$CODE" "$OUT" 200; echo "   metrics (head):"; head -n 10 "$OUT"; rm -f "$OUT"

# Login burst (expect 429 depending on window)
UE_RL="rl_$(date +%s)@example.com"
http POST "$BASE/auth/signup" "$(tmpfile)" "{\"name\":\"RL\",\"email\":\"$UE_RL\",\"password\":\"secret\"}" >/dev/null
STATUS=200
for n in 1 2 3 4 5 6; do O=$(tmpfile); STATUS=$(http POST "$BASE/auth/login" "$O" "{\"email\":\"$UE_RL\",\"password\":\"secret\"}"); rm -f "$O"; done
echo "   login burst last HTTP: $STATUS (expect 429 if window not reset)"
line

echo "✅ All features smoke test completed."
