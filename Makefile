.PHONY: up down logs ps backend-run backend-build backend-migrate-up backend-migrate-down backend-migrate-status backend-tidy frontend-install frontend-dev frontend-build

-include .env
export

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

backend-migrate-up:
	cd backend && go run ./cmd/balances migrate up

backend-migrate-down:
	cd backend && go run ./cmd/balances migrate down

backend-migrate-status:
	cd backend && go run ./cmd/balances migrate status

backend-tidy:
	cd backend && go mod tidy

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
