# Reconcile Kit Integration Design (Phase 2F)

> **Status: DESIGN ONLY — no code written in this phase.**
> This document specifies the integration boundary between the marketplace
> transaction system (`storefront/src/marketplace/**`) and the frozen
> Reconcile Kit reconciliation engine (`src/**`). It is the authoritative
> pre-implementation review for Phase 2F.

---

## 0. Executive Summary

The marketplace can be mapped into the existing Reconcile Kit engine with
**zero changes to the root engine**. The engine's inputs (`MerchantPayment`,
`ProviderPayment`, `ReconciliationConfig`) are already provider-neutral, its
outcome vocabulary is already imported by marketplace types
(`MarketplaceTransaction.reconcileOutcome: Outcome | null` exists, currently
always `null`), and the marketplace's own failure flags
(`factFlags()` → `ReconciliationCode[]`) already reuse the engine's codes.

The integration is implemented **entirely through one adapter** in the
storefront (a pure bridge + a truth-derivation module), mirroring the proven
`PaymentRecord -> buildReconcileBridgeInput -> reconcileRecords() ->
buildReconcileView()` pattern that already exists for Paystack.

The highest-risk issue is **join-key semantics**: the engine matches the
merchant side to the provider side by _exact normalized reference equality_.
The provider's own reference (`air_…`, `res_…`, `iss_…`) is **not** the
marketplace transaction key. The adapter must put the marketplace transaction
reference (`txn_…`) on **both** sides and keep the provider reference as
supporting evidence only.

---

## 1. Existing Engine Architecture

Source of truth: `src/**` (the root package). Verified by reading
`src/domain/model.ts`, `src/domain/reconcile.ts`,
`src/domain/validation.ts`, `src/domain/reference.ts`,
`src/domain/duplicates.ts`, `src/application/reconcile-records.ts`, and the
Paystack adapter.

```
src/domain/model.ts           canonical vocabulary
  CanonicalPaymentStatus = "PENDING"|"SUCCESS"|"FAILED"|"CANCELLED"|"UNKNOWN"
  MerchantPayment / ProviderPayment / MatchResult / Outcome / ReconciliationCode
src/domain/reference.ts       index building on normalizeReference (trim)
src/domain/duplicates.ts      conflicting-attribute detection
src/domain/validation.ts      amount/currency/status/timestamp validators
src/domain/reconcile.ts       classify(candidate, validations) -> SOMETHING
src/application/reconcile-records.ts
                              public boundary: reconcileRecords(request)
src/adapters/providers/paystack/*  provider-side mapping (unchanged)
src/adapters/merchant/csv.ts       merchant CSV import (unchanged)
```

### Matching semantics (verified)

- Both sides are normalized by `normalizeReference` (trim; empty → `null`).
- Expected side keyed by `merchant_reference`, provider side keyed by
  `reference`; the engine **pairs candidates by exact string equality** of that
  reference (there is **no fuzzy/regex matching**).
- Matching runs only for records that pass `validatePaymentInput` (safe
  non-negative integer amount, supported currency, canonical-or-null status,
  integer-or-null timestamp). Invalid inputs produce `INPUT_ERROR`.
- Outcomes: `MATCH`, `DISCREPANCY`, `UNRESOLVED`, `HELD_AMBIGUOUS`,
  `INPUT_ERROR`, `MISSING_PROVIDER_RECORD`, `UNMATCHED_PROVIDER_RECORD`,
  `MISSING_REFERENCE`.
- Discrepancy codes: `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`,
  `STATUS_MISMATCH`, `TEMPORAL_ANOMALY`, `DUPLICATE_MERCHANT_RECORD`,
  `DUPLICATE_PROVIDER_RECORD`, `CONFLICTING_ATTRIBUTES`, `STATUS_UNRESOLVED`.
- `validateStatus`: `UNKNOWN` on either side → `STATUS_UNRESOLVED` (never a
  hard mismatch); one side `null` status → validation skipped.
- `validateTimestamp`: fires `TEMPORAL_ANOMALY` only when both `occurred_at`
  exist and differ beyond `toleranceMs`; otherwise not applicable.
- Duplicate detection: a reference resolving to >1 candidates on either side
  → `HELD_AMBIGUOUS` plus `DUPLICATE_*_RECORD`, plus `CONFLICTING_ATTRIBUTES`
  when amounts/currencies/statuses conflict.

## 2. Current Reconciliation Input / Output

### Public boundary

```ts
reconcileRecords({
  merchantPayments: readonly MerchantPayment[],   // expected side
  providerPayments: readonly ProviderPayment[],   // observed side
  config:           ReconciliationConfig,
  providerSourceAttributes?: readonly SourceAttributes[], // 1:1 with providerPayments
}): ReconciliationReport  // { summary, results: readonly MatchResult[] }
```

### Current storefront integration (Paystack, unchanged)

`storefront/src/server.ts`:
`PaymentRecord -> buildReconcileBridgeInput() -> reconcileRecords({...,
config: RECONCILE_CONFIG}) -> buildReconcileView()`.

- `buildReconcileBridgeInput` (storefront/src/reconcile/adapter.ts) maps each
  `PaymentRecord` to:
  - **Merchant side** (`paymentRecordToMerchantPayment`): `merchant_reference`
    = `paystackReference` (the join key), `amount` = `expectedAmount`
    (persisted product price — server-owned, never client-supplied), status =
    record status, `occurred_at` from paidAt/recordedAt.
  - **Provider side** (`paymentRecordToProviderPayment`): **only emitted when
    verified** (Paystack facts present in metadata). `reference` =
    `paystackReference`, amount/currency/status from `metadata.paystack_*`,
    `occurred_at` from `paystack_paid_at`. Unverified PENDING records produce
    **no provider row** → engine yields `MISSING_PROVIDER_RECORD`.
- `RECONCILE_CONFIG` (view.ts): timestamp tolerance 60s, currencies
  `["NGN", "USD"]`.
- This boundary is **provider-specific at the storefront layer only**: the
  `PaymentRecord` model is Paystack-centric (`paystackReference`), but the
  engine inputs (`MerchantPayment`/`ProviderPayment`) are neutral.

## 3. Marketplace → Reconcile Kit Boundary

Recommended boundary (answers Q9–Q12):

```
Marketplace records (persisted, append-only)
  marketplace_transactions          MarketplaceTransaction (payment/fulfillment/resolution)
  payments                          MarketplacePaymentRecord   (provider-neutral)
  marketplace_provider_attempts     ProviderAttempt[]          (request + response + reconciliationFacts)
  marketplace_orders                MarketplaceOrder
  wallet_ledger / wallet evidence   WalletPaymentEvidence
  ticket_artifacts / gift_card_artifacts
  transaction_events                timeline
                │  (facts packaged by existing marketplaceTransactionFacts)
                ▼
TransactionReconciliationFacts + (artifacts, resolution context)   ← PURE INPUT
                │  buildMarketplaceReconcileInput(facts, context)  [NEW reconcile-bridge.ts]
                ▼
ReconcileRecordsRequest { merchantPayments, providerPayments, config, providerSourceAttributes }
                │  reconcileRecords()                                [UNCHANGED ENGINE]
                ▼
ReconciliationReport { results, summary }
                │  buildMarketplaceTruth(report, facts)             [NEW truth.ts]
                ▼
TransactionTruth { reconcileOutcome, customerStatus, adminStatus,
                   moneyAtRisk, nextAction, explanation }
                │  [NEW reconcile.ts]  persist determination as new facts
                ▼
new timeline events (RECONCILE_KIT source) + EvidencePack row
+ new marketplace_transactions line (reconcileOutcome set, latest-wins)
```

## 4. Proposed Adapter

### 4.1 Adapter input contract (Q11)

A **pure, store-free** snapshot — never live store reads inside the adapter.
Built from the facts the orchestrator already packages via
`marketplaceTransactionFacts()`:

```ts
export interface MarketplaceReconcileContext {
  readonly facts: TransactionReconciliationFacts; // authoritative numeric/status/reference facts
  readonly serviceKind: MarketplaceServiceKind; // evidence only; no per-service logic
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
  readonly resolutionStatus: ResolutionStatus; // refund/reversal/dispute/manual-review
  readonly config: ReconciliationConfig; // defaults: ReconciliationConfig for catalog currencies
}
```

`TransactionReconciliationFacts` already carries: transactionId, orderId,
customerReference, providerId, serviceId, serviceKind, scenario,
expectedAmountMinor, paymentAmountMinor, providerAmountMinor, currency,
paymentState, providerState, fulfillmentState, providerReference,
requestedAt, respondedAt, providerAttemptHistory, evidenceLedgerEntryIds,
reversal, refund, flags, simulated.

### 4.2 Mapping rules (the bridge)

| Engine input field                   | Source                                                                  | Rule                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MerchantPayment.merchant_reference` | `facts` transaction **reference** (`txn_…`, from transaction record)    | **join key** — MUST equal provider `reference` (see 4.3)                                                                                           |
| `MerchantPayment.amount`             | `facts.expectedAmountMinor`                                             | merchant amount from the quote check-out, never provider-influenced                                                                                |
| `MerchantPayment.currency`           | `facts.currency`                                                        | catalog currency (NGN/USD/GBP)                                                                                                                     |
| `MerchantPayment.status`             | `facts.paymentState` (canonical)                                        | already engine vocabulary; never null (payment always settles or holds or fails)                                                                   |
| `MerchantPayment.occurred_at`        | wallet debit evidence `occurredAt` (ISO); fallback `payment.recordedAt` | convert ISO → epoch ms (safe integer); null-safe                                                                                                   |
| `MerchantPayment.merchant_record_id` | `facts.orderId`                                                         | joinable back to marketplace order, like `PaymentRecord.orderId`                                                                                   |
| `ProviderPayment.reference`          | **same** `txn_…`                                                        | the only way the engine can pair the sides                                                                                                         |
| `ProviderPayment.amount`             | `facts.providerAmountMinor`                                             | omitted (no provider row) when `null`                                                                                                              |
| `ProviderPayment.currency`           | `facts.currency`                                                        | same currency sphere as expected                                                                                                                   |
| `ProviderPayment.status`             | last attempt `canonicalStatus`                                          | only terminal/known statuses (emission policy 4.4)                                                                                                 |
| `ProviderPayment.occurred_at`        | last attempt `attemptedAt` / response timestamp                         | ISO → epoch ms; null-safe                                                                                                                          |
| `ProviderPayment.provider_id`        | `facts.providerId`                                                      | improvement over Paystack path (which stores null)                                                                                                 |
| `providerSourceAttributes`           | last attempt `sourceAttributes` + `safeMetadata`                        | raw status, raw status code, message, request_id, correlation_id, attempt number, latency, scenario, **providerReference** (`air_…`), responded_at |

### 4.3 Join key — the single most important rule

The engine pairs records by `normalizeReference(merchant_reference)` ===
`normalizeReference(provider.reference)`. In the marketplace:

- transaction reference `buildTransactionReference(seed)` = `txn_…` — the
  marketplace exchange identity;
- provider attempts carry `requestReference` (`req_…`) and
  `providerReference` (`air_…` / `res_…` / `iss_…`);

Always emit `txn_…` on **both** sides. `providerReference` must **never** be
used as `ProviderPayment.reference`; it is preserved in
`providerSourceAttributes` (evidence only). Using the provider reference as
the join key would make every transaction `MISSING_PROVIDER_RECORD` +
`UNMATCHED_PROVIDER_RECORD`.

### 4.4 Provider-row emission policy (the correctness guard)

Emit a provider row **only when the provider gave definitive returnable
evidence**. Deterministic, service-agnostic rule:

> Emit a provider `ProviderPayment` iff the latest attempt has non-null
> `reconciliationFacts` **and** `canonicalStatus ∈ {SUCCESS, FAILED,
CANCELLED, UNKNOWN}`.

Consequences (this directly implements the brief's "timeout must not become
failure"):

| Facts                                                                             | provider row?                                                         | Engine behavior                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `TIMEOUT`                                                                         | **no** (`reconciliationFacts: null` in the mock)                      | `MISSING_PROVIDER_RECORD` — hold/unresolved, not failure |
| `PENDING` (hold)                                                                  | **no** (non-terminal; emitting PENDING/PENDING would falsely `MATCH`) | `MISSING_PROVIDER_RECORD`                                |
| `REFUND_PENDING` (hold)                                                           | **no** (same non-terminal reasoning; funds still held)                | `MISSING_PROVIDER_RECORD`                                |
| `UNKNOWN`                                                                         | **yes** (status `UNKNOWN`)                                            | `STATUS_UNRESOLVED` → `UNRESOLVED`                       |
| `SUCCESS`/`FAILED`/`PARTIAL`/`MISMATCH`/`DUPLICATE`/`REVERSED`/`REFUND_COMPLETED` | **yes**                                                               | see scenario table                                       |

### 4.5 Adapter output contract (Q12)

The bridge returns exactly:

```ts
export interface MarketplaceReconcileInput extends ReconcileRecordsRequest {
  readonly config: ReconciliationConfig; // catalog-aware config (NGN, USD, GBP), 60s tolerance
}
```

which is passed straight to `reconcileRecords()`. No custom output type is
invented at the engine boundary; the engine's `ReconciliationReport` is the
output. The marketplace-facing output (`TransactionTruth`, `EvidencePack`) is
derived downstream in `truth.ts` / `reconcile.ts`.

## 5. Exact Mapping Table

| #   | Marketplace artifact                                                  | Reconcile Kit concept                                   | Direct            | Transform                   | No representation      |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------- | ----------------- | --------------------------- | ---------------------- |
| 1   | `MarketplacePaymentRecord.expectedAmountMinor`                        | `MerchantPayment.amount`                                |                   | ✅ (from facts)             |                        |
| 2   | `MarketplacePaymentRecord.status` (canonical)                         | `MerchantPayment.status`                                | ✅                |                             |                        |
| 3   | `MarketplacePaymentRecord.currency`                                   | `MerchantPayment.currency` / `ProviderPayment.currency` | ✅                |                             |                        |
| 4   | `transaction.reference` (`txn_…`)                                     | `merchant_reference` + `provider.reference`             |                   | ✅ (join-key normalization) |                        |
| 5   | attempt `providerReference` (`air_…`)                                 | `provider.source_attributes` only                       |                   | ✅ (never the join key)     |                        |
| 6   | attempt `amountMinor` / `canonicalStatus`                             | `ProviderPayment.amount` / `.status`                    | ✅ (when emitted) |                             |                        |
| 7   | `providerId` (`mkp_…`)                                                | `ProviderPayment.provider_id`                           | ✅                |                             |                        |
| 8   | ISO timestamps → epoch ms                                             | `occurred_at` (both sides)                              |                   | ✅ (`Date.parse`)           |                        |
| 9   | `facts.flags` (`ReconciliationCode[]`)                                | reconciled by engine as codes                           | ✅ vocabulary     |                             |                        |
| 10  | `paymentAmountMinor`, `evidenceLedgerEntryIds`                        | support / evidence pack                                 |                   |                             | ✅ (evidence)          |
| 11  | `fulfillmentStatus`, artifacts (ticket/gift)                          | —                                                       |                   |                             | ✅ (application layer) |
| 12  | `resolutionStatus` (refund/reversal/dispute/manual)                   | —                                                       |                   |                             | ✅ (application layer) |
| 13  | `scenario`, latency, request/correlation ids, raw status/code/message | `providerSourceAttributes` / evidence pack              | ✅ (supporting)   |                             |                        |
| 14  | `customerStatus` / `adminStatus`                                      | **derived from** outcome (`truth.ts`)                   |                   |                             | (never fed in)         |
| 15  | `serviceKind`, service snapshot                                       | evidence pack                                           |                   |                             | ✅                     |

## 6. Status Mapping

Engine canonical statuses: `PENDING | SUCCESS | FAILED | CANCELLED | UNKNOWN`.

### Merchant (expected) side — from payment lifecycle

`MarketplaceTransaction.paymentStatus` is already `CanonicalPaymentStatus` —
zero transformation:

| Marketplace payment lifecycle                                                  | Reconcile Kit merchant status | Reason                        |
| ------------------------------------------------------------------------------ | ----------------------------- | ----------------------------- |
| `INITIATED`/`AUTHORIZED`                                                       | `PENDING`                     | money not settled             |
| `PENDING` hold (PENDING/TIMEOUT/REFUND_PENDING scenarios)                      | `PENDING`                     | funds held, no terminal truth |
| `SETTLED` (SUCCESS/FAILED/PARTIAL/MISMATCH/DUPLICATE/UNKNOWN/REFUND_COMPLETED) | `SUCCESS`                     | funds captured                |
| `FAILED` (declined debit guard)                                                | `FAILED`                      | never left the wallet         |
| `REVERSED` (REVERSED scenario)                                                 | `CANCELLED`                   | provider reversal lifecycle   |

### Provider (observed) side — from the latest attempt

Marketplace `ProviderStatus` → engine `CanonicalPaymentStatus`:

| Provider status             | Attempt status | Engine canonical | Provider row emitted?           |
| --------------------------- | -------------- | ---------------- | ------------------------------- |
| `PROVIDER_SUCCESS`          | `SUCCESS`      | `SUCCESS`        | yes                             |
| `PROVIDER_FAILED`           | `FAILED`       | `FAILED`         | yes                             |
| `PROVIDER_PENDING`          | `PENDING`      | `PENDING`        | **no** (non-terminal)           |
| `PROVIDER_TIMEOUT`          | `TIMEOUT`      | `UNKNOWN`        | **no** (no reconciliationFacts) |
| `PROVIDER_DUPLICATE`        | `DUPLICATE`    | `SUCCESS`        | yes                             |
| `PROVIDER_PARTIAL_SUCCESS`  | `SUCCESS`      | `SUCCESS`        | yes                             |
| `PROVIDER_REVERSED`         | `SUCCESS`      | `CANCELLED`      | yes                             |
| `PROVIDER_REFUND_PENDING`   | `PENDING`      | `PENDING`        | **no** (non-terminal)           |
| `PROVIDER_REFUND_COMPLETED` | `SUCCESS`      | `SUCCESS`        | yes                             |
| `PROVIDER_MISMATCH`         | `MISMATCH`     | `SUCCESS`        | yes                             |
| `PROVIDER_UNKNOWN`          | `UNKNOWN`      | `UNKNOWN`        | yes                             |

### Fulfillment status — NOT a Reconcile Kit concept

`FULFILLED/PENDING/FAILED/PARTIAL/CANCELLED/NOT_STARTED` stays in the
marketplace layer. Payment truth comes from Reconcile Kit; fulfillment truth
comes from provider/ticketing/gift artifacts. This is the documented
"kept separate" boundary in `docs/RECONCILE_KIT_INTEGRATION.md`.

### States that must NOT be "reconciled as failed" yet

| Marketplace state                   | Reason not to treat as FAILURE  | Bridge behavior                              |
| ----------------------------------- | ------------------------------- | -------------------------------------------- |
| Provider `TIMEOUT`                  | no definitive provider evidence | no provider row → `MISSING_PROVIDER_RECORD`  |
| Payment `PENDING` hold              | funds held, no terminal truth   | no provider row → `MISSING_PROVIDER_RECORD`  |
| Provider `PENDING` (refund pending) | non-terminal lifecycle          | no provider row → `MISSING_PROVIDER_RECORD`  |
| Provider `UNKNOWN`                  | unknown ≠ failed                | provider row status `UNKNOWN` → `UNRESOLVED` |

## 7. Facts Mapping — authoritative vs supporting

**Authoritative (feed the engine):**

- `expectedAmountMinor` (merchant amount) — quote snapshot, server-owned.
- `currency` (both sides, same sphere).
- `paymentState` (merchant canonical status).
- `providerAmountMinor`, last-attempt `canonicalStatus` (provider observations).
- transaction reference `txn_…` (join key).

**Supporting evidence (source attributes / EvidencePack only — never engine
inputs):**

- `scenario`, `fulfillmentState`, `resolutionStatus`, `reversal`/`refund`
  lifecycle, `serviceKind`/service snapshot, attempt history (including
  `DUPLICATE` extra candidates), `latencyMs`, `requestId`, `correlationId`,
  raw provider status/code/message, `providerReference`, `respondedAt`,
  `evidenceLedgerEntryIds`, artifact references and `maskedCodePreview`/risk
  flags.

**No engine representation (application layer, per existing integration doc):**

- fulfillment, resolution/refund/reversal, manual review, dispute, receipt,
  ticket issuance vs reservation, gift-card delivery/redemption.

## 8. Scenario Mapping

`MockProviderScenario` → expected `MatchResult` from the unchanged engine.

| #   | Scenario                                | Merchant side       | Provider row                | Engine outcome                                    | Codes               | Money                                             |
| --- | --------------------------------------- | ------------------- | --------------------------- | ------------------------------------------------- | ------------------- | ------------------------------------------------- |
| 1   | `SUCCESS`                               | `SUCCESS`           | `SUCCESS` same amount       | **MATCH**                                         | —                   | settled                                           |
| 2   | `FAILED` (provider decline)             | `SUCCESS` (settled) | `FAILED`                    | **DISCREPANCY**                                   | `STATUS_MISMATCH`   | captured, resolvable                              |
| 3   | `TIMEOUT`                               | `PENDING` (hold)    | **omitted**                 | **MISSING_PROVIDER_RECORD**                       | —                   | held (not failed)                                 |
| 4   | `PENDING`                               | `PENDING` (hold)    | **omitted**                 | **MISSING_PROVIDER_RECORD**                       | —                   | held                                              |
| 5   | `DUPLICATE`                             | `SUCCESS`           | one `SUCCESS` row (deduped) | **MATCH** + app-level `DUPLICATE_PROVIDER_RECORD` | —                   | settled once (see open decision)                  |
| 6   | `MISMATCH` (amount)                     | `SUCCESS` (1000)    | `SUCCESS` (1100)            | **DISCREPANCY**                                   | `AMOUNT_MISMATCH`   | settled                                           |
| 7   | `PARTIAL_SUCCESS`                       | `SUCCESS` (amount)  | `SUCCESS` (50%)             | **DISCREPANCY**                                   | `AMOUNT_MISMATCH`   | settled                                           |
| 8   | `UNKNOWN`                               | `SUCCESS`           | `UNKNOWN`                   | **UNRESOLVED**                                    | `STATUS_UNRESOLVED` | settled, unresolved                               |
| 9   | `REVERSED`                              | `CANCELLED`         | `CANCELLED`                 | **MATCH**                                         | —                   | restored (both sides agree)                       |
| 10  | `REFUND_PENDING`                        | `PENDING` (hold)    | **omitted**                 | **MISSING_PROVIDER_RECORD**                       | —                   | held; refund = resolution evidence                |
| 11  | `REFUND_COMPLETED`                      | `SUCCESS`           | `SUCCESS`                   | **MATCH**                                         | —                   | payment reconciled; refund complete is resolution |
| 12  | Gift-card fulfillment `FAILED`          | `SUCCESS` (settled) | `FAILED`                    | **DISCREPANCY**                                   | `STATUS_MISMATCH`   | captured; code evidence masked                    |
| 13  | Ticketing reservation/issuance `FAILED` | `SUCCESS` (settled) | `FAILED`                    | **DISCREPANCY**                                   | `STATUS_MISMATCH`   | captured; ticket status is separate truth         |
| 14  | (guard) declined wallet debit           | `FAILED`            | **omitted** (never called)  | **MISSING_PROVIDER_RECORD**                       | —                   | never left wallet                                 |

Rationale for keeping some outcomes non-SUCCESS-non-FAILURE: the engine only
emits `MATCH` when **both** sides exist, share the reference, and pass status/
amount/currency/timestamp validation. When there is no terminal provider
evidence, the honest answer is _missing/unknown_, not _success_ or _failure_.

## 9. Evidence Model

`EvidencePack` (already declared in `storefront/src/marketplace/types.ts`,
currently unused) is the output envelope:

```ts
EvidencePack {
  id, transactionId, customerReference, providerReference,
  paymentReference, serviceSnapshot,
  amountMinor, currency,
  timelineEventIds, providerFacts,            // source attributes, safe facts
  reconciliation: ReconciliationSnapshot|null,// outcome + codes + notes + sourceAttributes
  mismatchFlags, resolutionStatus,
  auditEventIds, createdAt, simulated
}
```

Assembled from: order/payment/attempt facts + `MarketplaceReconcileContext` +
the engine `MatchResult` + timeline event ids. `ReconciliationSnapshot` is the
engine-ecosystem view; the masked/gift/ticket safe facts stay out of raw
provider facts (per existing secret-handling rule: no raw gift-card codes).

## 10. Timeline Relationship

Derived determination is **a new fact, appended, never inserted inline**:

```
Marketplace events + Provider evidence + Payment evidence + Wallet evidence
        └─▶ reconcileRecords()        (engine — single source of truth for the determination)
                └─▶ EvidencePack + new RECONCILE_KIT timeline events
                        └─▶ MarketplaceTransaction.reconcileOutcome (latest-wins) + customer/admin status
                                └─▶ Timeline / Evidence / Resolution UX
```

- `TransactionEventActor` and `TransactionEventSource` already include
  `"RECONCILE_KIT"` — no type change needed to record determinations.
- Suggested new event types (add to the catalogue, **do not mutate** existing
  ones): `RECONCILE_INPUT_BUILT`, `RECONCILE_DETERMINED`,
  `RECONCILE_REQUIRES_REVIEW`.
- The engine is not duplicated anywhere in the marketplace; the marketplace
  only persists determinations and derived status.

## 11. Immutability Strategy

The JSONL store is append-only with latest-wins id bookkeeping
(`readLatestById` picks the last line per id). Reconciliation writes:

1. **append** new `transaction_events` rows (`RECONCILE_KIT` source) —
   determinations become part of history;
2. **append** a new `evidence_packs` row (new store kind, see §13);
3. **append** a new `marketplace_transactions` line with
   `reconcileOutcome` + derived `customerStatus`/`adminStatus` set (the
   existing latest-wins pattern; earlier lines remain the historical record).

Never overwrite: provider attempts, payment records, wallet ledger entries,
or prior timeline events. A determination replaces nothing — it supersedes
the _current view_ of the same transaction id, exactly like `verifyOrder`
appends an updated PaymentRecord for the same order id.

## 12. Multi-Service Support

The bridge is fully service-agnostic. Evidence:

- Every service path produces the same shapes: `MarketplacePaymentRecord`,
  `ProviderAttempt[]` with `reconciliationFacts`, and a marketplace
  `txn_…` reference. Gift cards/vouchers use the same attempt shape; ticketing
  emits two attempts (search→reserve→issue), gift cards one.
- The only generic choice rule — "use the **latest** attempt's
  reconciliationFacts as the provider observation" — holds for airtime, data,
  electricity, cable, internet, education (one attempt) and cinema, events,
  bus, airline (two attempts: take the issuance/terminal result). Gift-card/
  voucher take their single attempt. This is one rule, not N engines.
- Services needing extra evidence (explicitly): ticketing (reservation vs
  issuance truth lives in `ticket_artifacts`), gift cards/vouchers
  (delivery/redemption truth lives in `gift_card_artifacts`). These never
  affect the engine input; they fill the `EvidencePack`.

Config: `supportedCurrencies` comes from the catalog (`NGN`, `USD`, `GBP` —
the airline LOS→LON service is GBP). The root `RECONCILE_CONFIG` (NGN/USD) is
for the Paystack path; the marketplace adapter supplies its own catalog-aware
config per call. The engine accepts any config — no engine change.

## 13. Required Code Changes (implementation phase — NOT now)

**Create:**

1. `storefront/src/marketplace/reconcile-bridge.ts`
   — pure `buildMarketplaceReconcileInput(context)` → `ReconcileRecordsRequest`,
   implementing §4.2–§4.5, `MarketplaceReconcileInput` type, config, and the
   provider-emission policy.
2. `storefront/src/marketplace/truth.ts`
   — pure `buildMarketplaceTruth(report, context)` → `TransactionTruth`
   (model in the Phase 2F plan: `reconcileOutcome`, `customerStatus`,
   `adminStatus`, `moneyAtRisk`, `nextAction`, `explanation`) and
   `toReconciliationSnapshot(result)`.
3. `storefront/src/marketplace/reconcile.ts`
   — orchestration + persistence glue: resolve context from the store,
   call bridge → `reconcileRecords()` → truth → append timeline events,
   evidence_packs row, and the latest-wins transaction line. (Small plan
   extension: the plan listed bridge.ts + truth.ts; a thin third module keeps
   persistence out of `transactions.ts`.)
4. Tests:
   - `storefront/test/marketplace/reconcile-bridge.test.ts`
   - `storefront/test/marketplace/truth.test.ts`
   - `storefront/test/marketplace/reconcile.test.ts` (end-to-end: store →
     bridge → engine → truth → persisted determination)

**Modify:**

- `storefront/src/store/jsonl-store.ts` — register a new kind
  `evidence_packs` (mirroring the `ticket_artifacts`/`gift_card_artifacts`
  addition in Phase 2E). Update `store-kinds.test.ts`.
- `storefront/src/marketplace/timeline.ts` — append the three new
  `RECONCILE_*` event type constants (additive only).
- `storefront/src/marketplace/transactions.ts` — **optional, minimal**: no
  functional change is required for the mapping; `reconcileOutcome: null`
  stays as the initial line. If preferred, export a helper so `reconcile.ts`
  can persist the updated transaction line without reaching into internals.

## 14. Files That Must Remain Untouched

- Root engine (all of `src/`): `domain/model.ts`, `domain/reconcile.ts`,
  `domain/validation.ts`, `domain/reference.ts`, `domain/duplicates.ts`,
  `application/reconcile-records.ts`, `adapters/**`, `cli/**`,
  `integration/**`, and all root tests.
- Storefront Paystack path: `src/domain/types.ts` (`PaymentRecord`),
  `src/paystack/**`, `src/reconcile/adapter.ts`, `src/reconcile/view.ts`,
  `src/reconcile/merchant-csv.ts`, `src/application/verify-order.ts`,
  `src/config.ts`, the `server.ts` reconcile endpoints, and their tests.
- Marketplace behavior: `wallet.ts`, `providers/**` (contracts, mock,
  payment, registry), `catalog.ts`, existing `timeline.ts` semantics,
  `ids.ts`, and all 228 existing storefront tests pass unchanged.

## 15. Test Strategy

Model on the existing `reconcile-adapter.test.ts` + domain tests:

1. **Bridge purity** (no store): each scenario facts → exactly the expected
   `MerchantPayment`/`ProviderPayment`/`providerSourceAttributes`; assert
   join key is `txn_…` on both sides; assert provider row emission per §4.4.
2. **Join key guard**: a fixture with non-matching keys must never be
   produced by the bridge (assert the produced keys are equal).
3. **Scenario → outcome** (table §8): run through
   `reconcileRecords(bridgeOutput)` and assert outcome + codes for every
   scenario (SUCCESS→MATCH, FAILED→DISCREPANCY, TIMEOUT→MISSING_PROVIDER_RECORD,
   etc.).
4. **Hold truth**: PENDING/TIMEOUT/REFUND_PENDING yield
   `MISSING_PROVIDER_RECORD`, never `MATCH` or a provider-failure code.
5. **Precision**: integer minor units; currency equality; timestamp
   conversion (ISO→epoch); 60s tolerance never fires spuriously on mock
   latencies.
6. **Truth derivation**: `TransactionTruth` mapping incl. `moneyAtRisk`
   (money moved but outcome not confirmed/refunded), nextAction texts.
7. **Determination persistence**: new timeline events, evidence_packs row,
   latest-wins transaction line; **no** attempt/payment/ledger row mutated;
   repeat invocation appends no duplicate determination.
8. **Immutability regression**: after a determination, provider and payment
   records are byte-identical (sample compare), old transaction lines intact.
9. **Idempotency with replay**: replay of an already-reconciled transaction
   returns the persisted trail, does not re-run the engine.
10. **Config**: NGN + USD + GBP multi-currency fixtures pass validation.
11. **Regression**: existing storefront 228/228 and root 441/441 unchanged.

## 16. Risks

| Risk                                                                             | Severity | Mitigation                                                                                        |
| -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Join-key misuse (`air_…` on the provider side) → every txn `MISSING_/UNMATCHED_` | High     | Bridge contract: both sides `txn_…`; provider reference only in source attributes; dedicated test |
| PENDING/TIMEOUT falsely resolving to `MATCH` or `FAILURE`                        | High     | §4.4 emission policy + tests 3/4                                                                  |
| Fulfillment/payment conflation (ticket not issued ≠ payment mismatch)            | Medium   | Keep engine = payment/provider truth; ticket/gift state only in evidence/truth                    |
| `DUPLICATE` semantics surprise (`MATCH` + app flag)                              | Medium   | Open decision (+ alternative `HELD_AMBIGUOUS`), explicit doc row                                  |
| Timestamp representation drift (ISO vs epoch ms)                                 | Medium   | Bridge converts once; `validatePaymentInput` accepts only safe integers; null when absent         |
| Money-at-risk derivation drift (hold vs settled)                                 | Medium   | `moneyAtRisk` derived solely from `paymentState` (`PENDING`/hold) + resolution; single table      |
| Config currency mismatch (GBP service, NGN/USD config)                           | Medium   | Catalog-aware `supportedCurrencies` per call; engine unchanged                                    |
| Making the engine decorative (duplicating logic in marketplace)                  | Medium   | Marketplace never runs validations; it only persists engine verdicts                              |

## 17. Open Decisions

1. **Duplicate provider emission**: (a) _recommended_ — dedupe to one
   `SUCCESS` row → `MATCH` + application-level `DUPLICATE_PROVIDER_RECORD`
   flag (marketplace already resolved truth deterministically); or
   (b) emit the duplicate candidate too → `HELD_AMBIGUOUS` +
   `DUPLICATE_PROVIDER_RECORD`. (a) keeps the engine honest about resolved
   truth; (b) is more conservative. Note: an earlier integration doc line
   expected `HELD_AMBIGUOUS`; this doc recommends (a) unless the owner
   prefers (b).
2. **`verify`-time vs `facts`-time reconciliation**: reconcile once at
   transaction finalization, or on demand via `marketplaceTransactionFacts` +
   `reconcile.ts`. Recommended: both share one pure bridge; on-demand reuse
   the facts path.
3. **`PENDING` merchant-side status** in the engine input: keep
   `paymentState` verbatim (`PENDING` merchant row emitted, provider row
   omitted) — recommended and consistent with the Paystack bridge; the
   alternative (omit the merchant row too) loses the expected-side record.
4. **Timeline event catalogue**: adopt `RECONCILE_INPUT_BUILT`,
   `RECONCILE_DETERMINED`, `RECONCILE_REQUIRES_REVIEW` (recommended) vs a
   single `RECONCILE_DETERMINED`.
5. **First-class reconciliation model row** (`reconcile_determinations`)
   vs `evidence_packs` only. Recommended: `evidence_packs` + transaction
   line; add a dedicated determinations kind only if Phase 2G needs it.
6. **UNKNOWN scenario**: settle-and-unresolved (`SUCCESS` merchant + `UNKNOWN`
   provider → `UNRESOLVED`) — recommended; never downgrade to `MISSING_*`.

## 18. Recommended Implementation Sequence

1. `reconcile-bridge.ts` pure mapping + bridge tests (§15.1–15.5) — TDD.
2. `truth.ts` + truth tests (§15.6).
3. `reconcile.ts` persistence glue + `evidence_packs` store kind + store-kind
   test + reconcile tests (§15.7–15.11).
4. Additive timeline catalogue types; optional `transactions.ts` export hook.
5. Full verification: storefront typecheck + tests, root typecheck + tests,
   root lint, Prettier on changed files. Report exact counts.

---

## STOP-CONDITION SUMMARY

- **Recommended adapter boundary**:
  `MarketplaceReconcileContext (facts + artifacts + resolution) →
buildMarketplaceReconcileInput() [storefront/src/marketplace/reconcile-bridge.ts]
→ ReconcileRecordsRequest → reconcileRecords() → buildMarketplaceTruth()
[storefront/src/marketplace/truth.ts] → TransactionTruth → EvidencePack +
RECONCILE_KIT timeline events + latest-wins reconcileOutcome.`
- **Smallest expected code change**: the Paystack bridge pattern (one pure
  map to `MerchantPayment[]`/`ProviderPayment[]`, one truth mapper, one
  persistence helper) — **zero root-engine changes**.
- **Exact files proposed for modification**: create
  `storefront/src/marketplace/reconcile-bridge.ts`,
  `storefront/src/marketplace/truth.ts`,
  `storefront/src/marketplace/reconcile.ts`;
  modify `storefront/src/store/jsonl-store.ts` (+`evidence_packs` kind),
  `storefront/src/marketplace/timeline.ts` (additive event types);
  add `storefront/test/marketplace/reconcile-bridge.test.ts`,
  `reconcile-bridge/…` → `truth.test.ts`, `reconcile.test.ts`;
  optional `storefront/src/marketplace/transactions.ts` helper export.
- **Exact files to remain untouched**: all of `src/**` (root engine),
  `storefront/src/domain/types.ts` (`PaymentRecord`), `src/paystack/**`,
  `src/reconcile/{adapter,view,merchant-csv}.ts`, `src/application/verify-order.ts`,
  `src/config.ts`, wallet/providers/catalog/ids, and all existing tests.
- **Highest-risk integration issue**: join-key semantics — the engine pairs
  by exact reference equality, so both sides must carry `txn_…`
  (never `providerReference`), or every transaction becomes
  `MISSING_PROVIDER_RECORD`/`UNMATCHED_PROVIDER_RECORD`.
- **Tests required**: per §15 — bridge purity + join-key guard, scenario→
  outcome table, hold-truth (PENDING/TIMEOUT never MATCH/FAILURE),
  precision/timestamp/config, truth & moneyAtRisk derivation, determination
  persistence + immutability, replay idempotency, multi-currency, and full
  regression (228 storefront + 441 root).
- **Can the existing Reconcile Kit engine remain unchanged?** **Yes.** The
  engine's input and outcome vocabulary already cover the marketplace;
  `MarketplacePaymentRecord` requires no Paystack leakage; no engine file,
  Paystack adapter, or `PaymentRecord` needs modification. The integration is
  a pure storefront-side adapter plus additive persistence.

STOPPED for approval. No implementation code written in this session.
