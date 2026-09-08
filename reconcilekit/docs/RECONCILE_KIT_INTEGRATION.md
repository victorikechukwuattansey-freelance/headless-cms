# ReconcileKit Integration

## Purpose

This document maps the existing ReconcileKit implementation to the marketplace validation MVP and defines what should be reused, extended, and left untouched.

ReconcileKit is the core transaction-truth engine. It must not become decorative reporting.

## Existing Core To Reuse

Reuse these root package modules as-is unless a genuine inconsistency is found and documented:

- `src/domain/model.ts`
- `src/domain/reconcile.ts`
- `src/domain/validation.ts`
- `src/domain/reference.ts`
- `src/domain/duplicates.ts`
- `src/application/reconcile-records.ts`
- `src/adapters/merchant/csv.ts`
- `src/adapters/providers/paystack/paystack.ts`
- Existing domain, adapter, CLI, and integration tests.

The important public application call is:

```ts
reconcileRecords({
  merchantPayments,
  providerPayments,
  config,
  providerSourceAttributes,
});
```

The marketplace should call the application boundary rather than importing internal helper functions into UI components.

## Existing Storefront Bridge To Reuse

The current storefront has a useful integration pattern:

```text
PaymentRecord
  -> buildReconcileBridgeInput()
  -> MerchantPayment[] + ProviderPayment[]
  -> reconcileRecords()
  -> ReconciliationReport
  -> buildReconcileView()
```

Files:

- `storefront/src/domain/types.ts`
- `storefront/src/reconcile/adapter.ts`
- `storefront/src/reconcile/view.ts`
- `storefront/src/reconcile/merchant-csv.ts`

This pattern should be generalized for marketplace transactions rather than replaced.

## Existing Behavior Proven By Tests

The repository has tests for:

- 20 domain reconciliation scenarios.
- Deterministic output.
- Duplicate candidate safety.
- Integer monetary comparison.
- Multiple simultaneous discrepancies.
- Missing versus unknown status.
- Input-error precedence.
- Merchant CSV parsing.
- Paystack adapter mapping.
- Paystack status mapping and source-status preservation.
- Paystack timestamp-field selection.
- Outer envelope `status` not being confused with `data.status`.
- Live Paystack transport boundaries and secret safety.
- Storefront order creation and server-owned pricing.
- Paystack verification and idempotency.
- Reference mismatch protection.
- Amount/currency integrity failures.
- Expected-vs-received storefront reconciliation view.

These tests define reusable behavior for the validation MVP.

## Marketplace Mapping

The marketplace should map each order into a common transaction record that can produce:

- ReconcileKit expected side: what the marketplace/customer intended and paid for.
- ReconcileKit received side: what the payment/provider system reported.
- Provider source attributes: raw provider status, scenario, timestamp, latency, safe response facts.
- Timeline events: user-readable sequence of what happened.
- Evidence pack: structured facts backing the timeline and receipt.
- Resolution state: refund/reversal/dispute/manual-review status.

Existing `PaymentRecord` can be extended or wrapped carefully, but do not duplicate canonical payment semantics if existing fields are sufficient.

## Recommended Transaction Flow

```text
1. Customer selects catalog service.
2. Application creates OrderIntent with stable customer reference.
3. Mock wallet/payment provider creates authorization event.
4. Application records expected payment/fulfillment facts.
5. Provider adapter executes mock fulfillment or reservation.
6. Application records provider facts and source attributes.
7. Application builds ReconcileKit inputs.
8. Application calls reconcileRecords().
9. Application persists or derives ReconciliationReport-backed transaction state.
10. UI renders timeline, status explanation, receipt, evidence, and next action.
11. Admin UI renders queues from ReconcileKit outcomes plus resolution state.
```

## ReconcileKit Outcome Usage

Use existing outcomes directly:

- `MATCH`: facts reconcile.
- `DISCREPANCY`: confirmed mismatch exists.
- `UNRESOLVED`: status or validation cannot be conclusively evaluated.
- `HELD_AMBIGUOUS`: duplicate/conflicting candidates prevent safe pairing.
- `INPUT_ERROR`: invalid normalized input.
- `MISSING_PROVIDER_RECORD`: expected side has no provider counterpart.
- `UNMATCHED_PROVIDER_RECORD`: provider side has no expected counterpart.
- `MISSING_REFERENCE`: missing or unusable reference.

> **Phase 2K pilot note:** per `RECONCILE_KIT_INTEGRATION_DESIGN.md` §8 row 5
> and open decision #1 (option a), duplicate expectations for one join key in
> the marketplace demo are **deduped** — the bridge emits one expected row and
> the pilot surfaces `MATCH` plus an app-level `DUPLICATE_PROVIDER_RESPONSE`
> marker. `HELD_AMBIGUOUS` remains the engine's behavior when both candidate
> rows are emitted (unit-covered in the root engine; not reachable from the 16
> seeded scenarios).

The marketplace may have customer-friendly status labels, but those labels must be derived from, not replace, these outcomes.

## Customer Status Model

The UI can translate technical outcomes into explanations:

| ReconcileKit Outcome        | Customer-Friendly Meaning                     |
| --------------------------- | --------------------------------------------- |
| `MATCH`                     | Confirmed                                     |
| `DISCREPANCY`               | Needs attention: details do not match         |
| `UNRESOLVED`                | Not fully confirmed yet                       |
| `HELD_AMBIGUOUS`            | Manual review required                        |
| `INPUT_ERROR`               | Internal record problem                       |
| `MISSING_PROVIDER_RECORD`   | Provider confirmation missing                 |
| `UNMATCHED_PROVIDER_RECORD` | Provider reported an extra transaction        |
| `MISSING_REFERENCE`         | Reference missing, cannot match automatically |

This mapping is presentation logic. It should not change the domain outcome.

## Timeline Integration

Timeline events should include both marketplace/application events and ReconcileKit determination events.

Example event types:

- `ORDER_INTENT_CREATED`
- `PAYMENT_AUTHORIZATION_STARTED`
- `PAYMENT_AUTHORIZED`
- `WALLET_DEBIT_PENDING`
- `WALLET_DEBIT_SUCCESS`
- `PROVIDER_REQUEST_SENT`
- `PROVIDER_RESPONSE_RECEIVED`
- `PROVIDER_RESPONSE_DELAYED`
- `RECONCILEKIT_INPUT_BUILT`
- `RECONCILEKIT_RECONCILED`
- `MISMATCH_DETECTED`
- `MONITORING_STARTED`
- `REFUND_INITIATED`
- `REFUND_COMPLETED`
- `MANUAL_REVIEW_REQUIRED`
- `RECEIPT_GENERATED`

All demo timestamps must be clearly simulated.

## Evidence Pack Integration

Evidence should be assembled from:

- Order intent.
- Wallet/payment ledger event.
- Provider adapter result.
- ReconcileKit `MatchResult`.
- Source attributes.
- Resolution workflow events.
- Audit events.

Evidence should include raw provider facts only when safe. Secrets and full gift-card codes must be omitted or masked.

## Refund And Reversal Integration

The existing ReconcileKit core explicitly defers full refund lifecycle and settlement reconciliation. The marketplace MVP should therefore model refunds/reversals in the application layer as simulated resolution workflows.

Do not add refund-specific semantics to the ReconcileKit domain until a deliberate domain decision is made.

For MVP:

- Use application-level refund/reversal states.
- Show refund/reversal events in the timeline.
- Include refund/reversal fields in evidence.
- Keep ReconcileKit focused on comparing expected and provider/payment facts.
- Tests should prove refund/reversal UI state does not rewrite core reconciliation outcomes.

## Ticketing Integration

Ticketing should produce expected and received facts:

- Expected: selected ticket, passenger/customer details, price, currency, reservation intent, customer reference.
- Received: provider reservation/issuance reference, amount, currency, provider status, issue timestamp.

Payment may reconcile while ticket issuance remains unresolved. That distinction should be visible:

- Payment truth from ReconcileKit.
- Fulfillment truth from provider/ticketing workflow.
- Resolution state for cancellation/refund.

## Gift Card Integration

Gift card transactions should produce:

- Expected: brand, region, denomination, quantity, price, currency, reference.
- Received: provider fulfillment reference, delivery status, redemption/code status, amount/currency facts, safe masked evidence.

Sensitive mock code details should be protected even though they are simulated.

## What Must Not Change For MVP

- The root reconciliation outcome vocabulary.
- Exact-reference matching as the current matching strategy.
- Integer minor-unit monetary comparison.
- Duplicate safety behavior.
- Multi-discrepancy aggregation.
- Paystack adapter status mapping, especially `abandoned` and `reversed` staying `UNKNOWN`.
- Secret handling boundaries.
- The distinction between operational failures and reconciliation outcomes.
- Existing CLI file mode and live-mode contracts.

## What Can Be Extended

- Storefront domain types around catalog, marketplace orders, wallet simulation, service fulfillment, evidence, timeline, and resolution state.
- Storefront HTTP routes or UI routes.
- JSONL store kinds if the local-first MVP continues with JSONL.
- Reconcile bridge adapters for non-Paystack mock provider facts.
- Demo seed data.
- Tests around new marketplace scenarios.
- Documentation and run instructions.

## Ambiguities

The existing ReconcileKit model is payment-event focused. The marketplace vision includes fulfillment concepts such as gift-card delivery and ticket issuance. The least destructive choice is to keep ReconcileKit responsible for payment/provider transaction truth while the marketplace application records fulfillment state and evidence around it.

The existing `PaymentRecord.refundStatus` type contains refund values, but current code always sets it to `NONE`. The MVP can use this as an application-level field, but should not claim that ReconcileKit reconciles the full refund lifecycle.

The existing storefront stores `provider_id` as `null` in bridge output because Paystack transaction id is not persisted in payment metadata. The MVP can improve provider id persistence in new mock provider records without changing the root domain.

## Integration Tests Required

At minimum:

- Successful marketplace transaction reaches `MATCH`.
- Provider failure creates clear timeline and ReconcileKit-backed state.
- Provider timeout remains an operational/application event and does not become a fake domain discrepancy.
- Pending transaction shows missing provider confirmation.
- Duplicate provider response reaches `HELD_AMBIGUOUS`.
  (Pilot revision per DESIGN decision #1a: duplicate expectations dedupe to
  `MATCH` + `DUPLICATE_PROVIDER_RESPONSE` in the seeded scenarios; the raw
  engine path remains covered by root tests.)
- Duplicate debit is visible in wallet/resolution evidence.
- Amount mismatch reaches `AMOUNT_MISMATCH`.
- Missing provider reference reaches `MISSING_REFERENCE`.
- Mismatched provider reference is blocked or shown as mismatch according to adapter contract.
- Refund initiated/pending/completed states are visible without mutating core reconciliation semantics.
- Evidence pack includes ReconcileKit result and safe source attributes.
