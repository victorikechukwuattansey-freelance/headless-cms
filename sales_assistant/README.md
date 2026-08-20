# Sales Assistant

Multi-tenant B2B sales platform — org-scoped lead management, AI lead scoring, booking/deal pipelines, and follow-up automation.

## Stack

- **Runtime:** Node.js 22+, TypeScript, ESM
- **API:** Framework-free Node `http` server (no Express/Fastify)
- **Database:** PostgreSQL 16 with pgvector (`prisma` ORM)
- **Cache/Queue:** Redis (rate limiting + job queue)
- **AI:** Provider-agnostic completion interface (OpenAI + in-memory mock), token/cost logging
- **Validation:** Zod
- **Orchestration:** npm workspaces + Turborepo

## Structure

```
sales_assistant/
├── apps/
│   ├── web/          # Next.js dashboard (App Router, Tailwind v4)
│   └── via/          # Mobile client metadata package (@sales_assistant/via)
├── packages/
│   ├── api/          # HTTP API, domain logic, workers, Prisma, tests
│   ├── api-client/   # Typed API client (types + request helpers)
│   ├── config/       # Shared config / role contracts
│   ├── db/           # Database provider metadata
│   ├── openapi/      # OpenAPI 3.0.3 spec (openapi.yaml)
│   ├── shared/       # Shared types
│   └── ui/           # UI metadata package
├── tests/            # Repo-level contract & static tests (*.test.mjs)
├── docker-compose.yml           # Dev Postgres + Redis
└── docker-compose.production.yml
```

> **Note (`@sales_assistant/via` packaging):** `apps/via/package.json` currently ships `"main": "src/index.ts"`. Before adding a runtime consumer (e.g. the future mobile client), confirm whether the Expo/Metro/Babel pipeline consumes TypeScript source directly; if not, switch to `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, and add an `exports` map.

## Prerequisites

- Node.js 22+, npm 11+
- Docker (for Postgres + Redis)

## Setup

```bash
npm install
docker compose up -d          # Postgres :5432, Redis :6379
npx prisma migrate deploy     # api package: apply migrations
npm run db:seed               # seed org, users, agents, leads
cp .env.example packages/api/.env   # dev values for API + worker (already filled for local docker-compose)
```

The API and worker load `packages/api/.env` via `node --env-file` (Prisma CLI reads it directly); the `.vscode/launch.json` configs carry the same dev values, so both terminal and F5 work out of the box.

### Seed credentials

| Email             | Role  | Password      |
| ----------------- | ----- | ------------- |
| `admin@acme.test` | ADMIN | `password123` |
| `agent@acme.test` | AGENT | `password123` |
| `user@acme.test`  | USER  | `password123` |

## Commands

| Command                  | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `npm run dev`            | Start API + web (dev, :4000) + worker together |
| `npm run build`          | Typecheck + build all workspaces (turbo)       |
| `npm run lint`           | ESLint all workspaces                          |
| `npm test`               | Repo contract tests + unit tests (api, via)    |
| `npm run test:integration` | Runtime integration suite (needs test infra) |
| `npm run db:generate`    | Regenerate Prisma client                       |
| `npm run db:migrate:deploy` | Apply pending migrations                    |
| `npm run db:seed`        | Seed the database (idempotent)                 |

### API package scripts

```bash
npm --workspace @sales_assistant/api run start        # node dist/index.js
npm --workspace @sales_assistant/api run start:worker # queue worker (node dist/workers/queue-worker.js)
```

## Domain Model

Everything is scoped to an `Organization`; audit events are written for every significant mutation.

- **User** — `USER | AGENT | ADMIN` roles, bcrypt-hashed passwords
- **Agent** — availability (`idle | busy`), least-loaded lead assignment
- **LeadProfile** — phone, score 0–100 + reason, status machine
- **Lead statuses** — `new → assigned → contacted → qualified → converted`; `lost` terminal
- **Booking** — `pending → confirmed → completed | cancelled`
- **Deal** — `proposed → won | lost` (Decimal amounts)
- **FollowUpReminder** — generated for stale leads (no contact within threshold), due in N hours
- **IntegrationToken** — provider tokens encrypted at rest
- **DomainAuditEvent / AiUsageLog** — audit trail and AI cost tracking

## API

Interactive docs: `GET /docs` (Redoc) or raw spec `GET /openapi.json`.
Canonical spec: `packages/openapi/openapi.yaml`.

| Method | Path                            | Auth        | Notes                          |
| ------ | ------------------------------- | ----------- | ------------------------------ |
| POST   | `/auth/token`                   | public      | Exchange email/password for a token |
| GET    | `/users`                        | ADMIN       | Paginated, org-scoped          |
| POST   | `/users`                        | ADMIN       | Create user (hashed password)  |
| PATCH  | `/users/:id`                    | ADMIN       | Update role / password         |
| GET    | `/leads`                        | bearer      | Paginate + filter by status/agent |
| POST   | `/leads`                        | bearer      | Create lead                    |
| GET    | `/leads/:id`                    | bearer      |                                |
| PATCH  | `/leads/:id`                    | bearer      | Update or transition status    |
| POST   | `/leads/:id/assign`             | bearer      | Assign to least-loaded agent   |
| POST   | `/leads/:id/score`              | bearer      | Run AI scoring                 |
| GET    | `/agents`                       | bearer      | Filter `?available=true`       |
| POST   | `/agents/:id/availability`      | bearer      | Set availability               |
| GET    | `/bookings`                     | bearer      |                                |
| POST   | `/bookings`                     | bearer      |                                |
| POST   | `/bookings/:id/transition`      | bearer      | Status transition              |
| GET    | `/deals`                        | bearer      |                                |
| POST   | `/deals`                        | bearer      |                                |
| POST   | `/deals/:id/transition`         | bearer      | Stage transition               |
| GET    | `/reminders`                    | bearer      | Paginate + filter by status    |
| POST   | `/reminders/generate`           | ADMIN       | Enqueue reminder generation (202) |
| GET    | `/audit-events`                 | ADMIN       | Audit feed — 17 event types, newest-first, `?type=` filter |
| GET    | `/health`, `/metrics`           | public      | Liveness + Prometheus metrics  |

### Auth

`POST /auth/token` with `{ email, password }` returns `{ token, expiresAt, role }`.
Send as `Authorization: Bearer <token>`. Tokens are HMAC-signed (configurable `JWT_SECRET`), 1-hour expiry.

### Errors

Structured `{ error: { code, message } }` with codes:
`VALIDATION` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`INVALID_TRANSITION`/`NO_AGENT_AVAILABLE` (409), `RATE_LIMITED` (429 — includes `Retry-After`).

### Rate limiting

Per-user (authenticated) or per-IP (anonymous), Redis-backed with in-memory fallback.
Exempt: `/health`, `/metrics`, `/docs`, `/openapi.json`.
Tunable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`.

## Web Dashboard

`apps/web` — Next.js App Router + Tailwind v4 dashboard. Server components fetch the API through an internal proxy using the session token; client components call `/api/*` and `router.refresh()`.

Run it (API must be up on `:3000`), or start everything at once from the repo root:

```bash
npm run dev      # http://localhost:4000 (web) + :3000 (api) + worker
npm run dev:web  # web only
```

Login with the seeded credentials (see above; `admin@acme.test / password123` for full access).

- **Session:** httpOnly cookie `sa_session` set on login, 1-hour expiry, no refresh — re-login when it expires.
- **Proxy:** `/api/*` forwards to `API_URL` (default `http://localhost:3000`), injecting the session token. No CORS needed.
- **Pages:** Dashboard, Leads (list + detail — assign, score, transition), Agents (availability), Reminders (generate + dismiss), Deals (stage transition), Activity (admin-only audit feed — every event as a sentence with entity links), Users (admin-only create user).

### Run locally in VSCode

`sales_assistant/.vscode/launch.json` ships three debug configurations — **API** (:3000, env baked in), **Web (dev)** (`next dev -p 4000`), **Worker** — plus an **API + Web + Worker** compound that starts all three with F5 (open `sales_assistant/` as the workspace folder). Rebuild the API after `packages/api/src` changes: `npm run build --workspace @sales_assistant/api`.

## Background Jobs

Redis list-backed queue (`BRPOP`, retries with exponential backoff, max 3 attempts):

| Job type                        | Handled by                          |
| ------------------------------- | ----------------------------------- |
| `score-lead`                    | enqueued on lead create/update (if stale score) |
| `generate-follow-up-reminders`  | enqueued by `POST /reminders/generate` |

Run a worker:

```bash
npm --workspace @sales_assistant/api run start:worker
```

## Environment Variables

See `.env.example`:

| Variable                      | Default                          | Purpose                          |
| ----------------------------- | -------------------------------- | -------------------------------- |
| `DATABASE_URL`                | `postgresql://...:5432/...`      | Prisma connection                |
| `TEST_DATABASE_URL`           | `postgresql://...:55432/...`     | Integration test database        |
| `REDIS_URL`                   | `redis://localhost:6379`         | Rate limiter + queue             |
| `PORT`                        | `3000`                           | HTTP port                        |
| `JWT_SECRET`                  | —                                | Token signing secret (change me) |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | —                            | At-rest token encryption         |
| `OPENAI_API_KEY`              | —                                | AI provider (mock if unset outside production) |
| `RATE_LIMIT_MAX`              | `100`                            | Requests per window              |
| `RATE_LIMIT_WINDOW_MS`        | `60000`                          | Rate limit window                |
| `FOLLOW_UP_THRESHOLD_DAYS`    | `7`                              | Stale-lead threshold             |
| `FOLLOW_UP_DUE_HOURS`         | `24`                             | Reminder due-at offset           |

## Testing

**Unit + repo tests** (no infra needed):

```bash
npm test
```

- `tests/*.test.mjs` — repo-level contract/static guards (OpenAPI surface, error codes, hardening)
- `packages/api/tests/*.test.ts` — unit tests (auth, validation, transitions, rate limiter, queue worker, AI providers)

**Integration tests** (need Postgres :55432 + Redis :56379 running, e.g. the `sales-assistant-*` containers):

```bash
npm run test:integration
```

Runs the API against a dedicated test database, truncating tables between tests: 26 tests covering auth token flow, admin-only user management, lead scoring, reminders, rate limiting (429 + `Retry-After`), docs/OpenAPI serving, the admin-only audit-events feed (org-scoped, newest-first, `?type=` filter, non-admin 403), and full domain lifecycle over HTTP.

## Database Migrations

Migrations live in `packages/api/prisma/migrations/`:

```bash
npm run db:migrate:deploy   # apply
npx prisma migrate dev      # create new migration (interactive)
```