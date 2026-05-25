.PHONY: up down logs ps backend-run backend-build backend-test backend-migrate-up backend-migrate-down backend-migrate-status backend-tidy backend-sqlc frontend-install frontend-dev frontend-build backend-stop backend-restart frontend-stop frontend-restart restart servers-status e2e-db-create e2e-seed e2e-backend

-include .env
export

# Background dev-server logs. tail -f to follow.
BACKEND_LOG  := /tmp/balances-backend.log
FRONTEND_LOG := /tmp/balances-frontend.log

# E2E (ADR-0024): a dedicated database in the same Postgres container, plus the
# backend pointed at it. PG_CONTAINER / PG_USER match docker-compose defaults.
# E2E_DATABASE_URL is DATABASE_URL with the db name swapped to balances_e2e, so
# it inherits host/port/credentials from .env without duplicating them.
PG_CONTAINER := balances-v2-postgres-1
PG_USER      := balances
E2E_DB       := balances_e2e
E2E_DATABASE_URL := $(shell echo "$(DATABASE_URL)" | sed 's|/balances?|/$(E2E_DB)?|')

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

backend-run:
	cd backend && go run ./cmd/balances serve

backend-build:
	cd backend && go build -o bin/balances ./cmd/balances

backend-test:
	cd backend && go test ./...

backend-migrate-up:
	cd backend && go run ./cmd/balances migrate up

backend-migrate-down:
	cd backend && go run ./cmd/balances migrate down

backend-migrate-status:
	cd backend && go run ./cmd/balances migrate status

backend-tidy:
	cd backend && go mod tidy

backend-sqlc:
	cd backend && sqlc generate

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

# ----- background dev servers ---------------------------------------------
# `make restart` kills any running backend + frontend dev processes and
# starts fresh ones in the background, redirecting output to log files.
# Useful after schema/migration changes (backend re-runs goose on serve)
# or when iterating on env vars. Per-side variants exist for partial
# restarts; `servers-status` shows what's running.

backend-stop:
	@pkill -f 'go run ./cmd/balances' 2>/dev/null || true
	@pkill -x balances 2>/dev/null || true
	@sleep 1
	@echo "backend: stopped"

backend-restart: backend-stop
	@cd backend && nohup go run ./cmd/balances serve > $(BACKEND_LOG) 2>&1 &
	@sleep 1
	@echo "backend: started (log: $(BACKEND_LOG))"

frontend-stop:
	@pkill -f 'frontend/node_modules/.bin/vite' 2>/dev/null || true
	@pkill -f 'npm run dev' 2>/dev/null || true
	@echo "frontend: stopped"

frontend-restart: frontend-stop
	@cd frontend && nohup npm run dev > $(FRONTEND_LOG) 2>&1 &
	@sleep 1
	@echo "frontend: started (log: $(FRONTEND_LOG))"

restart: backend-restart frontend-restart
	@echo "both servers restarted"

# ----- e2e (backend half; full `make e2e` lands with the Playwright work) ---
# e2e-db-create  : create balances_e2e in the running container if missing
# e2e-seed       : migrate + reset balances_e2e to the Playwright fixture, print SESSION_ID
# e2e-backend    : run the backend against balances_e2e (foreground)

e2e-db-create:
	@docker exec $(PG_CONTAINER) psql -U $(PG_USER) -d postgres -tAc \
	  "SELECT 1 FROM pg_database WHERE datname='$(E2E_DB)'" | grep -q 1 \
	  || docker exec $(PG_CONTAINER) createdb -U $(PG_USER) $(E2E_DB)
	@echo "e2e db: $(E2E_DB) ready"

e2e-seed: e2e-db-create
	@cd backend && DATABASE_URL="$(E2E_DATABASE_URL)" go run ./cmd/balances seed-e2e

e2e-backend: e2e-db-create
	@cd backend && DATABASE_URL="$(E2E_DATABASE_URL)" go run ./cmd/balances serve

servers-status:
	@if pgrep -f 'cmd/balances serve' >/dev/null; then \
	  echo "backend:  running (pid $$(pgrep -f 'cmd/balances serve' | head -1))"; \
	else \
	  echo "backend:  stopped"; \
	fi
	@if pgrep -f 'frontend/node_modules/.bin/vite' >/dev/null; then \
	  echo "frontend: running (pid $$(pgrep -f 'frontend/node_modules/.bin/vite' | head -1))"; \
	else \
	  echo "frontend: stopped"; \
	fi
