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

## DELETE /api/reports/:id

Delete a report. Returns `204 No Content`.

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
