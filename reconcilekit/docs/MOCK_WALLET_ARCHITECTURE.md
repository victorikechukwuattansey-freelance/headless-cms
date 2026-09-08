# Mock Wallet Architecture (Phase 2C)

Provider-neutral mock wallet and payment simulation layer for the ReconcileKit marketplace
demo. Built to exercise wallet operations, a payment lifecycle, and a deterministic
reconcile-ready audit trail against the `PaymentProvider` abstraction from
[Phase 2B](./MOCK_PROVIDER_ARCHITECTURE.md).

Scope: demo / simulation layer only. It is **not** wired into the live transaction flow
(that is Phase 2F ReconcileKit integration) and it never touches the real ledger.

---

## 1. Wallet Model

A `MarketplaceWallet` (see `types.ts`) is a per-customer, single-currency balance held in
minor units. Its identity is derived deterministically from the customer
(`wl_<customerId>`).

```
MarketplaceWallet {
  id            "wl_cus_demo"
  customerId    "cus_demo"
  currency      "NGN"
  status        ACTIVE
  simulated     true
  meta          { source: "mock-wallet" }
}
```

The wallet **does not store a mutable balance.** There is no `balance` field on the
wallet record. The available / pending / total balance is always **derived** from the
ledger by `deriveWalletBalance` (see §2). The test suite asserts that no persisted wallet
record carries a `balance` field, enforcing that the ledger — not a stored number — is the
source of truth.

## 2. Ledger Model

The wallet's money movements are recorded on an **immutable, append-only event stream**
(a `wallet_ledger` record per event). Every change is a `WalletLedgerEntry`:

```
WalletLedgerEntry {
  id            ledger_<token>            // stable, content-derived
  walletId      "wl_cus_demo"
  reference     entry_<token>             // stable, content-derived
  transactionId txn_<id> | fund_<...>     // idempotency-related correlation
  type          WalletLedgerType          // credit / debit / lifecycle marker
  status        POSTED | PENDING | REJECTED | FAILED
  amountMinor   number                    // signed per type rules
  currency      "NGN"
  timestamp     ISO string                // deterministic
  details       metadata / provider facts
}
```

### 2.1 Decision: append-only event stream, not full double-entry

The ledger is an **immutable append-only event stream**, not a full double-entry general
ledger. Justification (cross-referenced to the Phase 2 plan section J and the existing
`WalletLedgerEntry` shape):

- The existing `WalletLedgerEntry` is a single-account event shape, not a
  debit/credit-account pair.
- The plan specifies "append-only event stream" and "derive balance as a pure function,"
  with **type-based balance rules** — exactly what the ledger implements.
- Every event carries a stable content-derived `reference`, which gives the idempotency
  and duplicate-detection the double-entry structure provides, without the pairing
  machinery.
- Scope is the demo marketplace, not production accounting. Double-entry would be the
  right call for a real ledger (noted as a known limitation in §8).

The practical consequence: **balance integrity is enforced by ledger-consistency rules**
(`checkLedgerConsistency`), which reject foreign-wallet entries, negative available
balance, and reference collisions — instead of by a stored running balance.

### 2.2 Type-based balance rules

`deriveWalletBalance` classifies each ledger type into three buckets:

| Type                                                                                                                                                                                      | Available | Pending | Notes                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- | ------------------------------------------------------ |
| `OPENING_BALANCE`                                                                                                                                                                         | +         | —       | initial credit                                         |
| `FUNDING_SUCCESS`                                                                                                                                                                         | +         | —       | credit; also detaches any pending funding              |
| `REFUND_COMPLETED`                                                                                                                                                                        | +         | —       | credit; also detaches pending refund                   |
| `REVERSAL_COMPLETED`                                                                                                                                                                      | +         | —       | credit; reverses prior debit                           |
| `DEBIT_SUCCESS`                                                                                                                                                                           | −         | —       | debit; also detaches any pending hold                  |
| `DUPLICATE_DEBIT`                                                                                                                                                                         | −         | —       | debit flagged duplicate; still reduces available       |
| `DEBIT_PENDING`                                                                                                                                                                           | —         | +       | pending hold only                                      |
| `SETTLEMENT_PENDING`                                                                                                                                                                      | —         | ±       | pending settlement only                                |
| `REFUND_PENDING`                                                                                                                                                                          | —         | ±       | pending refund only                                    |
| `FUNDING_INITIATED` / `FUNDING_FAILED`                                                                                                                                                    | —         | —       | no balance change                                      |
| `DEBIT_FAILED` / `AUTHORIZATION_REQUESTED` / `AUTHORIZATION_APPROVED` / `AUTHORIZATION_FAILED` / `REVERSAL_INITIATED` / `REFUND_INITIATED` / `SETTLEMENT_MATCHED` / `SETTLEMENT_MISMATCH` | —         | —       | failed/in-flight lifecycle markers do not move balance |

Failed, authorization-failed, and other non-credit/non-debit markers never change either
bucket — exactly the plan's rule that "failed/auth-failed types don't change balance."

**Plan worked example** (mirrored in the test suite): opening `500000`,
`−100000` (debit), `+25000` (refund), `+50000` (reversal) ⇒ **475000 available**.

## 3. Payment Lifecycle

This is the user-facing payment state, **distinct from** provider status and fulfillment
status. They must stay separable — e.g. Payment `SETTLED` / Provider `FAILED` /
Fulfillment `FAILED` is a real, representable combination in the demo.

### 3.1 States

`INITIATED → PENDING → AUTHORIZED → SETTLED` (happy path), with `FAILED`, `REVERSED`,
`REFUND_PENDING`, `REFUNDED` as branch/terminal states.

### 3.2 Transition map

`PAYMENT_LIFECYCLE_EDGES` is a **strict partial map**: a transition that is not declared
throws `InvalidPaymentTransitionError`. This makes the state machine explicit and
incorrect transitions impossible-by-construction rather than silently self-looping.

| From             | Allowed events (→ to)                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `INITIATED`      | AUTHORIZATION_REQUESTED→PENDING, AUTHORIZATION_FAILED→FAILED, REFUND_INITIATED→REFUND_PENDING                                               |
| `PENDING`        | AUTHORIZATION_APPROVED→AUTHORIZED, AUTHORIZATION_FAILED→FAILED, DEBIT_SUCCESS→SETTLED, DEBIT_FAILED→FAILED, REFUND_INITIATED→REFUND_PENDING |
| `AUTHORIZED`     | DEBIT_PENDING→PENDING, DEBIT_SUCCESS→SETTLED, DEBIT_FAILED→FAILED, REVERSAL_INITIATED→REVERSED, REFUND_INITIATED→REFUND_PENDING             |
| `SETTLED`        | REVERSAL_INITIATED→REVERSED, REFUND_INITIATED→REFUND_PENDING                                                                                |
| `FAILED`         | REFUND_INITIATED→REFUND_PENDING                                                                                                             |
| `REVERSED`       | (terminal)                                                                                                                                  |
| `REFUND_PENDING` | REFUND_COMPLETED→REFUNDED                                                                                                                   |
| `REFUNDED`       | (terminal)                                                                                                                                  |

### 3.3 Canonical mapping

`paymentLifecycleToCanonical` maps a payment lifecycle state to the canonical
ReconcileKit payment status without leaking provider status. This preserves the Phase 2F
boundary: payment state and provider status are correlated on `WalletPaymentEvidence`
but never merged into one field.

## 4. Status Separation

Three independent status axes are kept apart across the whole module:

1. **Payment lifecycle** — §3 (`INITIATED`…`REFUNDED`).
2. **Provider status** — the `PaymentProviderResult` fields from Phase 2B
   (`providerStatus`, `canonicalPaymentStatus`, `attemptStatus`).
3. **Fulfillment / settlement** — derived/pass-through facts recorded on evidence.

The tests exercise these explicitly, e.g. a debit that the service later reports failed
still produces a Payment `SETTLED` (money moved) on a distinct fulfillment-failed record.

## 5. Infrastructure Layout

- `src/marketplace/wallet.ts` — pure functions (`deriveWalletBalance`,
  `checkLedgerConsistency`, `advancePaymentLifecycle`, `paymentLifecycleToCanonical`,
  `createLedgerEntry`, `buildProviderRequestContext`, `toWalletPaymentRecord`,
  `WalletPaymentEvidence`) and store-backed ops (`createWallet`, `getWallet`,
  `getWalletBalance`, `fundWallet`, `authorizeDebit`, `debitWallet`, `reverseDebit`,
  `initiateRefund`, `completeRefund`, `settlePayment`).
- `src/marketplace/providers/payment-provider.ts` — **re-exports** `MockPaymentProvider`
  (Phase 2B) and adds the interface-only facade `runWalletFunding` +
  `classifyWalletFunding` (`WalletFundingDecision`). No second abstraction.
- `src/marketplace/types.ts` — added the 8-state `PaymentLifecycleState` union.
- `src/store/jsonl-store.ts` — reuses existing `wallets` + `wallet_ledger` store kinds
  (append / latest-wins semantics preserved; Paystack pilot data untouched).

### 5.1 Interface dependency (not concrete classes)

The wallet layer depends on `PaymentProvider` (the registry/facade), never on the
concrete `MockPaymentProvider` class. The test suite injects a **fake** `PaymentProvider`
into `fundWallet` to prove this boundary — funding succeeds through any provider that
satisfies the interface. `createMockProviderRegistry().payment` (Phase 2B) remains the
wired adapter used by live demo scenarios.

## 6. Persistence

- `createWallet` appends the wallet + a `OPENING_BALANCE` ledger entry.
- Every funding / debit / reversal / refund operation appends one or more ledger entries.
- Balance is never a stored field; it is recomputed from `wallet_ledger` by
  `getWallet`/`getWalletBalance` each read.
- Dialing `wallet_ledger` re-reads the full stream (`readAll`), consistent with the
  existing JSONL latest-wins store. The store's `wallets`/`wallet_ledger` kinds already
  existed and are reused; no store kind was added.

## 7. Determinism

All operations default `now` to `WALLET_FIXED_TIMESTAMP = "2026-01-01T12:00:00.000Z"`
and derive stable content-based `id`/`reference`/`transactionId` tokens, so identical
inputs produce byte-identical ledger entries. Funding classification
(`classifyWalletFunding`) is a pure function of the provider result, and the mock
provider itself is deterministic. The test suite verifies:

- funding determinism (same input → identical ledger),
- provider determinism (same context+request → deep-equal result),
- classification determinism across scenarios.

## 8. Known Limitations

- **No double-entry accounting** — a deliberate MVP choice (§2.1); produces
  single-account event streams, suitable for demo/reconciliation exercises, not a
  production general ledger.
- **No stored balance guarantee** — integrity relies on `checkLedgerConsistency`, not a
  stored total; a real wallet would reconcile against a stored control total.
- **Single currency per wallet; no multi-wallet transfers.**
- **Fake currency leg** — amounts in minor units, no exchange.

## 9. Future: ReconcileKit Integration Boundary (Phase 2F)

Phase 2F will wire the ledger into ReconcileKit. To keep that clean, every operation
already emits `WalletPaymentEvidence` carrying every mapping field Phase 2F needs
(transaction reference, provider reference, provider status, canonical status, payment
lifecycle state, correlation ids, amounts, timestamps). The evidence is produced now so
the Phase 2F mapper has a stable, typed input. The live engine and Paystack
`PaymentRecord` are **not modified** as part of this phase.
