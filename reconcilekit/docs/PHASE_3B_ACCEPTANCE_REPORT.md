# PHASE 3B - IMPLEMENTATION AND ACCEPTANCE REPORT

**Project:** Reconcile Kit
**Phase:** 3B - Merchant CSV Intake & Onboarding
**Date:** 2026-09-08
**Status:** `PHASE 3B IMPLEMENTED AND ACCEPTED`

> **Method note.** This report follows the workspace's `Read → Inspect → Diagnose → Plan → Implement → Verify → Report` engineering sequence (per `ENGINEERING.md`). Scope is strictly Phase 3B; no Phase 3A, 3C-3F, auth, multi-tenancy, billing, deployment, webhooks, PostgreSQL, FX, or second matcher work was performed.

---

## A. Scope Delivered

Phase 3B delivers a **deterministic merchant CSV intake and onboarding boundary** that converts raw merchant-dashboard CSV exports into the existing Payment Source Layer representation (`PaymentEventInput`) and records them exactly once via the frozen `pevt_...` idempotency mechanism.

- **Intake:** column aliasing (schema normalization only), minor-unit conversion preview, timestamp normalization (ISO and epoch-ms), currency/status validation.
- **Output:** structured `CsvImportResult` with import ID, total/accepted/rejected rows, normalized events, row-level diagnostics, and typed errors.
- **Persistence:** exact-once via the existing `payment_events` JSONL store and `ingestPaymentEvent`. No new DB abstraction.
- **Boundary:** ingestion ends at normalized source/payment evidence. `reconcileRecords()` remains the sole matcher (unchanged).

Not implemented (explicitly out of scope): Phase 3A pilot, 3C detail surface, 3D investigation workflows, 3E webhooks, 3F durable persistence, auth, multi-tenancy, billing, deployment.

## B. Files Created

| File | Purpose |
| --- | --- |
| `storefront/src/marketplace/payment-sources/csv-intake.ts` | Core Phase 3B module: pure `importCsv` parse/validate/normalize + durable `recordCsvImport`. Exposes `CsvImportErrorCode`, typed result/error/row-diagnostic types, `parseAmountMinor`, `normalizeStatus`, `buildImportId`, `parseCsv`, `toEpochMs`. |
| `storefront/test/marketplace/csv-intake.test.ts` | 17 tests: happy paths (reconcilekit-style + Paystack-style), amount units, all validation rejections, mixed diagnostics, idempotency/determinism, provenance, architectural protection, end-to-end engine boundary, rejected-rows-no-persist. |
| `storefront/test/fixtures/synthetic-reconcilekit.csv` | Synthetic (clearly labeled) reconcilekit-column-shape fixture: `merchant_reference,amount,currency,status,occurred_at,source_reference`. |
| `storefront/test/fixtures/synthetic-paystack-export.csv` | Synthetic Paystack-dashboard-shape fixture: `Reference,Transaction Date,Amount Paid,Currency,Status,Source Identifier,Customer Email`. |

The real fixtures `merchant.csv` and `merchant-reconcilekit.csv` at the repo root were read for shape reference but **not** modified.

## C. Architecture Compliance

- **`reconcileRecords()` remains the sole matcher.** `csv-intake.ts` never matches, correlates, fuzzy-matches, or second-guesses reconciliation. It only normalizes to `PaymentEventInput` and records. The end-to-end test routes recorded evidence through `reconcilePaymentEvents` → the unchanged `reconcileRecords()`.
- **Payment Source Layer reuse.** Intake reuses `manualCsvPaymentEvent` (existing adapter), `buildIdempotencyKey`/`buildPaymentEventId`/`ingestPaymentEvent`/`assertSourceIdentity` (existing frozen ingest), and the existing `payment_events` JSONL store. No persistence redesign.
- **Raw intake is merchant-side evidence only.** Raw CSV events carry `transaction_id: null`; they contribute merchant rows, and only hosts attaching a marketplace anchor produce provider rows (via the unchanged bridge).
- **Column aliasing ≠ correlation.** Column aliases (`reference`, `amount_paid`, `currency`, `status`, `occurred_at`, `source_reference`) map schema shapes only; they never perform amount/timestamp-only matching.

## D. Identifiers & Idempotency (frozen Phase 2 hierarchy preserved)

- `merchant_reference` = CSV `reference` column (matching key).
- `payment_source_reference` = CSV `source_reference`/`provider_reference`/`source_identifier` column (**evidence only**).
- `source_event_id` = `${importId}_${importRowIndex}` — deterministic, replay-safe.
- `transaction_id` = always `null` for raw intake; **never** fabricated from CSV data, never `mk_txn_...`.
- **Exactly-once:** `recordCsvImport` replays resolve to the already-persisted event (`replay: true`), no duplicate store rows. Verified by test: second import of the same fixture records 0 and replays 3, with identical `event_id`/`idempotency_key`.
- **No randomness:** module contains no `Math.random`, `crypto`, or `randomUUID`. `buildImportId` is a stable FNV-style hash of the CSV text; test confirms same input → same id.

## E. Money / Amount Handling

- **Integer minor units, explicit currency, deterministic parsing, no floats.**
- `parseAmountMinor(value, unit, scale=2)`:
  - `unit: "minor"` (default) — value already minor units (matches real reconcilekit/Paystack kobo exports): `"100000" → 100000`.
  - `unit: "decimal"` — decimal major → minor: `"1000" → 100000`, `"9750.00" → 975000`, `"250.5" → 25050`.
  - Unit mismatch is rejected (`"9750.00"` in `minor` mode → `null`), never silently reinterpreted.
- The conversion preview is explicit and documented via `CsvImportOptions.amountUnit`; the unit is never guessed.

## F. Status Normalization

- Raw statuses map only to the canonical set: `SUCCESS`, `FAILED`, `CANCELLED`, `PENDING`, `UNKNOWN` (`success/approved → SUCCESS`, `failed → FAILED`, `cancelled/canceled → CANCELLED`, `pending → PENDING`, `unknown → UNKNOWN`).
- **Unknown statuses are rejected** (`INVALID_STATUS`), never coerced to SUCCESS/FAILED. Verified by test.
- Missing status is allowed (stays `null`), matching the existing `manualCsvPaymentEvent` convention.

## G. Validation & Errors

Typed, explicit results — no console-only errors, swallowed exceptions, ambiguous `null`, or silent row dropping:

- `MALFORMED_CSV`, `MISSING_REQUIRED_COLUMN`, `MISSING_REFERENCE`, `INVALID_AMOUNT`, `MISSING_CURRENCY`, `INVALID_CURRENCY`, `INVALID_STATUS`, `INVALID_TIMESTAMP`, `CONFLICTING_FIELDS`, `NO_SOURCE_IDENTITY`.
- Ambiguous duplicate headers → `CONFLICTING_FIELDS`.
- Per-row `CsvRowDiagnostic.rowIndex/status/error` and a top-level `errors[]` for multi-row import reporting.
- `occurred_at` accepts both ISO instants (Paystack) and bare epoch-ms strings (reconcilekit fixtures) deterministically.

## H. Test Results (baseline 388/601 → green + new)

| Gate | Result |
| --- | --- |
| Phase 3B tests (`csv-intake.test.ts`) | **17/17 PASS** |
| Storefront suite | **405/405 PASS** (388 baseline + 17 new) |
| Root suite (`npm test` from repo root, recursive) | **618/618 PASS** (601 baseline + 17 new) |
| Storefront typecheck | **PASS** |
| Root typecheck | **PASS** |
| ESLint (`npm run lint`) | **PASS** |
| Prettier (`npm run format:check`) | **PASS** |

All Phase 3B tests verified: happy path (both fixture shapes), amount-unit control, missing/conflicting column, missing reference, invalid amount, missing/unsupported currency, invalid status, invalid timestamp, mixed row diagnostics, exactly-once idempotency, stable import ID, provenance, `mk_txn_`-never-from-CSV architectural protection, end-to-end engine boundary, and rejected-row no-persist.

## I. Protected-Core Verification

- `reconcilekit/src/**` is **unchanged**. Zero files under `reconcilekit/src` have a 2026-09-08 modification date (22 files present, all dated pre-session). This includes `Application::reconcile-records.ts` (`reconcileRecords`) and `Domain::model.ts` (`PaymentRecord`).
- The only files written this session are the four Phase 3B files listed in **B**, all under `storefront/`.
- No reference from `reconcilekit/src/**` to `csv-intake`/`importCsv`/`recordCsvImport` — the engine remains decoupled from intake.
- No second matcher introduced; `export function reconcile` appears only in the pre-existing `reconcile-records.ts` (`reconcileRecords`) and `domain/reconcile.ts` (`reconcile`, internal).

## J. Acceptance Conclusion

Phase 3B (Merchant CSV Intake & Onboarding) satisfies its frozen scope and gates:

- ✅ Deterministic, typed, provenance-rich CSV intake.
- ✅ Merchant rows normalized to contract-correct minor units with an explicit conversion preview.
- ✅ Column mapping + timestamp normalization (ISO + epoch-ms).
- ✅ Exactly-once idempotent recording via the existing `payment_events` store / `pevt_...` mechanism.
- ✅ No engine/persistence redesign; `reconcileRecords()` untouched and sole matcher.
- ✅ Baseline + new suites, both typechecks, lint, and prettier all green.
- ✅ Protected core (`reconcilekit/src/**`, `PaymentRecord`, `reconcileRecords`) verified unchanged.

---

## CONCLUSION

**PHASE 3B IMPLEMENTED AND ACCEPTED.**

**PHASE 3A OPERATIONAL PILOT REMAINS PENDING** (not implemented in this session; a separate operational pilot requiring =2 real operators, per `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §11).
