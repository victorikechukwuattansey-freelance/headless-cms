# Mock Provider Architecture

## Purpose

This document defines the mock provider architecture for the validation MVP.

The goal is to exercise realistic transaction conditions through provider adapters while keeping all external services simulated by default.

No UI component should hard-code provider-specific logic.

## Phase 2B Implementation (Complete)

Implemented files:

- `storefront/src/marketplace/providers/contracts.ts` — provider-neutral interfaces, request types, result types
- `storefront/src/marketplace/providers/mock-provider.ts` — deterministic mock implementations
- `storefront/src/marketplace/providers/registry.ts` — `createMockProviderRegistry()` factory

Test files:

- `storefront/test/marketplace/mock-provider.test.ts` — scenario behavior, all provider categories, determinism
- `storefront/test/marketplace/provider-registry.test.ts` — registry completeness, interface compliance, betting gate

The implementation keeps the marketplace provider layer provider-neutral. It does not modify root ReconcileKit domain/application code, existing root provider adapters, or the existing Paystack-specific `PaymentRecord`.

### Implemented Boundary

```text
Marketplace use case
  -> provider interface from contracts.ts
  -> provider returned by registry.ts
  -> deterministic mock implementation in mock-provider.ts
  -> ProviderResult with safe source attributes
```

Marketplace use cases should depend on contracts such as `AirtimeProvider`, `GiftCardProvider`, `TicketingProvider`, or `PaymentProvider`. They should obtain implementations from `createMockProviderRegistry()` or a later real-provider registry. Use cases should not import concrete mock classes.

### Implemented Service Contracts

`contracts.ts` defines provider-neutral request/result contracts for:

- Airtime: recipient, network, product code, amount, currency.
- Data: recipient, network, bundle id, amount, currency.
- Electricity: meter number, disco, customer name, token expectation, amount, currency.
- Cable/Pay TV: subscriber id, package code, provider, amount, currency.
- Internet: account id, plan id, provider, amount, currency.
- Education: exam body, product code, candidate/delivery details, amount, currency.
- Gift cards and digital vouchers: brand, region, denomination, quantity, currency, delivery target.
- Cinema, event, bus, and airline ticketing: availability search, reservation, issuance, cancellation.
- Payment: payment intent, amount, currency, authorization state, payment reference, settlement state.

The ticketing contract intentionally separates search/availability from reservation, issuance, and cancellation. This keeps the later ticketing customer experience replaceable without making checkout code depend on mock data structures.

### Status Separation

`ProviderResult` keeps distinct status concepts:

- `scenario`: the deterministic mock control, using `MockProviderScenario`.
- `providerStatus`: provider-facing status such as `PROVIDER_SUCCESS`, `PROVIDER_TIMEOUT`, or `PROVIDER_REFUND_PENDING`.
- `attemptStatus`: marketplace provider-attempt status such as `SUCCESS`, `PENDING`, `TIMEOUT`, `DUPLICATE`, or `MISMATCH`.
- `canonicalPaymentStatus`: ReconcileKit-compatible canonical status for later bridge mapping.
- `reconciliationFacts`: safe structured provider facts for Phase 2F. Timeout returns `null` here so the app does not invent provider-side facts.

These statuses must not be collapsed. ReconcileKit outcomes are still deferred to Phase 2F.

### Deterministic Simulation

`mock-provider.ts` derives all mock behavior from `ProviderRequestContext`, request values, and `MockProviderScenario`.

- No uncontrolled randomness is used.
- Provider references are derived from provider id, transaction id, customer reference, scenario, and attempt number.
- Response timestamps are derived from `requestedAt` plus a fixed scenario latency.
- `TIMEOUT` returns no provider reference, no response timestamp, and no reconciliation facts.
- `DUPLICATE` returns duplicate provider facts with the same provider reference.
- `MISMATCH` changes provider facts by returning a mismatched reference and amount.
- Gift-card code material is masked and no raw code is exposed in safe metadata.

### Registry

`registry.ts` exposes `createMockProviderRegistry()`, which returns mock implementations behind provider interfaces for every non-gated marketplace service kind:

- `AIRTIME`
- `DATA`
- `ELECTRICITY`
- `CABLE_TV`
- `INTERNET`
- `EDUCATION`
- `GIFT_CARD`
- `DIGITAL_VOUCHER`
- `CINEMA_TICKET`
- `EVENT_TICKET`
- `BUS_TICKET`
- `AIRLINE_TICKET`
- `WALLET_FUNDING`

`BETTING` deliberately throws because betting/gaming remains compliance-gated in the validation MVP.

### Deferred From Phase 2B

Phase 2B does not implement:

- Wallet behavior (Phase 2C)
- Catalog (Phase 2D)
- Transaction orchestration (Phase 2E)
- ReconcileKit integration / bridge mapping (Phase 2F)
- Timeline / evidence / refund / dispute UX (Phase 2G)
- Ticketing / gift-card specific flows (Phase 2H)
- Customer / admin UI (Phase 2I)
- Seed / demo data (Phase 2J)
- Real provider APIs
- Real payment integration
- FX execution
- Betting / gaming
- Production authentication

The provider results only preserve enough facts for later orchestration, timeline, evidence, and ReconcileKit bridge phases.

## Principles

- Mock providers are replaceable implementations behind provider adapters.
- Provider-specific raw responses never enter the ReconcileKit domain directly.
- Every mock provider response should be able to produce timeline events, evidence, and ReconcileKit provider-side facts where applicable.
- Mock behavior must be configurable by scenario.
- Mock data must be clearly labeled simulated.
- No real provider API, production credential, real gift-card system, real ticketing system, real betting system, or real payment processor is required for the MVP.

## Provider Flow

```text
Service use case
  -> ProviderAdapter
  -> MockProvider
  -> ProviderResult
  -> Transaction event recorder
  -> ReconcileKit bridge
  -> Timeline / evidence / receipt / resolution
```

## Common Provider Scenario Codes

All mock providers should support these scenario outcomes where relevant:

```text
SUCCESS
FAILED
PENDING
TIMEOUT
DUPLICATE
PARTIAL_SUCCESS
REVERSED
REFUND_PENDING
REFUND_COMPLETED
MISMATCH
UNKNOWN
```

The scenario code is an adapter/input control. It is not automatically a ReconcileKit outcome. The provider adapter must map the result into provider facts and evidence, then the ReconcileKit engine determines the reconciliation outcome.

## Common Provider Result

The implemented `ProviderResult` (in `contracts.ts`) contains all fields needed for Phase 2F ReconcileKit bridge mapping, timeline events, and evidence packs:

```ts
export interface ProviderRequestContext {
  readonly transactionId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attemptNumber: number;
  readonly customerReference: string;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
  readonly scenario: MockProviderScenario;
  readonly amountMinor: number;
  readonly currency: string;
  readonly metadata: SourceAttributes;
}

export interface ProviderResult {
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKind: MarketplaceServiceKind;
  readonly scenario: MockProviderScenario;
  readonly providerReference: string | null;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attemptNumber: number;
  readonly requestTimestamp: string;
  readonly responseTimestamp: string | null;
  readonly providerStatus: ProviderStatus;
  readonly providerStatusCode: string;
  readonly providerMessage: string;
  readonly attemptStatus: ProviderAttemptStatus;
  readonly canonicalPaymentStatus: CanonicalPaymentStatus;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly latencyMs: number;
  readonly sourceAttributes: SourceAttributes;
  readonly reconciliationFacts: ProviderReconciliationFacts | null;
  readonly safeMetadata: SourceAttributes;
  readonly duplicateResults: readonly ProviderReconciliationFacts[];
  readonly simulated: boolean;
}
```

The `ProviderReconciliationFacts` interface provides the structured data that Phase 2F will bridge into ReconcileKit `ProviderPayment` records:

```ts
export interface ProviderReconciliationFacts {
  readonly providerId: string;
  readonly providerReference: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly canonicalStatus: CanonicalPaymentStatus;
  readonly occurredAt: string | null;
  readonly sourceAttributes: SourceAttributes;
}
```

The actual implementation follows repository conventions and avoids creating duplicate domain models when existing types can be safely reused.

## Adapter Families

The MVP should define adapters for:

- `AirtimeProvider`
- `DataProvider`
- `ElectricityProvider`
- `CableProvider`
- `InternetProvider`
- `EducationProvider`
- `GiftCardProvider`
- `VoucherProvider`
- `CinemaProvider`
- `EventTicketProvider`
- `BusTicketProvider`
- `AirlineProvider`
- `PaymentProvider`

These are logical adapter contracts. They do not all require unique implementation files if a smaller generic mock adapter can safely cover multiple services.

## Core VTU / Bill Payment Providers

Input examples:

- Phone number.
- Meter number.
- Smart-card number.
- Internet account id.
- Education exam/pin type.
- Bundle/package id.
- Amount.
- Currency.

Provider evidence examples:

- Provider reference.
- Customer/account identifier.
- Product/package name.
- Requested amount.
- Fulfilled amount.
- Token/pin where applicable, masked by default.
- Provider status.
- Latency.
- Failure code.

## Gift Card Provider

Gift card provider input should support:

- Brand.
- Category.
- Country/region.
- Denomination.
- Quantity.
- Currency.
- Recipient delivery target.

Gift card provider result should support:

- Fulfillment status.
- Delivery status.
- Redemption/code status.
- Masked code preview.
- Risk flags.
- Refund/dispute eligibility.

Full mock card codes should not be exposed on list views or ordinary evidence summaries. If a detail view shows code material, it must be clearly simulated and intentionally revealed.

## Ticketing Providers

Ticketing adapters should support:

```text
Search
  -> Availability
  -> Selection
  -> Passenger/customer information
  -> Pricing
  -> Checkout
  -> Reservation
  -> Confirmation
  -> Ticket issuance
  -> Cancellation/refund
  -> Reconciliation
```

Provider-specific examples:

- Cinema: movie, cinema, date/time, seats, ticket code.
- Event: event, ticket tier, attendee details, QR/reference.
- Bus: origin, destination, date/time, passenger, seat, operator.
- Airline: origin, destination, flight, passenger, fare, reservation code.

Mock providers should model reservation and issuance separately so the MVP can demonstrate payment succeeded but ticket issuance failed, reservation pending, cancellation initiated, and refund pending.

## Payment Provider / Wallet Provider

The payment provider is mock-only for the MVP.

It should produce wallet/payment events:

- Funding initiated.
- Funding confirmed.
- Authorization requested.
- Authorization failed.
- Debit pending.
- Debit successful.
- Debit failed.
- Duplicate debit.
- Reversal initiated.
- Reversal completed.
- Refund initiated.
- Refund pending.
- Refund completed.
- Settlement pending.
- Settlement mismatch.

These events belong in the marketplace/wallet simulation layer. They should be mapped into expected payment facts and evidence for ReconcileKit, not implemented inside the ReconcileKit core.

## Mapping To ReconcileKit

For each completed or attempted marketplace transaction:

- The expected side should become a `MerchantPayment` equivalent: marketplace reference, expected amount, currency, status, timestamp, internal record id.
- The received side should become a `ProviderPayment` equivalent only when provider/payment facts exist: provider reference, actual amount, currency, status, timestamp, provider id.
- Provider source attributes should preserve raw provider status, timestamps, provider response code, scenario, and latency where safe.

Pending/timeouts may intentionally produce no provider row or an `UNKNOWN`/`PENDING` provider row depending on what evidence exists. This must be documented per scenario and tested.

## Scenario Mapping Guidance

| Mock Scenario    | Provider Facts                                                                      | Likely ReconcileKit Effect                                                                        |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SUCCESS          | Matching reference, amount, currency, success status                                | `MATCH` when expected side also matches                                                           |
| FAILED           | Matching reference, failed status, amount/currency present if provider reports them | Could be `MATCH` if expected status is failed, or `STATUS_MISMATCH` if expected status is success |
| PENDING          | Matching reference, pending status, maybe no fulfillment timestamp                  | Usually `MATCH` or `UNRESOLVED` depending expected status                                         |
| TIMEOUT          | No provider facts or operational failure event                                      | Not a domain outcome by itself; transaction remains monitored/pending in application timeline     |
| DUPLICATE        | Multiple provider rows with same reference                                          | `HELD_AMBIGUOUS` and `DUPLICATE_PROVIDER_RECORD`                                                  |
| PARTIAL_SUCCESS  | Provider reports less/more or incomplete fulfillment                                | `AMOUNT_MISMATCH`, service-level partial flag, or manual review depending facts                   |
| REVERSED         | Provider/payment status mapped conservatively                                       | Reversal state in app; ReconcileKit should not invent refund semantics                            |
| REFUND_PENDING   | Refund workflow state, not necessarily payment mismatch                             | App resolution state plus evidence                                                                |
| REFUND_COMPLETED | Refund workflow state plus wallet ledger event                                      | App resolution state plus evidence                                                                |
| MISMATCH         | Reference, amount, currency, or status differs                                      | Relevant ReconcileKit discrepancy code                                                            |
| UNKNOWN          | Unmapped/raw provider state                                                         | `STATUS_UNRESOLVED` when status participates in validation                                        |

> **Phase 2K annotation (dedupe decision #1a):** in the marketplace pilot,
> duplicate provider responses for the same join key are **deduped to `MATCH`**
> with an app-level `DUPLICATE_PROVIDER_RESPONSE` marker, per
> `RECONCILE_KIT_INTEGRATION_DESIGN.md` §8 row 5 and open decision #1 (option
> a). The raw engine `HELD_AMBIGUOUS` + `DUPLICATE_PROVIDER_RECORD` path remains
> covered at the engine level (root tests) and is not reachable from the 16
> seeded scenarios. The `DUPLICATE` row above describes the engine's raw
> behavior when both candidates are emitted, which the pilot bridge avoids by
> emitting one deduped expected row per join key.

## Configuration

Demo mode should allow selecting scenario behavior:

- Globally per provider.
- Per service.
- Per checkout transaction.
- Via seeded demo records.

Configuration must be explicit and safe:

- No hidden network fallback.
- No production API credentials.
- No `.env` secrets for mock behavior.
- Any future real-provider config must be environment-based and clearly named.

## Replacement With Real Providers

A real provider can replace a mock provider when it implements the same adapter contract:

```text
Marketplace use case
  -> ProviderAdapter contract
  -> Real provider client
  -> ProviderResult
  -> ReconcileKit bridge
```

The customer experience, timeline, evidence pack, and ReconcileKit invocation should not need to change when swapping providers.

## Implementation Decisions

### Request Context Design

`ProviderRequestContext` includes `providerName`, `requestId`, `correlationId`, and `attemptNumber` in addition to the minimal set from the original plan. These fields are needed for provider attempt records and evidence packs without requiring the adapter to invent them.

### Provider Result Richness

`ProviderResult` carries `requestTimestamp` and `responseTimestamp` separately (rather than just `occurredAt`), plus `attemptStatus` as a distinct concept from `providerStatus`. This separation is necessary because the marketplace attempt status and the provider-facing status can diverge (e.g., `DUPLICATE` attempt status maps to `PROVIDER_DUPLICATE` provider status but `SUCCESS` canonical status).

### Reconciliation Facts Separation

`ProviderReconciliationFacts` is a nested object on `ProviderResult` rather than flat fields. This makes it explicit that reconciliation facts are a subset of the full provider result, and `null` for scenarios like `TIMEOUT` where no provider-side facts exist. Phase 2F will map these directly into ReconcileKit `ProviderPayment` records.

### Gift Card and Ticketing Specialization

`GiftCardProvider` and `TicketingProvider` extend the base `ProviderAdapter` pattern with service-specific result types (`GiftCardProviderResult`, `TicketProviderResult`). The ticketing interface adds `searchAvailability`, `reserve`, `issue`, and `cancel` methods rather than cramming all phases into a single `execute` call. This separation enables the later ticketing customer experience to be replaceable.

### Generic MockServiceProvider

`MockServiceProvider<Request>` is a generic class that handles all non-specialized VTU/bill-payment services (airtime, data, electricity, cable, internet, education) through a single implementation with a configurable `referencePrefix`. This avoids duplicating identical scenario logic across six adapter files while keeping each adapter's identity distinct through the registry.

### Deterministic Latency

Each scenario has a fixed latency value in the mock. This is deterministic (same input = same output) while being realistic enough to demonstrate latency differences in timeline views. `TIMEOUT` returns `null` for response timestamp and reconciliation facts, exactly matching what a real provider timeout would produce.

## Tests Implemented

The following tests are implemented in `storefront/test/marketplace/mock-provider.test.ts`:

- Airtime provider succeeds through the provider interface.
- Data provider failure keeps provider, marketplace, and canonical statuses distinct.
- Electricity pending response preserves provider facts for later reconciliation.
- Timeout response is deterministic and does not invent provider facts.
- Duplicate scenario returns duplicate provider facts with the same reference.
- Mismatch scenario changes provider facts without changing request context.
- Reversal and refund scenarios expose provider lifecycle states.
- Gift card provider masks code evidence and does not expose raw codes.
- Ticketing provider separates search, reservation, and issuance.
- Partial success returns half the requested amount with SUCCESS canonical status.
- Unknown scenario returns unmapped provider status with no safe resolution.
- Cable provider executes through the provider interface.
- Internet provider executes through the provider interface.
- Education provider executes through the provider interface.
- Provider adapter boundary: marketplace code depends on `ProviderAdapter` interface, not concrete classes.
- Deterministic mock: same context and scenario always produce the same result.

The following tests are implemented in `storefront/test/marketplace/provider-registry.test.ts`:

- Registry exposes every non-gated service kind through provider interfaces.
- Registry keeps marketplace use cases dependent on contracts, not concrete mocks.
- Registry refuses compliance-gated betting provider.
