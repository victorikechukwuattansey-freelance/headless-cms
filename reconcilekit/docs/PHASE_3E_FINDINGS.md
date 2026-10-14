# Phase 3E — Webhook Ingest Findings

**Project:** ReconcileKit (Core + Storefront)
**Type:** Evidence artifact (test-only harness; no production surface, no dependency)
**Date:** 2026-10-14
**Basis:** `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §10 (3E gate)
**Harness:** `storefront/test/marketplace/webhook-harness.test.ts`

---

## 1. What was tested

The existing payment-source ingest boundary (`ingestPaymentEvent` in
`storefront/src/marketplace/payment-sources/ingest.ts`) was exercised with
seven webhook-class delivery scenarios. The question: does the current design
lose, duplicate, or misroute events under realistic webhook delivery?

No `POST /webhooks/paystack` route was added. The harness calls the ingest
boundary in-process, exactly as a future webhook receiver would.

## 2. Results — 7/7 passed

| Test                               | Concern                      | Result                                                                       |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Same delivery retried              | Provider retry on non-2xx    | **PASS** — one stored record; `pevt_...` stable; second call replayed        |
| Different event id, same reference | Multiple events per payment  | **PASS** — two distinct events; not collapsed                                |
| Out-of-order delivery              | Network reordering           | **PASS** — both stored; no cross-contamination                               |
| Unknown reference                  | Race with our own verify     | **PASS** — accepted; `transaction_id: null` preserved; no anchor fabricated  |
| No source identity                 | Malformed payload            | **PASS** — rejected with `PAYMENT_EVENT_NO_SOURCE_IDENTITY`; nothing written |
| Interleaved references             | Concurrent unrelated traffic | **PASS** — per-reference counts correct; amounts not crossed                 |
| Same reference, different source   | Multi-PSP coexistence        | **PASS** — `payment_source` is part of the idempotency key; distinct events  |

## 3. Interpretation

The ingest boundary tolerates every realistic webhook-class delivery correctly.
Specifically:

- **Idempotency** (`pevt_...` keyed on `payment_source | payment_source_reference | event_type | source_event_id`) handles redelivery without collapse.
- **Out-of-order** arrival is accepted; ordering is preserved as ingest order; no event is lost.
- **Unknown references** are accepted as provider evidence with `transaction_id: null` — no fabricated anchor.
- **Malformed payloads** (missing source identity) are rejected; nothing is written.
- **Multi-source** coexistence works because `payment_source` is part of the key.

## 4. 3E gate disposition

**3E remains DEFERRED — not triggered by evidence.**

The 3A pilot produced no callback/verify event-gap. This harness confirms that
the ingest boundary itself already handles every webhook-class concern
correctly. A webhook path would improve **latency** — pushing state updates
the moment the provider confirms — but it would not close a correctness gap.

If 3E is opened later, it should be scoped as a latency/automation feature,
not a correctness fix, and requires explicit owner approval under the freeze's
§14 procedure.

## 5. Constraints preserved

- No production surface added (`POST /webhooks/*` does not exist).
- No new runtime dependency.
- `reconcilekit/src/**` untouched.
- No change to matcher, wallet, truth, or identifier hierarchy.
- No new discrepancy codes.
