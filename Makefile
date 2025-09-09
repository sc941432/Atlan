# ---- Atlan Monorepo ----
# Backend: evently (FastAPI, Postgres, Redis via docker-compose)
# Frontend: evently-frontdoor (Vite)

SHELL := /bin/bash
COMPOSE := docker compose -f evently/docker-compose.yml
LOG_SVC ?= api

.PHONY: help setup dev front-install front-build front-dev \
        back-up-core back-up-core-build back-start back-up back-up-build \
        back-wait back-migrate back-migrate-exec back-restart \
        back-logs back-logs-fresh back-down back-reset \
        back-services back-ps \
        up-safe up-safe-build clean

help:
	@echo "Targets:"
	@echo "  make setup            -> Install FE deps + create example envs"
	@echo "  make dev              -> Start backend safely (no build) then FE dev"
	@echo "  make front-install    -> npm install (frontend)"
	@echo "  make front-build      -> npm ci && npm run build (frontend)"
	@echo "  make front-dev        -> npm run dev (frontend)"
	@echo "  make up-safe          -> DB+Redis -> wait -> migrate -> start API -> tail fresh logs"
	@echo "  make up-safe-build    -> Same as up-safe but rebuild images first"
	@echo "  make back-reset       -> compose down -v (wipe DB/Redis) then up-safe-build"
	@echo "  make back-logs        -> Tail all api logs    (LOG_SVC?=$(LOG_SVC))"
	@echo "  make back-logs-fresh  -> Tail fresh api logs  (last 30s)"
	@echo "  make back-down        -> Stop backend services"
	@echo "  make back-services    -> List compose services"
	@echo "  make back-ps          -> docker compose ps"
	@echo "  make clean            -> Remove node_modules & py caches"

# -----------------------------
# Setup (env examples + FE deps)
# -----------------------------
setup: front-install
	@if [ ! -f evently-frontdoor/.env.example ]; then \
	  echo "VITE_API_BASE=http://localhost:8000" > evently-frontdoor/.env.example; \
	  echo "✅ Wrote evently-frontdoor/.env.example"; \
	fi
	@if [ ! -f evently/.env.example ]; then \
	  echo "DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/evently" > evently/.env.example; \
	  echo "REDIS_URL=redis://redis:6379/0" >> evently/.env.example; \
	  echo "JWT_SECRET=change-me" >> evently/.env.example; \
	  echo "JWT_EXPIRE_MINUTES=60" >> evently/.env.example; \
	  echo "ENV=dev" >> evently/.env.example; \
	  echo "CORS_ORIGINS=http://localhost:5173,http://localhost:8080" >> evently/.env.example; \
	  echo "✅ Wrote evently/.env.example"; \
	fi
	@echo "👉 Copy examples to real envs if needed:"
	@echo "   cp evently-frontdoor/.env.example evently-frontdoor/.env.local"
	@echo "   cp evently/.env.example evently/.env"

# -----------------------------
# Frontend
# -----------------------------
front-install:
	cd evently-frontdoor && npm install

front-build:
	cd evently-frontdoor && npm ci && npm run build

front-dev:
	cd evently-frontdoor && npm run dev

# Start backend safely then FE dev
dev: up-safe
	cd evently-frontdoor && npm install && npm run dev

# -----------------------------
# Backend (compose)
# -----------------------------

# Start ONLY db + redis (no API)
back-up-core:
	$(COMPOSE) up -d db redis
	@echo "✅ DB & Redis up (no API)."

# Rebuild & start ONLY db + redis (no API)
back-up-core-build:
	$(COMPOSE) up -d --build db redis
	@echo "✅ DB & Redis rebuilt & up (no API)."

# Legacy convenience: start db, redis, api together
back-up:
	$(COMPOSE) up -d db redis api
	@echo "✅ Backend up (no build). Tail logs with: make back-logs"

# Legacy convenience: rebuild & start db, redis, api together
back-up-build:
	$(COMPOSE) up -d --build db redis api
	@echo "✅ Backend rebuilt & up. Tail logs with: make back-logs"

# Wait for DB to accept connections
back-wait:
	@until $(COMPOSE) exec -T db pg_isready -U postgres -d evently >/dev/null 2>&1; do \
	  echo "⏳ waiting for Postgres..."; sleep 1; \
	done; \
	echo "✅ Postgres ready"

# Run Alembic migrations inside api container with DATABASE_URL injected from evently/.env
back-migrate:
	@DBURL=$$(grep -E '^DATABASE_URL=' evently/.env | cut -d= -f2-); \
	if [ -z "$$DBURL" ]; then echo "❌ DATABASE_URL not found in evently/.env"; exit 1; fi; \
	echo "➡️  Running migrations using $$DBURL"; \
	$(COMPOSE) run --rm -e DATABASE_URL="$$DBURL" --entrypoint "" api bash -lc 'echo Using $$DATABASE_URL && alembic upgrade head'
	@echo "✅ Alembic migrations applied"

# Fallback: start API first, then run migrations via exec (uses service env)
back-migrate-exec: back-start
	$(COMPOSE) exec -T api alembic upgrade head
	@echo "✅ Alembic migrations applied via exec"

# Start API (after DB is ready & migrated)
back-start:
	$(COMPOSE) up -d api
	@echo "🚀 API started"

# Restart API cleanly
back-restart:
	$(COMPOSE) restart api
	@echo "🔁 API restarted"

# Logs
back-logs:
	$(COMPOSE) logs -f $(LOG_SVC)

back-logs-fresh:
	$(COMPOSE) logs --since=30s -f $(LOG_SVC)

# Stop backend
back-down:
	$(COMPOSE) down

# Full reset: stop + wipe volumes, then rebuild & safe bring-up
back-reset:
	$(COMPOSE) down -v || true
	$(MAKE) up-safe-build

# Inspect
back-services:
	$(COMPOSE) config --services

back-ps:
	$(COMPOSE) ps

# -----------------------------
# One-shot SAFE flows (recommended)
# -----------------------------

# No build: db+redis -> wait -> migrate -> start api -> fresh logs
up-safe: back-up-core back-wait back-migrate back-start back-logs-fresh

# With build: rebuild db+redis -> wait -> migrate -> start api -> fresh logs
up-safe-build: back-up-core-build back-wait back-migrate back-start back-logs-fresh

# -----------------------------
# Clean caches
# -----------------------------
clean:
	rm -rf evently-frontdoor/node_modules
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
