# RECONCILE KIT --- PAYMENT SOURCE LAYER OPEN CODE IMPLEMENTATION PROMPT

## Mission

Implement the approved **Payment Source Layer design patch** for the
existing Reconcile Kit project.

This is an architectural patch, not a rewrite.

The goal is to remove the current Paystack-centric payment-source
assumption while preserving the existing deterministic Reconcile Kit
reconciliation engine and all previously validated behavior.

Do not redesign the product.

Do not replace the canonical model.

Do not modify the root reconciliation engine unless an explicit API
contradiction is discovered; if one is discovered, STOP and report it.

---

# 1. REQUIRED READING ORDER

Before modifying anything, read:

1.  The existing canonical Reconcile Kit documentation.
2.  `CANONICAL-DOMAIN-MODEL-v0.2.md`
3.  `RECONCILIATION-DOMAIN.md`
4.  the validated scenario artifacts covering the 20 canonical
    scenarios.
5.  the existing Paystack evidence-validation artifact.
6.  the existing repository implementation.
7.  `docs/RECONCILE_KIT_INTEGRATION_DESIGN.md`, if present.
8.  `RECONCILE-KIT-PAYMENT-SOURCE-LAYER-ADDENDUM.md` --- this artifact.

Then inspect the actual TypeScript APIs before designing implementation
details.

Do not infer APIs from documentation when the source code can answer the
question.

---

# 2. ARCHITECTURAL CONTRACT

The architecture is:

```text
HOST APP
  ↓
TRANSACTION / SERVICE LAYER
  ↓
PAYMENT SOURCE LAYER
  ↓
NORMALIZED PAYMENT EVIDENCE
  ↓
RECONCILE KIT
  ↓
TRANSACTION TRUTH / EVIDENCE / RESOLUTION
```

Reconcile Kit remains the transaction-truth/reconciliation engine.

Payment sources are external or internal evidence sources.

Examples:

- Paystack
- bank transfer
- internal wallet
- Flutterwave
- manual/CSV
- future PSPs

The core engine must remain provider-neutral.

---

# 3. CRITICAL BOUNDARY

The existing canonical engine is a deterministic **payment
reconciliation** engine.

Do not silently turn it into a full:

- wallet engine;
- ledger;
- fulfillment engine;
- refund processor;
- chargeback system;
- payment processor;
- PSP.

Payment, ledger, and fulfillment truth are separate dimensions.

The marketplace may compose those dimensions into a transaction-truth
projection, but the implementation must not duplicate the core
reconciliation algorithm.

---

# 4. UNIVERSAL TRANSACTION ANCHOR

Use the marketplace's stable internal transaction ID:

```text
txn_…
```

as the universal application transaction anchor.

It must remain stable across:

- payment-source changes;
- retries;
- multiple payment references;
- provider retries;
- fulfillment references;
- refunds/reversals.

Keep these identifiers distinct:

```text
transaction_id
merchant_reference
payment_source_reference
provider_reference
wallet_ledger_reference
fulfillment_reference
```

Never use a provider reference such as `air_…` as the marketplace
transaction ID.

Never replace `txn_…` with a provider reference merely to satisfy
matching.

The existing canonical Reconcile Kit matching key is
`merchant_reference`, so inspect the current API and establish the
thinnest deterministic mapping between the marketplace transaction
anchor and that canonical field.

Do not invent a second matching strategy.

---

# 5. PAYMENT SOURCE ABSTRACTION

Implement only the smallest abstraction required to normalize payment
evidence.

Conceptually:

```text
Payment Source
    ↓
Payment Source Adapter
    ↓
Normalized Payment Event
    ↓
Existing Reconcile Kit canonical input
```

The normalized event should preserve, where available:

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
source_confidence
idempotency_key
source_attributes
```

Not every source is required to provide every field.

Missing values must remain missing.

Unknown source statuses must remain distinguishable from missing
statuses.

Do not fabricate facts.

---

# 6. SOURCE TYPES

The abstraction must be capable of representing at least:

```text
PAYSTACK
BANK_TRANSFER
INTERNAL_WALLET
FLUTTERWAVE
MANUAL_CSV
FUTURE_PSP
```

For this MVP, do not implement live integrations for every source unless
the repository already contains them.

The immediate goal is to prove that multiple payment-source types can
reach the same normalized reconciliation boundary.

---

# 7. MVP IMPLEMENTATION PRIORITY

Prioritize:

1.  Existing Paystack path remains working.
2.  Generic payment-source representation.
3.  Marketplace transaction anchor.
4.  Internal wallet payment evidence.
5.  Manual/CSV bank evidence.
6.  Deterministic normalization.
7.  Idempotent ingestion.
8.  Source-reference preservation.
9.  Evidence provenance.
10. Tests demonstrating the same reconciliation boundary works across
    sources.

Do not build:

- enterprise connector framework;
- bank API integrations;
- full Flutterwave production integration;
- settlement reconciliation;
- chargeback lifecycle;
- generalized webhook infrastructure;
- provider marketplace;
- speculative abstraction layers.

---

# 8. THREE TRUTH DIMENSIONS

Preserve these separately:

## Payment Truth

Did payment arrive/confirm?

## Ledger Truth

Did the platform correctly debit/credit its internal wallet/account?

## Fulfillment Truth

Was the requested service delivered?

Example:

```text
Payment     = SUCCESS
Ledger      = DEBITED
Fulfillment = FAILED
```

must not become a generic successful transaction.

If the existing marketplace already has a transaction-truth projection,
extend it minimally to preserve these dimensions.

Do not create a new core reconciliation enum merely for this composite
state.

---

# 9. RECONCILIATION RULES

Preserve all existing canonical rules:

- deterministic matching;
- exact reference matching;
- no fuzzy matching;
- no probabilistic scoring;
- integer minor-unit monetary comparison;
- explicit currency;
- duplicate detection before arbitrary pairing;
- missing information distinct from conflicting information;
- unknown status distinct from missing status;
- input errors distinct from reconciliation discrepancies;
- multiple discrepancy codes preserved;
- timestamps never become a hidden matching key;
- source attributes preserved where relevant.

Do not reimplement these rules in the marketplace layer.

Call the existing Reconcile Kit reconciliation API.

---

# 10. STATUS HANDLING

The canonical payment status vocabulary remains:

```text
PENDING
SUCCESS
FAILED
CANCELLED
UNKNOWN
```

Source-specific status strings must be mapped at the adapter boundary.

Preserve the original source status in source attributes where
appropriate.

Do not silently reinterpret source status in the core.

For example, a provider's unknown/unmapped status must not become
`SUCCESS`.

---

# 11. DIRECT BANK TRANSFER

Treat direct bank transfer as a source that may lack the host
application's merchant reference.

This is a known limitation of the existing exact-reference MVP.

Do NOT match using:

- amount alone;
- timestamp alone;
- customer name alone;
- account name alone;
- probabilistic similarity;
- fuzzy matching.

If a usable reference is unavailable, preserve the appropriate canonical
missing-reference/unmatched behavior and leave the transaction for
manual resolution where applicable.

Manual mapping is acceptable for MVP.

---

# 12. INTERNAL WALLET

The internal wallet can provide payment evidence without an external
PSP.

Keep the distinction:

```text
wallet ledger
    =
ledger truth

wallet debit evidence
    =
payment-source evidence for the transaction
```

Do not turn Reconcile Kit into the wallet ledger.

Preserve the existing wallet implementation and its append-only
behavior.

---

# 13. IDEMPOTENCY

Every normalized payment event must have deterministic idempotency
handling.

Repeated webhook/import/poll processing must not create duplicate
payment evidence.

However:

Do not collapse genuinely distinct source events merely because they
share an amount or transaction ID.

Use source-specific event/reference identity where available.

---

# 14. EVIDENCE AND AUDITABILITY

Preserve source provenance.

A normalized record should make it possible to answer:

```text
Where did this payment evidence come from?
What was the original source reference?
What source status was observed?
When was it observed?
Which internal transaction did it belong to?
What canonical result did reconciliation produce?
```

Do not discard source-specific evidence that is needed to explain a
result.

Do not overwrite historical evidence.

---

# 15. TEST REQUIREMENTS

Add focused tests for:

### Payment sources

- Paystack
- manual/CSV bank transfer
- internal wallet
- generic/future source normalization

### Identity

- stable `txn_…` anchor
- separate merchant reference
- separate payment-source reference
- separate provider reference
- provider reference cannot become transaction anchor

### Reconciliation

- exact match
- missing provider transaction
- amount mismatch
- currency mismatch
- status mismatch
- duplicate merchant record
- duplicate provider record
- timestamp anomaly
- conflicting attributes
- unknown status
- missing status
- missing timestamp
- invalid currency
- multiple simultaneous discrepancies

### Source behavior

- repeated identical event is idempotent
- different source references remain distinct
- source status is preserved
- missing source fields remain missing
- no fabricated success

### Cross-source boundary

Prove that Paystack, bank/manual, and wallet evidence can reach the same
canonical reconciliation boundary without changing the core matcher.

---

# 16. TRACEABILITY

Update or add fixtures/scenarios only where required.

Do not alter existing scenario meaning merely to make the new
abstraction fit.

For every changed scenario, report:

```text
scenario
old assumption
new payment-source representation
canonical result
reason for change
```

Scenarios that remain valid must remain semantically unchanged.

---

# 17. FILE/SCOPE DISCIPLINE

Before coding, inspect the repository and identify:

- canonical domain modules;
- reconciliation application entry point;
- provider adapters;
- existing Paystack adapter;
- merchant input mapping;
- payment records;
- marketplace transaction types;
- wallet records;
- timeline/evidence structures;
- existing tests.

Then choose the smallest implementation boundary.

Do not assume the file structure described in this prompt is exact.

Follow the actual repository.

---

# 18. ROOT ENGINE PROTECTION

By default, do not modify:

```text
root src/**
```

Do not modify:

- reconciliation algorithms;
- canonical statuses;
- canonical discrepancy rules;
- Paystack-specific core behavior;
- PaymentRecord semantics;
- matching strategy.

If an additive root change is genuinely unavoidable, STOP before making
it and report the contradiction.

---

# 19. EXACT API CONTRADICTION STOP CONDITIONS

STOP immediately if any of these occur:

### A. Required input cannot be represented

The existing reconciliation API requires a field that cannot be derived
from legitimate marketplace/source evidence without fabricating data.

### B. Canonical state cannot represent a legitimate source state

The adapter would have to falsely classify an unresolved/unknown state
as success or failure.

### C. Join key cannot be preserved

The current API requires a different identifier in a way that makes
stable `txn_…` correlation impossible without changing existing IDs or
matching semantics.

### D. Required evidence cannot be represented

The API forces loss or falsification of materially important source
evidence.

### E. Existing API destroys required history

The integration would overwrite or destroy immutable historical
evidence.

### F. Idempotency cannot be preserved

Repeated calls necessarily create incorrect duplicate durable effects
and no safe marketplace-side guard can prevent them.

### G. Canonical status semantics must change

Implementation requires adding/changing a canonical status or
discrepancy meaning.

### H. Root engine modification is required

The adapter cannot implement the approved patch without modifying
`src/**`.

---

# 20. WHAT IS NOT A CONTRADICTION

Do not stop for:

- TypeScript mapping differences;
- field renaming;
- serialization differences;
- optional/null handling supported by the existing API;
- adapter-local validation;
- adapter-local source-status mapping;
- adapter-local provenance;
- marketplace-only metadata;
- adding tests;
- adding marketplace evidence storage;
- adding timeline events;
- deterministic replay guards;
- creating a marketplace truth projection.

These belong at the boundary.

---

# 21. MANDATORY STOP REPORT

If a contradiction is discovered, do not continue implementation.

Report:

1.  exact file;
2.  exact symbol/function/type;
3.  current API contract;
4.  required marketplace behavior;
5.  concrete input that exposes the conflict;
6.  why the adapter cannot safely resolve it;
7.  smallest possible resolution options;
8.  whether each option requires a root-engine change;
9.  files changed before the stop;
10. validation already run.

Do not silently work around the contradiction.

Do not redesign the engine.

---

# 22. ACCEPTANCE CRITERIA

Implementation is acceptable only if:

- Paystack behavior remains intact.
- Existing canonical reconciliation semantics remain intact.
- Multiple payment-source types can normalize into the same
  reconciliation boundary.
- `txn_…` remains the stable marketplace transaction anchor.
- Provider references remain evidence only.
- No fuzzy matching is introduced.
- No provider-specific logic enters the core.
- Payment, ledger, and fulfillment truth remain distinguishable.
- Source evidence is preserved.
- Event processing is idempotent.
- Existing tenant isolation remains intact.
- Existing auditability remains intact.
- Existing tests continue to pass.
- New tests cover the payment-source boundary.
- No unrelated architecture is introduced.

---

# 23. VALIDATION

Run the repository's existing validation commands.

At minimum:

- storefront tests;
- root tests;
- storefront typecheck;
- root typecheck;
- lint;
- formatting/Prettier.

Report exact independent test counts.

Do not report a combined or duplicated count as an independent suite
count.

Also report:

```text
files created
files modified
files intentionally untouched
tests added
existing tests preserved
architecture deviations
```

---

# 24. FINAL IMPLEMENTATION REPORT

Use this structure:

```text
PAYMENT SOURCE LAYER IMPLEMENTATION REPORT

Status:
PASS / STOPPED — CONTRADICTION

Architecture:
<short summary>

Payment sources supported:
<list>

Universal anchor:
<summary>

Existing Reconcile Kit changes:
<none, or exact changes>

Marketplace changes:
<list>

Tests:
Storefront: X/X
Root: Y/Y

Typecheck:
<results>

Lint:
<results>

Prettier:
<results>

Scenarios added/updated:
<list>

Files created:
<list>

Files modified:
<list>

Files intentionally untouched:
<list>

Deviations:
<none or exact list>

Contradictions:
<none or mandatory stop report>

Next recommended gate:
<one concrete next step>
```

Do not claim production readiness.

Do not claim live PSP support unless the repository actually implements
and validates it.

The purpose of this phase is to prove the **provider-neutral
payment-source boundary** while preserving the existing Reconcile Kit
engine.
