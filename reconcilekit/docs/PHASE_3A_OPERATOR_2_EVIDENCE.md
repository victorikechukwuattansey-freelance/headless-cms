# Phase 3A Operator 2 Evidence

## 1. Execution metadata

- **Operator:** Operator 2 (human operator; mechanical execution performed by OpenCode session on the operator's behalf).
- **Observer:** OpenCode session (record-keeping only; interpretation captured from the human operator in Section 10).
- **Date/time:** 2026-09-11 (transactions created ~08:38 UTC; reconciliation runs ~08:42 UTC).
- **Environment:** Paystack **Test Mode** (`sk_test_...`; prefix confirmed, value never printed or written).
- **Merchant dataset:** fresh 5-row CSV snapshot of the Operator 2 test transactions (`%TEMP%\opencode\merchant-pilot-operator2.csv`; raw file kept outside the repository, unchanged).
- **Timestamp field:** `created_at` (Paystack creation timestamp, epoch-ms).
- **Currency:** NGN.
- **Provider evidence mode:** `--live-paystack` (primary); cross-validated with a Paystack Verify JSON file (`--provider`, 5 envelopes) derived from real `GET /transaction/verify/<ref>` calls.

## 2. Test transactions

Fresh, independently generated Paystack Test Mode transactions (exact references accepted by Paystack). Safe metadata only.

| Reference    | Paystack transaction ID | Amount (kobo) | Currency | Resulting status |
| ------------ | ----------------------: | ------------: | -------- | ---------------- |
| RK-PILOT-011 |              6546991060 |        110000 | NGN      | success          |
| RK-PILOT-012 |              6546991211 |        220000 | NGN      | success          |
| RK-PILOT-013 |              6546991389 |        330000 | NGN      | success          |
| RK-PILOT-014 |              6546991043 |        160000 | NGN      | abandoned        |
| RK-PILOT-015 |              6546991558 |        460000 | NGN      | abandoned        |

RK-PILOT-011/012/013 were completed through the approved Test Mode `POST /charge` inline-card path (same route Operator 1 used). RK-PILOT-014/015 were initialized but intentionally never completed, producing the real-life "started but not paid" condition. No production credentials used.

## 3. Merchant input observations

- **Actual columns (contract order):** `reference,amount,currency,status,occurred_at,source_reference`.
- **Row count:** 6 raw (1 header) → 5 data rows.
- **Amount-unit interpretation:** `minor` (integer kobo). Values: 110000, 220000, 330000, 160000, 460000.
- **Status vocabulary:** `SUCCESS` (×3), `PENDING` (×2) — all canonical, accepted by intake.
- **Reference quality:** present, unique, consistent, deterministic (join anchor).
- **Timestamp observations:** `occurred_at` = Paystack `created_at` epoch-ms; a single canonical timestamp field applies to all rows.

## 4. Preview results

Run before any recording, in both approved provider modes.

**Live Paystack (`--live-paystack`, whole-account fetch):**

- import ID: `csv_4849fa0c`; source `MANUAL_CSV`; total rows 6; data rows 5; **accepted 5; rejected 0**.
- amount unit `minor`; currencies `{NGN}`.
- provider record count: **23** (entire test account including older history).
- matched **3**; discrepancies **0**; unresolved **2**; missing provider records **0**; provider-only records **18**; missing/unusable references **0**; held for review **0**; input errors **0**.
- discrepancy codes observed: `STATUS_UNRESOLVED` ×2.
- Nothing written (phase `preview`).

**Verify-file (`--provider`, 5 envelopes, same merchant CSV):**

- provider record count **5**; provider-only **0**; matched 3; unresolved 2 (`STATUS_UNRESOLVED` ×2) — **identical reconciliation result** for the five pilot references.

## 5. Persisted run

Same command as preview with `--run` (live mode), data-dir `%TEMP%\opencode\pilot-data-operator2`.

- **Recorded: 5**, **replayed: 0**.
- Store: `payment-events.jsonl` = exactly **5 lines** (verified; `MANUAL_CSV`, `transaction_id: null`, `merchant_reference` populated; idempotency keys `MANUAL_CSV||PAYMENT|csv_4849fa0c_1..5`).
- Reconciliation of recorded events reproduces the same summary: matched 3, unresolved 2 (`STATUS_UNRESOLVED` ×2).

## 6. Replay

Exact same `--run` command executed once more.

- **Recorded: 0**, **replayed: 5** (exactly-once, verified, not assumed).
- Store file unchanged (still 5 lines).
- Reconciliation result identical (matched 3, unresolved 2).

> Replay proves ingestion idempotency only; it does not prove business correctness.

## 7. Reconciliation findings

| Finding    | Merchant reference | Provider reference | Code(s)             | Validation notes                                                  |
| ---------- | ------------------ | ------------------ | ------------------- | ----------------------------------------------------------------- |
| MATCH      | RK-PILOT-011       | RK-PILOT-011       | —                   | amounts/status/timestamp aligned (SUCCESS both sides, 110000 NGN) |
| MATCH      | RK-PILOT-012       | RK-PILOT-012       | —                   | amounts/status/timestamp aligned (SUCCESS, 220000 NGN)            |
| MATCH      | RK-PILOT-013       | RK-PILOT-013       | —                   | amounts/status/timestamp aligned (SUCCESS, 330000 NGN)            |
| UNRESOLVED | RK-PILOT-014       | RK-PILOT-014       | `STATUS_UNRESOLVED` | "status unresolved: merchant PENDING vs provider UNKNOWN"         |
| UNRESOLVED | RK-PILOT-015       | RK-PILOT-015       | `STATUS_UNRESOLVED` | "status unresolved: merchant PENDING vs provider UNKNOWN"         |

## 8. Real discrepancy investigation

**Discrepancy present.** Two findings (RK-PILOT-014, RK-PILOT-015), identical nature.

- Finding type: **status unresolved** — merchant-side ledger says `PENDING`; provider-side original status is `abandoned`, preserved by the frozen adapter mapping to **`UNKNOWN`** (not `CANCELLED`).
- Merchant ref / provider ref: RK-PILOT-014, RK-PILOT-015.
- Merchant amount: 160000 / 460000 kobo; provider amount: identical (160000 / 460000). Currency NGN.
- Merchant status: PENDING. Provider status: UNKNOWN (source `abandoned`).
- Reconciliation code(s): `STATUS_UNRESOLVED`.
- Evidence used: merchant CSV; Paystack Verify JSON + live fetch showing `success` ×3 and `abandoned` ×2; CLI preview/recorded/replay output; frozen adapter status map.
- Operator interpretation: see Section 10.
- Evidence sufficiency: Sufficient (Section 11).
- Operational next action: see Section 10 — do not fulfill; follow up with the customer; do not treat as paid.

## 9. Provider-only observations

Live mode returned **18 provider-only records** (older account history: Operator 1 pilot refs, earlier pilot-attempt refs, and pre-pilot Slice-3 refs). These are outside the 5-row merchant snapshot.

- Account-history scope: the operator found this **noisy/confusing** (see Section 10, Q5) — the whole-account live fetch pulls records outside the exported merchant window.
- Not classified as a product defect: this is the expected scope difference between a full-account live fetch and a windowed merchant export; the Verify-file mode (providerOnly 0) demonstrates the identical reconciliation with a scoped evidence set.

## 10. Human operator interpretation

Captured verbatim/faithfully from the Operator 2 human operator (not an AI interpretation).

1. **What do you believe happened?** "Started but never paid." The two orders had payment initialized but no card authorization was captured; Paystack records this as abandoned, so no money was collected.
2. **What evidence supports that conclusion?** Operator selected **Sufficient** evidence; their next-action answer explicitly cites the provider reports (`abandoned`/UNKNOWN) and the absence of any successful authorization or capture together with the merchant CSV and reconciliation output.
3. **Is the evidence sufficient?** **Sufficient.**
4. **What would you normally do next?** "Do not fulfill the transaction. Follow up with the customer to confirm whether they attempted payment, and verify the payment status/evidence before taking any further action. Since the provider reports abandoned/UNKNOWN and there is no evidence of successful authorization or capture, I would leave the transactions unresolved rather than treat them as paid."
5. **Could you understand the reconciliation result without assistance?** **No** — the `STATUS_UNRESOLVED` / provider `UNKNOWN` status required the abandoned→UNKNOWN mapping explanation.
6. **What was confusing?** The provider-only records in live mode ("Provider-only noise") — the older-account records outside the merchant snapshot.
7. **What information was missing?** Nothing else identified beyond the above; the two investigated findings were fully explained once the frozen status mapping was cited.

## 11. Evidence sufficiency

For the investigated findings (RK-PILOT-014/015):

- ✅ **Sufficient** — explanation that the two transactions were started but never paid is fully supported by merchant CSV + Paystack Verify/live statuses + CLI output. No additional evidence was required to explain the result.
- (Partial / Insufficient: not selected.)

## 12. Usability observations

### What was clear?

- CSV intake matched the contract exactly; amount-unit interpretation (kobo) shown up front; deterministic reference join; idempotent replay (recorded 0 / replayed 5); live and file provider modes agree.

### What was confusing?

- The `STATUS_UNRESOLVED` outcome for abandoned payments (why the provider shows `UNKNOWN` and not something else) — needed the frozen mapping explained.

### What required assistance?

- Understanding why abandoned payments surface as `UNKNOWN` rather than a finished state.

### What did the operator expect but not find?

- A scoped (date/reference-windowed) live evidence fetch; the whole-account fetch produced provider-only noise (18 records).

### Could the operator determine what happened?

- **NO** (independently — required the status-mapping explanation).

### Could the operator determine what to do next?

- **YES** once the result was explained (clear operational decision: do not fulfill, follow up, leave unresolved).

### What should change before a broader pilot?

- Operator-facing note explaining the `abandoned → UNKNOWN` mapping and why it is never `CANCELLED`; optional scoping (refs/date range) for live mode; document that hosted-checkout completion is a manual/browser step or requires a direct-charge path.

(These remain pilot observations, not approved implementation tasks.)

## 13. Environmental limitations

- **Hosted checkout blocked by Cloudflare Turnstile** — the automation environment cannot pass the Turnstile challenge on the Paystack hosted checkout page (Cloudflare challenge frame observed again this session, including the RK-PILOT-014 checkout URL). The operator reused the **previously approved** Test Mode `POST /charge` inline-card route, which remains available and worked. This is an automation-environment limitation, **not** a ReconcileKit defect.
- **Whole-account live fetch** returns account history outside the merchant export window (scope limitation of `--live-paystack`; mitigate with Verify-file mode).
- No test-mode API credit/limit blockers encountered; all 5 transactions reflected exactly as created/charged.

## 14. Operator 2 status

PHASE 3A OPERATOR 2 COMPLETE — CROSS-OPERATOR ANALYSIS REMAINS PENDING
