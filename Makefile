.PHONY: help install start stop restart build logs clean db-migrate db-reset codegen test lint format

# Default target
help:
	@echo "App Template - Available Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install      - First-time setup (copy .env, install deps)"
	@echo "  make start        - Start all services"
	@echo "  make stop         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make build        - Rebuild all containers"
	@echo ""
	@echo "Development:"
	@echo "  make logs         - View all logs (Ctrl+C to exit)"
	@echo "  make logs-backend - View backend logs"
	@echo "  make logs-frontend- View frontend logs"
	@echo "  make logs-mcp     - View MCP server logs"
	@echo "  make codegen      - Generate TypeScript types from API"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-revision  - Create new migration (use msg='description')"
	@echo "  make db-reset     - Reset database (WARNING: deletes data)"
	@echo "  make db-shell     - Open psql shell"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run backend tests"
	@echo "  make test-frontend- Run frontend tests"
	@echo ""
	@echo "MCP:"
	@echo "  make mcp-config   - Generate MCP config for Claude"
	@echo "  make mcp-install  - Install MCP config to Claude"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Stop and remove containers"
	@echo "  make clean-all    - Stop, remove containers AND volumes (deletes DB)"

# =============================================================================
# SETUP
# =============================================================================

install:
	@echo "Setting up project..."
	@test -f .env || cp .env.example .env
	@echo "Building containers..."
	@docker compose build
	@echo ""
	@echo "Done! Run 'make start' to start the services."

start:
	@echo "Starting services..."
	@docker compose up -d
	@echo ""
	@echo "Services started!"
	@echo "  Frontend:  http://localhost:5173"
	@echo "  Backend:   http://localhost:8000"
	@echo "  API Docs:  http://localhost:8000/docs"
	@echo "  MCP:       http://localhost:8080"
	@echo ""
	@echo "Run 'make logs' to view logs"

stop:
	@echo "Stopping services..."
	@docker compose down

restart: stop start

build:
	@echo "Rebuilding containers..."
	@docker compose up -d --build

# =============================================================================
# LOGS
# =============================================================================

logs:
	@docker compose logs -f

logs-backend:
	@docker compose logs -f backend

logs-frontend:
	@docker compose logs -f frontend

logs-mcp:
	@docker compose logs -f mcp-server

logs-db:
	@docker compose logs -f db

# =============================================================================
# DATABASE
# =============================================================================

db-migrate:
	@echo "Running migrations..."
	@docker compose exec backend alembic upgrade head

db-revision:
	@if [ -z "$(msg)" ]; then \
		echo "Usage: make db-revision msg='your migration message'"; \
		exit 1; \
	fi
	@docker compose exec backend alembic revision --autogenerate -m "$(msg)"

db-reset:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker compose down -v
	@docker compose up -d db
	@sleep 3
	@docker compose up -d backend
	@sleep 2
	@docker compose exec backend alembic upgrade head
	@docker compose up -d
	@echo "Database reset complete!"

db-shell:
	@docker compose exec db psql -U app -d app

# =============================================================================
# CODEGEN
# =============================================================================

codegen:
	@echo "Generating TypeScript types from OpenAPI..."
	@cd frontend && npm run codegen
	@echo "Types generated at frontend/src/api/types.ts"

# =============================================================================
# TESTING
# =============================================================================

test:
	@echo "Running backend tests..."
	@docker compose exec backend pytest

test-frontend:
	@echo "Running frontend tests..."
	@cd frontend && npm test

lint:
	@echo "Linting..."
	@cd frontend && npm run lint

# =============================================================================
# MCP
# =============================================================================

mcp-config:
	@python scripts/generate-mcp-config.py

mcp-install:
	@python scripts/generate-mcp-config.py --install
	@echo ""
	@echo "MCP config installed! Restart Claude to connect."

# =============================================================================
# CLEANUP
# =============================================================================

clean:
	@echo "Stopping and removing containers..."
	@docker compose down --remove-orphans

clean-all:
	@echo "WARNING: This will delete all data including the database!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker compose down -v --remove-orphans
	@echo "Cleaned up!"

# =============================================================================
# SHORTCUTS
# =============================================================================

up: start
down: stop
ps:
	@docker compose ps

shell-backend:
	@docker compose exec backend bash

shell-frontend:
	@docker compose exec frontend sh
