# Operator Status-Semantics Reference

**Project:** ReconcileKit (Core + Storefront)
**Type:** Operator-facing reference (documentation only — no implementation, no source/test/config change)
**Date:** 2026-10-13
**Status:** Published — non-blocking follow-up to Phase 3A Condition 1
**Applies to:** `reconcilekit-storefront` `pilot-run` operator CLI, and any operator reading a ReconcileKit reconciliation report.
**Basis:** `PHASE_3A_CONDITION_DISPOSITION_AND_PHASE_4_ENTRY_GATE.md` Part 2, Part 5, Part 10; `PHASE_3A_PILOT_DECISION.md` §4 Condition 1; frozen adapter mapping (Phase 2 freeze; `src/adapters/providers/paystack/`).

---

## 1. Why this document exists

Phase 3A surfaced the same status pair in both operator runs: merchant said `PENDING`, provider said `abandoned`, and the engine reported `STATUS_UNRESOLVED`. Both operators reached the correct operational conclusion, but at least one could not interpret the result independently without the frozen `abandoned → UNKNOWN` mapping being explained.

This reference is the operator-facing explanation of that mapping and of `STATUS_UNRESOLVED`. It does not change the mapping, the matcher, or the engine. It documents what the engine already does.

---

## 2. Frozen provider status mapping

The engine maps the provider's raw status to the canonical ReconcileKit vocabulary as follows. This mapping is frozen; it is not configurable and is not changed by this document.

| Provider raw status (Paystack)               | ReconcileKit status | Notes                                                                   |
| -------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `success`                                    | `SUCCESS`           | Payment captured.                                                       |
| `failed`                                     | `FAILED`            | Payment attempted and declined.                                         |
| `pending`, `processing`, `ongoing`, `queued` | `PENDING`           | Payment in flight.                                                      |
| `abandoned`                                  | `UNKNOWN`           | **Started, never authorized, no capture.** Never mapped to `CANCELLED`. |
| (any unrecognized value)                     | `UNKNOWN`           | Conservative fallback; never guessed.                                   |

**The single most important line:** `abandoned → UNKNOWN`, **never** `CANCELLED`.

Why: `CANCELLED` would assert a definitive negative (the customer or the merchant cancelled). `abandoned` does not assert that — it means the transaction was initiated but no card authorization was captured. The engine refuses to upgrade "no authorization captured" into "cancelled". `UNKNOWN` is the honest label.

---

## 3. Reconciliation outcome codes (operator-facing meaning)

These are the outcome codes the report can show for each merchant record. They are pre-existing vocabulary; this section only explains what each one means operationally.

| Outcome                        | Meaning                                                                                                     | Typical operator action                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `MATCH`                        | Merchant and provider agree on reference, amount, currency, and status (within tolerance).                  | Proceed.                                                     |
| `DISCREPANCY`                  | Matched on reference, but amount / currency / status / timestamp / duplicate differs. `codes:` lists which. | Investigate using the listed codes.                          |
| `MISSING_PROVIDER_RECORD`      | Merchant record has no provider candidate.                                                                  | Follow up with the provider; do not fabricate.               |
| `UNMATCHED_PROVIDER_RECORD`    | Provider evidence exists with no merchant record.                                                           | Reconcile against the merchant ledger; not silently dropped. |
| `MISSING_REFERENCE`            | Merchant record has no usable reference.                                                                    | Fix the input; report data, not a failure.                   |
| `STATUS_UNRESOLVED`            | Merchant and provider statuses disagree in a way the engine will not resolve.                               | See §4 below.                                                |
| `HELD_FOR_REVIEW` / unresolved | Requires manual review.                                                                                     | Manual review.                                               |

`DISCREPANCY` and `STATUS_UNRESOLVED` are **report data, not CLI failures**. The exit code stays `0`. The engine never fabricates a match.

---

## 4. What `STATUS_UNRESOLVED` means (and what it does not)

`STATUS_UNRESOLVED` is emitted when the merchant-side status and the provider-side status **cannot be reconciled by the engine**, and the engine refuses to guess.

In the Phase 3A case, the pair was:

- Merchant side: `PENDING`
- Provider side: `UNKNOWN` (raw `abandoned`)
- Reconciliation code: `STATUS_UNRESOLVED`

### What it means

- A payment was **started** (a checkout/charge was initiated; an authorization URL may exist).
- **No authorization was captured.** No money was collected.
- The merchant ledger still shows `PENDING` because from the sales side nothing indicated failure.
- The provider records this as `abandoned`, mapped to `UNKNOWN`.
- The two sides disagree, and the engine reports that disagreement instead of resolving it.

### What it does NOT mean

- **Not** a successful payment. Do not treat as paid.
- **Not** a failed payment. Do not treat as definitively declined.
- **Not** a cancellation. `abandoned` is never `CANCELLED`.
- **Not** a confirmed `DISCREPANCY` in the amount/currency/timestamp sense. It is a status-only unresolved pair.

### Operator action (uniform, per Phase 3A decision §5)

1. **Do not fulfill.**
2. **Follow up with the customer** to confirm whether they attempted payment.
3. **Leave unresolved** until payment evidence confirms capture (or the merchant ledger is intentionally closed).
4. Apply the same action to every `STATUS_UNRESOLVED` event, uniformly.

This is the same action both Phase 3A operators independently reached once the mapping was explained. It is now stated here so the next operator does not need the mapping cited in-session.

---

## 5. Live vs file provider evidence — quick reference

- `--provider <Paystack Verify JSON>`: **scoped to the file**. Recommended for windowed reconciliation.
- `--live-paystack`: fetches the **whole account history**. Produces provider-only records outside the merchant export window. Correct behavior; not a defect. See `PHASE_3A_LOCAL_OPERATOR_GUIDE.md` §"Live-mode evidence scope".

For a reconciliation window that matches the merchant export, prefer `--provider` (Verify-file mode). Use `--live-paystack` when you want the whole account.

---

## 6. What this document does not authorize

This document does not:

- change the frozen adapter mapping (`abandoned → UNKNOWN` stays; never `CANCELLED`);
- add discrepancy codes;
- add fuzzy, probabilistic, amount-only, or timestamp-only matching;
- change `STATUS_UNRESOLVED` semantics;
- change the merchant CSV contract or the identifier hierarchy;
- authorize any engine, adapter, matcher, or protected-core change.

Any change to the mapping or the outcome vocabulary requires the frozen architecture-change procedure (Phase 2 freeze §14) and explicit owner authorization.

---

## 7. Source of truth

- Frozen adapter mapping: `reconcilekit/src/adapters/providers/paystack/` (mapping module) — the normative implementation.
- Phase 2 freeze: `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` §4.4 (exact matching), §5 (identifier hierarchy).
- Phase 3A evidence: `docs/PHASE_3A_OPERATOR_1_EVIDENCE.md` §9; `docs/PHASE_3A_OPERATOR_2_EVIDENCE.md` §8; `docs/PHASE_3A_PILOT_FINDINGS.md` §6.
- Phase 3A disposition: `docs/PHASE_3A_CONDITION_DISPOSITION_AND_PHASE_4_ENTRY_GATE.md` Part 2, Part 5.

If this reference and the frozen implementation ever disagree, the implementation is authoritative — open an issue, do not edit this document to match a guess.
