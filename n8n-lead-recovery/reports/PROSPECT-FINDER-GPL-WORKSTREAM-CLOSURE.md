# Prospect Finder GPL Isolation — Workstream Closure
**Date:** 2026-09-15
**Status:** PARKED — PARTIAL
**Artifact SHA-256:** 630aae88…e1e580 (re-baselined by A.10 — D7 fixed)
**Test suite:** 867/867 PASS (857 + A.10 additions)
**Frozen manifest:** 10/10 PASS

---

## 1. Verdict

**PARTIAL.** Infrastructure validated live. Substantive isolation
verdict blocked by one open defect (D7) and three external state
issues (GCP billing, FSQ token, Overpass rate limit).

The workstream is closed. Resume conditions are documented in §7.

---

## 2. Scope

Live validation of the Google Places integration inside the
production Prospect Finder workflow, per the workstream proposal:
prove the three-provider acquisition path works and that one
provider's failure does not destroy the pipeline.

---

## 3. What was validated live

| Claim | Evidence |
|---|---|
| SplitInBatches loop processes rows sequentially | `maxRunIndex: 3`, three rows iterated |
| Per-provider error envelopes fire correctly | `GPL Error Envelope` and `FSQ Error Envelope` both emitted schema-complete payloads |
| Error envelopes carry required schema | `input_id`, `search_input_id`, `_provider`, `_status`, `_errorMessage`, `_rawStatus`, `source`, `notes` |
| Success XOR error routing per provider | GPL 403 → error branch; FSQ 401 → error branch; OSM 504 → `Handle API Error` |
| A.5 builder determinism | Byte-identical double build; new hash re-baselined |
| A.6 error-path wiring | Live-fired during the run |
| A.7 schema-parity guards | Tests green |
| A.8 Merge param + HTTP v4 migration | Node sends `X-Goog-Api-Key` and JSON body; response is a real 403, not a pre-flight drop |
| A.9 Merge append mode | Confirmed in container (`"mode": "append"`) |

---

## 4. What was NOT validated

| Claim | Blocker |
|---|---|
| Full isolation matrix (ISO-001/002/003) | Loop stalls at first Merge (D7) |
| Merge preserves partial results | D7 — Merge waits for all `numberOfInputs` before emitting |
| Loop terminates cleanly | `done: false`; ISO-002/003 remain `Pending` |
| All-providers-succeed cell | GPL 403, FSQ 401, OSM 504 |
| GPL-returns-empty cell | Indistinguishable from GPL 403 until billing restored |

---

## 5. Defects fixed (A.5–A.9)

| Phase | Defect | Fix |
|---|---|---|
| A.5 | Prospect Finder had no builder; maintained via mutation script | Deterministic builder (`scripts/build-prospect-finder-workflow.js`) |
| A.6 | §6.3/§6.4/§6.6 — GPL error output unwired; FSQ had no `onError`; `_noResults` sentinel traversed to Raw Leads | Error envelopes for GPL and FSQ; `Filter Empty Envelopes` before Raw Leads |
| A.7 | Schema drift guard absent | Tests pin `input_id` + `search_input_id` on both error envelopes |
| A.8 | Merge used v1 param `combinationMode`; GPL HTTP node used v1 params (`jsonParameters`, `bodyParametersJson`) and sent no auth header | `combineBy` rename; `jsonBody` + `sendHeaders` + field mask |
| A.9 | Merge mode `combine`/`combineAll` computed cartesian product; `Dedup & Prepare Verified` lacked `alwaysOutputData` | `mode: append`; `alwaysOutputData: true` |

Each fix was applied through the builder, re-baselined in the
manifest, and byte-verified.

---

## 6. Open defects

### D7 — Merge waits for all inputs — **FIXED (Prompt A.10, R6)**

**Symptom:** with `mode: append` and `numberOfInputs: 5`, when the
three success-path inputs (Process FSQ, Process OSM, Process GPL)
produce zero items — as they do when the corresponding provider
errors — Merge emits zero items even though inputs 3 and 4 carried
error envelopes.

**Root cause:** the topology dedicates separate Merge inputs to
success and error. On any run, one of each pair fires and the
other stays empty. Merge requires all declared inputs before
emitting.

**Fix applied (A.10):** consolidated to `numberOfInputs: 3`, one
input per provider. Each provider's success and error paths now
feed the same input:

    Process FSQ         → Merge[0]
    FSQ Error Envelope  → Merge[0]
    Process OSM         → Merge[1]
    OSM Error Envelope  → Merge[1]   (new node, mirrors GPL/FSQ)
    Process GPL         → Merge[2]
    GPL Error Envelope  → Merge[2]

Applied through the canonical spec +
`scripts/build-prospect-finder-workflow.js` (no artifact hand-edits):
- New `OSM Error Envelope` code node (mirrors the FSQ/GPL envelope
  byte-pattern; context `$('Build OSM API Query')`), fed by the
  `OpenStreetMap Overpass API` error output AND the `API Success?`
  false branch.
- Deviations from the original A.10 sketch, both deliberate: the
  two OSM error edges were **NOT removed** — they now fan out to
  both `OSM Error Envelope` and `Handle API Error` (raw data to the
  envelope, same raw data to the status-marking path), preserving
  the failing-search status update (`Handle API Error → Update
  Status Failed`) that §3 validated live; the FSQ/GPL envelope
  edges were retargeted Merge index 4→0 and 3→2.
- New artifact SHA-256 `630aae88…e1e580` (83,406 bytes, 33 nodes /
  16 code nodes). Re-baselined in `tests/prospect-finder-builder.test.js`
  (hash anchor), `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` §12.3
  (R6), and this doc. See
  `reports/PROSPECT-FINDER-A10-MERGE-CONSOLIDATION-REPORT.md`.

**Residual (out of A.10 scope):** if a provider *succeeds with zero
results*, `Process GPL` emits a `_noResults` sentinel (input 2 stays
fed), but `Process FSQ` / `Process OSM` emit nothing on an empty
success — that input would remain empty on such a run. Not
addressed here (would change provider code bodies, out of scope);
noted so a future re-run watches for it.

**Impact if unfixed:** every run in which any provider's success
path is empty will stall at Merge. In practice, this is the normal
case for a partially-credentialed environment.

---

## 7. External blockers (not code)

| Blocker | Impact | Fix |
|---|---|---|
| GCP billing account frozen | GPL returns 403 `PERMISSION_DENIED` on every call regardless of key state | Restore billing at console.cloud.google.com/billing |
| FSQ credential token invalid | FSQ returns 401 `Invalid request token` | Provision a valid Foursquare Places API token, update credential `71soVf1y0Y8VwM9x` |
| Overpass API timeout (504) | OSM returned `Dispatcher_Client::request_read_and_idx::timeout` — server-side load | Retry; use a larger `[timeout:N]` or a different Overpass mirror if persistent |

These are environment conditions, not workflow defects. The
workflow behaved correctly given each response.

---

## 8. Resume conditions

1. **A.10 — DONE (2026-09-15).** D7 fix applied through the builder;
   artifact re-baselined (`630aae88…e1e580`). Re-importing into the
   container and re-attaching credentials are still required before
   any live run — out of A.10 scope (STOP after re-baseline).
2. **Restore GCP billing** — enables the all-success and
   GPL-returns-empty cells.
3. **Provision a valid FSQ token** — enables the all-success cell.
4. **Re-run Prompt B** — with a fresh seed of ISO-001 through
   ISO-003 in Austin, TX.

On successful re-run:
- `lastNodeExecuted` should be `End`
- `Loop Through Searches.done: true`, `currentRunIndex: 3`
- Raw Leads should contain per-input rows from at least one
  provider's success path
- GPL error envelope should be absent (billing restored) unless
  ISO-003 intentionally uses an invalid key

If all three conditions are met, the workstream upgrades from
PARTIAL to PASS.

---

## 9. Artifact state at closure

| Item | Value |
|---|---|
| Production workflow JSON | `Lead Recovery Engine — Prospect Finder & Validation V1.json` |
| SHA-256 | `630aae88…e1e580` (R6 — A.10 re-baseline) |
| Bytes | 83,406 |
| Node count | 33 (16 code nodes) |
| Builder | `scripts/build-prospect-finder-workflow.js` (byte-identical on double build) |
| Mutation script retired | `scripts/add-gpl-to-workflow.js` (header-commented, not deleted) |
| Tests | 867/867 PASS, 0 failures |
| Frozen manifest | 10/10 PASS |
| Secret scan | GREEN |
| Container | `serene_swartz` (Docker, named volume `serene_swartz_data`) |
| Workflow id | `WcUgtTPiKXPL0BLH` |

---

## 10. Change log

| Revision | Phase | Summary |
|---|---|---|
| R1 | A.5 | Builder extracted; artifact byte-identical |
| R2 | A.6 | Error envelopes for GPL/FSQ; `Filter Empty Envelopes` |
| R3 | A.7 | Schema drift guards |
| R4 | A.8 | Merge param rename; GPL HTTP v4 migration |
| R5 | A.9 | Merge append mode; `alwaysOutputData` on Dedup |
| R6 | A.10 | D7 FIXED: Merge consolidated 5→3 (one input per provider); `OSM Error Envelope` added (success+error feed same input) |

---

## 11. Recommendation

A.10 (D7 fix) is now applied and re-baselined (R6, 2026-09-15) — the
allocated engineering work for merging is complete. The next live
step is an operator task: re-import the artifact into the container and
re-attach credentials, then re-run when:

- re-imported into `serene_swartz` with credentials re-attached
- GCP billing is restored
- A valid FSQ token is available

None of these are code work. The remaining code-adjacent item is the
hygiene workstream (Foursquare hardcoded token, git baseline, README
correction, credentials review) — where the next session's effort
should go.
