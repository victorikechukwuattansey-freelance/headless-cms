# VTPass Scoping — Repository Inspection + API Contract

**Date:** 2026-10-26 (initial) / 2026-10-26 (updated post-lookup)
**Branch / HEAD:** main / 44935b5 (5D.4 committed)
**Scope:** Read-only investigation of (a) what the current codebase provides
for VTPass integration, and (b) what VTPass's API requires. This is the
`docs/vtpass-scoping.md` referenced as "repository inspection — pending commit"
in `docs/phase-5d-architecture-change-request.md` §References.
**Status:** Input to 5D.5b. Does not itself authorize implementation.
**API reference:** https://vtpass.com/documentation/ (inspected 2026-10-26)

## Executive Summary

**All six §14 changes are landed** (`60ceb32` through `44935b5`). The codebase
is structurally ready for a real provider: the contract supports two methods
per adapter (`execute`, `queryStatus`), the registry can select by mode, the
attempt row carries a requestId lookup, and the four transaction-truth types
persist `simulated` honestly.

**The VTPass API is now documented** — eight unknowns from the pre-lookup
draft are resolved against https://vtpass.com/documentation/. Two material
findings:

1. **VTPass supports only 6 of 12 catalog service kinds.** Ticketing (cinema,
   event, bus, airline), gift cards, and digital vouchers are not covered.
   Unsupported kinds must fail cleanly at `execute()` time.
2. **VTPass does not document webhook signature verification.** The callback
   page specifies only POST + `{"response": "success"}` response. No
   signature header. Security relies on `requestId` lookup + status transition
   validation.

**5D.5b can dispatch now** — client and adapters can be written and tested
against stubbed HTTP. No credentials needed for test-first development.
Credentials required only for 5D.5d sandbox validation.

---

## Part 1 — Reference patterns in the codebase

Four existing patterns establish the "how" once the "what" is known.

### 1.1 Paystack adapter boundary (`src/paystack/`)

- `client.ts` — real HTTP implementation. `PaystackClientError` code enum
  covering network / HTTP status / API rejection / malformed response.
  `fetchImpl` parameter for test injection. `DEFAULT_BASE_URL`.
- `gateway.ts` — thin `PaystackGateway` interface. Application code depends
  on the gateway; tests inject fakes; `client.ts` is the real impl.

**Pattern to mirror:** `src/vtpass/client.ts` + `src/vtpass/gateway.ts`.
Same shape: typed error enum, `fetchImpl` for tests, thin gateway interface.

### 1.2 Paystack webhook handler (`src/application/paystack-webhook.ts`)

Handler pipeline (verbatim from code):

1. `content-type` check → 400 `MALFORMED_PAYLOAD`
2. `readRawBody(req)` (Buffer concat, UTF-8)
3. Signature header presence → 400 `INVALID_SIGNATURE`
4. `verifyPaystackSignature(rawBody, signature, secretKey)` → 400 `INVALID_SIGNATURE` on fail
5. `JSON.parse(rawBody)` → 400 `MALFORMED_PAYLOAD` on fail
6. Payload shape guard `isPaystackWebhookPayload()` → 400 `INVALID_PAYLOAD`
7. `paystackWebhookPaymentEvent(parsed, adapterOptions, rawBody)` — normalize
8. `ingestPaymentEvent(repos, normalized)` — idempotent ingest to `payment_events`
9. Respond 200 `{ event_id, replayed }`

**Pattern to mirror in 5D.5c:** same pipeline through step 6, then
**route to `findByProviderRequestId`** instead of `ingestPaymentEvent`.
Per §14 owner ruling 1.c: wallet-paid fulfillment bypasses `payment_events`
because that table is payment-source evidence and wallet is the payment
source. `payment_events` is NOT the right target for VTPass callbacks.

**VTPass divergence:** steps 3-4 (signature verification) are **not
implementable** — VTPass does not document a signature scheme. Steps 7-8
are replaced by attempt-row lookup + status update + reconcile re-run.

### 1.3 Mock provider adapters (`src/marketplace/providers/mock-provider.ts`)

Three adapter shapes exist:

- `MockServiceProvider<Request>` — implements `execute()` + `queryStatus()`
  via `createMockServiceProvider<Request>(options)`. Covers airtime, data,
  electricity, cable, internet, education (6 of 12).
- `MockGiftCardProvider` — implements `GiftCardProvider.execute()` +
  `queryStatus()`; returns `GiftCardProviderResult` (extends `ProviderResult`
  with `deliveryStatus`, `codeStatus`, `maskedCodePreview`, `riskFlags`).
- `MockPaymentProvider` — implements `PaymentProvider.execute()` +
  `queryStatus()`; returns `PaymentProviderResult` (extends `ProviderResult`
  with `paymentReference`, `authorizationState`, `settlementState`).
- `MockTicketingProvider` — implements `CinemaProvider | EventProvider |
BusProvider | AirlineProvider` (all four share `TicketingProvider` shape);
  has `searchAvailability`, `reserve`, `issue`, `cancel`, `queryStatus`.
  **4 methods, not 2.**

**Pattern to mirror in 5D.5b:** each VTPass adapter implements the same
`ProviderAdapter<Request>` interface the mock implements. 5 service kinds
share `VtpassServiceAdapter<Request>`. Unsupported kinds throw
`VtpassUnsupportedServiceError`.

### 1.4 Transaction orchestration (`src/marketplace/transactions.ts`)

- Provider resolved via `deps.registry.providerForServiceKind(service.kind)`
  (line 751)
- `executor.execute(context, request)` — line 849 (VTU path)
- `giftCardProvider.execute(context, request)` — line 996 (gift card path)
- Ticketing uses THREE sequential provider calls:
  `searchAvailability` (1190), `reserve` (1210), `issue` (1278)
- After every provider call: `recordProviderAttempt(repos, { ...,
requestReference: context.requestId, result })`

**Critical observation (now confirmed by VTPass docs):** the attempt row
stores **our** `context.requestId` as `requestReference`. VTPass **echoes
this value** back in webhooks. So `findByProviderRequestId` from 5D.3
resolves the correct attempt directly — no companion write path needed.

**Also critical:** ticketing produces **multiple** attempt rows per
transaction (reserve + issue = 2 attempts, each with its own requestId).
But VTPass does not support ticketing, so this path is not exercised in
REAL mode. Unsupported ticketing kinds throw at `execute()` before any
attempt row is created.

---

## Part 2 — ProviderAdapter contract (what VTPass must satisfy)

From `src/marketplace/providers/contracts.ts` (post-5D.2):

```ts
interface ProviderAdapter<Request> {
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly mode: ProviderMode; // "MOCK" | "REAL"
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  execute(
    context: ProviderRequestContext,
    request: Request,
  ): Promise<ProviderResult>;
  queryStatus(context: ProviderRequestContext): Promise<ProviderResult>;
}
```

`ProviderResult` carries: `providerReference`, `requestId`, `correlationId`,
`attemptNumber`, `requestTimestamp`, `responseTimestamp`, `providerStatus`
(11-value enum), `providerStatusCode`, `providerMessage`, `attemptStatus`,
`canonicalPaymentStatus`, `amountMinor`, `currency`, `latencyMs`,
`sourceAttributes`, `reconciliationFacts`, `safeMetadata`, `duplicateResults`,
`simulated`.

**What VTPass adapter must produce:** a `ProviderResult` for every
`execute()` and `queryStatus()` call. Field-level mapping from VTPass JSON
to `ProviderResult` is in §Part 7.2 and §Part 7a.

---

## Part 3 — Service kinds and product inventory

From `src/marketplace/catalog.ts`, 12 service kinds + 22 demo products,
cross-referenced with VTPass coverage:

| Service kind    | Products                        | VTPass supported? | VTPass serviceID(s)                                      |
| --------------- | ------------------------------- | ----------------- | -------------------------------------------------------- |
| AIRTIME         | MTN, Airtel                     | ✅                | `mtn`, `airtel`, `glo`, `9mobile`                        |
| DATA            | MTN, Airtel                     | ✅                | `mtn-data`, `airtel-data`, etc.                          |
| ELECTRICITY     | AEDC Prepaid, IKEDC Prepaid     | ✅                | `ikeja-electric`, `eko-electric`, `abuja-electric`, etc. |
| CABLE_TV        | DStv, GOtv                      | ✅                | `dstv`, `gotv`, `startimes`, `showmax`                   |
| EDUCATION       | JAMB Registration, WAEC Payment | ✅                | `jamb`, `waec`                                           |
| INTERNET        | Spectranet, ipNX                | ⚠️ Partial        | Spectranet via `spectranet`; ipNX verify in sandbox      |
| GIFT_CARD       | Amazon, Steam                   | ❌ Not covered    | —                                                        |
| DIGITAL_VOUCHER | Generic                         | ❌ Not covered    | —                                                        |
| CINEMA_TICKET   | Filmhouse, Silverbird           | ❌ Not covered    | —                                                        |
| EVENT_TICKET    | Lagos Tech Fest, Afrobeats Live | ❌ Not covered    | —                                                        |
| BUS_TICKET      | Lagos→Abuja, Lagos→Ibadan       | ❌ Not covered    | —                                                        |
| AIRLINE_TICKET  | LOS→ABV, LOS→LON                | ❌ Not covered    | —                                                        |
| BETTING         | ExampleBet                      | Compliance-gated  | —                                                        |

**Design decision for product-code mapping:** static map file in
`src/vtpass/service-map.ts` keyed by catalog `serviceId`/`productId`.
Preserves catalog.ts provider-neutrality. VTPass uses string slugs
(`mtn`, `dstv`, etc.), not numeric codes.

**Product variations** (bundles/plans) come from
`GET /service-variations?serviceID=X`. Adapter can fetch lazily or cache.

**Not all service kinds are VTPass-supported.** Unsupported kinds must
throw `VtpassUnsupportedServiceError` at `execute()` time with a clear
message naming the kind and pointing at the limitation. Registry returns
the adapter; the adapter throws on first use — this preserves the
`createProviderRegistry("REAL")` contract while making the gap visible.

---

## Part 4 — Webhook routing (per §14 owner ruling 1.c)

Per change request §Step 5 Change 5 rationale (verbatim):

> "VTPass callbacks for wallet-paid fulfillment do **not** route through
> `payment_events`. That table is payment-source evidence; wallet is the
> payment source for these transactions. Instead: 1. VTPass callback
> arrives at `/webhook/vtpass` (new route). 2. Handler verifies whatever
> signature VTPass supports (spec pending — see §7). 3. Handler calls
> `findByProviderRequestId(vtpass_request_id)`. 4. If no attempt is found
> → 200 (VTPass may retry); log for investigation. 5. If an attempt is
> found → update its status → re-run `reconcileMarketplaceTransaction`."

**What 5D.5c must implement:**

- POST `/webhook/vtpass` route in `src/server.ts` (parallel to
  `/webhook/paystack` at line 192)
- Handler in `src/application/vtpass-webhook.ts`
- Signature verification — **not implementable** (see §Part 7.5). Skip
  steps 3-4 from Paystack pipeline.
- Payload shape: `{ type: "transaction-update", data: { code, content, requestId, ... } }`
- Idempotency — via attempt-row status check: if attempt already
  `SUCCESS`/`FAILED`/`REVERSED`, ignore. No separate idempotency table.
- Reconcile call — same `reconcileMarketplaceTransaction` used by
  `executeMarketplaceTransaction` (line 849 path)
- Response: 200 with body `{"response": "success"}` per VTPass spec

**actual shipped pipeline (5D.5c correction):**

1. `content-type` check → 400 on fail
2. `readRawBody(req)` → JSON parse → 400 on fail
3. Payload shape guard (must have `data.requestId` and `data.code`)
4. `findByProviderRequestId(data.requestId)` → attempt | null
5. If null → 200 `{"response": "success"}` (VTPass may retry; log)
6. Derive `providerStatus` + `attemptStatus` + `canonicalStatus` via
   `mapStatuses(code, innerStatus)` — reuses T2a's response mapper
7. Short-circuit if attempt already at derived statuses → 200 (idempotent)
8. Else:
   - `marketplaceProviderAttempts.updateStatus(attempt.id, ...)` (new method)
   - `marketplaceTransactions.updateStatuses(txId, { fulfillmentStatus, updatedAt })`
     (new method) — **only** fulfillmentStatus is set; reconcile derives
     customerStatus and adminStatus from its own truth pass
   - Append `ProviderResponseReceived` transaction event (source=PROVIDER)
   - `reconcileMarketplaceTransaction(deps, { txId, forceRegenerate: true })`
     (new flag; bypasses replay gate, upserts pack, re-derives cs/admin)
9. Respond 200 `{"response": "success"}`

**Correction from original Part 4 design:** the pre-implementation plan
assumed the handler would set customerStatus and adminStatus directly. That
is wrong — those are **reconcile-derived**, not handler-controlled. The
handler owns "what did the provider say" (fulfillmentStatus); reconcile owns
"how does this look to customer/admin" (customerStatus/adminStatus/
reconcileOutcome). This separation preserves §6's Payment/Ledger/Fulfillment
Truth Separation. Setting cs/admin from the callback and then having reconcile
overwrite them would produce a race with two writers.

---

## Part 5 — Config / environment surface

Current `StorefrontConfig` (from `src/config.ts`):

- `port`, `dataDir`, `paystackSecretKey`, `paystackBaseUrl`,
  `callbackBaseUrl`, `seedDemo`, `sessionCookieName`, `sessionTtlHours`,
  `cookieSecure`, **`providerMode`** (added in 5D.4)

**New env vars needed for 5D.5b/c:**

- `STOREFRONT_VTPASS_API_KEY` — required for GET requests (public header)
- `STOREFRONT_VTPASS_PUBLIC_KEY` — required for GET (starts with `PK_`)
- `STOREFRONT_VTPASS_SECRET_KEY` — required for POST (starts with `SK_`)
- `STOREFRONT_VTPASS_BASE_URL` — default `https://sandbox.vtpass.com/api`
  (sandbox); production `https://vtpass.com/api`
- No webhook secret — VTPass does not sign callbacks

**Auth model (confirmed from docs):**

- GET: headers `api-key: <key>`, `public-key: PK_...`
- POST: headers `api-key: <key>`, `secret-key: SK_...`

**Config validation:** all three VTPass keys present or all three absent.
Partial config → `StorefrontConfigError` at load time. `providerMode:
"REAL"` with missing VTPass keys → throw at registry construction.

---

## Part 6 — Test strategy

**What can be tested without credentials (5D.5b):**

- Adapter construction with stubbed `fetchImpl`
- `execute()` returns a valid `ProviderResult` given a stubbed HTTP response
- `queryStatus()` same
- Registry REAL mode returns VTPass adapters, not throws
- Error mapping — HTTP 400/401/404/429/500 → `VtpassClientError` codes
- VTPass response code mapping (see §Part 7a) — every code → correct
  `ProviderResult` fields
- Product-code mapping — each catalog product maps to a VTPass serviceID
- Unsupported service kinds throw `VtpassUnsupportedServiceError`
- Webhook handler with stubbed body — requestId lookup path

**What cannot be tested without credentials:**

- Actual VTPass API contract against live sandbox
- Signature verification (no signature exists to verify)
- Rate limiting / retry behavior against real API
- Product variation fetching (service-variations endpoint)

**Test count expectation:** ~20-30 new tests across 5D.5b and 5D.5c.
Every one uses `fetchImpl` stub or webhook body stub — zero network.

---

## Part 7 — Resolved API unknowns

All eight unknowns from the pre-lookup draft are resolved or partially
resolved against https://vtpass.com/documentation/.

### 7.1 requestId semantics (RESOLVED)

VTPass **echoes the requestId you sent**. Webhook payload contains
`"requestId": "the requestId you sent for this transaction on initial
request"` (source: Transaction Update Webhook docs). Therefore:

- 5D.3's `findByProviderRequestId(requestId)` works directly.
- No companion write path is needed.
- `requestReference` (our `context.requestId`) IS VTPass's requestId.

### 7.2 Response field mapping (RESOLVED)

Request/response shape:

```json
{
  "code": "000",
  "content": {
    "transactions": {
      "status": "delivered",
      "transactionId": "...",
      "product_name": "...",
      "unique_element": "...",
      "unit_price": "...",
      "quantity": 1
    }
  },
  "response_description": "TRANSACTION SUCCESSFUL",
  "requestId": "...",
  "amount": 20,
  "transaction_date": "...",
  "purchased_code": ""
}
```

**Critical mapping rule:** `code: "000"` means "processed" — it does NOT
mean "success". The accurate status is `content.transactions.status`
(delivered, pending, failed, reversed, initiated).

### 7.3 Product-code mapping (PARTIALLY RESOLVED)

ServiceIDs are string slugs: `mtn`, `mtn-data`, `airtel`, `glo`,
`9mobile`, `ikeja-electric`, `eko-electric`, `dstv`, `gotv`,
`startimes`, `spectranet`, `jamb`, `waec`.

Product variations (bundles/plans) come from
`GET /service-variations?serviceID=X`. Adapter can fetch variations
lazily or cache them.

**What remains unknown:** whether every catalog product maps cleanly,
or whether some have no VTPass equivalent (e.g., "Airtel Data" catalog
product might map to multiple VTPass variations). Sandbox validation
resolves this.

### 7.4 Service-kind coverage (MATERIAL — 6 of 12)

VTPass service categories: `airtime`, `data`, `tv-subscription`,
`electricity-bill`, `education`, `other-services`, `insurance`.

**Supported catalog kinds:** AIRTIME, DATA, ELECTRICITY, CABLE_TV,
EDUCATION. INTERNET is partial (Spectranet/Smile via data or
other-services — verify in sandbox).

**Not supported:** CINEMA_TICKET, EVENT_TICKET, BUS_TICKET,
AIRLINE_TICKET, GIFT_CARD, DIGITAL_VOUCHER. BETTING is
compliance-gated.

**Consequence for 5D.5b:** adapter implements 5-6 service kinds.
Unsupported kinds throw `VtpassUnsupportedServiceError` at execute() time.

### 7.5 Callback signature (SECURITY GAP — docs do not sign)

Official callback docs specify only:

- POST method
- Update callback URL on dashboard
- Respond with `{"response": "success"}`
- Payload `type: "transaction-update"`, `data: { code, content, requestId, ... }`

**No signature header is documented.** Third-party packages reference
`VTPASS_WEBHOOK_SECRET` but this is not in official docs.

**Mitigation for 5D.5c:** validate `requestId` against attempt row,
enforce valid status transitions, respond per spec. Document as known
limitation. IP allowlist if VTPass publishes IPs (unknown).

### 7.6 Auth + endpoints (RESOLVED)

- **GET requests:** headers `api-key: <key>` and `public-key: PK_...`
- **POST requests:** headers `api-key: <key>` and `secret-key: SK_...`
- **Sandbox base:** `https://sandbox.vtpass.com/api`
- **Production base:** `https://vtpass.com/api`
- **Endpoints:** `/pay` (POST), `/requery` (POST), `/service-categories`
  (GET), `/service-variations?serviceID=X` (GET)

### 7.7 Sandbox signup (RESOLVED)

`https://sandbox.vtpass.com/account` — create account, generate API keys
from dashboard. Same path for production at `https://vtpass.com/account`.

### 7.8 Sandbox test numbers (RESOLVED)

| Phone number   | Outcome             |
| -------------- | ------------------- |
| `08011111111`  | Success             |
| `201000000000` | Pending             |
| `500000000000` | Unexpected response |
| `400000000000` | No response         |
| `300000000000` | Timeout             |
| Any other      | Failed              |

All six demo scenarios are testable in sandbox. Matches our
`ProviderStatus` enum's 11 values after mapping.

---

## Part 7a — Response code mapping

Documented VTPass response codes and their `ProviderResult` mapping:

| VTPass code                                     | Meaning                      | Our `providerStatus` | Our `attemptStatus` |
| ----------------------------------------------- | ---------------------------- | -------------------- | ------------------- |
| `000` + `content.transactions.status=delivered` | Success                      | `PROVIDER_SUCCESS`   | `SUCCESS`           |
| `000` + `status=initiated` / `pending`          | Pending                      | `PROVIDER_PENDING`   | `PENDING`           |
| `099`                                           | Processing                   | `PROVIDER_PENDING`   | `PENDING`           |
| `016`                                           | Failed                       | `PROVIDER_FAILED`    | `FAILED`            |
| `040`                                           | Reversed                     | `PROVIDER_REVERSED`  | `FAILED`            |
| `014`                                           | Duplicate request ID         | `PROVIDER_DUPLICATE` | `DUPLICATE`         |
| `019`                                           | Likely duplicate             | `PROVIDER_DUPLICATE` | `DUPLICATE`         |
| `015`                                           | Invalid request ID (requery) | `PROVIDER_UNKNOWN`   | `UNKNOWN`           |
| `010`-`013`, `017`-`018`                        | Config/validation errors     | `PROVIDER_FAILED`    | `FAILED`            |
| `021`-`026`                                     | Account locked/suspended     | `PROVIDER_FAILED`    | `FAILED`            |
| Timeout (HTTP)                                  | Timeout                      | `PROVIDER_TIMEOUT`   | `TIMEOUT`           |

Unknown codes → `PROVIDER_UNKNOWN` + `PENDING` attempt (requery later).

---

## Part 8 — Decomposition

| Sub-increment | Contents                                                                                                                                                                                                    | Blocked on                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **5D.5a**     | This scoping doc                                                                                                                                                                                            | Nothing — ready to commit                       |
| **5D.5b**     | `src/vtpass/` adapter: client + 5 adapters (airtime, data, electricity, cable, education) + registry REAL wiring + `VtpassUnsupportedServiceError` for 7 unsupported kinds. Tests with stubbed `fetchImpl`. | Nothing — credentials not needed for test-first |
| **5D.5c**     | `POST /webhook/vtpass` handler + status update + reconcile re-run. No signature verification (documented limitation).                                                                                       | 5D.5b                                           |
| **5D.5d**     | Sandbox end-to-end validation (owner-run with credentials)                                                                                                                                                  | 5D.5b + 5D.5c + credentials                     |

**5D.5b can dispatch now** — client and adapters can be written and
tested against stubbed HTTP responses. Credentials needed only for
5D.5d validation.

---

## Part 9 — Owner action checklist

**To unblock 5D.5d (sandbox validation):**

- [ ] Create sandbox account at https://sandbox.vtpass.com/account
- [ ] Generate API keys (api-key, public-key, secret-key)
- [ ] Add to `reconcilekit/storefront/.env`:
  - `STOREFRONT_VTPASS_API_KEY=<key>`
  - `STOREFRONT_VTPASS_PUBLIC_KEY=PK_...`
  - `STOREFRONT_VTPASS_SECRET_KEY=SK_...`
- [ ] Confirm sandbox wallet has test balance (VTPass provides test credits)

**To enable 5D.5c validation:**

- [ ] Set callback URL on VTPass dashboard to
      `https://<host>/webhook/vtpass` (sandbox and production)
- [ ] Confirm no signature scheme is available from VTPass support
      (accept documentation gap)
- [ ] Provide a sample callback payload from VTPass support (optional
      but valuable for 5D.5c tests)

**Owner ruling needed before 5D.5c dispatch:**

- [ ] Accept webhook without signature verification (documented
      limitation) — or block 5D.5c until scheme confirmed

**Open design decisions (owner ruling needed before 5D.5b):**

- [ ] Product-code mapping strategy: static map file (recommended) vs
      catalog field vs config
- [ ] Which service kinds are in VTPass's first integration scope
      (5 confirmed + internet-verify, or subset)

---

## Part 10 — Evidence index

| Concern                             | Source                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| ProviderAdapter contract            | `storefront/src/marketplace/providers/contracts.ts`                        |
| Paystack adapter pattern            | `storefront/src/paystack/{client,gateway}.ts`                              |
| Paystack webhook pattern            | `storefront/src/application/paystack-webhook.ts`                           |
| Mock provider implementations       | `storefront/src/marketplace/providers/mock-provider.ts`                    |
| Transaction orchestration           | `storefront/src/marketplace/transactions.ts`                               |
| Provider invocation sites           | `transactions.ts:751,849,996,1190,1210,1278`                               |
| Registry mode switch                | `storefront/src/marketplace/providers/registry.ts` (5D.4)                  |
| Attempt lookup primitive            | `storefront/src/db/repositories/marketplace-provider-attempts.ts` (5D.3)   |
| Attempt row requestReference source | `transactions.ts:855` (`requestReference: context.requestId`)              |
| Catalog product inventory           | `storefront/src/marketplace/catalog.ts:532-810`                            |
| Config surface                      | `storefront/src/config.ts`                                                 |
| Change request authority            | `docs/phase-5d-architecture-change-request.md` §Step 5 Change 5, §Sequence |
| Freeze doc §14 procedure            | `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md:393-407`               |
| VTPass API docs                     | https://vtpass.com/documentation/                                          |
| VTPass sandbox                      | https://sandbox.vtpass.com/account                                         |

---

## Summary

The codebase is genuinely ready — all six §14 changes landed in the last
four commits, and the VTPass API contract is now documented with
resolved auth, endpoints, response codes, and service coverage.

Two material deviations from a naive "adapt everything" plan:

1. **Partial service coverage** — 6 of 12 catalog kinds. Unsupported
   kinds fail cleanly, not silently.
2. **No webhook signature** — security relies on requestId lookup +
   status transition validation, documented as a known limitation.

**5D.5b can dispatch immediately.** Test-first adapter development needs
no credentials. 5D.5c and 5D.5d follow once 5D.5b lands.

The single most valuable confirmed finding: **VTPass echoes our
requestId**, so 5D.3's `findByProviderRequestId` works as-shipped. No
extension needed. The callback-to-attempt primitive is proven.
