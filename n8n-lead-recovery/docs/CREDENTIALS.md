# Credentials & Secrets Inventory — Lead Recovery Engine (9 n8n Workflows)

State of every secret/credential in the Lead Recovery Engine pipeline after the H2–H5
hygiene workstream, plus the n8n import-side expectations for each workflow.

## 1. What the exports actually carry

All nine workflow exports were audited for **embedded credential data** and
for **credential references** (n8n's `credentials` blocks, which store only an id +
name; the secret material itself lives in the n8n credential store with matching id).

| Workflow export | Nodes | Credential references in the file | Embedded credential data? |
| --- | --- | --- | --- |
| `Lead Recovery Engine — Prospect Finder & Validation V1.json` | 26 | `googleSheetsOAuth2Api` **×7** (`name: "Google Sheets account"`), `httpHeaderAuth` **×1** (`name: "Foursquare API"`, added in H2 — replaces a previously hardcoded bearer token) | No (references only) |
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
other eight rely on the operator attaching credentials **after import**. This confirms
the pre-hygiene assumption exactly: "Only the Prospect Finder export carries a Sheets
credential; the other 8 carry none."

## 2. Why secrets are not embedded in the repo (and the trade-off)

n8n keeps credential data in its server-side credential store. Exports reference
credentials by **id + name**, never by value. Embedding real credential data into the
JSON exports would commit secrets to the repository — explicitly **not** done. The
consequence is documented here as a known limitation and flag for a future phase:

- **Limitation (flagged):** a fresh n8n instance importing these exports out of the box
  will show the Sheets/Foursquare nodes without a functional credential until the
  operator creates matching credentials (n8n will prompt to re-select/assign). The
  workflow JSONs themselves are therefore **portable but not zero-touch**.
- **Deferred future phase (optional):** a hardening step could add an import-time
  credential-mapping helper (e.g., a script that rewrites the referenced id/name on
  import) — it must still never embed secret values. This is not required for the
  current pipeline and is tracked as a future option, not a defect.

## 3. Credential types used across the pipeline

| Credential type (n8n) | Workflow(s) using it | Fields |
| --- | --- | --- |
| `googleSheetsOAuth2Api` | Prospect Finder (only; the other 8 attach post-import) | OAuth2 client id/secret + authorization |
| `httpHeaderAuth` | Prospect Finder — `Foursquare Places API` node only (H2-HYGIENE addition) | `name` = header name (`Authorization`), `value` = the bare Foursquare API token (no `Bearer ` prefix — the node expression prepends it) |

## 4. Post-import attach checklist (all machines)

1. **Prospect Finder** — create (or already have) a Google Sheets OAuth2 credential whose
   id **matches the referenced id** (`rOKhG0ESKifN5zy2`) **or** re-select the credential
   on the 7 Sheets nodes after import. Without a matching id, n8n shows the nodes as
   uncredentialed.
2. **Prospect Finder — Foursquare node (H2):** create an `httpHeaderAuth` credential
   named **exactly** `Foursquare API` (any id — the node references it by the name
   `Foursquare API` and id `912eb72c-6bd0-42b2-b16e-9ce526d45110`). Set `name =
   Authorization`, `value = <bare Foursquare API token>`. The node's
   `headerParameters` value `=Bearer {{$credentials.value}}` produces
   `Authorization: Bearer <token>`. **Do not** paste the token into the JSON.
3. **All other 8 workflows** — after import, open each Google Sheets node and attach the
   OAuth2 credential. None carry a credential reference in the file, so this is per-node
   manually.
4. **Live-runner environment config** (Response Interpretation V1 live tests) follows
   `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` — a **different** mechanism (env vars for the
   runner's own sheets access) than the in-workflow credentials above; do not confuse
   the two.

## 5. Environment variables and file hygiene

- `.env.example` documents every variable with **placeholders only** (no secrets).
- `.gitignore` excludes `.env*` (keeping `!.env.example`) and `reports/`, so neither
  `.env` files nor credential-shaped report output can be committed.
- Never commit `.env`; export values into the process (`$env:VAR = Read-Host ...` in
  PowerShell) rather than echoing them.
- The n8n instance itself holds the authoritative secret values (OAuth tokens, the
  Foursquare API token) — the repository holds only reference names and placeholders.

## 6. Secret-shaped value scan (H2/H5 evidence)

Literal scans of all repo text files for the former Foursquare token (40-char base32-style value, redacted here intentionally — see H2 in REPORT.md for the method) and credential-shaped payloads (`"data":`, `privateKey`, `private_key`, credential key names) found **no violations** after the H2 edit. The only surviving match for `places-api.foursquare` is the benign endpoint hostname in the Prospect Finder HTTP Request node. Note: `src/response-interpretation-live-runner.js` and its test deliberately contain `redact()` secret-shape **detection patterns** (AWS/GCP/OpenAI/PEM-style regexes and matching test fixtures) — these are pattern constants, not secrets.