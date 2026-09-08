# Assumptions And Gaps

## Repository Facts

The existing repository provides:

- A TypeScript ReconcileKit package.
- A frozen provider-neutral reconciliation architecture.
- Domain types for merchant/provider payments, outcomes, statuses, discrepancy codes, summaries, and reports.
- Deterministic reconciliation by exact reference.
- Input validation and discrepancy classification.
- Duplicate and conflicting-attribute handling.
- Merchant CSV adapter.
- Paystack adapter and transport.
- CLI file mode and explicit live Paystack mode.
- Storefront pilot with businesses, products, orders, Paystack initialize/verify, JSONL persistence, `PaymentRecord`, callback, `/reconcile`, and merchant CSV export.
- Tests covering the core reconciliation matrix and storefront pilot behavior.

## Existing Constraints

These constraints are explicit in code and docs:

- Root ReconcileKit is a payment reconciliation toolkit, not a ledger or payment processor.
- The core engine is provider-neutral.
- Provider-specific mapping belongs in adapters.
- No fuzzy matching in current MVP.
- No floating-point money comparison.
- No arbitrary duplicate pairing.
- No production database in current implementation.
- Storefront has no auth and no production dashboard.
- Storefront JSONL persistence is single-process/local-first.
- Refund lifecycle is currently out of scope for the root ReconcileKit engine.
- Storefront `refundStatus` exists but remains `NONE` in current code.
- Paystack live mode exists and must be explicit.
- Secrets are environment-only and must not enter reports/logs.

## Assumptions For The Marketplace MVP

These are implementation assumptions for the next phase:

- The existing `storefront/` module is the right place to evolve the validation MVP.
- JSONL persistence is acceptable for a local demo/validation MVP.
- Node built-ins and existing tooling remain preferred unless UI needs force a documented dependency decision.
- ReconcileKit should continue to determine expected-vs-received payment truth.
- Marketplace fulfillment state can live outside ReconcileKit while still being shown in timeline/evidence.
- Mock providers are enough to validate catalog breadth and transaction transparency.
- Authentication can be a local shell/demo identity for MVP.
- Notifications can be in-app mock notifications for MVP.
- Admin resolution actions can be simulated local state transitions.
- Refunds and reversals can be represented as application-level resolution workflows until the ReconcileKit domain is deliberately extended.

## Ambiguities

### Payment Truth vs Fulfillment Truth

The current ReconcileKit model reconciles payment records. The requested marketplace includes fulfillment-heavy services such as gift cards and tickets.

Least destructive choice:

- ReconcileKit determines payment/provider transaction truth.
- Marketplace application determines fulfillment/resolution state.
- Timeline and evidence combine both without moving fulfillment rules into the ReconcileKit core.

### Refund/Reversal Semantics

Existing docs explicitly defer full refund lifecycle reconciliation, while the requested MVP needs refund/reversal visibility.

Least destructive choice:

- Add simulated refund/reversal state in the marketplace application.
- Do not change root reconciliation outcomes.
- Do not map provider `reversed` to `CANCELLED` without a new domain decision.

### Settlement Mismatch

The existing ReconcileKit core does not implement settlement reconciliation.

Least destructive choice:

- Represent settlement mismatch as a simulated wallet/payment/evidence state in the application layer.
- Do not claim full settlement reconciliation.
- Future settlement reconciliation should be a separate ReconcileKit domain extension.

### BillPoint Baseline

No verified BillPoint reference material exists in the repository or prompt beyond the user's baseline framing and capability areas.

Least destructive choice:

- Mark BillPoint-specific capability claims as `UNKNOWN - REQUIRES RESEARCH`.
- Build the requested broad MVP catalog without claiming verified BillPoint parity.

### Provider References Across Non-Payment Services

The existing engine matches merchant reference to provider transaction reference. Ticketing and gift-card providers may have fulfillment references that differ from payment references.

Least destructive choice:

- Use a stable marketplace transaction reference as the payment reconciliation key.
- Store fulfillment references as evidence/source attributes.
- Only promote fulfillment references into matching keys after a domain decision.

### Provider Timeout

The existing ReconcileKit model separates operational failures from reconciliation outcomes.

Least destructive choice:

- Treat timeout as an application/provider event.
- Keep transaction pending/under monitoring if no provider facts exist.
- Do not convert timeout into a fake `DISCREPANCY` unless provider facts later create a mismatch.

## Known Gaps To Close

Product/application gaps:

- No customer UI.
- No admin UI.
- No catalog beyond generic products.
- No category/service-specific checkout forms.
- No mock wallet.
- No mock provider architecture.
- No gift-card flow.
- No ticketing flow.
- No transaction timeline model.
- No receipt model.
- No evidence pack view.
- No dispute/support flow.
- No notifications.
- No demo seed command.
- No refund/reversal workflow beyond existing dormant `refundStatus` type.
- No settlement state model.

Engineering gaps:

- No production build/deployment story.
- No production auth.
- No multi-process-safe persistence.
- No durable database.
- No webhooks.
- No API documentation for new marketplace flows.
- No UI visual/runtime verification yet.

Research gaps:

- BillPoint capability research.
- Real provider API shapes for catalog services.
- Gift card compliance/provider requirements.
- Ticketing provider contracts.
- Payment/FX regulatory constraints.
- Production wallet/custody requirements.
- Betting/gaming compliance requirements.

## What Must Not Be Changed For This MVP

- Existing ReconcileKit exact-reference matching behavior.
- Existing root outcome vocabulary unless a documented domain decision is made.
- Existing integer minor-unit amount invariant.
- Existing duplicate and ambiguity behavior.
  (The pilot bridge dedupes duplicate expectations for one join key before the
  engine — one expected row per join key — so seeded duplicates surface as
  `MATCH` + `DUPLICATE_PROVIDER_RESPONSE`. The engine's duplicate/ambiguity
  behavior itself is unchanged and remains unit-covered. See
  `PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md`.)
- Existing status handling: missing vs `UNKNOWN`, and `UNKNOWN` not treated as match.
- Existing Paystack adapter mapping for `abandoned` and `reversed`.
- Existing separation of operational/provider failures from reconciliation findings.
- Existing secret-safety constraints.
- Existing CLI offline file mode.
- Existing explicit live-Paystack opt-in.

## What Can Be Safely Extended

- Add docs under `docs/`.
- Add marketplace-specific modules under `storefront/src/` or a clearly scoped app directory.
- Add new JSONL store kinds for catalog, wallet, transactions, timeline, evidence, disputes, and notifications.
- Extend storefront domain/application layer around new MVP concepts.
- Add mock provider adapters behind typed ports.
- Add customer/admin UI routes if the project remains a minimal Node server, or introduce a frontend framework only after a dependency decision.
- Add tests for new application behavior.
- Add seed/demo data.

## Production Blockers

Before production:

- Real authentication and authorization.
- Durable database and migrations.
- Webhooks and idempotent provider event ingestion.
- Provider credential management and rotation.
- Audit log hardening.
- Monitoring, metrics, and alerting.
- Rate limiting.
- Backups and recovery.
- Real payment compliance.
- Wallet/custody legal and technical design.
- FX compliance if applicable.
- Gift-card provider and fraud controls.
- Ticketing provider contracts.
- Compliance review for betting/gaming before any activation.

## Documentation Gap To Close During Implementation

Implementation should update or add:

- Local run instructions.
- Demo mode instructions.
- Transaction lifecycle documentation.
- Catalog extension guide.
- Provider adapter extension guide.
- ReconcileKit invocation guide.
- Refund/reversal simulation guide.
- Known limitations.
- Deployment instructions or production-build notes.
