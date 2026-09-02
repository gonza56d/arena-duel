# Arena Duel — developer entry point.
#
# `make` or `make help` lists every target. Targets wrap the client (npm/vite at
# the repo root) and the backend (go in light-backend/) so nobody has to know
# either toolchain. Compatible with GNU Make 3.81 (the macOS default).

SHELL := /bin/bash
.DEFAULT_GOAL := help

BACKEND_DIR := light-backend
ENV_FILE    := $(BACKEND_DIR)/.env
ENV_EXAMPLE := $(BACKEND_DIR)/.env.example
NODE_STAMP  := node_modules/.package-lock.json

NPM     ?= npm
GO      ?= go
COMPOSE ?= docker compose

# Set WITH_MONGO=0 to skip starting MongoDB through Docker Compose (e.g. you run
# your own instance and pointed MONGO_URI in light-backend/.env at it).
WITH_MONGO ?= 1

.PHONY: help install env mongo mongo-down run run-client run-backend \
        test test-client test-backend typecheck build \
        up down docker-build logs clean docker-clean

##@ General

help: ## List available targets
	@echo "Arena Duel — make targets"
	@awk 'BEGIN {FS = ":.*## "} \
	  /^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5)} \
	  /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "Variables: WITH_MONGO=0 (don't start MongoDB via compose), JWT_SECRET=... (compose backend secret)"

install: $(NODE_STAMP) ## Install client (npm ci) and backend (go mod download) dependencies
	cd $(BACKEND_DIR) && $(GO) mod download

env: ## Create light-backend/.env from .env.example with a random JWT_SECRET (no-op if it exists)
	@if [ ! -f $(ENV_FILE) ]; then \
	  secret=$$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'); \
	  sed "s|^JWT_SECRET=.*|JWT_SECRET=$$secret|" $(ENV_EXAMPLE) > $(ENV_FILE); \
	  echo "created $(ENV_FILE) with a generated JWT_SECRET"; \
	fi

##@ Run (local processes; MongoDB via Docker)

run: env mongo $(NODE_STAMP) ## Start backend + client together (Ctrl-C stops both)
	@trap 'kill $$(jobs -p) 2>/dev/null' INT TERM EXIT; \
	( cd $(BACKEND_DIR) && set -a && . ./.env && set +a && exec $(GO) run ./cmd/server ) & \
	$(NPM) run dev & \
	wait

run-client: $(NODE_STAMP) ## Start the Vite dev server only (http://localhost:5173)
	$(NPM) run dev

run-backend: env mongo ## Start the Go backend only (http://localhost:8080, reads light-backend/.env)
	cd $(BACKEND_DIR) && set -a && . ./.env && set +a && $(GO) run ./cmd/server

mongo: ## Start MongoDB via Docker Compose and wait until healthy
	@if [ "$(WITH_MONGO)" = "1" ]; then \
	  $(COMPOSE) up -d --wait mongo; \
	else \
	  echo "WITH_MONGO=0: not starting MongoDB; MONGO_URI in $(ENV_FILE) must be reachable"; \
	fi

mongo-down: ## Stop the Docker Compose MongoDB service (data volume is kept)
	$(COMPOSE) stop mongo

##@ Test & build

test: ## Run client and backend test suites; fails if either fails
	@fail=0; \
	$(MAKE) --no-print-directory test-client || fail=1; \
	$(MAKE) --no-print-directory test-backend || fail=1; \
	echo; \
	if [ $$fail -ne 0 ]; then echo "make test: FAILED (see above)"; exit 1; fi; \
	echo "make test: all suites passed"

test-client: $(NODE_STAMP) ## Run the client unit tests (vitest)
	$(NPM) test

test-backend: ## Run the backend tests (go test ./...)
	cd $(BACKEND_DIR) && $(GO) test ./...

typecheck: $(NODE_STAMP) ## Type-check the client (tsc --noEmit)
	$(NPM) run typecheck

build: $(NODE_STAMP) ## Production build: client to dist/, backend binary to light-backend/bin/server
	$(NPM) run build
	cd $(BACKEND_DIR) && $(GO) build -o bin/server ./cmd/server

##@ Docker Compose (full stack: MongoDB + backend + client)

up: ## Build images and start the full stack in the foreground
	$(COMPOSE) up --build

down: ## Stop and remove the stack's containers (MongoDB data volume is kept)
	$(COMPOSE) down

docker-build: ## Build the client and backend Docker images
	$(COMPOSE) build

logs: ## Follow the logs of the running stack
	$(COMPOSE) logs -f

##@ Cleanup

clean: ## Remove build output (dist/, light-backend/bin/)
	rm -rf dist $(BACKEND_DIR)/bin

docker-clean: ## Remove the stack's containers, images built by it AND the MongoDB data volume
	$(COMPOSE) down -v --rmi local --remove-orphans

# Client dependencies. `npm ci` writes node_modules/.package-lock.json, which
# doubles as the stamp so deps are (re)installed only when the lockfile changes.
$(NODE_STAMP): package.json package-lock.json
	$(NPM) ci
	@touch $@
