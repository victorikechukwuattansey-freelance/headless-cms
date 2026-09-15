# Container Runbook — n8n for the Lead Recovery Engine

How to run the Lead Recovery Engine's n8n workflow artifacts in the Docker-based n8n
Community Edition instance that this repository targets. Supersedes nothing; it is the
**canonical operational pre-requisite** for any live execution (the Phase 6 live-runner
environment remains documented in `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` for the Response
Interpretation runner specifically).

> This document describes the container that this repository was developed and validated
> against (`serene_swartz`, n8n `2.38.7`). Facts below trace to reports in `reports/`
> where noted. No step in this runbook modifies a committed artifact.

---

## 2.1 Canonical container creation

n8n runs in Docker. The canonical container is:

```powershell
docker run -d --name serene_swartz `
  -p 5678:5678 `
  -v serene_swartz_data:/home/node/.n8n `
  n8nio/n8n
```

Rules (do not deviate casually):

- **Named volume `serene_swartz_data`, not a bind mount.** The n8n SQLite database lives
  at `/home/node/.n8n/database.sqlite` inside that volume (evidence:
  `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`, `reports/PROSPECT-FINDER-ISOLATION-MATRIX.md`).
  A bind mount changes credential/workflow durability semantics and is not the target
  environment of this runbook.
- **Editor port `-p 5678:5678`.** The n8n editor/API answers on host port `5678`.
- **Do NOT set `N8N_RUNNERS_BROKER_PORT` on the container itself.** The long-running
  server's task broker binds its own port (see §2.5 and §2.7). Setting the server's
  broker port via an env var on the container is how you break the broker-port
  separation this runbook mandates.
- **Do NOT use `--rm`.** Workflows and credentials live in the DB; a removed container
  takes the DB with it unless the named volume survives. `--rm` encourages that loss.
- **Do NOT publish additional ports** for runners. `n8n execute` (CLI) runs *inside* the
  container via `docker exec` and binds its temporary broker on a loopback port that does
  not need host forwarding.

Image pinning: the repository was validated against `n8nio/n8n` at **`2.38.7`**
(`reports/PHASE-6-5-REPORT.md`, `reports/PROSPECT-FINDER-GPL-ISOLATION.md`). Tag drift can
change node parameter schemas (the Merge node `combinationMode`→`combineBy` rename in 2.x
is the documented example — `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` §6.10). Prefer an
explicit tag over `latest`.

## 2.2 First-launch setup

1. **Start the container** with the canonical run in §2.1.
2. **Complete n8n setup** at `http://localhost:5678` — the first-launch flow creates the
   owner account. This is where the URI/instance basics get recorded.
3. **Verify the editor responds** before importing anything:
   ```powershell
   Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue
   Invoke-WebRequest http://localhost:5678 -UseBasicParsing | Select-Object StatusCode
   ```
4. **Confirm the container holds the workflow DB** — the container you import into must be
   the same one holding `/home/node/.n8n/database.sqlite`:
   ```powershell
   docker exec serene_swartz n8n --version     # 2.38.7 expected
   docker exec serene_swartz sh -c "test -f /home/node/.n8n/database.sqlite && echo DB-PRESENT"
   ```
5. **Create credentials in n8n** *before* or *at* workflow import (see §2.4). The exports
   reference credentials by id/name; the editor will prompt you to re-select them.
6. **Import the workflow artifacts** — UI import is recommended (UI path mitigates the
   `id`/`settings` import pitfalls in `docs/ARTIFACT-IMPORT.md`). For a quick import
   summary see §2.3, and read `docs/ARTIFACT-IMPORT.md` before choosing the CLI/API paths.

## 2.3 Import summary

| Path | Command / action | Use when |
| --- | --- | --- |
| **UI (recommended)** | n8n → Workflows → **Import from File** | Default path; editor resolves credentials and rejects read-only fields safely. |
| **CLI** | `docker exec -u node serene_swartz n8n import:workflow --input=<path>` | Scriptable; **fails** with `SQLITE_CONSTRAINT: NOT NULL constraint failed: workflow_entity.id` when the export has no top-level `id` (e.g. Response Interpretation / Approved Outreach H0 variants). |
| **API** | `POST /api/v1/workflows` (with `N8N_API_KEY`) | Remote provisioning; rejects read-only fields (`active`, `meta`, `tags`, `id`, `versionId`, `createdAt`, `updatedAt`, `triggerCount`, `isArchived`, `shared`) and rejects a `null` `settings` object. |

See `docs/ARTIFACT-IMPORT.md` for the full decision matrix (has id? fresh DB? etc.) and
exact error strings.

Import **identity caveat:** the n8n DB-local workflow id is what matters for
`docker exec … n8n execute --id <id>`; the id in the editor URL
(`http://localhost:5678/workflow/<id>`) is that DB-local id. Do not reuse the repo
filename as if it were the workflow id.

## 2.4 Credential re-attachment

Credential **ids are DB-local.** The workflow exports carry `{ id, name }` references
only — the secret material and the ids themselves live in the n8n SQLite credential store
(`docs/CREDENTIALS.md`). This has two hard consequences:

1. **After import you must actively re-select credentials in the editor.** n8n prompts for
   nodes whose referenced credential id does not exist in this DB. Re-selecting rebinds
   the node to the local credential object. Without that re-select the node runs
   uncredentialed (execution error / empty credential).
2. **Credentials do not survive container removal.** A new container (or a recreated
   volume) has an empty credential store: the same imports will again show unbound nodes.
   There is no vault persistence outside the n8n credential table. Plan for it.

Re-attachment checklist (per importing workflow):

- [ ] Open the workflow in the editor.
- [ ] For every node with a credential field, choose the local credential of the correct
      type (Google Sheets OAuth2 for `googleSheets*`, HTTP Header Auth for the Foursquare
      node).
- [ ] For the Prospect Finder's Foursquare node: create an `httpHeaderAuth` credential
      named **exactly** `Foursquare API`, `name = Authorization`, `value = <bare token>`
      (the node's expression prepends `Bearer `). The node references it by id
      `912eb72c-6bd0-42b2-b16e-9ce526d45110` and name `Foursquare API`.
- [ ] For any node using `{{ $env.X }}` (Prospect Finder → Google Places API node, which
      reads `GOOGLE_PLACES_API_KEY`): the container must be launched with
      `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` or the env var must be injected on the `docker
      exec` command (see §2.5).
- [ ] For the live-runner workflow (Response Interpretation V1): attach Google Sheets
      OAuth2 to `Read Response Log`; authorization must cover the pinned spreadsheet
      (`docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` §3.5).

After any credential change, **do a one-row smoke execution** before trusting the run:
status-gated reads/writes in the Prospect Finder make a dry pass non-obvious. The live
runners (`npm run response-interpret:live`, queue/reconcile `npm run …:live`) refuse to
claim a PASS without the environment present.

## 2.5 Known gotchas (all version-annotated)

| # | Gotcha | Detail | Evidence |
| --- | --- | --- | --- |
| 1 | `n8n execute --file` is broken in 2.38.7 | The `--file` CLI path is deprecated/broken in this build. Use `n8n execute --id <workflowId>` (or the CLI import path in §2.3). | `reports/PHASE-6-*` cli-backend evidence |
| 2 | Manual-trigger workflows cannot be API-triggered | The Community Edition public API cannot trigger a workflow whose trigger is Manual Trigger. That is why live execution uses `docker exec … n8n execute --id` (CLI) or the Phase 6.5 webhook→Manual-Trigger harness. | `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` §3, `reports/PHASE-6-5-REPORT.md` |
| 3 | Broker-port collision on `n8n execute` | The CLI spawns a **temporary** task broker that defaults to port `5679` — the port the running server holds. | `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` §3 |
| 4 | Broker-port fix for `docker exec` | Run: `docker exec -u node -e N8N_RUNNERS_BROKER_PORT=5680 serene_swartz n8n execute --id <id>`. 5680 must differ from the server's broker port (see §2.7). | `reports/PROSPECT-FINDER-GPL-ISOLATION.md` (container env list) |
| 5 | `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | Required for `{{ $env.X }}` in node expressions (Prospect Finder Google Places API node uses `{{ $env.GOOGLE_PLACES_API_KEY }}`). Without it the expression evaluates empty → 403. Set it on the container start env (or transiently on the `docker exec`; note: env-var injection on `docker exec` only affects that process). | `reports/PROSPECT-FINDER-GPL-ISOLATION.md` (D2/GPL 403), `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` |
| 6 | Credentials don't survive container removal | See §2.4. Volume `serene_swartz_data` preserves the DB across *recreate* only if the volume is not deleted. `docker rm` without `-v` keeps the volume; `docker compose down -v` / `docker volume rm` destroys it. | §2.4 |
| 7 | Rotate provider API keys on rebuild | After any container/volume rebuild the credentials you re-enter are new objects — treat the old keys as compromised-to-repo, rotate them if they ever touched a file. Also `GOOGLE_PLACES_API_KEY` must be Places-API-enabled on its GCP project (the D2 403 was a missing-API-enablement, not a key bug). | `reports/PROSPECT-FINDER-GPL-ISOLATION.md` (D2), §2.4 |
| 8 | Merge-node parameter migration (2.x) | The 2.x Merge node renamed `combinationMode` → `combineBy`. The current repo artifact is regenerated with `combineBy: "combineAll"` (5-input append Merge). If you import an older stock export into 2.x it crashes with `"You need to define at least one pair of fields in 'Fields to Match'"`. | `reports/PROSPECT-FINDER-GPL-ISOLATION.md`, `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` §6.10 |

## 2.6 Rebuild-from-scratch checklist

1. **Confirm intent** — rebuilds drop the workflow DB. If the live sheet already has
   `Running`/`Completed` statuses that you still depend on, set them back to `Pending`
   *after* the rebuild (n8n does not touch the sheet here).
2. `docker rm -f serene_swartz` — stop and remove the old container (leave the volume).
3. `docker volume rm serene_swartz_data` **only if** you intend to discard the DB.
4. Recreate with the canonical run (§2.1), plus `-e N8N_BLOCK_ENV_ACCESS_IN_NODE=false`
   if you will use the Google Places env-var node.
5. Complete first-launch setup (§2.2) — new owner account.
6. Import the workflow exports (UI recommended; see §2.3 / `docs/ARTIFACT-IMPORT.md`).
7. Re-attach credentials (§2.4) and re-seed env vars for runners
   (`docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` §2).
8. Smoke-execute one scenario and check the offline gates before trusting the pipeline
   (`npm test`, `npm run verify:frozen`, `node scripts/security-check.js`).

## 2.7 Broker-port convention

The n8n task broker has three distinct port uses; they must **never** share a port.

| Port | Owner | When it binds | Never |
| --- | --- | --- | --- |
| `5679` | **Running n8n server** (default broker) | at container start | never assign to a CLI/temporary broker |
| `5680` | **CLI temporary task broker** (`docker exec … n8n execute`) | per `run` while executing | never assign 5679; never leave a stale CLI running into another run |
| `5678` | n8n editor/API HTTP | at container start | never used as a broker port |

Convention in one line: **server on 5679, CLI broker on 5680, neither shares.** The
live-runner tooling additionally ships a configurable `RESP_INT_EXEC_BROKER_PORT`
(default `5677`) that must also differ from the server's broker port
(`docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` §2). If a run fails with a broker-address-in-use
(`EADDRINUSE`), assume a leftover CLI or a wrong `N8N_RUNNERS_BROKER_PORT` and re-check
this table.