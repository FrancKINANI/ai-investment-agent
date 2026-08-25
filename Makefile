# ─── Ledgerline Makefile ──────────────────────────────────────────────────
# Convenience commands for Docker and development

.PHONY: help dev prod stop clean logs test build

# Default target
help: ## Show this help message
	@echo "Ledgerline - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Development ──────────────────────────────────────────────────────────

dev: ## Start development environment with hot reload
	docker-compose up

dev-d: ## Start development environment in background
	docker-compose up -d

dev-build: ## Build and start development environment
	docker-compose up --build

# ─── Production ───────────────────────────────────────────────────────────

prod: ## Start production environment
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-build: ## Build and start production environment
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-logs: ## Show production logs
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# ─── Database ─────────────────────────────────────────────────────────────

db-push: ## Push database schema
	docker-compose exec app pnpm db:push

db-shell: ## Open MySQL shell
	docker-compose exec mysql mysql -u ledgerline -pledgeledgerline ledgerline

db-reset: ## Reset database (WARNING: destroys data)
	docker-compose down -v
	docker-compose up -d mysql
	@echo "Waiting for MySQL to be ready..."
	@sleep 10
	docker-compose exec app pnpm db:push

# ─── Management ───────────────────────────────────────────────────────────

stop: ## Stop all containers
	docker-compose down

clean: ## Stop and remove all containers, volumes, and images
	docker-compose down -v --rmi all

logs: ## Show logs from all containers
	docker-compose logs -f

logs-app: ## Show app logs only
	docker-compose logs -f app

logs-mysql: ## Show MySQL logs only
	docker-compose logs -f mysql

# ─── Testing ──────────────────────────────────────────────────────────────

test: ## Run tests in container
	docker-compose exec app pnpm test

test-watch: ## Run tests in watch mode
	docker-compose exec app pnpm test --watch

typecheck: ## Run TypeScript type checking
	docker-compose exec app pnpm check

# ─── Build ────────────────────────────────────────────────────────────────

build: ## Build the application
	docker-compose exec app pnpm build

# ─── Utilities ────────────────────────────────────────────────────────────

shell: ## Open a shell in the app container
	docker-compose exec app sh

restart: ## Restart all containers
	docker-compose restart

status: ## Show container status
	docker-compose ps
