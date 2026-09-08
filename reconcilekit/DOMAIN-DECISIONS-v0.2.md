# ReconcileKit — Domain Decisions

**Version:** 0.2  
**Status:** Decision draft — Gate 1 resolution  
**Purpose:** Resolve the domain ambiguities exposed by synthetic validation before freezing the canonical model.

## Decision 1 — Missing References

A payment record without a usable matching reference is classified as `MISSING_REFERENCE` and is not eligible for deterministic reference matching.

Rules:

- A reference is unusable when it is absent or empty after normalization.
- Whitespace-only references are treated as missing.
- No fuzzy or probabilistic matching is attempted in MVP.
- The record remains in the reconciliation report.
- `MISSING_REFERENCE` is distinct from `MISSING_PROVIDER_RECORD`.

## Decision 2 — Duplicate Definition

A duplicate is more than one record on the same side sharing the same reconciliation identity where that identity is expected to be unique.

For MVP:

- Merchant-side uniqueness is based on `merchant_reference`.
- Provider-side uniqueness is based on provider transaction `reference`.
- Duplicate detection occurs before normal one-to-one matching.
- No record is arbitrarily paired when the reference has multiple candidates.

### Counterpart disposition

If one side contains a duplicate reference and the other side contains a single record with that reference:

- The duplicated side receives `DUPLICATE_MERCHANT_RECORD` or `DUPLICATE_PROVIDER_RECORD`.
- The single counterpart is placed in a **held/ambiguous** state and is not classified as `MISSING_PROVIDER_RECORD` or `UNMATCHED_PROVIDER_RECORD`.
- The report must preserve the relationship so the user can investigate it.

This prevents an ambiguity created on one side from being incorrectly reported as absence on the other side.

## Decision 3 — Duplicate References with Conflicting Attributes

When duplicate records share a reference but have conflicting material attributes:

- Do not automatically pair any duplicate with the provider record.
- Preserve all duplicate records.
- Classify the duplicated side with its duplicate code.
- Add `CONFLICTING_ATTRIBUTES` as a detail when material attributes conflict.
- The provider/counterpart record remains held/ambiguous rather than being arbitrarily paired.

Example:

```text
Merchant:
REF-8 → 20000 NGN
REF-8 → 25000 NGN

Provider:
REF-8 → 20000 NGN
```

Expected high-level result:

```text
Merchant side:
DUPLICATE_MERCHANT_RECORD
detail: CONFLICTING_ATTRIBUTES

Provider side:
HELD_AMBIGUOUS
```

## Decision 4 — Multiple Simultaneous Discrepancies

A reconciliation result may contain multiple discrepancy codes.

The engine must not stop at the first failed validation.

Conceptual flow:

```text
match candidate
      ↓
run applicable validations
      ↓
collect discrepancy codes
      ↓
produce reconciliation result
```

Example:

```text
AMOUNT_MISMATCH
CURRENCY_MISMATCH
STATUS_MISMATCH
TEMPORAL_ANOMALY
```

The result should preserve all applicable discrepancies.

A clean one-to-one match has no discrepancy codes.

## Decision 5 — `CONFLICTING_ATTRIBUTES`

`CONFLICTING_ATTRIBUTES` is a structural ambiguity indicator, not a generic replacement for ordinary mismatches.

Use it when:

- multiple records share one reconciliation identity and their material attributes conflict; or
- the engine cannot establish a unique correspondence because conflicting candidate records exist.

Do not use it merely because a single matched pair has an amount, currency, or status mismatch. Those retain their specific discrepancy codes.

## Decision 6 — Missing Status

Missing status is different from an unknown status.

If the merchant record does not contain a status:

- status validation is unavailable;
- do not classify the record as `STATUS_MISMATCH`;
- do not convert the absence into `UNKNOWN`;
- report that status validation was unavailable.

If status validation is explicitly required by configuration and the field is absent, the report should identify the unavailable validation without inventing a mismatch.

## Decision 7 — Unknown Status Mapping

`UNKNOWN` means a status value was supplied but could not be mapped to a canonical state.

Initial canonical states:

```text
PENDING
SUCCESS
FAILED
CANCELLED
UNKNOWN
```

If one side is `UNKNOWN` and the other is a known state:

- do not classify it as a confirmed `STATUS_MISMATCH`;
- classify the status comparison as `STATUS_UNRESOLVED`;
- preserve the original source status values for investigation.

If both sides are `UNKNOWN`, they are not considered a status match.

`STATUS_UNRESOLVED` is a validation outcome, not evidence that the two payment states are definitively different.

The actual Paystack status mapping must be verified before implementation.

## Decision 8 — Currency

Currency is required for the canonical merchant and provider payment representations.

The MVP does not invent a universal currency list.

The Paystack adapter must explicitly validate the currencies it can interpret.

For an unsupported or invalid currency code:

- reject the record during input validation;
- do not pass it into reconciliation as a valid monetary record;
- do not classify the problem as `CURRENCY_MISMATCH`.

A `CURRENCY_MISMATCH` applies when both currencies are valid/comparable but differ.

The supported Paystack currency set must be verified against current provider documentation before implementation.

## Decision 9 — Amount Representation

Monetary amounts are represented internally as integer minor units plus an explicit currency.

Example:

```text
amount: 50000
currency: NGN
```

The core engine must not use floating-point arithmetic for monetary comparison.

Provider adapters are responsible for converting provider-specific representations into the canonical minor-unit representation.

The exact supported currency/subunit behavior must be verified against current Paystack documentation before implementation.

## Decision 10 — Reference Relationship

`merchant_reference` is the merchant-side field used to match against the provider transaction `reference`.

This is the **primary matching key**, not a database primary key.

Matching is exact-reference only in MVP.

If no usable reference exists, the record follows Decision 1.

The reliability of the reference relationship must be verified against the intended Paystack workflow before implementation.

## Decision 11 — Timestamp Rule

Timestamp comparison is a configurable validation, not a primary matching key.

Rules:

- `occurred_at` is optional at the base merchant input level.
- When both sides provide comparable timestamps, the configured tolerance is evaluated.
- A timestamp outside the configured tolerance produces `TEMPORAL_ANOMALY`.
- A timestamp difference within tolerance does not create a discrepancy.
- If one side lacks a timestamp, timestamp validation is unavailable rather than failed.
- Timestamp differences do not invalidate an otherwise valid reference match unless timestamp validation is enabled.

### Default tolerance

No default tolerance is frozen yet.

The initial implementation must require an explicit configured tolerance unless a later evidence-based decision establishes a default.

## Decision 12 — Classification Model

The reconciliation engine distinguishes between:

### Match

One-to-one correspondence exists and all applicable validations pass.

### Discrepancy

A correspondence exists but one or more applicable validations fail.

A discrepancy may contain multiple codes.

### Unresolved

A correspondence or validation cannot be conclusively classified because required information or mapping is unavailable.

### Held / Ambiguous

A record cannot safely be paired because duplicate or conflicting candidates prevent a unique correspondence.

### Input Error

A source record cannot be interpreted as a valid canonical payment record, such as an unsupported currency.

These categories must not be collapsed into one generic mismatch state.

## Decision 13 — Domain Object Responsibilities

Source representations remain separate from normalized domain representations.

Conceptual flow:

```text
Merchant raw input
      ↓
Merchant mapping
      ↓
MerchantPayment
      ↓
NormalizedPayment
      ↑
ProviderPayment
      ↑
Provider adapter
      ↑
Provider raw input
```

Provisional meanings:

```text
MerchantPayment
= mapped merchant-side payment record

ProviderPayment
= mapped provider-side payment record

NormalizedPayment
= comparison-ready canonical representation
```

Exact TypeScript interfaces remain a Gate 2 decision.

## Decision 14 — Match Evaluation

The engine should evaluate reconciliation deterministically:

```text
1. Validate source records
2. Detect duplicate reconciliation identities
3. Detect missing/unusable references
4. Locate exact reference candidate
5. Establish whether a unique correspondence exists
6. Run all applicable validations
7. Collect all discrepancy/unresolved codes
8. Produce final reconciliation result
```

The engine must never arbitrarily select a candidate.

## Decision 15 — Human-Readable Reporting

The MVP must provide:

1. machine-readable output; and
2. human-readable CLI output.

Human-readable output should summarize:

- total records
- matched records
- held/ambiguous records
- input errors
- unresolved results
- discrepancies by classification
- key identifying fields
- actionable explanations

Exact formatting remains an architecture/CLI concern.

## Decision 16 — CLI Input Formats

The initial CLI input formats are:

- CSV
- JSON

Programmatic TypeScript usage remains a supported capability of the package/API but is not treated as a separate CLI input format.

## Decision 17 — Synthetic Validation

The following scenarios must produce unambiguous expected outcomes before Gate 2:

1. Exact match
2. Missing provider transaction
3. Missing merchant record
4. Missing reference
5. Empty/whitespace reference
6. Duplicate merchant reference
7. Duplicate provider reference
8. Duplicate reference with conflicting attributes
9. Amount mismatch
10. Currency mismatch
11. Status mismatch
12. Missing merchant status
13. Missing merchant timestamp
14. Timestamp within tolerance
15. Timestamp outside tolerance
16. Multiple simultaneous discrepancies
17. Same reference with conflicting attributes
18. Unknown status mapping
19. Unsupported/invalid currency
20. Multiple provider candidates for one merchant reference

## Decision 18 — Architecture Gate

The project remains in domain-validation phase until the synthetic scenarios produce deterministic, explicitly specified outcomes.

Sequence:

```text
Domain Decisions
      ↓
Synthetic Scenarios
      ↓
Canonical Domain Model
      ↓
Architecture
```

No production implementation, package selection, database decision, or architecture freeze occurs before Gate 2.

## Decision Status

**PROVISIONAL — v0.2**

This version resolves the ambiguities identified by the first synthetic validation pass.

The following still require external evidence validation before becoming final implementation commitments:

- Paystack status mapping
- Paystack supported currency/subunit behavior
- reliability of the reference relationship in the intended workflow
- evidence-based timestamp tolerance/default

After those are validated, rerun the synthetic matrix. Gate 2 is passed only when all required scenarios have unambiguous expected outcomes.
