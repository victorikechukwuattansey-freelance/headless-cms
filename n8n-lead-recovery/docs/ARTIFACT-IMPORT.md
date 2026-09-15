# Artifact Import Runbook — n8n workflow JSON → n8n instance

How to bring any of the nine Lead Recovery Engine workflow exports (plus the Response
Interpretation test harness) into an n8n instance. All paths were verified for the target
container (`serene_swartz`, n8n `2.38.7`) and the shipped exports in this repository.

> Pipeline context is in `docs/CONTAINER-RUNBOOK.md` §2.3 (import summary) and the
> one-line stage roles in `README.md` §1.2. This runbook is the detail behind that
> summary.

---

## 4.1 UI import (recommended)

The safest and handler-friendly path. It lets the n8n editor resolve credentials, warns on
unbound nodes, and does not trip the CLI/API import restrictions in §4.2–4.3.

1. Start the container (§2.1 of `docs/CONTAINER-RUNBOOK.md`) and open
   `http://localhost:5678`.
2. Workflows → **Import from File** → select the export (e.g.
   `Lead Recovery Engine — Prospect Finder & Validation V1.json`).
3. Resolve credential prompts: for each unbound node, select the local credential of the
   correct type (see `docs/CREDENTIALS.md` §2, §5). This re-select is mandatory — the
   export only carries id/name references.
4. Open the workflow, verify the node graph and connections match the spec (the offline
   `workflow` suites in `tests/*.test.js` assert import topology for every workflow).
5. Note the **DB-local workflow id** from the editor URL (`/workflow/<id>`) — that id is
   what `n8n execute --id <id>` and the live runners use.

Recommendation: for **any** fresh-machine import, use the UI unless you are automating a
known-compatible path.

## 4.2 CLI import

Scriptable import inside the running container:

```powershell
docker exec -u node serene_swartz n8n import:workflow --input=/path/to/workflow.json
```

- Runs as user `node` (owned DB files), against the container holding
  `/home/node/.n8n/database.sqlite`.
- The in-container path must be the path *inside* the container, or you must copy the file
  in first (`docker cp workflow.json serene_swartz:/tmp/workflow.json`).

**Failure case (verified against the shipped exports):** exports **without a top-level
`id` field** fail with

```
SQLITE_CONSTRAINT: NOT NULL constraint failed: workflow_entity.id
```

Because the CLI importer writes the export's `id` into the `workflow_entity.id` column
directly; a missing `id` violates the NOT NULL constraint. In this repository the
**Prospect Finder** export carries a top-level `id` (`WcUgtTPiKXPL0BLH`); the
**Response Interpretation** and **Approved Outreach** exports do **not** (they omit it),
so the CLI path fails on those. See the decision matrix in §4.4.

## 4.3 API import (REST)

Remote/second-instance provisioning via the n8n Community API (requires an API key —
n8n → Settings → API):

```http
POST /api/v1/workflows
X-N8N-API-KEY: <key>
Content-Type: application/json

{ ...workflow json... }
```

Known rejection behavior (verify before scripting against it):

- **Read-only fields are rejected.** The endpoint refuses `active`, `meta`, `tags`, `id`,
  `versionId`, `createdAt`, `updatedAt`, `triggerCount`, `isArchived`, and `shared`.
  Strip these keys (or omit the whole `meta` block) before POSTing.
- **A `null` `settings` object is rejected.** Provide a real (possibly empty) `settings`
  object — `{}` is accepted, `null` is not.
- The **webhook-url/trigger note:** the Community public API cannot trigger a
  manual-trigger workflow execution (§2.5 of `docs/CONTAINER-RUNBOOK.md`); this endpoint
  creates/updates workflow records — it is not the execution path.

## 4.4 Decision matrix

Pick the import path by export shape and destination state:

| Export has top-level `id`? | Destination DB fresh/empty? | Recommended path | Why |
| --- | --- | --- | --- |
| **Yes** (e.g. Prospect Finder) | yes | **CLI** (`n8n import:workflow --input=...`) | The `id` is honored; no NOT-NULL failure; editable in UI afterwards. |
| **Yes** | no (has ids already) | **UI** (or PUT against the existing id) | Avoids an `id` collision with an existing workflow; the editor resolves it cleanly. |
| **No** (e.g. Response Interpretation, Approved Outreach) | yes | **UI** (import from file) | UI tolerates no-id exports; CLI fails (`SQLITE_CONSTRAINT`). |
| **No** | no | **UI** (or API POST **after stripping** `meta`/`id`/read-only fields and giving non-null `settings`) | API POST accepts a stripped no-id payload; UI is still the least-friction path. |

Decision rule in one line: **id-bearing export → CLI/mostly-UI; id-less export → UI, or
API POST with read-only fields stripped.**

### Import-time credential note (all paths)

Import only registers nodes, connections, and (for id-bearing exports) the workflow id.
It does **not** create or copy credentials. After any import path:

1. Re-select credentials per `docs/CREDENTIALS.md` §5.
2. Set/verify `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` for the env-var-backed Google Places
   node.
3. Smoke-execute one scenario before treating the import as complete
   (`docs/CONTAINER-RUNBOOK.md` §2.4).