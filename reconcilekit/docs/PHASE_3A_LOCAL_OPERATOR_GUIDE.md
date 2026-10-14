# Phase 3A — Local Operator Guide

**Status:** Operational (Phase 3A unblocker)
**Applies to:** `reconcilekit-storefront` `pilot-run` operator CLI
**Command:** `node storefront/src/cli/pilot-run.ts` (or `npm run pilot:run --prefix storefront -- ...` from the repo root)

---

## What this is

`pilot-run` is the operator entry point that makes the already-accepted Phase 3B
merchant CSV intake **executable**. It:

1. reads your merchant CSV file,
2. normalizes it through the frozen, already-accepted intake
   (`importCsv` under `storefront/src/marketplace/payment-sources/`),
3. records it exactly once into the payment-events store (`--run`, default is a
   non-mutating preview), and
4. reconciles the recorded events against provider evidence using the frozen
   ReconcileKit engine's exact-reference matching.

The pipeline composes existing library boundaries only. It reimplements no CSV
parsing, no correlation, and no matching logic — the matching keys stay exactly
as the accepted intake and engine define them.

### Why a separate CLI exists

The accepted ReconcileKit CLI lives under `reconcilekit/src/**`, which is frozen
by the architecture freeze. The operator surface described in
`PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` therefore ships as a **new** CLI in
`storefront/src/cli/pilot-run.ts`, which the storefront is permitted to grow.

---

## Command shape

```
pilot-run --merchant <path> (--provider <path> | --live-paystack)
          --timestamp-field <field> --currencies <list> [options]

Modes
  (default)  preview only   — parse, validate, interpret, and report. Nothing is written.
  --run                     — record the import exactly once, then reconcile and report.

Required
  --merchant <path>          merchant CSV file
  --timestamp-field <field>  Paystack timestamp to compare: created_at | paid_at | transaction_date
  --currencies <list>        currency codes, comma-separated (e.g. NGN)

Provider input (choose exactly one)
  --provider <path>          Paystack Verify JSON (one response object or an array)
  --live-paystack            fetch Paystack test-mode transactions live (needs a secret key)

Options
  --data-dir <path>          payment-events store directory
                             (default: the storefront data dir, or $STOREFRONT_DATA_DIR)
  --amount-unit <unit>       minor (default) | decimal
  --tolerance-ms <n>         timestamp tolerance when comparing (default: 60000)
  --import-id <id>           explicit import id (default: stable hash of CSV content)
  --output <mode>            text (default) | json
  -h, --help                 help
  --version                  version
```

### Merchant CSV columns

```
reference,amount,currency,status,occurred_at,source_reference
```

- `reference` is the merchant-side matching key.
- `amount` is integer **minor units** (kobo/cents) unless `--amount-unit decimal`.
- The intake accepts both uppercase and lowercase status values
  (`SUCCESS`, `success`, `FAILED`, `PENDING`, …) and normalizes them.
- `source_reference` is optional evidence; it is preserved but is **not** a
  matching key.

### Environment (live mode only)

```
RECONCILEKIT_PAYSTACK_SECRET_KEY=sk_test_...
```

`STOREFRONT_PAYSTACK_SECRET_KEY` is supported as a fallback. The secret is used
only for the Paystack request and is never printed.

---

## Workflow

### 1. Preview (safe first step)

```
node storefront/src/cli/pilot-run.ts \
  --merchant merchant.csv \
  --provider provider.json \
  --timestamp-field paid_at \
  --currencies NGN
```

Preview validates the CSV, shows the per-row interpretation, runs the engine on
the projected events, and writes nothing.

### 2. Record and reconcile (--run)

```
node storefront/src/cli/pilot-run.ts \
  --merchant merchant.csv \
  --provider provider.json \
  --timestamp-field paid_at \
  --currencies NGN \
  --run
```

`--run` records the import exactly once and reconciles the recorded events.
Re-running the same command is safe: the recorded counts read
`recorded 0 / replayed (exactly-once) N`, and the store is not duplicated.

The recorded rows are written to `payment-events.jsonl` in the data directory.
Point `--data-dir` at a scratch directory (or set `STOREFRONT_DATA_DIR`) until
you are ready to operate on real data.

---

## Example output

> The output below is **real output captured from the tool** run on **synthetic data**.

### Preview (text)

```
ReconcileKit payment-source pilot report

Phase: preview - no data was written

Import
  import id                     csv_b44c9b42
  source                        MANUAL_CSV
  rows                          4 (3 data rows)
  accepted                      3
  rejected                      0
  amount unit                   minor - integer minor units (e.g. kobo/cents for NGN)
  currency set                  NGN

Merchant row interpretation (per accepted row)
  1. T545417640929901  NGN 1200000 (minor units)  SUCCESS  occurred 1787029755000  source_reference src_101
  2. T545417640929902  NGN 3500000 (minor units)  FAILED  occurred 1787030000000  source_reference src_102
  3. T545417640929903  NGN 4500000 (minor units)  PENDING  occurred 1787030255000  source_reference src_103

Provider evidence
  source                        the provider Verify JSON file you supplied
  provider records              2
  provider CSV files are not supported as reconciliation evidence

Reconciliation summary
  Records processed             5
  Matched                       2
  Discrepancies found           0
  Unresolved                    0
  Held for review (ambiguous)   0
  Input errors                  0
  Missing from provider records 1
  Provider-only (unmatched)     0
  Missing or unusable reference 0

Results
  1. MATCH - merchant T545417640929901 | provider T545417640929901 (4123456789)
  2. MATCH - merchant T545417640929902 | provider T545417640929902 (4123456790)
  3. MISSING_PROVIDER_RECORD - merchant T545417640929903 | no provider record

Nothing was written to disk. Re-run with --run to record exactly once in "..." and reconcile from the recorded events.
```

### Recorded (after `--run`, same inputs)

```
Phase: recorded - the import was written to the payment-events store
...
  recorded                      3
  replayed (exactly-once)       0
```

The second `--run` reports `recorded 0 / replayed (exactly-once) 3`, and the
store file stays at exactly 3 rows.

### JSON (machine-readable)

`--output json` emits `phase`, `import` (with the projected rows and their
`source_event_id`), `provider`, `recorded` (`null` in preview), and the full
`engine` summary + results. Used by scripts and by the automated tests.

---

## Reading the outcomes

| Outcome                        | Meaning                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `MATCH`                        | Engine found exactly one provider record with the same reference and the records agree within tolerance. |
| `DISCREPANCY`                  | Matched, but amount / currency / status / time / duplicate checks differ. `codes:` lists why.            |
| `MISSING_PROVIDER_RECORD`      | The merchant record has no provider candidate. **Not** repaired by the CLI.                              |
| `UNMATCHED_PROVIDER_RECORD`    | Provider evidence exists with no merchant record. **Not** silently dropped.                              |
| `HELD_FOR_REVIEW` / unresolved | Requires manual review.                                                                                  |

Discrepancies are **report data, not CLI failures** — the exit code stays `0`.
The CLI never fabricates a match, a timestamp, or a marketplace anchor
(`mk_txn_...` is never invented; `merchant_record_id` stays `null` for raw
intake).

---

## Provider evidence

### Paystack Verify JSON (`--provider`)

A single Verify response object or an array of them:

```json
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "id": 4123456789,
    "reference": "T545417640929901",
    "amount": 1200000,
    "currency": "NGN",
    "status": "success",
    "created_at": "2026-08-18T05:09:15.000Z",
    "paid_at": "2026-08-18T05:09:15.000Z",
    "transaction_date": "2026-08-18T05:09:15.000Z"
  }
}
```

The provider reference (`data.reference`) is the join key. The engine matches on
exact reference equality plus the configured tolerance.

### Why provider CSVs are rejected

A provider CSV file is **not** accepted as evidence:

> A provider CSV cannot be reconciled structurally: it carries no deterministic
> join anchor against merchant CSV rows.

In practice the accepted engine joins on Paystack `reference`, not on a CSV row
order or a manual amount heuristic. Treating a provider CSV as evidence would
mean guessing the join — exactly what this project rejects. Export the
transactions as Paystack Verify JSON (or fetch them live in test mode) instead.

### Live test mode (`--live-paystack`)

Fetches transactions from Paystack in test mode using the secret key. The raw
secret is passed only to the Paystack transport; it is never printed or
included in reports.

### Live-mode evidence scope (whole-account fetch)

`--live-paystack` returns the provider's **whole test-mode account history**, not only
the transactions in your merchant export. This is the current behavior, not a defect.

Consequences:

- Your reconciliation window is defined by the merchant CSV. The live fetch is broader.
- Transactions on the account that are **not** in your merchant CSV will appear as
  `UNMATCHED_PROVIDER_RECORD` ("provider-only"). These are pre-existing account history,
  not reconciliation findings against your export.
- The reconciliation result for the transactions **that are** in your merchant CSV is
  identical whether you use `--live-paystack` or a scoped `--provider` Verify JSON file.

Recommended for windowed reconciliation:

- Use **`--provider <Paystack Verify JSON>`** (file mode) when you want the provider
  evidence scoped to exactly the transactions you are reconciling. This is the standard
  for windowed reconciliation.
- Use `--live-paystack` when you want to see the whole account, and read provider-only
  records as account history rather than as findings against your export.

Phase 3A observed 13 (Operator 1) and 18 (Operator 2) provider-only records in live mode;
both runs produced the identical matched-3 / unresolved-2 result in file mode. See
`docs/PHASE_3A_PILOT_FINDINGS.md` §9.

A reference/date-window scoping option for `--live-paystack` is recorded as optional,
non-blocking engineering follow-up (`PHASE_3A_PILOT_DECISION.md` §5). It is not
implemented and is not required for the pilot.

---

## Exit codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | Success. Findings like `DISCREPANCY` are report data.           |
| `1`  | Your input, the provider connection, or the store write failed. |
| `2`  | Invalid command-line usage.                                     |
| `3`  | Unexpected internal failure.                                    |

---

## Investigating a finding (Phase 3D)

A **finding** is any persisted reconciliation whose outcome is not `MATCH`.
The investigation workflow is three read-only pages, reachable from the
**Findings** entry in the customer nav:

1. **Findings summary** — `/findings`
   Lists every open finding: reference, outcome, code(s), amount, and the
   first validation note. Each row links to the per-record determination.

2. **Per-record determination** — `/findings/:reference`
   Shows both sides of the reconciliation (merchant record and provider
   record), the engine's outcome, the code(s), the validation notes verbatim,
   a plain-language **"What this means"** for each code, and the uniform
   **"What happens next"** operator action. A link opens the masked evidence
   pack.

3. **Masked evidence pack** — `/findings/:reference/evidence`
   Shows the frozen reconciliation snapshot, the masked provider facts, and
   the referenced timeline and audit events. Sensitive material (gift-card
   codes, ticket codes, tokens, card data) is removed by the existing
   redaction layer; only masked previews are carried.

**Read-only.** None of the three pages writes to the store. The engine is not
re-run. The outcome, codes, and notes come from the persisted evidence pack;
the merchant and provider records are shown from the current store state with
the frozen verdict authoritative above them.

### Worked example — `AMOUNT_MISMATCH`

Given a finding whose outcome is `DISCREPANCY` and whose code is
`AMOUNT_MISMATCH`:

- Summary row: reference, `DISCREPANCY`, `AMOUNT_MISMATCH`, amount, note
  `"amount mismatch: merchant 124999 vs provider 125000"`.
- Determination: merchant side `124999` NGN `SUCCESS`; provider side `125000`
  NGN `SUCCESS`; outcome `DISCREPANCY`; code `AMOUNT_MISMATCH`;
  **What this means** — "The two records share a reference but disagree on
  amount. Do not fulfill until the difference is resolved."; **What happens
  next** — "Investigate the discrepancy between the expected and provider
  records."
- Evidence: reconciliation snapshot for the pack, masked provider facts
  (`original_status: success`, timestamps, provider id), referenced event ids.

For `STATUS_UNRESOLVED` (the Phase 3A class of finding, merchant `PENDING` vs
provider `abandoned → UNKNOWN`), the **What this means** text is the same
operational rule the 3A pilot settled on: do not fulfill, follow up with the
customer, leave unresolved until payment evidence confirms capture.

Cross-reference: `OPERATOR-STATUS-SEMANTICS-REFERENCE.md` for the frozen
provider status mapping (`success → SUCCESS`, `failed → FAILED`,
`pending → PENDING`, `abandoned → UNKNOWN`, never `CANCELLED`).

## Troubleshooting

| Symptom                                                            | Cause and fix                                                                                                                                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merchant CSV import rejected N of M data rows`                    | Fix the listed rows/columns and re-run. Nothing was recorded.                                                                                                                            |
| `merchant CSV import accepted 0 of M data rows`                    | The file's columns don't match the intake's aliases (`reference`, `amount`, `currency`, `status`, `occurred_at`, …). Compare against the contract in `PHASE_3A_PILOT_INPUT_CONTRACT.md`. |
| `provider input is not valid JSON`                                 | The provider file is not a Paystack Verify JSON envelope. If it is actually a CSV, it is rejected by rule (see above) — export Verify JSON instead.                                      |
| `provider CSV files are not supported as reconciliation evidence`  | Convert the export to Paystack Verify JSON or use `--live-paystack`.                                                                                                                     |
| `cannot record the import in "<dir>"`                              | The `--data-dir` path is not writable. Use a writable scratch directory (or `$STOREFRONT_DATA_DIR`) and re-run.                                                                          |
| `live Paystack mode requires ... RECONCILEKIT_PAYSTACK_SECRET_KEY` | Set the secret (test mode) and re-run.                                                                                                                                                   |
| `live Paystack request failed: ...`                                | Connection or access problem, **not** a reconciliation finding. No records were matched. Check the key and network, then retry.                                                          |
| Re-run says `recorded 0 / replayed N`                              | Expected — the import is exactly-once. The store was not duplicated.                                                                                                                     |

---

## Design notes (what this CLI deliberately does not do)

- Does **not** parse CSV itself — it calls the accepted `importCsv`/`recordCsvImport`.
- Does **not** invent `mk_txn_...` anchors — raw intake keeps `transaction_id`
  null; provider records keep their own reference.
- Does **not** repair mismatches — the engine reports them.
- Does **not** write anything in preview mode — the future recorded state is
  shown via the same idempotency helpers `ingest` uses, so preview and record
  agree.
- Does **not** print secrets, ever.

## Where things live

| Thing                              | Location                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Operator CLI                       | `storefront/src/cli/pilot-run.ts`                                          |
| CLI tests                          | `storefront/test/cli/pilot-run.test.ts`                                    |
| Accepted intake                    | `storefront/src/marketplace/payment-sources/csv-intake.ts`                 |
| Event ingest (idempotency helpers) | `storefront/src/marketplace/payment-sources/ingest.ts`                     |
| ReconcileKit bridge                | `storefront/src/marketplace/reconcile-bridge.ts` / `to-reconcilekit.ts`    |
| Frozen engine + Paystack adapter   | `src/application/reconcile-records.ts`, `src/adapters/providers/paystack/` |
