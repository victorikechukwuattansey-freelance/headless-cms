# ReconcileKit — Reconciliation Domain Specification

**Version:** 0.1  
**Status:** Draft for approval  
**Scope:** MVP

## 1. Domain Definition

ReconcileKit v1 reconciles merchant-provided payment records against Paystack transaction records.

The merchant-side dataset represents payment events recorded by the merchant's own application or system.

The MVP is a deterministic reconciliation toolkit. It does not move money, process payments, or act as a ledger.

## 2. Core Reconciliation Unit

The primary unit of reconciliation is a **payment event**.

A payment event has two representations:

- **Merchant Payment Record** — the merchant's record of the payment.
- **Provider Transaction Record** — the corresponding Paystack transaction.

ReconcileKit normalizes both representations into a common internal model before matching and validation.

## 3. In-Scope Event Type

### Payment

The MVP supports reconciliation of payment transactions.

Primary flow:

    Merchant records
          +
    Paystack transactions
          ↓
       Normalize
          ↓
       Match
          ↓
    Validate attributes
          ↓
    Classify discrepancies
          ↓
    Reconciliation report

## 4. Explicitly Out of Scope for MVP

- Settlement reconciliation
- Bank-statement reconciliation
- Full refund lifecycle reconciliation
- Chargeback/dispute reconciliation
- Payment initiation or processing
- Wallet/ledger functionality
- Money movement
- Merchant onboarding/KYC
- Hosted dashboard
- Mandatory cloud infrastructure

## 5. Merchant-Side Input Contract

The merchant-side record must represent a payment event and expose enough information for deterministic reconciliation.

Candidate minimum fields:

```text
merchant_record_id
merchant_reference
amount
currency
status
occurred_at
```

These fields remain provisional until validated against representative merchant schemas and reconciliation scenarios.

ReconcileKit should not require direct access to arbitrary merchant databases for the MVP.

Supported input formats may include CSV, JSON, or programmatic TypeScript input, provided they can be mapped to the canonical merchant record contract.

## 6. Provider-Side Input

The first provider adapter is Paystack.

The adapter translates Paystack transaction data into ReconcileKit's normalized provider representation.

The reconciliation engine must not contain Paystack-specific business logic.

## 7. Primary Matching Strategy

The first matching key is an exact transaction reference where the merchant-side record and provider record contain the corresponding reference.

Initial matching process:

1. Locate provider candidate by reference.
2. Verify candidate uniqueness.
3. Compare amount.
4. Compare currency.
5. Compare status.
6. Evaluate timestamp relationship.
7. Produce a reconciliation result.

Fuzzy or probabilistic matching is not part of the MVP.

## 8. Reconciliation Outcomes

- **Exact Match** — one provider transaction corresponds and applicable validations pass.
- **Missing Provider Record** — a merchant record has no corresponding provider transaction.
- **Unmatched Provider Record** — a provider transaction has no corresponding merchant record.
- **Amount Mismatch** — corresponding records have different amounts.
- **Currency Mismatch** — corresponding records have different currencies.
- **Status Mismatch** — corresponding records have inconsistent statuses.
- **Duplicate Merchant Record** — multiple merchant records violate the expected uniqueness relationship.
- **Duplicate Provider Record** — multiple provider records create an unexpected duplicate relationship.
- **Temporal Anomaly** — corresponding records fall outside the configured timestamp relationship/window.
- **Conflicting Attributes** — a reference identifies a candidate but material attributes conflict in a way that prevents clean classification.

## 9. Normalization Boundary

Provider-specific raw record → provider adapter → normalized provider payment.

Merchant-specific raw record → input mapping → normalized merchant payment.

The core reconciliation engine operates only on normalized domain objects.

## 10. Core Domain Concepts

```text
MerchantPayment
ProviderPayment
NormalizedPayment
MatchCandidate
MatchResult
Discrepancy
ReconciliationReport
```

Exact TypeScript interfaces are deliberately deferred until the scenarios below have been validated.

## 11. Required Synthetic Scenarios

Before freezing the canonical TypeScript model, demonstrate:

1. Exact match
2. Missing provider transaction
3. Missing merchant record
4. Amount mismatch
5. Currency mismatch
6. Status mismatch
7. Duplicate merchant record
8. Duplicate provider record
9. Timestamp anomaly
10. Same reference with conflicting attributes

Each scenario needs merchant input, provider input, expected match behavior, expected classification, and expected report output.

## 12. Determinism

Identical normalized inputs and configuration must produce the same result.

MVP matching must not use nondeterministic or opaque scoring.

## 13. Explainability

Every non-exact result must provide a machine-readable reason.

Example:

```json
{
  "status": "mismatch",
  "reason": "AMOUNT_MISMATCH",
  "merchantAmount": 50000,
  "providerAmount": 45000
}
```

The final schema remains provisional.

## 14. Paystack-Specific Boundary

Paystack-specific fields and API behavior belong inside the Paystack adapter.

The core domain remains provider-neutral so future providers can be added without rewriting the reconciliation engine.

## 15. MVP Success Condition

The domain specification is validated when:

- all required synthetic scenarios can be represented;
- every scenario has an unambiguous expected outcome;
- the canonical model does not require Paystack-specific fields;
- matching remains deterministic;
- discrepancies are explainable;
- provider-specific logic remains outside the core engine.

## 16. Open Questions

1. Which merchant-side fields are genuinely mandatory?
2. How should provider and merchant statuses map into a common state model?
3. What timestamp tolerance should be supported?
4. What constitutes a valid duplicate?
5. How should missing references be handled?
6. Should amount comparison operate only on integer minor units?
7. Which Paystack transaction fields should be retained in normalized output?
8. What should the public CLI output format be?
9. Which additional input formats belong in MVP?
10. What evidence from real merchant workflows should change this model?

## 17. Next Gate

Do not implement the reconciliation engine yet.

The next gate is **domain-model validation through synthetic scenarios**.

Once the scenarios are approved, freeze the canonical domain interfaces and proceed to architecture.
