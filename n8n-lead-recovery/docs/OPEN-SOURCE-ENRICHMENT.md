# Open-Source Enrichment — Column, Journal & Freeze Contract

This document is the operating contract for the **Enrichment V1** artifact:
what it owns, how it is built, how it is verified, and how it stays frozen.

## Artifact

- **Shipped workflow:** `Enrichment V1.json` (16 nodes, deterministic build).
- **Builder:** `scripts/build-enrichment-workflow.js` — the single source of
  truth for node wiring, positions, ids, sheet targets, and the six
  workflow-local code bodies. Rebuilding it must produce a **byte-identical**
  file (`npm run enrichment:build`), enforced by
  `tests/enrichment-workflow-build.test.js`.
- **Sole write surfaces (decision D-C0):** the `Contact Enrichment Log` tab
  (append-only) and, on `Approved Outreach`, exactly the two enrichment-owned
  columns `contact_blocked` + `contact_source_provider` (match on `lead_id`).
  Nothing else in the spreadsheet is written or read.
- **Pinned spreadsheet:** the id in `src/response-interpretation-workflow-contract.js`
  (`SPREADSHEET_ID`) is the only document the sheets nodes may target.

## Ownership split with the handoff workflow

| Tab / column set                        | Owner              |
| --------------------------------------- | ------------------ |
| Approved Outreach, first 21 columns     | Handoff V1         |
| Approved Outreach `contact_blocked`, `contact_source_provider` | Enrichment V1 |
| Verified Leads enrichment columns (`enrichment_business_status`, `enrichment_confidence`, `enrichment_gers_id`, `enrichment_last_run`) | Overture/Enrichment business half (via Overture loader) |
| Contact Enrichment Log (A–N)            | Enrichment V1 (append) |

The handoff append path is guarded to never write the two enrichment-owned
columns; the enrichment update path is pinned to only those columns (see the
update-node shape test in `tests/enrichment-workflow-build.test.js`).

## Execution semantics

1. **Read-first:** the node re-reads both tabs at run start; cache and approved
   rows are honored exactly as found (operator pruning between runs is respected).
2. **Provider contact pass** (`Enrich Contact`): provider-labeled by the run —
   **AgentData by default, Hunter selectable** (`ENRICHMENT_PROVIDER` /
   `payload.provider`). Pays credits only on a cache miss; picks the best email
   from the injected `agentdataResults`/`hunterResults` seam (selected by the
   run's provider), never calls the network and never reads an API key inside
   the workflow. Provider-empty `no_emails_found` productions are still logged
   (with `notes`) so the OSS fallback and later operators can revisit.
3. **OSS fallback pass** (`Enrich Contact OSS Fallback`): zero-credit resolver
   seam over the US-only, not-yet-enriched lead scope; empty-with-block
   productions surface as `manual` decisions (`contact_blocked: TRUE`).
4. **Consolidation:** one update per lead, provider-wins ties, richer row
   replaces a stub; log rows deduped by `enrichment_key`; `contact_provider`
   labels the run; `_hasOutput` decides the IF branch; fatal or empty runs
   converge on `No-Op End` with zero writes.
5. **Report:** run + per-provider metrics only (dynamic `provider_runs` key for
   the executed contact provider), no raw lead fields.

Details in `docs/ENRICHMENT-LOG.md` (Phase 6.6).

## Security posture

- The shipped JSON contains **no credential**, no `Authorization` header, no
  `HUNTER_API_KEY`/`HUNTER_*KEY`/`AGENTDATA_API_KEY`/`AGENTDATA_*KEY` token, no
  `$env`/`process.env` access, and no fixture email/domain material.
- All 8 code nodes pass `assertCleanSource` (no `require`, `fetch`, `eval`,
  `new Function`, `Math.random`, `Date.now`, `https://`).
- `npm run enrichment:security` re-scans both shipped workflows and must report
  no hits on the enrichment artifact.

## Environment vars (see `.env.example`)

```dotenv
ENRICHMENT_PROVIDER=agentdata  # default contact-enrichment provider; set hunter to reactivate the legacy provider
AGENTDATA_API_KEY=             # AgentData domain-search credentials (runner-injected, never embedded)
HUNTER_API_KEY=                # Hunter.io domain-search credentials (only when ENRICHMENT_PROVIDER=hunter)
HUNTER_TRANSPORT=cli           # autocomplete page accepts: cli | rest
```

These are read by the live runner only — never by the shipped workflow code —
and are injected as provider seams at execution time. The API shapes in play
are documented in `docs/AGENTDATA-API.md` (AgentData) and the Hunter-style
`domainSearch` contract (see tests).

## Testing

- `npm run enrichment:test` — engine + workflow-build suites (Hunter GPS
  fixtures 007–013, AgentData fixtures 020–026; parity, determinism,
  structural freeze).
- `npm test` — full repo suite (1142 tests baseline).
- `npm run verify:frozen` — re-asserts the frozen-artifact manifest.

## Freeze policy

Additions to the enrichment surface are only allowed through the builder
(`scripts/build-enrichment-workflow.js`) and must keep: byte-deterministic
output, clean-source nodes, pinned write surface, ancestry-clean `$('...')`
references, and manifest re-enrollment (`R-ENRICH-2`, see
`frozen-artifacts.manifest.json`). Any hand-edit of `Enrichment V1.json` that is
not reproducible by the builder breaks the freeze and must be reverted.