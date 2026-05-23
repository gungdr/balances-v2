.PHONY: up down logs ps backend-run backend-build backend-test backend-migrate-up backend-migrate-down backend-migrate-status backend-tidy backend-sqlc frontend-install frontend-dev frontend-build backend-stop backend-restart frontend-stop frontend-restart restart servers-status

-include .env
export

# Background dev-server logs. tail -f to follow.
BACKEND_LOG  := /tmp/balances-backend.log
FRONTEND_LOG := /tmp/balances-frontend.log

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
