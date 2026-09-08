# ReconcileKit — Paystack Evidence Validation

**Version:** 0.2  
**Status:** Evidence review — revised after factual audit  
**Scope:** Paystack payment-transaction adapter for MVP

## 1. Purpose

This artifact validates the external Paystack assumptions identified before implementation:

1. transaction reference relationship;
2. transaction status vocabulary and adapter mapping;
3. currency and amount/subunit behavior;
4. timestamp availability and semantics.

This document deliberately distinguishes:

- **FACT** — directly supported by current Paystack documentation;
- **ADAPTER INTERPRETATION** — ReconcileKit's normalization decision based on the documented provider behavior;
- **NOT ESTABLISHED** — the reviewed evidence does not justify the claim.

Provider facts must not be silently promoted into provider-neutral domain rules.

## 2. Primary Evidence

The current review uses Paystack's official developer documentation, principally:

- Verify Payments: https://paystack.com/docs/payments/verify-payments/
- Transactions API: https://paystack.com/docs/api/transaction/
- API / Supported Currency: https://paystack.com/docs/api/

The relevant documentation establishes transaction references, transaction statuses, amounts, currencies, and timestamp fields.

## 3. Transaction Reference

### Finding

**FACT: VALIDATED**

Paystack documents `reference` as a unique transaction reference. The Transactions API uses the transaction reference to initialize and verify transactions, and the Verify Transaction endpoint accepts the reference as its lookup parameter. (Paystack Transactions API — Initialize: https://paystack.com/docs/api/transaction/#initialize; Verify: https://paystack.com/docs/api/transaction/#verify)

### Architectural consequence

The Paystack adapter may map:

```text
Paystack data.reference
        ↓
ProviderPayment.reference
```

This supports the ReconcileKit decision to use the merchant-side reference as the **primary matching key** against the Paystack transaction `reference`.

Important distinction:

```text
merchant_reference = primary matching key
NOT
merchant_reference = database primary key
```

### Limitation

This validates the provider-side reference mechanism. It does not establish that every merchant system has stored the reference correctly.

Missing, empty, malformed, or incorrect merchant references remain merchant-input/reconciliation cases.

## 4. Transaction Status Vocabulary

### Finding

**FACT: VALIDATED**

Paystack currently documents these transaction statuses:

```text
abandoned
failed
ongoing
pending
processing
queued
reversed
success
```

Paystack describes:

- `abandoned` as a customer not completing the transaction;
- `failed` as a failed transaction;
- `ongoing` as the customer currently attempting an action to complete the transaction;
- `pending` as a transaction currently in progress;
- `processing` as equivalent to pending for direct debit;
- `queued` as queued for later processing;
- `reversed` as a reversed transaction, which may mean a refund or successful chargeback;
- `success` as successfully processed. (Paystack Verify Payments — Transaction statuses: https://paystack.com/docs/payments/verify-payments/)

### Critical API distinction

The Verify response contains an outer API `status` and an inner transaction `data.status`.

Paystack explicitly states that the transaction status is:

```text
response.data.status
```

not the outer:

```text
response.status
```

The adapter must preserve this distinction. (Paystack Verify Payments — Verify Transaction response: https://paystack.com/docs/payments/verify-payments/)

## 5. Canonical Status Mapping

### Finding

**ADAPTER INTERPRETATION: PARTIALLY VALIDATED**

The Paystack source vocabulary is validated. The mapping from that vocabulary into ReconcileKit's canonical status model is **our normalization decision**, not a Paystack-defined equivalence.

Current proposed mapping:

```text
Paystack success
    → SUCCESS

Paystack failed
    → FAILED

Paystack pending
    → PENDING

Paystack processing
    → PENDING

Paystack ongoing
    → PENDING

Paystack queued
    → PENDING

Paystack abandoned
    → UNKNOWN

Paystack reversed
    → UNKNOWN
```

### Why `abandoned` and `reversed` remain `UNKNOWN`

`abandoned` is not documented by Paystack as a cancellation state.

`reversed` is particularly important: Paystack says it can represent a refund or a successful chargeback. Treating that state as `CANCELLED` would collapse materially different business meanings into a status that the canonical model does not currently define. (Paystack Verify Payments — Transaction statuses: https://paystack.com/docs/payments/verify-payments/)

Therefore ReconcileKit must **not** currently freeze:

```text
abandoned → CANCELLED
reversed  → CANCELLED
```

If future product requirements require distinguishing these states, the canonical domain model must be deliberately revised.

### Source preservation

The adapter must preserve the original Paystack status in source attributes.

Example:

```text
source_attributes:
  original_status: "reversed"

canonical_status:
  UNKNOWN
```

This allows investigation without contaminating the provider-neutral status model.

## 6. Amount Representation

### Finding

**FACT: VALIDATED**

Paystack documents that transaction amounts are supplied in the **subunit of the supported currency**. The transaction API response also returns integer amounts. (Paystack Transactions API: https://paystack.com/docs/api/transaction/)

This supports the canonical representation:

```text
amount   = integer minor/subunit amount
currency = explicit currency code
```

and supports the prohibition on floating-point monetary comparison.

### Adapter responsibility

The Paystack adapter must preserve the provider's integer amount representation and validate it against the applicable currency rules.

## 7. Currency Behavior

### Finding

**FACT: VALIDATED AT PROVIDER BOUNDARY**

The Paystack transaction API exposes a transaction `currency` and documents currency-specific amount behavior. The API documentation also lists supported currencies and notes provider-specific subunit handling. (Paystack API — Supported Currency: https://paystack.com/docs/api/#supported-currency)

The architectural conclusion remains:

```text
Paystack currency/subunit behavior
        ↓
Paystack adapter
        ↓
provider-neutral CurrencyCode + integer amount
```

The core reconciliation engine must not contain Paystack-specific currency rules.

### Adapter requirement

The adapter should maintain an explicit supported-currency/subunit definition rather than assuming every ISO currency behaves identically.

Invalid or unsupported currency input must remain an adapter/input-validation concern and map to the canonical `INPUT_ERROR` boundary.

## 8. Timestamp Availability and Semantics

### Finding

**FACT: VALIDATED**

Paystack exposes the documented timestamp fields:

```text
created_at
paid_at
transaction_date
```

The Verify API example demonstrates that `created_at`/`transaction_date` and `paid_at` can represent different times. In the documented example, `created_at` and `transaction_date` are the same while `paid_at` occurs later. (Paystack Transactions API — Verify Transaction response: https://paystack.com/docs/api/transaction/#verify)

### What the evidence does establish

Paystack provides timestamp fields that can be used by an adapter.

### What the evidence does NOT establish

The reviewed documentation does not establish that one of these fields is universally the correct reconciliation timestamp for every payment workflow.

It also does not establish a universal tolerance such as:

```text
±5 minutes
±10 minutes
```

Therefore ReconcileKit must not hard-code a timestamp tolerance based on assumption.

### Current architectural position

Timestamp validation remains configurable.

The Paystack adapter must explicitly document which provider timestamp it maps to canonical `occurred_at`.

That selection remains an **adapter-design decision requiring representative test-data validation**, not a claim that Paystack mandates a particular reconciliation timestamp.

No default tolerance is currently established.

## 9. Evidence Summary

| Requirement                                                        | Classification            | Status              |
| ------------------------------------------------------------------ | ------------------------- | ------------------- |
| Paystack transaction reference exists and is used for verification | FACT                      | VALIDATED           |
| Paystack transaction status vocabulary                             | FACT                      | VALIDATED           |
| Transaction status is `data.status`                                | FACT                      | VALIDATED           |
| Canonical mapping of `success`, `failed`, `pending`, etc.          | ADAPTER INTERPRETATION    | PARTIALLY VALIDATED |
| `abandoned → CANCELLED`                                            | ADAPTER INTERPRETATION    | REJECTED FOR NOW    |
| `reversed → CANCELLED`                                             | ADAPTER INTERPRETATION    | REJECTED FOR NOW    |
| Original provider status preservation                              | ADAPTER REQUIREMENT       | VALIDATED           |
| Amounts use currency subunits                                      | FACT                      | VALIDATED           |
| Integer amount representation                                      | FACT + DOMAIN DECISION    | VALIDATED           |
| Currency is explicitly represented                                 | FACT                      | VALIDATED           |
| Provider-specific currency/subunit rules belong in adapter         | ARCHITECTURAL CONSEQUENCE | VALIDATED           |
| Timestamp fields are available                                     | FACT                      | VALIDATED           |
| Universal timestamp field selection                                | —                         | NOT ESTABLISHED     |
| Universal timestamp tolerance/default                              | —                         | NOT ESTABLISHED     |

## 10. Consequences for the Canonical Domain

The evidence remains compatible with:

```text
MerchantPayment
ProviderPayment
NormalizedPayment
```

with:

```text
reference
amount
currency
status
occurred_at
```

The provider adapter performs:

```text
Paystack raw reference
        ↓
provider reference

Paystack raw amount
        ↓
canonical integer amount

Paystack raw currency
        ↓
canonical CurrencyCode

Paystack raw status
        ↓
canonical status + preserved source status

Paystack timestamps
        ↓
adapter-selected occurred_at
```

The core reconciliation engine remains responsible for matching, validation, discrepancy classification, and result generation.

## 11. Adapter-Level Requirements

The Paystack adapter specification must include:

1. extraction of `data.reference`;
2. extraction of `data.amount`;
3. extraction of `data.currency`;
4. extraction of `data.status`;
5. explicit canonical status mapping;
6. preservation of original Paystack status;
7. explicit supported-currency/subunit behavior;
8. explicit selection of the provider timestamp mapped to `occurred_at`;
9. preservation of relevant source timestamps;
10. rejection of invalid/unsupported currency;
11. protection against confusing API envelope `status` with transaction `data.status`.

## 12. Remaining Evidence / Validation Gaps

Two adapter-level questions remain open:

### A. Timestamp field selection

The documentation confirms multiple timestamps but does not establish a universal reconciliation field.

The adapter must validate the selected field against representative Paystack test transactions.

### B. Timestamp tolerance/default

No evidence reviewed establishes a universal reconciliation tolerance.

Therefore:

```text
timestamp tolerance = configuration
```

and no provider-specific default is frozen.

### Important distinction

These are **adapter validation tasks**, not contradictions in the canonical domain model.

## 13. Architecture Readiness

**READY FOR ARCHITECTURE**

The evidence supports designing the adapter boundary around:

- exact Paystack transaction references;
- integer subunit amounts;
- explicit currency;
- Paystack source-status preservation;
- explicit adapter-level status normalization;
- configurable timestamp validation;
- provider-specific source-attribute preservation.

Architecture must not:

- map `reversed` to `CANCELLED` as a settled fact;
- map `abandoned` to `CANCELLED` as a settled fact;
- hard-code a timestamp tolerance without evidence;
- assume one Paystack timestamp is universally authoritative;
- leak Paystack-specific status or currency semantics into the core reconciliation engine.

## 14. Evidence Discipline

This artifact validates what the Paystack adapter can expect from the provider documentation reviewed.

It does not establish that:

- every merchant stores the Paystack reference;
- every merchant has a comparable timestamp;
- every merchant uses the same status vocabulary;
- merchant-side amounts are already normalized;
- a single timestamp field is universally correct for reconciliation.

Those remain merchant-input and adapter-design concerns.

## 15. Final Evidence Verdict

**PASS WITH TWO ADAPTER-LEVEL OPEN ITEMS**

The provider facts required to begin architecture are sufficiently established.

The remaining questions concern:

1. selection of the Paystack timestamp mapped to `occurred_at`;
2. evidence-based timestamp tolerance/default.

Neither requires changing the provider-neutral canonical domain model at this stage.
