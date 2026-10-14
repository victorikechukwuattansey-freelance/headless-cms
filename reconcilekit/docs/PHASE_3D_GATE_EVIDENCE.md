# Phase 3D — Entry Gate Evidence

**Project:** ReconcileKit (Core + Storefront)
**Type:** Governance evidence (documentation only — no implementation, no source/test/config change)
**Date:** 2026-10-13
**Basis:** `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §10 (3D entry gate: "≥1 real mismatch from 3A")

---

## 1. Purpose

Record the single artefact that satisfies the Phase 3D entry gate under the
strict reading (a **classified** discrepancy, not only `STATUS_UNRESOLVED`).

Phase 3A surfaced `STATUS_UNRESOLVED` — real, understood, but explicitly **not**
a classified `DISCREPANCY`. Classified discrepancy counts in both 3A runs were
zero. This document records a classified `DISCREPANCY` from real Paystack
test-mode data, produced by the frozen engine through unmodified code paths.

## 2. Source

- Provider reference: `RK-PILOT-006` (Paystack test mode)
- Provider Verify JSON: real `GET /transaction/verify/RK-PILOT-006` envelope
- Merchant input: contract-correct CSV, single row, one field deliberately
  changed (amount − 1 kobo) so the join succeeds and the amount disagrees

No file was committed to the repository. Raw inputs and outputs were kept under
`%TEMP%\reconcilekit-3d-gate\`. The secret was supplied only through the
environment variable mechanism; it was never printed by the CLI, never written
to a file, and is not recorded here.

## 3. Inputs

Provider Verify envelope (fields read by the engine, verbatim):

- `data.reference`: `RK-PILOT-006`
- `data.amount`: `125000`
- `data.currency`: `NGN`
- `data.status`: `success`
- `data.created_at`: `2026-09-11T08:01:37.000Z`
- `data.paid_at`: `2026-09-11T08:01:37.000Z`

Merchant CSV (exact bytes):

```csv
reference,amount,currency,status,occurred_at,source_reference
RK-PILOT-006,124999,NGN,SUCCESS,2026-09-11T08:01:37.000Z,
```
