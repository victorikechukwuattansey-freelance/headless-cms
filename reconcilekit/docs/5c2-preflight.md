# 5C.2 Pre-Flight — Paystack webhook HTTP endpoint

**Project:** ReconcileKit (Core + Storefront)  
**Type:** Read-only pre-flight / implementation scoping  
**Date:** 2026-10-21  
**Baseline:** `0f6f28a` (`feat(5c.1): paystack webhook signature + payload normalization`)  
**Scope authority:** owner 5C.2 prompt plus `docs/5c-preflight.md`  
**Evidence authority:** current `storefront/src`, `storefront/test`, and the
5C.1 implementation committed at `0f6f28a`.

---

## Summary (recommended decomposition + file count + test count + risk)

**Recommendation: A — one increment.**

- **5C.2** adds the HTTP boundary only: read the raw body, verify
  `x-paystack-signature`, normalize, call `ingestPaymentEvent`, map the
  outcome to HTTP. No new ingest logic, no matcher changes, no schema change.
- **Expected files: 4**
  - new `storefront/src/marketplace/payment-sources/webhook-endpoint.ts`
  - modify `storefront/src/server.ts`
  - new `storefront/test/marketplace/webhook-endpoint.test.ts`
  - modify `storefront/test/server.test.ts`
- **Expected new tests: ~15** (7 endpoint/module tests, 8 HTTP tests).
  Storefront suite should move from **618/618** to roughly **633/633**.
- **Highest risk:** the webhook route must be registered **before** the
  unconditional marketplace dispatch in `handleRequest`. Existing server
  tests do not configure marketplace deps, so a route placed after that
  dispatch can pass tests and fail in production with a `303 /login` or a
  marketplace HTML 404.
- **Raw audit persistence:** not included in this increment. The 5C.2 prompt
  is endpoint-focused and 5C.1 deliberately stores only a payload hash. If
  the owner still requires durable raw-delivery audit, use decomposition B
  below and treat the schema/migration work as a separate increment.

**Readiness verdict:** ready to implement 5C.2 after the owner rulings in the
last section. The endpoint is a thin adapter over already-tested 5C.1 code;
the main risks are routing order, exact raw-body handling, and the supported
currency set.

---

## Part 1 — Request pipeline

### 1a. Where a webhook request enters

`storefront/src/server.ts`:

- `createStorefrontServer(config, deps)` — line 139.
- `handleRequest(req, res, config, deps)` — line 155.
- `POST /orders/:id/verify` route match — line 202.
- `GET /callback` — line 213.
- `readJsonBody` — line 1280.
- `writeJson` — line 1332.

The request pipeline is:

1. `createHttpServer` receives the request.
2. `handleRequest` parses `req.url`.
3. **Marketplace dispatch runs first**, before the core route table:

```ts
// server.ts:164-178
// Try marketplace routes first if marketplace deps are available
if (deps.marketplace !== undefined) {
  const handled = await tryHandleMarketplace(
    req,
    res,
    url,
    deps.marketplace,
    deps.repos,
    config,
  );
  if (handled) {
    return;
  }
}
```

4. Only after that does `handleRequest` check `GET /health`, `POST /businesses`,
   `POST /products`, `POST /orders`, `/orders/:id/verify`, `/callback`, and
   `/reconcile`.

### 1b. Critical raw-body finding

**`readJsonBody` cannot be reused for the webhook.**

`readJsonBody` buffers all chunks, enforces a 1 MiB limit, converts the bytes
to UTF-8, parses JSON, rejects non-objects, and **discards the raw bytes**:

```ts
// server.ts:1280-1310 (abridged)
const chunks: Buffer[] = [];
let size = 0;
for await (const chunk of req) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  size += buffer.length;
  if (size > MAX_BODY_BYTES) {
    throw new HttpError(413, "BODY_TOO_LARGE", "request body exceeds 1 MiB");
  }
  chunks.push(buffer);
}
if (chunks.length === 0) {
  throw new HttpError(400, "INVALID_BODY", "request body is required");
}
let parsed: unknown;
try {
  parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  throw new HttpError(400, "INVALID_BODY", "request body must be valid JSON");
}
```

There is **no global body parser**. Routing happens before any body read, so a
new webhook route can read `req` directly. But if it calls `readJsonBody`, the
raw bytes are gone; re-serializing the parsed object will produce a different
byte sequence and break the HMAC.

The webhook needs a webhook-local raw reader, for example:

```ts
async function readRawBody(
  req: import("node:http").IncomingMessage,
): Promise<Buffer> {
  // same 1 MiB streaming guard as readJsonBody, but return Buffer.concat(chunks)
}
```

Do not change `readJsonBody` for this increment. It is used by every existing
JSON route; changing its return type would widen the blast radius for no
benefit.

### 1c. Raw bytes, UTF-8, and Content-Type

`verifyPaystackSignature` takes a `string` and hashes its UTF-8 bytes:

```ts
createHmac("sha512", secretKey).update(rawBody, "utf8").digest()
```

The correct sequence is therefore:

1. read the request body as a `Buffer`;
2. enforce the 1 MiB limit while reading;
3. convert **once** with `buffer.toString("utf8")`;
4. verify `x-paystack-signature` against that exact string;
5. parse the **same** string with `JSON.parse`;
6. never call `JSON.stringify(parsed)` to recompute the signature.

For valid UTF-8 JSON, `Buffer` → string → UTF-8 bytes is byte-preserving.
Whitespace, key order, number formatting, and escaping all survive because the
original string is used for both HMAC and parsing. If conversion happens after
parsing, or if the body is trimmed/normalized, the signature will fail.

Current server behavior has **no request Content-Type check**; `readJsonBody`
parses any body as JSON. For the webhook, the recommended policy is:

- require `application/json` (parameters such as `; charset=utf-8` allowed);
- otherwise return `415 UNSUPPORTED_MEDIA_TYPE`.

This is stricter than existing routes, so it is listed as an owner decision.
A lenient alternative is to rely on the signature and parse whatever
`JSON.parse` accepts; that is easier to operate but gives a less precise
client error.

Header handling should accept only a string:

```ts
const signature = req.headers["x-paystack-signature"];
if (typeof signature !== "string" || signature === "") {
  // 401 INVALID_SIGNATURE; never call verify with an array or undefined
}
```

`x-paystack-signature` may be `string | string[] | undefined` in Node. An
array can occur with duplicate headers; it must not be comma-joined.

### 1d. Ordering rule for the new route

`tryHandleMarketplace` returns `true` whenever marketplace deps exist, even
when the path is not a marketplace path. Its implementation calls
`routeMarketplace`, catches any error, writes a marketplace HTML error, and
returns `true`:

```ts
// server.ts:610-628 (abridged)
try {
  await routeMarketplace(req, res, url, deps, repos, method, config);
  return true;
} catch (error) {
  writeMarketplaceHtmlError(res, error, path);
  return true;
}
```

`isMarketplacePath` exists at `server.ts:595` but is **not used** at the
dispatch site. In production, `main.ts` always supplies `marketplace`, so a
webhook route placed after the current marketplace block is unreachable:
the session gate will redirect an unauthenticated request to `/login`, or the
marketplace router will render an HTML 404.

The webhook check must be inserted **before** the `deps.marketplace` block, or
the dispatch must first gate on `isMarketplacePath`. The former is the smaller
5C.2 change; the latter is a broader routing fix and should be a separate
decision.

---

## Part 2 — Existing route handler shape

### 2a. `POST /orders/:id/verify`

```ts
// server.ts:418-457
async function handleVerifyOrder(
  _req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
  orderId: string,
): Promise<void> {
  const outcome = await verifyOrder(deps.repos, deps.paystack, orderId);
  switch (outcome.kind) {
    case "verified":
      writeJson(res, 200, {
        verification: {
          orderId: outcome.payment.orderId,
          changed: outcome.changed,
          payment: outcome.payment,
        },
      });
      return;
    case "order_not_found":
      throw new HttpError(404, "ORDER_NOT_FOUND", "no such order");
    case "not_initialized":
      throw new HttpError(
        409,
        "ORDER_NOT_INITIATED",
        "order has no Paystack reference to verify",
      );
    case "reference_mismatch":
      throw new HttpError(
        502,
        "REFERENCE_MISMATCH",
        "Paystack returned a different transaction reference than the one persisted for this order; nothing was recorded",
      );
    case "verify_failed":
      throw new HttpError(
        502,
        "VERIFY_FAILED",
        "Paystack verification could not be completed; no records were changed",
        { causeCode: outcome.causeCode },
      );
  }
}
```

Observable contract:

- success: `200` with `{ verification: { orderId, changed, payment } }`;
- missing order: `404 ORDER_NOT_FOUND`;
- no stored reference: `409 ORDER_NOT_INITIATED`;
- provider returned a different reference: `502 REFERENCE_MISMATCH`;
- provider call failed: `502 VERIFY_FAILED` with optional `cause`.

### 2b. `GET /callback`

```ts
// server.ts:459-512 (abridged; response strings are intentionally HTML)
async function handleCallback(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://storefront.local");
  const orderId = url.searchParams.get("orderId");
  if (orderId === null || orderId === "") {
    writeHtml(
      res,
      400,
      "Missing order",
      "<p>This callback is missing the order identifier. Contact the merchant.</p>",
    );
    return;
  }

  const outcome = await verifyOrder(deps.repos, deps.paystack, orderId);
  switch (outcome.kind) {
    case "verified": { /* 200 HTML with payment heading and order id */ }
    case "order_not_found": /* 404 HTML */
    case "not_initialized": /* 409 HTML */
    case "reference_mismatch": /* 502 HTML */
    case "verify_failed": /* 502 HTML */
  }
}
```

`/callback` is customer-facing HTML, not JSON, and has no session or signature
authentication. It is not a model for the webhook response shape, but it does
confirm that both existing payment paths route through `verifyOrder` rather
than trusting the caller.

### 2c. Shared error / write helpers

```ts
// server.ts:116-134
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly causeCode: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { readonly causeCode?: string | null },
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.causeCode = options?.causeCode ?? null;
  }
}
```

```ts
// server.ts:1332-1343
function writeJson(
  res: import("node:http").ServerResponse,
  status: number,
  payload: unknown,
): void {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}
```

`handleRequest` catches `HttpError` and writes the standard error envelope:

```ts
// server.ts:229-245 (abridged)
if (error instanceof HttpError) {
  writeJson(res, error.status, {
    error: {
      code: error.code,
      message: error.message,
      ...(error.causeCode !== null ? { cause: error.causeCode } : {}),
    },
  });
  return;
}
throw error;
```

`createStorefrontServer` catches anything else and writes
`500 INTERNAL_ERROR` with `"unexpected internal failure"`. The webhook handler
can therefore throw `HttpError` for expected outcomes and let unexpected
database/internal failures fall through to the existing 500 path.

### 2d. Handler dependencies

`handleRequest` already receives both `config` and `deps`:

```ts
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: StorefrontConfig,
  deps: ServerDependencies,
): Promise<void>
```

`ServerDependencies` is:

```ts
export interface ServerDependencies {
  readonly repos: Repositories;
  readonly paystack: PaystackGateway;
  readonly marketplace?: MarketplaceTransactionDeps;
}
```

The webhook handler needs `deps.repos` and `config.paystackSecretKey`. It does
**not** need `deps.paystack` for signature verification, because the gateway
does not expose the secret. A new handler can accept `(req, res, config, deps)`
or a narrower `(req, res, repos, secretKey)` signature.

---

## Part 3 — Secret key wiring

### 3a. Source of truth

`StorefrontConfig` carries the secret directly:

```ts
// config.ts
export interface StorefrontConfig {
  readonly port: number;
  readonly dataDir: string;
  readonly paystackSecretKey: string | null;
  readonly paystackBaseUrl: string;
  readonly callbackBaseUrl: string;
  // ...
}
```

`loadConfig` reads the exact environment variable:

```ts
const secret = env.STOREFRONT_PAYSTACK_SECRET_KEY;

return {
  // ...
  paystackSecretKey:
    secret !== undefined && secret.trim() !== "" ? secret : null,
};
```

The variable is **`STOREFRONT_PAYSTACK_SECRET_KEY`**, not
`PAYSTACK_SECRET_KEY`. A missing or whitespace-only value becomes `null`.

### 3b. How the gateway uses it

`main.ts` builds the gateway with a closure that reads the config on each
call:

```ts
function buildPaystackGateway(config: StorefrontConfig): PaystackGateway {
  const withSecret =
    <A extends readonly unknown[], R>(
      fn: (options: { secretKey: string; baseUrl: string }, ...args: A) => Promise<R>,
    ) =>
    async (...args: A): Promise<R> => {
      const secretKey = config.paystackSecretKey;
      if (secretKey === null) {
        throw new Error(
          "STOREFRONT_PAYSTACK_SECRET_KEY is not set; cannot contact Paystack",
        );
      }
      return fn({ secretKey, baseUrl: config.paystackBaseUrl }, ...args);
    };

  return {
    initializeTransaction: withSecret(initializeTransaction),
    verifyTransaction: withSecret(verifyTransaction),
  };
}
```

`PaystackGateway` exposes only:

```ts
export interface PaystackGateway {
  readonly initializeTransaction: (input: InitializeTransactionInput) =>
    Promise<InitializeTransactionResult>;
  readonly verifyTransaction: (input: VerifyTransactionInput) =>
    Promise<PaystackMappedTransaction>;
}
```

No secret getter exists on the gateway. `verifyOrder(repos, gateway, orderId)`
does not accept a secret; the gateway owns that detail.

### 3c. How the webhook can access it

`handleRequest` has `config` in scope, so the webhook handler can receive
`config.paystackSecretKey` directly. This is the smallest change and keeps the
secret out of `ServerDependencies`.

Recommended flow:

1. read `config.paystackSecretKey`;
2. if `null`, fail closed with `503 WEBHOOK_NOT_CONFIGURED` **before** calling
   `verifyPaystackSignature` (do not pass `""` and return `401`, which would
   misdescribe a server configuration failure);
3. otherwise read the raw body, verify the signature with the secret, then
   normalize/ingest.

Do not add the secret to `PaystackGateway`, and do not log it. The existing
5C.1 verifier already fails closed on an empty secret, but the endpoint should
distinguish "not configured" from "bad signature" for operators.

---

## Part 4 — `ingestPaymentEvent` contract

### 4a. Signature and outcome

```ts
// payment-sources/ingest.ts
export async function ingestPaymentEvent(
  repos: Repositories,
  input: PaymentEventInput,
  options: { readonly now?: number } = {},
): Promise<IngestOutcome>
```

`IngestOutcome` is:

```ts
export interface IngestOutcome {
  readonly recorded: boolean;
  readonly replay: boolean;
  readonly event: PaymentEvent;
}
```

Observed behavior:

- fresh event: `{ recorded: true, replay: false, event }`
- replay of the same identity: `{ recorded: false, replay: true, event: existing }`

Identity is deterministic:

```ts
buildIdempotencyKey(input) =
  payment_source | payment_source_reference? | event_type | source_event_id?

buildPaymentEventId(idempotencyKey) = `pevt_${stableToken(idempotencyKey)}`
```

`ingestPaymentEvent` first checks `repos.paymentEvents.getById(event_id)`.
If present, it returns the replay outcome without a write. Otherwise it writes
the event with `id = event_id`, `event_id`, `idempotency_key`, and
`observed_at = options.now ?? Date.now()`.

### 4b. Required input identity

`assertSourceIdentity` rejects an event only when both source-owned identities
are absent:

```ts
if (
  input.payment_source_reference === null &&
  input.source_event_id === null
) {
  throw new PaymentSourceError(
    "PAYMENT_EVENT_NO_SOURCE_IDENTITY",
    `cannot ingest ${input.payment_source} event without a payment_source_reference or source_event_id; refusing to fabricate or collapse identity`,
  );
}
```

For 5C.1 webhook events:

- `payment_source_reference` is the Paystack `data.reference` (or `null`);
- `source_event_id` is `${event}:${data.id}` with reference fallback
  (`charge.success:1943896549` / `charge.success:ps_789`);
- therefore a normal `charge.success` or `charge.failed` with either an `id`
  or a `reference` passes;
- a payload with neither identity fails with `PAYMENT_EVENT_NO_SOURCE_IDENTITY`.

`PaymentEventInput` also requires:

- `payment_source: "PAYSTACK"`;
- `event_type: "PAYMENT"` (the only `PaymentEventType`);
- `amount` as a non-negative safe integer in minor units;
- `currency` as a supported currency;
- `status: "SUCCESS" | "FAILED" | null` for 5C.1 webhook events;
- `occurred_at` as epoch milliseconds or `null`;
- `source_confidence: "CONFIRMED"`;
- `source_attributes` including `webhook_event` and `payload_hash`.

### 4c. Failure modes

| Failure | Where | HTTP treatment |
|---|---|---|
| Missing/invalid signature | `verifyPaystackSignature` returns `false` | `401 INVALID_SIGNATURE`; do not parse or ingest |
| Empty body / invalid JSON / non-object | raw reader / `JSON.parse` | `400 INVALID_BODY` |
| Body over 1 MiB | raw reader | `413 BODY_TOO_LARGE` |
| Unsupported event (`refund.processed`, etc.) | normalizer returns `null` | `200` ignored; do not ingest |
| Malformed supported event (`data: null`, missing amount/currency/timestamp) | root `PaystackAdapterError` | `400 INVALID_WEBHOOK_PAYLOAD`; no ingest |
| Invalid amount / unsupported currency | `PaystackAdapterError` | `400 INVALID_WEBHOOK_PAYLOAD`; no ingest |
| No source identity | `PaymentSourceError("PAYMENT_EVENT_NO_SOURCE_IDENTITY")` | `400 INVALID_WEBHOOK_PAYLOAD`; no ingest |
| Repository read/write failure | Prisma/DB error | `500 INTERNAL_ERROR`; Paystack may retry |
| Missing secret | config check | `503 WEBHOOK_NOT_CONFIGURED`; retry after config fix |

`paystackWebhookPaymentEvent` itself never writes. It throws
`PaystackAdapterError` for malformed provider data and returns `null` for
unsupported event names. `ingestPaymentEvent` does not catch repository
errors.

### 4d. Normalizer inputs still needing an owner decision

`paystackWebhookPaymentEvent(payload, options, rawBody)` requires
`PaystackAdapterOptions`, specifically `supportedCurrencies`. The webhook has
no order/currency context to derive that list from, unlike `verifyOrder`,
which passes `[order.currency]`.

There is no storefront config field for a webhook currency set. The CSV
intake uses `["NGN", "USD", "GBP"]` as a default, but that is a CSV intake
default, not a webhook policy. The endpoint must not silently use a narrow
test fixture set.

Recommended default unless the owner says otherwise: use the same explicit
set as CSV intake (`NGN`, `USD`, `GBP`) and document that other Paystack
currencies are rejected until a configuration field is added. This is a
product decision, not a technical detail.

### 4e. No raw payload persistence in 5C.1

`paystackWebhookPaymentEvent` stores only:

- `source_attributes.webhook_event`;
- `source_attributes.payload_hash` (SHA-256 of the exact raw body);
- the existing root adapter attributes (`original_status`, timestamp fields).

There is no raw delivery table and no full payload in `PaymentEvent`. If 5C.2
must provide forensic replay, that is a schema/repository increment, not just
an endpoint wiring change.

---

## Part 5 — Test harness

### 5a. Current HTTP harness

`storefront/test/server.test.ts` has **22 tests**. Its server helper is:

```ts
// server.test.ts:29-72 (abridged)
async function startServer(options?: {
  gateway?: PaystackGateway;
  dataDir?: string;
}): Promise<TestContext> {
  const dataDir =
    options?.dataDir ?? mkdtempSync(join(tmpdir(), "storefront-server-"));

  const gateway: PaystackGateway = options?.gateway ?? {
    initializeTransaction: async (input) => ({ /* fake */ }),
    verifyTransaction: async (input) => ({ /* fake SUCCESS */ }),
  };

  const config = loadConfig({ STOREFRONT_DATA_DIR: dataDir });
  const server: Server = createStorefrontServer(config, {
    repos,
    paystack: gateway,
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );
  // ...
}
```

Important limitations for webhook testing:

1. `startServer` currently passes only `STOREFRONT_DATA_DIR`; there is no way
   to set `STOREFRONT_PAYSTACK_SECRET_KEY`.
2. `startServer` does not pass `marketplace`, so the marketplace dispatch path
   is never exercised.
3. `postJson` serializes with `JSON.stringify(body)` and does not allow a raw
   body or a custom `x-paystack-signature` header.

The `repos` handle is module-level and backed by the real Prisma client.
Fixtures use fixed ids such as `b-fixture`, `p-fixture`, `o-fixture`; tests
often share state. Webhook tests must use unique event bodies/ids or clean up
inserted events.

### 5b. Required harness changes

Recommended test-only changes to `server.test.ts`:

```ts
async function startServer(options?: {
  gateway?: PaystackGateway;
  dataDir?: string;
  env?: Record<string, string | undefined>;
  marketplace?: MarketplaceTransactionDeps;
}): Promise<TestContext> {
  const config = loadConfig({
    STOREFRONT_DATA_DIR: dataDir,
    ...options?.env,
  });
  const server = createStorefrontServer(config, {
    repos,
    paystack: gateway,
    ...(options?.marketplace !== undefined
      ? { marketplace: options.marketplace }
      : {}),
  });
  // ...
}
```

Add a raw request helper:

```ts
async function postWebhook(
  baseUrl: string,
  rawBody: string,
  signature: string | null,
  options?: { contentType?: string | null },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options?.contentType !== null) {
    headers["Content-Type"] = options?.contentType ?? "application/json";
  }
  if (signature !== null) {
    headers["x-paystack-signature"] = signature;
  }
  return fetch(`${baseUrl}/webhooks/paystack`, {
    method: "POST",
    headers,
    body: rawBody,
  });
}
```

Sign the exact string in tests:

```ts
import { createHmac } from "node:crypto";

const signature = createHmac("sha512", secret)
  .update(rawBody, "utf8")
  .digest("hex");
```

### 5c. New test inventory (estimate: 15)

**Endpoint/module tests — 7:**

1. valid `charge.success` returns recorded and persists one event;
2. valid `charge.failed` records `FAILED`;
3. exact replay returns replayed and does not duplicate;
4. invalid signature returns invalid and never calls ingest;
5. unsupported event returns ignored and never ingests;
6. malformed supported payload (`data: null` / missing amount) returns invalid;
7. missing secret returns not-configured and never verifies.

**HTTP integration tests — 8:**

1. signed `POST /webhooks/paystack` returns `200` and the expected JSON;
2. same body replay returns `200` with `replay: true`;
3. tampered body / bad signature returns `401` and leaves the store empty;
4. missing signature returns `401`;
5. invalid JSON with a valid signature returns `400`;
6. unsupported event returns `200` ignored;
7. oversize body returns `413`;
8. with marketplace deps configured, the webhook does not redirect to
   `/login` (route-order regression test).

If `Content-Type` strictness is adopted, add a ninth HTTP test for `415`.
If the owner wants a raw-delivery audit, add separate tests for the audit
repository rather than folding them into endpoint tests.

### 5d. Expected totals

- 5C.1 focused tests: **12** (6 signature + 6 normalization).
- Current storefront total: **618/618**.
- 5C.2 estimate: **+15** → **633/633**.
- Core remains **213/213** unless a frozen core file is touched; 5C.2 should
  not touch core.

Tests are estimates, not a contract. The important coverage is: valid fresh,
valid replay, invalid signature, unsupported event, malformed payload,
missing secret, oversize body, and marketplace-present route ordering.

---

## Part 6 — Error / status-code semantics

### 6a. Recommended response contract

| Situation | Status | Body | Ingest? |
|---|---:|---|---|
| Fresh supported event | `200` | `{ "status": "recorded", "event_id": "pevt_…", "recorded": true, "replay": false }` | yes |
| Replay of same event | `200` | `{ "status": "replayed", "event_id": "pevt_…", "recorded": false, "replay": true }` | no (already stored) |
| Unsupported verified event | `200` | `{ "status": "ignored", "event": "refund.processed" }` | no |
| Missing secret | `503` | `{ "error": { "code": "WEBHOOK_NOT_CONFIGURED", "message": "..." } }` | no |
| Missing/invalid signature | `401` | `{ "error": { "code": "INVALID_SIGNATURE", "message": "..." } }` | no |
| Body over 1 MiB | `413` | `{ "error": { "code": "BODY_TOO_LARGE", "message": "..." } }` | no |
| Empty/invalid JSON/non-object | `400` | `{ "error": { "code": "INVALID_BODY", "message": "..." } }` | no |
| Wrong content type (if enforced) | `415` | `{ "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "..." } }` | no |
| Supported event, malformed data | `400` | `{ "error": { "code": "INVALID_WEBHOOK_PAYLOAD", "message": "...", "cause": "PAYSTACK_…" } }` | no |
| No source identity | `400` | `{ "error": { "code": "INVALID_WEBHOOK_PAYLOAD", "message": "...", "cause": "PAYMENT_EVENT_NO_SOURCE_IDENTITY" } }` | no |
| Unexpected DB/internal failure | `500` | existing `INTERNAL_ERROR` envelope | no |

### 6b. Rationale

- **Verify before parse/ingest.** A forged body must not reach the normalizer
  or the store. Invalid signature is `401`.
- **Acknowledge permanently ignored events with `200`.** Paystack retries
  non-2xx responses; an event 5C does not consume should not generate retry
  noise. `200 { status: "ignored" }` is an explicit acknowledgement.
- **Use `200` for both fresh and replay.** Replay is a successful outcome and
  must not cause Paystack to retry. The body distinguishes the cases.
- **Use `4xx` for permanent content errors and `5xx` for transient failures.**
  Malformed supported payloads and no-identity payloads cannot be fixed by a
  retry. A database failure can be.
- **Do not use `502`.** The webhook does not call Paystack; provider failure
  belongs to `verifyOrder`, not this endpoint.
- **Do not leak the secret or signature.** Error messages should describe the
  category, not echo the header or key.

### 6c. Open status-code questions

1. Should a malformed but correctly signed payload be `400` or `422`? The
   existing server uses `400` for missing fields and `409`/`502` for domain
   conflicts; `400` is the smallest consistent choice.
2. Should missing `Content-Type` be `415` or accepted for compatibility?
   Paystack sends `application/json`; strictness is safe but is a behavioral
   change relative to existing routes.
3. Should an unsupported event be `200` ignored or `204`? `200` with a body
   makes the acknowledgement observable in tests and logs.
4. Should a missing secret be `503` (recommended) or `500`? `503` distinguishes
   an unavailable configuration from an unexpected bug.

---

## Part 7 — Decomposition and risk

### 7a. Recommendation A — one increment

**5C.2** should be a single increment because 5C.1 already de-risked the two
hard parts: HMAC verification and payload normalization. The remaining work is
a thin HTTP adapter:

1. new `storefront/src/marketplace/payment-sources/webhook-endpoint.ts`
   - takes `rawBody: string`, `signature: string`, `secretKey: string`,
     `repos`, and the supported-currency options;
   - verifies signature, parses, normalizes, ingests;
   - returns a small discriminated outcome, not an HTTP status;
2. `storefront/src/server.ts`
   - add `readRawBody`;
   - register `POST /webhooks/paystack` before the marketplace block;
   - map the endpoint outcome to `HttpError` / `writeJson`.
3. tests as described in Part 5.

Keeping HTTP mapping out of the endpoint module makes the business outcomes
unit-testable without a server and keeps status-code policy in one place.

### 7b. Expected files and tests

| File | Change | Purpose |
|---|---|---|
| `storefront/src/marketplace/payment-sources/webhook-endpoint.ts` | new | signature + normalize + ingest orchestration; returns outcome |
| `storefront/src/server.ts` | modify | raw body reader, route before marketplace, status mapping |
| `storefront/test/marketplace/webhook-endpoint.test.ts` | new | ~7 endpoint tests |
| `storefront/test/server.test.ts` | modify | harness options + ~8 HTTP tests |

**Total: 4 files, ~15 tests.**

If a raw-delivery audit is required, decomposition B:

- **5C.2a** — endpoint as above (4 files, ~15 tests);
- **5C.2b** — raw delivery schema, repository, migration, and audit tests
  (+3–4 files, +5–7 tests). Do not mix the schema change into 5C.2a.

### 7c. Highest-risk assumption

**The highest-risk assumption is routing order.**

`handleRequest` currently calls `tryHandleMarketplace` before its core route
table whenever `deps.marketplace` exists. `tryHandleMarketplace` always returns
`true` and converts every unmatched path into a marketplace HTML error. The
existing `startServer` test helper does **not** pass marketplace deps, so a
webhook route added after the marketplace block would pass all current-style
tests while failing in production with a redirect or HTML 404.

Mitigation:

- place the webhook check before the `deps.marketplace` block;
- add at least one HTTP test with a marketplace dep present;
- do not rely only on the no-marketplace test path.

Secondary risks:

- **Raw-byte drift:** using `readJsonBody` and then `JSON.stringify(parsed)`
  changes whitespace/key order and breaks the signature. 5C.1 unit tests
  cannot catch this because they pass a string directly.
- **Currency set:** `paystackWebhookPaymentEvent` requires
  `supportedCurrencies`; choosing a narrow set silently drops valid Paystack
  events with `PAYSTACK_UNSUPPORTED_CURRENCY`. This needs an explicit policy.
- **Idempotency race:** two concurrent deliveries can both miss `getById` and
  race on insert. The primary key makes one write fail; the endpoint returns
  `500`, and Paystack retry then resolves as replay. This is safe but noisy;
  do not claim race-free idempotency without a unique-constraint test.

### 7d. Implementation preconditions

Before writing `src/` or `test/` files:

- owner confirms status-code policy (Part 6);
- owner confirms Content-Type strictness;
- owner confirms the supported-currency set for webhook normalization;
- owner confirms whether raw-delivery audit is in or out;
- route placement is explicitly "before marketplace dispatch" in the task.

No source, test, schema, configuration, package, or commit change is part of
this pre-flight.

---

## Open questions requiring owner ruling

1. **Decomposition:** approve A (one endpoint increment, no audit) or require
   B (endpoint now, raw-delivery audit as 5C.2b)?
2. **Status codes:** approve the Part 6 table, especially `401` for bad
   signature, `400` for malformed signed payload, `200` for ignored events,
   and `503` for missing secret.
3. **Content-Type:** require `application/json` and return `415`, or keep the
   existing lenient behavior and rely on signature + `JSON.parse`?
4. **Supported currencies:** which set should the webhook normalizer accept?
   Recommended default is the CSV intake set (`NGN`, `USD`, `GBP`) until a
   configuration field exists, but this must be an explicit product decision.
5. **Secret access:** pass `config.paystackSecretKey` into the webhook handler
   (recommended) or add a dedicated `webhookSecret` dependency? Do not expose
   the secret on `PaystackGateway`.
6. **Raw audit:** is forensic raw-delivery persistence still required for
   5C.2, or is the 5C.1 payload hash sufficient for this increment? If
   required, that is a schema/migration increment, not endpoint-only work.
7. **Response body shape:** approve `{ status, event_id?, recorded, replay }`
   or specify a different envelope.
8. **Marketplace routing:** should 5C.2 only place the webhook before the
   existing dispatch, or also fix the unused `isMarketplacePath` gate so core
   routes are reachable in production? The latter is a broader routing fix.
9. **Logging:** confirm that only event id, event name, and outcome may be
   logged; never the secret, signature, or raw body.
