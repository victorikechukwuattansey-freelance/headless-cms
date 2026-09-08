# ReconcileKit — Canonical Domain Model

**Version:** 0.3  
**Status:** Final domain draft — pre-architecture  
**Scope:** MVP

## 1. Purpose

This document defines the canonical, provider-neutral domain model for ReconcileKit v1 after project-scope validation, reconciliation-domain validation, domain-decision validation, synthetic scenario validation, and canonical-model pressure testing.

It freezes domain semantics, not implementation technology.

## 2. Domain Boundary

ReconcileKit reconciles merchant-side payment records against payment-provider transaction records.

The core domain is provider-neutral.

```text
Merchant Input
      ↓
Merchant Mapping
      ↓
MerchantPayment
      ↓
                         ┌──────────────────────┐
Provider Input           │ Reconciliation Core  │
      ↓                  │                      │
Provider Adapter         │ Matching + Validation│
      ↓                  │ + Classification     │
ProviderPayment          └──────────┬───────────┘
                                    ↓
                              Reconciliation
                                  Result
```

Paystack-specific fields and behavior remain outside the core domain.

## 3. Core Domain Objects

### 3.1 MerchantPayment

Represents a merchant-side payment record after input mapping.

```text
merchant_reference : string | absent
amount             : integer
currency           : CurrencyCode
status             : CanonicalPaymentStatus | absent
occurred_at        : Timestamp | absent
merchant_record_id : string | absent
```

Invariants:

- `merchant_reference` is required for deterministic reference matching but may be absent in the source and then produces `MISSING_REFERENCE`.
- `amount` is represented in integer minor units.
- `currency` must be valid and supported by the configured input/provider boundary.
- `status` is optional.
- `occurred_at` is optional.
- `merchant_record_id` is recommended for traceability but is not the matching key.

### 3.2 ProviderPayment

Represents a provider transaction after provider-specific mapping.

```text
reference    : string | absent
amount       : integer
currency     : CurrencyCode
status       : CanonicalPaymentStatus | absent
occurred_at  : Timestamp | absent
provider_id  : string | absent
```

Rules:

- Provider status is optional at the domain boundary.
- A provider record without status remains valid if all required fields for the applicable reconciliation operation are otherwise valid.
- Provider-specific raw fields do not belong in the core matching contract unless deliberately promoted into the provider-neutral domain.

### 3.3 NormalizedPayment

Represents a comparison-ready payment event.

```text
reference         : string | absent
amount            : integer
currency          : CurrencyCode
status            : CanonicalPaymentStatus | absent
occurred_at       : Timestamp | absent
source            : merchant | provider
source_id         : string | absent
source_attributes : SourceAttributes
```

`NormalizedPayment` must not contain provider-specific business rules.

## 4. Source Attribute Preservation

Source values relevant to explaining a reconciliation result but not part of canonical matching semantics may be preserved as source attributes.

Example:

```text
source_attributes:
  original_status: "COMPLETED"
```

Rules:

- Raw source values must not override canonical values.
- Raw values must not become matching keys unless a later domain decision explicitly promotes them.
- Provider-specific semantics remain in the adapter.
- Reconciliation results may expose preserved source attributes for investigation.

## 5. Matching Concepts

### 5.1 MatchCandidate

Represents a possible correspondence between one merchant payment and one provider payment.

```text
merchant_payment : MerchantPayment
provider_payment : ProviderPayment
```

A candidate is established only through deterministic exact-reference matching.

No fuzzy or probabilistic candidate generation exists in MVP.

### 5.2 MatchResult

Represents the final reconciliation result.

```text
outcome
merchant_record
provider_record
discrepancy_codes[]
validation_notes[]
source_attributes
```

The top-level `outcome` is separate from individual discrepancy and validation codes.

## 6. Reconciliation Outcome Model

The top-level outcome is exactly one of:

```text
MATCH
DISCREPANCY
UNRESOLVED
HELD_AMBIGUOUS
INPUT_ERROR
MISSING_PROVIDER_RECORD
UNMATCHED_PROVIDER_RECORD
MISSING_REFERENCE
```

Rules:

- `MATCH` means a unique correspondence exists and all applicable validations pass.
- `DISCREPANCY` means at least one confirmed discrepancy exists.
- `UNRESOLVED` means no confirmed discrepancy determines the result, but one or more required comparisons cannot be conclusively evaluated.
- `HELD_AMBIGUOUS` means safe one-to-one correspondence cannot be established because of duplicate/conflicting candidates.
- `INPUT_ERROR` means the record cannot enter reconciliation as a valid canonical input.
- `MISSING_PROVIDER_RECORD` means a valid merchant record has no provider counterpart.
- `UNMATCHED_PROVIDER_RECORD` means a valid provider record has no merchant counterpart.
- `MISSING_REFERENCE` means a record cannot participate in exact-reference matching because its reference is absent or unusable.

### Mixed discrepancy + unresolved results

A confirmed discrepancy takes precedence at the top-level outcome.

Example:

```text
outcome:
  DISCREPANCY

discrepancy_codes:
  AMOUNT_MISMATCH
  STATUS_UNRESOLVED
```

`STATUS_UNRESOLVED` remains an individual validation code/note; it does not replace the confirmed discrepancy outcome.

If there is no confirmed discrepancy but one or more validations are unresolved, the top-level outcome is `UNRESOLVED`.

## 7. Discrepancy and Validation Codes

Initial discrepancy codes:

```text
AMOUNT_MISMATCH
CURRENCY_MISMATCH
STATUS_MISMATCH
TEMPORAL_ANOMALY
DUPLICATE_MERCHANT_RECORD
DUPLICATE_PROVIDER_RECORD
CONFLICTING_ATTRIBUTES
```

Validation/unresolved code:

```text
STATUS_UNRESOLVED
```

Record-state/input codes:

```text
MISSING_REFERENCE
INPUT_ERROR
HELD_AMBIGUOUS
```

### UNKNOWN vs UNKNOWN

If both source statuses are present but both map to canonical `UNKNOWN`, the status comparison produces:

```text
STATUS_UNRESOLVED
```

Two `UNKNOWN` statuses are never treated as a confirmed status match.

## 8. Canonical Payment Status

Initial canonical statuses:

```text
PENDING
SUCCESS
FAILED
CANCELLED
UNKNOWN
```

Rules:

- Source-specific status strings are mapped before comparison.
- A missing status remains absent and is not converted to `UNKNOWN`.
- `UNKNOWN` means a status value was supplied but could not be mapped.
- Known status vs known status with different canonical states produces `STATUS_MISMATCH`.
- `UNKNOWN` vs a known state produces `STATUS_UNRESOLVED`.
- `UNKNOWN` vs `UNKNOWN` produces `STATUS_UNRESOLVED`.
- Original source status values may be retained in `source_attributes`.
- Actual Paystack status mappings require evidence validation before implementation.

## 9. Currency Model

Currency is explicit on every valid normalized payment.

```text
amount   : integer
currency : CurrencyCode
```

Rules:

- No floating-point arithmetic for monetary comparison.
- Valid/comparable currencies that differ produce `CURRENCY_MISMATCH`.
- Unsupported or invalid currency is rejected as `INPUT_ERROR` before reconciliation.
- Exact supported Paystack currency/subunit behavior requires external validation before implementation.

## 10. Reference Model

The merchant-side `merchant_reference` is the primary matching key against the provider `reference`.

This is the **primary matching key**, not a database primary key.

Rules:

- Matching is exact-reference only.
- Missing, empty, or whitespace-only references produce `MISSING_REFERENCE`.
- Multiple records sharing an expected-unique reference create a duplicate condition.
- The engine never arbitrarily selects among duplicate candidates.

## 11. Timestamp Model

`occurred_at` is an optional comparable timestamp.

Timestamp validation is configurable.

Rules:

- Both sides must provide comparable timestamps for timestamp validation to run.
- A difference within configured tolerance produces no temporal discrepancy.
- A difference outside configured tolerance produces `TEMPORAL_ANOMALY`.
- Missing timestamp data makes timestamp validation unavailable rather than failed.
- Timestamp comparison is never the primary matching key.
- No default tolerance is frozen until evidence validation establishes one.

## 12. Validation Applicability and Precedence

A validation is applicable only when:

1. the validation is enabled by reconciliation configuration; and
2. the required comparable information exists and is valid on both sides.

Examples:

- No merchant status → status validation unavailable.
- No merchant timestamp → timestamp validation unavailable.
- Invalid currency → input error before reconciliation.
- Valid currencies on both sides but different → currency mismatch.

### Input-error precedence

Input validation occurs before reference classification and reconciliation validation.

Therefore, if a source record contains an invalid/unsupported currency and also has a missing reference:

```text
outcome = INPUT_ERROR
```

The record does not proceed to `MISSING_REFERENCE` classification or normal matching.

Unavailable validation must not be silently converted into a mismatch.

## 13. Duplicate and Ambiguity Model

Duplicate detection occurs before normal one-to-one matching.

### Merchant duplicate

Multiple merchant records share the same `merchant_reference`.

Result:

```text
DUPLICATE_MERCHANT_RECORD
```

### Provider duplicate

Multiple provider records share the same provider `reference`.

Result:

```text
DUPLICATE_PROVIDER_RECORD
```

### Counterpart behavior

When one side is duplicated and the other side has one corresponding record:

```text
duplicated side → duplicate result
single counterpart → HELD_AMBIGUOUS
```

The counterpart is not incorrectly classified as missing/unmatched.

### Materially conflicting attributes

`CONFLICTING_ATTRIBUTES` applies only when duplicate candidates have two present, valid, comparable material values that disagree.

Missing/unavailable values do not count as conflicting.

`UNKNOWN` values do not count as conflicting merely because they differ from a known value.

No automatic pairing is performed for duplicate candidates.

## 14. Reconciliation Evaluation

Conceptual evaluation flow:

```text
1. Validate source records
2. Detect duplicate identities
3. Detect missing/unusable references
4. Locate exact-reference candidate
5. Establish whether correspondence is unique
6. Run all applicable validations
7. Collect all discrepancy/unresolved codes
8. Produce final reconciliation result
```

The engine does not use first-failure semantics.

A single correspondence may produce multiple codes.

Example:

```text
outcome:
  DISCREPANCY

codes:
  AMOUNT_MISMATCH
  CURRENCY_MISMATCH
  STATUS_MISMATCH
  TEMPORAL_ANOMALY
```

## 15. ReconciliationReport

Represents the complete output of one reconciliation run.

```text
summary
results[]
```

The summary should support at least:

```text
total records
matched
discrepancies
held/ambiguous
unresolved
input errors
missing provider records
unmatched provider records
counts by discrepancy code
```

Individual results must retain enough information to explain:

- which merchant record was evaluated;
- which provider record was evaluated, if any;
- what outcome occurred;
- which discrepancy codes apply;
- which validations were unavailable;
- relevant source identifiers;
- relevant preserved source attributes.

Exact report serialization remains an architecture/API concern.

## 16. Domain Invariants

The canonical model must preserve:

1. Matching is deterministic.
2. Exact reference is the only MVP matching strategy.
3. Duplicate candidates are never arbitrarily paired.
4. Monetary values use integer minor units and explicit currency.
5. Provider-specific business logic does not enter the core engine.
6. Missing information is distinguished from conflicting information.
7. Unknown status is distinguished from missing status.
8. Input errors are distinguished from reconciliation discrepancies.
9. Multiple discrepancies are preserved.
10. Timestamp validation does not become a hidden matching key.
11. Identical normalized inputs and configuration produce identical results.
12. A reconciliation result is explainable from its input records, preserved source attributes, and configuration.

## 17. Domain-to-Adapter Boundary

The core domain expects normalized provider-neutral concepts.

The Paystack adapter is responsible for:

- fetching/reading provider records;
- translating provider-specific fields;
- translating provider statuses;
- converting provider amounts into canonical minor units;
- validating supported provider currencies;
- preserving provider identifiers and relevant source attributes.

The core engine is responsible for:

- matching;
- validation;
- discrepancy classification;
- reconciliation result generation.

## 18. Domain-to-Output Boundary

The reconciliation engine produces domain results.

The CLI/output layer transforms those results into:

- human-readable output;
- machine-readable output.

Formatting decisions do not alter domain semantics.

## 19. Input Error Boundary

Invalid source records are rejected before they enter normal reconciliation.

Examples:

```text
unsupported currency
invalid amount representation
structurally invalid required input
```

Such records may be represented in the reconciliation report as `INPUT_ERROR` results, but they do not participate in matching.

The exact error object and ingestion pipeline are deferred to architecture.

## 20. Explicitly Deferred

The canonical model does not freeze:

- package structure;
- database/persistence technology;
- Prisma;
- PostgreSQL;
- Redis;
- cloud infrastructure;
- CLI formatting;
- API transport;
- web dashboard;
- hosted SaaS;
- fuzzy matching;
- settlement reconciliation;
- bank reconciliation;
- full refund lifecycle;
- chargeback/dispute reconciliation.

## 21. External Evidence Requirements

Before implementation, validate:

1. Paystack status mapping.
2. Paystack supported currency/subunit behavior.
3. Reliability of the Paystack transaction reference relationship in the intended workflow.
4. Evidence-based timestamp tolerance/default.

External evidence may refine provider-adapter behavior but must not silently change the provider-neutral core domain.

## 22. Version and Authority

This document supersedes:

```text
CANONICAL-DOMAIN-MODEL.md v0.1
```

Only this v0.3 document should be treated as the current canonical domain model.

The domain model remains subordinate to:

```text
AGENTS.md
JARVIS-OPERATING-SYSTEM.md
domain manuals
PROJECT.md
```

and must not silently contradict higher-level instructions.

## 23. Gate Status

**DOMAIN MODEL FROZEN FOR ARCHITECTURAL DESIGN**

The model has:

- passed the 20-scenario validation;
- passed canonical-model pressure testing;
- resolved the identified non-blocking ambiguities;
- explicitly defined input-error precedence;
- explicitly defined `UNKNOWN` + `UNKNOWN`;
- preserved provider-neutral source attributes;
- kept implementation technology outside the domain.

Architecture may now be designed from this model.

The remaining Paystack evidence requirements are provider-adapter validation tasks and must be verified before implementation commitments are made.
