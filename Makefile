.PHONY: up down logs typecheck test-e2e verify help

help:
	@echo "LOT Autonomous Agentic AIOS Commands:"
	@echo "  make up         - Start all AIOS services via docker-compose"
	@echo "  make down       - Stop all AIOS services"
	@echo "  make logs       - Tail logs of all running services"
	@echo "  make typecheck  - Run TypeScript compiler checks (0 errors required)"
	@echo "  make test-e2e   - Run independent 114-test opaque-box E2E suite"
	@echo "  make verify     - Run both typecheck and E2E verification sequentially"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

typecheck:
	npx tsc --noEmit

test-e2e:
	node tests/e2e/run_all.js

verify: typecheck test-e2e
	@echo "All verification checks passed cleanly."
