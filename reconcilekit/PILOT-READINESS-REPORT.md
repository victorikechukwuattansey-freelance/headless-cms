# Pilot Readiness Report — ReconcileKit + Storefront Pilot

**Status:** READ-ONLY documentation phase (Slices 1–4 complete)
**Last verified:** 2026-08-18 (this session)
**Scope question:** _Is the current Reconcile Kit + Storefront pilot technically ready to be tested with a small number of real businesses?_

This report is evidence-based. Every capability claim cites the implementation, a test suite, or a completed validation. Nothing is asserted from assumption.

---

## 1. Executive Summary

**The pilot is technically ready to be tested with a small number of real businesses in Paystack TEST MODE, with documented operational limits.**

The technical hypothesis — _Business → Product → Order → Paystack → Verified PaymentRecord → Reconcile Kit → Expected vs Received_ — was proven end-to-end in a live Paystack test-mode transaction (12,500 NGN, SUCCESS, MATCH, difference 0) and in 81/81 storefront unit/integration tests and 294/294 root toolkit tests.

This is **not** a production readiness claim. The pilot has no webhooks, no authentication, no durable multi-process database, and no deployment story. It is a small-operator, single-process, local-first tool. Production deployment is explicitly out of scope (Section 13).

---

## 2. What Has Been Proven

### 2.1 Evidence summary

| Capability                    | Evidence                                                                                                              | Source                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Business creation             | Unit/integration tested; exercised in live test mode                                                                  | `storefront/test/server.test.ts`; Slice 3 live run                                 |
| Product creation              | Unit/integration tested; exercised in live test mode                                                                  | `storefront/test/server.test.ts`; Slice 3 live run                                 |
| Server-owned expected amount  | Test: "uses the product price, never a client-supplied amount"; amount always derived from persisted product          | `storefront/test/server.test.ts:275`; `storefront/src/server.ts:228,244`           |
| Paystack initialization       | Unit tested (fake HTTP); live test-mode initialize succeeded (HTTP 200, authorization URL)                            | `storefront/test/paystack-client.test.ts`; Slice 3 live run                        |
| Paystack reference generation | Tested: `stf_<orderId>` (dashes removed); response reference is authoritative                                         | `storefront/src/ids.ts`; Slice 3 live run (ref persisted and matched)              |
| Payment persistence (PENDING) | Live E2E: PENDING PaymentRecord persisted at order creation                                                           | Slice 3 live run                                                                   |
| Paystack verification         | Live E2E: verify returned success with `paid_at`                                                                      | Slice 3 live run (paidAt `2026-08-18T12:37:49.000Z`)                               |
| Reference integrity           | Tests + live: returned reference must equal persisted; mismatch → 502 `REFERENCE_MISMATCH`, nothing recorded          | `storefront/test/verify-order.test.ts`; Slice 3                                    |
| Amount integrity              | Tests: mismatch blocks SUCCESS → UNKNOWN + `AMOUNT_MISMATCH`; live exact match                                        | `storefront/test/verify-order.test.ts`; Slice 3                                    |
| Currency integrity            | Tests: mismatch blocks SUCCESS → UNKNOWN + `CURRENCY_MISMATCH`; live NGN match                                        | `storefront/test/verify-order.test.ts`; Slice 3                                    |
| Payment timestamp             | `paidAt` = Paystack `paid_at` (verified live, identical to independent Paystack verify)                               | `storefront/src/application/verify-order.ts:102-105`; Slice 3                      |
| Idempotent verification       | Tests (3× verify → single SUCCESS line) + live (callback + 3 POST verifies → exactly 2 payment lines)                 | `storefront/test/verify-order.test.ts`; Slice 3 live run                           |
| PaymentRecord persistence     | Live: PENDING + SUCCESS lines in `payments.jsonl`, latest wins                                                        | Slice 3 live run                                                                   |
| Reconciliation adapter        | Slice 4 tests: `PaymentRecord` → merchant/provider contract rows                                                      | `storefront/src/reconcile/adapter.ts`; `storefront/test/reconcile-adapter.test.ts` |
| Frozen engine compatibility   | Slice 4: engine consumed adapter output with no changes; root suite unchanged                                         | Slice 4; `src/application/reconcile-records.ts` untouched                          |
| Expected-vs-received result   | Slice 4 tests + live: 12500 / 12500 / diff 0 / MATCH; mismatch cases → DISCREPANCY                                    | `storefront/test/reconcile-adapter.test.ts:1-7`; Slice 4 e2e                       |
| Merchant CSV compatibility    | Round-trip through the frozen `parseMerchantCsv` field-for-field; real CLI consumed `/reconcile/merchant.csv` → MATCH | `storefront/test/reconcile-adapter.test.ts:11`; Slice 4 e2e                        |

### 2.2 Test counts (verified this session)

- Slice 1–3 end state: **63 storefront tests** (from Slice 3 session records; 63 + 18 Slice-4 additions = 81 current).
- **81/81 storefront tests** pass (7 test files, verified this session).
- **294/294 root toolkit tests** pass (including the storefront suite via `node --test` discovery).
- Storefront typecheck PASS; root typecheck PASS.
- **Live Paystack test-mode transaction: PASS** — 12,500 NGN, SUCCESS, correct reference (`stf_dd058fcc46bb4b63a8f26d8952127ab6`), NGN, `paid_at` matched, reconciliation **MATCH**, difference **0**. Independently confirmed via `GET /transaction/verify/<ref>` (identical amount/currency/paid_at/status).
- Frozen reconciliation core remained **completely untouched** across all slices (`src/domain/*`, `src/application/reconcile-records.ts`, `src/adapters/*`, `src/cli/*`).

---

## 3. Current Pilot Capabilities

The exact currently available workflow (all endpoints verified in code and tests; nothing invented):

1. `POST /businesses` `{name}` → business persisted (`data/businesses.jsonl`).
2. `POST /products` `{businessId, name, priceMinor, currency}` → product persisted (`data/products.jsonl`); price is server-owned, minor units.
3. `POST /orders` `{businessId, productId, customerEmail}` → reference `stf_<orderId>` generated → Paystack `initialize` called with product price + callback URL → order (`PAYMENT_INITIATED`) + PaymentRecord (`PENDING`) persisted; 502 with retryable order id on init failure.
4. Customer completes the Paystack hosted checkout (`authorizationUrl` from step 3).
5. Paystack redirects the browser to `GET /callback?orderId=...&reference=...&trxref=...`.
6. The callback runs server-side verification of the **persisted** reference (it does not trust the query string).
7. Paystack `verify` is called; integrity checks (reference, amount, currency) applied; PaymentRecord updated only when effective state changes.
8. `GET /reconcile` (optionally `?orderId=`) exposes expected vs received per order through the frozen reconciliation engine.
9. `GET /reconcile/merchant.csv` exports the exact merchant CSV contract the existing CLI consumes (`merchant_reference,amount,currency,status,occurred_at,merchant_record_id`).

Additional endpoints: `GET /health`.

---

## 4. Data Integrity Model

Rules enforced by the implementation, and why they matter for reconciliation:

- **Expected amount comes from the persisted product/order** — `POST /orders` reads `product.priceMinor` server-side; no client-supplied amount is ever accepted (`server.ts:228,244`). Reconciliation can trust the expected side.
- **Client cannot determine expected amount** — the order request carries only `businessId`, `productId`, `customerEmail`.
- **Persisted Paystack reference is authoritative** — the order owns the reference; verification always uses `order.paystackReference`, never a client-supplied one.
- **Paystack returned reference is validated** — a returned reference differing from the persisted one yields `REFERENCE_MISMATCH` (502) and nothing is recorded.
- **Paystack amount is validated** — a transaction is `SUCCESS` only when Paystack amount equals the persisted expected amount; otherwise status is `UNKNOWN` with raw facts preserved in metadata (`paystack_amount`, `integrity`).
- **Paystack currency is validated** — same rule via `integrity` (`CURRENCY_MISMATCH`, `paystack_currency`).
- **Paystack `paid_at` is the payment timestamp** — `paidAt` comes from Paystack's `paid_at`; verification-request time is recorded only in `metadata.verified_at` (the engine's temporal validation compares real payment instants).
- **Canonical status vocabulary** — PaymentRecord uses the frozen `CanonicalPaymentStatus` (`PENDING/SUCCESS/FAILED/CANCELLED/UNKNOWN`); `abandoned` maps to `UNKNOWN`, never `CANCELLED`.
- **Latest JSONL record is effective** — updates append a line; reads return the newest per id (`jsonl-store.ts`; adapter `effectivePaymentRecords` mirrors this).
- **Repeated identical verification appends nothing** — idempotency on `(status, paidAt)`; proven in tests and live (4 verifies → 2 lines total).

Why this matters: every expected-vs-received comparison in `/reconcile` is only as trustworthy as these ownership rules. They guarantee the expected side cannot be manipulated by the customer and the received side is Paystack's own facts, captured at verification time.

---

## 5. Reconciliation Boundary

```
PaymentRecord (storefront)
  → [storefront/src/reconcile/adapter.ts]        adapter — no logic moved
  → MerchantPayment (expected) + ProviderPayment (received, from verify metadata)
  → reconcileRecords (frozen src/application/reconcile-records.ts)
  → ReconciliationReport
  → [storefront/src/reconcile/view.ts]           expected-vs-received shaping
  → GET /reconcile
```

- The storefront implements **no reconciliation logic** — it calls the frozen engine and shapes the report.
- The frozen domain remains **provider-neutral**; the adapter produces the provider-neutral merchant/provider contracts, and `ProviderPayment` provenance is the Paystack facts persisted at verification time.
- Storefront adapts **to** Reconcile Kit; the engine was never modified to accommodate it.
- The adapter's provider rows are offline-deterministic (built from persisted metadata), so `/reconcile` requires no network.
- The engine's verdicts (`MATCH` / `DISCREPANCY` / `UNRESOLVED` / `MISSING_PROVIDER_RECORD` / … with codes `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `STATUS_MISMATCH`, `STATUS_UNRESOLVED`, …) are the reconciliation semantics displayed; the storefront invents no second algorithm.
- The real 12,500 NGN transaction produced **MATCH with zero difference**, through both `/reconcile` and the unmodified CLI.

---

## 6. Pilot Setup Requirements

What a pilot operator needs:

| Requirement       | Value                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js           | `>=24.12.0` (both `reconcilekit/package.json` and `storefront/package.json` engines)                                                                                           |
| Install           | `npm install` at the repo root (installs `csv-parse` + dev tooling); storefront has **zero runtime dependencies**                                                              |
| Typecheck         | `npm run typecheck` (root and `storefront/`)                                                                                                                                   |
| Tests             | `npm test` (root and `storefront/`); root also discovers the storefront suite                                                                                                  |
| Port              | `STOREFRONT_PORT` (default `8787`)                                                                                                                                             |
| Data directory    | `STOREFRONT_DATA_DIR` (default `<storefront>/data`) — JSONL files, gitignored, created on demand                                                                               |
| Paystack secret   | `STOREFRONT_PAYSTACK_SECRET_KEY` (storefront), `RECONCILEKIT_PAYSTACK_SECRET_KEY` (CLI) — environment only, never `.env`-loaded, never required to boot                        |
| Paystack base URL | `STOREFRONT_PAYSTACK_BASE_URL` (default `https://api.paystack.co`; HTTPS enforced)                                                                                             |
| Callback URL      | `STOREFRONT_CALLBACK_BASE_URL` (default `http://localhost:<port>`) — must be reachable from the paying customer's browser; the `callback_url` is sent to Paystack `initialize` |
| Data isolation    | Each `STOREFRONT_DATA_DIR` is independent; pilot data never touches repo files; runtime data is gitignored                                                                     |

**Test mode vs live mode (must be explicit):**

- **Test mode (pilot default):** use a `sk_test_...` key; payment completes via Paystack's hosted test checkout (test card / test shortcuts); no real money moves; fully validated in this repo (Slice 3).
- **Live mode:** set a `sk_live_...` key. The code paths are identical; **no live-mode transaction has been executed in this project**. Live mode exposes real money flows and real customer data and must not be enabled until the operator accepts production-level responsibility (Sections 13–14).
- The secret is environment-only; never pass it on the command line, never commit it, never paste it into reports.

---

## 7. Pilot Workflow

Minimum workflow for one pilot business (all steps exist today):

1. **Business creation** — `POST /businesses` once.
2. **Product creation** — `POST /products` per product/service (price in minor units, currency).
3. **Payment link** — `POST /orders` → capture `order.id` and `authorizationUrl`.
4. **Customer payment** — customer opens the Paystack authorization URL and pays (hosted checkout).
5. **Verification** — Paystack redirects to `/callback`; verification runs automatically. (Operator can also `POST /orders/:id/verify` at any time.)
6. **Reconciliation inspection** — `GET /reconcile` (or `?orderId=`) shows expected vs received, status, reference, outcome; `GET /reconcile/merchant.csv` feeds the existing CLI (`--merchant` + provider mode).

No dashboard, no accounts, no UI beyond the minimal callback page — operators drive the workflow via HTTP and the reconciliation endpoints.

---

## 8. Pilot Test Matrix

| Scenario                          | Expected outcome                                                    | Automated?                                                                                          |
| --------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Exact payment                     | MATCH, difference 0                                                 | ✅ tested + live                                                                                    |
| Underpayment                      | DISCREPANCY (`AMOUNT_MISMATCH`)                                     | ✅ unit-tested (fixtures); ❌ not yet in a real checkout                                            |
| Overpayment                       | DISCREPANCY (`AMOUNT_MISMATCH`)                                     | ✅ unit-tested (fixtures); ❌ real checkout                                                         |
| Failed payment                    | non-success state preserved (`FAILED`, never presented as received) | ✅ unit-tested; ❌ real checkout (test "Declined" shortcut unused so far)                           |
| Abandoned/unresolved payment      | `UNKNOWN` / `UNRESOLVED`; abandoned never `CANCELLED`               | ✅ unit-tested (mapping + view); ❌ real checkout                                                   |
| Repeated verification             | no duplicate effective state                                        | ✅ tested + live (4 verifies → 2 lines)                                                             |
| Multiple orders                   | references remain isolated per order                                | ✅ unit-tested; ❌ multi-order real run                                                             |
| Currency mismatch                 | explicit mismatch, no numeric difference                            | ✅ unit-tested; ❌ real checkout (NGN-only tested live)                                             |
| Missing provider record (PENDING) | `MISSING_PROVIDER_RECORD`, received unresolved                      | ✅ unit-tested; ✅ live (callback before payment not exercised; PENDING state observed pre-payment) |
| Reference tampering               | `REFERENCE_MISMATCH` 502, nothing recorded                          | ✅ unit-tested; ❌ not exercised live                                                               |

Scenarios requiring pilot validation: real-checkout under/over/failed/abandoned variants and multi-order runs — all currently covered by deterministic fixtures only.

---

## 9. Known Limitations

Confirmed from code (none are defects against the declared pilot scope):

- **Verify-on-return dependency** — payment state is captured when the customer returns to the callback (or an operator calls `POST /orders/:id/verify`). There is no webhook; if the customer never returns and nobody verifies, the record stays `PENDING` even if Paystack believes it succeeded.
- **No webhook handling** — `paystack_webhook` support is intentionally absent; metadata design supports later webhook updates without contract change.
- **Unauthenticated pilot** — every endpoint is open; anyone who can reach the port can create businesses/products/orders and read `/reconcile`.
- **JSONL single-process persistence** — writes are serialized per process (`writeChain`); concurrent processes on the same data directory are unsupported.
- **No multi-process shared data directory** — no file locking; one storefront process per data directory.
- **`provider_id` is currently null** in the reconciliation provider row — the Paystack transaction `id` is not persisted in PaymentRecord metadata; reference is the join key (verified in `verify-order.ts` metadata fields and `adapter.ts`).
- **`refundStatus` remains `NONE`** — refund lifecycle out of scope; no path sets `PARTIAL_REFUND`/`REFUNDED`.
- **No customer accounts** — orders are email-annotated only.
- **No production database** — append-only JSONL files in a local directory.
- **No production storefront UI** — only the minimal callback HTML page; creation flows are HTTP-API-only.
- **Received amounts are immutable-as-verified** — `/reconcile` reflects the Paystack facts captured at the last verification; a later webhook would append a newer line (design supports it; feature does not exist yet).
- **Callback URL must be reachable from the customer's browser** — localhost works for local pilots; remote pilots need a public base URL.
- **No retry/backoff on Paystack transport errors** — verification returns 502 and can be retried manually; no automatic retry.

---

## 10. Security Considerations

Current pilot security posture (verified in code):

- **Secret is environment-only** — `config.ts` reads `process.env`; no `.env` loading; `.env`/`.env.*` are gitignored (`reconcilekit/.gitignore`).
- **Secrets are not committed** — no credential material in the repo; root security tests assert "secret never appears in error messages" (`transport.test.ts`, CLI suite).
- **Secret is not logged** — `main.ts` logs only presence/absence; errors carry no secret value.
- **Client does not control expected payment values** — amounts/currencies come from persisted products.
- **Verification is server-side** — `POST /orders/:id/verify` and the callback call Paystack with the persisted reference; the callback's query params are never trusted (`verifyOrder` uses `order.paystackReference`).
- **Callback cannot self-certify payment** — the callback always re-runs API verification; success is impossible without a Paystack verifiable `success` response.
- **No authentication exists** — open read/write on the pilot port.

What this means for pilot usage: acceptable for local, controlled test-mode pilots; the moment the storefront is reachable beyond a trusted local operator — or any real (live-mode) money moves — the missing authentication and webhooks become blocking. See Section 13.

---

## 11. Operational Risk

| Risk                                        | Class                | Current mitigation / limitation                                                                                                       |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Payment captured but customer never returns | MEDIUM               | Manual `POST /orders/:id/verify` recovers state any time; no webhook, so un-verified orders stay `PENDING` until an operator verifies |
| JSONL persistence                           | LOW–MEDIUM           | Append-only, corrupt lines skipped non-fatally, latest-wins semantics tested; single-file-per-collection, no checksums                |
| Concurrent processes on one data dir        | HIGH (if it happens) | Unsupported; operator must run exactly one storefront process per data directory (documented; untested behavior)                      |
| Paystack availability                       | LOW–MEDIUM           | Transient failures → clear 502 `VERIFY_FAILED`, records untouched, manual retry safe (tested); no automatic retry/backoff             |
| Credential/configuration errors             | LOW                  | Boot without secret; clear 502 until configured; port/base-URL validation at startup; secrets never echoed                            |
| Data corruption                             | LOW                  | Corrupt JSONL lines skipped, one bad line never destroys the store (tested); no backup tooling                                        |
| Duplicate verification                      | LOW                  | Idempotency on `(status, paidAt)` proven in tests and live                                                                            |
| Incorrect expected amount                   | LOW                  | Expected amount is product-sourced; test "uses the product price, never a client-supplied amount"                                     |
| Reference mismatch                          | LOW                  | `REFERENCE_MISMATCH` blocks recording; tested                                                                                         |
| Currency mismatch                           | LOW                  | `CURRENCY_MISMATCH` blocks SUCCESS → UNKNOWN; explicit mismatch in `/reconcile`; no silent conversion                                 |
| Local data loss                             | MEDIUM               | No backup/recovery tooling; deleting `data/` loses pilot state (reference-level knowledge retained in Paystack dashboard)             |

---

## 12. Pilot Success Criteria

Measurable evidence for declaring the pilot successful (business value first; no invented numerical targets):

1. Businesses can create products and orders themselves and obtain working payment links.
2. Customers can complete payments end-to-end on the hosted checkout.
3. Every transaction produces a structured, replayable PaymentRecord.
4. References remain traceable from payment to order to reconciliation row (no orphans in normal flow).
5. Expected amounts remain server-controlled (a customer cannot set the price).
6. `/reconcile` output is understandable to the operator: expected, received, difference, status, reference, outcome.
7. Discrepancies are visible, not silently accepted (under/over/currency/status cases surface as DISCREPANCY).
8. An operator can always answer "what happened to this transaction?" from the JSONL or `/reconcile`.
9. Pilot businesses report reconciliation is **materially easier** than their current process (this is the primary acceptance signal).

---

## 13. What Is NOT Ready (pilot ≠ production)

Items that must exist before production deployment — none are implemented (by design):

- **Webhook-based payment confirmation** — production capture must not depend on the customer returning.
- **Durable production database** — JSONL is pilot persistence, not production grade (backup, concurrency, integrity tooling).
- **Authentication/authorization** — `/reconcile` and creation endpoints are open.
- **Multi-process / multi-replica persistence** — single-process only.
- **Production observability** — no structured logs, metrics, tracing, or alerting.
- **Backup/recovery** — no tooling or runbook for `data/`.
- **Production security hardening** — no TLS termination, rate limiting, audit log, or secret rotation workflow.
- **Production-grade deployment** — no containers, process supervision, or config management.
- **Refund lifecycle handling** — `refundStatus` stays `NONE`.

---

## 14. Recommended Next Decision

**The next decision is whether to run a small real-business pilot — not to build more software.**

The evidence to collect before adding anything else to the codebase:

- **Primary question:** does the structured payment record make reconciliation materially easier for a real business?
- Secondary questions the pilot must answer:
  1. Do businesses understand the workflow (product → payment link → verify → `/reconcile`)?
  2. Are the payment records trustworthy (traceability, expected-vs-received clarity)?
  3. Are discrepancies actionable (can the operator act on a DISCREPANCY row)?
  4. Where does the workflow break in real usage (callback timing, abandoned payments, operator habits)?
  5. What feature requests recur across businesses (these become Slice-5 input **only if and when they recur**)?
  6. Which documented limitations actually matter operationally (e.g., no-webhook PENDING drift, single process)?

No Slice 5 is recommended from this report; feature work should follow pilot evidence, not precede it.

---

## 15. Evidence Log

| Evidence                                                   | Status                                | Source                                                         |
| ---------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Storefront typecheck                                       | PASS                                  | `npm run typecheck` (storefront), this session                 |
| Storefront tests                                           | PASS 81/81                            | `npm test` (storefront), this session                          |
| Root typecheck                                             | PASS                                  | `npm run typecheck` (root), this session                       |
| Root tests                                                 | PASS 294/294 (incl. storefront suite) | `npm test` (root), this session                                |
| Paystack test-mode payment                                 | PASS                                  | Slice 3 live E2E (hosted checkout, test card/shortcuts)        |
| PaymentRecord integrity (amount/currency/reference/paidAt) | PASS                                  | Slice 3 live E2E + `transaction/verify` cross-check            |
| Repeated verification (no duplicate effective state)       | PASS                                  | Slice 3 live E2E (4 verifies → 2 payment lines)                |
| Frozen engine compatibility                                | PASS                                  | Slice 4 (adapter consumed by unchanged engine; CLI round-trip) |
| Real transaction reconciliation                            | PASS                                  | 12,500 NGN → MATCH, difference 0, `/reconcile` + CLI           |
| Under/overpayment real checkout                            | NOT TESTED LIVE                       | unit-tested only (fixtures)                                    |
| Multiprocess/failed/abandoned real checkout                | NOT TESTED LIVE                       | unit-tested only                                               |
| Production webhook                                         | NOT IMPLEMENTED                       | current scope                                                  |
| Production database                                        | NOT IMPLEMENTED                       | current scope (JSONL pilot persistence)                        |
| Authentication                                             | NOT IMPLEMENTED                       | current scope                                                  |
| Refund lifecycle                                           | NOT IMPLEMENTED                       | `refundStatus` always `NONE`                                   |

---

_Report generated from repository inspection and session validation records; no application code was modified during this phase._
