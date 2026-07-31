# AI Workflow Automation Dashboard — MVP

Monorepo MVP of the AI Workflow Automation Dashboard per the master engineering
specification. Turborepo + pnpm workspaces. Next.js frontend, NestJS API,
BullMQ worker, PostgreSQL + Redis, and an AI Gateway with a provider adapter
pattern (Ollama default; OpenAI / Anthropic / Gemini adapters built in).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 + React 19 + Tailwind v4 + React Flow |
| API | NestJS 11 (REST under `/api/v1`) |
| Worker | BullMQ (Redis), cron scheduler for SCHEDULE workflows |
| Database | PostgreSQL 16 + Prisma ORM |
| AI Gateway | `@awd/ai-gateway` — adapter pattern, model registry, cost tracking, retries, fallback |

## Layout

```
apps/
  api/      NestJS REST API (auth, workflows, executions, webhooks, queue producer)
  worker/   BullMQ consumer + scheduler + engine execution + persistence
  web/      Next.js dashboard (login, workflow list, React Flow canvas, executions)
packages/
  ai-gateway/      Provider adapters (ollama/openai/anthropic/gemini) + router + cost
  config/          Zod-validated environment loader
  database/        Prisma schema, migrations, seed
  logger/          Structured JSON logger
  types/           Shared domain types
  workflow-engine/ DAG executor (topological, retries, timeouts, cancellation, expressions)
```

## Prerequisites

- Node >= 20 (tested on 24), pnpm >= 9
- Docker (Postgres, Redis; optional Ollama)

## Quickstart

```powershell
# 1. Infrastructure (skip if you already run Postgres on :5433 and Redis on :6379)
docker compose up -d

# 2. Environment
Copy-Item .env.example .env
#   - set DATABASE_URL (defaults to postgres:postgres@localhost:5433/ai_workflow)
#   - set JWT_SECRET / VAULT_MASTER_KEY, or leave generated values from setup

# 3. Install
pnpm install

# 4. Database
pnpm db:generate
pnpm db:migrate -- --name init
pnpm db:seed

# 5. Run (three terminals, or `pnpm dev` for everything)
pnpm api:dev       # http://localhost:4000
pnpm worker:dev
pnpm web:dev       # http://localhost:3000
```

Sign in with `admin@example.com` / `demo-password` (created by the seed).

## AI Providers

Default provider is `ollama` (`AI_DEFAULT_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`).
To run the seeded AI demo workflow you need Ollama with `llama3.2`:

```powershell
docker compose up -d ollama
docker exec awd-ollama ollama pull llama3.2
```

Or set `AI_DEFAULT_PROVIDER=openai|anthropic|gemini` plus the matching key
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) in `.env`.
`AI_FALLBACK_PROVIDER` enables automatic fallback when the primary is unavailable.

## API surface (base `/api/v1`)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/login` | Login → JWT |
| GET | `/auth/me` | Current user |
| GET | `/workflows` | List workflows |
| GET | `/workflows/:id` | Workflow detail incl. latest version graph |
| POST | `/workflows` | Create workflow (validates graph) |
| POST | `/workflows/:id/publish` | Publish workflow |
| POST | `/workflows/:id/run` | Run manually (enqueues execution) |
| GET | `/executions` | List executions |
| GET | `/executions/:id` | Execution detail incl. node records |
| POST | `/webhooks/:token` | Webhook trigger (public) |

## Workflow engine

- DAG execution with bounded concurrency, deterministic root ordering
- Node types: manual/webhook/schedule triggers, ai-chat, http-request,
  if-condition, delay, log-output, set-variable, merge
- `{{path.to.value}}` expressions (upstream outputs via `{{nodeKey.output.field}}`)
- Per-node retry policy (fixed/exponential), timeouts, AbortSignal cancellation
- SKIPPED propagation through false condition branches and failed upstreams
- Engine events persisted by the worker (Execution, ExecutionNodeRecord)

## Scripts

```powershell
pnpm dev         # turbo dev (all apps)
pnpm build       # turbo build
pnpm test        # vitest (ai-gateway, workflow-engine)
pnpm typecheck   # tsc across packages
pnpm db:studio   # Prisma Studio
```
