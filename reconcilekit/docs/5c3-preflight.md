# 5C.3 Pre-Flight — Paystack Refund Webhooks

**Project:** ReconcileKit (Core + Storefront)  
**Type:** Read-only pre-flight / scoping evidence  
**Date:** 2026-10-22  
**Baseline:** `54952d6` (`chore(5c2): format pre-flight + document webhook currency policy`)  
**Scope authority:** owner 5C.3 prompt plus `docs/5c-preflight.md` and
`docs/5c2-preflight.md`  
**Evidence authority:** current `storefront/src`, `storefront/test`,
`reconcilekit/src`, and the official Paystack Refunds documentation cited in
Part 2.

---

## Summary (recommendation A/B/C/D + one-line risk)

**Recommendation: A — do not ingest refund webhooks in 5C.3. Keep refunds in
the operator/resolution layer and continue acknowledging `refund.*` with
`200 ignored`.**

- **A:** no refund-webhook ingestion; refunds remain operator-driven through
  `initiateTransactionRefund` / `completeTransactionRefund`.
- **B:** store refund events through the existing `PaymentEvent` path by
  reusing the existing `CanonicalPaymentStatus` vocabulary.
- **C:** extend the frozen `CanonicalPaymentStatus` vocabulary with
  `REFUNDED` and map refund events to it.
- **D:** add a refund-specific ingress into the resolution layer, including a
  provider-reference-to-`mk_txn_` lookup and refund-event persistence.

**One-line risk:** manual completion can lag or diverge from Paystack's real
refund state, and the platform cannot prove refund completion from webhook
evidence alone.

**Readiness verdict:** A is ready to close with no implementation. B, C, and D
are not ready for implementation: B overloads payment evidence, C requires an
owner ruling on the frozen canonical status model, and D requires a new
anchor/lookup and resolution ingress that do not exist.

---

## Part 1 — Current refund-webhook behavior

### 1a. The HTTP endpoint already rejects refunds safely

`storefront/src/application/paystack-webhook.ts` verifies the signature and
then calls `paystackWebhookPaymentEvent`. When the normalizer returns `null`,
the endpoint responds:

```ts
if (normalized === null) {
  respondJson(res, 200, {
    ignored: true,
    reason: "unsupported_event_type",
  });
  return;
}
```

That is the current behavior for every refund event. The event is verified but
not parsed into payment evidence and not persisted.

The current route is `POST /webhook/paystack`, not `/webhooks/paystack`.

### 1b. The normalizer is charge-only

`storefront/src/marketplace/payment-sources/webhook-payload.ts` defines:

```ts
export const PAYSTACK_WEBHOOK_EVENT_STATUS = {
  "charge.success": "SUCCESS",
  "charge.failed": "FAILED",
} as const;
```

`isSupportedEvent` accepts only those two events. The module comment states the
policy explicitly:

> Unsupported events return `null`. Refund events are deliberately deferred;
> they belong to the resolution layer, not payment-source evidence.

There is no `PaystackRefundData`, `RefundPayload`, or refund normalizer in the
repository.

### 1c. Existing tests lock in the ignore behavior

- `storefront/test/marketplace/paystack-webhook.test.ts:105-109` asserts that
  `refund.processed`, `transfer.success`, and `charge.dispute.created` all
  normalize to `null`.
- `storefront/test/server.test.ts:788-802` posts a signed `refund.processed`
  payload and asserts `200`, `{ ignored: true, reason: "unsupported_event_type" }`,
  and zero stored events for the reference.

### 1d. Refunds already have a separate manual workflow

The storefront already has an operator refund path:

- `POST /admin/transactions/:id/refund` calls `initiateTransactionRefund`.
- `POST /admin/transactions/:id/refund/complete` calls
  `completeTransactionRefund`.
- `initiateTransactionRefund` creates a `RefundRecord` with status `PENDING`,
  updates the transaction to `REFUND_PENDING`, and posts wallet ledger entries.
- `completeTransactionRefund` requires a `PENDING` refund, posts the wallet
  refund, sets the refund to `COMPLETED`, and sets the transaction to
  `REFUNDED`.

Neither function calls Paystack. The current refund lifecycle is a local
operator workflow, not provider-driven refund ingestion.

### 1e. Scope of the existing refund record

`RefundRecord` is:

```ts
export interface RefundRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: RefundLifecycleStatus;
  readonly reason: string;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly ledgerReference: string | null;
  readonly simulated: true;
}
```

The id is deterministic: `ref_<transactionId>`. There is no Paystack refund
reference, no provider event id, and no provider status field. The repository
provides only `insert`, `readLatestById`, and `list`.

---

## Part 2 — Paystack refund contract

### 2a. Official event set

Paystack documents five refund events:

| Event                    | Meaning                                                 | Transaction status |
| ------------------------ | ------------------------------------------------------- | ------------------ |
| `refund.pending`         | Refund initiated; waiting for the processor             | Reversal Pending   |
| `refund.processing`      | Refund received by the processor                        | Reversal Pending   |
| `refund.needs-attention` | Customer bank details are needed to continue            | Reversal Pending   |
| `refund.failed`          | Refund could not be processed; account is credited back | Success            |
| `refund.processed`       | Refund successfully processed by the processor          | Reversed           |

The docs also note that a `processed` refund may still take up to 10 business
days before the customer receives the funds.

This is not the same as a payment status. In particular, `refund.failed` leaves
the original transaction successful and credits the merchant account; mapping it
to payment `FAILED` would be wrong.

### 2b. The refund webhook payload is not a charge payload

The official `refund.pending` example is:

```json
{
  "event": "refund.pending",
  "data": {
    "status": "pending",
    "transaction_reference": "tvunjbbd_412829_4b18075d_c7had",
    "refund_reference": null,
    "amount": "10000",
    "currency": "NGN",
    "processor": "instant-transfer",
    "customer": {
      "first_name": "Drew",
      "last_name": "Berry",
      "email": "customer@example.com"
    },
    "integration": 412829,
    "domain": "live"
  }
}
```

Important differences from the charge payload:

- the transaction reference is `data.transaction_reference`, not
  `data.reference`;
- there is no charge `data.id`;
- `data.amount` is a string in the official example, while
  `PaystackTransactionData.amount` is a number;
- `data.refund_reference` may be `null`;
- the payload carries refund state such as `pending`, `processing`,
  `needs-attention`, `failed`, or `processed`, not a charge status.

`PaystackTransactionData` has no `transaction_reference`,
`refund_reference`, `processor`, or refund-specific fields. Reusing the charge
normalizer without a refund-specific adapter would either drop the reference or
throw on the string amount.

### 2c. The Create Refund response is a different shape again

The Create Refund API response contains a nested `data.transaction` object with
`data.transaction.reference`. The refund webhook does not. A mapping based on
the Create Refund response would therefore be wrong for the webhook.

### 2d. Identity and idempotency implications

A refund webhook can identify the original payment with
`transaction_reference` and identify the refund with `refund_reference`
(possibly `null`) plus the event name and refund status. That is enough to
build a refund-specific identity, but not enough to reuse the current
`source_event_id = <event>:<data.id>` rule.

The current ingest identity also assumes `event_type: "PAYMENT"`. A refund
event is not a payment event. Extending the same table would conflate two
different lifecycles.

---

## Part 3 — Anchor lookup feasibility

### 3a. Answer

**NO.** There is no supported path today from a Paystack refund
`transaction_reference` to a marketplace transaction anchor (`mk_txn_…`).

### 3b. What the repositories expose

- `RefundRepository`: `insert`, `readLatestById`, `list`. `readLatestById`
  requires the deterministic id `ref_<transactionId>`, so the caller must
  already know the transaction id.
- `MarketplacePaymentRepository`: `insert`, `readLatestById`,
  `findByOrderId`, `list`. It has no `findByProviderReference`.
- `PaymentEventRepository`: `insert`, `getById`, `list`. It has no
  `findByPaymentSourceReference`.
- `MarketplaceTransactionRepository`: `insert`, `readLatestById`, `list`. It
  has no lookup by provider reference.
- The legacy order/payment repositories also have no Paystack-reference
  lookup.

### 3c. The data exists, but the query does not

`MarketplacePaymentRecord` has `providerReference`, and the underlying
`marketplace_payments` table has a `provider_reference` column. In principle, a
refund `transaction_reference` could be matched to
`marketplace_payments.provider_reference` and then to `transactionId`.

But:

1. no repository method performs that query;
2. there is no uniqueness guarantee on `provider_reference`;
3. not every charge is a marketplace payment;
4. a `charge.success` webhook accepted by 5C.2 deliberately stores
   `transaction_id: null` and `merchant_reference: null`;
5. `payment_events.payment_source_reference` is indexed but has no repository
   query, and multiple events can share one source reference.

### 3d. Consequence

A refund webhook cannot safely call `initiateTransactionRefund` or
`completeTransactionRefund` today. Both require `transactionId` as input, and
there is no resolver that can produce it from the Paystack reference without
new code and a new ownership decision for the lookup.

---

## Part 4 — Reconciliation vs. operator resolution

### 4a. Reconciliation does not infer refunds

`storefront/src/marketplace/payment-sources/to-reconcilekit.ts` maps each
`PaymentEvent` to a merchant row and, only when an anchor and definitive status
exist, a provider row:

```ts
merchant_reference: event.merchant_reference ?? event.transaction_id
...
reference: event.transaction_id
...
provider_id: event.payment_source
```

The external source reference is preserved only as evidence:

> The actual external provider/payment-source reference is preserved separately
> as source evidence (`payment_source_reference` and source attributes) and is
> never the reconciliation anchor or join key.

There is no refund pairing, no refund event type, and no reduction of the
merchant amount by a refund.

### 4b. Paystack `reversed` becomes `UNKNOWN`, not `REFUNDED`

`reconcilekit/src/adapters/providers/paystack/paystack.ts` maps:

```ts
abandoned: "UNKNOWN",
reversed: "UNKNOWN",
```

`reconcilekit/src/domain/validation.ts` then treats `UNKNOWN` as unresolved:

```ts
if (merchantStatus === "UNKNOWN" || providerStatus === "UNKNOWN") {
  return {
    applicable: true,
    passed: false,
    code: "STATUS_UNRESOLVED",
    note: `status unresolved: merchant ${merchantStatus} vs provider ${providerStatus}`,
  };
}
```

The core test at `reconcilekit/src/adapters/providers/paystack/paystack.test.ts:175`
explicitly asserts that `abandoned` and `reversed` never map to `CANCELLED`.

### 4c. The harness refund fixture is not production behavior

`storefront/test/marketplace/webhook-harness.test.ts:110-143` manually
constructs a refund-shaped delivery with:

```ts
source_event_id: "evt_refund_001",
status: "CANCELLED",
source_attributes: {
  original_status: "reversed",
  webhook_event: "refund.processed",
},
```

It also supplies `transaction_id: "mk_txn_demo"` from the test fixture. This
proves that the ingest boundary is order-agnostic for distinct event identities.
It does **not** prove that a real `refund.processed` webhook normalizes, that
the normalizer stores a refund, or that reconciliation resolves the refund.

### 4d. Current division of responsibility

Refunds are resolution-layer data:

- `ResolutionStatus` already includes `REFUNDED`;
- `RefundRecord` already models the lifecycle;
- `refunded` is reflected in customer/admin transaction status;
- `initiateTransactionRefund` and `completeTransactionRefund` own the
  transitions;
- the webhook layer explicitly defers refund events to that layer.

Reconciliation remains payment-evidence reconciliation over the original
charge. It does not become a refund matcher.

---

## Part 5 — Option analysis

### 5a. A — do not ingest refund webhooks

**Meaning:** keep `refund.*` ignored with `200`; operators reconcile refunds
against Paystack and use the existing initiate/complete actions.

**Impact:** no source, test, schema, config, or frozen-boundary change.

**Benefit:** preserves the payment-evidence/resolution separation; no taxonomy
misuse; no unsafe anchor lookup.

**Cost:** manual operator work; no automatic proof of refund completion.

**Verdict:** recommended for 5C.3.

### 5b. B — store refunds as existing payment events

**Meaning:** map refund events into `PaymentEvent` using the existing
`CanonicalPaymentStatus` values. Because there is no `REFUNDED`, this would
require semantically false mappings such as `refund.processed` → `CANCELLED`
or `UNKNOWN`, and `refund.failed` → `FAILED`.

**Impact:** no frozen core edit is strictly required, but the storefront would
overload `PaymentEventType = "PAYMENT"` and the payment-evidence contract.

**Problem:** `refund.failed` actually means the refund failed and the merchant
account was credited; `refund.processed` means the transaction is reversed.
Forcing either into a payment status corrupts the meaning of the event and
creates false reconciliation signals.

**Verdict:** rejected. Do not use without an explicit owner ruling that refunds
are payment evidence, which they are not.

### 5c. C — extend `CanonicalPaymentStatus` with `REFUNDED`

**Meaning:** add `REFUNDED` to the frozen canonical domain and map
`refund.processed` to it.

**Exact frozen-boundary interaction:**

- `reconcilekit/src/domain/model.ts:1-2` defines
  `CanonicalPaymentStatus` as
  `PENDING | SUCCESS | FAILED | CANCELLED | UNKNOWN`.
- `reconcilekit/src/domain/validation.ts:12-18` duplicates that list in
  `CANONICAL_STATUSES`; it would need to change in sync.
- `reconcilekit/storefront/src/marketplace/payment-sources/types.ts:38-39`
  defines `DEFINITIVE_SOURCE_STATUSES`; whether `REFUNDED` is definitive is a
  reconciliation-semantics decision.
- The matcher and status-comparison tests would need new expectations for
  refunded vs. successful/unknown statuses.
- `storefront/src/marketplace/types.ts` is also frozen by the 5C pre-flight;
  extending `RefundRecord` or `ResolutionStatus` must be authorized separately.

**Problem:** a refund is a post-payment resolution, not a payment status. Adding
`REFUNDED` to the canonical payment union would make the payment lifecycle and
the resolution lifecycle share vocabulary they do not share today.

**Verdict:** deferred. This is an owner decision, not a 5C.3 recommendation.

### 5d. D — add a refund-specific resolution ingress

**Meaning:** verify and normalize refund events into a dedicated refund-event
model, resolve `transaction_reference` to an `mk_txn_` anchor, and drive the
existing resolution transitions (or a new refund workflow).

**What it requires:**

- a new lookup from Paystack `transaction_reference` to `mk_txn_`, owned by a
  specific table;
- refund-specific normalization for `pending`, `processing`,
  `needs-attention`, `failed`, and `processed`;
- handling of partial refunds (the current operator flow refunds
  `expectedAmountMinor` in full and accepts no amount input);
- idempotency keyed by refund event/reference, not charge event id;
- persistence or audit for refund events;
- a defined policy for `needs-attention` (operator action) and `failed`
  (account credit, not payment failure);
- owner approval for changes to frozen storefront types and possibly schema.

**Benefit:** the only structurally honest route to automated refunds.

**Verdict:** not ready. It is a separate increment after owner decisions and
cannot be smuggled into the webhook endpoint.

---

## Part 6 — Recommendation and exact next action

### 6a. Recommendation

Adopt **A** for 5C.3:

1. Keep `refund.*` unsupported in the current webhook normalizer.
2. Keep returning `200 { ignored: true, reason: "unsupported_event_type" }`
   after signature verification.
3. Keep refunds operator-driven through the existing admin refund actions.
4. Do not add a refund feature flag, a second ingest path, or a schema change
   in this increment.

### 6b. Why A is the smallest correct decision

- The endpoint already fails safe for refunds.
- No refund payload type exists.
- No anchor lookup exists.
- Refund events are semantically different from payment events.
- The existing refund lifecycle is explicitly local and operator-driven.
- B would misuse the payment vocabulary; C would alter frozen canonical
  semantics; D is a larger, separately-scoped feature.

### 6c. What A does not claim

A does not claim refund webhooks are unimportant. It records that the current
architecture has no correct place for them without a new resolution-layer
design. If the owner requires automation, D is the direction to scope next.

### 6d. Verification for this pre-flight

- No source, test, schema, configuration, package, or migration changes were
  made.
- The only created file is this document.
- The recorded test baseline after 5C.2 is storefront **631/631** and core
  **213/213**; this pre-flight did not run tests.
- `git status --short -- reconcilekit/` was empty at the start.
- No `*DATABASE*` environment variables were set at the start.

### 6e. Exact next action

**If A is approved:** close 5C.3 as a no-code decision and keep the existing
ignore behavior. Revisit only when the owner authorizes a resolution-layer
refund ingress.

**If D is chosen:** write a separate scoping pre-flight that names the anchor
owner, partial-refund policy, `needs-attention` handling, event persistence,
idempotency identity, and exact frozen-type/schema changes before any code is
written.

---

## Open questions requiring owner ruling

1. **Automation:** must 5C.3 automate refund ingestion, or may refunds remain
   operator-driven? Recommendation: remain operator-driven for now.
2. **Canonical status:** should `CanonicalPaymentStatus` ever include
   `REFUNDED`? This is a frozen-core decision and is not proposed by this
   pre-flight.
3. **Anchor owner:** if refunds are automated later, which table owns the
   Paystack-reference-to-`mk_txn_` mapping: `marketplace_payments`,
   `payment_events`, or a new refund-event table?
4. **Partial refunds:** should the platform support partial refunds? The
   current operator flow always refunds the payment's full expected amount.
5. **`refund.failed`:** confirm it must not be mapped to payment `FAILED`; the
   original transaction remains successful and the merchant account is
   credited.
6. **`refund.needs-attention`:** should this create an operator queue item or
   notification, and who is responsible for retrying with bank details?
7. **Identity:** what is the idempotency key for refunds when
   `refund_reference` is `null`? Event name plus `transaction_reference` alone
   may not distinguish multiple refund attempts.
8. **Provider calls:** should the storefront call Paystack Create Refund /
   Retry Refund, or only mirror Paystack-originated refund events? Current
   code does neither.
9. **Raw audit:** does 5C.3 require durable raw refund-delivery audit? The 5C.2
   endpoint stores only payment-event source attributes and a payload hash.
10. **Frozen types:** if D is approved, which of
    `storefront/src/marketplace/types.ts`, `RefundRecord`, `ResolutionStatus`,
    and `RefundLifecycleStatus` may change?
11. **Out-of-order events:** how should a late `refund.pending` be handled after
    `refund.processed`, and vice versa?
12. **Status mapping:** confirm the desired local lifecycle for each Paystack
    refund status, including `processing` and `needs-attention`.
