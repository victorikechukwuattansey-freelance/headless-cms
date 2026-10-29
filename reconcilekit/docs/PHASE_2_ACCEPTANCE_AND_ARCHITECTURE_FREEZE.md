# RECONCILE KIT — PHASE 2 ACCEPTANCE & ARCHITECTURE FREEZE

**Status:** ACCEPTED AND FROZEN
**Date:** 2026-09-08
**Scope:** Phase 2 (Marketplace Proof-of-Prototype) baseline for Phase 3
**Document type:** Architecture baseline / freeze contract

---

## 1. Purpose

This document converts the completed Phase 2 implementation and its audit into an
authoritative architectural baseline for Phase 3. It records:

1. What Phase 2 actually delivered.
2. Which architectural decisions are now **frozen**.
3. Which invariants Phase 3 must preserve.
4. Which limitations are intentionally deferred.
5. Which files/modules are protected.
6. The exact Phase 2 validation baseline.
7. The conditions that must be satisfied before Phase 3 implementation begins.

This is a **freeze contract**, not a roadmap. Phase 3 may extend the system but
must not silently redefine the Phase 2 contracts. Any future change to a frozen
decision requires an explicit architecture-change decision (see §14), never an
incidental implementation change.

---

## 2. Accepted Phase 2 Scope

Phase 2 is accepted as **COMPLETE WITH NON-BLOCKING GAPS**. It is a
marketplace proof-of-prototype built on top of the frozen Reconcile Kit core.
It is **not** production-ready, and must not be described as such.

**In scope (implemented and accepted):**

- Marketplace domain types and semantics.
- Mock provider ecosystem (contracts, registry, deterministic scenarios).
- Internal wallet lifecycle + append-only ledger.
- Catalog / seed / demo scenarios (16 canonical scenarios).
- Single transaction orchestration (one `executeMarketplaceTransaction` boundary).
- Reconcile bridge into the frozen `reconcileRecords()` engine.
- Transaction truth projection (payment / ledger / fulfillment separation).
- Evidence packs, receipts, resolution, notifications, timeline.
- Ticketing (reservation ≠ issuance) and gift-card artifacts (masked presentation).
- HTTP server + UI pages.
- Payment Source Layer (normalization boundary, exact-once ingestion).
- Terminology / semantic correction (identifier hierarchy enforced in code).
- Wallet evidence integration (end-to-end wallet lifecycle through the engine).

**Explicitly out of scope for Phase 2 (deferred, not reopened):**

- Production persistence, authentication, CSRF, deployment, billing, multi-tenancy.
- New payment providers beyond the typed/deferred set.
- Currency conversion (FX) engine.
- Operational betting flow.

---

## 3. Actual Implemented Components

| Component                                                   | Implementation location                                                                                            | Documentation                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Marketplace domain types                                    | `storefront/src/marketplace/types.ts`                                                                              | `docs/MARKETPLACE_CATALOG_ARCHITECTURE.md`                              |
| Provider contracts / mock registry                          | `storefront/src/marketplace/providers/contracts.ts`, `mock-provider.ts`, `registry.ts`                             | `docs/MOCK_PROVIDER_ARCHITECTURE.md`                                    |
| Wallet lifecycle / ledger                                   | `storefront/src/marketplace/wallet.ts`                                                                             | `docs/MOCK_WALLET_ARCHITECTURE.md`                                      |
| Catalog / seed / demo scenarios                             | `storefront/src/marketplace/catalog.ts`, `seed.ts`, `demo-scenarios.ts`                                            | `docs/MARKETPLACE_CATALOG_ARCHITECTURE.md`                              |
| Transaction orchestration                                   | `storefront/src/marketplace/transactions.ts` (`executeMarketplaceTransaction`)                                     | `docs/TRANSACTION_ORCHESTRATION.md`                                     |
| Reconciliation bridge                                       | `storefront/src/marketplace/reconcile-bridge.ts`, `reconcile.ts`                                                   | `docs/RECONCILE_KIT_INTEGRATION_DESIGN.md`                              |
| Transaction truth                                           | `storefront/src/marketplace/truth.ts`                                                                              | `docs/RECONCILE_KIT_INTEGRATION_DESIGN.md`                              |
| Evidence / receipts / resolution / notifications / timeline | `evidence.ts`, `receipts.ts`, `resolution.ts`, `notifications.ts`, `timeline.ts`                                   | `docs/RECONCILE_KIT_INTEGRATION_DESIGN.md`                              |
| Ticketing / gift-card artifacts                             | `ticketing.ts`, `artifacts.ts`                                                                                     | `docs/BILLPOINT_PARITY_MATRIX.md`                                       |
| HTTP server / UI                                            | `storefront/src/server.ts`, `storefront/src/ui/*`, `storefront/src/main.ts`                                        | `docs/PHASE_2I_IMPLEMENTATION_REPORT.md`                                |
| Payment Source Layer                                        | `storefront/src/marketplace/payment-sources/{types,ingest,to-reconcilekit,wallet-ingest}.ts`, `adapters/wallet.ts` | `RECONCILE-KIT-PAYMENT-SOURCE-LAYER-ADDENDUM.md` (§4, §5, §7, §11, §23) |
| Wallet evidence integration                                 | `payment-sources/wallet-ingest.ts`, `payment-sources/adapters/wallet.ts`, `payment-provider.ts`                    | `RECONCILE-KIT-PAYMENT-SOURCE-LAYER-ADDENDUM.md` (§23)                  |
| End-to-end wallet lifecycle                                 | `storefront/test/marketplace/wallet-lifecycle.test.ts` (12 tests)                                                  | `docs/PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md`                        |

**Implementation reports:** `docs/PHASE_2I_IMPLEMENTATION_REPORT.md`,
`docs/PHASE_2J_IMPLEMENTATION_REPORT.md`,
`docs/PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md`.
**Plan (historical reference):** `docs/PHASE_2_IMPLEMENTATION_PLAN.md`.

---

## 4. Frozen Architectural Decisions

### 4.1 Reconcile Kit boundary

Reconcile Kit remains **provider-neutral transaction truth infrastructure**. It
is not a PSP, payment processor, wallet custodian, fulfillment engine, FX
engine, or betting/gaming engine.

### 4.2 Three separate truths

```text
Payment truth
Ledger truth
Fulfillment truth
```

must always remain independently representable and must **never** collapse into
a single generic status. Example — this must NOT collapse into `SUCCESS`:

```text
Payment     = SUCCESS
Ledger      = DEBITED
Fulfillment = FAILED
```

### 4.3 Single reconciliation engine

There is exactly one reconciliation matcher: **`reconcileRecords()`** in
`src/application/reconcile-records.ts` (frozen core). No Phase 3 implementation
may introduce:

- a second matcher;
- a wallet-specific matcher;
- a provider-specific matcher;
- fuzzy matching;
- probabilistic matching;
- amount-only correlation;
- timestamp-only correlation;
- customer-data correlation.

### 4.4 Exact-reference matching

The reconciliation model is deterministic and exact. The marketplace canonical
join anchor is `mk_txn_…`. No alternate/fuzzy identity may silently become a
matching key.

### 4.5 Wallet boundary

> Wallet ledger is authoritative for wallet movement and balance derivation.

Wallet balance is derived from the append-only ledger; it is never a stored
mutable balance. Reconciliation **consumes** wallet evidence and never:

- mutates wallet balance;
- appends wallet ledger entries;
- reverses wallet debits;
- initiates refunds;
- creates wallet compensation;
- becomes wallet truth.

### 4.6 Fulfillment boundary

Provider fulfillment remains outside reconciliation. Reconciliation never calls
providers, reserves/issues tickets, issues gift cards, fulfills services, or
creates provider attempts. Fulfillment truth is consumed/presented separately.

### 4.7 Gift-card secret handling

Sensitive gift-card codes/secrets must not be exposed through customer/admin
HTTP responses and must not be persisted as ordinary transaction data. Only
masked/preview representations cross presentation boundaries (`maskProviderFacts`
in `evidence.ts`, `maskedCodePreview`/`maskedCode` in `types.ts` and
`artifacts.ts`).

### 4.8 Ticket lifecycle

```text
reservation ≠ issuance
```

A pending ticket transaction may hold a reservation without an issued ticket.
Timeout/failure must never fabricate issuance. Cancellation/invalidation must
not silently introduce wallet money movement.

### 4.9 Betting boundary

```text
BETTING = FUTURE_COMPLIANCE_GATED
```

Betting must not silently become an operational payment/fulfillment flow. The
registry refuses betting providers; checkout gates it.

### 4.10 Transaction orchestration

The marketplace transaction lifecycle has a single orchestration boundary:
`executeMarketplaceTransaction()` in `transactions.ts`. No parallel transaction
state machines. Phase 3 extensions must compose with this boundary, not bypass it.

### 4.11 Idempotency

Deterministic, exact-once ingestion semantics are frozen. Payment-event identity
derives from the established source/event identity mechanism (`payment_source |
payment_source_reference | event_type | source_event_id`), producing
`pevt_${stableToken(key)}`. Repeated ingestion never creates duplicate logical
`PaymentEvent`s and never triggers a second reconcile side effect. Phase 3 may
improve infrastructure durability but must preserve the semantic guarantee.

### 4.12 Opening balance

`OPENING_BALANCE` is wallet initialization/state evidence, **not** a normal
customer payment event. It must not automatically become a reconciliation
payment event. (`walletLedgerToPaymentEvent` returns `null` for it.)

### 4.13 Payment Source Layer boundary

The Payment Source Layer is the normalization boundary (source identity,
normalization, provenance, idempotent ingestion, source-specific evidence
preservation). It does **not** become a second reconciliation engine.

---

## 5. Identifier Hierarchy (frozen)

```text
transaction_id                = mk_txn_…          (marketplace canonical join anchor)
merchant_reference            = reconciliation merchant-side matching key
ProviderPayment.reference     = reconciliation engine provider-side JOIN REFERENCE
```

For the marketplace canonical projection:

```text
ProviderPayment.reference     = mk_txn_…
```

Source evidence remains separate:

```text
payment_source_reference      = ps_… | wld_… | bank reference | CSV source reference
```

Provider evidence remains separate:

```text
provider_reference            = air_… | res_… | iss_…
```

Wallet ledger evidence remains separate:

```text
wallet_ledger_reference       = wld_…
```

Marketplace display reference remains separate and is **not** an engine
matching key:

```text
MarketplaceTransaction.reference = txn_…
```

**Invariant:** `mk_txn_…` is the join surface; `wld_…`/`ps_…`/provider refs are
evidence only; nothing is fabricated when absent. (`reconcile-bridge.ts`,
`payment-sources/to-reconcilekit.ts`, `payment-sources/adapters/wallet.ts`.)

---

## 6. Payment / Ledger / Fulfillment Truth Separation

Frozen semantics (enforced by `truth.ts` and `types.ts`):

- `MarketplaceTransaction.paymentStatus` — payment truth (canonical).
- `MarketplaceTransaction.reconcileOutcome` — engine outcome (`Outcome`).
- `MarketplaceTransaction.fulfillmentStatus` — fulfillment truth.
- `MarketplaceTransaction.resolutionStatus` — resolution/admin truth.
- Wallet ledger status — ledger truth (wallet-owned, reconciliation read-only).

Test asserts separation explicitly:
`wallet lifecycle: a failed fulfillment keeps payment/ledger truth separate from
fulfillment truth` (`wallet-lifecycle.test.ts`).

**Evidence pack regeneration on callback (§14 reopening, 5D.5c, 2026-10-28).**
Prior invariant: evidence packs were write-once — `reconcileMarketplaceTransaction`
returned the existing pack unchanged on replay, and the transaction table was the
only mutable record. This protected the "what happened at execute time" audit trail.

New invariant: evidence packs remain immutable on the execute path. The replay
gate accepts `forceRegenerate: true` from the VTPass callback handler
(`application/vtpass-webhook.ts`) only. When set, the pack is regenerated in
place via the existing `evidencePacks.insert()` upsert, preserving pack id and
`transactionId`. The regeneration is recorded as a `ProviderResponseReceived`
transaction event so audit can reconstruct the pack's history from the event log.

Rationale: VTPass delivers fulfillment status asynchronously via callback after
the initial `execute()` returns pending. Without regeneration, a `delivered`
callback would leave the evidence pack stuck on the "pending" snapshot — the
audit record would diverge from the transaction's true terminal state. The
alternative (evidence-only recording with no regeneration) was rejected because
it leaves the pack as stale evidence rather than a live reconcile source.

Scope of reopening: `storefront/src/marketplace/reconcile.ts` (frozen, §9) —
one conditional (`if (existingPack !== null)` → `if (existingPack !== null &&
input.forceRegenerate !== true)`) plus one optional interface field. No schema
change (upsert already existed). No change to `wallet.ts`, `types.ts`, or any
other §9 file.

Enforcement: the flag is not exposed on the execute path (only the callback
handler passes it). A future contributor adding `forceRegenerate: true` to any
other call site would need to justify it against this §6 amendment.

---

## 7. Wallet / Reconciliation Boundary

**Owned by the wallet subsystem:** wallet balance derivation, ledger append,
debit/credit/reversal/refund lifecycle, funding decisions
(`classifyWalletFunding`, `runWalletFunding`).

**Owned by reconciliation:** consuming normalized wallet evidence
(`PaymentEvent`), projecting into Reconcile Kit input, running the single
engine, producing truth.

**Never crossed:** reconciliation does not mutate the ledger or wallet, does not
reverse debits, does not initiate refunds, does not create compensation, and
does not emit provider attempts.

---

## 8. Payment Source Layer Boundary

The layer owns normalization and exact-once ingestion of source payment events,
with source identity required for every event (`assertSourceIdentity` — events
with no source reference or source event id are rejected, never fabricated or
collapsed). It projects into the same frozen engine as the bridge.

**Current source implementation status (must remain accurately documented):**

| Status                   | Sources                                                    |
| ------------------------ | ---------------------------------------------------------- |
| Operational / integrated | `INTERNAL_WALLET`, Paystack path                           |
| Structural / deferred    | `BANK_TRANSFER`, `MANUAL_CSV`, `FLUTTERWAVE`, `FUTURE_PSP` |

Deferred sources are typed/structurally represented but **not fully ingested**.
They must not be described as completed integrations.

---

## 9. Protected Core Boundary

The following are **protected**. Any Phase 3 task must explicitly identify any
proposed change crossing this boundary:

```text
reconcilekit/src/**

PaymentRecord
```

Protected semantic behavior:

- core matcher (`reconcileRecords`);
- reference normalization;
- validation semantics;
- legacy Paystack reconciliation path.

Verified: `reconcilekit/src/**` contains **no** `wallet|marketplace|mk_txn|wld_`
references — the core remains provider-neutral and semantically unchanged.

---

## 10. Non-Blocking Limitations

1. **Tenant isolation** — customer-level identity only; no production
   tenant/org model. Do not claim production multi-tenancy.
2. **UI interactivity** — some console views remain static htmx shells with
   limited interactivity (future UI iteration).
3. **Deferred payment sources** — `BANK_TRANSFER`, `MANUAL_CSV`, `FLUTTERWAVE`,
   `FUTURE_PSP` not fully ingested.
4. **Betting** — remains `FUTURE_COMPLIANCE_GATED`; not operational.
5. **Currency conversion** — no FX engine; catalog currency namespaces
   (NGN/USD/GBP) are explicit.
6. **Prototype determinism assumptions** — determinism relies in part on
   `WALLET_FIXED_TIMESTAMP` and exact-once/idempotency mechanisms; this is not
   production-grade durable infrastructure.
7. **Production infrastructure** — no production authentication, CSRF
   protection, durable database architecture, webhooks, provider integrations,
   or deployment readiness.

---

## 11. Phase 2 Validation Baseline (frozen)

```text
Storefront tests:  388/388 passing
Root tests:        601/601 passing
Storefront typecheck: PASS
Root typecheck:       PASS
ESLint:               PASS
Prettier:             PASS
```

Re-verified 2026-09-08 as part of this freeze. Any deviation from this baseline
must be reported before further documentation or implementation proceeds.

---

## 12. Deferred Work (Separated from Phase 3 Scope)

Deferred capabilities (explicitly outside Phase 3 unless separately approved):

- Tenant/org isolation model.
- Full ingestion of `BANK_TRANSFER`, `MANUAL_CSV`, `FLUTTERWAVE`, `FUTURE_PSP`.
- Operational betting flow and compliance gating.
- FX / currency conversion engine.
- Production persistence, authentication, CSRF, webhooks, deployment, billing.
- UI interactivity upgrade (replacing static htmx shells where flagged).
- Replacement of `WALLET_FIXED_TIMESTAMP` with production clock handling.

---

## 13. Phase 3 Entry Criteria

Phase 3 may begin only if **all** of the following hold:

1. Phase 2 freeze document exists (this document).
2. Phase 2 baseline is recorded (§11).
3. No unresolved blocking architectural contradiction exists.
4. Identifier semantics remain frozen (§5).
5. Single-matcher architecture remains intact (§4.3).
6. Wallet/reconciliation boundary remains intact (§7).
7. Deferred work is explicitly separated from Phase 3 scope (§12).
8. The Phase 3 task has a defined acceptance gate.
9. Phase 3 implementation will not silently modify protected core behavior (§9).

---

## 14. Architecture-Change Procedure

If Phase 3 discovers that a frozen Phase 2 decision must change:

1. **STOP** implementation.
2. Document the conflict.
3. Identify the affected invariant(s).
4. Explain why the existing architecture is insufficient.
5. Propose the smallest architectural change.
6. Identify affected tests and contracts.
7. Obtain explicit approval.
8. Only then implement the change.

Implementation pressure must never silently reopen frozen decisions.

---

## References

- Root architecture: `ARCHITECTURE.md`, `CANONICAL-DOMAIN-MODEL-v0.3.md`, `PHASE_2_IMPLEMENTATION_PLAN.md`
- Payment Source Layer: `RECONCILE-KIT-PAYMENT-SOURCE-LAYER-ADDENDUM.md` (§1–§23)
- Implementation reports: `docs/PHASE_2I_IMPLEMENTATION_REPORT.md`, `docs/PHASE_2J_IMPLEMENTATION_REPORT.md`, `docs/PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md`
- Phase 2 audit: prior session audit report (conclusion: `CLEARED FOR NEXT PHASE`)
