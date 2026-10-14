# PHASE 3A — PILOT INPUT CONTRACT

**Project:** ReconcileKit (Core + Storefront)
**Type:** Decision artifact (read-only specification; no implementation performed)
**Date:** 2026-09-09
**Status:** Specifies the pilot input contract for **Model B** (merchant CSV + Paystack Verify/live)

> Companion to `docs/PHASE_3A_BLOCKER_ANALYSIS.md`. This contract states, field by field, what an
> operator must supply to run a 3A reconcile and what the engine will and will not do with it.
> References: identifier hierarchy is norm-anchored to freeze §5; intake semantics to
> `payment-sources/csv-intake.ts` and `manual-csv.ts`; provider projection to
> `payment-sources/to-reconcilekit.ts`.

---

## 1. Scope & Non-goals

**In scope**

- Merchant CSV (operator export, normalized to the SDK contract).
- Provider evidence via Paystack Verify JSON (file mode) or `--live-paystack` (test mode).
- Join rule, identifier mapping, amount/status/timestamp normalization, idempotency, and
  validation outcomes.

**Out of scope (frozen / not implemented here)**

- **No provider CSV** as provider evidence — structurally impossible under the frozen
  provider-row gate (see Blocker Analysis §5).
- No fuzzy/amount-only/timestamp-only matching; no second matcher; no identifier fabrication.
- No engine, adapter, or protected-core changes.
- No webhooks (3E), persistence (3F), auth, CSRF, multi-tenancy, billing, or deployment.

---

## 2. Pilot Model

| Input         | Model B (recommended)                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Merchant side | Operator dashboard export, converted to the SDK merchant CSV contract (below)                     |
| Provider side | Paystack Verify JSON (file mode, one per transaction) OR `--live-paystack` (test mode, fetch-all) |
| Join anchor   | Exact equality `merchant_reference` (CSV `Reference` column) == Paystack `data.reference`         |
| CLI           | `node src/cli/index.ts --merchant <frozen-contract.csv> (--provider <verify.json>                 | --live-paystack) --timestamp-field paid_at --currencies NGN` |

---

## 3. Merchant CSV Contract (frozen, must be exact)

Column set (order-insensitive; names exact for the CLI `parseMerchantCsv`):

```csv
merchant_reference,amount,currency,status,occurred_at,merchant_record_id
T545417640929891,1000000,NGN,SUCCESS,1787029755000,6468155450
```

| Column               | Required                | Type                                               | Rules                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merchant_reference` | no (fallback available) | string                                             | Matching key on the merchant side. If absent/blank the CLI reports `MISSING_REFERENCE` (exit 0, report data — not a hard failure).                                                                                                                                                                                                                       |
| `amount`             | **yes**                 | non-negative safe integer                          | **Minor units only** (NGN = kobo). `10000` is ₦100.00, **not** ₦10,000.00; `1000000` = ₦10,000.00. Non-integer/negative/over-safe-int ⇒ hard input failure (exit 1).                                                                                                                                                                                     |
| `currency`           | **yes**                 | string                                             | Must be in `--currencies` list (e.g. `NGN`). Absent ⇒ hard failure.                                                                                                                                                                                                                                                                                      |
| `status`             | no                      | canonical token                                    | `SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`, `UNKNOWN`; absent/blank ⇒ `null`. Non-canonical (e.g. lowercase `success`) maps to `UNKNOWN` in the CLI (`manual`/intake path canonicalizes: `success/approved→SUCCESS`, `failed→FAILED`, `cancelled/canceled→CANCELLED`, `pending→PENDING`, `unknown→UNKNOWN`; unrecognized is rejected `INVALID_STATUS`). |
| `occurred_at`        | no                      | epoch-ms OR `YYYY-MM-DD` OR ISO-8601 + explicit tz | Ambiguous timezone-less ISO is rejected.                                                                                                                                                                                                                                                                                                                 |
| `merchant_record_id` | no                      | string                                             | Reported verbatim on the merchant row (display/record id; not a matching key).                                                                                                                                                                                                                                                                           |

**Real-world conversion reference:** the repo-root `merchant.csv` (Paystack dashboard shape,
22 columns) → `merchant-reconcilekit.csv` (SDK contract) is the canonical worked example:
`Reference=T545417640929891`, `Amount Paid=10000`, `Currency=NGN`, `Status=success`
→ `merchant_reference=T545417640929891, amount=1000000 (minor), currency=NGN, status=SUCCESS,
occurred_at=1787029755000 (epoch-ms of "Aug 18th, 2026 06:09:15 AM"), merchant_record_id=6468155450`.

**Accepted-dependency note:** the 3B intake (`importCsv` / `recordCsvImport`) accepts the messy
dashboard shape directly via aliases (`reference`, `amount_paid`/`paid_amount`, `currency`,
`status`/`payment_status`, `transaction_date`/`created_at`/`paid_at`, `source_reference`) and an
explicit `amountUnit` preview. That path is library-only today (Blocker §B3); when the operator
runner exists (Blocker §8.1), it is the _intended_ conversion tool and its output must satisfy this
contract exactly. The CLI file mode itself is minor-units-only.

---

## 4. Provider Evidence Contract

### File mode (`--provider`)

Paystack Verify response shape (exact fields read):

```json
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "id": 4123456789,
    "reference": "REF-A",
    "amount": 20000,
    "currency": "NGN",
    "status": "success",
    "created_at": "2023-11-14T22:13:20.000Z",
    "paid_at": "2023-11-14T22:13:20.000Z",
    "transaction_date": "2023-11-14T22:13:20.000Z"
  }
}
```

| Field                                         | Required | Notes                                                                                                        |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `data` (object)                               | yes      | Missing ⇒ `provider input failed` (exit 1).                                                                  |
| `data.reference`                              | no       | **Join key against `merchant_reference`.** Absent ⇒ provider row with `reference: null` ⇒ no match possible. |
| `data.amount`                                 | yes      | Minor units, non-negative safe int.                                                                          |
| `data.currency`                               | yes      | Must be in `--currencies`.                                                                                   |
| `data.status`                                 | no       | `success → SUCCESS`, etc.; unmapped ⇒ `UNKNOWN`.                                                             |
| `data.id`                                     | no       | Becomes provider record id (`provider_id`).                                                                  |
| `created_at` / `paid_at` / `transaction_date` | no       | The field named by `--timestamp-field` is the comparison timestamp; ISO-8601 with explicit tz (Z or ±HH:MM). |
| top-level `status` / `message`                | no       | Envelope metadata; not used for reconciliation.                                                              |

### Live mode (`--live-paystack`)

- Explicit opt-in; mutually exclusive with `--provider`.
- Reads `RECONCILEKIT_PAYSTACK_SECRET_KEY` env var (never CLI arg / CSV / logs / commits).
- Same `data` shape per transaction.
- A failed fetch is a provider-access error (exit 1), **not** a reconciliation finding.

---

## 5. Join Semantics (the only anchor)

- Engine join: `normalizeReference(merchant_reference) === normalizeReference(ProviderPayment.reference)`
  (trim; exact string equality — see `src/domain/reference.ts`). No fuzz, no fallback.
- In model B, `ProviderPayment.reference = Paystack data.reference`, so a row matches only when the
  operator's `merchant_reference` is byte-equivalent to the Paystack transaction reference.
- Outcomes that follow deterministically (no new codes; all pre-existing):
  - Merchant row with no matching provider row ⇒ `MISSING_PROVIDER_RECORD`.
  - Provider row with no matching merchant row ⇒ `UNMATCHED_PROVIDER_RECORD`.
  - Match but differing amount/currency/status/timestamp ⇒ `DISCREPANCY` with
    `AMOUNT_MISMATCH` / `CURRENCY_MISMATCH` / `STATUS_MISMATCH` / `TEMPORAL_ANOMALY`.
  - Missing merchant reference ⇒ `MISSING_REFERENCE` report data (still exit 0).

---

## 6. Identifier Mapping (frozen §5, exactly as implemented)

| Concept                            | CSV/Vendor value                        | End representation                                                                       |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Merchant matching key              | `Reference` column (`T545417640929891`) | `MerchantPayment.merchant_reference`                                                     |
| Merchant record id                 | `Transaction ID` (`6468155450`)         | `MerchantPayment.merchant_record_id`                                                     |
| Provider join reference            | Paystack `data.reference`               | `ProviderPayment.reference`                                                              |
| Provider id                        | Paystack `data.id`                      | `ProviderPayment.provider_id`                                                            |
| Source evidence (intake path only) | `source_reference`/`source_identifier`  | `payment_source_reference` + `source_attributes` — **evidence only, never a join key**   |
| Marketplace anchor                 | —                                       | `transaction_id` (`mk_txn_…` **only**); raw CSV intake keeps it `null`, never fabricated |

**Hard rule (unchanged):** CSV columns and `wld_…`/`ps_…`/provider refs are evidence. Nothing is
fabricated when absent; no external reference ever becomes a join key.

---

## 7. Amount, Status, Timestamp Normalization (intake path — the conversion tool)

### Amount (freeze: integer minor units, explicit currency, no floats)

- `parseAmountMinor(value, unit, scale=2)`:
  - `unit:"minor"` (default) — value used verbatim: `"100000" → 100000`.
  - `unit:"decimal"` — decimal major → minor: `"1000" → 100000`, `"9750.00" → 975000`,
    `"250.5" → 25050`.
  - Unit mismatch is **rejected** (`"9750.00"` in `minor` mode ⇒ `null`), never reinterpreted.
  - The conversion preview is the operator's confirmation gate (3B promise, Blocker §8.3).

### Status

`success/approved→SUCCESS`, `failed→FAILED`, `cancelled/canceled→CANCELLED`, `pending→PENDING`,
`unknown→UNKNOWN`. Unrecognized ⇒ `INVALID_STATUS` (rejected, never coerced to SUCCESS/FAILED).
Missing status is allowed (`null`).

### Timestamp

ISO instants (Paystack) and bare epoch-ms strings (fixtures) both accepted deterministically;
ambiguous values rejected.

### Idempotency (intake path)

`source_event_id = ${importId}_${rowIndex}` (deterministic FNV-style hash of CSV text); replay of
the same file records 0 / replays N with identical `event_id`/`idempotency_key` — exactly-once
`pevt_…` mechanism, no random UUIDs. Rows rejected at parse time are never persisted.

---

## 8. Operator Runbook (3A wave 1, model B)

1. **Collect** the operator's real Paystack dashboard export (one row per payment).
2. **Convert** it to the SDK merchant CSV contract (§3) — via the conversion tool whenwired
   (Blocker §8.1) or the shipped guide (§8.3); verify the minor-unit preview on every amount.
3. **Verify references** — the CSV `merchant_reference` values must equal the Paystack
   transaction references the account will return; any mismatch is a real `MISSING_PROVIDER_RECORD`
   finding, not a bug.
4. **File mode first:**
   ```
   node src/cli/index.ts --merchant merchant-reconcilekit.csv --provider provider-T545417640929891.json --timestamp-field paid_at --currencies NGN
   ```
5. **Then live test mode** (explicit network opt-in):
   ```
   $env:RECONCILEKIT_PAYSTACK_SECRET_KEY = "<sk_test_...>"
   node src/cli/index.ts --merchant merchant-reconcilekit.csv --live-paystack --timestamp-field paid_at --currencies NGN
   ```
6. **Record** every discrepancy with its masked evidence pack (existing storefront masking; no
   new truth machinery), file the findings log + decision record (3A gate), and never claim a
   provider-access failure as a reconciliation finding.

---

## 9. Validation Outcomes (exit semantics)

| Case                                                                | Exit | Classification                        |
| ------------------------------------------------------------------- | ---- | ------------------------------------- |
| Merchant CSV missing required column `amount`/`currency`            | 1    | input failure (operator must fix CSV) |
| Provider file not valid JSON / wrong shape                          | 1    | input failure                         |
| Successfully computed report (incl. discrepancies, MISSING_* refs)  | 0    | **report data, not an error**         |
| `--provider` and `--live-paystack` both supplied / neither supplied | 2    | usage error                           |
| Unexpected internal failure                                         | 3    | bug (report, do not mask)             |

---

## 10. Evidence Pack Availability

For every `DISCREPANCY`/`UNRESOLVED`/`MISSING_*` result, the storefront masking machinery
(`marketplace/truth.ts`, `marketplace/payment-sources/evidence.ts`) provides a masked evidence pack
(no full gift-card/ticket secrets). This satisfies plan §11 "Evidence pack availability for every
mismatch" with no new truth machinery. In CLI-only pilot mode, the report plus the operator's
source CSV/Verify JSON is the evidence set.

---

## 11. Acceptance Gate (3A) — restated

Per plan §10: ≥2 operators each complete ≥1 full e2e reconcile (file mode then live Paystack
test mode); ≥1 real discrepancy surfaced & understood; findings log + decision record delivered;
baseline suites remain green (Root 618/618, Storefront 405/405, typechecks, lint, format);
engine untouched.

**This contract unblocks that gate once the operator conversion/run path and guide are shipped
(Blocker Analysis §8).**
