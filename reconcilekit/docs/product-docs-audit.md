# Product Docs Audit

**Date:** 2026-10-22  
**Branch / HEAD:** `main` / `1e6778a docs(5c): close webhooks track`  
**Scope:** Read-only verification of four existing product documents against the current codebase.  
**Audit target:** `reconcilekit/docs/ASSUMPTIONS_AND_GAPS.md`, `BILLPOINT_PARITY_MATRIX.md`, `MVP_SCOPE.md`, `PRODUCT_ARCHITECTURE.md`.

## Executive Summary

The four documents are directionally sound, unusually honest about scope, and still useful. They are **not** a current description of the implementation.

- The MVP is substantially built: catalog, wallet, providers, reconciliation bridge, timeline, receipts, evidence, refunds/reversals, gift cards, tickets, notifications, and admin queues exist.
- The MVP is **not complete by its own completion criteria**. Catalog navigation is broken, a payment failure is invisible to the admin “failed” view, and several promised customer surfaces are missing or partial.
- The biggest documentation drift is not architecture. It is **state**: the docs still describe a JSONL pilot with no auth, no database, and no webhooks, while the code now has Postgres/Prisma, local session auth with roles, and a Paystack webhook.
- The BillPoint matrix is evidence-disciplined. All **37 of 37** BillPoint evidence cells remain `UNKNOWN - REQUIRES RESEARCH`; the repository contains **0 verified parity claims**.

### Headline Counts

| Measure | Result |
| --- | ---: |
| Documents audited | 4 |
| Actual / non-empty lines | 214/163, 90/75, 295/235, 419/329 |
| BillPoint matrix rows | 37 conservative + 6 differentiation |
| BillPoint evidence rows verified | 0 of 37 |
| Catalog categories / services | 12 / 24 |
| Demo scenarios | 16 (15 orderable + 1 wallet-only) |
| MVP customer surfaces satisfied | 10 of 17; 7 partial |
| MVP catalog items satisfied | 12 of 15; 2 partial; 1 N/A-future |
| MVP scenarios satisfied | 14 of 18; 4 partial |
| Admin requirements satisfied | 15 of 17; 2 partial |
| Demo requirements satisfied | 6 of 6 |
| MVP completion criteria | 12 satisfied; 3 partial; 1 drifted |
| Known gaps | 17 closed; 4 partial; 2 open; 7 unknown |
| Direct doc-vs-doc contradictions | 0 unresolved |
| Material doc-vs-code drifts | 12 |
| Production blockers | 1 satisfied; 4 partial; 9 open |

### Verdict

**Overall: `PARTIALLY-SATISFIED`.** The documents accurately describe the intended product and most of the implementation, but they overstate completeness in specific, verifiable ways and contain stale “current state” sections.

The MVP completion criterion **“Catalog navigation works” is false**: catalog cards and the service “Buy now” action both produce 404s.

---

## Method And Limitations

- Static, read-only inspection of the four documents, the storefront source, Prisma schema, tests, and existing phase docs.
- No source, tests, schema, Prisma, or target documents were modified.
- No application server, database, or test suite was executed for this audit. Test statements are based on test code and assertions, not a fresh run.
- BillPoint was not researched externally. Parity status therefore remains unknown by design.
- Counts are based on the actual bullets/rows in the documents. The MVP has **17** customer-surface bullets and **16** out-of-scope bullets, not the earlier working totals.

Verdict vocabulary: `SATISFIED`, `PARTIALLY-SATISFIED`, `DRIFTED`, `SUPERSEDED`, `MISSING`, `N/A-FUTURE`.

Gap-only vocabulary: `CLOSED-BY-5B1`, `CLOSED-BY-5C`, `NO-LONGER-A-GAP`, `OPEN`, `UNKNOWN`.

---

# Part 1 — Assumptions And Gaps

## 1.1 Repository Facts

**10 of 11 remain accurate; 1 is stale.**

| Claim | Verdict | Evidence |
| --- | --- | --- |
| TypeScript ReconcileKit package | `SATISFIED` | Root package and `src/` unchanged. |
| Frozen provider-neutral reconciliation architecture | `SATISFIED` | Root domain/application boundary remains intact. |
| Domain types for payments, outcomes, statuses, discrepancies | `SATISFIED` | `src/domain/model.ts`. |
| Exact-reference deterministic reconciliation | `SATISFIED` | `src/domain/reconcile.ts`. |
| Validation and discrepancy classification | `SATISFIED` | `src/domain/validation.ts`. |
| Duplicate/conflicting-attribute handling | `SATISFIED` | `src/domain/duplicates.ts`. |
| CSV adapter | `SATISFIED` | `src/adapters/merchant/csv.ts`. |
| Paystack adapter and transport | `SATISFIED` | `src/adapters/providers/paystack/*`. |
| CLI file and live Paystack modes | `SATISFIED` | Root CLI. |
| Storefront pilot uses JSONL persistence | `SUPERSEDED` | Current storefront is Prisma/Postgres; see §1.3 and `storefront/prisma/schema.prisma`. |
| Core and storefront tests | `SATISFIED` | Root and `storefront/test/` suites exist. |

## 1.2 Existing Constraints

**9 satisfied, 1 partial, 3 superseded.**

| Constraint | Verdict | Evidence |
| --- | --- | --- |
| Root toolkit, not ledger/payment processor | `SATISFIED` | Root does not custody or move money. |
| Provider-neutral core | `SATISFIED` | No marketplace imports in root domain. |
| Provider mapping in adapters | `SATISFIED` | Provider adapters isolate mapping. |
| No fuzzy matching | `SATISFIED` | Exact reference only. |
| No floating-point money comparison | `SATISFIED` | Integer minor units. |
| No arbitrary duplicate pairing | `SATISFIED` | Duplicate/ambiguity semantics retained. |
| No production database | `SUPERSEDED` | Postgres/Prisma is now the store. |
| Storefront has no auth and no production dashboard | `SUPERSEDED` | Session auth, login, roles, and admin dashboard exist. |
| JSONL is single-process/local-first | `SUPERSEDED` | Persistence moved to Postgres. |
| Refund lifecycle out of scope for root engine | `SATISFIED` | Refunds remain application-level. |
| `refundStatus` remains `NONE` | `PARTIALLY-SATISFIED` | Legacy `PaymentRecord` still uses `NONE`; marketplace refunds are separate `Refund` records. |
| Paystack live mode explicit | `SATISFIED` | Live mode remains opt-in. |
| Secrets environment-only | `SATISFIED` | No secret logging observed. |

## 1.3 MVP Assumptions

**7 satisfied, 1 partial, 2 superseded.**

| Assumption | Verdict | Evidence |
| --- | --- | --- |
| `storefront/` is the place to evolve the MVP | `SATISFIED` | Marketplace modules live there. |
| JSONL is acceptable for the MVP | `SUPERSEDED` | Postgres adopted in Phase 5B.1. |
| Node built-ins remain preferred | `PARTIALLY-SATISFIED` | Prisma, Argon2, and other dependencies were added with documented justification. |
| ReconcileKit determines payment truth | `SATISFIED` | `reconcile-bridge.ts` invokes the engine. |
| Fulfillment state can live outside ReconcileKit | `SATISFIED` | Marketplace owns fulfillment/resolution. |
| Mock providers are enough | `SATISFIED` | Mock provider registry and contracts. |
| Auth can be a local shell | `SUPERSEDED` | Real local password/session auth and roles now exist, though not production auth. |
| Notifications can be in-app | `SATISFIED` | `notifications.ts` and UI. |
| Admin actions can be simulated | `SATISFIED` | Local resolution transitions. |
| Refunds/reversals can be application-level | `SATISFIED` | `resolution.ts`. |

## 1.4 Ambiguities

**4 resolved, 1 partial, 1 unknown.**

| Ambiguity | Resolution | Verdict |
| --- | --- | --- |
| Payment truth vs fulfillment truth | ReconcileKit owns payment/provider truth; marketplace owns fulfillment/resolution. | `SATISFIED` |
| Refund/reversal semantics | Application-level records; root outcomes unchanged. | `SATISFIED` |
| Settlement mismatch | Wallet/ledger state exists, but no end-to-end demo/UI scenario. | `PARTIALLY-SATISFIED` |
| BillPoint baseline | Still no verified evidence. | `MISSING` (research unknown) |
| Provider references across services | Stable marketplace reference is the join key; fulfillment refs are evidence. | `SATISFIED` |
| Provider timeout | Operational event; no fabricated discrepancy. | `SATISFIED` |

## 1.5 Known Gaps

**17 closed, 4 partial, 2 open, 7 unknown.**

| Gap group | Count | Assessment |
| --- | ---: | --- |
| Product/application gaps | 16 | 14 closed; 2 partial: dispute/support (no customer intake UI) and demo seed (environment auto-seed, no dedicated command). |
| Engineering gaps | 7 | 3 closed: multi-process persistence, durable DB, webhooks. 2 partial: API docs, UI runtime/visual verification. 2 open: production build/deployment, production auth. |
| Research gaps | 7 | All 7 remain `UNKNOWN`; BillPoint and provider/compliance research were not performed. |

Notable closed gaps: customer UI, admin UI, catalog, category forms, wallet, provider architecture, gift cards, ticketing, timeline, receipt, evidence view, notifications, refund/reversal workflow, settlement state model.

## 1.6 Production Blockers

**1 satisfied, 4 partial, 9 open.**

| Blocker | Verdict | Evidence |
| --- | --- | --- |
| Real authentication and authorization | `PARTIALLY-SATISFIED` | Local sessions, Argon2, roles, organizations; no production identity, MFA, recovery, or registration flow. |
| Durable database and migrations | `SATISFIED` | Prisma/Postgres schema and migrations. |
| Webhooks and idempotent ingestion | `PARTIALLY-SATISFIED` | Paystack webhook with signature and idempotent ingestion; no provider-neutral webhook framework. |
| Provider credential management and rotation | `MISSING` | No credential management surface. |
| Audit log hardening | `PARTIALLY-SATISFIED` | Audit/event records exist; no tamper-evident/log-integrity controls. |
| Monitoring, metrics, alerting | `MISSING` | No operational telemetry. |
| Rate limiting | `MISSING` | No rate limiter. |
| Backups and recovery | `MISSING` | No backup/recovery design. |
| Real payment compliance | `MISSING` | Out of scope. |
| Wallet/custody legal and technical design | `MISSING` | Simulated wallet only. |
| FX compliance | `MISSING` | No FX execution. |
| Gift-card provider and fraud controls | `PARTIALLY-SATISFIED` | Mock risk flags and masking; no provider fraud controls. |
| Ticketing provider contracts | `MISSING` | Mock ticketing only. |
| Betting/gaming compliance review | `MISSING` | Compliance-gated, not activated. |

## 1.7 Documentation Gap

**6 satisfied, 2 partial, 1 missing.**

Satisfied: local run, demo mode, transaction lifecycle, catalog extension, provider extension, ReconcileKit invocation.

Partial: refund/reversal simulation (implementation exists; customer tracker missing), known limitations (README/UI copy stale).

Missing: deployment/production-build notes.

---

# Part 2 — MVP Scope

## 2.1 Customer Surfaces

**10 satisfied, 7 partial.**

| # | Surface | Verdict | Evidence / Gap |
| ---: | --- | --- | --- |
| 1 | Landing/home screen | `PARTIALLY-SATISFIED` | `/` renders the dashboard; `renderHomePage` exists but is never called (`server.ts:765-767`). |
| 2 | Authentication shell | `SATISFIED` | `/login`, session cookies, Argon2, demo identity. |
| 3 | User dashboard | `SATISFIED` | `/dashboard` and `/`. |
| 4 | Wallet view | `SATISFIED` | `/wallet` read-only balance and ledger. |
| 5 | Catalog | `PARTIALLY-SATISFIED` | `/catalog` renders; service cards link to the wrong path. |
| 6 | Category pages | `SATISFIED` | `/catalog/:categoryId` works. |
| 7 | Product/service selection | `PARTIALLY-SATISFIED` | `/services/:serviceId` works directly; catalog cards do not reach it. |
| 8 | Checkout | `PARTIALLY-SATISFIED` | Direct `/checkout/:serviceId` and POST `/checkout` work; service CTA does not. |
| 9 | Transaction confirmation | `SATISFIED` | Checkout redirects to transaction detail. |
| 10 | Transaction details | `SATISFIED` | `/transactions/:id`. |
| 11 | Transaction timeline | `SATISFIED` | Stored events rendered on detail. |
| 12 | Receipt | `SATISFIED` | `/transactions/:id/receipt`. |
| 13 | Evidence view | `SATISFIED` | `/transactions/:id/evidence`. |
| 14 | Refund/reversal tracker | `PARTIALLY-SATISFIED` | Admin detail shows refund/reversal records; customer detail only shows `resolutionStatus`, not the records (`admin-pages.ts:147-171`; no `vm.refund`/`vm.reversal` in customer pages). |
| 15 | Dispute/support flow | `PARTIALLY-SATISFIED` | Dispute list and backend exist; no customer create form. The only create form targets `/transactions/:id/dispute` while the route is `/transactions/:id/disputes` (`admin-pages.ts:898`, `server.ts:1063`). |
| 16 | Notifications | `SATISFIED` | `/notifications`, mark-read. |
| 17 | Profile/settings | `PARTIALLY-SATISFIED` | `/profile` is read-only; no settings. |

## 2.2 Catalog

**12 satisfied, 2 partial, 1 N/A-future.**

Satisfied: airtime, mobile data, electricity, cable/pay TV, internet, gift cards, digital vouchers, cinema, event, bus/transport, airline, payment authorization.

Partial: education (JAMB/WAEC payments exist; no exam-pin product or pin artifact) and wallet funding (backend and seeded failure exist; no customer funding route/UI).

N/A-future: betting/gaming is correctly compliance-gated and not checkout-eligible.

Full service-level assessment is in **Part 6**.

## 2.3 Transaction Scenarios

**14 satisfied, 4 partial.**

| # | Scenario | Verdict | Evidence / Gap |
| ---: | --- | --- | --- |
| 1 | Successful transaction | `SATISFIED` | `successful_airtime`. |
| 2 | Failed transaction | `SATISFIED` | `failed_data`, provider failure path. |
| 3 | Delayed provider response | `PARTIALLY-SATISFIED` | Pending path exists; no distinct delay timing/materialization. |
| 4 | Pending transaction | `SATISFIED` | `pending_electricity`, `airline_booking_pending`. |
| 5 | Provider timeout | `SATISFIED` | `provider_timeout`. |
| 6 | Payment succeeded but service failed | `SATISFIED` | `payment_success_service_failure`. |
| 7 | Service succeeded but provider confirmation delayed | `PARTIALLY-SATISFIED` | Pending state exists; no explicit confirmation-delay scenario. |
| 8 | Duplicate transaction | `SATISFIED` | Deterministic identity/idempotent replay. |
| 9 | Duplicate debit | `PARTIALLY-SATISFIED` | `duplicate_debit` is a provider-duplicate response with one debit; a true double debit is only unit-tested when `duplicate: true` is passed (`wallet.test.ts:765`). |
| 10 | Reversal | `SATISFIED` | `payment_reversal`. |
| 11 | Refund initiated | `SATISFIED` | Refund workflow and admin action. |
| 12 | Refund completed | `SATISFIED` | `bus_ticket_refund` / completion action. |
| 13 | Refund pending | `SATISFIED` | `refund_pending`. |
| 14 | Mismatched provider reference | `SATISFIED` | `provider_mismatch`. |
| 15 | Missing provider reference | `SATISFIED` | Pending/timeout paths produce missing provider record. |
| 16 | Amount discrepancy | `SATISFIED` | Mismatch scenario and tests. |
| 17 | Settlement mismatch | `PARTIALLY-SATISFIED` | Ledger state and wallet test exist; no order/demo/UI scenario. |
| 18 | Manual review | `SATISFIED` | `manual_review`, admin queue. |

## 2.4 Admin / Operations

**15 satisfied, 2 partial.**

| # | Requirement | Verdict | Evidence / Gap |
| ---: | --- | --- | --- |
| 1 | Transaction volume | `SATISFIED` | Admin dashboard total. |
| 2 | Transaction state breakdown | `SATISFIED` | Nine status counts. |
| 3 | Failed transactions | `PARTIALLY-SATISFIED` | No `FAILED` admin status; payment failure maps to `HEALTHY` (`transactions.ts:421-428`). |
| 4 | Pending transactions | `SATISFIED` | `PENDING_PROVIDER` queue. |
| 5 | Reconciliation mismatches | `SATISFIED` | `MISMATCH` queue. |
| 6 | Duplicate detection | `SATISFIED` | `DUPLICATE` queue. |
| 7 | Provider failures | `SATISFIED` | `PROVIDER_FAILED` queue. |
| 8 | Provider latency | `PARTIALLY-SATISFIED` | Stored on `ProviderAttempt` (`schema.prisma:191`, `transactions.ts:1963`); shown on customer detail; no admin aggregate/queue (`admin-pages.ts` has no latency). |
| 9 | Refund queue | `SATISFIED` | `REFUND_QUEUE`. |
| 10 | Reversal queue | `SATISFIED` | `REVERSAL_QUEUE`. |
| 11 | Manual-review queue | `SATISFIED` | `MANUAL_REVIEW`. |
| 12 | Unresolved transactions | `SATISFIED` | `UNRESOLVED`. |
| 13 | Transaction detail | `SATISFIED` | `/admin/transactions/:id`. |
| 14 | Evidence | `SATISFIED` | `/admin/transactions/:id/evidence`. |
| 15 | Audit trail | `SATISFIED` | Stored transaction events. |
| 16 | Provider response | `SATISFIED` | Provider facts/attempts on detail. |
| 17 | Internal determination | `SATISFIED` | ReconcileKit outcome and truth block. |

## 2.5 Demo Mode

**6 of 6 satisfied.**

Seeded demo user, wallet balance, catalog, mock providers, the required successful/failed/pending/mismatched/refunded/reversed/duplicate/gift-card/ticket cases, and visible simulated labeling all exist. The 16 scenarios are deterministic and idempotent.

Caveat: the `wallet_funding_failure` scenario is wallet-only and has no marketplace transaction page; this is explicitly annotated in `MVP_SCOPE.md:122-126`.

## 2.6 Tests

**12 of 12 required test areas have coverage in the suite.**

Required areas are covered by test files under `storefront/test/`: success, failure, timeout, pending, duplicate, mismatch, reversal, refund, evidence, timeline, provider adapter, and ReconcileKit invocation.

Important limitation: tests exercise transaction and page outcomes, but **do not assert catalog/service/checkout link targets**. This is why the broken navigation survives a green suite.

## 2.7 MVP Completion Criteria

**12 satisfied, 3 partial, 1 drifted.**

| # | Criterion | Verdict |
| ---: | --- | --- |
| 1 | App runs locally | `SATISFIED` |
| 2 | Reviewer can open without external credentials | `SATISFIED` |
| 3 | Catalog navigation works | `DRIFTED` — two broken links |
| 4 | Multiple service types purchasable | `SATISFIED` |
| 5 | Mock wallet/payment flow | `SATISFIED` |
| 6 | Mock providers respond by scenario | `SATISFIED` |
| 7 | Every transaction flows through ReconcileKit | `SATISFIED` — annotated wallet-only exception |
| 8 | Transaction states meaningful | `SATISFIED` |
| 9 | Timeline, receipt, evidence exist | `SATISFIED` |
| 10 | Refund/reversal states visible | `PARTIALLY-SATISFIED` — admin visible; customer tracker missing |
| 11 | Gift-card flow | `SATISFIED` |
| 12 | Ticketing flow | `SATISFIED` — mock checkout/issuance works; search UI absent |
| 13 | Admins can inspect and resolve problems | `PARTIALLY-SATISFIED` — payment-failure and latency gaps |
| 14 | Seed/demo works | `SATISFIED` |
| 15 | Critical reconciliation paths tested | `SATISFIED` |
| 16 | Documentation explains architecture/demo/extensions | `PARTIALLY-SATISFIED` — stale current-state sections |

## 2.8 Out Of Scope

16 bullets. Fourteen remain unimplemented or explicitly excluded. Two were overtaken by platform work:

- **Production database** — Postgres/Prisma now exists.
- **Multi-tenant enterprise platform** — organization membership and roles exist, though not enterprise-grade.

No public BillPoint parity claim was made.

---

# Part 3 — Product Architecture

## 3.1 Existing Invariants

**11 of 11 satisfied.** Exact reference matching, integer minor units, provider-neutral engine, no arbitrary duplicate pairing, separate outcomes, preserved discrepancy codes, `UNKNOWN` not a match, missing-vs-unknown distinction, configurable timestamp validation, operational failures outside reconciliation, and secret safety all remain intact.

## 3.2 Product Shape

**4 satisfied, 2 partial.**

Satisfied: catalog/checkout, mock wallet/payment, mock providers, ReconcileKit-backed truth, transaction detail with timeline/receipt/evidence/resolution.

Partial: customer catalog navigation (broken links) and internal operations dashboard (missing failed-payment and latency views).

## 3.3 End-To-End Lifecycle

**11 of 11 satisfied.** The checkout path creates the transaction, debits the wallet, calls the provider, stores facts, invokes the bridge/engine, and updates timeline, receipt, evidence, and resolution. Wallet funding is the annotated exception.

## 3.4 Catalog Architecture

**8 satisfied, 2 missing.**

Present: stable id, category id, display name, input schema, pricing, provider adapter id, fulfillment/evidence type, compliance status.

Missing from catalog records: FX transparency fields and catalog-level scenario controls. Scenarios are selected at checkout, not carried on the catalog record.

## 3.5 Payment And Wallet

**9 satisfied, 3 partial.**

Satisfied: balance, authorization/debit behavior, pending debit, successful debit, failed debit, reversal, refund initiated/pending/completed, wallet references.

Partial: funding (backend/seed only, no UI), duplicate debit (primitive supports a duplicate flag; checkout does not use it), settlement state (model/test only, no end-to-end surface).

## 3.6 Ticketing

**8 satisfied, 3 partial.**

Present: availability, passenger/customer info, pricing, checkout, reservation, confirmation, issuance, reconciliation.

Partial: search (backend only, no customer search UI), selection (form-driven, not a search/select flow), cancellation/refund (admin action only, no customer cancellation).

## 3.7 Gift Cards

**9 satisfied, 1 partial.** Category, brand, region, denomination, quantity, price, delivery, redemption/code state, and risk flags exist. Refund/dispute state is transaction-level rather than a first-class gift-card field.

## 3.8 FX Transparency

**1 partial, 0 missing at model level, missing at product level.**

`FxTransparency` contains all required fields (`types.ts:551-564`), but the type has **no producer and no consumer**. There is no catalog FX field, no quote UI, no evidence population, and no test reference outside the type definition. The model is a placeholder, not a feature.

## 3.9 Customer Experience

**10 satisfied, 7 partial.** Same surface assessment as §2.1.

## 3.10 Admin Operations

**15 satisfied, 2 partial.** Same assessment as §2.4.

## 3.11 Evidence Pack

**14 satisfied, 1 partial.** All required fields exist except populated FX quote facts. Masking of gift-card and ticket codes is implemented and tested.

## 3.12 Demo Mode

**14 satisfied, 2 partial.** All required case families are seeded except an explicit delayed-confirmation scenario; duplicate debit is the annotated provider-duplicate dedupe.

## 3.13 Extension Points

Current readiness is mixed: organizations, roles, webhooks, audit events, reconciliation APIs, and ingestion exist; API keys, billing, and SLA/health monitoring do not. These are future extension points, not MVP failures.

## 3.14 Non-Goals

Eleven of twelve still hold. “Production database” no longer holds because Postgres/Prisma is present. Production-grade authentication/authorization is still absent.

---

# Part 4 — BillPoint Parity

## 4.1 Evidence Result

- **37 of 37** conservative-matrix evidence cells are `UNKNOWN - REQUIRES RESEARCH`.
- **0** rows contain verified BillPoint evidence.
- **0** public parity claims are supported.
- The six differentiation rows are correctly labeled as MVP design positions, not comparisons.

This is a pass for evidence discipline, not a pass for parity research.

## 4.2 MVP Stance Against Code

**24 satisfied, 12 partial, 1 N/A-future.**

| Group | Rows | Result |
| --- | ---: | --- |
| Service/catalog breadth | 6 | 5 satisfied; education partial (no pins). |
| Digital goods | 2 | 2 satisfied. |
| Ticketing | 4 | 4 partial: backend search/availability/reservation/issuance, no search UI; cancellation admin-only. |
| Wallet | 5 | 3 satisfied; funding and duplicate-debit partial. |
| Payments | 6 | 4 satisfied; refund tracker and settlement states partial. |
| Transaction history/details | 2 | 2 satisfied. |
| Receipts/evidence/timeline | 4 | 4 satisfied. |
| Support/dispute | 2 | Manual review satisfied; dispute intake partial. |
| Notifications | 1 | Satisfied. |
| Account | 2 | Auth shell satisfied; profile/settings partial. |
| Admin/operations | 1 | Satisfied. |
| Provider health | 1 | Partial: failure visibility yes, latency no. |
| Compliance-gated services | 1 | N/A-future, correctly gated. |

The matrix is honest about not knowing BillPoint. It is less precise about how much of its own MVP stance is actually exposed to users.

---

# Part 5 — Contradictions

## 5.1 Part 5a — Cross-Document Contradictions

**0 unresolved direct contradictions.**

Five apparent conflicts are resolved by scope or annotation:

| Apparent conflict | Resolution |
| --- | --- |
| “No production database” vs Postgres | Current-state fact vs target-state architecture; code has moved on. |
| “No auth” vs authentication shell | Current pilot fact vs MVP target; local auth now exists, production auth does not. |
| “Every transaction flows through ReconcileKit” vs wallet funding failure | Explicit Phase 2K annotation excludes the wallet-only funding failure. |
| “Root refund lifecycle out of scope” vs app refunds | Explicit application-level vs root-domain boundary. |
| “BillPoint unknown” vs parity matrix | Evidence policy permits an MVP stance without a verified comparison. |

## 5.2 Part 5b — Document-vs-Code Contradictions

**12 material drifts.**

| # | Severity | Document claim | Actual code | Verdict |
| ---: | --- | --- | --- | --- |
| 1 | P0 | “Catalog navigation works” (`MVP_SCOPE.md:261`). | Catalog cards link to `/catalog/{serviceId}` (`client.ts:585`), but `/catalog/:id` filters categories (`server.ts:786-795`); service IDs 404. | `DRIFTED` |
| 2 | P0 | Service selection/checkout is usable (`MVP_SCOPE.md:40-41`; `PRODUCT_ARCHITECTURE.md:279-280`). | Service detail “Buy now” points to `/checkout?service=...` (`customer-pages.ts:309`), but GET checkout is only `/checkout/:serviceId` (`server.ts:809-817`); the CTA 404s. | `DRIFTED` |
| 3 | P1 | Admin “failed transactions” (`MVP_SCOPE.md:97`; `PRODUCT_ARCHITECTURE.md:311`). | Admin status set has no `FAILED`; payment failure maps to `HEALTHY` (`transactions.ts:421-428`), and the dashboard only counts nine statuses (`client.ts:829-839`). | `PARTIALLY-SATISFIED` |
| 4 | P1 | Admin provider latency (`MVP_SCOPE.md:102`; `PRODUCT_ARCHITECTURE.md:316`). | Latency is stored (`schema.prisma:191`, `transactions.ts:1963`) and shown on customer detail (`customer-pages.ts:431`), but admin pages have no latency view. | `PARTIALLY-SATISFIED` |
| 5 | P1 | Customer refund/reversal tracker (`MVP_SCOPE.md:47`; `PRODUCT_ARCHITECTURE.md:286`). | Refund/reversal records render only on admin detail (`admin-pages.ts:147-171`); customer detail exposes `resolutionStatus` but not the records. | `PARTIALLY-SATISFIED` |
| 6 | P1 | Customer dispute/support flow (`MVP_SCOPE.md:48`; `PRODUCT_ARCHITECTURE.md:287`). | No customer create-dispute form; the only form is in admin actions and targets `/dispute` singular (`admin-pages.ts:898`) while the route is `/disputes` plural (`server.ts:1063`). | `PARTIALLY-SATISFIED` |
| 7 | P1 | Wallet funding simulation (`MVP_SCOPE.md:66`; `PRODUCT_ARCHITECTURE.md:156`). | `fundWallet` and a seeded failure exist (`wallet.ts`, `seed.ts:267`), but there is no funding route, form, or catalog category. | `PARTIALLY-SATISFIED` |
| 8 | P1 | FX transparency data and UI (`PRODUCT_ARCHITECTURE.md:249-267`). | `FxTransparency` type exists (`types.ts:551-564`); no producer, catalog field, UI, or evidence use. | `MISSING` |
| 9 | P2 | Settlement mismatch scenario (`MVP_SCOPE.md:90`; `PRODUCT_ARCHITECTURE.md:189`). | Ledger state and wallet test exist (`wallet.ts:631`, `1231`; `wallet.test.ts:796`); no seeded order/demo/UI scenario. | `PARTIALLY-SATISFIED` |
| 10 | P2 | Explicit duplicate-debit scenario/evidence (`BILLPOINT_PARITY_MATRIX.md:39`; `MVP_SCOPE.md:82`). | `duplicate_debit` dedupes a provider response and does not double-debit (`demo-scenarios.test.ts:199`); true duplicate debit is unit-only via `duplicate: true` (`wallet.test.ts:765`). The MVP annotation correctly explains this, but the scenario name and parity wording overstate it. | `PARTIALLY-SATISFIED` |
| 11 | P2 | Landing/home and profile/settings (`MVP_SCOPE.md:34,50`; `PRODUCT_ARCHITECTURE.md:289`). | `/` is the dashboard; `renderHomePage` is dead code (`server.ts:765-767`). `/profile` is read-only and has no settings. | `PARTIALLY-SATISFIED` |
| 12 | P1 | Current state is JSONL/no-auth/no-webhooks (`ASSUMPTIONS_AND_GAPS.md:16,29-31,140`; `PRODUCT_ARCHITECTURE.md:120`). | Prisma/Postgres, session auth/roles, and Paystack webhooks exist. UI copy and README also still say JSONL/no auth (`customer-pages.ts:50,794`; `admin-pages.ts:50`; `storefront/README.md:27,36,128`). | `SUPERSEDED` |

## 5.3 Part 5c — Notable Non-Contradictions

These claims are accurate and should not be “fixed”:

- `duplicate_debit` deduping to one debit is deliberate and documented; the test asserts no `DUPLICATE_DEBIT` ledger entry for that scenario.
- The wallet-funding-failure `/transactions/...` 404 is explicitly documented.
- Root ReconcileKit still does not own refunds/reversals; marketplace records are separate.
- All BillPoint evidence remains unknown; the matrix does not fake parity.
- Exact-reference matching, no fuzzy matching, and no floating-point money comparison remain true.
- Demo records are visibly simulated.
- Legacy `refundStatus` really is `NONE`; marketplace refunds use separate records.
- No production authentication exists, even though local session auth does.

---

# Part 6 — Catalog And VTU Capability Matrix

This table evaluates the **catalog/VTU capability claims**, not just whether a service row exists. A service can be purchasable and still be partial if the documented flow (search, pins, funding, settlement) is absent.

**Result: 13 satisfied, 8 partial, 1 N/A-future.**

| # | Capability | Document claim | Actual implementation | Evidence | Verdict |
| ---: | --- | --- | --- | --- | --- |
| 1 | Airtime | Core VTU | MTN/Airtel/Glo/9mobile, amount, mock provider, checkout, receipt/evidence. | `catalog.ts` service schemas; `providers/mock-provider.ts` | `SATISFIED` |
| 2 | Mobile data | Core VTU | Network, recipient, plan, mock fulfillment. | `catalog.ts:148-169` | `SATISFIED` |
| 3 | Electricity | Core bill payment | Provider, meter number, meter type, amount; prepaid/postpaid. | `catalog.ts:171-188` | `SATISFIED` |
| 4 | Cable TV / Pay TV | Core bill payment | DStv/GOtv/StarTimes, subscriber, package. | `catalog.ts:190-211` | `SATISFIED` |
| 5 | Internet subscriptions | Core bill payment | Spectranet/Smile/ipNX, plan, account number. | `catalog.ts:213-233` | `SATISFIED` |
| 6 | Education payments/pins | “Where appropriate” | JAMB and WAEC payment services exist with application number/amount; no exam-pin product, pin artifact, or pin-delivery flow. | `catalog.ts` education services; no pin fields in `types.ts`/`artifacts.ts` | `PARTIALLY-SATISFIED` |
| 7 | Gift cards | First-class digital goods | Amazon gift-card service, denomination/quantity, masked code/pin, delivery state, risk flags. | `catalog.ts`; `artifacts.ts`; `providers/mock-provider.ts`; evidence masking tests | `SATISFIED` |
| 8 | Digital vouchers | Generic digital goods | `svc_voucher_digital` through the gift/digital provider adapter. | `catalog.ts` service list; demo scenario `payment_success_service_failure` | `SATISFIED` |
| 9 | Cinema tickets | Mock search, availability, reservation, issuance | Ticketing backend supports search/availability/reservation/issuance; seeded cinema checkout works; no customer search UI. | `ticketing.ts`; `demo-scenarios.ts:139-148` | `PARTIALLY-SATISFIED` |
| 10 | Event tickets | Same ticketing claim | Same ticketing backend; no event search/selection UI. | `ticketing.ts`; catalog | `PARTIALLY-SATISFIED` |
| 11 | Bus/transport tickets | Routes, passenger info, issuance | Mock route/passenger/seat checkout and issuance; no search UI; cancellation is admin-only. | `ticketing.ts`; `demo-scenarios.ts:151-162` | `PARTIALLY-SATISFIED` |
| 12 | Airline tickets | Availability and passenger flow | Mock flight/passenger checkout and pending flow; no availability search UI. | `ticketing.ts`; `demo-scenarios.ts:164-175` | `PARTIALLY-SATISFIED` |
| 13 | Wallet funding | Mock funding | `fundWallet`, funding ledger states, seeded funding failure; no customer funding route/form/category. | `wallet.ts`; `seed.ts:239-288`; `server.ts` has only GET `/wallet` | `PARTIALLY-SATISFIED` |
| 14 | Wallet balance | Simulated balance only | Derived available/pending balance from ledger. | `wallet.ts`; `/wallet` | `SATISFIED` |
| 15 | Wallet debit | Simulated ledger event | `debitWallet` posts `DEBIT_SUCCESS`; failure and pending paths exist. | `wallet.ts:817-991`; checkout path `transactions.ts:638` | `SATISFIED` |
| 16 | Pending debit | Simulated ledger state | Pending lifecycle and ledger states. | `wallet.ts`; `PaymentLifecycleState` | `SATISFIED` |
| 17 | Duplicate debit | Explicit scenario/evidence | Wallet primitive supports `duplicate: true` and two debit entries; checkout never passes it; demo `duplicate_debit` is provider-duplicate dedupe, not a double debit. | `wallet.ts:315,949-971`; `transactions.ts:638-646`; `demo-scenarios.test.ts:199` | `PARTIALLY-SATISFIED` |
| 18 | Reversal | Simulated reversal/evidence | Reversal record, ledger reference, admin action, seeded `payment_reversal`. | `resolution.ts`; `admin-pages.ts:161-171`; `demo-scenarios.ts:189-194` | `SATISFIED` |
| 19 | Refund initiated/pending/completed | Simulated workflow/tracker | Application-level refund records and admin transitions; customer tracker missing. | `resolution.ts`; `server.ts:1102-1117`; `admin-pages.ts:147-156` | `SATISFIED` |
| 20 | Settlement states | Simulated settlement/mismatch | Ledger `SETTLEMENT_MATCHED`/`SETTLEMENT_MISMATCH`, wallet test; no order/demo/UI settlement-mismatch scenario. | `wallet.ts:631,1231`; `wallet.test.ts:796` | `PARTIALLY-SATISFIED` |
| 21 | Payment authorization/confirmation/failure | Mock authorization/confirmation/failure | Wallet debit + status lifecycle + provider result + reconciliation; failed payment is visible to customer but not admin failed queue. | `transactions.ts:421-428,638`; `types.ts` lifecycle | `SATISFIED` |
| 22 | Betting/gaming | Future/compliance-gated only | `svc_betting_examplebet` exists, is excluded from checkout options, and has no provider. | `catalog.ts`; `providers/registry.ts`; checkout filter `client.ts:876-878` | `N/A-FUTURE` |

---

# Part 7 — Recommendation

## 7.1 Do Not Mark The MVP Complete Yet

The product docs define completion rigorously. The implementation meets most of that bar, but not all of it. The correct status is **`PARTIALLY-SATISFIED`**, not “done” and not “failed.”

The single completion criterion that is outright false is **catalog navigation**. The customer cannot reliably go catalog → service → checkout through the rendered UI, even though direct URLs work.

## 7.2 Priority Order

1. **P0 — Fix the purchase path.** Change catalog cards to `/services/{serviceId}`, change the service CTA to `/checkout/{serviceId}`, and add end-to-end tests that assert href targets and follow them to `200`.
2. **P1 — Make failed payments visible to admins.** Add a failed/payment-failure queue or fold payment failures into an existing failed view; do not let them count as `HEALTHY`.
3. **P1 — Add the missing admin latency surface.** Aggregate or display `ProviderAttempt.latencyMs`; do not claim admin latency until it is visible in admin.
4. **P1 — Close the customer resolution gap.** Add a customer refund/reversal tracker and a working dispute intake form; fix the `/dispute` vs `/disputes` route mismatch.
5. **P1 — Decide wallet funding and FX.** Either add real demo surfaces or mark them explicitly as backend-only/deferred. `FxTransparency` is currently dead code and should not be described as implemented.
6. **P2 — Align scenario names and docs.** Keep the honest `duplicate_debit` annotation, but rename or relabel the scenario so it does not imply a double debit. Add a settlement-mismatch demo or mark it backend-only.
7. **P1 — Sync current-state documentation.** Update `ASSUMPTIONS_AND_GAPS.md`, `PRODUCT_ARCHITECTURE.md` persistence/auth sections, `storefront/README.md`, and stale UI copy from JSONL/no-auth to Postgres/local-session-auth. Keep the production-auth limitation explicit.
8. **Re-audit after fixes.** Re-run this matrix and only then update MVP completion status.

## 7.3 What Not To Do

- Do not rewrite the docs to claim features that the UI does not expose.
- Do not add BillPoint parity claims without verified research.
- Do not “fix” the deliberate duplicate-provider-response dedupe; fix the naming and the missing true duplicate-debit surface instead.
- Do not treat passing transaction tests as proof that navigation works.

---

## Surprises

1. **The catalog-to-checkout path is broken in two places**, yet the transaction tests never assert link targets.
2. **A failed payment is counted as `HEALTHY`** in the admin model (`paymentFailureState`), so the promised “failed transactions” view does not show it.
3. **`FxTransparency` is a complete type with no producer or consumer** — a model-shaped placeholder.
4. **The customer cannot open a dispute**, and the only create-dispute form uses the wrong URL (`/dispute` vs `/disputes`).
5. **Wallet funding has a backend and a seeded failure but no customer route** — the simulation is real, the surface is not.
6. **`duplicate_debit` is intentionally not a double debit.** The docs annotate this correctly; the scenario name and parity wording are what mislead.
7. **All 37 BillPoint evidence cells remain unknown**, and no document crosses the line into a parity claim. That discipline is a strength.
8. **The UI and README still say JSONL/no auth**, even though the storefront now has Postgres and session auth.

---

## Evidence Index

| Area | Primary evidence |
| --- | --- |
| Routes and auth gate | `storefront/src/server.ts:190,717-759,765-817,1040-1063,1102-1117` |
| Auth | `storefront/src/auth/{cookies,identity,middleware,passwords,sessions}.ts` |
| Persistence | `storefront/prisma/schema.prisma`; `storefront/src/db/repositories/index.ts` |
| Catalog | `storefront/src/marketplace/catalog.ts` |
| Types/statuses | `storefront/src/marketplace/types.ts` (`AdminTransactionStatus`, `FxTransparency`) |
| Providers | `storefront/src/marketplace/providers/{registry,mock-provider,payment-provider,contracts}.ts` |
| Transactions | `storefront/src/marketplace/transactions.ts` |
| Wallet | `storefront/src/marketplace/wallet.ts` |
| Ticketing | `storefront/src/marketplace/ticketing.ts` |
| Resolution | `storefront/src/marketplace/resolution.ts` |
| Evidence/masking | `storefront/src/marketplace/evidence.ts`; `artifacts.ts` |
| Receipts | `storefront/src/marketplace/receipts.ts` |
| Notifications | `storefront/src/marketplace/notifications.ts` |
| Demo seed/scenarios | `storefront/src/marketplace/{seed,demo-scenarios}.ts` |
| Customer UI | `storefront/src/ui/customer-pages.ts`, `client.ts` |
| Admin UI | `storefront/src/ui/admin-pages.ts`, `client.ts` |
| Tests | `storefront/test/marketplace/{wallet,demo-scenarios,frontend-walkthrough,server-marketplace}.test.ts` |
| Webhook | `storefront/src/application/paystack-webhook.ts`; `storefront/src/marketplace/payment-sources/*` |
| Phase closure | `docs/5b1e-closure.md`, `docs/5c-closure.md` |

## Audit Verification

- Only this file was created.
- No source, test, schema, Prisma, or target document was modified.
- The audit target files remain unchanged at HEAD `1e6778a`.
