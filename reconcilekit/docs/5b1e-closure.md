# 5B.1e — Phase Closure

Final closure record for 5B.1c, 5B.1d, and 5B.1e. This document is the durable
summary of the repository migration phase; the detailed inventories and audit
tables remain in the pre-flight documents referenced below.

## 5B.1c — repository migration

- Migrated 28 live schema tables to the repository layer across 1a–1k.
- Test count moved from 632 to 634:
  - D1 ledger-id uniqueness at 1e (633).
  - Missing-pack receipt path at 1f.3 (634).
- Zero production JSONL readers remained for the migrated kinds.
- Pre-flight records:
  - `docs/5b1c-1f-preflight-v2.md`
  - `docs/5b1c-1g-preflight.md`
  - `docs/5b1c-1g4-preflight.md`
  - `docs/5b1c-1k-preflight.md`

## 5B.1d — test fixture cleanup

- Fixed two stale `wallet_ledger` reads in tests.
- Narrowed two dead `store` parameters.
- Test count unchanged at 634/634.
- Pre-flight record: `docs/5b1c-1d-preflight.md`.

## 5B.1e — JSONL retirement

- **e.1** — Migrated notifications to `repos.notifications`, the last live
  JSONL kind. Storefront stayed at 634/634.
- **e.2** — Dropped the three catalog repositories and their tests, plus the
  test-only `seedCatalogToStore` / `loadCatalogFromStore` round-trip. Test
  count 634 → 621 (−13).
- **e.3** — Deleted `JsonlStore`, `StoreKind`, and the filename map; removed
  `Deps.store` and all store threading; retired the T7.8 contract tests
  (`store-kinds.test.ts`, `persistence-concurrency.test.ts`) and
  `store.test.ts`. Test count 621 → 606 (−15).
- **e.4** — This document and `docs/5b1-payments-split.md` (docs only).
- Pre-flight record: `docs/5b1c-1e-preflight.md`.

The e.3 test decrease is required, not optional: every retired test exercised
the deleted JSONL class. No replacement Postgres concurrency tests were added;
that remains an optional, separate scope decision.

## Final state

- Storefront: **606 / 606**
- Core: **213 / 213**
- Zero JSONL references in `src/` or `test/`
- Zero filesystem persistence in production
- All production I/O goes through `repos.*`, with the catalog supplied
  in-memory by `buildDemoCatalog()` via `deps.catalog`
- All pre-flight documents committed under `reconcilekit/docs/`

## Test-count trajectory

The durable count record:

```
632  (5B.1c start)
633  (1e, D1 ledger-id uniqueness)
634  (1f.3, missing-pack receipt path)
634  (through 1k)
634  (5B.1d)
634  (e.1, notifications)
621  (e.2, catalog repositories dropped: -13)
606  (e.3, JSONL layer deleted: -15)
606  (e.4, docs only)
```

Net across 5B.1: **632 → 606** (2 added, 28 removed).

## What remains for 5B.1f

- Handoff consolidation (§2, §4, §7, §9, §12, §16, §18, §19).
- Gate fixes:
  - T5.1 — ESLint TS
  - T7.11 — `test:clean` script
  - T7.13 — PowerShell BOM helper
- Re-baseline `PHASE_5_OPENING §7` amendment, queued per scope §3.6.
- Optional: Postgres-side concurrency coverage for the behavior formerly
  covered by the retired JSONL class.

## Standing guarantees after 5B.1e

- Canonical id discipline (T1.1).
- Idempotent upsert semantics (decision #8).
- Frozen boundaries: `ids.ts`, `wallet.ts`, `marketplace/types.ts`, and core
  `reconcilekit/src/**` remain untouched.
- Wallet-evidence tenant invariant (handoff §3).

## References

- `docs/5b1c-1e-preflight.md` — 5B.1e decomposition, full reference inventory,
  and repository audit (Part 5)
- `docs/5b1c-1d-preflight.md` — 5B.1d fixture cleanup
- `docs/5b1c-1f-preflight-v2.md`
- `docs/5b1c-1g-preflight.md`
- `docs/5b1c-1g4-preflight.md`
- `docs/5b1c-1k-preflight.md`
- `docs/5b1-payments-split.md` — canonical payments / marketplace_payments
  split
