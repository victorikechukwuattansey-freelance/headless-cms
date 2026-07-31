# ADR-006: Billing Service Interface with Provider Abstraction

**Date:** 2026-07-29
**Status:** Accepted
**Phase:** 5 — Billing

## Context

The existing billing system exposed Stripe and Lemon Squeezy SDKs directly through the `@saas/payments` package. The constitution requires payment logic to "never directly depend on vendor SDKs outside the billing package" and support multiple providers through adapter abstractions.

## Decision

Wrap all billing logic behind a `BillingService` interface defined in `packages/payments/src/service.ts`. Each provider implements the interface as an adapter. A factory selects the active adapter via `BILLING_PROVIDER` environment variable.

## Architecture

```
packages/payments/src/
  service.ts            BillingService interface (public contract)
  types.ts              Domain models + typed errors
  factory.ts            createBillingService() — selects active adapter
  index.ts              Public API (adapter exports + backward compat)
  stripe/               Existing Stripe implementation (backward compat)
  lemon-squeezy/        Existing LS implementation (backward compat)
  adapters/
    stripe/             StripeBillingAdapter
    lemon-squeezy/      LemonSqueezyAdapter
```

## Key Design Decisions

| Decision               | Choice                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Service contract       | `BillingService` covering checkout, subscriptions, invoices, customer management, webhooks                                               |
| Adapter instantiation  | Factory pattern selected by `BILLING_PROVIDER` env var                                                                                   |
| Backward compatibility | `@saas/payments/stripe` and `@saas/payments/lemon-squeezy` sub-paths kept as-is                                                          |
| Error model            | Typed error classes: `BillingError`, `PaymentFailedError`, `NoActiveSubscriptionError`, `CustomerNotFoundError`, `WebhookSignatureError` |
| Domain models          | `Subscription`, `Invoice`, `Customer`, `Plan`, `CheckoutResult` — provider-agnostic                                                      |

## Current Adapters

- **StripeBillingAdapter** — Full implementation: checkout, customer portal, subscription management, invoice retrieval, webhook handling
- **LemonSqueezyAdapter** — Partial implementation: checkout, webhook handling, invoice retrieval. Customer portal, subscription update/cancel/resume pending

## Consequences

- **Positive:** Adding Paddle, Polar, or PayPal requires only a new adapter file
- **Positive:** Testing can mock `BillingService` instead of mocking Stripe API calls
- **Positive:** Both `@saas/payments/stripe` and `@saas/payments` (via BillingService) imports work for backward compat
- **Negative:** Some adapter methods throw "not yet implemented" for LemonSqueezy portal/subscription management
- **Negative:** Domain types are lowercase; Prisma enums are uppercase — requires mapping in adapters
