# 5B.1 — Payments / Marketplace Payments Split

Canonical documentation for the two payment tables in ReconcileKit. They are
separate storage stacks with separate schemas, separate repositories, and
separate writers. They are never merged.

## Two parallel storage stacks

The legacy Paystack path and the marketplace path are independent FK chains.
No foreign key crosses between them.

### Legacy Paystack stack

```
businesses.id  <- products.businessId
businesses.id  <- orders.businessId
orders.id      <- payments.orderId
businesses.id  <- payments.businessId
```

All four tables live in the legacy schema set.

### Marketplace stack

```
marketplace_customers.id  <- marketplace_orders.customerId
marketplace_customers.id  <- marketplace_transactions.customerId
marketplace_orders.id     <- marketplace_transactions.orderId
marketplace_transactions.id <- marketplace_payments.transactionId
marketplace_customers.id  <- marketplace_payments.customerId
```

All five tables live in the marketplace schema set.

`marketplace_payments.orderId` is also populated with the marketplace order id,
but it is a denormalized convenience cache. It is indexed, not an enforced FK.
The canonical link from a marketplace payment to its order is the three-hop
path:

```
marketplace_payments.transactionId
  -> marketplace_transactions.id
  -> marketplace_transactions.orderId
  -> marketplace_orders.id
```

The same value may coincidentally appear in both stacks — the demo seeds both
from the same `DEMO_CUSTOMER_ID` — but they are different tables with different
schemas. Legacy `payments.orderId` points at `orders.id`; marketplace
`marketplace_payments.orderId` is not a legacy order reference.

## `payments` — legacy Paystack

- Repository: `src/db/repositories/payments.ts` — `PaymentRepository`
- Record type: `PaymentRecord` from `src/domain/types.ts`
- Primary key: `payments.id = orders.id` (same value). It is **not** the
  Paystack reference.
- `payments.orderId = orders.id` — same value as `id`, kept for query
  semantics and enforced by the Prisma relation
  `Payment.order @relation(fields: [orderId], references: [id])`.
- `payments.paystackReference` — the actual Paystack reference, a distinct
  non-null field.
- Live production writers:
  - `src/server.ts` — `handleCreateOrder` (legacy create-order path)
  - `src/application/verify-order.ts` — verification, including the
    `readLatestById` lookup before the upsert
- Both were repointed from JSONL to `repos.payments` at 1k.2.
- Parent FK: `payments.orderId -> orders.id` (enforced).

## `marketplace_payments` — marketplace settlement

- Repository: `src/db/repositories/marketplace-payments.ts` —
  `MarketplacePaymentRepository`
- Record type: `MarketplacePaymentRecord` from `src/marketplace/types.ts`
- Primary key: `marketplace_payments.id = mkpay_<stableToken(transactionId)>`.
  The id is deterministic across replays.
- `marketplace_payments.transactionId` — enforced FK to
  `marketplace_transactions.id`.
- `marketplace_payments.customerId` — enforced FK to `marketplace_customers.id`.
- `marketplace_payments.orderId` — denormalized marketplace order id. It is
  indexed but **not an enforced FK**. The canonical order join goes through
  `transactionId -> marketplace_transactions.orderId -> marketplace_orders.id`.
- `marketplace_payments.providerReference` — the provider reference, parallel
  to legacy `paystackReference` but nullable.
- Live production writer: `src/marketplace/transactions.ts`, inside
  `runPaymentAndFulfillment`, reached through
  `executeMarketplaceTransaction`. The record is built with
  `toWalletPaymentRecord` and inserted through
  `deps.repos.marketplacePayments.insert`.
- Migrated to its own Postgres table at 1g.4.

## Why they are separate

Legacy Paystack API shapes are provider-versioned. Marketplace settlements are
canonical domain records. Merging the two would either pollute the canonical
shape with provider-specific fields or lose the Paystack-specific audit trail.

The two-stack split is the FK-level expression of that separation: the
marketplace stack has no knowledge of `businesses`, `products`, `orders`, or
`payments`; the legacy stack has no knowledge of `marketplace_*` tables.
Decision #5 records the “never merged” rule.

## History

The JSONL era overloaded both record shapes onto a single `payments` kind — one
file containing two structures. The Postgres tables were always separate:
`marketplace_payments` was created as its own table in the marketplace schema
migration (1b).

The overload was resolved in two steps:

- 1g.4 migrated the marketplace path to its own Postgres table.
- 1k.2 repointed the legacy JSONL read/write to `repos.payments`.

Post-5B.1e there is no JSONL `payments` kind. The `StoreKind` union and the
`JsonlStore` class were deleted at e.3.

## Comparison table

| aspect               | payments                                             | marketplace_payments                                                         |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| domain               | legacy Paystack                                      | marketplace settlement                                                       |
| primary key          | `payments.id` = `orders.id` (same value)             | `mkpay_<stableToken(transactionId)>`                                         |
| provider ref field   | `paystackReference`                                  | `providerReference`                                                          |
| canonical order link | `payments.orderId -> orders.id` (enforced FK)        | `transactionId -> marketplace_transactions.orderId -> marketplace_orders.id` |
| cached order id      | `payments.orderId` (same as `id`; enforced FK)       | `marketplace_payments.orderId` (denormalized, indexed, not FK)               |
| writer entry         | `handleCreateOrder` (`server.ts`); `verify-order.ts` | `runPaymentAndFulfillment` (`transactions.ts`)                               |
| repository           | `repos.payments`                                     | `repos.marketplacePayments`                                                  |
| migrated to Postgres | 1k.2                                                 | 1g.4                                                                         |
| never merged         | yes                                                  | yes                                                                          |

## Test coverage

- `test/db/repositories/payments.test.ts` — `PaymentRepository` contract
- `test/db/repositories/marketplace-payments.test.ts` —
  `MarketplacePaymentRepository` contract
- `test/server.test.ts` — legacy payment behavior through the HTTP route
- `test/verify-order.test.ts` — legacy verification behavior

## References

- `docs/5b1c-1e-preflight.md` — 5B.1e decomposition, reference inventory, and
  repository audit
- `docs/5b1c-1k-preflight.md` — legacy payments repoint and migration context
- `docs/5b1c-1g4-preflight.md` — marketplace payment migration to Postgres
