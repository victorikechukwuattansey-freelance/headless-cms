# 5C — Webhooks (Phase Closure)

Closure record for the 5C (webhooks) track of Phase 5. The track
delivered Paystack webhook ingestion as a first-class evidence producer
feeding the `payment_events` pipeline. Refund webhooks are deferred to
a future resolution-layer increment with the reasoning preserved below.

Detailed inventories remain in the pre-flight documents referenced at
the end of this file.

## What 5C delivered

### 5C.1 — Signature verification + payload normalization (0f6f28a)

Pure functions only — no HTTP, no DB, no `ingestPaymentEvent` call.

- `src/marketplace/payment-sources/webhook-signature.ts` —
  HMAC-SHA512 verification of `x-paystack-signature` header using
  `node:crypto`. Constant-time comparison (`timingSafeEqual`) with
  explicit length-mismatch handling — returns false, never throws.
- `src/marketplace/payment-sources/webhook-payload.ts` —
  normalizes charge webhook payloads to `PaymentEventInput`.

Owner rulings:

- R2 — Supported event set: `charge.success` → SUCCESS;
  `charge.failed` → FAILED. `refund.processed` deferred (5C.3).
- R3 — `transaction_id` is ALWAYS `null` in webhook-originated
  evidence. "Raw intake never fabricates `mk_txn_` anchors."
- R4 — Store `sha256(rawBody)` in `source_attributes.payload_hash`.
  No full-payload storage in 5C.1.

Load-bearing implementation detail: `source_event_id` is qualified
(`charge.success:<id>` or `charge.failed:<id>`). Without the prefix,
`pevt_<stableToken>` would collide on two events for the same charge
(event_type is `"PAYMENT"` for both) and drop one delivery silently.

Tests: 12 (6 signature, 6 payload). Baseline 606 → 618.

### 5C.2 — HTTP endpoint (c5ac43d + 54952d6)

`POST /webhook/paystack` — receives the webhook, verifies signature,
normalizes payload, calls `ingestPaymentEvent(repos, normalized)`,
responds per ruling R2.

Owner rulings:

- R2 — Status codes: 200 (fresh/replay/ignored), 400
  (INVALID_SIGNATURE, MALFORMED_PAYLOAD, INVALID_PAYLOAD), 500
  (INGEST_FAILED), 404 (webhook-not-configured). No 415.
- R3 — `application/json` only (charset param optional).
- R4 — No currency filter. Workaround: `PaystackAdapterOptions.
supportedCurrencies` is required with no permissive default, so
  the endpoint passes a synthetic allowlist of all 3-letter uppercase
  currency codes. Documented in `paystack-webhook.ts`.
- R5 — Secret access: `config.paystackSecretKey` directly. Fail-soft
  registration: if secret empty at boot, route not registered,
  requests fall through to 404. Logged at boot.
- R6 — JSON envelope; error body matches `/verify` shape
  (`{ error: { code, message } }`).
- R7 — Route placement: `/webhook/paystack` checked BEFORE
  `tryHandleMarketplace` in the dispatch chain, sidestepping an
  over-matching behavior in the marketplace handler.

Raw-body reader is module-local to `paystack-webhook.ts` — reads
`IncomingMessage` stream into `Buffer[]`, concatenates, decodes UTF-8.
Required because the storefront's existing `readJsonBody` helper
consumes the stream during parse; the webhook route must capture the
exact bytes before any parse.

Tests: 13. Baseline 618 → 631.

### 5C.3 — Refund webhooks (DEFERRED, no work)

Recommendation A from `docs/5c3-preflight.md`: keep refunds
operator-driven; continue returning 200-ignored for `refund.*`.

Reasons (verified against code, not just prior rulings):

- **No anchor lookup.** No repository method resolves a Paystack
  `transaction_reference` to an `mk_txn_` anchor. Webhook-originated
  charge evidence has `transaction_id: null` (5C.1 R3); refund
  resolution needs `mk_txn_` to call `completeTransactionRefund`.
- **Reconciliation does not infer refunds.** Code check:
  `reconcile.ts` passes `transaction.resolutionStatus` through to
  truth-building (lines 116, 181, 239); it does not derive it from
  `payment_events`. `truth.ts` treats `resolutionStatus` as an input
  to determination (lines 43, 55-58, 64-72, 199). The status is set
  by the resolution layer (`completeTransactionRefund` at 1f.4),
  not by reconciliation.
- **Extending `CanonicalPaymentStatus`** with `"REFUNDED"` would
  reopen frozen core (`model.ts`, `validation.ts`,
  `DEFINITIVE_SOURCE_STATUSES`) and requires owner ruling. Not
  justified by any current production gap.

Paystack refund payload facts recorded for future scope (not in
scope of 5C):

- `refund.processed` uses `data.transaction_reference`, not
  `data.reference` (charge payloads use `data.reference`).
- Refund `amount` is a string, not a number.
- `refund_reference` may be null.
- `refund.failed` means the merchant account was credited, not that
  payment failed. Any future status mapping must not collapse
  `refund.failed` into `"FAILED"`.

## Final state at 5C closure

- Storefront: **631 / 631**
- Core: **213 / 213**
- Zero filesystem persistence introduced by 5C
- All production I/O continues through `repos.*` + `deps.catalog`
- Webhook endpoint live, HMAC-verified, evidence-first

## Test-count trajectory

```
606  (5B.1 closure)
618  (5C.1, signature + normalization: +12)
631  (5C.2, endpoint: +13)
631  (5C.3, no work — refunds deferred)
```

Net across 5C: **606 → 631** (+25 tests).

## Standing guarantees after 5C

- `transaction_id: null` for all webhook-originated evidence (R3).
  The webhook is a producer of evidence; `mk_txn_` pairing is
  reconciliation's job.
- HMAC-SHA512 constant-time verification on all webhook deliveries.
- Fail-soft webhook registration: no secret → route absent → 404.
- Raw body read before any JSON parse step, preserving exact
  signed bytes.
- Refunds stay operator-driven (5C.3 ruling A).

## Open questions from 5C

- **`isMarketplacePath` routing** — `tryHandleMarketplace` may
  over-match non-marketplace paths when marketplace deps are
  present. Sidestepped by route placement (5C.2 R7). A broader
  routing refactor is a separate concern.
- **`PaystackAdapterOptions.supportedCurrencies`** — required with
  no permissive default. The webhook generates a synthetic
  allowlist as a workaround. Adding an explicit `acceptAnyCurrency`
  flag would require touching frozen core.
- **Paystack refund payload semantics** — four facts above
  recorded for whoever scopes a future refund increment.
- **Test suite duration** — trending from ~194s (5B.1e) to ~240s
  (5C.2). One run timed out at 180s wall-clock before passing.
  Not blocking; watch for further growth and consider file-level
  parallelization if the trajectory continues.

## References

- `docs/5c-preflight.md` — 5C track pre-flight (recommendation for
  decomposition, request pipeline analysis)
- `docs/5c2-preflight.md` — 5C.2 endpoint pre-flight (raw-body
  access, secret wiring, route placement)
- `docs/5c3-preflight.md` — 5C.3 refunds pre-flight (recommendation
  A, anchor-lookup gap, domain-model analysis)
- `docs/5b1-final-handoff.md` — post-5B.1 handoff (updated at 5C
  closure)
