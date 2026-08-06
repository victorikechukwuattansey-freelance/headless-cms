# AI Failure Analyzer

**MVP — one question answered: "Why did my AI agent fail?"**

Upload AI agent logs (OpenAI, Anthropic, LangChain, generic JSON/JSONL, or plain text). The analyzer rebuilds the execution timeline, classifies the failure, and returns a report with root cause, evidence, recommended fix, and prevention strategy.

## Quick start

```powershell
npm install
docker compose up -d          # PostgreSQL 16 on localhost:5433
npx prisma migrate dev        # create tables
npm run db:seed               # optional: 2 example reports
npm run dev                   # http://localhost:3001
```

Open http://localhost:3001 → **Upload Logs** → paste a log or drop a file.

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

## Project structure

```
ai-failure-analyzer/
├── docker-compose.yml        # local PostgreSQL (port 5433)
├── prisma/
│   ├── schema.prisma         # Report / ReportStep / Evidence
│   └── seed.ts               # 2 example reports
├── src/
│   ├── server.ts             # entry point
│   ├── app.ts                # Express app assembly
│   ├── db.ts                 # Prisma client
│   ├── domain/types.ts       # failure taxonomy + shared types
│   ├── middleware/           # error handling
│   ├── routes/               # analyze + reports routers
│   ├── controllers/          # request handlers
│   └── services/
│       ├── parser.service.ts     # OpenAI / Anthropic / LangChain / JSON / text
│       ├── redact.service.ts     # secret detection + redaction
│       ├── classifier.service.ts # 9 failure rules + confidence
│       ├── report.service.ts     # human-readable report builder
│       ├── analyze.service.ts    # orchestration + persistence
│       └── reports.service.ts    # list / get / delete
├── public/                   # 4 static pages (landing, upload, report, history)
├── tests/                    # fixtures + unit + integration (vitest + supertest)
└── docs/                     # INSTALL, API, ARCHITECTURE
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (tsx watch) on :3001 |
| `npm run build` | TypeScript build to `dist/` |
| `npm start` | Run built server |
| `npm test` | Unit + integration tests (needs Postgres up) |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Insert example reports |

## Non-goals (out of scope for MVP)

Billing, team collaboration, SDK, real-time monitoring, notifications, alerts, analytics dashboard, enterprise features.

See also:

- [Installation Guide](docs/INSTALL.md)
- [API Documentation](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
