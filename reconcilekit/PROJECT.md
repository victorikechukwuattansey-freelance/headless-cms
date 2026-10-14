# ReconcileKit — Project Blueprint

**Version:** 0.1  
**Status:** Draft  
**Project type:** Open-source TypeScript reconciliation toolkit  
**Current phase:** Core implemented and frozen (Phase 2). Storefront implemented (Phase 2). Phase 3A pilot complete — PASS WITH CONDITIONS, owner disposition recorded. Phase 3B (merchant CSV intake) and 3C (transaction-truth surface) accepted. 3D entry gate cleared. 3E (webhooks) and 3F (durable persistence) remain gated.

## 1. Project Identity

ReconcileKit is an open-source, CLI-first TypeScript toolkit for reconciling merchant-side payment records against payment-provider transaction records.

The first provider adapter is Paystack.

The core reconciliation engine must remain provider-neutral.

## 2. Problem

Payment records can exist in multiple systems. A merchant may have a record that a payment occurred while the payment provider has a different, missing, duplicated, or otherwise inconsistent representation.

Developers often need custom scripts or internal tooling to compare these datasets, identify discrepancies, and produce usable reconciliation reports.

ReconcileKit aims to provide a reusable foundation for that work.

## 3. Target User

The initial target user is a developer or technical team operating a payment-enabled application who needs to reconcile payment records with payment-provider records.

The MVP is developer-oriented rather than a merchant-facing hosted SaaS product.

## 4. Core Job-to-be-Done

Given:

- a merchant-provided payment dataset; and
- a payment-provider transaction dataset;

ReconcileKit should:

1. ingest the datasets;
2. normalize their records;
3. identify corresponding payment events;
4. validate relevant attributes;
5. classify discrepancies;
6. produce an explainable reconciliation result.

## 5. MVP Definition

The MVP focuses on **deterministic payment reconciliation**.

The first concrete use case is:

> Reconcile merchant-side payment records against Paystack transaction records using transaction references as the primary matching key and independently validating relevant financial, status, and temporal attributes.

The MVP should work locally and should not require a hosted service.

## 6. In Scope

### Core

- TypeScript reconciliation engine
- CLI interface
- Provider-adapter architecture
- Paystack transaction adapter
- Merchant-side input mapping
- Record normalization
- Deterministic matching
- Discrepancy classification
- Explainable reconciliation results
- Machine-readable output
- Human-readable report output
- Synthetic test datasets
- Automated tests

### Initial Provider

- Paystack transaction records

### Initial Input Strategy

The MVP may accept merchant and provider datasets through supported local formats such as CSV or JSON, provided they can be mapped into the defined domain contracts.

Direct access to arbitrary merchant databases is not required for MVP.

## 7. Explicit Non-Goals

The MVP does not build:

- payment processing
- money movement
- wallets
- banking infrastructure
- a general ledger
- merchant onboarding/KYC
- hosted merchant dashboard
- mandatory cloud infrastructure
- settlement reconciliation
- bank-statement reconciliation
- full refund lifecycle reconciliation
- chargeback/dispute reconciliation
- probabilistic/fuzzy matching
- mandatory PostgreSQL
- mandatory Prisma
- Redis
- SaaS billing

These may be considered later only as separate validated product decisions.

## 8. Architectural Intent

The project must preserve a separation between:

```text
Provider-specific data
        ↓
Provider adapter
        ↓
Normalized domain representation
        ↓
Reconciliation engine
        ↓
Discrepancy classification
        ↓
Report/output layer
```

The reconciliation engine must not depend directly on Paystack-specific implementation details.

The architecture should permit additional providers to be added without rewriting the core reconciliation logic.

## 9. Open-Source Strategy

The MVP is intended to be open source.

The initial open-source layer is the reusable reconciliation toolkit and CLI.

Commercial or hosted capabilities are not part of the MVP and must not be introduced merely for monetization without separate validation.

## 10. Success Criteria

The MVP is successful when:

1. A developer can install and run the CLI locally.
2. Merchant and provider datasets can be supplied through supported input formats.
3. Both datasets can be normalized into the canonical domain representation.
4. Deterministic matching produces repeatable results.
5. Discrepancies are classified consistently.
6. Non-exact results explain why they failed to reconcile.
7. The Paystack adapter remains isolated from the core reconciliation engine.
8. Synthetic scenarios cover the defined reconciliation cases.
9. Automated tests verify the reconciliation rules.
10. Another developer can understand and extend the provider-adapter boundary.

## 11. Validation Gates

### Gate 1 — Domain validation

Validate the domain specification and synthetic scenarios.

### Gate 2 — Canonical model

Freeze the domain interfaces only after the scenarios can be represented unambiguously.

### Gate 3 — Architecture

Derive the architecture from the validated domain model.

### Gate 4 — Package specification

Select dependencies and package boundaries after architecture is approved.

### Gate 5 — Implementation plan

Define implementation milestones before coding.

### Gate 6 — Implementation

OpenCode implements approved milestones and stops at defined review gates.

## 12. Current Assumptions

These are assumptions, not established facts:

- Transaction reference is an appropriate primary matching key for the initial Paystack use case.
- Merchant-side payment records can be mapped to a common canonical representation.
- CSV and/or JSON are sufficient initial local input formats.
- Deterministic reconciliation is sufficient for the first useful version.
- A local CLI provides enough value to validate developer adoption.
- Paystack is an appropriate first provider ecosystem for validation.

Each assumption must be validated before becoming an architectural commitment.

## 13. Domain Specification

The detailed reconciliation-domain rules live in:

`RECONCILIATION-DOMAIN.md`

That document is subordinate to this project blueprint and must remain consistent with it.

## 14. Current Phase

The project is **past pre-coding**. The Phase 2 validation gates were satisfied and the architecture is frozen; the storefront is implemented; Phase 3A is complete (PASS WITH CONDITIONS, owner disposition recorded); Phase 3B and 3C are accepted; the 3D entry gate is cleared; 3E and 3F remain gated. The seven entry conditions below were the Phase 2 gates and are retained for historical reference only.

- project scope approved;
- reconciliation domain validated;
- synthetic scenarios tested;
- canonical domain model approved;
- architecture approved;
- package specification approved;
- implementation plan approved.

## 15. Next Artifact

`ARCHITECTURE.md` was delivered and frozen in Phase 2 and remains the authoritative architecture document. The current authoritative references are the Phase 2 freeze (`docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md`), the canonical domain model (`CANONICAL-DOMAIN-MODEL-v0.3.md`), and the Phase 3 governance record (`docs/PHASE_3A_CONDITION_DISPOSITION_AND_PHASE_4_ENTRY_GATE.md`). Any new artifact must be derived from these, not invented independently.
