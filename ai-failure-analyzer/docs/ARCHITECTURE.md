# Architecture Overview

## Pipeline

```
Upload Logs ─▶ Parse Logs ─▶ Redact Secrets ─▶ Rebuild Timeline
                                                   │
                                                   ▼
                                   Detect Failure (9 classifiers)
                                                   │
                                                   ▼
                              Generate Report (summary/root cause/
                              evidence/fix/prevention)
                                                   │
                                                   ▼
                              Persist (Prisma + PostgreSQL) ─▶ Display (web UI)
```

## Layer responsibilities

### Domain (`src/domain/types.ts`)

The failure taxonomy (`FailureType` — 9 classes), timeline entry model, evidence, and verdict contracts. Shared by every service; no framework imports.

### Services (pure logic, no HTTP)

| Service | Responsibility |
|---|---|
| `parser.service.ts` | Format auto-detection (OpenAI / Anthropic / LangChain / JSON / JSONL / text) → normalized `TimelineEntry[]` |
| `redact.service.ts` | Regex-based secret detection (API keys, bearer tokens, private keys, credentials) applied before anything leaves memory; per-entry truncation |
| `classifier.service.ts` | 9 rule blocks scored on the timeline; each produces root cause, evidence, confidence; highest confidence wins; `wrong_prompt` is the fallback |
| `report.service.ts` | Human-readable report assembly from a verdict + timeline statistics |
| `analyze.service.ts` | Orchestration: parse → classify → build report → persist via Prisma |
| `reports.service.ts` | List / get / delete persisted reports |

### Controllers & routes

- `routes/analyze.routes.ts` — `POST /api/analyze` (multer file upload or JSON body)
- `routes/reports.routes.ts` — `GET/DELETE /api/reports[/:id]`

### Persistence (`prisma/schema.prisma`)

- `Report` — verdict + report text, format, redaction count
- `ReportStep` — normalized timeline (redacted content, outcomes, token usage)
- `Evidence` — per-verdict supporting signals

Raw logs are **never stored** — only the redacted timeline steps and evidence.

## Design decisions

1. **Rule-based analyzer first.** The MVP works with zero API keys and zero cost, and every verdict is deterministic and testable. An LLM pass can be added later behind the same `AnalysisResult` contract without touching the API or UI.

2. **Redaction at the parse boundary.** Secrets are stripped inside `parser.service` before the timeline leaves memory, so no downstream layer can leak them — not the DB, not the API response.

3. **Confidence as a first-class output.** Every verdict carries 0–1 confidence plus severity-tagged evidence, so a user can judge how much to trust the diagnosis.

4. **Precedence by confidence, not order.** Rules accumulate; the highest-confidence match wins. Mechanical failures (timeout, API, context) naturally outrank softer ones (prompt).

5. **Static frontend, no build step.** Four HTML pages served by Express keep the MVP dependency-light; the report page renders straight from `/api/reports/:id`.

## Failure classification rules

Each rule scans the normalized timeline (labels + content + outcomes) and optionally the token counts:

- `context_overflow` — provider error text or input tokens > 120k
- `timeout` — outcome/text timeout markers
- `api_failure` — status codes (429/401/403/5xx), rate limit/quota/connection text
- `infinite_loop` — ≥3 identical tool calls (label+arguments), loop-guard messages
- `invalid_output` — JSON parse / schema / validation violations
- `hallucination` — final success claim contradicting earlier errors (0.85), fabrication markers
- `missing_context` — undefined references, missing params, not-found
- `wrong_tool_selection` — unknown-tool errors, ≥2 distinct failing tools
- `wrong_prompt` — fallback at 0.4 when nothing else matches

## Testing strategy

- **Unit** (`parser`, `classifier`, `report`) — fixtures under `tests/fixtures/` exercise each format and each failure class; assertions on classification type, confidence floors, and redaction behavior
- **Integration** (`api.test.ts`) — supertest against the real Express app and real PostgreSQL; each test creates and cleans up its own reports

## Production build

`tsc` compiles `src/` to `dist/`; `public/` is served from the repository tree.

## Known limitations (MVP scope)

- Heuristics can misclassify unusual logs; confidence scores flag this
- Plain-text parsing is line-based and does not reconstruct LLM-specific structure
- Single-user, single-instance; no auth (local-first)
- Loop detection counts identical calls, not semantic state repetition
