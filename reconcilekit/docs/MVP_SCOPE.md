# MVP Scope

## Goal

Build a validation MVP for a trust-first digital services marketplace powered by ReconcileKit as the transaction-truth engine.

The MVP should demonstrate:

- Broad marketplace catalog.
- Mock wallet/payment flow.
- Mock provider fulfillment.
- ReconcileKit-backed transaction truth.
- Timeline, receipt, evidence, and resolution visibility.
- Admin operations review of ambiguous or failed transactions.

## Definition Of Validation

The MVP validates whether users and operators understand and trust the transaction story:

```text
What did I ask for?
What happened to my money?
What did the provider say?
What did ReconcileKit determine?
What happens next?
```

It does not validate real provider conversion, real money movement, regulatory readiness, or production operations.

## In Scope

### Customer App

- Landing/home screen.
- Authentication shell.
- User dashboard.
- Wallet view.
- Catalog.
- Category pages.
- Product/service selection.
- Checkout.
- Transaction confirmation.
- Transaction details.
- Transaction timeline.
- Receipt.
- Evidence view.
- Refund/reversal tracker.
- Dispute/support flow.
- Notifications.
- Profile/settings.

### Catalog

- Airtime.
- Mobile data.
- Electricity.
- Cable TV / Pay TV.
- Internet subscriptions.
- Education payments/pins where appropriate.
- Gift cards.
- Digital vouchers.
- Cinema tickets.
- Event tickets.
- Bus/transport tickets.
- Airline tickets.
- Wallet funding simulation.
- Payment authorization simulation.
- Future/compliance-gated betting/gaming category with no real betting functionality.

### Transaction Scenarios

The MVP should support seeded and/or selectable simulation scenarios:

- Successful transaction.
- Failed transaction.
- Delayed provider response.
- Pending transaction.
- Provider timeout.
- Payment succeeded but service failed.
- Service succeeded but provider confirmation was delayed.
- Duplicate transaction.
- Duplicate debit.
- Reversal.
- Refund initiated.
- Refund completed.
- Refund pending.
- Mismatched provider reference.
- Missing provider reference.
- Amount discrepancy.
- Settlement mismatch.
- Transaction requiring manual review.

### Admin / Operations

- Transaction volume.
- Transaction state breakdown.
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
- Transaction detail.
- Evidence.
- Audit trail.
- Provider response.
- Internal determination.

### Demo Mode

- Seeded demo user.
- Seeded wallet balance.
- Seeded catalog.
- Seeded mock providers.
- Seeded successful, failed, pending, mismatched, refunded, reversed, duplicate, gift-card, and ticket transactions.
- Obvious simulated-data labeling.

> **Phase 2K annotation:** within the seeded demo, the `duplicate_debit`
> scenario dedupes to `MATCH` + `DUPLICATE_PROVIDER_RESPONSE` per the DESIGN
> decision #1a, and the `wallet_funding_failure` scenario is wallet-layer only
> (its `/transactions/…` page is a real 404). See
> `PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md` §15–§16.

### Tests

Automated tests should cover:

- Successful transaction.
- Provider failure.
- Provider timeout.
- Pending transaction.
- Duplicate transaction/provider response.
- Mismatch.
- Reversal simulation.
- Refund simulation.
- Evidence generation.
- Timeline generation.
- Provider adapter behavior.
- ReconcileKit invocation path.

## Out Of Scope

- Real money custody.
- Real escrow.
- Real wallet balances.
- Real payment processing credentials.
- Real FX execution.
- Real money transfer.
- Real betting/gaming.
- Real gift-card provider integration.
- Real airline/cinema/event/bus provider integration.
- Production authentication.
- Production database.
- Webhook reliability guarantees.
- Multi-tenant enterprise platform.
- Production compliance readiness.
- Production deployment hardening.
- Public BillPoint parity claims without verified research.

## Recommended Implementation Phases

### Phase 1: Architecture And Documentation

Deliver the pre-implementation docs:

- `docs/PRODUCT_ARCHITECTURE.md`
- `docs/BILLPOINT_PARITY_MATRIX.md`
- `docs/MOCK_PROVIDER_ARCHITECTURE.md`
- `docs/RECONCILE_KIT_INTEGRATION.md`
- `docs/MVP_SCOPE.md`
- `docs/ASSUMPTIONS_AND_GAPS.md`

No product code changes in this phase.

### Phase 2: Marketplace Domain And Demo Data

Add small, typed marketplace models around:

- Catalog categories/services.
- Customer/demo session.
- Wallet ledger simulation.
- Marketplace transaction records.
- Timeline events.
- Evidence packs.
- Resolution states.
- Mock provider scenarios.

Seed a deterministic demo dataset.

### Phase 3: Provider Adapter Layer

Add mock provider adapters for:

- Core VTU/bill-payment services.
- Gift cards.
- Ticketing.
- Mock payment/wallet behavior.

Ensure each adapter returns provider-neutral facts and source attributes that can feed ReconcileKit.

### Phase 4: Transaction Orchestration

Implement checkout use cases:

- Create transaction intent.
- Authorize/debit mock wallet.
- Call provider adapter.
- Build ReconcileKit inputs.
- Store timeline/evidence/resolution state.
- Return transaction confirmation.

### Phase 5: Customer UI

Build usable clickable screens:

- Catalog and category pages.
- Service detail/configuration.
- Checkout.
- Wallet.
- Transaction details.
- Timeline.
- Receipt.
- Evidence.
- Refund/reversal tracker.
- Dispute/support.
- Notifications.
- Profile/settings.

### Phase 6: Admin UI

Build operations dashboard and queues:

- State overview.
- Mismatch queue.
- Pending queue.
- Provider failure queue.
- Duplicate queue.
- Refund/reversal/manual-review queue.
- Transaction detail and audit/evidence views.

### Phase 7: Verification

Run:

- Root typecheck and tests.
- Storefront typecheck and tests.
- New marketplace tests.
- Manual demo-mode walkthrough.
- Production-build or deployment validation if deployment tooling exists.

## MVP Completion Criteria

The MVP is done only when:

- The app runs locally.
- A reviewer can open it without external credentials.
- Catalog navigation works.
- Multiple service types can be purchased in mock mode.
- Mock wallet/payment flow works.
- Mock providers respond according to scenario.
- Every transaction flows through ReconcileKit integration.
- Transaction states are meaningful.
- Timeline, receipt, and evidence views exist.
- Refund/reversal states are visible.
- Gift card flow works in mock mode.
- Ticketing flow works in mock mode.
- Admins can inspect and resolve simulated problems.
- Seed/demo data works.
- Critical reconciliation paths have automated tests.
- Documentation explains architecture, demo mode, and extension points.

## Quality Bar

The MVP should avoid fake completeness.

Acceptable:

- Local-first JSONL storage.
- Mock providers.
- Simulated wallet and refunds.
- Authentication shell instead of production auth.
- In-app mock notifications.

Not acceptable:

- UI-only transaction states that never call ReconcileKit.
- Hard-coded provider logic inside React/UI components.
- Fake provider integrations that appear real.
- Hidden real-money behavior.
- Silent changes to the existing reconciliation engine.
- Claims of BillPoint parity without evidence.
