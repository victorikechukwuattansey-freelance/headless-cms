# 5C Pre-Flight - Paystack Webhook Ingestion

**Project:** ReconcileKit (Core + Storefront)
**Type:** Read-only pre-flight / scoping evidence
**Date:** 2026-10-20
**Baseline:** `1bb0675` (`docs(5b1f): close 5B.1f; 5B complete`)
**Scope authority:** `docs/PHASE_5_OPENING.md` Section 3 (5C)
**Evidence authority:** current `storefront/src` and `storefront/test`, plus the
official Paystack Webhooks documentation cited in Section 3.

---

## Summary (recommendation A/B/C + one-line risk)

**Recommendation: B - two increments.**

- **5C.1** - pure Paystack signature verification + webhook payload
  normalization. Storefront source and unit tests only. No route, no schema,
  no audit table.
- **5C.2** - raw delivery audit persistence + `POST /webhooks/paystack`
  wiring + route/integration tests.

**One-line risk:** the existing Paystack normalizer derives
`source_event_id` from `data.id` only and ignores the top-level `event`; that
is safe for `charge.success` retries but can collapse distinct event types
for the same transaction if 5C accepts refunds or disputes without a
webhook-specific event identity.

**Readiness verdict:** ready to start 5C.1 under recommendation B. Not ready
to wire the endpoint until the owner resolves the event set, anchor semantics,
audit-table decision, and response-code policy in Section 8.

---

## 1. Objective and scope

### 1a. Goal

Add a Paystack webhook receiver that:

1. accepts `POST /webhooks/paystack`;
2. verifies `x-paystack-signature` using HMAC-SHA512 over the exact raw
   request body and the Paystack secret key;
3. normalizes a verified Paystack event into the existing payment-source
   vocabulary;
4. feeds it through the existing `payment-sources/ingest.ts` boundary;
5. persists the raw delivery for audit;
6. leaves the polling path (`pilot-run --live-paystack`) as a fallback.

### 1b. In scope

- `POST /webhooks/paystack` in the storefront.
- HMAC-SHA512 signature verification.
- Existing `ingestPaymentEvent(repos, input)` boundary. No new ingest logic.
- Durable raw delivery audit.
- Public (unauthenticated by session) route with signature-based
  authentication.
- Paystack-only. One provider.

### 1c. Out of scope

- Webhooks from Flutterwave or any other provider.
- Forwarding events to third parties.
- Admin UI for webhook status.
- Paystack IP allowlisting (the Paystack docs offer it; 5C scopes HMAC only).
- Rate limiting (still deferred by `PHASE_5_OPENING` Section 6).
- Changing the matcher, wallet, truth, identifier hierarchy, or frozen core.
- Replacing the polling path. It remains a fallback.

### 1d. Correctness framing

`PHASE_5_OPENING` records that 3E was opened for production readiness, not a
correctness gap. `docs/PHASE_3E_FINDINGS.md` says the existing ingest boundary
already handled every webhook-class delivery in its 7/7 harness. 5C must not
re-litigate that result or add a second ingest path.

---

## 2. Baseline and constraints

### 2a. Repository state

- HEAD: `1bb0675`.
- Branch: `main`.
- `git status --short -- reconcilekit/`: empty at the start of 5C.
- Storefront tests: **606/606**.
- Core tests: **213/213**.
- Storefront typecheck, lint, and `format:check`: green at the 5B.1f close.
- No `*DATABASE*` environment variables are set in the current shell.
- Prisma schema and three migrations exist under `storefront/prisma/`.

### 2b. This pre-flight changes nothing

This document is the only file 5C pre-flight may create. It does not change
`src/`, `test/`, `server.ts`, `schema.prisma`, configuration, or migrations,
and it does not commit anything.

### 2c. Frozen boundaries

Do not modify:

- `reconcilekit/src/**`
- `storefront/src/marketplace/wallet.ts`
- `storefront/src/ids.ts`
- `storefront/src/marketplace/types.ts`
- `storefront/src/marketplace/demo-scenarios.ts`
- `providers/contracts.ts` unless the Paystack adapter cannot produce a valid
  `PaymentEvent`

A webhook adapter may live under `storefront/src/marketplace/payment-sources/`
without reopening the core contract.

---

## 3. External Paystack contract

### 3a. Signature

The official Paystack Webhooks page states:

> Events sent from Paystack carry the `x-paystack-signature` header. The value
> of this header is a HMAC SHA512 signature of the event payload signed using
> your secret key. Verifying the header signature should be done before
> processing the event.

Operational consequences:

- HMAC algorithm: SHA-512.
- Key: the Paystack secret key (`STOREFRONT_PAYSTACK_SECRET_KEY`).
- Input: the **exact raw request bytes**, not a re-serialized object.
- Header value: hex-encoded digest, 128 hex characters for SHA-512.
- Verify before parsing or ingesting anything.
- Use a constant-time comparison after validating the hex shape and length.
  The Paystack example uses `==`; the implementation should use
  `crypto.timingSafeEqual` with an explicit length check.
- If the secret is missing, fail closed. Do not accept the event.
- Do not log the secret or the full signature.

### 3b. Event envelope and acknowledgement

Paystack sends a JSON object shaped as:

```json
{
  "event": "charge.success",
  "data": {
    "id": 4099260516,
    "status": "success",
    "reference": "stf_...",
    "amount": 50000,
    "currency": "NGN",
    "paid_at": "..."
  }
}
```

The transaction status is `data.status`, not the outer event name. The
existing root Paystack adapter already enforces that distinction.

Paystack requires a `200 OK` acknowledgement. The official page says failed
deliveries are retried for up to 72 hours (live: every 3 minutes for the first
4 tries, then hourly). Long-running work should not delay the acknowledgement.

### 3c. Supported events

The official event list includes `charge.success`, `refund.*`,
`charge.dispute.*`, `transfer.*`, subscription, invoice, and identification
events. The repository itself defines no Paystack webhook event list. The only
event names in the codebase are harness fixtures:

- `charge.success`
- `refund.processed`

These are fixtures, not a provider specification. The implementation must
quote the official list, not infer one from the harness.

### 3d. Recommended event policy for 5C

- Accept `charge.success` as payment evidence in the first increment.
- Verify the signature before looking at the event name.
- For a verified but unsupported event, return `200 OK` and do not ingest.
  This prevents Paystack retries for events 5C does not consume.
- Do not ingest `refund.*` or `charge.dispute.*` until the owner confirms the
  event-identity and status-mapping policy. The current adapter can represent
  `reversed` as `UNKNOWN`, but a refund event is not automatically a
  transaction-level payment event.

### 3e. Sources

- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack Verify Payments: https://paystack.com/docs/payments/verify-payments/

The repository's existing Paystack evidence review is
`PAYSTACK-EVIDENCE-VALIDATION.md`. It validates transaction reference, status
vocabulary, amount/subunit behavior, and timestamp fields. It does **not**
define webhook event names or signatures.

---

## 4. Existing implementation surface

### 4a. Route surface

`storefront/src/server.ts` has no webhook route. The core routes are:

- `GET /health`
- `POST /businesses`
- `POST /products`
- `POST /orders`
- `POST /orders/:id/verify` (`server.ts:202`)
- `GET /callback` (`server.ts:213`)
- `GET /reconcile/merchant.csv`

The only `webhook` occurrence in `storefront/src` is a domain comment in
`storefront/src/domain/types.ts`; there is no handler, path constant, or
signature utility.

### 4b. HMAC / signature utilities

There is no existing HMAC utility.

- `storefront/src/ids.ts` imports `randomUUID` from `node:crypto`.
- `storefront/src/auth/sessions.ts` imports `randomBytes`.
- No `createHmac`, `timingSafeEqual`, or signature verification exists in
  `storefront/src` or `storefront/test`.

This is new, isolated code. It belongs in the storefront, not the frozen core.

### 4c. Ingest boundary

`storefront/src/marketplace/payment-sources/ingest.ts`:

- `buildIdempotencyKey(input)` joins
  `payment_source | payment_source_reference | event_type | source_event_id`.
- `buildPaymentEventId(key)` returns `pevt_<stableToken(key)>`.
- `assertSourceIdentity(input)` rejects an event when both
  `payment_source_reference` and `source_event_id` are null with
  `PaymentSourceError("PAYMENT_EVENT_NO_SOURCE_IDENTITY", ...)`.
- `ingestPaymentEvent(repos, input, { now? })` checks the deterministic event
  id, returns `{ recorded: false, replay: true }` on replay, and otherwise
  writes exactly once.
- `PaymentEventRepository.insert` is an upsert on `id`; `event_id` and
  `idempotency_key` are unique in the schema.

Conclusion: no new ingest logic is required. A verified webhook only needs a
valid `PaymentEventInput`.

### 4d. Persistence surface

`storefront/prisma/schema.prisma` has a `PaymentEvent` model
(`schema.prisma:463`) with:

- `id`, `eventId`, `idempotencyKey`
- `transactionId`, `merchantReference`
- `paymentSource`, `paymentSourceReference`, `sourceEventId`
- `eventType`, `amount`, `currency`, `status`, `occurredAt`
- `sourceConfidence`, `sourceAttributes` (JSON), `observedAt`

There is no `WebhookDelivery` model, no raw-delivery table, and no webhook
repository. The three existing migrations are:

- `20261015162346_initial`
- `20261015231236_marketplace_gap_fixes`
- `20261016094131_payments_reference_not_null`

`PaymentEvent.sourceAttributes` is JSON at the database level, but the domain
type `SourceAttributes` is `Readonly<Record<string, string>>`. Storing a
nested raw payload there would require stringifying it or widening the frozen
type. Both are worse than a dedicated delivery table.

### 4e. Existing Paystack normalizers

`storefront/src/marketplace/payment-sources/adapters/paystack.ts`:

- `paystackPaymentEvent(response, options, context)` calls the root
  `mapPaystackResponse`.
- `payment_source_reference` = `mapped.payment.reference`, i.e.
  `data.reference`.
- `source_event_id` = `String(data.id)` when present.
- It ignores the top-level webhook `event` field.
- It takes `transactionId` and `merchantReference` from caller context; it
  does not derive either from the payload.

`reconcilekit/src/adapters/providers/paystack/paystack.ts`:

- Defines `PaystackResponse` and `PaystackTransactionData`.
- Maps `data.status` using `PAYSTACK_STATUS_MAPPING`.
- Preserves `original_status` and time fields in source attributes.
- Validates amount, currency, reference, and timestamps.
- Does not define webhook event names, a webhook envelope, or a signature.

The root adapter can be reused for the `data` object. The webhook-specific
envelope and event identity must be handled in the storefront adapter.

---

## 5. Authentication and routing posture

### 5a. Existing callback and verify routes

`GET /callback` (`server.ts:459`) has **no session authentication and no
signature authentication**. It:

1. reads `orderId` from the query string;
2. looks up the order;
3. calls `verifyOrder(repos, paystack, orderId)`;
4. maps the outcome to HTTP status.

`POST /orders/:id/verify` (`server.ts:418`) also has no session or signature
authentication. Both rely on the persisted order reference plus a Paystack
Verify API call. They are not a signature-verification precedent for the
webhook.

### 5b. Marketplace gate blocks a naive webhook route

`main.ts` always supplies marketplace dependencies to
`createStorefrontServer`. `handleRequest` (`server.ts:164`) calls
`tryHandleMarketplace` first whenever those dependencies exist. That function
(`server.ts:610`) calls `routeMarketplace` and returns `true` in both success
and error paths.

Inside `routeMarketplace` (`server.ts:658`), the session gate (`server.ts:691`)
treats only these as public:

- `GET /login`
- `POST /logout`
- assets, handled earlier

Everything else requires a session and redirects to `/login` if absent
(`server.ts:696`). `isMarketplacePath` exists at `server.ts:595` but is not
called. Therefore a webhook route added after the marketplace check would
redirect to login and never reach its handler.

**Required placement:** handle `POST /webhooks/paystack` before
`tryHandleMarketplace`, or add an explicit public-path branch before the
session gate. The first is smaller and avoids coupling the webhook to the
marketplace router.

### 5c. Body handling

`readJsonBody` (`server.ts:1280`) buffers chunks up to 1 MiB, then parses
JSON and discards the raw bytes. Webhook HMAC verification needs the raw
bytes. Do not change the shared helper for every route. Add a webhook-local
raw-body reader, or add an opt-in raw-buffer return, and keep the 1 MiB limit.

Recommended webhook status posture (subject to owner confirmation):

| Condition                                               | Status         | Notes                            |
| ------------------------------------------------------- | -------------- | -------------------------------- |
| Valid signature + `charge.success` ingested or replayed | `200`          | Acknowledge Paystack             |
| Valid signature + unsupported event                     | `200`          | Ignore, do not ingest            |
| Missing or invalid signature                            | `401`          | No ingest, no event parse        |
| Malformed JSON / non-object body                        | `400`          | No ingest                        |
| Payload fails source identity                           | `400` or `422` | No ingest; retry policy question |
| Body over 1 MiB                                         | `413`          | No ingest                        |
| Ingest or audit persistence failure                     | `500`          | Allows Paystack retry            |
| Non-POST method                                         | `405`          | `Allow: POST`                    |

Do not return `200` for an invalid signature. Do not return `500` for a
permanent payload-shape error.

---

## 6. Test and fixture surface

### 6a. Existing tests

- `storefront/test/marketplace/webhook-harness.test.ts`: **7 tests**, all
  direct calls to `ingestPaymentEvent`; no HTTP, no signature, no route.
- `storefront/test/marketplace/payment-sources.test.ts`: **17 tests**,
  including the Paystack normalizer, ingest replay, anchors, unknown status,
  and missing source identity.
- `storefront/test/server.test.ts`: **22 tests**, with a real HTTP server
  helper (`startServer`) but no marketplace dependencies.
- `storefront/test/paystack-client.test.ts`: **11 tests**.
- `storefront/test/verify-order.test.ts`: **16 tests**.

There is no `storefront/test/marketplace/payment-sources/` directory and no
HTTP webhook test.

### 6b. Fixture gap

`webhook-harness.test.ts` builds a synthetic `PaymentEventInput` via
`webhookDelivery()`, with caller-chosen `source_event_id` values such as
`evt_charge_success_001` and `evt_refund_001`. That proves the ingest boundary,
but it does **not** prove that a real Paystack payload can produce those
identities. The webhook adapter tests must use real Paystack-shaped payloads.

`payment-sources.test.ts` has a reusable `paystackTransaction()` fixture that
takes `PaystackTransactionData` overrides. It can be extended with an `event`
envelope, but the webhook adapter should be tested separately.

### 6c. Required new tests

5C.1 (pure unit tests):

- Valid HMAC over a raw JSON payload.
- Wrong secret, tampered body, missing header, malformed hex, wrong length.
- Raw bytes vs `JSON.stringify(parsedBody)` difference.
- `charge.success` normalization.
- Event identity differs for different event names on the same transaction.
- Missing `data.id` / missing `data.reference`.
- Unsupported event is rejected or ignored by the normalizer.
- Invalid amount/currency/timestamp surfaces the existing adapter error.

5C.2 (repository + HTTP integration tests):

- Valid webhook with no session returns `200` and stores one `PaymentEvent`.
- Replay of the exact delivery stores one event (replay outcome).
- Invalid signature returns `401`, stores no event, and writes an audit row
  if audit-on-rejection is approved.
- Unsupported verified event returns `200` and stores no event.
- Malformed JSON / oversized body returns `400` / `413`.
- Missing source identity returns the agreed permanent-error status.
- Ingest failure returns `500`.
- Route works before the marketplace gate; no `/login` redirect.
- Audit row round-trips through the repository.

Expected test movement: roughly **+20 to +26 storefront tests** (606 -> about
626-632). Core remains **213/213**. These are estimates, not acceptance
promises.

---

## 7. Recommended design and decomposition

### 7a. Recommendation B - two increments

**5C.1 - signature + normalization (no route, no schema, no audit)**

- Add a pure `verifyPaystackSignature(rawBody, signature, secret)` helper.
- Add a webhook-specific Paystack normalizer that:
  - validates `{ event, data }`;
  - accepts `charge.success` in the first increment;
  - composes a source event identity from the event name and transaction id;
  - reuses `paystackPaymentEvent` for the `data` mapping;
  - preserves the webhook event name in source attributes.
- Tests with raw-byte vectors and realistic payloads.

**5C.2 - audit + endpoint**

- Add `WebhookDelivery` persistence and repository.
- Add the webhook service that verifies, parses, normalizes, ingests, and
  audits.
- Add `POST /webhooks/paystack` before the marketplace dispatch.
- Add route and repository tests.
- Add the 5C closure record.

Why B rather than A or C:

- A (one increment) bundles crypto, schema, route, and audit into one
  reviewable diff and hides which layer failed.
- C (three increments) separates the audit table from the endpoint that
  exercises it, adding overhead without reducing the real risk.
- B proves the identity/mapping question first, then adds the durable surface
  and transport.

### 7b. Expected files and tests

5C.1, approximately 4 files:

- `storefront/src/paystack/webhook-signature.ts` (new)
- `storefront/src/marketplace/payment-sources/adapters/paystack-webhook.ts`
  (new)
- `storefront/test/paystack/webhook-signature.test.ts` (new)
- `storefront/test/marketplace/paystack-webhook.test.ts` (new)

5C.2, approximately 9-11 files:

- `storefront/prisma/schema.prisma` (new model)
- `storefront/prisma/migrations/<timestamp>_webhook_deliveries/migration.sql`
  (new)
- `storefront/src/db/repositories/webhook-deliveries.ts` (new)
- `storefront/src/db/repositories/index.ts` (wire the repository)
- `storefront/src/marketplace/webhooks/paystack.ts` or equivalent service
  (new)
- `storefront/src/server.ts` (route before marketplace dispatch)
- `storefront/test/db/repositories/webhook-deliveries.test.ts` (new)
- `storefront/test/marketplace/paystack-webhook-route.test.ts` (new)
- `storefront/test/server.test.ts` (add marketplace-aware startup option or
  route case)
- `storefront/src/config.ts` only if a separate webhook secret is approved
  (recommended: no change; reuse `paystackSecretKey`)

5C.1 should not touch `schema.prisma`, `server.ts`, or `test/server.test.ts`.
5C.2 is the first increment that may change schema and routing.

### 7c. Highest-risk assumption

**The existing Paystack normalizer can produce an event identity that is
idempotent across retries and distinct across event types without changing
`ingest.ts`.**

Current evidence:

- `paystackPaymentEvent` uses `String(data.id)` as `source_event_id`.
- It ignores the top-level `event`.
- The idempotency key includes `event_type`, but `event_type` is always
  `"PAYMENT"`; it is not the Paystack event name.
- For repeated `charge.success`, the key is stable and retries are safe.
- For two different Paystack events on the same transaction, `data.id` may be
  the same; the key can collapse them.

Mitigation: compose `source_event_id` as `<paystack-event>:<data.id>` (or an
equivalent event-specific identity) in the webhook adapter, and prove it with
a `charge.success` replay plus a second event-type fixture. Do not change
`ingest.ts`. If the owner limits 5C to `charge.success`, the risk is contained
but still must be documented.

The second-highest risk is raw audit persistence: `PHASE_5_OPENING` requires
it, but no table or repository exists. A dedicated `WebhookDelivery` model is
the smallest honest implementation. Storing raw JSON in
`PaymentEvent.source_attributes` is not a substitute for auditing rejected
deliveries.

### 7d. Source/test/schema changes before 5C.1

- Producing this pre-flight requires **no** source, test, schema, or migration
  changes. It is a documentation-only step.
- Under recommendation B, **5C.1 itself adds storefront source and tests** but
  no schema and no route.
- **5C.2 is the first increment that adds schema/migration** and the HTTP
  route.
- If the owner requires raw audit in 5C.1, 5C.1 can no longer be schema-free;
  the B split must be re-cut. If the owner requires 5C.1 to be entirely
  code-free, then 5C.1 is not an implementation increment and B collapses to
  A.

---

## 8. Open questions and owner decisions

### 8.1 Event set

Does 5C accept only `charge.success`, or also `refund.*` and
`charge.dispute.*`? Recommendation: `charge.success` only in 5C.1; defer other
events until their status and identity semantics are separately proven.

### 8.2 Anchor semantics

`PaymentEvent.transaction_id` is documented as the marketplace anchor
(`mk_txn_...`). A Paystack webhook contains `data.reference` (`stf_<orderId>`)
and often `data.metadata.order_id`, but no `mk_txn_...`. Is
`transaction_id: null` acceptable for webhook evidence, or must 5C add an
order/transaction lookup to anchor the event?

If the answer is "must anchor", 5C needs a lookup path and a clear definition
of which table owns the mapping. If the answer is "null is acceptable", 5C
stores evidence only and the polling path remains the reconciling path.

### 8.3 Raw audit persistence

Choose one:

- **A (recommended):** new `WebhookDelivery` table + repository + migration.
- **B:** stringify the raw payload into `PaymentEvent.source_attributes`.
  Rejected: no audit for rejected deliveries, no query/index, and the domain
  type is string-only.
- **C:** file log. Rejected: 5B removed production filesystem persistence.

If A, confirm the schema/migration is authorized in 5C.2. If not, 5C cannot
truthfully satisfy "persist raw webhook deliveries for audit."

### 8.4 Audit identity and retention

Should each delivery attempt be a separate audit row, or should identical
retries upsert one row? Recommendation: one row per delivery attempt for
transport audit, with a `payload_sha256` and `received_at`; document that
retries are visible. Alternatively, one row per event with upsert. Also
confirm retention and whether payloads containing customer data need
redaction.

### 8.5 Response codes

Confirm the table in Section 5c, especially:

- invalid signature: `401` vs `400`;
- unsupported verified event: `200` vs `400`;
- missing source identity: `400` vs `422` vs `200` with audit;
- audit failure after ingest: `500` vs `200`.

Paystack retries non-2xx responses. A permanent payload error that returns
`400` will still be retried, but it will not be ingested. That may be
acceptable, or the owner may prefer `200` + audit for permanent errors.

### 8.6 Secret configuration

Reuse `STOREFRONT_PAYSTACK_SECRET_KEY` via `config.paystackSecretKey`.
Recommendation: no separate webhook secret and no config change. Confirm.

### 8.7 Scope of the webhook outcome

Does a successful webhook need to update legacy `payments` / `orders` status,
or only write `payment_events` evidence? `PHASE_5_OPENING` says "feed through
the existing ingest boundary," which points to `payment_events` only. Confirm
that the legacy order status is not a 5C deliverable.

### 8.8 IP allowlisting and re-verification

Paystack documents optional IP allowlisting. 5C scope names HMAC only.
Confirm IP allowlisting is out of scope. Also confirm whether a verified
`charge.success` should be re-verified through the Paystack Verify API before
ingest, or whether HMAC plus payload normalization is sufficient. The scope
suggests the latter.

---

## 9. Readiness verdict and exact next action

**Verdict:** 5C is ready for **5C.1** under recommendation B. The endpoint
should not be wired until Section 8.2 (anchor), 8.3 (audit), and 8.1 (event
set) are answered.

**Exact next action:** owner approves B and answers 8.1-8.3. Then implement
5C.1 only:

1. Add `verifyPaystackSignature`.
2. Add the Paystack webhook normalizer with event-aware source identity.
3. Add unit tests for signature vectors, replay, distinct event types, and
   malformed payloads.
4. Run storefront typecheck and tests; confirm no schema, route, or core
   changes.

No source, test, schema, or migration changes were made by this pre-flight.
