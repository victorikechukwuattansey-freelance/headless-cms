# Product Architecture

## Purpose

This document describes how the existing ReconcileKit repository should become the foundation of a validation MVP for a trust-first digital services marketplace.

The product promise is:

```text
Do not just process my transaction. Show me exactly what happened.
```

The marketplace should sell or simulate a broad catalog of digital services, but every service transaction must flow through a common transaction-truth architecture backed by the existing ReconcileKit reconciliation engine.

## Repository Evidence

The existing repository contains two major surfaces:

- Root ReconcileKit package: a local-first TypeScript reconciliation toolkit and CLI.
- `storefront/`: a pilot HTTP app that creates businesses, products, orders, Paystack payment attempts, payment records, and expected-vs-received reconciliation views.

Important existing files:

- `src/domain/model.ts`: provider-neutral domain model, outcomes, canonical statuses, reconciliation report types.
- `src/domain/reconcile.ts`: deterministic reconciliation engine.
- `src/domain/validation.ts`: amount, currency, status, timestamp, and input validation.
- `src/domain/duplicates.ts`: duplicate/conflicting-attribute detection.
- `src/application/reconcile-records.ts`: application boundary that delegates to the domain engine.
- `src/adapters/merchant/csv.ts`: merchant CSV adapter.
- `src/adapters/providers/paystack/paystack.ts`: Paystack response to provider-neutral `ProviderPayment` mapping.
- `src/adapters/providers/paystack/transport.ts`: explicit live Paystack fetch transport.
- `storefront/src/domain/types.ts`: storefront `Business`, `Product`, `Order`, and `PaymentRecord` boundary.
- `storefront/src/application/verify-order.ts`: payment verification use case with reference, amount, and currency integrity checks.
- `storefront/src/reconcile/adapter.ts`: `PaymentRecord` to ReconcileKit merchant/provider inputs.
- `storefront/src/reconcile/view.ts`: expected-vs-received view over ReconcileKit results.
- `storefront/src/server.ts`: minimal HTTP API for businesses, products, orders, callback, verification, and reconciliation.

The architecture and domain documents mark the reconciliation architecture as frozen for the current toolkit. The MVP must adapt to it rather than rewriting it.

## Existing Invariants To Preserve

The marketplace MVP must preserve these ReconcileKit rules:

- Exact reference matching is the only current matching strategy.
- Monetary amounts are integer minor units with explicit currency.
- Provider-specific behavior belongs in adapters, not the domain engine.
- The engine never arbitrarily pairs duplicate candidates.
- Missing references, missing provider records, unmatched provider records, input errors, unresolved validations, discrepancies, and ambiguity are separate outcomes.
- Multiple discrepancy codes are preserved.
- `UNKNOWN` status is not a successful status match.
- Missing status is different from `UNKNOWN`.
- Timestamp validation is configurable and never a matching key.
- Operational failures, such as provider network errors, are not reconciliation outcomes.
- Secrets are not domain data, report data, or logs.

> **Phase 2K annotation:** the marketplace pilot adds one _application-level_
> difference without touching the engine: duplicate expectations for one join
> key are deduped by the bridge (one expected row, `MATCH` plus an app-level
> `DUPLICATE_PROVIDER_RESPONSE` marker) per `RECONCILE_KIT_INTEGRATION_DESIGN.md`
> §8 row 5 / open decision #1a. The engine's `HELD_AMBIGUOUS` behavior is
> unchanged and remains unit-covered. The internal operations dashboard (below)
> ships as a **simulated admin shell** — no production authentication (Phase 2I
> banner). Wallet funding simulation (duplicate/failed/pending) runs in the
> wallet layer, outside the marketplace reconcile surface.

## Product Shape

The validation MVP should be a local-first marketplace application with:

- Customer-facing catalog and checkout.
- Mock wallet and payment authorization.
- Mock service providers behind provider adapters.
- ReconcileKit-backed transaction truth.
- Transaction detail pages with timeline, receipt, evidence, and resolution status.
- Internal operations dashboard for unresolved, failed, mismatched, duplicate, refund, reversal, and manual-review transactions.

This is not a production money movement system. It is a validation environment for customer trust, service breadth, provider orchestration, and reconciliation behavior.

## Target Architecture

```text
Presentation
  Customer app
  Admin operations app

Application / Use Cases
  Catalog browsing
  Checkout
  Wallet simulation
  Provider orchestration
  Transaction timeline
  Evidence pack
  Refund/reversal simulation
  Dispute/support flow

Marketplace Domain
  Service catalog
  Order intent
  Wallet ledger simulation
  Provider adapter contracts
  Ticketing reservation model
  Gift card fulfillment model
  Resolution workflow model

ReconcileKit Integration
  PaymentRecord bridge
  MerchantPayment expected side
  ProviderPayment received side
  reconcileRecords()
  ReconciliationReport

Provider Adapters
  Mock airtime/data/electricity/cable/internet/education
  Mock gift card provider
  Mock ticket providers
  Mock payment provider
  Future real providers

Persistence
  Existing JSONL pilot store for MVP/demo mode
  Production database deferred
```

The core reconciliation package remains provider-neutral and should not import marketplace UI, mock providers, wallet code, or ticketing-specific code.

## End-To-End Transaction Lifecycle

Every service transaction should follow one path:

```text
Customer selects service
  -> Marketplace creates OrderIntent
  -> Mock wallet authorizes or fails payment
  -> Wallet ledger records debit or pending debit
  -> Provider adapter receives fulfillment request
  -> Mock provider returns configured response
  -> Marketplace records provider facts
  -> PaymentRecord/Reconciliation input bridge is built
  -> reconcileRecords() is invoked
  -> ReconcileKit produces transaction truth
  -> Timeline, receipt, evidence, and resolution state are updated
  -> Customer and admin see the same factual transaction story
```

The UI may describe this as a service order, but the truth engine should still compare expected marketplace/payment facts against received provider/payment facts using the existing ReconcileKit model.

## Catalog Architecture

Catalog categories should be data-driven so new services do not require changes to the ReconcileKit engine.

Initial category groups:

- Core VTU and bill payment: airtime, mobile data, electricity, cable/pay TV, internet subscriptions, education pins/payments.
- Digital goods: gift cards, digital vouchers, other deliverable digital products.
- Ticketing: cinema, event, bus/transport, airline, and other bookable ticket types.
- Wallet/payment: wallet funding, payment authorization, payment confirmation, payment failure, reversal, refund, settlement states.
- Future/compliance-gated: betting/gaming listed as unavailable and gated, with no real betting provider or gameplay functionality.

Catalog records should carry:

- Stable service id.
- Category id.
- Display name.
- Input schema for checkout.
- Pricing strategy.
- Currency/FX transparency fields where relevant.
- Provider adapter id.
- Scenario controls for demo mode.
- Fulfillment/evidence requirements.
- Compliance gate status.

## Payment And Wallet Simulation

The MVP wallet is a mock ledger, not a custody product.

Wallet simulation should support:

- Balance.
- Funding events.
- Authorization.
- Pending debit.
- Successful debit.
- Failed debit.
- Duplicate debit.
- Reversal.
- Refund initiated.
- Refund pending.
- Refund completed.
- Settlement state.
- Wallet transaction references.

Wallet events should feed the same transaction timeline and evidence pack as provider events. The wallet should not bypass ReconcileKit; it should provide the expected/payment side facts consumed by the ReconcileKit bridge.

## Provider Adapter Boundary

UI components must not contain provider-specific behavior.

Service use cases should call a provider port:

```text
Service checkout use case
  -> ProviderAdapter
  -> MockProvider
  -> ProviderResult
  -> ReconcileKit bridge
```

Adapters should translate category-specific raw provider results into a common marketplace provider-result shape and, where needed, into ReconcileKit `ProviderPayment` facts.

## Ticketing Architecture

Ticketing is first-class in the MVP.

Ticketing should model:

- Search.
- Availability.
- Selection.
- Passenger/customer information.
- Pricing.
- Checkout.
- Reservation.
- Confirmation.
- Ticket issuance.
- Cancellation/refund.
- Reconciliation.

Mock ticket providers should return availability and fulfillment outcomes without needing real cinema, bus, event, or airline APIs. Replacing a mock provider later should not require rebuilding checkout, timeline, evidence, or reconciliation views.

## Gift Card Architecture

Gift cards should be first-class digital goods.

Gift card service data should support:

- Card category.
- Brand.
- Country/region.
- Denomination.
- Quantity.
- Price.
- Delivery status.
- Redemption/code status.
- Refund/dispute status.
- Risk flags.

Mock card codes must be clearly simulated and masked by default. Evidence should prove fulfillment status without exposing full mock secrets in ordinary UI surfaces.

## FX Transparency Layer

The MVP must not perform real FX or money transfer.

The data model and UI should be able to show:

- Source currency.
- Destination currency.
- Mock quoted exchange rate.
- Quote timestamp.
- Service fee.
- Mock FX fee/spread.
- Expected amount.
- Actual amount.
- Final debit.
- Settlement status.
- Discrepancy status.

FX data is evidence for transparency and reconciliation. It is not an execution engine.

## Customer Experience

Required customer surfaces:

- Home/landing screen.
- Authentication shell.
- Dashboard.
- Wallet.
- Catalog.
- Category pages.
- Product/service selection.
- Checkout.
- Transaction confirmation.
- Transaction details.
- Timeline.
- Receipt.
- Evidence view.
- Refund/reversal tracker.
- Dispute/support flow.
- Notifications.
- Profile/settings.

The transaction detail page should be the strongest experience. It must answer:

- What did the customer request?
- What payment event occurred?
- What did the provider report?
- What did ReconcileKit determine?
- What is the current status?
- What happens next?
- Is money at risk?
- Is a refund or reversal expected?
- What evidence exists?

All seeded/demo timestamps should be labeled simulated.

## Admin Operations Experience

The admin surface should show:

- Transaction volume.
- Transaction states.
- Failed transactions.
- Pending transactions.
- Reconciliation mismatches.
- Duplicate detection.
- Provider failures.
- Provider latency.
- Refund queue.
- Reversal queue.
- Manual-review queue.
- Unresolved transactions.
- Transaction details.
- Evidence.
- Audit trail.
- Provider response.
- Internal determination.

Admin actions in MVP should be simulations or local state transitions, not real refunds, real reversals, or provider-side operations.

## Evidence Pack

Evidence should be structured and safe to display.

Evidence pack fields should include:

- Internal transaction id.
- Customer reference.
- Provider reference.
- Payment/wallet reference.
- Service and provider adapter.
- Amount and currency.
- FX quote facts where applicable.
- Timeline timestamps.
- Requested state.
- Payment event state.
- Provider response.
- Reconciliation result.
- Mismatch flags.
- Refund/reversal state.
- Audit events.

Secrets, full gift-card codes, credentials, authorization headers, and real provider secrets must never be exposed.

## Demo Mode

Demo mode should seed:

- A demo customer.
- Wallet balance and wallet ledger events.
- Catalog categories and services.
- Mock providers.
- Successful transactions.
- Failed transactions.
- Pending transactions.
- Delayed confirmations.
- Duplicate transaction cases.
- Duplicate debit cases.
- Mismatches.
- Refunds.
- Reversals.
- Gift card orders.
- Ticket orders.
- Manual-review cases.

Seed data must be visibly simulated.

## Enterprise Extension Points

Do not build the enterprise platform now, but preserve extension points for:

- Multi-tenancy.
- Organizations.
- Roles and permissions.
- API keys.
- Webhooks.
- Audit logs.
- Provider management.
- Reconciliation APIs.
- Transaction ingestion.
- External integrations.
- Billing.
- SLA and health monitoring.

These extension points should stay outside the ReconcileKit domain core unless a future domain decision requires a core change.

## Non-Goals For This Validation MVP

- Real custody.
- Real wallet balances.
- Real escrow.
- Real FX execution.
- Real betting/gaming.
- Production payment credentials.
- Production provider integrations.
- Regulatory activation.
- Production database.
- Production-grade authentication/authorization.
- Full enterprise infrastructure.
- Rewriting ReconcileKit core behavior.

## Architectural Decision

The least destructive implementation path is:

1. Keep the root ReconcileKit domain, application, adapters, CLI, and existing tests intact.
2. Extend the `storefront/` pilot into a broader local-first validation app.
3. Add marketplace/domain modules around catalog, wallet simulation, provider adapters, transactions, timelines, evidence, and operations.
4. Reuse the existing `PaymentRecord` bridge pattern so every transaction invokes `reconcileRecords()`.
5. Build mock providers first, with clear future adapter slots for real providers.
6. Add tests around new use cases without changing frozen reconciliation semantics unless a genuine inconsistency is identified and documented.
