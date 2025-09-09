# Evently — Core Docs
## evently  ------Contains Backend logic.
## evently-frontdoor ---- it contains Frontend.

**Production-grade REST API for event browsing, seat-aware ticket booking, waitlists, and admin analytics.**  
Backed by **FastAPI**, **PostgreSQL**, **SQLAlchemy**, **Alembic**, **Redis**, **JWT**, and **Prometheus** metrics.

---

## 🏗 Architecture & Stack

- **API**: FastAPI (Python 3.11), Uvicorn
- **DB**: PostgreSQL (SQLAlchemy ORM, Alembic migrations)
- **Cache**: Redis (analytics caching, rate limiting)
- **Auth**: JWT (HS256)
- **Ops**: SlowAPI (rate limiting), Prometheus metrics at `/metrics`

---

## 🔧 Prerequisites

- Docker & Docker Compose
- `curl`, `jq`, `python3`
- (Optional) `psql` access inside the DB container
- (Optional) Frontend: Node.js 18+ (Vite dev server)

---

## ⚙️ Quick Start

```bash
# Build & start
docker compose up -d --build   # use `sudo` if your Docker requires it

# Tail API logs
docker compose logs -f api

# Healthcheck
curl http://localhost:8000/healthz
# -> {"status":"ok"}

#  apply migrations explicitly
docker compose exec api alembic upgrade head
```

---

## 🔑 Environment

Create a `.env` file (values match docker-compose defaults):

```env
# JWT
JWT_SECRET=please_change_me
ACCESS_TOKEN_EXPIRE_MINUTES=120

# Database
DATABASE_URL=postgresql+psycopg2://postgres@db:5432/evently

# Redis
REDIS_URL=redis://redis:6379/0

# Logging
LOG_LEVEL=info
```

---

## 👥 Auth & RBAC

- **Signup** → `POST /auth/signup`
- **Login** → `POST /auth/login` → returns `{ "access_token": "..." }`
- **Me** → `GET /auth/me` (requires `Authorization: Bearer <token>`)
- **Roles**: `user`, `admin` (admin-only endpoints are role-guarded)

### Bootstrap an Admin (example)
```bash
BASE=http://localhost:8000
ADM="admin_$(date +%s)@example.com"

# 1) Create a normal user
curl -sS -X POST "$BASE/auth/signup"   -H 'Content-Type: application/json'   -d "{"name":"Admin","email":"$ADM","password":"root"}" >/dev/null

# 2) Promote to admin in Postgres
docker compose exec -T db   psql -U postgres -d evently   -c "UPDATE users SET role='admin' WHERE email='${ADM}';"

# 3) Login to get ADMIN_TOKEN
ADMIN_TOKEN=$(curl -sS -X POST "$BASE/auth/login"   -H 'Content-Type: application/json'   -d "{"email":"$ADM","password":"root"}" | jq -r .access_token)
echo "ADMIN_TOKEN=${ADMIN_TOKEN:0:20}..."
```

---

## 🗃 High-Level Data Model (Persisted Columns)

> Shapes below reflect stored columns; responses may include additional computed fields.

- **users**: `id, name, email, password_hash, role`
- **events**: `id, name, venue, start_time, end_time, capacity, booked_count, status`
- **bookings**: `id, user_id, event_id, qty, status, idempotency_key, created_at`
- **seats**: `id, event_id, label, row_label, col_number, reserved, reserved_booking_id`

---

## 🔌 API Overview

**Base URL:** `http://localhost:8000`

### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

### Public Events
- `GET /events` — public listing (supports pagination/search/sorting)
- `GET /events/{id}`
- `GET /events/{id}/seats`

### Booking (User)
- `POST /events/{id}/book` — **idempotent**, supports quantity and seat-based booking
- `GET /me/bookings`
- `DELETE /bookings/{id}`

### Admin
- `POST /admin/events`
- `PATCH /admin/events/{id}`
- `POST /admin/events/{id}/deactivate`
- `DELETE /admin/events/{id}`
- `POST /admin/events/{id}/seats/generate` *(optional seat grid generation)*
- `GET /admin/bookings`
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/{id}/role`

### Stats & Analytics
- `GET /stats/homepage`
- `GET /admin/analytics/summary` *(supports a `refresh` query to bypass cache)*

### Ops
- `GET /healthz`
- `GET /metrics` (Prometheus)

---

## 🧠 Core Business Rules

- **Idempotency**:  
  All booking requests must include an `Idempotency-Key` header (scoped to user+event).  
  Safe retries won’t double-charge, double-book, or oversell.

- **Concurrency & Capacity**:  
  Overselling is prevented via row-level locks (`SELECT … FOR UPDATE`) and capacity guards.

- **Waitlist**:  
  When an event is full, bookings can be placed on a waitlist and promoted FIFO on cancellations or capacity increases.

- **Seats**:  
  - Explicit seat maps are supported per event.  
  - If missing, the server can auto-generate a grid (10 per row) on first booking.  
  - Seat availability is enforced; reserved seats are tied to the booking that reserved them.

- **Analytics Cache**:  
  Redis caching (TTL ~60s) for analytics; cache is invalidated on relevant mutations. A `refresh` query can force recomputation.

- **Rate Limiting**:  
  Sensitive endpoints (e.g., login/booking/admin) are protected via SlowAPI + Redis.

---

## 🧪 Examples

> Replace `$BASE` and tokens as appropriate.

**Login & Me**
```bash
USER_TOKEN=$(curl -sS -X POST "$BASE/auth/login"   -H 'Content-Type: application/json'   -d '{"email":"user@example.com","password":"secret"}' | jq -r .access_token)

curl -sS "$BASE/auth/me" -H "Authorization: Bearer $USER_TOKEN"
```

**List Events**
```bash
curl -sS "$BASE/events"
```

**Get Event + Seats**
```bash
curl -sS "$BASE/events/42"
curl -sS "$BASE/events/42/seats"
```

**Book by Quantity (idempotent)**
```bash
curl -sS -X POST "$BASE/events/42/book"   -H "Authorization: Bearer $USER_TOKEN"   -H "Content-Type: application/json"   -H "Idempotency-Key: user42-event42-attempt1"   -d '{"quantity": 2}'
```

**Book by Seats (idempotent)**
```bash
curl -sS -X POST "$BASE/events/42/book"   -H "Authorization: Bearer $USER_TOKEN"   -H "Content-Type: application/json"   -H "Idempotency-Key: user42-event42-seatsA1A2"   -d '{"seat_ids": ["A-1","A-2"]}'
```

**Cancel Booking**
```bash
curl -sS -X DELETE "$BASE/bookings/123"   -H "Authorization: Bearer $USER_TOKEN"
```

**Admin: Create Event**
```bash
curl -sS -X POST "$BASE/admin/events"   -H "Authorization: Bearer $ADMIN_TOKEN"   -H "Content-Type: application/json"   -d '{
        "name": "Dev Summit",
        "venue": "Hall A",
        "start_time": "2025-09-20T10:00:00Z",
        "end_time": "2025-09-20T17:00:00Z",
        "capacity": 200
      }'
```

**Admin: Users & Roles**
```bash
curl -sS "$BASE/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN"

curl -sS -X POST "$BASE/admin/users"   -H "Authorization: Bearer $ADMIN_TOKEN"   -H "Content-Type: application/json"   -d '{"name":"Staff","email":"staff@example.com","password":"root"}'

curl -sS -X PATCH "$BASE/admin/users/42/role"   -H "Authorization: Bearer $ADMIN_TOKEN"   -H "Content-Type: application/json"   -d '{"role":"admin"}'
```

**Stats & Analytics**
```bash
curl -sS "$BASE/stats/homepage"
curl -sS "$BASE/admin/analytics/summary"               # cached
curl -sS "$BASE/admin/analytics/summary?refresh=1"     # force refresh
```

---

## 🛡 Security Notes

- Passwords are stored as strong hashes with constant-time verification.
- JWT secret **must** remain private; tokens are sent via `Authorization: Bearer`.
- Admin endpoints require `admin` role.
- Rate limiting reduces abuse on sensitive routes.

---

## 🧰 Dev & Testing

- `./smoke_test.sh` exercises:
  - Auth & RBAC
  - Idempotency on booking
  - Capacity guard & waitlist
  - Analytics caching
  - Metrics and rate limits

---

## 🖥️ Frontend

- Dev server: `http://localhost:5173`
- API base URL (default): `http://localhost:8000`
- To override, set `VITE_API_BASE` in a `.env.local`.

```bash
# From the frontend project root
npm install
npm run dev
```

---

## 🩺 Health & Metrics

- `GET /healthz` → `{"status":"ok"}`
- `GET /metrics` → Prometheus exposition format

---

