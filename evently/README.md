# Evently – FastAPI + Postgres + Redis

A tiny event booking API you can stand up in minutes. It covers:

- Auth (JWT), RBAC (admin)
- Events (admin create) + public listing with **pagination / search / sorting**
- Bookings with **capacity guard** and **idempotency**
- Analytics summary with **Redis caching** (+ cache invalidation on mutations)
- **Rate-limiting** (SlowAPI + Redis)
- **Prometheus** metrics at `/metrics`

---

## 🏗️ Stack

- **API**: FastAPI, Uvicorn
- **DB**: PostgreSQL + SQLAlchemy + Alembic
- **Cache/queues**: Redis
- **Auth**: JWT (HS256)
- **Other**: SlowAPI (rate limit), prometheus-fastapi-instrumentator (metrics), Pydantic v2

---

## 🔧 Prerequisites

- Docker & Docker Compose
- `curl`, `jq`, `python3`
- (Optional) access to `psql` inside the DB container

---

## ⚙️ Quickstart

```bash
# 1) Build & start
sudo docker compose up -d --build

# 2) Tail logs (api)
docker compose logs -f api

# 3) Healthcheck
curl http://localhost:8000/healthz
# -> {"status":"ok"}

# (Optional) apply migrations explicitly
sudo docker compose exec api alembic upgrade head

## 🔑 Environment
Create a .env file (values here match docker-compose defaults):
# JWT
JWT_SECRET=please_change_me
ACCESS_TOKEN_EXPIRE_MINUTES=120

# DB (matches compose; add username/password if you configure them)
DATABASE_URL=postgresql+psycopg2://postgres@db:5432/evently

# Redis
REDIS_URL=redis://redis:6379/0

# Logging
LOG_LEVEL=info


# Evently Backend

**Production-grade REST API for event browsing, seat-aware ticket booking, waitlists, and admin analytics.**  
Built with **FastAPI**, **SQLAlchemy**, **PostgreSQL**, **Redis**, and **Alembic**.

---

## ✨ Features

### Auth (JWT)
- Signup / Login
- Get current user info (`/auth/me`)
- Role-based access (user, admin)

### Events
- List, search, sort, and paginate events
- Per-event `booked_count`, `capacity`, `waitlisted_count`
- Seat-aware events with `/events/{id}/seats`

### Booking
- Book tickets by quantity or specific seats (`seat_ids`)
- **Idempotent** bookings via `Idempotency-Key` (per user + event)
- Concurrency-safe (row locks prevent oversell)
- **Waitlist support**: auto-promotions on cancellations or capacity changes
- User bookings: `/me/bookings`, cancel via `/bookings/{id}`
- Admin can list all bookings (`/admin/bookings`)

### Admin
- Full CRUD for events
- User management (list, create, update roles)
- Optional seat grid generation
- Analytics with Redis caching and forced refresh
- Guardrails (e.g., capacity cannot drop below booked count)

### Stats
- `/stats/homepage` — homepage summary for frontend

### Ops
- `/healthz` health probe
- `/metrics` Prometheus endpoint
- Rate limiting on sensitive endpoints

---

## 🧱 Stack

- **Backend:** FastAPI + Uvicorn (Python 3.11)
- **Database:** PostgreSQL 15+, SQLAlchemy ORM, Alembic migrations
- **Cache / Rate-limit:** Redis
- **Auth:** JWT (HS256)

---

## 🚀 Quick Start

1. **Run with Docker Compose**
   ```bash
   docker compose up --build
   ```
   - API → http://localhost:8000  
   - Redis → localhost:6379  
   - DB → localhost:5432  

2. **Bootstrap an Admin**
   ```bash
   BASE=http://localhost:8000
   ADM="admin_$(date +%s)@example.com"

   # create user
   curl -sS -X POST "$BASE/auth/signup"      -H 'Content-Type: application/json'      -d "{\"name\":\"Admin\",\"email\":\"$ADM\",\"password\":\"root\"}" >/dev/null

   # promote in DB
   docker compose exec -T db psql -U postgres -d evently      -c "UPDATE users SET role='admin' WHERE email='${ADM}';"

   # login → ADMIN_TOKEN
   ADMIN_TOKEN=$(curl -sS -X POST "$BASE/auth/login"      -H 'Content-Type: application/json'      -d "{\"email\":\"$ADM\",\"password\":\"root\"}" | jq -r .access_token)

   echo "ADMIN_TOKEN=${ADMIN_TOKEN:0:20}..."
   ```

3. **(Optional) Smoke Test**
   ```bash
   ./smoke_test.sh
   ```

---

## ⚙️ Configuration

| Variable         | Example                                                         |
|------------------|-----------------------------------------------------------------|
| `DATABASE_URL`   | `postgresql+psycopg2://postgres:postgres@db:5432/evently`       |
| `REDIS_URL`      | `redis://redis:6379/0`                                         |
| `JWT_SECRET`     | `change-me`                                                     |
| `JWT_EXPIRES_MIN`| `1440`                                                          |
| `CORS_ORIGINS`   | `http://localhost:5173`                                        |

Migrations run automatically via Alembic.

---

## 🗃 Data Model (High Level)

- **users**: `id, name, email, password_hash, role`
- **events**: `id, name, venue, start_time, end_time, capacity, booked_count, status`
- **bookings**: `id, user_id, event_id, qty, status, idempotency_key, created_at`
- **seats**: `id, event_id, label, row_label, col_number, reserved, reserved_booking_id`

Includes **unique indexes** for idempotency (per user + event).

---

## 🔌 API Overview

**Base URL:** `http://localhost:8000`

### Auth
- `POST /auth/signup` → Create new user
- `POST /auth/login` → returns `{ access_token }`
- `GET /auth/me` → current user info (requires JWT)

### Public Events
- `GET /events`
- `GET /events/{id}`
- `GET /events/{id}/seats`

### Booking (user)
- `POST /events/{id}/book`
- `GET /me/bookings`
- `DELETE /bookings/{id}`

### Admin
- `POST /admin/events`
- `PATCH /admin/events/{id}`
- `POST /admin/events/{id}/deactivate`
- `DELETE /admin/events/{id}`
- `POST /admin/events/{id}/seats/generate` *(optional, backend-only)*
- `GET /admin/bookings` → list all bookings
- **User Management**
  - `GET /admin/users` → list all users
  - `POST /admin/users` → create admin/user
  - `PATCH /admin/users/{id}/role` → update user role

### Stats
- `GET /stats/homepage` → homepage statistics

### Analytics
- `GET /admin/analytics/summary?refresh=1`

---

## 🧠 Core Business Rules

- **Idempotency:** Safe retries with `Idempotency-Key`
- **Concurrency:** Row locks (`SELECT … FOR UPDATE`) prevent overselling
- **Waitlist:** FIFO promotions on cancellations/capacity updates
- **Seats:**  
  - Explicit seat grid via admin  
  - Auto-grid generation (10 per row) if missing on first booking
- **Analytics Cache:** Redis, 60s TTL, invalidated on booking/event/user mutations
- **Rate Limiting:** Enforced via SlowAPI

---

## 📘 Usage Examples

**Get Current User**
```bash
curl -sS "$BASE/auth/me" -H "Authorization: Bearer $USER_TOKEN"
```

**List Users (admin)**
```bash
curl -sS "$BASE/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Create Admin User**
```bash
curl -sS -X POST "$BASE/admin/users"   -H "Authorization: Bearer $ADMIN_TOKEN"   -H 'Content-Type: application/json'   -d '{"name":"Staff","email":"staff@example.com","password":"root"}'
```

**Update User Role**
```bash
curl -sS -X PATCH "$BASE/admin/users/42/role"   -H "Authorization: Bearer $ADMIN_TOKEN"   -H 'Content-Type: application/json'   -d '{"role":"admin"}'
```

**Homepage Stats**
```bash
curl -sS "$BASE/stats/homepage"
```

---

## ✅ Testing & Dev Utilities

- `./smoke_test.sh` covers:
  - Auth, RBAC, idempotency
  - Capacity guard
  - Waitlist logic
  - Analytics caching
  - Metrics and rate-limits
- Includes **parallel-booking test** to prove no overselling

---

## 🔐 Security Notes

- Passwords stored as strong hashes
- Constant-time password checks
- JWT secret must remain private
- Admin endpoints fully role-guarded
- Rate-limiting protects login/booking/admin endpoints

---

## 🗺️ Routes Summary

```
/healthz
/metrics

/auth/signup
/auth/login
/auth/me

/events
/events/{id}
 /events/{id}/seats

/events/{id}/book               (POST, user)
/me/bookings                    (GET, user)
/bookings/{id}                  (DELETE, user/admin)

/admin/events                   (POST, admin)
/admin/events/{id}              (PATCH, admin)
/admin/events/{id}/deactivate   (POST, admin)
/admin/events/{id}              (DELETE, admin)
/admin/events/{id}/seats/generate  (POST, admin, optional)

/admin/bookings                 (GET, admin)
/admin/users                    (GET, admin)
/admin/users                    (POST, admin)
/admin/users/{id}/role          (PATCH, admin)

/admin/analytics/summary        (GET, admin?refresh=1)

/stats/homepage                 (GET)
```

---

## 📄 License & Contributions

See repository settings for license.  
PRs welcome — include tests for booking/waitlist/seating logic and keep endpoints backward-compatible.


