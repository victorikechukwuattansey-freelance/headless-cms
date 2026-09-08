# Phase 2 Validation MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first validation marketplace in `storefront/` where every mock digital-service transaction produces ReconcileKit-backed transaction truth, customer timelines, evidence, receipts, and admin resolution views.

**Architecture:** Extend the existing Node/TypeScript storefront around the frozen ReconcileKit boundary. Keep provider-specific behavior in typed adapters, wallet/payment simulation in marketplace application modules, and transaction truth in `reconcileRecords()` plus existing ReconcileKit outcomes. Root ReconcileKit code remains intact unless a failing test proves an explicit domain inconsistency.

**Tech Stack:** Node `>=24.12.0`, TypeScript `7.0.2`, ESM, Node HTTP server, JSONL persistence, `node:test`, existing ReconcileKit package, no real payment/provider credentials.

## Global Constraints

- Do not modify root ReconcileKit domain semantics for the MVP.
- Do not call, scrape, copy, or visually clone BillPoint.
- Do not connect real payment processors, gift-card providers, ticketing providers, FX providers, betting providers, or production credentials.
- Treat every wallet, provider, ticket, gift-card, FX, refund, reversal, and settlement value as simulated.
- Preserve exact-reference matching, integer minor-unit amounts, canonical statuses, duplicate safety, and source-attribute behavior.
- Keep reconciliation logic out of UI routes and browser JavaScript.
- Use provider adapters for every external-service simulation.
- Use the existing project conventions unless a change is explicitly approved.
- Keep existing root tests and storefront tests passing.

---

## A. Current Architecture

### Repository Shape

- Root package `reconcilekit` is a provider-neutral TypeScript reconciliation toolkit.
- `storefront/` is a pilot Node HTTP application with businesses, products, orders, Paystack initiation, Paystack verification, append-only JSONL storage, and a reconciliation endpoint.
- There is no React, Vite, Next.js, database migration layer, ORM, Playwright dependency, or production auth stack in the repository.
- The existing UI surface is minimal HTML in the Paystack callback route, plus JSON APIs.

### Root ReconcileKit Source Of Truth

The root package owns the frozen reconciliation model:

- `src/domain/model.ts`: `MerchantPayment`, `ProviderPayment`, `CanonicalPaymentStatus`, `Outcome`, discrepancy codes, validation code, reports, summaries, and config.
- `src/domain/reconcile.ts`: exact-reference matching, input-error precedence, missing-reference handling, missing/unmatched records, duplicate ambiguity, validation classification, and report summary.
- `src/domain/validation.ts`: amount, currency, status, and timestamp validation.
- `src/domain/reference.ts`: reference normalization and index construction.
- `src/domain/duplicates.ts`: duplicate/conflicting-attribute detection.
- `src/application/reconcile-records.ts`: application boundary that validates the request envelope and calls `reconcile()`.
- `src/adapters/merchant/csv.ts`: merchant CSV adapter.
- `src/adapters/providers/paystack/paystack.ts`: Paystack response mapping to provider-neutral facts.
- `src/adapters/providers/paystack/transport.ts`: explicit live Paystack HTTP transport.

### Existing Storefront Boundary

`storefront/src/domain/types.ts` defines the current pilot entities:

- `Business`
- `Product`
- `Order`
- `PaymentRecord`

`PaymentRecord` is already documented as the canonical storefront boundary to the reconciliation system. It uses root `CanonicalPaymentStatus`, stores expected amount/currency, stores the Paystack reference, and preserves provider facts in `metadata`.

`storefront/src/reconcile/adapter.ts` provides the existing bridge:

```ts
PaymentRecord
  -> buildReconcileBridgeInput()
  -> MerchantPayment[] + ProviderPayment[]
```

`storefront/src/server.ts` exposes:

- `GET /health`
- `POST /businesses`
- `POST /products`
- `POST /orders`
- `POST /orders/:id/verify`
- `GET /callback`
- `GET /reconcile`
- `GET /reconcile/merchant.csv`

`storefront/src/store/jsonl-store.ts` supports append-only JSONL files for `businesses`, `products`, `orders`, and `payments`.

### Architectural Diagnosis

The existing code is strongest at payment-record normalization, integrity checks, exact-reference reconciliation, duplicate safety, and deterministic reports. It is intentionally narrow as a storefront. The MVP should therefore add marketplace orchestration around the existing boundary rather than rewriting ReconcileKit.

## B. Existing Reusable Components

### Reuse As-Is

- `src/domain/model.ts`
- `src/domain/reconcile.ts`
- `src/domain/validation.ts`
- `src/domain/reference.ts`
- `src/domain/duplicates.ts`
- `src/application/reconcile-records.ts`
- `src/adapters/merchant/csv.ts`
- `src/adapters/providers/paystack/paystack.ts`
- `src/adapters/providers/paystack/transport.ts`
- Existing root tests under `src/**`.
- Existing storefront Paystack pilot tests under `storefront/test/**`.

### Reuse With Narrow Extensions

- `storefront/src/domain/types.ts`: add marketplace-facing types only if this keeps the file coherent. Prefer a new `storefront/src/marketplace/types.ts` if the type set grows beyond the legacy Paystack pilot.
- `storefront/src/store/jsonl-store.ts`: extend `StoreKind` with new append-only files for MVP entities.
- `storefront/src/reconcile/adapter.ts`: keep existing functions and add marketplace bridge functions in a nearby file rather than changing existing Paystack behavior.
- `storefront/src/reconcile/view.ts`: reuse `RECONCILE_CONFIG` and outcome summarization patterns.
- `storefront/src/server.ts`: keep existing JSON routes, then add marketplace page and API routing through small handler modules.
- `storefront/src/ids.ts`: reuse `newId()` and add deterministic reference builders for marketplace transactions.
- `storefront/src/config.ts`: add demo-mode config fields with safe defaults.
- `storefront/src/main.ts`: choose mock payment/provider dependencies by default for validation mode while keeping existing Paystack gateway code explicit.

### Avoid Reuse Where It Would Distort The Model

- Do not force ticketing reservations or gift-card delivery into root `ProviderPayment`.
- Do not treat refund, reversal, or settlement lifecycle as root reconciliation outcomes.
- Do not reuse `Business` as `Provider`, `Customer`, or `Organization`.
- Do not reuse Paystack-specific metadata names for generic mock providers.

## C. Existing Reconcile Kit Integration Points

### Current Integration Contract

The marketplace must call:

```ts
reconcileRecords({
  merchantPayments,
  providerPayments,
  config,
  providerSourceAttributes,
});
```

Inputs:

- `merchantPayments`: expected marketplace/payment side facts.
- `providerPayments`: received provider/payment facts when available.
- `config`: explicit `ReconciliationConfig`.
- `providerSourceAttributes`: safe raw provider context aligned one-to-one with `providerPayments`.

Output:

- `ReconciliationReport` with `summary` and `results`.

### Current Storefront Bridge

Existing flow:

```text
PaymentRecord
-> paymentRecordToMerchantPayment()
-> paymentRecordToProviderPayment()
-> buildReconcileBridgeInput()
-> reconcileRecords()
-> buildReconcileView()
```

The MVP should preserve this pattern and add a marketplace bridge:

```text
MarketplaceTransaction + PaymentRecord + ProviderAttempt
-> buildMarketplaceReconcileInput()
-> reconcileRecords()
-> deriveMarketplaceTransactionTruth()
-> timeline/evidence/admin views
```

### Explicit Transaction Boundary Sequence

| Boundary                        | Input                                                                        | Output                                                                                          | Owner                                   | Persistence Responsibility                                                           | Failure Behavior                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Customer                        | Demo identity, selected service, entered checkout fields, selected scenario. | Checkout request.                                                                               | Marketplace UI/application.             | Customer record and request snapshot in marketplace order.                           | Invalid or missing fields stop before payment/provider execution.                                                                     |
| Catalog                         | Service/category ids and checkout request.                                   | Service definition, price, currency, input schema, provider adapter id, compliance status.      | Marketplace catalog.                    | Seeded catalog records.                                                              | Unknown service returns 404; compliance-gated service returns blocked checkout response.                                              |
| Order                           | Customer id, service definition, validated inputs, quote.                    | `MarketplaceOrder` with stable customer reference.                                              | Marketplace application.                | `marketplace_orders` JSONL.                                                          | Order creation failure stops transaction and records no provider facts.                                                               |
| Payment/Wallet                  | Order amount, currency, customer wallet, scenario.                           | Wallet/payment ledger events and expected payment facts.                                        | Marketplace wallet/payment simulation.  | `wallet_ledger` and marketplace payment record.                                      | Insufficient balance or funding failure records wallet failure and skips service provider fulfillment.                                |
| Provider Adapter                | Order, payment authorization result, service-specific request, scenario.     | Provider-neutral `ProviderResult` or timeout event.                                             | Marketplace provider adapter.           | `marketplace_provider_attempts` and transaction events.                              | Timeout records operational event; no fake provider row is created unless facts exist.                                                |
| Provider                        | Mock provider request.                                                       | Simulated raw provider response.                                                                | Mock provider implementation.           | Raw safe attributes persisted through provider attempt/evidence.                     | Scenario controls determine failed, pending, duplicate, mismatch, or unknown response.                                                |
| Provider Response Normalization | Raw provider response or timeout.                                            | Canonical status, provider reference, amount, currency, source attributes.                      | Marketplace adapter.                    | Provider attempt and source attributes.                                              | Malformed simulated facts become provider attempt errors or `UNKNOWN` status according to adapter contract.                           |
| ReconcileKit Bridge             | Marketplace order, payment facts, provider attempts, wallet evidence.        | `MerchantPayment[]`, `ProviderPayment[]`, aligned `SourceAttributes[]`, `ReconciliationConfig`. | Marketplace integration layer.          | Inputs may be persisted as evidence snapshots; ReconcileKit itself does not persist. | Missing provider facts intentionally produce no provider row; duplicates produce duplicate rows only when evidence proves duplicates. |
| ReconcileKit                    | Provider-neutral arrays and config.                                          | `ReconciliationReport` with `MatchResult[]`, outcome counts, discrepancy codes, and notes.      | Root ReconcileKit application/domain.   | No persistence; caller owns report storage.                                          | Throws `ApplicationError` only for bad envelope/config; domain outcomes represent reconciled facts.                                   |
| Transaction State               | Reconciliation report, transaction, wallet, fulfillment, resolution.         | Customer/admin truth view.                                                                      | Marketplace `truth.ts`.                 | `marketplace_transactions` latest state plus evidence.                               | If report is unavailable, transaction is `INTERNAL_REVIEW` and admin-visible.                                                         |
| Evidence                        | Order, wallet, provider attempts, ReconcileKit result, timeline, resolution. | Safe evidence pack.                                                                             | Marketplace evidence builder.           | `evidence_packs` JSONL.                                                              | Evidence generation failure blocks receipt display and creates manual-review event.                                                   |
| Customer Timeline               | Transaction events and truth state.                                          | Ordered timeline with simulated timestamps.                                                     | Marketplace timeline module/UI.         | `transaction_events` JSONL.                                                          | Missing optional events are omitted; ReconcileKit event is required once reconciliation runs.                                         |
| Resolution                      | Failed, mismatched, ambiguous, disputed, refund, or reversal state.          | Refund/reversal/dispute/manual-review transition.                                               | Marketplace resolution module/admin UI. | `refunds`, `reversals`, `disputes`, `manual_reviews`, `wallet_ledger`, events.       | Invalid transition returns 409 and appends no ledger movement.                                                                        |

ReconcileKit owns only the provider-neutral reconciliation boundary: `MerchantPayment`, `ProviderPayment`, validation, duplicate safety, outcomes, discrepancy codes, and `ReconciliationReport`. The marketplace owns catalog, customer identity, wallet simulation, provider orchestration, fulfillment, evidence packaging, UI labels, refunds, reversals, disputes, and admin actions.

### Outcomes To Preserve

- `MATCH`
- `DISCREPANCY`
- `UNRESOLVED`
- `HELD_AMBIGUOUS`
- `INPUT_ERROR`
- `MISSING_PROVIDER_RECORD`
- `UNMATCHED_PROVIDER_RECORD`
- `MISSING_REFERENCE`

Application-facing statuses can be customer-friendly, but they must be derived from these outcomes plus marketplace payment/fulfillment/resolution state.

## D. Required Extensions

### Storefront Extensions

- Marketplace domain types.
- Catalog seed data and query helpers.
- Mock provider contracts and implementations.
- Mock wallet ledger and payment provider.
- Transaction orchestration use case.
- Marketplace-to-ReconcileKit bridge.
- Timeline and evidence generation.
- Receipt rendering.
- Dispute, refund, reversal, and manual-review state machines.
- Demo seed command or route.
- Customer-facing HTML pages and supporting CSS/JS.
- Admin operations HTML pages.
- API endpoints for checkout, transaction detail, dispute actions, refund simulation, admin resolution, and demo reset.
- Tests for every new application path.

### ReconcileKit Root Extensions

No root ReconcileKit source change is recommended for Phase 2. If implementation finds a genuine inconsistency, stop and document:

- why the change is required;
- which existing behavior changes;
- whether an adapter can solve it instead;
- regression risk;
- required root tests.

The current plan assumes the adapter approach is sufficient.

## E. New Marketplace Modules

### Planned File Structure

Create the following files under `storefront/src/marketplace/`:

- `types.ts`: all marketplace domain types and status unions that are not root ReconcileKit types.
- `catalog.ts`: seeded catalog categories, services, mock products, input schema descriptors, and catalog query helpers.
- `customers.ts`: demo customer and authentication-shell helpers.
- `wallet.ts`: mock wallet ledger operations, balance derivation, debit/funding/refund/reversal functions.
- `providers/contracts.ts`: provider request/result contracts and service-specific request shapes.
- `providers/mock-provider.ts`: scenario-driven generic mock provider behavior.
- `providers/registry.ts`: map service/provider ids to adapter implementations.
- `providers/payment-provider.ts`: mock payment authorization, funding, debit, reversal, refund, and settlement provider.
- `transactions.ts`: transaction orchestration use case for checkout and scenario execution.
- `reconcile-bridge.ts`: marketplace transaction/payment/provider facts to `MerchantPayment`, `ProviderPayment`, and source attributes.
- `truth.ts`: derive customer/admin transaction truth from `ReconciliationReport`, fulfillment state, wallet state, and resolution state.
- `timeline.ts`: append and derive transaction timeline events.
- `evidence.ts`: build safe evidence packs, mask simulated codes, and expose audit facts.
- `receipts.ts`: build simulated receipts from transaction truth and evidence.
- `resolution.ts`: dispute, refund, reversal, and manual-review transitions.
- `notifications.ts`: in-app simulated notification generation.
- `operations.ts`: admin queue and metrics derivation.
- `seed.ts`: deterministic demo data seeding for the 16 required scenarios.
- `views.ts`: typed view models for server-rendered pages and JSON APIs.

Create the following files under `storefront/src/ui/`:

- `layout.ts`: shared HTML shell, navigation, escaping helpers, and simulated-data banner.
- `styles.ts`: CSS string served by the Node server or written into pages.
- `customer-pages.ts`: home, login shell, dashboard, wallet, catalog, category, service detail, checkout, transaction detail, receipt, evidence, dispute, notifications, and profile pages.
- `admin-pages.ts`: operations dashboard, queues, transaction detail, evidence/audit view, and resolution forms.
- `client.ts`: small browser JavaScript for scenario selection, form submit, tabs, filters, and reveal controls for masked simulated data.

Modify these existing files:

- `storefront/src/store/jsonl-store.ts`: extend `StoreKind` and `KIND_FILE_NAMES`.
- `storefront/src/server.ts`: delegate new routes to marketplace handlers while preserving existing routes.
- `storefront/src/main.ts`: initialize mock marketplace dependencies and demo mode.
- `storefront/src/config.ts`: add safe demo configuration.
- `storefront/src/ids.ts`: add reference builders such as `buildMarketplaceReference(transactionId)`.
- `storefront/README.md` if present, or create `storefront/README.md`: local/demo run instructions.
- `docs/PRODUCT_ARCHITECTURE.md`: update only if implementation reveals a plan drift.
- `docs/MOCK_PROVIDER_ARCHITECTURE.md`: update provider-contract details after implementation.
- `docs/RECONCILE_KIT_INTEGRATION.md`: update implemented route/module names after implementation.
- `docs/MVP_SCOPE.md`: update completion status after implementation.

Create tests:

- `storefront/test/marketplace/catalog.test.ts`
- `storefront/test/marketplace/wallet.test.ts`
- `storefront/test/marketplace/mock-provider.test.ts`
- `storefront/test/marketplace/payment-provider.test.ts`
- `storefront/test/marketplace/reconcile-bridge.test.ts`
- `storefront/test/marketplace/transactions.test.ts`
- `storefront/test/marketplace/timeline.test.ts`
- `storefront/test/marketplace/evidence.test.ts`
- `storefront/test/marketplace/resolution.test.ts`
- `storefront/test/marketplace/operations.test.ts`
- `storefront/test/marketplace/seed.test.ts`
- `storefront/test/marketplace/server-marketplace.test.ts`

### Marketplace Domain Model

Core type names to define in `storefront/src/marketplace/types.ts` during PHASE 2A:

```ts
import type {
  CanonicalPaymentStatus,
  Outcome,
} from "../../../src/domain/model.ts";

export type MarketplaceServiceKind =
  | "AIRTIME"
  | "DATA"
  | "ELECTRICITY"
  | "CABLE_TV"
  | "INTERNET"
  | "EDUCATION"
  | "GIFT_CARD"
  | "DIGITAL_VOUCHER"
  | "CINEMA_TICKET"
  | "EVENT_TICKET"
  | "BUS_TICKET"
  | "AIRLINE_TICKET"
  | "WALLET_FUNDING"
  | "BETTING";

export type ComplianceStatus = "AVAILABLE" | "MOCK_ONLY" | "COMPLIANCE_GATED";
export type MockProviderScenario =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "TIMEOUT"
  | "DUPLICATE"
  | "PARTIAL_SUCCESS"
  | "REVERSED"
  | "REFUND_PENDING"
  | "REFUND_COMPLETED"
  | "MISMATCH"
  | "UNKNOWN";
export type FulfillmentStatus =
  "NOT_STARTED" | "PENDING" | "FULFILLED" | "FAILED" | "PARTIAL" | "CANCELLED";
export type ResolutionStatus =
  | "NONE"
  | "REFUND_INITIATED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REVERSAL_INITIATED"
  | "REVERSED"
  | "MANUAL_REVIEW"
  | "DISPUTED";
export type CustomerTransactionStatus =
  | "CONFIRMED"
  | "PENDING"
  | "FAILED"
  | "NEEDS_ATTENTION"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REVERSED"
  | "MANUAL_REVIEW";
export type AdminTransactionStatus =
  | "HEALTHY"
  | "PENDING_PROVIDER"
  | "PROVIDER_FAILED"
  | "MISMATCH"
  | "DUPLICATE"
  | "REFUND_QUEUE"
  | "REVERSAL_QUEUE"
  | "MANUAL_REVIEW"
  | "UNRESOLVED";

export interface MarketplaceTransaction {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly reference: string;
  readonly scenario: MockProviderScenario;
  readonly paymentStatus: CanonicalPaymentStatus;
  readonly fulfillmentStatus: FulfillmentStatus;
  readonly reconcileOutcome: Outcome | null;
  readonly resolutionStatus: ResolutionStatus;
  readonly simulated: true;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly demoScenarioName?: string;
}
```

| Entity            | Purpose                                                                                    | Important Fields                                                                                                                                                                                                                          | Relationships                                                                                  | Lifecycle                                                                           | Existing/Reuse/Extend/Create                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog           | Versioned collection of categories and services available in demo mode.                    | `id`, `version`, `name`, `categories`, `services`, `simulated`, `createdAt`.                                                                                                                                                              | Owns categories and service definitions.                                                       | Seeded at boot or demo reset; read by catalog pages and checkout.                   | Create in marketplace layer. No root equivalent exists.                                                                                                                                   |
| Category          | Groups services by product area and compliance state.                                      | `id`, `group`, `name`, `description`, `status`, `sortOrder`.                                                                                                                                                                              | Has many services.                                                                             | Seeded; betting/gaming remains `COMPLIANCE_GATED`.                                  | Create.                                                                                                                                                                                   |
| Service/Product   | Sellable service definition or mock product.                                               | `id`, `categoryId`, `name`, `kind`, `providerAdapterId`, `baseAmount`, `currency`, `inputSchema`, `scenarioDefaults`, `fxQuote`, `complianceStatus`.                                                                                      | Belongs to category, selects provider adapter, creates orders.                                 | Seeded; selected at checkout; not mutated by transaction execution.                 | Extend conceptually from existing `Product`, but create `MarketplaceService` because existing `Product` is merchant/Paystack-pilot specific. Keep legacy `Product` unchanged.             |
| Provider          | External system identity, simulated for MVP.                                               | `id`, `name`, `family`, `mode`, `supportedServiceKinds`, `health`, `latencyProfile`.                                                                                                                                                      | Used by provider registry and service definitions.                                             | Seeded; health metrics derived from transaction attempts.                           | Create.                                                                                                                                                                                   |
| Provider Adapter  | Contract that turns service requests into provider-neutral results.                        | `id`, `providerId`, `serviceKinds`, `execute(request)`, optional `searchAvailability`, `reserve`, `issue`, `cancel`.                                                                                                                      | Called by transaction orchestration; emits provider facts and evidence.                        | Registered at server startup; replaceable by real adapters later.                   | Create. Root ReconcileKit Paystack adapter remains an example, not a shared base class.                                                                                                   |
| Customer          | Demo user using auth shell.                                                                | `id`, `name`, `email`, `phone`, `createdAt`, `isDemo`.                                                                                                                                                                                    | Owns wallet, orders, transactions, notifications, disputes.                                    | Seeded; selected by auth shell; no production auth.                                 | Create.                                                                                                                                                                                   |
| Wallet            | Simulated balance container.                                                               | `id`, `customerId`, `currency`, `openingBalance`, `status`, `simulated`.                                                                                                                                                                  | Has ledger entries; funds orders.                                                              | Seeded; balance derived from ledger entries.                                        | Create.                                                                                                                                                                                   |
| Wallet Ledger     | Append-only wallet event stream.                                                           | `id`, `walletId`, `transactionId`, `type`, `amount`, `currency`, `status`, `reference`, `occurredAt`, `metadata`.                                                                                                                         | Feeds wallet balance, payment facts, timeline, evidence.                                       | Append-only: funding, authorization, debit, refund, reversal.                       | Create. Existing JSONL append pattern should be reused.                                                                                                                                   |
| Order             | Customer intent to buy a service before final truth is known.                              | `id`, `customerId`, `serviceId`, `inputs`, `quotedAmount`, `currency`, `customerReference`, `status`, `createdAt`.                                                                                                                        | Creates transaction and expected payment facts.                                                | Created during checkout; becomes linked to transaction.                             | Extend concept from existing `Order`, but create `MarketplaceOrder` or optional fields in legacy `Order` only if tests remain stable. Least destructive path: new marketplace order kind. |
| Transaction       | Orchestration record tying order, wallet, provider, ReconcileKit, and resolution together. | `id`, `orderId`, `customerId`, `serviceId`, `providerId`, `reference`, `scenario`, `paymentStatus`, `fulfillmentStatus`, `reconcileOutcome`, `resolutionStatus`, `createdAt`, `updatedAt`.                                                | Owns events, evidence, receipt, provider attempts, payments.                                   | Created at checkout; updated after wallet/provider/reconciliation/resolution steps. | Create. Root `MatchResult` is not a marketplace transaction.                                                                                                                              |
| Transaction Event | Timeline/audit entry.                                                                      | `id`, `transactionId`, `type`, `label`, `description`, `occurredAt`, `actor`, `source`, `simulated`, `metadata`.                                                                                                                          | Belongs to transaction and evidence pack.                                                      | Append-only.                                                                        | Create.                                                                                                                                                                                   |
| Payment           | Expected/actual payment facts for ReconcileKit.                                            | `id`, `transactionId`, `walletReference`, `providerReference`, `expectedAmount`, `currency`, `status`, `paidAt`, `refundStatus`, `metadata`.                                                                                              | Can reuse `PaymentRecord` bridge fields; linked to transaction.                                | Created as pending/authorized; updated by wallet/provider facts; fed into bridge.   | Reuse existing `PaymentRecord` semantics. Add `MarketplacePaymentRecord` only if generic fields do not fit `paystackReference`.                                                           |
| Refund            | Simulated money-return workflow.                                                           | `id`, `transactionId`, `amount`, `currency`, `status`, `reason`, `initiatedAt`, `completedAt`, `ledgerReference`.                                                                                                                         | Adds wallet ledger entries, timeline events, evidence.                                         | `NONE -> INITIATED -> PENDING -> COMPLETED` or `FAILED_REVIEW`.                     | Create in application layer; do not add root outcome.                                                                                                                                     |
| Reversal          | Simulated undo of authorization/debit.                                                     | `id`, `transactionId`, `amount`, `currency`, `status`, `reason`, `initiatedAt`, `completedAt`, `ledgerReference`.                                                                                                                         | Adds wallet ledger entries, timeline events, evidence.                                         | `NONE -> INITIATED -> COMPLETED` or `FAILED_REVIEW`.                                | Create in application layer.                                                                                                                                                              |
| Dispute           | Customer support case tied to transaction evidence.                                        | `id`, `transactionId`, `customerId`, `reason`, `status`, `message`, `createdAt`, `updatedAt`, `resolutionNote`.                                                                                                                           | References transaction, evidence, manual review.                                               | `OPEN -> UNDER_REVIEW -> RESOLVED` or `CANCELLED`.                                  | Create.                                                                                                                                                                                   |
| Evidence          | Safe structured proof pack.                                                                | `id`, `transactionId`, `customerReference`, `providerReference`, `paymentReference`, `serviceSnapshot`, `amount`, `currency`, `timelineEventIds`, `providerFacts`, `reconciliation`, `mismatchFlags`, `resolution`, `audit`, `createdAt`. | Built from order, wallet ledger, provider result, ReconcileKit result, timeline, resolution.   | Generated after reconciliation and updated on resolution actions.                   | Create. Root `source_attributes` are included but not sufficient alone.                                                                                                                   |
| Ticket            | Fulfillment artifact for cinema/event/bus/airline.                                         | `id`, `transactionId`, `ticketKind`, `reservationReference`, `issueReference`, `passengerOrAttendee`, `routeOrVenue`, `seat`, `status`, `maskedCode`, `issuedAt`.                                                                         | Linked to ticketing service transaction and evidence.                                          | Search -> availability -> reserve -> issue -> cancel/refund.                        | Create.                                                                                                                                                                                   |
| Gift Card         | Fulfillment artifact for card/voucher orders.                                              | `id`, `transactionId`, `brand`, `region`, `denomination`, `quantity`, `deliveryStatus`, `redemptionStatus`, `maskedCodePreview`, `riskFlags`, `status`.                                                                                   | Linked to digital-goods transaction and evidence.                                              | Order -> payment -> fulfillment -> delivery -> redemption state/refund/dispute.     | Create.                                                                                                                                                                                   |
| Manual Review     | Operator queue item for ambiguity or policy intervention.                                  | `id`, `transactionId`, `reason`, `status`, `assignedTo`, `createdAt`, `resolvedAt`, `operatorNote`.                                                                                                                                       | Created from `HELD_AMBIGUOUS`, unresolved provider state, duplicates, risk flags, or disputes. | `OPEN -> IN_REVIEW -> RESOLVED` or `ESCALATED`.                                     | Create.                                                                                                                                                                                   |

## F. Database/Schema Changes

### MVP Persistence Choice

Use the existing append-only JSONL store for Phase 2. There is no production database in the current repository, and introducing an ORM or migration tool would be a separate dependency decision.

### JSONL StoreKind Extensions

Modify `storefront/src/store/jsonl-store.ts`:

```ts
export type StoreKind =
  | "businesses"
  | "products"
  | "orders"
  | "payments"
  | "marketplace_customers"
  | "marketplace_catalog"
  | "marketplace_orders"
  | "marketplace_transactions"
  | "marketplace_provider_attempts"
  | "wallets"
  | "wallet_ledger"
  | "transaction_events"
  | "evidence_packs"
  | "receipts"
  | "refunds"
  | "reversals"
  | "disputes"
  | "manual_reviews"
  | "notifications";
```

Each kind maps to a separate JSONL file in the data directory.

### Append-Only Invariants

- Updates append a new record with the same `id`; latest wins for entity reads.
- Event streams such as wallet ledger and transaction events remain append-only by unique event id.
- Balance is derived from ledger entries, not stored as a mutable trust source.
- Transaction truth can store the last ReconcileKit outcome for efficient UI, but evidence must preserve the `MatchResult` facts that created it.
- Corrupt JSONL lines continue to be skipped by existing behavior.

### Production Schema Direction

Production database design is deferred, but the JSONL kinds map cleanly to future tables:

- `customers`
- `wallets`
- `wallet_ledger_entries`
- `catalog_categories`
- `catalog_services`
- `orders`
- `transactions`
- `provider_attempts`
- `transaction_events`
- `evidence_packs`
- `receipts`
- `refunds`
- `reversals`
- `disputes`
- `manual_reviews`
- `notifications`

## G. API/Application-Layer Changes

### New Application Use Cases

Create marketplace use cases that can be tested without HTTP:

- `getCatalog()`
- `getCategory(categoryId)`
- `getService(serviceId)`
- `getWallet(customerId)`
- `fundWallet(input)`
- `createMarketplaceOrder(input)`
- `executeMarketplaceTransaction(input)`
- `getTransactionDetail(transactionId)`
- `getReceipt(transactionId)`
- `getEvidence(transactionId)`
- `openDispute(input)`
- `requestRefund(input)`
- `requestReversal(input)`
- `resolveManualReview(input)`
- `seedDemoData(store, options)`
- `resetDemoData(store, options)` if file-safe reset is explicitly implemented through store-aware overwrite mechanics.

### New JSON API Routes

Add routes while keeping the current pilot routes:

- `GET /api/demo/status`
- `POST /api/demo/seed`
- `GET /api/customer`
- `GET /api/wallet`
- `POST /api/wallet/fund`
- `GET /api/catalog`
- `GET /api/catalog/:categoryId`
- `GET /api/services/:serviceId`
- `POST /api/checkout`
- `GET /api/transactions`
- `GET /api/transactions/:transactionId`
- `GET /api/transactions/:transactionId/receipt`
- `GET /api/transactions/:transactionId/evidence`
- `POST /api/transactions/:transactionId/disputes`
- `POST /api/transactions/:transactionId/refund`
- `POST /api/transactions/:transactionId/reversal`
- `GET /api/notifications`
- `GET /api/admin/overview`
- `GET /api/admin/queues/:queue`
- `GET /api/admin/transactions/:transactionId`
- `POST /api/admin/manual-reviews/:reviewId/resolve`

### New Page Routes

Use server-rendered HTML and a small local browser script for validation:

- `GET /`
- `GET /login`
- `GET /dashboard`
- `GET /wallet`
- `GET /catalog`
- `GET /catalog/:categoryId`
- `GET /services/:serviceId`
- `GET /checkout/:serviceId`
- `GET /transactions`
- `GET /transactions/:transactionId`
- `GET /transactions/:transactionId/receipt`
- `GET /transactions/:transactionId/evidence`
- `GET /transactions/:transactionId/dispute`
- `GET /notifications`
- `GET /profile`
- `GET /admin`
- `GET /admin/queues/:queue`
- `GET /admin/transactions/:transactionId`
- `GET /assets/app.css`
- `GET /assets/app.js`

### Error Handling Rules

- Return JSON API errors with `{ error: { code, message } }`, matching existing server style.
- Treat provider timeouts as application/provider events, not as fabricated ReconcileKit discrepancies.
- Treat missing provider rows as `MISSING_PROVIDER_RECORD` when expected payment facts exist and provider facts do not.
- Treat duplicate provider rows as `HELD_AMBIGUOUS`.
- Treat duplicate debits as wallet evidence and, when bridge input contains duplicate expected rows for the same reference, as `HELD_AMBIGUOUS` with `DUPLICATE_MERCHANT_RECORD`.
- Do not expose secrets or full mock codes in API responses unless a route is explicitly a simulated reveal action.

> **Phase 2K annotation:** the two `HELD_AMBIGUOUS` rules above were revised for
> the marketplace pilot by `RECONCILE_KIT_INTEGRATION_DESIGN.md` §8 row 5 and
> open decision #1 (option a): duplicate provider responses for one join key are
> **deduped to `MATCH`** with an app-level `DUPLICATE_PROVIDER_RESPONSE` marker.
> The raw engine `HELD_AMBIGUOUS` path remains unit-covered in the root engine
> but is not reachable from the 16 seeded scenarios. See the 2K deviation
> register (D2, D11) in `PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md`.

## H. Frontend Changes

### Delivery Approach

Implement a usable server-rendered validation app using the existing Node HTTP server. This avoids introducing a frontend framework before approval and fits the current repository. The UI can later be replaced by React without changing the application/use-case layer.

### Customer Screens

- Home: trust-first product promise, simulated-mode notice, entry to catalog and dashboard.
- Authentication shell: demo login selection, no password, clear "simulated account" copy.
- Dashboard: wallet balance, recent transactions, pending/refund/manual-review alerts, catalog shortcuts.
- Wallet: balance, funding simulation, ledger, pending debit, refund/reversal entries.
- Catalog: category groups for core services, digital goods, ticketing, wallet/payment, compliance-gated services.
- Category pages: services filtered by category and provider/scenario badges.
- Service selection: service-specific form fields, amount/price/FX transparency, scenario selector for demo reviewers.
- Checkout: order summary, wallet debit simulation, provider scenario selection, confirmation.
- Transaction confirmation: created transaction id, status, next action link.
- Transaction details: strongest page, with state explanation, timeline, provider response, ReconcileKit determination, money-at-risk statement, next steps.
- Receipt: simulated receipt with masked sensitive artifacts.
- Evidence view: structured facts, source attributes, reconciliation result, mismatch flags, audit trail.
- Refund/reversal tracker: current workflow state and expected next step.
- Dispute/support flow: open dispute with reason and message, see status.
- Notifications: simulated notices generated from transaction state changes.
- Profile/settings: demo profile and mock preferences.

### Admin Screens

- Operations dashboard: transaction volume, state counts, provider latency, provider failures, unresolved queue counts.
- Queue pages: failed, pending, mismatches, duplicates, refunds, reversals, manual review, unresolved.
- Admin transaction detail: customer request, payment facts, provider facts, ReconcileKit result, evidence, audit, action required.
- Resolution controls: simulated refund, reversal, mark reviewed, resolve dispute, add operator note.

### UI Source Of Truth

- Catalog UI reads `catalog.ts` view models.
- Wallet UI reads wallet ledger derivation.
- Timeline UI reads `transaction_events`.
- Reconciliation UI reads `ReconciliationReport`/`MatchResult` persisted or freshly derived through `truth.ts`.
- Evidence UI reads `evidence_packs`.
- Admin queues read `operations.ts` derived metrics.

### Visual Direction

- Communicate trust, clarity, speed, and control.
- Avoid BillPoint branding, layout copying, colors, or implied affiliation.
- Use compact operational UI for admin screens.
- Use clear nontechnical status explanations for customers.
- Label demo data and simulated timestamps.
- Mask sensitive simulated gift-card/ticket codes by default.

## I. Mock Provider Architecture

### Common Scenario Union

```ts
export type MockProviderScenario =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "TIMEOUT"
  | "DUPLICATE"
  | "PARTIAL_SUCCESS"
  | "REVERSED"
  | "REFUND_PENDING"
  | "REFUND_COMPLETED"
  | "MISMATCH"
  | "UNKNOWN";
```

### Common Contracts

```ts
export interface ProviderRequestContext {
  readonly transactionId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly amount: number;
  readonly currency: string;
  readonly customerReference: string;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
  readonly scenario: MockProviderScenario;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ProviderResult {
  readonly providerId: string;
  readonly providerReference: string | null;
  readonly canonicalStatus:
    "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "UNKNOWN";
  readonly amount: number;
  readonly currency: string;
  readonly occurredAt: string | null;
  readonly latencyMs: number;
  readonly scenario: MockProviderScenario;
  readonly rawStatus: string;
  readonly message: string;
  readonly duplicateResults: readonly ProviderResult[];
  readonly evidence: Readonly<Record<string, string>>;
}

export interface ProviderAdapter<Request> {
  readonly id: string;
  readonly providerId: string;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  execute(
    context: ProviderRequestContext,
    request: Request,
  ): Promise<ProviderResult>;
}
```

### Provider Contracts By Service

| Provider     | Request                                                                              | Response                                                    | Provider Reference                              | Provider Status                      | Latency               | Failure                      | Timeout                                             | Duplicate                      | Mismatch                              |
| ------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------ | --------------------- | ---------------------------- | --------------------------------------------------- | ------------------------------ | ------------------------------------- |
| Airtime      | `phoneNumber`, `network`, `amount`, `currency`                                       | Top-up status, fulfilled amount, safe message               | `air_<transaction>` unless missing-ref scenario | Canonical status from scenario       | `latencyMs` in result | `FAILED` with provider code  | Throws/returns timeout event with no provider facts | two provider rows same ref     | amount/status/ref differs             |
| Data         | `phoneNumber`, `network`, `bundleId`, `amount`, `currency`                           | Bundle activation status                                    | `dat_<transaction>`                             | Canonical status                     | Same                  | Same                         | Same                                                | Same                           | bundle amount or status mismatch      |
| Electricity  | `meterNumber`, `disco`, `vendType`, `amount`, `currency`                             | Token or pending vend status, token masked                  | `ele_<transaction>`                             | Canonical status                     | Same                  | Same                         | Same                                                | Same                           | token issued with amount discrepancy  |
| Cable/Pay TV | `smartCardNumber`, `provider`, `packageId`, `amount`, `currency`                     | Subscription status                                         | `cab_<transaction>`                             | Canonical status                     | Same                  | Same                         | Same                                                | Same                           | package or amount mismatch            |
| Internet     | `accountNumber`, `provider`, `packageId`, `amount`, `currency`                       | Subscription activation status                              | `net_<transaction>`                             | Canonical status                     | Same                  | Same                         | Same                                                | Same                           | account/package mismatch in evidence  |
| Education    | `examType`, `candidateName`, `quantity`, `amount`, `currency`                        | PIN delivery status, PIN masked                             | `edu_<transaction>`                             | Canonical status                     | Same                  | Same                         | Same                                                | Same                           | missing PIN/provider ref              |
| Gift Cards   | `brand`, `region`, `denomination`, `quantity`, `recipient`, `currency`               | Fulfillment, delivery, redemption, masked codes, risk flags | `gfc_<transaction>`                             | Payment/fulfillment canonical status | Same                  | delivery failed or risk hold | fulfillment timeout                                 | duplicate fulfillment response | denomination/currency/status mismatch |
| Cinema       | `cinemaId`, `movieId`, `showtimeId`, `seatIds`, `customerName`, `amount`, `currency` | Reservation, issuance, ticket code masked                   | `cin_<transaction>`                             | Reservation/issuance status          | Same                  | issue failed                 | reservation timeout                                 | duplicate issuance             | seat/count/amount mismatch            |
| Events       | `eventId`, `tierId`, `attendees`, `quantity`, `amount`, `currency`                   | Ticket issuance and QR masked                               | `evt_<transaction>`                             | Issuance status                      | Same                  | issue failed                 | issue timeout                                       | duplicate ticket response      | tier/amount mismatch                  |
| Bus          | `origin`, `destination`, `departureId`, `passenger`, `seat`, `amount`, `currency`    | Reservation, operator ref, ticket masked                    | `bus_<transaction>`                             | Reservation/issuance status          | Same                  | reservation failed           | provider timeout                                    | duplicate reservation          | fare/status mismatch                  |
| Airline      | `origin`, `destination`, `flightId`, `passengers`, `fareClass`, `amount`, `currency` | PNR/reservation state, ticket pending/issued                | `airline_<transaction>`                         | Booking status                       | Same                  | booking failed               | availability/booking timeout                        | duplicate PNR response         | fare/currency/status mismatch         |
| Payment      | `customerId`, `walletId`, `amount`, `currency`, `operation`, `transactionId`         | Authorization/debit/fund/refund/reversal/settlement event   | `pay_<transaction>` or wallet ref               | Canonical payment status             | Same                  | authorization/funding failed | no confirmation fact                                | duplicate debit event          | settlement amount/currency mismatch   |

### Real Provider Replacement Rule

A real provider later replaces only `providers/mock-provider.ts` or a specific adapter implementation. It must still return `ProviderResult` and safe source attributes so `reconcile-bridge.ts`, timeline, evidence, and UI remain unchanged.

## J. Mock Wallet/Payment Architecture

### Wallet Lifecycle

```text
SEEDED_BALANCE
-> FUNDING_INITIATED
-> FUNDING_CONFIRMED or FUNDING_FAILED
-> AUTHORIZATION_REQUESTED
-> AUTHORIZATION_APPROVED or AUTHORIZATION_FAILED
-> DEBIT_PENDING
-> DEBIT_SUCCESS or DEBIT_FAILED
-> PROVIDER_FULFILLMENT
-> REVERSAL_INITIATED / REFUND_INITIATED when required
-> REVERSAL_COMPLETED / REFUND_PENDING / REFUND_COMPLETED
-> SETTLEMENT_PENDING / SETTLEMENT_MATCHED / SETTLEMENT_MISMATCH
```

### Ledger Entry Types

```ts
export type WalletLedgerType =
  | "OPENING_BALANCE"
  | "FUNDING_INITIATED"
  | "FUNDING_SUCCESS"
  | "FUNDING_FAILED"
  | "AUTHORIZATION_REQUESTED"
  | "AUTHORIZATION_APPROVED"
  | "AUTHORIZATION_FAILED"
  | "DEBIT_PENDING"
  | "DEBIT_SUCCESS"
  | "DEBIT_FAILED"
  | "DUPLICATE_DEBIT"
  | "REVERSAL_INITIATED"
  | "REVERSAL_COMPLETED"
  | "REFUND_INITIATED"
  | "REFUND_PENDING"
  | "REFUND_COMPLETED"
  | "SETTLEMENT_PENDING"
  | "SETTLEMENT_MATCHED"
  | "SETTLEMENT_MISMATCH";
```

### Balance Derivation

- `OPENING_BALANCE`, `FUNDING_SUCCESS`, `REFUND_COMPLETED`, and `REVERSAL_COMPLETED` increase available balance.
- `DEBIT_SUCCESS` and `DUPLICATE_DEBIT` decrease available balance.
- `DEBIT_PENDING`, `REFUND_PENDING`, and `SETTLEMENT_PENDING` affect pending balances, not confirmed available balance.
- `FUNDING_FAILED`, `AUTHORIZATION_FAILED`, and `DEBIT_FAILED` do not change available balance.
- Every ledger entry carries `transactionId`, `reference`, `amount`, `currency`, `occurredAt`, and `simulated: true`.

### ReconcileKit Relationship

The wallet provides expected payment facts and payment evidence. ReconcileKit compares expected facts against provider/payment facts. Wallet balance logic stays in marketplace code.

## K. Admin/Operations Architecture

### Admin Queues

`operations.ts` derives queues from transactions, ReconcileKit outcomes, wallet events, provider attempts, and resolution state:

- failed transactions
- pending transactions
- reconciliation mismatches
- duplicate detection
- provider failures
- provider latency
- refund queue
- reversal queue
- manual-review queue
- unresolved transactions
- disputes

### Metrics

- Total transactions.
- Volume by category/service/provider/scenario.
- Counts by ReconcileKit outcome.
- Counts by discrepancy code.
- Average and p95 provider latency from simulated provider attempts.
- Refund/reversal counts by status.
- Manual reviews by reason and age.

### Admin Actions

All actions are simulated local state transitions:

- mark manual review in progress;
- resolve manual review with note;
- initiate refund;
- mark refund pending;
- complete refund;
- initiate reversal;
- complete reversal;
- resolve dispute;
- add operator note.

Each admin action appends a transaction event and updates evidence.

## L. Demo/Seed Architecture

### Seed Entry Points

- `POST /api/demo/seed`: seed or reseed demo records in a safe store-aware way.
- `GET /api/demo/status`: show whether seed data exists.
- Server startup may seed when `STOREFRONT_DEMO_MODE=true` and the seed marker is absent.

### Seed Records

Seed:

- one demo customer;
- one NGN wallet with opening balance;
- catalog categories and services;
- mock provider registry records;
- the 16 required transaction scenarios;
- wallet ledger entries for funding, debit, duplicate debit, refund, reversal;
- provider attempts with scenario evidence;
- ReconcileKit-derived truth snapshots;
- transaction events;
- evidence packs;
- receipts;
- disputes/manual reviews where appropriate;
- notifications.

### Required Demo Scenarios

|   # | Scenario                          | Initial State                                              | Simulated Events                                                                                                                                       | Expected ReconcileKit Result                                                                                                                        | Customer-Visible Result                                           | Admin-Visible Result                                       | Evidence Produced                                                            | Expected Final State             |
| --: | --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
|   1 | Successful airtime                | Wallet has sufficient NGN balance; airtime service active. | Order created, wallet authorized, debit success, provider success with matching reference/amount/currency/status, ReconcileKit run.                    | `MATCH`                                                                                                                                             | Confirmed top-up, no money at risk, receipt available.            | Healthy transaction.                                       | Order, debit, provider ref, raw status, `MATCH`, receipt.                    | `COMPLETED`                      |
|   2 | Failed data                       | Wallet funded; data bundle selected.                       | Payment authorized/debited, provider returns `FAILED` for same reference.                                                                              | `DISCREPANCY` with `STATUS_MISMATCH` when expected status is success.                                                                               | Service failed after payment; refund expected.                    | Failed fulfillment/refund queue.                           | Debit, provider failed status, ReconcileKit mismatch, refund recommendation. | `FAILED_REFUND_EXPECTED`         |
|   3 | Pending electricity               | Wallet funded; electricity token service selected.         | Debit pending/success, provider facts absent or delayed, ReconcileKit run with expected side only.                                                     | `MISSING_PROVIDER_RECORD`                                                                                                                           | Provider confirmation missing; transaction under monitoring.      | Pending/unresolved queue.                                  | Order, debit, missing provider note, monitoring event.                       | `PENDING_PROVIDER_CONFIRMATION`  |
|   4 | Provider timeout                  | Wallet funded; cable service selected.                     | Provider request sent, timeout recorded, no provider facts persisted, ReconcileKit run.                                                                | `MISSING_PROVIDER_RECORD`                                                                                                                           | Provider did not confirm yet; money under monitoring.             | Provider timeout queue with latency/failure marker.        | Timeout event, expected payment facts, no provider row.                      | `MONITORING`                     |
|   5 | Duplicate debit                   | Wallet funded; internet service selected.                  | Authorization approved, two debit ledger entries for same transaction, duplicate expected payment rows for same reference in bridge, provider success. | `HELD_AMBIGUOUS` with `DUPLICATE_MERCHANT_RECORD`; wallet evidence shows duplicate debit.                                                           | Possible duplicate debit; manual review required.                 | Duplicate debit/manual-review queue.                       | Both ledger debits, duplicate reference, ambiguity notes.                    | `MANUAL_REVIEW`                  |
|   6 | Provider mismatch                 | Wallet funded; education PIN selected.                     | Provider returns mismatched reference or mismatched amount.                                                                                            | Mismatched reference: `MISSING_PROVIDER_RECORD` plus `UNMATCHED_PROVIDER_RECORD`; amount mismatch: `DISCREPANCY` with `AMOUNT_MISMATCH`.            | Provider details do not match; transaction needs attention.       | Mismatch queue.                                            | Expected ref, provider ref, source attrs, mismatch codes.                    | `NEEDS_ATTENTION`                |
|   7 | Successful gift card              | Wallet funded; gift-card service selected.                 | Debit success, gift-card provider success, masked simulated code delivered.                                                                            | `MATCH`                                                                                                                                             | Gift card delivered; code masked with intentional reveal control. | Healthy digital-goods transaction.                         | Masked code preview, provider ref, delivery status, `MATCH`.                 | `COMPLETED`                      |
|   8 | Gift card fulfillment failure     | Wallet funded; gift-card service selected.                 | Payment/debit succeeds, provider fulfillment fails for same reference.                                                                                 | `DISCREPANCY` with `STATUS_MISMATCH` if expected success.                                                                                           | Payment succeeded but card was not delivered; refund initiated.   | Failed fulfillment and refund queue.                       | Debit, provider failed fulfillment, no full code, refund state.              | `REFUND_INITIATED`               |
|   9 | Cinema ticket success             | Wallet funded; cinema availability exists.                 | Search, seat selection, reservation, debit, issue ticket, ReconcileKit match.                                                                          | `MATCH`                                                                                                                                             | Ticket issued with masked ticket code.                            | Healthy ticketing transaction.                             | Reservation, issue ref, ticket details, `MATCH`.                             | `TICKET_ISSUED`                  |
|  10 | Bus ticket refund                 | Wallet funded; bus route exists.                           | Reservation and payment match, cancellation requested, refund completed to wallet.                                                                     | Original payment `MATCH`; refund state is application-level.                                                                                        | Bus ticket cancelled; refund completed.                           | Refund completed queue/history.                            | Original match, cancellation event, refund ledger entry.                     | `REFUNDED`                       |
|  11 | Airline booking pending           | Wallet funded; airline availability selected.              | Reservation pending, debit pending or success, provider returns `PENDING` for same reference.                                                          | `MATCH` if expected side is also `PENDING`; otherwise `DISCREPANCY` with `STATUS_MISMATCH`. Seed should use expected `PENDING` for pending booking. | Booking still pending; no ticket issued yet.                      | Pending booking queue.                                     | PNR/reservation pending, provider attrs, pending status.                     | `PENDING_ISSUANCE`               |
|  12 | Wallet funding failure            | Wallet funding attempted from mock payment provider.       | Funding initiated, mock payment provider returns failed confirmation, no balance increase.                                                             | `DISCREPANCY` with `STATUS_MISMATCH` when funding expected success.                                                                                 | Wallet funding failed; no debit occurred.                         | Payment failure queue.                                     | Funding attempt, provider failed status, no balance movement.                | `FUNDING_FAILED`                 |
|  13 | Payment success + service failure | Wallet funded; voucher service selected.                   | Wallet/payment succeeds and reconciles, service provider later fails fulfillment.                                                                      | Payment record `MATCH`; fulfillment state failed outside root engine.                                                                               | Money was paid, service failed, refund expected.                  | Clear split between payment truth and fulfillment failure. | Payment `MATCH`, provider failure evidence, refund recommendation.           | `SERVICE_FAILED_REFUND_EXPECTED` |
|  14 | Payment reversal                  | Wallet funded; airtime transaction reversed.               | Debit success, provider reports reversed/unknown, reversal completed in wallet.                                                                        | `UNRESOLVED` with `STATUS_UNRESOLVED` when provider status is `UNKNOWN`.                                                                            | Payment reversed; service not confirmed.                          | Reversal queue/history.                                    | Reversal ledger entry, raw reversed status, unresolved note.                 | `REVERSED`                       |
|  15 | Refund pending                    | Wallet funded; data failure triggers refund.               | Payment/provider mismatch, refund initiated, refund provider returns pending.                                                                          | Original transaction `DISCREPANCY`; refund state application-level `PENDING`.                                                                       | Refund is pending; money expected back.                           | Refund pending queue.                                      | Mismatch result, refund request, pending ledger/event.                       | `REFUND_PENDING`                 |
|  16 | Manual review                     | Wallet funded; duplicate provider responses conflict.      | Provider returns two records same reference with conflicting amount/status, ReconcileKit run.                                                          | `HELD_AMBIGUOUS` with `DUPLICATE_PROVIDER_RECORD` and `CONFLICTING_ATTRIBUTES`.                                                                     | Manual review required; no automatic conclusion.                  | Manual-review queue with evidence and provider rows.       | Duplicate provider facts, source attrs, ambiguity notes.                     | `MANUAL_REVIEW`                  |

> **Phase 2K alignment notes (see `PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md`):
> **
>
> - **Row 5 (duplicate debit):** the pilot dedupes duplicate expectations to
>   `MATCH` + `DUPLICATE_PROVIDER_RESPONSE` (DESIGN §8 row 5, open decision
>   #1a), so the seeded outcome is `CONFIRMED/HEALTHY/COMPLETED`, not
>   `HELD_AMBIGUOUS`/manual review (2K deviation D2).
> - **Row 8 (gift-card fulfilment failure):** no auto-refund is implemented;
>   funds stay at risk under `PROVIDER_FAILED` until an operator refund is run
>   (D4).
> - **Row 11 (airline pending):** seeds `PENDING`; provider PENDING rows are
>   omitted per the §4.4 emission policy, so the engine reports
>   `MISSING_PROVIDER_RECORD` for the held transaction (D6),
>   consistent with DESIGN §8 rows 3/4/10.
> - **Row 12 (wallet funding failure):** funding runs through the wallet layer,
>   outside the marketplace reconcile surface — `/transactions/txn_wallet_funding_failure`
>   is a real 404 (D7).
> - **Row 14 (payment reversal):** both sides `CANCELLED` → engine `MATCH`,
>   wallet reversed (DESIGN §8 row 9) (D9).
> - **Row 16 (manual review):** the seeded scenario reaches `UNRESOLVED` +
>   `TRANSACTION_REQUIRES_REVIEW`; the engine's `HELD_AMBIGUOUS`/duplicate
>   branches are unit-covered but not scenario-reachable (D11).

## M. Testing Strategy

### Commands That Must Remain Green

- Root: `npm run typecheck`
- Root: `npm test`
- Storefront: `npm run typecheck`
- Storefront: `npm test`

### Unit Tests

- Catalog categories include core VTU/bill payment, digital goods, ticketing, wallet/payment, and compliance-gated betting/gaming.
- Compliance-gated service cannot be checked out.
- Wallet balance derivation handles funding, debit, duplicate debit, refund, reversal, pending, and failed entries.
- Mock providers return deterministic facts for each scenario.
- Gift-card evidence masks simulated codes.
- Ticketing provider separates reservation from issuance.
- `truth.ts` maps ReconcileKit outcomes to customer/admin status without changing outcome strings.

### Integration Tests

- Successful marketplace checkout calls provider adapter and ReconcileKit and stores transaction/evidence/timeline.
- Provider failure produces timeline, evidence, mismatch, and refund expectation.
- Provider timeout produces application timeout event plus missing provider record.
- Pending provider confirmation produces `MISSING_PROVIDER_RECORD` or `MATCH` pending according to seeded facts.
- Duplicate provider responses produce `HELD_AMBIGUOUS`.
- Duplicate debit appears in wallet evidence and manual review.
  (Pilot revision per DESIGN decision #1a: duplicate expectations dedupe to
  `MATCH` + `DUPLICATE_PROVIDER_RESPONSE`; see the 2K alignment notes above.)
- Amount mismatch reaches `AMOUNT_MISMATCH`.
- Mismatched provider reference creates missing/unmatched records.
- Refund/reversal state changes append timeline/evidence and do not mutate root ReconcileKit outcomes.

### API Tests

- `GET /catalog` and category/service routes return seeded catalog data.
- `POST /api/checkout` rejects missing fields and compliance-gated services.
- `POST /api/checkout` can execute at least airtime, data, gift-card, cinema, bus, and airline scenarios.
- Transaction detail API includes timeline, evidence summary, ReconcileKit outcome, money-at-risk, and next action.
- Admin overview returns counts and queues.
- Manual-review resolution updates local state and appends audit event.

### Frontend Tests

With current dependencies, use `node:test` HTTP smoke tests that fetch HTML routes and assert important content:

- home page has simulated-data notice;
- catalog page lists all category groups;
- checkout page contains service-specific inputs and scenario selector;
- transaction page includes timeline, provider response, ReconcileKit determination, money-at-risk, and next action;
- evidence page masks gift-card/ticket code material;
- admin page includes queues and ReconcileKit outcome counts.

Browser automation can be added in a later dependency-approved step. Until then, final verification includes manual browser walkthrough plus HTTP route tests.

### End-To-End Demo Tests

- Seed demo data.
- Fetch all 16 seeded transaction details.
- Assert every seeded transaction has:
  - at least one order event;
  - at least one wallet/payment event where applicable;
  - provider event or timeout evidence;
  - ReconcileKit result;
  - customer explanation;
  - admin classification;
  - evidence pack;
  - final state matching the scenario table.

## N. Deployment Considerations

### Local Run

The MVP should run locally with:

```powershell
cd storefront
npm install
npm run typecheck
npm test
npm start
```

Default URL:

```text
http://localhost:8787
```

### Demo Mode

Add safe environment flags:

```text
STOREFRONT_DEMO_MODE=true
STOREFRONT_DATA_DIR=./data
```

No Paystack secret should be required for mock marketplace mode.

### Production Buildability

There is no bundler. Production buildability means:

- TypeScript typecheck passes.
- Tests pass.
- The Node server starts.
- All routes are served from TypeScript source using the existing Node runtime setup.
- Mock mode requires no external credentials.

### Real Integration Slots

Later real integrations should enter through:

- `storefront/src/marketplace/providers/registry.ts`
- `storefront/src/marketplace/providers/contracts.ts`
- `storefront/src/marketplace/providers/payment-provider.ts`
- `storefront/src/marketplace/reconcile-bridge.ts`
- `storefront/src/config.ts`
- existing `storefront/src/paystack/*` for explicit Paystack pilot/live paths.

## O. Implementation Sequence

### PHASE 2A: Foundation/Domain Model

**Files:**

- Create: `storefront/src/marketplace/types.ts`
- Modify: `storefront/src/store/jsonl-store.ts`
- Test: `storefront/test/marketplace/types.test.ts`
- Test: `storefront/test/marketplace/store-kinds.test.ts`

**Interfaces:**

- Produces marketplace entity types listed in the domain model table.
- Produces extended `StoreKind` names for later tasks.

- [ ] **Step 1: Write type/store tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import type { MarketplaceTransaction } from "../../src/marketplace/types.ts";

test("marketplace transaction type supports reconciliation and resolution state", () => {
  const transaction: MarketplaceTransaction = {
    id: "txn_1",
    orderId: "ord_1",
    customerId: "cus_demo",
    serviceId: "airtime_mtn_1000",
    providerId: "mock_vtu",
    reference: "mk_txn_1",
    scenario: "SUCCESS",
    paymentStatus: "SUCCESS",
    fulfillmentStatus: "FULFILLED",
    reconcileOutcome: "MATCH",
    resolutionStatus: "NONE",
    simulated: true,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
  };
  assert.equal(transaction.reference, "mk_txn_1");
  assert.equal(transaction.reconcileOutcome, "MATCH");
});

test("jsonl store accepts marketplace transaction kind", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "rk-marketplace-store-"));
  const store = new JsonlStore(dataDir);
  const transaction: MarketplaceTransaction = {
    id: "txn_1",
    orderId: "ord_1",
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    providerId: "mock_vtu",
    reference: "mk_txn_1",
    scenario: "SUCCESS",
    paymentStatus: "SUCCESS",
    fulfillmentStatus: "FULFILLED",
    reconcileOutcome: "MATCH",
    resolutionStatus: "NONE",
    simulated: true,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
  };
  await store.insert("marketplace_transactions", transaction);
  const stored = await store.readLatestById<MarketplaceTransaction>(
    "marketplace_transactions",
    "txn_1",
  );
  assert.equal(stored?.reference, "mk_txn_1");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern marketplace`

Expected: FAIL because `storefront/src/marketplace/types.ts` and store kinds do not exist.

- [ ] **Step 3: Implement types and store kind mapping**

Create the status unions and interfaces in `types.ts`. Extend `StoreKind` in `jsonl-store.ts` with the schema names in section F.

- [ ] **Step 4: Run focused tests**

Run: `cd storefront; npm test -- --test-name-pattern marketplace`

Expected: PASS for the new foundation tests.

- [ ] **Step 5: Run existing store tests**

Run: `cd storefront; npm test -- test/store.test.ts`

Expected: PASS.

### PHASE 2B: Mock Provider Contracts

**Files:**

- Create: `storefront/src/marketplace/providers/contracts.ts`
- Create: `storefront/src/marketplace/providers/mock-provider.ts`
- Create: `storefront/src/marketplace/providers/registry.ts`
- Test: `storefront/test/marketplace/mock-provider.test.ts`

**Interfaces:**

- Consumes `MockProviderScenario`, service kind, and provider ids from `types.ts`.
- Produces `ProviderAdapter<Request>`, `ProviderRequestContext`, and `ProviderResult`.

- [ ] **Step 1: Write provider scenario tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { executeMockProvider } from "../../src/marketplace/providers/mock-provider.ts";

test("success scenario returns matching provider facts", async () => {
  const result = await executeMockProvider(
    baseContext({ scenario: "SUCCESS", amount: 100000, currency: "NGN" }),
    { phoneNumber: "08030000000", network: "MTN" },
  );
  assert.equal(result.canonicalStatus, "SUCCESS");
  assert.equal(result.amount, 100000);
  assert.equal(result.currency, "NGN");
  assert.ok(result.providerReference?.startsWith("mock_"));
});

test("timeout scenario returns no provider reference and timeout evidence", async () => {
  const result = await executeMockProvider(
    baseContext({ scenario: "TIMEOUT", amount: 50000, currency: "NGN" }),
    { accountNumber: "ACC-1" },
  );
  assert.equal(result.providerReference, null);
  assert.equal(result.evidence.timeout, "true");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern "success scenario|timeout scenario"`

Expected: FAIL because mock provider files do not exist.

- [ ] **Step 3: Implement common contracts and deterministic mock provider**

Implement scenario mapping exactly as section I describes. Use transaction id and scenario to derive deterministic mock references and latency.

- [ ] **Step 4: Add duplicate and mismatch tests**

Assert duplicate scenario returns `duplicateResults.length > 0`; assert mismatch scenario changes amount/reference/status according to explicit metadata.

- [ ] **Step 5: Run provider tests**

Run: `cd storefront; npm test -- --test-name-pattern provider`

Expected: PASS.

### PHASE 2C: Mock Wallet/Payment

**Files:**

- Create: `storefront/src/marketplace/wallet.ts`
- Create: `storefront/src/marketplace/providers/payment-provider.ts`
- Test: `storefront/test/marketplace/wallet.test.ts`
- Test: `storefront/test/marketplace/payment-provider.test.ts`

**Interfaces:**

- Consumes wallet ledger types from `types.ts`.
- Produces balance derivation and payment provider results for transaction orchestration.

- [ ] **Step 1: Write wallet balance tests**

```ts
test("wallet balance applies debit refund and reversal entries", () => {
  const balance = deriveWalletBalance("wallet_1", "NGN", [
    opening("wallet_1", 500000),
    debitSuccess("wallet_1", "txn_1", 100000),
    refundCompleted("wallet_1", "txn_1", 25000),
    reversalCompleted("wallet_1", "txn_2", 50000),
  ]);
  assert.equal(balance.availableMinor, 475000);
  assert.equal(balance.currency, "NGN");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern wallet`

Expected: FAIL because wallet functions do not exist.

- [ ] **Step 3: Implement wallet ledger derivation**

Implement pure functions first. Do not store mutable balances as source of truth.

- [ ] **Step 4: Implement mock payment provider**

Support funding success/failure, authorization success/failure, debit pending/success/failure, duplicate debit, reversal, refund, and settlement mismatch.

- [ ] **Step 5: Run wallet/payment tests**

Run: `cd storefront; npm test -- --test-name-pattern "wallet|payment provider"`

Expected: PASS.

### PHASE 2D: Marketplace Catalog

**Files:**

- Create: `storefront/src/marketplace/catalog.ts`
- Test: `storefront/test/marketplace/catalog.test.ts`

**Interfaces:**

- Consumes `Category` and `MarketplaceService` from `types.ts`.
- Produces catalog query helpers for API, UI, and checkout.

- [ ] **Step 1: Write catalog breadth tests**

```ts
test("catalog includes required category groups and gated betting", () => {
  const catalog = buildDemoCatalog();
  assert.ok(findServiceByKind(catalog, "AIRTIME"));
  assert.ok(findServiceByKind(catalog, "DATA"));
  assert.ok(findServiceByKind(catalog, "ELECTRICITY"));
  assert.ok(findServiceByKind(catalog, "CABLE_TV"));
  assert.ok(findServiceByKind(catalog, "INTERNET"));
  assert.ok(findServiceByKind(catalog, "EDUCATION"));
  assert.ok(findServiceByKind(catalog, "GIFT_CARD"));
  assert.ok(findServiceByKind(catalog, "DIGITAL_VOUCHER"));
  assert.ok(findServiceByKind(catalog, "CINEMA_TICKET"));
  assert.ok(findServiceByKind(catalog, "EVENT_TICKET"));
  assert.ok(findServiceByKind(catalog, "BUS_TICKET"));
  assert.ok(findServiceByKind(catalog, "AIRLINE_TICKET"));
  assert.equal(
    findServiceByKind(catalog, "BETTING")?.complianceStatus,
    "COMPLIANCE_GATED",
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern catalog`

Expected: FAIL because catalog module does not exist.

- [ ] **Step 3: Implement seeded catalog**

Create deterministic services, input schema descriptors, provider adapter ids, demo pricing, and mock FX fields for cross-currency examples.

- [ ] **Step 4: Add checkout gating test**

Assert compliance-gated betting service cannot be passed into checkout.

- [ ] **Step 5: Run catalog tests**

Run: `cd storefront; npm test -- --test-name-pattern catalog`

Expected: PASS.

### PHASE 2E: Transaction Orchestration

**Files:**

- Create: `storefront/src/marketplace/transactions.ts`
- Create: `storefront/src/marketplace/timeline.ts`
- Modify: `storefront/src/ids.ts`
- Test: `storefront/test/marketplace/transactions.test.ts`
- Test: `storefront/test/marketplace/timeline.test.ts`

**Interfaces:**

- Consumes catalog, wallet, provider registry, and store.
- Produces `executeMarketplaceTransaction()` and timeline event records.

- [ ] **Step 1: Write checkout orchestration test**

```ts
test("successful airtime checkout records wallet provider and reconciliation events", async () => {
  const result = await executeMarketplaceTransaction(demoDeps(), {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { phoneNumber: "08030000000", network: "MTN" },
  });
  assert.equal(result.transaction.serviceId, "svc_airtime_mtn");
  assert.ok(result.events.some((event) => event.type === "PAYMENT_AUTHORIZED"));
  assert.ok(
    result.events.some((event) => event.type === "PROVIDER_RESPONSE_RECEIVED"),
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern checkout`

Expected: FAIL because orchestration does not exist.

- [ ] **Step 3: Implement order and transaction creation**

Persist marketplace order, transaction, wallet events, provider attempt, and timeline events. Do not invoke ReconcileKit in this task yet unless the minimal orchestration test needs it.

- [ ] **Step 4: Add failure/timeout orchestration tests**

Assert provider timeout creates `PROVIDER_TIMEOUT` and keeps provider facts absent.

- [ ] **Step 5: Run transaction tests**

Run: `cd storefront; npm test -- --test-name-pattern "checkout|timeline|timeout"`

Expected: PASS.

### PHASE 2F: ReconcileKit Integration

**Files:**

- Create: `storefront/src/marketplace/reconcile-bridge.ts`
- Create: `storefront/src/marketplace/truth.ts`
- Test: `storefront/test/marketplace/reconcile-bridge.test.ts`
- Test: `storefront/test/marketplace/truth.test.ts`
- Modify: `storefront/src/marketplace/transactions.ts`

**Interfaces:**

- Consumes transactions, wallet/payment facts, provider attempts, and `reconcileRecords()`.
- Produces ReconcileKit report-backed transaction truth.

- [ ] **Step 1: Write reconcile bridge tests**

```ts
test("marketplace bridge maps successful transaction to ReconcileKit match input", () => {
  const input = buildMarketplaceReconcileInput(successFixture());
  assert.equal(input.merchantPayments.length, 1);
  assert.equal(input.providerPayments.length, 1);
  assert.equal(input.merchantPayments[0]?.merchant_reference, "mk_txn_1");
  assert.equal(input.providerPayments[0]?.reference, "mk_txn_1");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern "marketplace bridge"`

Expected: FAIL because bridge does not exist.

- [ ] **Step 3: Implement bridge**

Build `MerchantPayment[]`, `ProviderPayment[]`, and aligned source attributes. Use root types directly. Keep provider-specific metadata in source attributes.

- [ ] **Step 4: Implement truth derivation**

Map `MatchResult` plus payment/fulfillment/resolution state into:

```ts
export interface TransactionTruth {
  readonly transactionId: string;
  readonly reconcileOutcome: Outcome;
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
  readonly moneyAtRisk: boolean;
  readonly nextAction: string;
  readonly explanation: string;
}
```

- [ ] **Step 5: Run ReconcileKit integration tests**

Run: `cd storefront; npm test -- --test-name-pattern "bridge|truth|ReconcileKit"`

Expected: PASS.

### PHASE 2G: Timeline/Evidence/Refund/Dispute UX Foundation

**Files:**

- Create: `storefront/src/marketplace/evidence.ts`
- Create: `storefront/src/marketplace/receipts.ts`
- Create: `storefront/src/marketplace/resolution.ts`
- Create: `storefront/src/marketplace/notifications.ts`
- Test: `storefront/test/marketplace/evidence.test.ts`
- Test: `storefront/test/marketplace/resolution.test.ts`
- Test: `storefront/test/marketplace/notifications.test.ts`

**Interfaces:**

- Consumes transaction truth, events, wallet ledger, provider attempts, and ReconcileKit result.
- Produces evidence packs, receipts, refund/reversal/dispute state transitions, and notifications.

- [ ] **Step 1: Write evidence tests**

```ts
test("evidence pack includes reconciliation result and masks gift card codes", () => {
  const pack = buildEvidencePack(giftCardFailureFixture());
  assert.equal(pack.reconciliation.outcome, "DISCREPANCY");
  assert.match(pack.providerFacts.maskedCodePreview ?? "", /^\*\*\*\*/);
  assert.equal(JSON.stringify(pack).includes("FULL-MOCK-CODE"), false);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern evidence`

Expected: FAIL because evidence module does not exist.

- [ ] **Step 3: Implement evidence and receipt builders**

Use safe source attributes, transaction events, and reconciliation result. Do not expose full mock card or ticket codes in list/detail defaults.

- [ ] **Step 4: Implement resolution transitions**

Implement dispute open, refund initiated/pending/completed, reversal initiated/completed, and manual-review resolution. Every transition appends timeline/audit events.

- [ ] **Step 5: Run evidence/resolution tests**

Run: `cd storefront; npm test -- --test-name-pattern "evidence|refund|reversal|dispute|notification"`

Expected: PASS.

### PHASE 2H: Ticketing/Gift-Card Flows

**Files:**

- Modify: `storefront/src/marketplace/providers/contracts.ts`
- Modify: `storefront/src/marketplace/providers/mock-provider.ts`
- Modify: `storefront/src/marketplace/catalog.ts`
- Modify: `storefront/src/marketplace/transactions.ts`
- Test: `storefront/test/marketplace/ticketing.test.ts`
- Test: `storefront/test/marketplace/gift-card.test.ts`

**Interfaces:**

- Consumes provider contracts and catalog services.
- Produces reservation/issuance artifacts for tickets and masked fulfillment artifacts for gift cards.

- [ ] **Step 1: Write ticket reservation/issuance tests**

```ts
test("cinema ticket success separates reservation and issuance evidence", async () => {
  const result = await executeMarketplaceTransaction(demoDeps(), {
    customerId: "cus_demo",
    serviceId: "svc_cinema_ticket",
    scenario: "SUCCESS",
    inputs: { cinemaId: "cinema_1", showtimeId: "show_1", seatIds: ["A1"] },
  });
  assert.ok(result.evidence.ticket?.reservationReference);
  assert.ok(result.evidence.ticket?.issueReference);
});
```

- [ ] **Step 2: Write gift-card masking tests**

Assert gift-card order creates delivery/redemption fields and masks code material.

- [ ] **Step 3: Run tests to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern "ticket|gift"`

Expected: FAIL until flow-specific artifacts exist.

- [ ] **Step 4: Implement flow-specific provider evidence**

Add ticket and gift-card artifact builders in marketplace code, not in ReconcileKit core.

- [ ] **Step 5: Run ticketing/gift-card tests**

Run: `cd storefront; npm test -- --test-name-pattern "ticket|gift"`

Expected: PASS.

### PHASE 2I: Customer And Admin HTTP/UI

**Files:**

- Create: `storefront/src/ui/layout.ts`
- Create: `storefront/src/ui/styles.ts`
- Create: `storefront/src/ui/customer-pages.ts`
- Create: `storefront/src/ui/admin-pages.ts`
- Create: `storefront/src/ui/client.ts`
- Modify: `storefront/src/server.ts`
- Test: `storefront/test/marketplace/server-marketplace.test.ts`
- Test: `storefront/test/marketplace/frontend-smoke.test.ts`

**Interfaces:**

- Consumes marketplace view models and application use cases.
- Produces clickable HTML pages and JSON APIs.

- [ ] **Step 1: Write HTTP route smoke tests**

```ts
test("transaction detail page explains money provider and ReconcileKit result", async () => {
  const app = await startSeededServer();
  const res = await fetch(`${app.url}/transactions/txn_success_airtime`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /What happened to your money/);
  assert.match(html, /Provider response/);
  assert.match(html, /ReconcileKit determination/);
  assert.match(html, /Simulated data/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern "transaction detail page"`

Expected: FAIL because routes/pages do not exist.

- [ ] **Step 3: Implement shared layout and assets**

Serve `/assets/app.css` and `/assets/app.js`. Use escaping helpers for dynamic text.

- [ ] **Step 4: Implement customer pages and APIs**

Add home, login shell, dashboard, wallet, catalog, service detail, checkout, transactions, receipt, evidence, dispute, notifications, and profile.

- [ ] **Step 5: Implement admin pages and APIs**

Add dashboard, queues, transaction detail, evidence/audit, and simulated resolution actions.

- [ ] **Step 6: Run server/UI tests**

Run: `cd storefront; npm test -- --test-name-pattern "server|frontend|admin|catalog page"`

Expected: PASS.

### PHASE 2J: Seed/Demo Scenarios

**Files:**

- Create: `storefront/src/marketplace/seed.ts`
- Modify: `storefront/src/main.ts`
- Modify: `storefront/src/config.ts`
- Test: `storefront/test/marketplace/seed.test.ts`
- Test: `storefront/test/marketplace/demo-scenarios.test.ts`

**Interfaces:**

- Consumes all marketplace modules.
- Produces deterministic seeded data for all 16 required scenarios.

- [ ] **Step 1: Write demo scenario coverage test**

```ts
test("demo seed creates all required validation scenarios", async () => {
  const seeded = await seedDemoData(memoryDemoStore());
  const names = seeded.transactions.map(
    (transaction) => transaction.demoScenarioName,
  );
  assert.deepEqual(
    names.sort(),
    [
      "airline_booking_pending",
      "bus_ticket_refund",
      "cinema_ticket_success",
      "duplicate_debit",
      "failed_data",
      "gift_card_fulfillment_failure",
      "manual_review",
      "payment_reversal",
      "payment_success_service_failure",
      "pending_electricity",
      "provider_mismatch",
      "provider_timeout",
      "refund_pending",
      "successful_airtime",
      "successful_gift_card",
      "wallet_funding_failure",
    ].sort(),
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd storefront; npm test -- --test-name-pattern "demo seed"`

Expected: FAIL because seed module does not exist.

- [ ] **Step 3: Implement deterministic seed data**

Create stable ids for demo scenarios so URLs in docs and tests do not shift between runs.

- [ ] **Step 4: Add per-scenario assertions**

Assert each scenario has expected final state, ReconcileKit outcome, timeline, evidence, and admin classification.

- [ ] **Step 5: Run demo tests**

Run: `cd storefront; npm test -- --test-name-pattern "demo|scenario"`

Expected: PASS.

### PHASE 2K: Testing, Hardening, Documentation, Handover

**Files:**

- Create or modify: `storefront/README.md`
- Modify: `docs/PRODUCT_ARCHITECTURE.md`
- Modify: `docs/MOCK_PROVIDER_ARCHITECTURE.md`
- Modify: `docs/RECONCILE_KIT_INTEGRATION.md`
- Modify: `docs/MVP_SCOPE.md`
- Modify: `docs/ASSUMPTIONS_AND_GAPS.md`

**Interfaces:**

- Consumes completed implementation.
- Produces runbook, demo guide, extension guide, and final validation report.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm run typecheck
npm test
cd storefront
npm run typecheck
npm test
```

Expected: all commands PASS.

- [ ] **Step 2: Start local server**

Run:

```powershell
cd storefront
$env:STOREFRONT_DEMO_MODE="true"
npm start
```

Expected: server listens on `http://localhost:8787` and requires no Paystack secret for mock marketplace flows.

- [ ] **Step 3: Manual demo walkthrough**

Open the app and verify:

- dashboard loads;
- catalog breadth is visible;
- checkout works for airtime, gift card, cinema ticket, bus ticket, airline pending, and data failure;
- transaction detail shows timeline/evidence/ReconcileKit outcome;
- receipt and evidence routes work;
- admin dashboard queues include mismatch, pending, duplicate, refund, reversal, and manual review.

- [ ] **Step 4: Update docs**

Document local run, demo mode, transaction lifecycle, provider adapter extension, ReconcileKit invocation, refund/reversal simulation, known limitations, and production blockers.

- [ ] **Step 5: Prepare final handover**

Summarize built scope, reused ReconcileKit modules, extended modules, untouched files, BillPoint baseline status, exceeding-baseline transparency features, mock providers, tested scenarios, limitations, production blockers, real integration locations, and recommended next phase.

## P. Risks And Unresolved Decisions

### Highest-Risk Architectural Decision

The highest-risk decision is how to represent non-payment fulfillment truth, especially ticket issuance and gift-card delivery, without overloading the root payment-focused ReconcileKit model. The plan resolves this by keeping ReconcileKit responsible for payment/provider transaction facts and keeping fulfillment/resolution truth in marketplace evidence and timelines. This is least destructive, but it must be communicated clearly in UI copy and tests.

### Change Impact For Root ReconcileKit

No root ReconcileKit modifications are recommended now.

If a later task proposes a root change, the implementer must add a written impact note before coding:

- Required reason: a concrete failing scenario cannot be represented with adapters or marketplace state.
- Existing behavior affected: exact files, functions, outcomes, and tests.
- Adapter alternative: why bridge/source attributes/application state cannot solve it.
- Regression risk: impact on exact-reference matching, duplicate safety, Paystack mapping, CLI, and existing reports.
- Tests required: failing root unit/integration tests plus storefront regression tests.

### Unresolved Decisions Requiring Approval

1. Whether to keep Phase 2 UI server-rendered in Node or approve a React/Vite dependency and build step.
2. Whether demo reset may truncate JSONL files, or whether seeding should append versioned deterministic records only.
3. Whether marketplace payments should extend existing `PaymentRecord` with generic provider fields or create `MarketplacePaymentRecord` while keeping the old Paystack pilot untouched.
4. Whether pending scenarios should set expected status to `PENDING` for a `MATCH` pending result or expected status to `SUCCESS` for a `STATUS_MISMATCH`; the seed table names the intended choice per scenario.
5. Whether to expose a simulated "reveal code" action for gift cards/tickets or keep all code-like values masked in the MVP.
6. Whether to perform live BillPoint research in a later phase before any public baseline claims.

### Files/Modules Expected To Change

- `storefront/src/store/jsonl-store.ts`
- `storefront/src/server.ts`
- `storefront/src/main.ts`
- `storefront/src/config.ts`
- `storefront/src/ids.ts`
- New `storefront/src/marketplace/**`
- New `storefront/src/ui/**`
- New `storefront/test/marketplace/**`
- `storefront/README.md`
- Implementation-status updates to docs under `docs/`

### Files/Modules That Should Remain Untouched

- `src/domain/model.ts`
- `src/domain/reconcile.ts`
- `src/domain/validation.ts`
- `src/domain/reference.ts`
- `src/domain/duplicates.ts`
- `src/application/reconcile-records.ts`
- `src/adapters/merchant/csv.ts`
- `src/adapters/providers/paystack/paystack.ts`
- `src/adapters/providers/paystack/transport.ts`
- Existing tests except for additive tests or mechanical import-path adjustments caused by explicitly approved changes.

### BillPoint Baseline Implementation Mapping

| Capability Area  | Implementation Required                                          | Existing Support                     | New Work Required                                  | ReconcileKit Differentiation                                | Can Exceed Baseline In MVP |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- | -------------------------- |
| Airtime          | Catalog service, checkout, provider adapter, transaction detail. | Reconcile engine and bridge pattern. | Service definition, mock provider, UI, tests.      | Shows provider facts, status, evidence, and reconciliation. | Yes                        |
| Data             | Same as airtime with bundle inputs.                              | Reconcile engine and bridge pattern. | Bundle form, mock data adapter, failure scenarios. | Explains failed provider result after debit.                | Yes                        |
| Electricity      | Meter/token inputs and pending/token evidence.                   | Reconcile engine.                    | Token evidence masking and pending flow.           | Missing provider confirmation is explicit.                  | Yes                        |
| Cable/Pay TV     | Smart-card/package flow.                                         | Reconcile engine.                    | Mock subscription adapter and UI.                  | Delayed provider/timeout timeline.                          | Yes                        |
| Internet         | Account/package flow.                                            | Reconcile engine.                    | Mock subscription adapter and UI.                  | Duplicate debit and settlement evidence.                    | Yes                        |
| Education        | Exam/PIN flow.                                                   | Reconcile engine.                    | Mock PIN adapter and masking.                      | Missing ref/mismatch evidence.                              | Yes                        |
| Gift cards       | Brand/region/denomination/quantity/order/delivery.               | Reconcile engine only.               | First-class digital-goods model and masking.       | Separates payment truth from fulfillment truth.             | Yes                        |
| Digital vouchers | Voucher service and fulfillment.                                 | Reconcile engine only.               | Generic digital product adapter.                   | Evidence-backed fulfillment.                                | Yes                        |
| Cinema tickets   | Search, availability, seat, reservation, issue.                  | Reconcile engine only.               | Ticketing model and mock provider.                 | Payment/issuance timeline.                                  | Yes                        |
| Event tickets    | Event/tier/attendee/issue.                                       | Reconcile engine only.               | Event provider and UI.                             | Evidence and dispute path.                                  | Yes                        |
| Bus tickets      | Route/passenger/seat/refund.                                     | Reconcile engine only.               | Bus provider and refund flow.                      | Cancellation/refund tracker.                                | Yes                        |
| Airline tickets  | Availability/passenger/reservation/pending issue.                | Reconcile engine only.               | Airline provider and pending flow.                 | Pending booking explanation.                                | Yes                        |
| Wallet           | Mock balance, funding, debit, ledger.                            | JSONL append-only pattern.           | Wallet ledger and payment provider.                | Money-at-risk explanation tied to evidence.                 | Yes                        |
| Receipts         | Receipt page and data model.                                     | Existing payment records.            | Receipt builder/UI.                                | Receipt includes reconciliation result.                     | Yes                        |
| Support/dispute  | Dispute state and admin resolution.                              | None.                                | Dispute model/UI/actions.                          | Dispute uses evidence pack.                                 | Yes                        |
| Refund/reversal  | Application-level simulation.                                    | Dormant `refundStatus` type.         | Resolution workflows and ledger entries.           | Shows expectation, status, and evidence.                    | Yes                        |
| Notifications    | In-app simulated notices.                                        | None.                                | Notification generation/view.                      | Notices explain transaction truth changes.                  | Yes                        |
| Account          | Demo auth shell/profile.                                         | None.                                | Customer/profile pages.                            | Trust copy and simulated-data clarity.                      | Yes                        |
| Admin operations | Queues/metrics/detail/actions.                                   | Reconcile reports.                   | Operations module/UI.                              | Internal determination and action required.                 | Yes                        |

The BillPoint-specific evidence remains `UNKNOWN - REQUIRES RESEARCH` per `docs/BILLPOINT_PARITY_MATRIX.md`; "exceed" here means the MVP intentionally exceeds a generic marketplace baseline through transparency, not a verified BillPoint claim.

### Trust/Transparency Feature Mapping

| Feature                     | Implementation Requirement                                                      | Source Of Truth                                                                             |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Transaction timeline        | Append customer/payment/provider/reconcile/resolution events.                   | `transaction_events` JSONL plus deterministic event builders.                               |
| Transaction state           | Derive customer/admin state from outcome, payment, fulfillment, and resolution. | `truth.ts` using `ReconciliationReport`, transaction, wallet, provider attempt, resolution. |
| Provider response           | Store safe normalized provider result and source attrs.                         | `marketplace_provider_attempts` and `ProviderResult`.                                       |
| Payment state               | Show wallet authorization/debit/funding status.                                 | `wallet_ledger` and marketplace payment record.                                             |
| Reconciliation result       | Show ReconcileKit outcome/codes/notes.                                          | `reconcileRecords()` output.                                                                |
| Mismatch detection          | Use root discrepancy codes.                                                     | `MatchResult.discrepancy_codes`.                                                            |
| Evidence pack               | Build structured safe evidence from all facts.                                  | `evidence.ts` from order, wallet, provider, ReconcileKit, events.                           |
| Refund tracking             | Simulated lifecycle and ledger entries.                                         | `refunds`, `wallet_ledger`, `transaction_events`.                                           |
| Reversal tracking           | Simulated lifecycle and ledger entries.                                         | `reversals`, `wallet_ledger`, `transaction_events`.                                         |
| Dispute workflow            | Customer dispute and admin resolution state.                                    | `disputes`, `manual_reviews`, `transaction_events`.                                         |
| Manual review               | Queue from ambiguity, duplicates, disputes, risk flags.                         | `manual_reviews` plus ReconcileKit `HELD_AMBIGUOUS`.                                        |
| Provider health/latency     | Derived metrics from provider attempts.                                         | `marketplace_provider_attempts.latencyMs` and scenario.                                     |
| Customer-facing explanation | Nontechnical copy generated from truth state.                                   | `truth.ts` mapping, not UI-invented reconciliation.                                         |

### Recommended Implementation Sequence

Proceed in this order:

1. PHASE 2A: Foundation/domain model.
2. PHASE 2B: Mock provider contracts.
3. PHASE 2C: Mock wallet/payment.
4. PHASE 2D: Marketplace catalog.
5. PHASE 2E: Transaction orchestration.
6. PHASE 2F: ReconcileKit integration.
7. PHASE 2G: Timeline/evidence/refund/dispute UX foundation.
8. PHASE 2H: Ticketing/gift-card flows.
9. PHASE 2J: Seed/demo scenarios.
10. PHASE 2I: Customer/admin HTTP/UI.
11. PHASE 2K: Testing, hardening, documentation, handover.

This slightly moves seed data before final UI completion so UI pages can be built against realistic seeded records.

### Exact First Implementation Task

Create `storefront/src/marketplace/types.ts`, extend `storefront/src/store/jsonl-store.ts` with marketplace store kinds, and add focused tests under `storefront/test/marketplace/` proving the new marketplace transaction and store-kind foundation compiles without changing root ReconcileKit.
