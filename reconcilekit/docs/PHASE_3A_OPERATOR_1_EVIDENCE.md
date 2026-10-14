# Phase 3A Operator 1 — Reconciliation Pilot Evidence

**Status:** Operator 1 COMPLETE — evidence recorded. Phase 3A decision NOT taken (Operator 2 pending).
**Operator:** Session operator (human-supervised AI-assisted), acting as Operator 1.
**Date:** 2026-09-11
**Companion document:** `PHASE_3A_PILOT_EXECUTION_WORKSHEET.md` (Sections 7–11 applied here).

---

## 1. Scope and Safety Confirmed

- [x] Paystack **test-mode** account used (`sk_test_...` secret; prefix confirmed, value never printed, never written to any file).
- [x] No production Paystack secret used.
- [x] Merchant CSV contains no customer PII (test email `pilot@example.com` only).
- [x] Pilot data confined to `%TEMP%\opencode\` (outside the repository); only this evidence summary is committed.
- [x] No ReconcileKit source, test, schema, fixture, CLI, or engine exports changed in this execution.

---

## 2. Operator 1 — Preflight Record

- Tool: `reconcilekit/storefront/src/cli/pilot-run.ts` (local operator CLI, unchanged).
- Merchant input: real Paystack **test-mode** transactions created for the pilot (see §3).
- Provider evidence: two approved forms exercised — **live test-mode Paystack fetch** and a **Paystack Verify JSON file** (the two must agree).
- Secrets: `STOREFRONT_PAYSTACK_SECRET_KEY` loaded from `storefront/.env` into the process environment for CLI invocations; never echoed.

### Real transaction creation (test mode)

Hosted-checkout card completion was blocked by Cloudflare Turnstile in the automation environment, so the operator completed payments through the **approved Paystack `POST /charge` inline-card path** (test card `4084 0840 8408 4081`, CVV `408`, PIN `408408`, OTP `123456`), the same integration family already exercised in `PILOT-READINESS-REPORT.md` (Slice 3). This produced **genuine, real test-mode transactions** on the account:

| Ref          | Amount (kobo) | Currency | Amount (NGN) | Paystack status | Created (UTC)        |
| ------------ | ------------- | -------- | ------------ | --------------- | -------------------- |
| RK-PILOT-006 | 125000        | NGN      | 1,250.00     | success         | 2026-09-11T08:01:37Z |
| RK-PILOT-007 | 250000        | NGN      | 2,500.00     | success         | 2026-09-11T08:01:41Z |
| RK-PILOT-008 | 375000        | NGN      | 3,750.00     | success         | 2026-09-11T08:01:44Z |
| RK-PILOT-009 | 150000        | NGN      | 1,500.00     | abandoned       | 2026-09-11T08:01:47Z |
| RK-PILOT-010 | 450000        | NGN      | 4,500.00     | abandoned       | 2026-09-11T08:01:49Z |

`RK-PILOT-009/010` were initialized but **never completed** (simulated customer start-and-abandon), which is exactly the real-life condition that produces a merchant/provider status disagreement.

---

## 3. Step 1 — Merchant CSV Inspection

Operator export derived from the real account state at the time of the run and stored outside the repo at `%TEMP%\opencode\merchant-pilot.csv`:

```text
reference,amount,currency,status,occurred_at,source_reference
RK-PILOT-006,125000,NGN,SUCCESS,1789113697000,
RK-PILOT-007,250000,NGN,SUCCESS,1789113701000,
RK-PILOT-008,375000,NGN,SUCCESS,1789113704000,
RK-PILOT-009,150000,NGN,PENDING,1789113707000,
RK-PILOT-010,450000,NGN,PENDING,1789113709000,
```

- Columns match the contract exactly: `reference,amount,currency,status,occurred_at,source_reference`.
- Amount unit: **minor** (kobo), `--amount-unit minor` (default).
- Currency: NGN on every row.
- Timestamp field: `created_at` (epoch-ms of the Paystack creation timestamp) → `--timestamp-field created_at`.
- Reference quality: present, unique, consistent, deterministic (join anchor).
- Status values: `SUCCESS` ×3, `PENDING` ×2 — all canonical, accepted by intake.
- Missing fields: `source_reference` intentionally blank (not required; `merchant_reference` is the join key).

---

## 4. Step 2 — Preview Run

Two variants, both preview only:

1. **Live Paystack (test mode), full account fetch:**
   ```
   node src/cli/pilot-run.ts --merchant <csv> --live-paystack \
     --timestamp-field created_at --currencies NGN \
     --data-dir <temp pilot-data> --output json
   ```
2. **Provider Verify JSON file** (the 5 pilot refs, exported to `%TEMP%\opencode\provider-verify-evidence.json`) with the same merchant CSV.

Observations (identical reconciliation outcome in both modes):

- Import: 6 raw rows (1 header), **5 data rows, 5 accepted, 0 rejected**, minor unit, currency set `{NGN}`.
- Provider records: **18 (live, whole account)** / **5 (file, scoped)**.
- Reconciliation summary: **matched 3, unresolved 2, heldAmbiguous 0, inputErrors 0, missingProviderRecords 0, CLASSIFIED_DISCREPANCY 0**.
- Findings noted: `STATUS_UNRESOLVED` ×2 for the abandoned refs; `UNMATCHED_PROVIDER_RECORD` ×13 in live mode only (older account history — Slice 3 refs `stf_*`, `T545*` and earlier pilot attempts `RK-PILOT-001..005`, `RK-PILOT-A01..A05`; not defects, see §8).

---

## 5. Step 3 — Review Before Writing

- Interpretation correct: amounts in kobo, NGN everywhere, statuses normalized, references unique/usable.
- The surprise was isolated to the two `PENDING` merchant rows: the expected provider status for a started-but-unfinished payment needed explanation (frozen adapter: `abandoned` → `UNKNOWN`, deliberately never `CANCELLED`). See §8.
- No finding was surprising enough to abort; the discrepancy is the point of the pilot.
- Preview wrote nothing (phase `preview`, `recorded: null`).

---

## 6. Step 4 — Persisted Run (`--run`)

Same commands re-run with `--run` against `--data-dir %TEMP%\opencode\pilot-data`.

- Recorded: **5** events, replayed: **0** (first record).
- Store: `payment-events.jsonl` grew to exactly **5 lines** (verified; no duplicates, `MANUAL_CSV` source, `transaction_id: null`, `merchant_reference` populated).
- Reconciliation of the **recorded events** reproduced the same summary: matched 3, unresolved 2.

---

## 7. Step 5 — Replay (idempotency)

Same `--run` command executed again (both live and file provider modes): **recorded 0, replayed 5**, store file unchanged (still 5 lines). Exactly-once import confirmed.

> Replay proves import idempotency only — business reconciliation correctness is a separate claim, per the worksheet.

Cross-validation: the live-fetch run and the Verify-file run produced the **same** reconciliation result for the 5 pilot refs (matched 3 / unresolved 2), differing only in the expected account-history overlap surfacing as provider-only records.

---

## 8. Operator 1 — Results

| Metric                      | Result (file mode) | Result (live mode) | Notes                                                            |
| --------------------------- | -----------------: | -----------------: | ---------------------------------------------------------------- |
| Merchant rows               |                  5 |                  5 |                                                                  |
| Accepted                    |                  5 |                  5 |                                                                  |
| Rejected                    |                  0 |                  0 |                                                                  |
| Provider records            |                  5 |                 18 | live = whole account                                             |
| Matched                     |                  3 |                  3 | RK-PILOT-006/007/008                                             |
| Classified discrepancies    |                  0 |                  0 | none of codes AMOUNT/CURRENCY/STATUS/TEMPORAL/DUPLICATE/CONFLICT |
| Unresolved                  |                  2 |                  2 | STATUS_UNRESOLVED                                                |
| Missing provider records    |                  0 |                  0 |                                                                  |
| Provider-only records       |                  0 |                 13 | older account history                                            |
| Missing/unusable references |                  0 |                  0 |                                                                  |
| Input errors                |                  0 |                  0 |                                                                  |
| Held for review             |                  0 |                  0 |                                                                  |

### Findings observed

| Finding                  | Merchant ref | Provider ref                                                               | Code(s)           | Operator interpretation                                                          | Evidence sufficient? |
| ------------------------ | ------------ | -------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------- | -------------------- |
| MATCH                    | RK-PILOT-006 | RK-PILOT-006                                                               | —                 | Paid in full; $1,250.00 in kobo 125000, SUCCESS both sides, created == paid      | Yes                  |
| MATCH                    | RK-PILOT-007 | RK-PILOT-007                                                               | —                 | Paid in full; 250000, SUCCESS both sides                                         | Yes                  |
| MATCH                    | RK-PILOT-008 | RK-PILOT-008                                                               | —                 | Paid in full; 375000, SUCCESS both sides                                         | Yes                  |
| UNRESOLVED               | RK-PILOT-009 | RK-PILOT-009                                                               | STATUS_UNRESOLVED | Merchant says PENDING; provider says abandoned→UNKNOWN; no auth captured         | Yes                  |
| UNRESOLVED               | RK-PILOT-010 | RK-PILOT-010                                                               | STATUS_UNRESOLVED | Merchant says PENDING; provider says abandoned→UNKNOWN; no auth captured         | Yes                  |
| Provider-only ×13 (live) | —            | stf_dd058.../stf_probe.../T54541763.../RK-PILOT-001..005/RK-PILOT-A01..A05 | —                 | Pre-existing/non-pilot account history; not part of the exported merchant window | Yes                  |

---

## 9. Real Discrepancy Investigation (mandatory)

### Discrepancy

- Finding type: **status unresolved** (payment not completed on provider side while merchant ledger still shows pending).
- Reference: **RK-PILOT-009** and **RK-PILOT-010** (identical nature; investigated together).
- Amount/currency: 150000 kobo (₦1,500.00) and 450000 kobo (₦4,500.00), NGN.
- Merchant-side state: `PENDING` (exported status) — operator-ledger view: payment expected/possible.
- Provider-side state: `abandoned` (Paystack `original_status`), mapped by the frozen adapter to **`UNKNOWN`**.
- Reconciliation code(s): `STATUS_UNRESOLVED` — "status unresolved: merchant PENDING vs provider UNKNOWN".

### Operator interpretation

> What do you believe actually happened?

> The two orders were started but never paid. A checkout/charge was initialized
> (an authorization URL existed and the charge was initiated), but the customer
> session ended before any card authorization was captured. Paystack records
> this as `abandoned` — explicitly **not** `success`, `failed`, or a reversal.
> The merchant ledger kept them as `PENDING` because from the sales side nothing
> said the payment failed; in reality no money was collected and no
> authorization exists. The engine refuses to guess (abandoned never maps to
> CANCELLED), therefore STATUS_UNRESOLVED is the honest, correct output. These
> are the two rows the operator must not treat as settled.

### Evidence used

- Paystack `GET /transaction/verify/{ref}` responses for all 5 pilot refs (success ×3, abandoned ×2) — captured to `%TEMP%\opencode\provider-verify-evidence.json`.
- Live transaction list fetch (18 records incl. the 5 pilot refs).
- Merchant CSV snapshot and the CLI preview/recorded/replay JSON output (import interpretation, master table, ledger-consistent).
- Frozen adapter mapping table: `success→SUCCESS, failed→FAILED, pending/processing/ongoing/queued→PENDING, abandoned→UNKNOWN` (never CANCELLED).

### Evidence sufficiency

- [x] Sufficient to understand what happened
- [ ] Partially sufficient
- [ ] Insufficient

### Missing evidence

None for this finding. Raw merchant/provider files kept outside the repo per §17 evidence rules; the summarized values above are the necessary support.

### Operational consequence

- [x] No money was captured for RK-PILOT-009/010 → do **not** fulfill.
- Follow up with the customer on the two unpaid/abandoned orders or cancel them in the merchant ledger (the ledger's `PENDING` is the merchant-side judgment; the provider-side truth is `UNKNOWN`/no-auth).
- The three matched payments proceed to fulfillment using the provider `paid_at` timestamps.

No resolution is invented here to "close" the finding; the operator action is exactly the two bullet points above.

---

## 10. Operator 1 — Usability / Workflow Findings

### What was clear?

- CSV intake mapped exactly to the contract; amount-unit interpretation (kobo) shown up front.
- Deterministic reference join; replay was idempotent (recorded 0 / replayed 5) with the store not growing.
- Both provider modes (live fetch and Verify file) agreed; file mode cleanly scopes to the export window.

### What was confusing?

- None inside the CLI once the frozen `abandoned→UNKNOWN` mapping was cited. Initial expectation was that `abandoned` might map to CANCELLED; it deliberately does not.

### What required explanation?

- The STATUS_UNRESOLVED rows themselves (why "UNSUCCESS" isn't called DISCREPANCY — it is an unresolved status pair, not a confirmed mismatch).
- Why live mode surfaces 13 provider-only records (whole-account history), all explainable, not a defect.

### What did the operator expect that the tool did not provide?

- A reference/date **scoped** live fetch (avoid pulling the entire account). Mitigated by using the Verify-file mode, which is naturally scoped.

### Where did the operator hesitate?

- At Step 2, on choosing between live and file provider mode. Resolved by running both and confirming agreement.

### Did the terminology make sense?

- Yes, after the mapping table. `STATUS_UNRESOLVED` accurately distinguishes from a confirmed mismatch.

### Could the operator independently interpret the reconciliation result?

- [x] Yes
- [ ] Partially
- [ ] No

### What should change before a real merchant-facing pilot?

- Operator-facing note that `abandoned → UNKNOWN` (and why it never becomes CANCELLED);
- optional scoping (refs or date range) for live mode;
- document that hosted-checkout completion is a manual/browser step (Turnstile) or use of a direct-charge path.

> These are pilot findings, not approved implementation requirements (worksheet §11).

---

## 11. Operator 1 — Conformance & Status

- [x] Preview completed before recording.
- [x] Persisted run completed (recorded exactly once).
- [x] Replay/idempotency verified (recorded 0, replayed 5).
- [x] Real (test-mode) merchant data used.
- [x] Paystack test-mode provider evidence used (live + Verify file, agree).
- [x] At least one real discrepancy surfaced and **understood** (RK-PILOT-009/010).
- [x] Evidence sufficient to explain the result.
- [x] Findings captured (this document).
- [ ] Pilot decision recorded — deferred until Operator 2 completes and Section 13 (cross-operator) is filled.

**Phase 3A status stays PENDING EXECUTION until Operator 2 runs the same procedure independently** and the decision record is prepared.
