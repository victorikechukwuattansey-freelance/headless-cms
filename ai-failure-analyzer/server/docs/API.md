# API Documentation

Base URL: `http://localhost:3001` (configurable via `PORT`).

All endpoints are JSON. Errors return `{ "error": string }` with an appropriate status code.

## POST /api/analyze

Upload a log and get a failure analysis. Accepts either multipart file upload or a raw JSON body.

### Multipart upload

- Field name: `log`
- Allowed extensions: `.json`, `.jsonl`, `.ndjson`, `.txt`, `.log`
- Max size: 10 MB

```powershell
curl -X POST http://localhost:3001/api/analyze -F "log=@agent-trace.json"
```

### JSON body

```powershell
curl -X POST http://localhost:3001/api/analyze `
  -H "Content-Type: application/json" `
  -d '{"log": {"messages": [{"role": "user", "content": "..."}]}}'
```

`log` may be a string (raw text or serialized JSON/JSONL) or a JSON object/array.

### Response — `201 Created`

```json
{
  "id": "cm1abc...",
  "createdAt": "2026-08-05T22:00:00.000Z",
  "failure": {
    "type": "infinite_loop",
    "rootCause": "The agent repeated the same action...",
    "confidence": 0.9,
    "evidence": [
      { "label": "Repeated action", "detail": "Identical call \"tool: apply_patch\" executed 3 times in a row.", "severity": "strong" }
    ],
    "fix": "Add an iteration cap and loop detection...",
    "prevention": "Set max-iterations guards..."
  },
  "timeline": [
    { "index": 0, "kind": "step", "label": "message (user)", "content": "Fix the bug...", "outcome": null, "tokensIn": null, "tokensOut": null }
  ],
  "redactions": 2
}
```

### Errors

| Status | Cause |
|---|---|
| 400 | Empty/unparseable log, missing `log` field, unsupported file type |
| 413 | File larger than 10 MB |

## GET /api/reports

List analysis reports, newest first.

```json
{
  "reports": [
    {
      "id": "cm1abc...",
      "summary": "The agent failed with an infinite loop (90% confidence)...",
      "failureType": "infinite_loop",
      "confidence": 0.9,
      "sourceFormat": "openai",
      "redactions": 2,
      "createdAt": "2026-08-05T22:00:00.000Z"
    }
  ]
}
```

## GET /api/reports/:id

Full report including the redacted execution timeline and evidence.

```json
{
  "id": "cm1abc...",
  "summary": "...",
  "failureType": "infinite_loop",
  "rootCause": "...",
  "confidence": 0.9,
  "recommendedFix": "...",
  "preventionStrategy": "...",
  "sourceFormat": "openai",
  "stepCount": 20,
  "evidenceCount": 2,
  "redactions": 2,
  "createdAt": "...",
  "steps": [ { "id": "...", "order": 0, "kind": "step", "label": "...", "content": "...", "outcome": null, "tokensIn": null, "tokensOut": null } ],
  "evidences": [ { "id": "...", "label": "...", "detail": "...", "severity": "strong" } ]
}
```

`404` if the id does not exist.

## GET /api/reports/:id/document

A complete plain-English root cause analysis report, composed from the stored verdict, evidence, and timeline.

```json
{
  "id": "cm1abc...",
  "failureType": "infinite_loop",
  "confidence": 0.9,
  "executiveSummary": "The agent failed with an infinite loop (90% confidence). The run produced 20 timeline events, including 6 tool calls and 4 errors...",
  "timeline": ["Called the tool \"read_file\" with input: {\"path\": \"src/worker.js\"}", "The agent responded: \"Let me read the file first.\"", "Step failed: \"error: patch does not apply\""],
  "rootCause": "The agent repeated the same action with identical arguments...",
  "evidence": ["**Repeated action** (strong) — Identical call ... executed 3 times in a row."],
  "suggestedFixes": "Add an iteration cap and loop detection...",
  "preventionStrategy": "Set max-iterations guards...",
  "document": "# Root Cause Analysis Report\n... (markdown with all six sections)"
}
```

The `document` field contains the full report in markdown: Executive Summary, Failure Timeline (last 25 steps, plain English), Root Cause, Evidence, Suggested Fixes, and Prevention Strategy.

`404` if the id does not exist.

## DELETE /api/reports/:id

Delete a report. Returns `204 No Content`.

## GET /api/uploads

List stored uploads (newest first) — files received but **not yet analyzed**; only metadata is kept, never raw content.

```json
{
  "uploads": [
    {
      "id": "cm1abc...",
      "fileName": "agent-trace.json",
      "sourceFormat": "json",
      "sizeBytes": 1234,
      "status": "uploaded",
      "createdAt": "2026-08-05T22:00:00.000Z"
    }
  ]
}
```

## GET /api/uploads/:id

Single upload metadata. `404` if the id does not exist.

## POST /api/uploads

Receive and validate a log file for later processing. The file is validated (extension, 10 MB size limit, UTF-8 encoding, format structure) and **discarded** — only metadata is stored. No analysis is performed.

### Multipart upload

- Field name: `file`
- Allowed extensions: `.json`, `.csv`, `.txt`
- Max size: 10 MB

```powershell
curl -X POST http://localhost:3001/api/uploads -F "file=@agent-trace.json"
```

### Response — `201 Created`

```json
{
  "id": "cm1abc...",
  "fileName": "agent-trace.json",
  "sourceFormat": "json",
  "sizeBytes": 1234,
  "status": "uploaded",
  "createdAt": "2026-08-05T22:00:00.000Z"
}
```

### Validation rules

| Format | Rules |
|---|---|
| JSON | Must parse as valid JSON |
| CSV | All rows must have the same number of columns (quote-aware) |
| TXT | Must be non-empty |

### Errors

| Status | Cause |
|---|---|
| 400 | Missing file, unsupported extension, empty file, invalid JSON, ragged CSV, non-UTF-8 content |
| 413 | File larger than 10 MB |

## POST /api/uploads/:id/parse

Convert a previously uploaded log into a structured execution timeline. The original file must be re-supplied (raw content is never stored); its name and size must match the stored upload metadata.

### Multipart upload

- Field name: `file`
- Allowed extensions: `.json`, `.csv`, `.txt`

```powershell
curl -X POST http://localhost:3001/api/uploads/<id>/parse -F "file=@agent-trace.json"
```

### Response — `201 Created`

Each step carries the fields: `timestamp`, `tool`, `prompt`, `response`, `tokensIn`, `tokensOut`, `error` (`null` when not applicable).

```json
{
  "id": "cm1def...",
  "uploadedLogId": "cm1abc...",
  "sourceFormat": "json",
  "stepCount": 12,
  "steps": [
    {
      "index": 0,
      "timestamp": "12:34:56",
      "tool": "apply_patch",
      "prompt": "{\"path\": \"src/x.ts\"}",
      "response": null,
      "tokensIn": 431,
      "tokensOut": 102,
      "error": null
    }
  ],
  "createdAt": "2026-08-06T10:00:00.000Z"
}
```

The upload status becomes `parsed` and the redacted timeline is stored (only metadata + redacted steps; raw content is discarded).

### Errors

| Status | Cause |
|---|---|
| 400 | File missing, does not match stored metadata, or fails validation |
| 404 | Upload id does not exist |
| 409 | Upload was already parsed or analyzed |

## GET /api/uploads/:id/execution

Read the stored execution timeline for an upload. Returns the same step shape as the parse response (without the `format` field).

`404` if the upload does not exist or has not been parsed yet.

## GET /health

Health check: `{ "ok": true }`.

## Supported log formats (auto-detected)

| Format | Detection |
|---|---|
| OpenAI chat | `messages[]` with `role`, `tool_calls`, `usage` |
| Anthropic | `content[]` blocks with `tool_use` / `tool_result` / `text`, `stop_reason` |
| LangChain | events with `event: on_*` or `type: llm|tool|chain|agent` |
| Generic JSON | arrays of `{level, event, tool, message, ...}` records |
| JSONL | lines of JSON events |
| Plain text | timestamped log lines |

## Failure types

`wrong_prompt`, `wrong_tool_selection`, `missing_context`, `hallucination`, `infinite_loop`, `timeout`, `invalid_output`, `api_failure`, `context_overflow`
