# 5D.2.5 Pre-Flight — Simulated Unsealing (Change 2)

**Date:** 2026-10-22 (continued 2026-10-26)
**Branch / HEAD at preflight:** main / 60ceb32 (5D.3 committed)
**Scope:** Read-only pre-flight for Change 2 of the §14 change request. No source, test, or schema changes. Output: this file.
**Prior pre-flight scope claim:** "requires reopening of wallet.ts and 10+ file changes total."

This preflight corrects material errors in that claim and proposes a
narrower decomposition.

## Executive Summary

- **`wallet.ts` does NOT require a §14 reopening for the type widening.** It has zero reads of `.simulated` — only writes of literal `true` and type declarations. Widening the type from `true` to `boolean` is mechanical and behaviorally inert.
- **The type surface is 31 declarations, not 4.** Every domain type in `types.ts` has `readonly simulated: true`. The four-table framing (payment, attempt, transaction, event) describes the _storage_ question, not the _type_ question.
- **`simulated` is write-only in the codebase.** Exactly one consumer reads it (`ui/customer-pages.ts:658`, a receipt label). No reconcile logic, evidence serialization, audit export, or notification filter uses it.
- **Zero tests assert `simulated`.** All ~32 test occurrences are fixture constructors that compile unchanged under `boolean`.
- **Nothing today produces `simulated: false`.** Every write-site hardcodes `true`. `false` becomes producible only when 5D.4 (real provider) lands.

Recommended decomposition: (C) three increments, where the first is shippable now, the second is potentially zero-work, and the third is deferred to 5D.4.

## Part 1 — Semantic definition

The phase target is M1: `simulated` = "this record's provider interaction (if any) was served by a mock adapter, not a real API." Real provider → `false`. Mock provider → `true`. Non-provider records (users, sessions, orgs, memberships, notifications) have no provider origin; the field is vestigial and should be documented as such or removed.

Current code is M2 by accident: universal `true` on every domain type, read by exactly one UI label.

## Part 2 — Migration shape

**Recommended: A (explicit `simulated Boolean` column per table).**

| Option                                      | Verdict                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| A. Per-table column                         | Recommended for 5D.2.5a — survives real-provider mode without a second migration |
| B. `providerMode` enum at transaction level | More extensible but larger; deferred                                             |
| C. Derive from `providerId` prefix          | Cheapest but lies for future non-`prv_mock` providers — rejected                 |
| D. In `sourceAttributes` JSONB              | No clean backfill for existing rows — rejected                                   |
| E. Hybrid                                   | Over-engineered for current scope                                                |

Migration: `ALTER TABLE ... ADD COLUMN simulated BOOLEAN NOT NULL DEFAULT true;` for each of the four tables. Backfill is implicit via `DEFAULT true`.

## Part 3 — wallet.ts §14 reopening scope

**Verdict: NOT required for the type widening.**

| Line                      | Site                            | Category                       | Break under `boolean`?         |
| ------------------------- | ------------------------------- | ------------------------------ | ------------------------------ |
| 271                       | `readonly simulated: true`      | Type                           | No — widen mechanically        |
| 391, 437, 736, 1310, 1337 | `simulated: true`               | Writes                         | No — `true` is valid `boolean` |
| 403, 533                  | `simulated: "true"` in metadata | Writes (parallel string field) | No — different field           |

**Zero reads.** No conditional, no propagation, no behavior branch.

**Caveat:** the freeze doc lists `wallet.ts` under "Wallet lifecycle / ledger" (row 67). A §14 reopening may be _procedurally_ required for any edit, depending on owner interpretation. If the owner treats type widenings as out-of-scope for the freeze, no reopen needed. **Owner ruling requested** (see Surprises).

## Part 4 — Consumer impact

**Consumer count: 1.**

| Consumer        | File:line                  | What it does                                                 | Behavior change if false        |
| --------------- | -------------------------- | ------------------------------------------------------------ | ------------------------------- |
| Receipt display | `ui/customer-pages.ts:658` | `<dt>Simulated</dt><dd>${String(vm.receipt.simulated)}</dd>` | Shows "false" instead of "true" |

No reconcile decision, evidence round-trip, audit export, or notification filter reads `.simulated`. The field is dead weight today.

## Part 5 — Test impact

**Total `simulated: true` in tests: ~32 occurrences across 28 files. All fixture constructors. Zero assertions.**

If the type widens from `true` to `boolean`, **zero test files need to change.** `true` narrows to `boolean` — fixtures compile as-is.

Adding assertions that `false` is produced in real-mode is a 5D.4 concern, not 5D.2.5.

## Part 6 — Decomposition

**Recommended: (C) three increments.**

### 5D.2.5a — Type + storage foundation (shippable now)

- Widen 31 `readonly simulated: true` declarations to `readonly simulated: boolean` in:
  - `storefront/src/marketplace/types.ts` (27 declarations)
  - `storefront/src/marketplace/wallet.ts:271`
  - `storefront/src/marketplace/contracts.ts:177`
  - `storefront/src/marketplace/transactions.ts:124`
  - `storefront/src/ui/client.ts:188` (note: field is `isSimulated`, not `simulated`)
- Add `simulated Boolean NOT NULL DEFAULT true` to four tables: `marketplace_payments`, `marketplace_provider_attempts`, `marketplace_transactions`, `transaction_events`
- Update four repository mappers to read the column instead of hardcoding `true`: `marketplace-payments.ts:127`, `marketplace-provider-attempts.ts:128`, `marketplace-transactions.ts:118`, `transaction-events.ts:93`
- No write-site changes — writes stay `simulated: true`, storage holds the literal
- No test changes — fixtures compile as-is
- No consumer changes — the single receipt display works either way

### 5D.2.5b — wallet.ts §14 notification (contingent)

**Status (5D.2.5a close):** 5D.2.5b dissolved — owner ruling #1 confirmed type-only widen acceptable within 5D.2.5a. Not a separate increment.

Only if owner rules that any edit to a frozen file requires §14. Widening `wallet.ts:271` from `true` to `boolean` — zero behavior change. This could ship as part of 5D.2.5a with a one-line owner acknowledgment, or as a separate commit if the owner requires formal reopen.

### 5D.2.5c — Write-site pass-through (blocked on 5D.4)

Update ~20 write-sites in `src/marketplace/*.ts` to pass through `input.result.simulated ?? true`. Inert until a real provider can produce `false`. Deferred to 5D.4.

## Part 7 — Backfill

`true` for all existing rows. Every production row was written under mock mode. `true` is honest.

Do not use `providerId LIKE 'prv_mock%'` heuristics — the mock prefix is a convention, not an invariant, and real providers may not follow it.

Richer `simulation_origin` enum (`MOCK_PROVIDER | DEMO_MODE | MANUAL_TEST`) is deferred — the field has one reader and the change request defines `simulated` as boolean.

## Surprises

1. **Prior pre-flight overestimated `wallet.ts` risk** — the file has no reads, only writes of literal `true`. §14 reopening is likely a formality.
2. **The type surface is 6× larger than the four-table framing suggested** — 31 declarations across 5 files, not 4.
3. **`simulated` is write-only in the codebase** — one consumer, a receipt label.
4. **Two parallel `simulated` fields exist in `wallet.ts`** — `obj.simulated: true` (boolean) and `obj.metadata.simulated: "true"` (string in JSONB). The two representations are not synchronized and not currently used together.
5. **`contracts.ts` is partially unsealed** — line 77 declares `simulated: boolean` (unsealed by 5D.2), line 177 declares `simulated: true` (still sealed). 5D.2's work was partial within the file.
6. **`client.ts:188` uses `isSimulated`, not `simulated`** — a parallel field name that the change request doesn't mention. Ambiguity: should it be included in 5D.2.5a or scoped separately?

## Owner-ruling questions

1. **Freeze interpretation:** Does §14 reopening cover any edit to `wallet.ts` (including type widenings), or only behavioral changes? If the former, 5D.2.5b is a required sub-increment; if the latter, 5D.2.5a can include the wallet.ts:271 widen without procedural reopen.
2. **`isSimulated` on `client.ts:188`:** In scope for 5D.2.5a, or a separate increment? It is a parallel field name (prefix `is`) that appears only on the UI view-model. The change request speaks only to `simulated`, not `isSimulated`.
3. **Non-provider `simulated` fields** (`UserRecord`, `SessionRecord`, `OrganizationRecord`, `MembershipRecord`, `NotificationRecord`): widen to `boolean` and leave as dead `true`, or document as permanent demo-environment markers (i.e., these types are out of M1 scope and always `true`)? Recommendation: widen for consistency, note that they will never be `false`.

## Evidence index

- `storefront/prisma/schema.prisma:140-176` — `MarketplaceTransaction` (no `simulated` column)
- `storefront/prisma/schema.prisma:179-199` — `MarketplaceProviderAttempt` (no `simulated` column)
- `storefront/prisma/schema.prisma:201-223` — `MarketplacePayment` (no `simulated` column)
- `storefront/prisma/schema.prisma:290-305` — `TransactionEvent` (no `simulated` column)
- `storefront/src/marketplace/types.ts` — 24 `readonly simulated: true` declarations
- `storefront/src/marketplace/wallet.ts:271,391,403,437,533,736,1310,1337` — wallet.ts occurrences (zero reads)
- `storefront/src/marketplace/providers/contracts.ts:177` — still-sealed `readonly simulated: true`
- `storefront/src/ui/client.ts:188` — `isSimulated: true` parallel field
- `storefront/src/ui/customer-pages.ts:658` — sole `.simulated` consumer
- `storefront/test/db/repositories/*.test.ts`, `storefront/test/marketplace/*.test.ts` — ~32 `simulated: true` fixture occurrences, zero assertions
- `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md:67` — `wallet.ts` freeze entry
