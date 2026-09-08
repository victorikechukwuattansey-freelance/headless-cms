# PHASE 2J Implementation Report — Seed / Demo Scenarios

**Phase:** PHASE 2J (Seed/Demo Scenarios)
**Status:** Complete
**Date:** 2026-09-07

## Summary

Implement the deterministic demo seed for the storefront so every canonical
validation scenario can be reproduced on demand through the **application
layer** (`executeMarketplaceTransaction` + `reconcileMarketplaceTransaction` +
`fundWallet`), exposed to normal tooling via friendly reference aliases, and
turned on with a single config flag. The seed store is indistinguishable in
shape from a real-use store: same ids, same ledger, same events, same
evidence packs.

## Files

**Created**

- `storefront/src/marketplace/demo-scenarios.ts` — scenario metadata + pure,
  deterministic id/reference builders.
  - `DEMO_SCENARIO_NAMES` (16 canonical slugs), `DemoScenarioName`,
    `WALLET_FUNDING_SCENARIO_NAME`.
  - `DEMO_ORDER_SCENARIOS` (15 orderable metadata rows: `customerId`,
    `serviceId`, `scenario`, exact `inputs` — all checked against the
    catalog), `demoMarketplaceSeed`, `demoTransactionId`,
    `demoTransactionReference` (`mk_txn_<token>` / `txn_<token>`).
  - `resolveDemoAlias`, `demoAliasFor`, `ResolvedDemoAlias` — the friendly
    alias contract (`txn_<slug>` → canonical id + reference).
- `storefront/src/marketplace/seed.ts` — `seedDemoData`, `seedOrderScenario`,
  `seedWalletFundingFailure`, `SeededDemoData` / `SeededOrderEntry` /
  `SeededWalletFundingEntry`, `SeededDemoEntry`.
  - Fixed timestamp `DEMO_SEED_TIMESTAMP = WALLET_FIXED_TIMESTAMP`
    (`2026-01-01T12:00:00.000Z`).
  - Funding constants: `cus_demo_wallet_funding`, `wl_demo_wallet_funding`,
    `fund_wallet_funding_demo`, 25_000 NGN attempt on a 100_000 NGN opening
    balance.
  - Deterministic friendly-name override (append-only, latest-wins per
    transaction) so reruns converge.
  - Guarded funding: no second attempt once a ledger entry for the
    deterministic wallet/transaction pair exists.

**Modified**

- `storefront/src/ui/client.ts` — `findTransactionByIdentifier` now resolves
  the reference alias first (`resolveDemoAlias`) and then matches the
  canonical id or reference; aliases work pre-seed (lookup returns nothing
  until the scenarios are actually seeded).
- `storefront/src/config.ts` — `seedDemo` boolean parsed from
  `STOREFRONT_SEED_DEMO` (`1` / `true` / `yes`, case-insensitive, trimmed).
- `storefront/src/main.ts` — seeds all 16 scenarios before the server starts
  when `config.seedDemo` is set, then logs
  `demo data seeded: 16 canonical scenarios available`.
- `storefront/test/config.test.ts` — 4 new cases covering the flag defaults,
  truthy, and falsy values.
- `storefront/test/marketplace/seed.test.ts` — **created** (plan step 1
  verbatim-test rerouted to a temp-dir `JsonlStore`, `tempStore(t)`):
  exact 16-name coverage, stable unique identities + persisted friendly
  names, alias resolution through `findTransactionByIdentifier`,
  idempotency / no duplicate money movement across repeated runs, funding
  guard semantics and balance integrity.
- `storefront/test/marketplace/demo-scenarios.test.ts` — **created**:
  pure alias resolution, plus per-scenario observable assertions on final
  state, ReconcileKit outcome, money-at-risk, order status, wallet ledger,
  artifacts, and timeline events.

## Scenario → Deterministic Outcome

| Scenario                        | Payment   | Fulfillment | Resolution     | Customer        | Admin            | Order            | ReconcileKit            | Money at risk | Distinctive marker                                                           |
| ------------------------------- | --------- | ----------- | -------------- | --------------- | ---------------- | ---------------- | ----------------------- | ------------- | ---------------------------------------------------------------------------- |
| successful_airtime              | SUCCESS   | FULFILLED   | NONE           | CONFIRMED       | HEALTHY          | COMPLETED        | MATCH                   | no            | `TRANSACTION_FULFILLED`, `DEBIT_SUCCESS`                                     |
| failed_data                     | SUCCESS   | FAILED      | NONE           | NEEDS_ATTENTION | PROVIDER_FAILED  | FAILED           | DISCREPANCY             | yes           | gift-event trail on data/fulfillment                                         |
| pending_electricity             | PENDING   | PENDING     | NONE           | PENDING         | PENDING_PROVIDER | PROVIDER_PENDING | MISSING_PROVIDER_RECORD | yes           | `DEBIT_PENDING` hold                                                         |
| provider_timeout                | PENDING   | PENDING     | NONE           | PENDING         | PENDING_PROVIDER | PROVIDER_PENDING | MISSING_PROVIDER_RECORD | yes           | `PROVIDER_TIMEOUT` event, no provider facts                                  |
| duplicate_debit                 | SUCCESS   | FULFILLED   | NONE           | CONFIRMED       | HEALTHY          | COMPLETED        | MATCH                   | no            | `DUPLICATE_PROVIDER_RESPONSE` event                                          |
| provider_mismatch               | SUCCESS   | PENDING     | NONE           | NEEDS_ATTENTION | MISMATCH         | (open)           | DISCREPANCY             | yes           | `PROVIDER_AMOUNT_MISMATCH`                                                   |
| successful_gift_card            | SUCCESS   | FULFILLED   | NONE           | CONFIRMED       | HEALTHY          | COMPLETED        | MATCH                   | no            | artifact DELIVERED, masked code preview                                      |
| gift_card_fulfillment_failure   | SUCCESS   | FAILED      | NONE           | NEEDS_ATTENTION | PROVIDER_FAILED  | FAILED           | DISCREPANCY             | yes           | artifact FAILED, code stays masked                                           |
| cinema_ticket_success           | SUCCESS   | FULFILLED   | NONE           | CONFIRMED       | HEALTHY          | COMPLETED        | MATCH                   | no            | ticket ISSUED, masked code, `TICKET_ISSUED`                                  |
| bus_ticket_refund               | SUCCESS   | CANCELLED   | REFUNDED       | REFUNDED        | HEALTHY          | CANCELLED        | MATCH                   | no            | `REFUND_INITIATED`+`REFUND_PENDING`+`REFUND_COMPLETED`                       |
| airline_booking_pending         | PENDING   | PENDING     | NONE           | PENDING         | PENDING_PROVIDER | PROVIDER_PENDING | MISSING_PROVIDER_RECORD | yes           | ticket artifact PENDING, reservation ref, no issue                           |
| payment_success_service_failure | SUCCESS   | FAILED      | NONE           | NEEDS_ATTENTION | MISMATCH         | FAILED           | DISCREPANCY             | yes           | `PROVIDER_FAILED` + `GIFT_CARD_FULFILLMENT_FAILED`                           |
| payment_reversal                | CANCELLED | CANCELLED   | REVERSED       | REVERSED        | HEALTHY          | CANCELLED        | MATCH                   | no            | `REVERSAL_COMPLETED` ledger + event, balance restored                        |
| refund_pending                  | PENDING   | PENDING     | REFUND_PENDING | REFUND_PENDING  | REFUND_QUEUE     | (open)           | DISCREPANCY             | yes           | `REFUND_PENDING` ledger + event, funds held                                  |
| manual_review                   | SUCCESS   | PENDING     | NONE           | NEEDS_ATTENTION | UNRESOLVED       | MANUAL_REVIEW    | UNRESOLVED              | yes           | `TRANSACTION_REQUIRES_REVIEW` + `RECONCILE_REQUIRES_REVIEW`                  |
| wallet_funding_failure          | —         | —           | —              | —               | —                | —                | —                       | no            | ledger `FUNDING_INITIATED`+`FUNDING_FAILED`, balance unchanged (100 000 NGN) |

All timestamps, ids (`mk_txn_*`), references (`txn_*`), wallet ids, ledger
entries, and event timelines are fully deterministic across runs.

## Friendly Aliases

The 15 orderable scenarios expose `txn_<slug>` aliases that resolve through
the normal transaction lookup (`findTransactionByIdentifier`), e.g.
`txn_successful_airtime` → `mk_txn_<token>` (canonical id) +
`txn_<token>` (reference). Safe to reference from docs/tests; they resolve
only after the seed has actually run. `wallet_funding_failure` intentionally
has no alias (no marketplace transaction).

## Config / Usage

Enable seeding with the config flag:

```powershell
$env:STOREFRONT_SEED_DEMO = "1"; node src/main.ts
# or in .env: STOREFRONT_SEED_DEMO=1
```

On start the server logs `demo data seeded: 16 canonical scenarios
available` and all 16 scenarios are browsable/lookup-able in the UI with
stable ids.

## Validation

- `storefront` `npm run typecheck` — PASS
- `storefront` `npm test` — **352/352 PASS** (includes 21 new seed/demo
  tests and all pre-existing regression tests)
- Root `npm run typecheck`, `npm run lint`, `npm run format:check` — PASS

## Deviations From the Plan Table (engine behavior, not defects)

The mock provider scenarios produce the deterministic states documented
above, which differ in three spots from the idealized plan table:

1. **duplicate_debit** — the provider-duplicate response is de-duplicated
   benignly by the orchestrator: single `DEBIT_SUCCESS`, no
   `DUPLICATE_DEBIT` ledger, no `HELD_AMBIGUOUS`. The canonical observable
   marker is the `DUPLICATE_PROVIDER_RESPONSE` timeline event and a clean
   MATCH/HEALTHY completion (test asserts no double debit).
2. **payment_success_service_failure** — the engine classifies the failed
   voucher fulfillment as an **AMOUNT_MISMATCH** (admin `MISMATCH`), not
   `STATUS_MISMATCH`/`PROVIDER_FAILED`, because the payment record settles
   while the service produced no fulfilled value; `moneyAtRisk` is still
   true and the customer sees `NEEDS_ATTENTION`.
3. **bus_ticket_refund** — the ticketing flow completes the refund without a
   cancellation event (`REFUND_INITIATED → REFUND_PENDING →
REFUND_COMPLETED`); order status ends `CANCELLED`.

Funding ledger is two rows per attempt (`FUNDING_INITIATED` +
`FUNDING_FAILED`), so the guard counts the transaction-pair, not a single
row.

## Protection Notes

- No changes to `reconcilekit/src/**` (core engine) or Paystack
  `PaymentRecord` semantics.
- `transactions.ts`, `reconcile.ts`, `truth.ts`, `wallet.ts`, `timeline.ts`,
  `types.ts` are read-only in this phase; seed reuses them as public APIs.
- The only change to existing storefront source is the alias-resolution
  branch in `findTransactionByIdentifier` (pure, additive) and the
  `seedDemo` config flag.
- Nothing committed; work is on the working tree (untracked `reconcilekit/`
  alongside unrelated in-progress workspace projects).

## Next

Phase 2K (Testing, Hardening, Documentation, Handover) — **not started**.
