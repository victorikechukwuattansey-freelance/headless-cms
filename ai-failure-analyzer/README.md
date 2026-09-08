# AI Failure Analyzer

**MVP — one question answered: "Why did my AI agent fail?"**

Upload AI agent logs (OpenAI, Anthropic, LangChain, generic JSON/JSONL, or plain text). The analyzer rebuilds the execution timeline, classifies the failure, and returns a report with root cause, evidence, recommended fix, and prevention strategy.

## Architecture

```
ai-failure-analyzer/
├── package.json           # orchestration only (no deps) — dev/build/test/db scripts
├── docker-compose.yml     # PostgreSQL 16 (localhost:5433)
├── server/                # Express + TypeScript + Prisma backend (API on :3001)
│   ├── src/               #   domain/ · middleware/ · routes/ · services/ · app.ts · server.ts
│   ├── prisma/            #   schema + migrations + seed
│   ├── tests/             #   fixtures + unit + integration (vitest + supertest)
│   ├── public/            #   legacy static pages (served by Express)
│   └── docs/              #   INSTALL · API · ARCHITECTURE
└── web/                   # Next.js 16 + Tailwind v4 frontend (UI on :3002)
    ├── app/               #   routes: / · /upload · /reports
    ├── components/        #   ServerStatus
    └── next.config.ts     #   rewrites /api/* → http://localhost:3001/api/*
```

**Request flow:** browser → web (`:3002`) → `/api/*` rewrite → server (`:3001`) → Prisma → PostgreSQL (`:5433`).

Each app is self-contained (`server/` and `web/` each have their own `package.json`, deps, and configs). The root manifest only orchestrates them — no npm workspaces, no hoisting.

## Quick start

```powershell
npm install             # server/
npm install             # web/
npm run db:up           # PostgreSQL 16 on localhost:5433
npm run db:migrate      # create tables
npm run db:seed         # optional: 2 example reports
npm run dev:server      # API on http://localhost:3001
npm run dev:web         # UI on http://localhost:3002  (open this)
```

## What it detects

| Failure type | Signal |
|---|---|
| `infinite_loop` | Same tool call with identical arguments ≥3 times; loop-guard messages |
| `timeout` | Deadline exceeded / timed-out errors |
| `context_overflow` | Context-length errors; >120k input tokens |
| `api_failure` | 429/401/403/5xx, rate limits, quota, connection errors |
| `invalid_output` | JSON parse failures, schema/validation violations |
| `hallucination` | Claims success after tool errors; fabrication markers |
| `missing_context` | Undefined variables, missing parameters, not-found references |
| `wrong_tool_selection` | Unknown tools; ≥2 different tools failing for one goal |
| `wrong_prompt` | Fallback when no mechanical failure is found |

Every verdict includes a **confidence score** (0–1) and **evidence** (with severity).

## Security

- API keys, bearer tokens, private keys, and credentials are **redacted** before anything is stored or returned (`[REDACTED:<kind>]`).
- Raw logs are never stored — only redacted, truncated timeline steps and evidence.
- Every report records how many secrets were redacted.

## Root scripts

| Command | Purpose |
|---|---|
| `npm run dev:server` | Express API (tsx watch) on :3001 |
| `npm run dev:web` | Next.js dev server on :3002 |
| `npm run build` | Build server (`tsc`) then web (`next build`) |
| `npm test` | Server unit + integration tests (needs Postgres up) |
| `npm run db:up` / `db:down` | Start / stop the PostgreSQL container |
| `npm run db:migrate` / `db:seed` | Apply migrations / insert example reports |

## Non-goals (out of scope for MVP)

Billing, team collaboration, SDK, real-time monitoring, notifications, alerts, analytics dashboard, enterprise features.

## Docs

- [Installation Guide](server/docs/INSTALL.md)
- [API Documentation](server/docs/API.md)
- [Architecture Overview](server/docs/ARCHITECTURE.md)
