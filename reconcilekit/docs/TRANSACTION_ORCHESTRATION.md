# Transaction Orchestration Architecture

## Purpose

This document defines how the marketplace checkout executes as a single
transaction trail in the validation MVP: catalog quote → wallet payment →
provider request → provider result → final marketplace state, all persisted
into one append-only trail that can later feed ReconcileKit (Phase 2F).

The orchestrator never moves money blindly. Every provider scenario is routed
through the wallet's payment lifecycle first; provider results are applied to
that lifecycle instead of being trusted at face value.

## Phase 2E Implementation (Complete)

Implemented files:

- `storefront/src/marketplace/transactions.ts` — orchestration core:
  identity, quote, payment, provider invocation, resolution, final state,
  replay, facts
- `storefront/src/marketplace/timeline.ts` — canonical `transaction_events`
  catalogue and ordering
- `storefront/src/marketplace/wallet.ts` — wallet id consistency fix
  (`createWallet` accepts an explicit id; `resolveWallet` passes it)
- `storefront/src/ids.ts` — marketplace identity seed builders;
  `stableToken` now appends a stable digest so distinct inputs never collide
- `storefront/src/store/jsonl-store.ts` — added `ticket_artifacts` and
  `gift_card_artifacts` kinds

Test files:

- `storefront/test/marketplace/transactions.test.ts` — 24 orchestration tests
- `storefront/test/marketplace/input-validation.test.ts` — 31 checkout
  input-schema validation tests
- `storefront/test/marketplace/timeline.test.ts` — ordering, isolation, sequence
- `storefront/test/marketplace/demo-deps.ts` — `demoDeps(store)` fixture

The `storefront/test/marketplace/transactions.test.ts` fixtures were migrated to
schema-conformant input payloads (`recipient`/`amount`/`meterNumber`/`movie`/
`seats`/`date`/`flight`, etc.) now that checkout enforces each service's
`inputSchema`.

## Execution Flow

```text
executeMarketplaceTransaction(deps, input)
  -> findServiceById(catalog)            (unknown service => TransactionInputError)
  -> assertCheckoutEligible(service)     (compliance gate)
  -> validateServiceInputs(inputSchema)  (malformed input => ServiceInputValidationError)
  -> identity: seed(customer|service|scenario|inputsKey)
       -> transactionId, reference, orderId
  -> replay guard: existing record?      (return persisted trail, replayed: true)
  -> quoteService(catalog)               (catalog price snapshot)
  -> insert order
  -> resolveWallet(customer, currency)   (create on demand)
  -> runPaymentAndFulfillment: debit (SUCCESS/PENDING by scenario)
       -> provider request/attempt(s)
       -> applyScenarioEvents -> applyResolutionToEvents -> finalizeTransaction
  -> persistTransaction + final order   (latest-wins id bookkeeping)
```

The state model, scenario semantics, and FAILED interpretation follow
`Phase 2E` in `docs/PHASE_2_IMPLEMENTATION_PLAN.md`.

## Checkout Input Validation

Every service declares an `inputSchema` (a `ServiceInputDescriptor[]` in
`catalog.ts`). Checkout enforces that schema **before** any money-affecting or
provider-affecting work:

- **Where:** immediately after service resolution and the compliance gate, and
  before identity, replay, quote, order creation, wallet, or provider work.
- **Mechanism:** a single generic `validateServiceInputs(schema, inputs)`
  drives all rules from the schema descriptors — no bespoke per-service
  validators. Required fields must be present and non-blank; `SELECT` fields
  must be a declared option; `NUMBER`/`PHONE`/`EMAIL`/`DATE` fields must match
  their type format. Unknown extra input keys are tolerated.
- **On failure:** a deterministic `ServiceInputValidationError` is thrown with
  the rejected `field` and a stable `code`
  (`MISSING_REQUIRED`, `INVALID_SELECT`, `INVALID_NUMBER`, `INVALID_PHONE`,
  `INVALID_EMAIL`, `INVALID_DATE`). Errors are collected in schema order and
  the first is thrown, so the rejected field is always deterministic. No order,
  no wallet ledger entry, no provider attempt, and no fulfillment artifact is
  ever created.
- **Why before payment/provider:** a malformed payload can never reach the
  wallet debit, a payment authorization, or a provider call, so no reversal or
  refund is ever needed to unwind a bad checkout. The failed-payment guard
  (insufficient balance) still runs for _valid_ inputs.

## Identity and Idempotency

- Transaction identity = `buildMarketplaceSeed({customerId, serviceId,
scenario, inputsKey})`; `inputsKey` = sorted `key:value` pairs of the
  service inputs.
- A repeated call with the same inputs **replays the persisted trail**:
  `replayed: true`, facts `null`, no second debit, no new events, no new
  provider calls.
- `stableToken` truncates slugs for readability but now appends a stable
  `fnv1a` digest of the full value, so two purchases that differ only in the
  tail of their input payload (e.g. different airtime phone numbers) can
  never collapse into one identity.

## Wallet and Payment Semantics

- Wallets are created per (customer, currency): `wl_cus_demo_ngn`, etc.
  Default opening balance 500 000 minor units at `WALLET_FIXED_TIMESTAMP`.
- Only `PENDING`/`TIMEOUT` scenarios debit as a hold (DEBIT_PENDING).
  Every other scenario debits as SUCCESS before the provider is called.
- A failed debit (insufficient balance) stops **before** any provider call:
  `PAYMENT_FAILED` event, order `FAILED`, no attempt records.
- Provider results are applied to the debit lifecycle:

| Flow             | Ledger evidence                   | Notes                                 |
| ---------------- | --------------------------------- | ------------------------------------- |
| SUCCESS          | DEBIT_SUCCESS                     | FULFILLED, HEALTHY, COMPLETED         |
| FAILED           | DEBIT_SUCCESS (settled)           | payment stays SUCCESS, provider fails |
| DUPLICATE        | DEBIT_SUCCESS once                | FULFILLED once + DUPLICATE flag       |
| PARTIAL_SUCCESS  | DEBIT_SUCCESS                     | PARTIAL fulfillment + MISMATCH flag   |
| MISMATCH         | DEBIT_SUCCESS                     | amount flag, REQUIRES_REVIEW          |
| TIMEOUT/PENDING  | DEBIT_PENDING hold                | no invented provider facts            |
| REVERSED         | REVERSAL_COMPLETED                | available balance restored            |
| REFUND_PENDING   | REFUND_INITIATED + REFUND_PENDING | funds still held                      |
| REFUND_COMPLETED | REFUND_COMPLETED                  | CANCELLED, HEALTHY                    |

## Fulfillment Artifacts

- Ticketable services (cinema, event, bus, airline) persist one
  `ticket_artifacts` record (reserve → issue; PENDING scenarios reserve but
  do not issue).
- Gift cards persist one `gift_card_artifacts` record. Raw codes are never
  stored: only a masked preview (`GC-*…****`) is recorded, and `FAILED`/
  `TIMEOUT` artifacts expose no code at all.
- Event metadata on the timeline masks secrets; artifacts carry risk flags
  such as `AMOUNT_DISCREPANCY` for MISMATCH.

## Reconciliation Readiness

`marketplaceTransactionFacts(store, transactionId)` resolves the canonical
trail from persisted records (order → payment → attempts → facts) and is the
single hook Phase 2F will consume. Documented limitation: ledger evidence
entry ids are intentionally not embedded in facts (the ledger is
append-only; tying evidence ids to the facts payload would couple the two
stores). Reversal/refund status is surfaced, and `simulated: true` marks
every record.

## Verification

- Storefront: `npm run typecheck` clean; `npm test` 228/228 pass (was
  163/163 after Phase 2D; +31 Phase 2E tests, +34 checkout input-validation
  tests).
- Root ReconcileKit: `npm run typecheck` clean; `npm test` 441/441 pass (was
  407/407 after Phase 2E; +34 checkout input-validation tests); `npm run lint`
  clean; changed files Prettier-clean.

## Known Gaps

- The ledger evidence-id coupling above is intentional but worth revisiting
  when Phase 2F evidence packs land.
