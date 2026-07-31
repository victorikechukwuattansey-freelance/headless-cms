.PHONY: dev db db:setup build lint test format clean docker:build docker:up

dev:
	pnpm dev

db:
	docker compose -f docker/docker-compose.yml up -d postgres redis

db:setup:
	pnpm db:generate && pnpm db:push && pnpm db:seed

build:
	pnpm build

lint:
	pnpm lint && pnpm typecheck

test:
	pnpm test

format:
	pnpm format

clean:
	pnpm clean
	rm -rf apps/web/.next
	rm -rf packages/*/dist

docker:build:
	docker build -f docker/Dockerfile -t saas-boilerplate .

docker:up:
	docker compose -f docker/docker-compose.yml up -d
