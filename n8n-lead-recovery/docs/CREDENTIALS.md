# Credentials & Secrets Inventory — Lead Recovery Engine (9 n8n Workflows)

State of every secret/credential in the Lead Recovery Engine pipeline after the H2–H5
hygiene workstream and the H-B documentation rebase. **This document lists credential
types and env-var names only — never values.** For how credentials persist and how to
re-attach them after import, see `docs/CONTAINER-RUNBOOK.md` §2.4.

---

## 1. The one warning that matters

> **Credential IDs live in the n8n database, not in the workflow JSON.** Workflow exports
> carry only a `{ id, name }` reference per credential-bearing node; the secret material
> and the ids themselves live in n8n's server-side credential store
> (`/home/node/.n8n/database.sqlite` in the development container `serene_swartz`).
>
> Consequently:
> - Credential ids are **DB-local** — they are meaningless on a different n8n instance.
> - After importing a workflow you must **actively re-select the credential in the n8n
>   editor** on every credential-bearing node.
> - Credentials **do not survive container removal** (the credential table is in the DB,
>   not the volume's app dir).
> - Never rotate a key and store only the *name* of a credential in a repo file; commit
>   neither the key nor the resolved credential object.

## 2. Per-workflow credential map (required format)

`Workflow | Node | Credential type | Required env var (if any)` — node-level, one row per
credential-bearing node. Provenance: read-only audit of the nine exports in this repo
(§3) plus the H2–H5 secret scan (§6).

### 2.1 Prospect Finder & Validation V1 — `Lead Recovery Engine — Prospect Finder & Validation V1.json`

| Workflow | Node | Credential type | Required env var (if any) |
| --- | --- | --- | --- |
| Prospect Finder | Read Search Inputs | Google Sheets OAuth2 (`googleSheetsOAuth2Api`) | — |
| Prospect Finder | Read Verified Leads | Google Sheets OAuth2 | — |
| Prospect Finder | Set Status Running | Google Sheets OAuth2 | — |
| Prospect Finder | Write Raw Leads | Google Sheets OAuth2 | — |
| Prospect Finder | Write Verified Leads | Google Sheets OAuth2 | — |
| Prospect Finder | Update Status Completed | Google Sheets OAuth2 | — |
| Prospect Finder | Update Status Failed | Google Sheets OAuth2 | — |
| Prospect Finder | Foursquare Places API (HTTP) | HTTP Header Auth (`httpHeaderAuth`, named `Foursquare API`) | — |
| Prospect Finder | Google Places API (HTTP) | none (no n8n credential — API key read from env) | `GOOGLE_PLACES_API_KEY` |

### 2.2 Response Interpretation V1 — `Response-Interpretation V1.json`

| Workflow | Node | Credential type | Required env var (if any) |
| --- | --- | --- | --- |
| Response Interpretation | Read Response Log | Google Sheets OAuth2 (`googleSheetsOAuth2Api`) | — |

### 2.3 Remaining seven workflows (not yet per-node audited)

The exports of the following workflows carry **no** embedded credential references in the
file (audit §3 confirmed reference-free exports); each Google Sheets node therefore must
be bound to a Google Sheets OAuth2 credential manually after import. Per-node rows are
filled as `not yet audited` pending a node-by-node credential audit.

| Workflow | Node | Credential type | Required env var (if any) |
| --- | --- | --- | --- |
| Approved Outreach Handoff V1 | (3 Google Sheets nodes) | not yet audited (attach Google Sheets OAuth2 post-import) | — |
| Run Reconciliation V1 | (2 Google Sheets nodes) | not yet audited (attach Google Sheets OAuth2 post-import) | — |
| Outreach Queue & Planning V1 | (2 Google Sheets nodes) | not yet audited (attach Google Sheets OAuth2 post-import) | — |
| Outreach Execution & Delivery V1 | (3 Google Sheets nodes) | not yet audited (attach Google Sheets OAuth2 post-import) | — |
| Execution Reconciliation V1 | (1 Google Sheets node) | not yet audited (attach Google Sheets OAuth2 post-import) | — |
| Response Capture V1 | (2 Google Sheets nodes) | not yet audited (attach Google Sheets OAuth2 post-import) | — |
| Response Reconciliation V1 | (2 Google Sheets nodes) | not yet audited (attach Google Sheets OAuth2 post-import) | — |

## 3. What the exports actually carry

All nine workflow exports were audited for **embedded credential data** and for
**credential references** (n8n's `credentials` blocks, which store only an id + name; the
secret material itself lives in the n8n credential store with matching id).

| Workflow export | Nodes | Credential references in the file | Embedded credential data? |
| --- | --- | --- | --- |
| `Lead Recovery Engine — Prospect Finder & Validation V1.json` | 32 | `googleSheetsOAuth2Api` **×7** (`name: "Google Sheets account"`), `httpHeaderAuth` **×1** (`name: "Foursquare API"`) | No (references only) |
| `Approved Outreach Handoff V1.json` | 10 | none | No |
| `Outreach-Queue-and-Planning V1.json` | 5 | none | No |
| `Outreach-Execution-and-Delivery V1.json` | 8 | none | No |
| `Execution-Reconciliation V1.json` | 5 | none | No |
| `Outreach-Response-Capture V1.json` (`Response-Capture V1.json`) | 9 | none | No |
| `Outreach-Response-Interpretation V1.json` (`Response-Interpretation V1.json`) | 5 | none | No |
| `Outreach-Response-Reconciliation V1.json` (`Response-Reconciliation V1.json`) | 5 | none | No |
| `Run-Reconciliation-and-Reporting V1.json` | 5 | none | No |

**Audit result:** no `privateKey` / `private_key` / `"data":` credential payload appears
in any export. Only the **Prospect Finder** carries in-file credential references; the
other eight rely on the operator attaching credentials **after import**. The H2 hygiene
edit replaced a previously hardcoded Foursquare bearer token with the named
`httpHeaderAuth` reference; the Google Places node adds `{{ $env.GOOGLE_PLACES_API_KEY }}`
(no n8n credential object).

## 4. Credential types used across the pipeline

| Credential type (n8n) | Workflow(s) using it | Fields |
| --- | --- | --- |
| `googleSheetsOAuth2Api` | Every workflow's Google Sheets nodes (Prospect Finder has refs in-file; the other 8 attach post-import) | OAuth2 client id/secret + authorization |
| `httpHeaderAuth` | Prospect Finder — `Foursquare Places API` node only (H2-HYGIENE addition) | `name` = header name (`Authorization`), `value` = the bare Foursquare API token (no `Bearer ` prefix — the node expression prepends it) |

## 5. Post-import attach checklist (all machines)

1. **Prospect Finder** — create (or already have) a Google Sheets OAuth2 credential whose
   id **matches the referenced id** (`rOKhG0ESKifN5zy2` — DB-local, likely absent on fresh
   machines) **or** re-select the credential on the 7 Sheets nodes after import. Without a
   matching id, n8n shows the nodes as uncredentialed. If your instance id differs,
   re-select using the editor (id matching is only a fast-path, not a requirement —
   `docs/CONTAINER-RUNBOOK.md` §2.4).
2. **Prospect Finder — Foursquare node (H2):** create an `httpHeaderAuth` credential
   named **exactly** `Foursquare API` (the node references it by name `Foursquare API` and
   id `912eb72c-6bd0-42b2-b16e-9ce526d45110`). Set `name = Authorization`, `value =
   <bare Foursquare API token>`. The node's `headerParameters` value
   `=Bearer {{$credentials.value}}` produces `Authorization: Bearer <token>`. **Do not**
   paste the token into the JSON.
3. **Prospect Finder — Google Places node:** no credential object. The node's
   `X-Goog-Api-Key` header = `{{ $env.GOOGLE_PLACES_API_KEY }}`. The key must be
   Places-API-enabled on its GCP project, and env access in node expressions must be
   allowed (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` — see `docs/CONTAINER-RUNBOOK.md` §2.5).
4. **All other 8 workflows** — after import, open each Google Sheets node and attach the
   OAuth2 credential. None carry a credential reference in the file, so this is per-node
   manually.
5. **Live-runner environment config** (Response Interpretation V1 live tests) follows
   `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` — a **different** mechanism (env vars for the
   runner's own sheets access) than the in-workflow credentials above; do not confuse the
   two.

## 6. Environment variables and file hygiene

- `.env.example` documents every variable with **placeholders only** (no secrets),
  including `GOOGLE_PLACES_API_KEY`, `GOOGLE_SHEET_ID`, `FIXTURE_SHEET_ID`,
  `GOOGLE_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and the `RESP_INT_*` runner env.
- `.gitignore` excludes `.env*` (keeping `!.env.example`) and ignores only the targeted
  live-output JSON/`.tmp` files — the `.md` phase/hygiene reports remain tracked.
- Never commit `.env`; export values into the process (`$env:VAR = Read-Host ...` in
  PowerShell) rather than echoing them.
- The n8n instance itself holds the authoritative secret values (OAuth tokens, the
  Foursquare API token) — the repository holds only reference names and placeholders.

## 7. Secret-shaped value scan (H2/H5 evidence)

Literal scans of all repo text files for credential-shaped payloads (`"data":`,
`privateKey`, `private_key`, credential key names, AWS/GCP/OpenAI/PEM-style patterns)
found **no violations** after the H2 edit. The only surviving match for
`places-api.foursquare` is the benign endpoint hostname in the Prospect Finder HTTP
Request node. Note: `src/response-interpretation-live-runner.js` and its test deliberately
contain `redact()` secret-shape **detection patterns** (AWS/GCP/OpenAI/PEM-style regexes
and matching test fixtures) — these are pattern constants, not secrets.