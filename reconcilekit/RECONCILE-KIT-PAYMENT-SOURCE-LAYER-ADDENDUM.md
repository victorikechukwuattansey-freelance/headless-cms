# RECONCILE KIT --- PAYMENT SOURCE LAYER ADDENDUM

**Status:** Implemented — see storefront/src/marketplace/payment-sources/ and docs/PHASE_3B_ACCEPTANCE_REPORT.md
**Purpose:** Extend the existing Reconcile Kit architecture from a
Paystack-first MVP boundary to a provider-neutral payment-source
boundary without rewriting the canonical reconciliation engine.

---

## 1. Purpose

This addendum attaches to the existing Reconcile Kit canonical model. It
does not replace it.

The existing canonical model is a deterministic payment-reconciliation
engine. Its first provider adapter is Paystack, but the core domain
already establishes that provider-specific behavior belongs at the
adapter boundary and that the core operates on normalized
provider-neutral concepts.

The gap is therefore not that Reconcile Kit needs a new reconciliation
algorithm. The gap is that the host application needs a provider-neutral
**payment source layer** capable of feeding the existing reconciliation
boundary regardless of whether payment came through Paystack, a bank
transfer, an internal wallet, another PSP, or manual ingestion.

The intended relationship is:

```text
HOST APP
  ↓
TRANSACTION / SERVICE LAYER
  ↓
PAYMENT SOURCE LAYER
  ↓
NORMALIZED PAYMENT EVIDENCE
  ↓
RECONCILE KIT PAYMENT RECONCILIATION
  ↓
TRANSACTION TRUTH / EVIDENCE / RESOLUTION
```

The host application remains responsible for customer intent, service
orchestration, wallet operations, and fulfillment orchestration.
Reconcile Kit remains responsible for deterministic reconciliation of
normalized evidence.

---

## 2. Problem Discovered

The existing MVP's implemented payment path is too tightly coupled to
Paystack.

The canonical domain specification explicitly describes the MVP as
reconciling merchant payment records against Paystack transaction
records and identifies Paystack as the first provider adapter. That is
valid for the original MVP, but it is too narrow for the marketplace
host application.

The host application can receive payment through:

- Paystack card
- Paystack bank transfer
- direct bank transfer
- internal wallet balance
- Flutterwave
- manual/CSV transaction ingestion
- future PSPs and payment rails

The reconciliation thesis must therefore not depend on Paystack
verification.

The important distinction is:

> **Paystack is a payment source. It is not Reconcile Kit's source of
> truth.**

The source-neutral model must correlate payment evidence to one stable
internal transaction anchor.

---

## 3. Preserved Canonical Decisions

This patch preserves the following existing decisions:

1.  Reconciliation is deterministic.
2.  Exact reference matching remains the MVP matching strategy.
3.  Fuzzy/probabilistic matching is not introduced.
4.  Duplicate candidates are never arbitrarily paired.
5.  Monetary values use integer minor units and explicit currency.
6.  Provider-specific behavior stays outside the core engine.
7.  Missing information remains distinct from conflicting information.
8.  Unknown status remains distinct from missing status.
9.  Input errors remain distinct from reconciliation discrepancies.
10. Multiple discrepancy codes remain preservable.
11. Timestamp validation is not a hidden matching key.
12. Reconciliation results remain explainable from source records,
    preserved attributes, and configuration.
13. Paystack-specific fields remain inside the Paystack adapter.
14. The existing Reconcile Kit core does not become a PSP, wallet
    custodian, bank, or payment processor.

The canonical model explicitly requires the core to operate on
normalized domain objects and places Paystack-specific translation at
the adapter boundary. This patch extends that boundary; it does not move
provider logic into the core. fileciteturn2file0L13-L19
fileciteturn2file0L50-L56

---

# 4. Payment Source Layer

## 4.1 Payment Source

A **Payment Source** is the external or internal system from which
payment evidence originates.

Examples:

```text
PAYSTACK
BANK_TRANSFER
INTERNAL_WALLET
FLUTTERWAVE
MANUAL_CSV
FUTURE_PSP
```

A payment source is not itself the transaction.

It identifies where a payment event was observed.

---

## 4.2 Payment Source Adapter

A **Payment Source Adapter** translates source-specific records into the
provider-neutral payment representation required by Reconcile Kit.

Conceptually:

```text
raw source record
      ↓
source adapter
      ↓
normalized payment evidence
      ↓
Reconcile Kit
```

Examples:

```text
Paystack API response
    → Paystack adapter
    → normalized payment

Bank statement CSV
    → Bank/CSV adapter
    → normalized payment

Wallet ledger event
    → Wallet adapter
    → normalized payment
```

The adapter may preserve source-specific fields in source
attributes/metadata, but source-specific business logic must not enter
the core engine.

This directly extends the existing normalization boundary:

```text
Provider-specific raw record
    → provider adapter
    → normalized provider payment
```

The existing canonical model already establishes this separation.
fileciteturn2file0L50-L56

---

## 4.3 Payment Event

A normalized payment event represents an observed payment fact.

Minimum conceptual fields:

```text
event_id
transaction_id
merchant_reference
payment_source
payment_source_reference
amount
currency
status
occurred_at
observed_at
metadata
source_confidence
idempotency_key
```

Not every source must provide every field.

The normalized model must distinguish:

- supplied value;
- missing value;
- unknown/unmapped value;
- derived internal value.

Missing information must not be silently converted into a positive fact.

---

## 4.4 Source Confidence

`source_confidence` describes the evidentiary quality of the source
observation.

Initial conceptual values:

```text
CONFIRMED
OBSERVED
IMPORTED
MANUAL
UNKNOWN
```

This is **metadata about evidence provenance**, not a replacement for
canonical payment status.

It must not be used as a probabilistic matching score.

The MVP matching model remains deterministic.

---

# 5. Universal Transaction Anchor

## 5.1 Canonical Anchor

The marketplace transaction anchor is:

```text
transaction_id = txn_…
```

It is generated internally by the host transaction layer and remains
stable for the lifetime of the transaction.

It is the primary internal correlation identity.

It must not change when:

- the payment source changes;
- payment is retried;
- multiple payment-source references exist;
- a provider retry occurs;
- fulfillment produces another external reference;
- a refund/reversal produces another external reference.

---

## 5.2 Identifier Hierarchy

---

Identifier Ownership Required Purpose

---

`transaction_id` (`txn_…`) Host app **Mandatory** Stable internal
transaction anchor

`merchant_reference` Host/client **Mandatory for Existing exact-match
current Reconcile Kit key
matching**

`payment_source` Host/adapter Mandatory for Identifies source
normalized payment
event

`payment_source_reference` External source Optional Source-specific
payment reference

`provider_reference` Service provider Optional until Service fulfillment
provider interaction reference

`wallet_ledger_reference` Wallet subsystem Optional Internal debit/credit
evidence

`fulfillment_reference` Service provider Optional Delivery/fulfillment
evidence
------------------------------------------------------------------------------------------

### Critical rule

`transaction_id` is the universal application anchor.

`merchant_reference` is the existing Reconcile Kit payment matching key.

These are related but are **not the same conceptual identifier**.

For the marketplace integration, the bridge should use a deterministic
merchant reference associated with the transaction and preserve the
`txn_…` anchor separately.

Where the existing marketplace transaction ID is itself used as the
merchant reference, that is acceptable and simplifies correlation. Where
a distinct merchant/client reference already exists, both must be
preserved.

The canonical model explicitly defines `merchant_reference` as the
primary matching key, not as the database primary key.
fileciteturn2file7L965-L976

---

## 5.3 Provider Reference Rule

A provider/service reference is evidence.

It is never a substitute for the internal transaction anchor.

Example:

```text
transaction_id       = txn_123
merchant_reference   = txn_123
payment_reference    = ps_456
provider_reference   = air_789
```

The relationship is:

```text
txn_123
 ├── payment source: PAYSTACK
 │     └── ps_456
 │
 └── service provider: AIRTIME
       └── air_789
```

The provider reference cannot become the transaction ID.

This prevents a common integration error in which payment and
fulfillment identifiers become the same identity merely because they
happen to be available.

---

# 6. Normalized Payment Event Model

A payment-source adapter should conceptually normalize to:

```text
PaymentEvent
├── event_id
├── transaction_id
├── merchant_reference
├── source
├── source_reference?
├── amount
├── currency
├── status
├── occurred_at?
├── observed_at
├── source_confidence
├── idempotency_key
└── source_attributes
```

### Status

The canonical payment status remains:

```text
PENDING
SUCCESS
FAILED
CANCELLED
UNKNOWN
```

Source-specific statuses are mapped at the adapter boundary.

The existing canonical model explicitly requires source-specific
statuses to be mapped before comparison, with `UNKNOWN` distinct from
missing status and known status mismatches producing `STATUS_MISMATCH`.
fileciteturn2file7L924-L945

### Amount

Amounts remain integer minor units plus explicit currency.

No floating-point monetary comparison is introduced.

This preserves the canonical currency model.
fileciteturn2file7L947-L963

---

# 7. Ingestion Modes

The Payment Source Layer supports three source-ingestion modes.

## 7.1 Event/Webhook

```text
source webhook
    ↓
adapter
    ↓
normalize
    ↓
idempotency check
    ↓
store evidence
    ↓
reconcile
```

Webhook delivery must be treated as an event, not automatically as proof
of final transaction truth.

---

## 7.2 Polling/API Verification

Some sources expose transaction lookup APIs.

```text
transaction
    ↓
source adapter
    ↓
poll/verify
    ↓
normalize
    ↓
reconcile
```

The adapter owns source-specific polling semantics.

---

## 7.3 Manual/CSV

Manual or CSV ingestion is a valid MVP source.

```text
CSV/manual record
    ↓
validation
    ↓
source adapter
    ↓
normalized payment
    ↓
reconcile
```

A manually imported record must retain provenance indicating that it was
manually/imported evidence.

Manual evidence does not receive a higher canonical status merely
because an operator entered it.

---

# 8. Three Truths

The marketplace needs three distinct truth dimensions.

## 8.1 Payment Truth

Question:

> Did payment actually arrive/confirm?

Examples:

```text
SUCCESS
PENDING
FAILED
UNKNOWN
```

This is the dimension directly served by the existing Reconcile Kit
payment-reconciliation engine.

---

## 8.2 Ledger Truth

Question:

> Did the platform correctly debit or credit its internal
> account/wallet?

Examples:

```text
NOT_APPLICABLE
DEBITED
CREDITED
LEDGER_MISMATCH
UNKNOWN
```

This is internal wallet/accounting evidence.

The existing canonical ReconcileKit MVP explicitly did not include
wallet/ledger functionality. Therefore this addendum does **not**
redefine the existing payment engine as a ledger. The host wallet layer
remains responsible for producing ledger evidence.

---

## 8.3 Fulfillment Truth

Question:

> Was the requested external service delivered?

Examples:

```text
NOT_REQUESTED
ACCEPTED
FULFILLED
FAILED
PENDING
UNKNOWN
```

This is provider/service evidence.

The existing payment-reconciliation core does not become a VTU/ticketing
fulfillment engine as part of this patch.

---

## 8.4 Composite Transaction Truth

The host marketplace can compose the three dimensions:

```text
Payment Truth
+
Ledger Truth
+
Fulfillment Truth
+
Refund/Reversal Evidence
=
Transaction Truth
```

Example:

```text
Payment      = SUCCESS
Ledger       = DEBITED
Fulfillment  = FAILED
```

This is **not** a successful end-to-end transaction.

It is a paid-but-unfulfilled transaction requiring resolution.

The host transaction/truth projection may expose this composite state
while preserving the underlying Reconcile Kit payment determination.

The design request explicitly requires these truths to remain separate
rather than treating the transaction as simply successful.
fileciteturn1file1L158-L179

---

# 9. Reconciliation Model

The existing canonical Reconcile Kit engine remains responsible for
deterministic payment reconciliation.

At the payment layer:

```text
normalized merchant payment
        VS
normalized payment-source/provider payment
        ↓
exact reference match
        ↓
attribute validation
        ↓
canonical reconciliation result
```

The current canonical outcomes include:

- Exact Match
- Missing Provider Record
- Unmatched Provider Record
- Amount Mismatch
- Currency Mismatch
- Status Mismatch
- Duplicate Merchant Record
- Duplicate Provider Record
- Temporal Anomaly
- Conflicting Attributes

These outcomes are preserved rather than replaced by a new generic state
enum. fileciteturn2file0L37-L48

---

# 10. Composite Resolution States

The requested marketplace states such as:

```text
PAYMENT_RECEIVED_BUT_NOT_FULFILLED
LEDGER_MISMATCH
REFUND_REQUIRED
REFUND_PENDING
REFUNDED
```

should **not** be added to the existing payment reconciliation enum
merely to make the marketplace model convenient.

They are composite/application resolution states derived from multiple
evidence dimensions.

For example:

```text
PAYMENT_RECEIVED_BUT_NOT_FULFILLED
=
payment truth: SUCCESS
+
fulfillment truth: FAILED
```

```text
REFUND_REQUIRED
=
payment truth: SUCCESS
+
fulfillment truth: FAILED
+
money remains with platform/customer debit unresolved
```

```text
REFUNDED
=
prior debit/payment evidence
+
refund evidence confirming completion
```

The canonical payment determination remains available underneath the
composite state.

This preserves the existing distinction between reconciliation
discrepancy, unresolved status, and input error.

---

# 11. Idempotency

Every payment event must have a deterministic idempotency identity.

Conceptually:

```text
source
+
source_reference
+
event_type
+
source_event_id
```

Where a source event ID exists, it should be preferred.

Where it does not exist, the adapter must use a deterministic
source-specific key.

Idempotency prevents:

- duplicate webhook processing;
- duplicate CSV imports;
- repeated polling from creating duplicate evidence;
- payment retries from becoming multiple transactions.

Idempotency must not arbitrarily collapse genuinely distinct events.

---

# 12. Transaction Flow Model

## A. Paystack Card → VTU

```text
Customer
  ↓
Host App creates txn_123
  ↓
Paystack
  ↓
Paystack adapter
  ↓
normalized payment evidence
  ↓
Reconcile Kit
  ↓
VTU provider
  ↓
fulfillment evidence
  ↓
Reconcile Kit / marketplace truth projection
  ↓
resolved transaction
```

### What Reconcile Kit knows

Initially:

- internal transaction/merchant reference;
- Paystack payment evidence;
- amount;
- currency;
- normalized status.

Later:

- provider/fulfillment evidence if it is mapped into the marketplace
  reconciliation context.

### What it does not know automatically

It does not know that the airtime was delivered merely because Paystack
returned `SUCCESS`.

Payment success is payment evidence, not fulfillment proof.

---

## B. Paystack Bank Transfer → VTU

```text
Customer
  ↓
Host App
  ↓
Paystack transfer payment source
  ↓
adapter / webhook / verification
  ↓
Reconcile Kit payment reconciliation
  ↓
VTU provider
  ↓
fulfillment
```

The payment source is different from card, but the internal transaction
anchor remains unchanged.

---

## C. Direct Bank Transfer → VTU

```text
Customer
  ↓
Host App creates txn_123
  ↓
Bank transfer
  ↓
bank statement / manual CSV / bank feed
  ↓
bank adapter
  ↓
normalized payment evidence
  ↓
Reconcile Kit
  ↓
VTU provider
  ↓
fulfillment evidence
```

Important limitation:

A direct bank transaction may not contain the host application's
`merchant_reference`.

If the bank record lacks the exact matching reference, the existing
deterministic matcher cannot safely infer the transaction using
amount/time alone.

The correct MVP behavior is therefore:

```text
missing/incorrect reference
    →
MISSING_REFERENCE / MISSING_PROVIDER_RECORD / appropriate existing result
    →
manual resolution or explicit mapping
```

No fuzzy matching is introduced.

---

## D. Internal Wallet → VTU

```text
Customer
  ↓
Host App
  ↓
wallet debit
  ↓
wallet ledger evidence
  ↓
VTU request
  ↓
provider result
  ↓
marketplace truth projection
```

There may be no external payment provider.

Therefore the payment-source adapter represents the internal
wallet/ledger event as payment evidence for the transaction context.

The wallet itself remains the source of ledger truth.

Reconcile Kit does not become the wallet.

---

## E. Flutterwave → VTU

Same structural flow as Paystack:

```text
Flutterwave
  ↓
Flutterwave adapter
  ↓
normalized payment evidence
  ↓
same Reconcile Kit payment boundary
```

Adding Flutterwave should not require changes to the reconciliation
algorithm.

---

## F. Payment Success → Provider Failure → Refund/Reversal

```text
Payment source
  ↓
SUCCESS
  ↓
Reconcile Kit payment truth
  ↓
service provider
  ↓
FAILED
  ↓
marketplace resolution
  ↓
refund/reversal initiated
  ↓
refund evidence
  ↓
final composite transaction truth
```

The payment reconciliation result does not itself perform the refund.

The host/payment source layer executes or records the refund/reversal.

Reconcile Kit reconciles the evidence.

---

## G. Payment Success → Provider Pending

```text
Payment = SUCCESS
Fulfillment = PENDING
```

The transaction remains unresolved from an end-to-end fulfillment
perspective.

It must not be converted into `FAILED`.

It must not be declared fully successful.

The timeline should show the separate states.

---

## H. Payment Success → Provider Fulfilled → Customer Disputes

```text
Payment = SUCCESS
Ledger = DEBITED
Fulfillment = FULFILLED
Customer = DISPUTES
```

A dispute is a subsequent resolution/evidence event.

The existence of a dispute does not rewrite the historical payment or
fulfillment facts.

Evidence is appended and the resolution state can change independently.

---

# 13. MVP Boundary

The MVP Payment Source Layer should remain deliberately small.

## MVP

Implement only what is necessary to demonstrate provider-neutral
reconciliation:

1.  Existing Paystack adapter/path.
2.  Marketplace internal transaction anchor.
3.  Generic payment-source representation.
4.  Internal wallet payment evidence.
5.  Manual/CSV bank transaction ingestion.
6.  Deterministic normalization into the existing Reconcile Kit payment
    boundary.
7.  Idempotent payment-event ingestion.
8.  Source-reference preservation.
9.  Evidence provenance.
10. Tests proving multiple payment sources can feed the same
    reconciliation boundary.

The existing canonical MVP already permits CSV, JSON, or programmatic
input when mapped to the canonical merchant record contract.
fileciteturn1file7L1082-L1101

## Post-MVP

- Direct bank API integrations.
- Flutterwave live adapter.
- Additional PSP adapters.
- Automated webhook ingestion infrastructure.
- Automated refund lifecycle.
- Expanded fulfillment reconciliation.
- Cross-system transaction search.
- Operational reconciliation workflows.

## Enterprise

- Multi-tenant API gateway.
- API keys and scoped credentials.
- Webhooks.
- Source-specific SLAs.
- Durable event storage.
- Replay/reprocessing.
- Advanced audit controls.
- Settlement reconciliation.
- Bank reconciliation.
- Enterprise RBAC.
- Observability and provider health.
- Billing/metering.
- High-volume ingestion.

Do not implement enterprise infrastructure as part of this patch.

---

# 14. Traceability to Existing Scenarios

The existing canonical scenarios remain valid because the core matching
rules do not change:

---

Existing scenario Payment Source Layer treatment

---

Exact match Preserved

Missing provider transaction Preserved

Missing merchant record Preserved

Amount mismatch Preserved

Currency mismatch Preserved

Status mismatch Preserved

Duplicate merchant record Preserved

Duplicate provider record Preserved

Timestamp anomaly Preserved

Same reference, conflicting Preserved
attributes

Missing status Preserved

Missing timestamp Preserved

Unknown status mapping Preserved

Invalid currency Preserved as input error

Multiple provider candidates Preserved as duplicate/ambiguity
behavior
-----------------------------------------------------------------------

The validated scenario work confirms these outcomes are deterministic
and that unknown status, missing information, duplicate conditions, and
input errors remain distinct. fileciteturn2file8L1051-L1065

The 20-scenario validation also confirms the canonical invariants,
including deterministic matching, exact-reference matching, no arbitrary
duplicate pairing, and preservation of multiple discrepancies.
fileciteturn2file8L1067-L1076

---

# 15. Newly Introduced Concepts

This patch introduces only the concepts required to remove the Paystack
assumption:

- Payment Source
- Payment Source Adapter
- Payment Event
- Payment Source Reference
- Universal Internal Transaction Anchor
- Source Confidence/Provenance
- Idempotent Source Event
- Composite Payment/Ledger/Fulfillment Truth projection

The first seven are boundary/integration concepts.

The composite truth projection is a marketplace/application concept and
must not silently become a new core reconciliation algorithm.

---

# 16. Changed Assumption

The one material architectural assumption being changed is:

```text
OLD:
ReconcileKit MVP
=
merchant payment record ↔ Paystack transaction
```

to:

```text
PATCHED:
ReconcileKit payment boundary
=
merchant payment record ↔ normalized payment-source evidence
```

Paystack remains one implementation of that source boundary.

The existing core still operates on normalized domain objects and
therefore does not need to know whether the source was Paystack, bank
transfer, wallet, Flutterwave, or manual import.
fileciteturn2file4L557-L572

---

# 17. Contradictions and Gaps

## 17.1 Confirmed Architectural Gap --- Payment-only Canonical Scope

The current canonical domain is explicitly a payment-reconciliation
model.

It does not currently define ledger reconciliation, full refund
lifecycle reconciliation, chargeback/dispute reconciliation, or wallet
functionality as core MVP concerns. fileciteturn1file7L1069-L1080

Therefore this patch must **not** claim that the current core engine
independently reconciles all payment, ledger, fulfillment, refund, and
dispute truth.

Instead:

```text
Current core:
payment reconciliation

Marketplace composition:
payment + ledger + fulfillment + resolution evidence
```

This is a deliberate boundary, not an implementation failure.

---

## 17.2 Confirmed Constraint --- Exact Matching

The canonical MVP uses exact reference matching and explicitly excludes
fuzzy/probabilistic matching. fileciteturn2file0L21-L35

Therefore a direct bank transaction without a usable merchant reference
cannot be automatically correlated using amount, timestamp, customer
name, or similar heuristics.

Manual mapping is acceptable for MVP.

---

## 17.3 Confirmed Constraint --- Duplicate Semantics

The canonical model currently specifies duplicate records and
`HELD_AMBIGUOUS` counterpart behavior. fileciteturn2file7L1009-L1040

The Payment Source Layer must preserve that canonical behavior.

The marketplace may add an application flag describing duplicate
evidence, but it must not silently reinterpret the core duplicate
determination.

---

## 17.4 No Core API Contradiction Identified by Design

The existing canonical normalization boundary is specifically designed
to keep provider-specific behavior outside the core.

The Payment Source Layer can therefore be implemented as an
adapter/normalization extension without changing the root reconciliation
algorithm.

The remaining implementation question is whether the **actual current
TypeScript API** exposes enough normalized input shape to construct the
required request without an additive storefront/adapter mapping.

That is an implementation verification step, not a license to modify the
core.

---

# 18. Future Architecture

The patch evolves naturally into:

```text
Payment Source Adapters
        ↓
Normalization Layer
        ↓
Universal Transaction Anchor
        ↓
Payment Truth
        ↓
Ledger Truth
        ↓
Fulfillment Truth
        ↓
Reconcile Kit Truth Engine
        ↓
Matching Engine
        ↓
Mismatch Detection
        ↓
Resolution Engine
        ↓
Evidence / Audit Layer
        ↓
API / Webhook Layer
        ↓
Enterprise Controls
```

New payment providers should terminate at the adapter/normalization
boundary.

The core reconciliation engine should not need to be rewritten merely
because another PSP or payment rail is added.

This follows the existing canonical requirement that provider-specific
logic remain outside the core. fileciteturn1file2L433-L448

---

# 19. Commercial Implication

The product should not be positioned as:

> Paystack reconciliation software.

The broader infrastructure proposition is:

> **Provider-neutral transaction truth infrastructure.**

That positioning is justified only if the architecture actually keeps
payment-source identity separate from the core truth engine.

Potential future users include:

- VTUs
- wallet applications
- bill-payment platforms
- ticketing platforms
- digital marketplaces
- fintech operations teams
- larger payment operations

The MVP remains narrow; the commercial expansion is a consequence of the
architecture, not a reason to prematurely build enterprise
infrastructure.

---

# 20. Implementation Implications

The implementation should favor a thin boundary:

```text
Payment Source
      ↓
Source Adapter
      ↓
Normalized Payment Event
      ↓
Marketplace Transaction Anchor
      ↓
Existing Reconcile Kit canonical request
      ↓
Existing reconcileRecords()
      ↓
Marketplace Transaction Truth projection
```

The implementation should not create a parallel matcher.

It should not duplicate amount/currency/status matching logic.

It should not introduce fuzzy matching.

It should not make provider-specific decisions in the core.

It should not make a provider reference the transaction anchor.

---

# 21. Explicit Non-Goals

This patch does **not**:

- replace the canonical domain model;
- rewrite Reconcile Kit;
- turn Reconcile Kit into a PSP;
- process payments;
- custody money;
- become a wallet;
- become an FX engine;
- implement bank settlement reconciliation;
- implement full chargeback reconciliation;
- implement enterprise ingestion infrastructure;
- introduce fuzzy matching;
- introduce probabilistic matching;
- create a new canonical status taxonomy merely for marketplace
  convenience;
- make Paystack-specific assumptions part of the core;
- guarantee fulfillment from payment success;
- treat manual evidence as inherently authoritative.

---

# 22. Approval Gate

The Payment Source Layer design is internally consistent with the
existing canonical model provided that the following boundary remains
explicit:

> **The patch broadens the payment-source input boundary. It does not
> silently expand the current payment-reconciliation core into a full
> ledger, fulfillment, refund, or dispute reconciliation engine.**

Before implementation, OpenCode must inspect the actual current APIs and
verify that the normalized payment-source records can be mapped into the
existing reconciliation request without modifying root `src/**`.

If that mapping cannot be achieved within the adapter boundary,
implementation must stop under the defined API contradiction criteria.

The implementation goal is therefore:

```text
PATCH THE PAYMENT-SOURCE GAP
→ PRESERVE THE CANONICAL ENGINE
→ VALIDATE THE ADAPTER BOUNDARY
→ IMPLEMENT THE THIN LAYER
→ TEST MULTIPLE PAYMENT SOURCES
→ CONTINUE THE EXISTING ROADMAP
```

---

# 23. Wallet Event Ingestion (Phase 2 implementation)

Phase 2 wires the existing marketplace wallet ledger into the Payment Source
Layer as implemented in the storefront prototype. It adds one thin bridge and
reuses every existing component; it does not change the wallet, the payment
source layer, or the frozen engine.

## 23.1 Canonical bridge

`storefront/src/marketplace/payment-sources/wallet-ingest.ts` exports:

```text
ingestWalletLedgerEntries(store, entries, { now })
```

For each `WalletLedgerEntry` it runs the existing wallet adapter
(`walletLedgerToPaymentEvent`) and, when the entry carries payment semantics,
drops the normalized draft through the existing idempotent ingestion entry
point (`ingestPaymentEvent`). Outcomes distinguish **skipped** (no payment
semantics) from **recorded** versus **replay**.

The implemented flow matches section 20 exactly:

```text
WalletLedgerEntry
  → wallet payment-source adapter
  → PaymentEventInput
  → ingestPaymentEvent()
  → stored PaymentEvent (payment_events)
  → reconcilePaymentEvents() / toReconcileKitRequest()
  → reconcileRecords()
  → TransactionTruth / reconciliation result
```

## 23.2 Mapping (marketplace projection)

```text
transaction_id              = WalletLedgerEntry.transactionId  = mk_txn_…
merchant_reference          = WalletLedgerEntry.transactionId
ProviderPayment.reference   = mk_txn_… (join reference only)
payment_source_reference    = WalletLedgerEntry.reference      = wld_…
provider_reference          = absent / not applicable (never fabricated)
wallet_ledger_reference     = wld_… (EvidencePack / source attributes)
MarketplaceTransaction.reference = txn_… (display reference only)
```

Invariant: the ledger reference (`wld_…`) is evidence; `mk_txn_…` is the join
key. The two are never inverted and never correlated by amount, timestamp, or
balance difference.

## 23.3 Semantics preserved by the bridge

- `OPENING_BALANCE` yields no event (`skipped`), never a reconciliation record.
- A ledger entry with no transaction association projects no provider row and
  reconciles as `MISSING_REFERENCE`; nothing is heuristically attached.
- Ingestion stays deterministic: an idempotency key of
  `INTERNAL_WALLET|<wld_…>|PAYMENT|<ledger id>` makes replay (including a fresh
  store over the same JSONL directory) resolve to one stable `PaymentEvent`.
- Reconciliation is observational: it does not mutate the wallet ledger, add
  balances, reverse or refund, call providers, fulfill, or alter transaction
  state. Payment/ledger truth and fulfillment truth stay separate (a `MATCH`
  on wallet evidence does not imply fulfillment success).

## 23.4 Tenant dimension

The prototype marketplace layer has no tenant/organization dimension; wallets
and ledger entries are scoped per customer. This fact is documented rather than
inventing a tenant field on wallet payment events.
