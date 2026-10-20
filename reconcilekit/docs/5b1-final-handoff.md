# ReconcileKit — Post-5B.1 Handoff

Durable handoff written at 5B.1f.1. It records the state after 5B.1e.4 and
the work that remains in 5B.1f. Every project fact below is sourced from
`reconcilekit/docs/`, git history, or current source.

## §1 — Project at a glance

- ReconcileKit is a CLI-first TypeScript reconciliation engine plus a
  storefront simulator.
- Repo root: `C:\Users\1040 G8\Documents\jarvis-demo`.
- Current phase: **5B is COMPLETE** as of 5B.1e.4 (`ddc807e`). The next phase
  (5C or 5D) opens per `PHASE_5_OPENING.md`.
- Test baselines: storefront **606 / 606**, core **213 / 213**.

## §2 — Phase history

| Phase                | Status   | Representative commit | Delivered                                                                                                   |
| -------------------- | -------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2                    | Complete | `eba3750`             | Core engine and storefront marketplace pilot; 2A–2K accepted in `PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md` |
| 3                    | Complete | `1fb6a86`             | 3A–3D accepted; 3E and 3F deferred with reasons in `PHASE_3_CLOSURE.md`                                     |
| 4                    | Complete | `09226d6`             | CI, core distribution, consumer README, and publishing procedure in `PHASE_4_CLOSURE.md`                    |
| 5 opening            | Open     | `8c47494`             | 5A–5D defined; sequencing and freeze posture in `PHASE_5_OPENING.md`                                        |
| 5A                   | Complete | `8cf13fa`             | Authentication and tenancy: identity, sessions, organizations, and route protection                         |
| 5B.1a                | Complete | `d3c4868`             | Prisma schema, initial migration, and Postgres 17.2 Compose service                                         |
| 5B.1b                | Complete | `3130b26`             | Repository layer for all 29 live store kinds                                                                |
| 5B.1c (1a–1k span)   | Complete | `50f2c9b`             | 28 live schema tables migrated; closed at 634 tests                                                         |
| 5B.1d                | Complete | `1ca4df5`             | Stale wallet reads fixed and dead store parameters narrowed; 634 tests                                      |
| 5B.1e (e.1–e.4 span) | Complete | `ddc807e`             | JSONL retirement; 634 → 606 tests; payments split and phase closure docs                                    |

## §3 — Frozen boundaries

Unchanged from the prior handoff:

- `reconcilekit/src/**`
- `wallet.ts`
- `ids.ts`
- `marketplace/types.ts`
- `demo-scenarios.ts` — per-scenario customers are intentional
- frozen contracts

`docs/` is not frozen. Scope documents live there and are append-only per §14
discipline.

## §4 — Baselines

| Runner     | Command    | Expected  |
| ---------- | ---------- | --------- |
| Core       | `npm test` | 213 / 213 |
| Storefront | `npm test` | 606 / 606 |

`docs/5b1e-closure.md` records the trajectory: 632 → 606 across 5B.1, with 2
tests added and 28 removed. Green means no regression from these counts.

## §5 — Current phase (5B.1f)

| Increment | Status             | Scope                                                                         |
| --------- | ------------------ | ----------------------------------------------------------------------------- |
| f.1       | Complete (320fa22) | Handoff consolidation and payments-split diagram fix; docs only               |
| f.2       | Complete (ee57ee7) | T7.11 `test:clean` + T7.13 BOM helper; config and scripts                     |
| f.2b      | Deferred           | T5.1 ESLint TS; pre-flight complete; dispatch pending TS-version verification |
| f.3       | Current            | `PHASE_5_OPENING` §7 amendment + handoff §5 fix; docs only                    |
| f.4       | Optional           | Postgres concurrency test decision; test                                      |

## §6 — In-flight

Empty. All 5B.1 increments closed.

## §7 — State at handoff

- HEAD: the f.1 commit on top of `ddc807e`; confirm the exact hash with
  `git log -1 --format='%H %s'` (the parent must be `ddc807e`).
- Storefront 606 / 606.
- Core 213 / 213.
- `git status --short -- reconcilekit/` → empty.
- Local gates green at f.1: typecheck, lint, `format:check`.
- CI is green only when the workflow run for the f.1 commit is green. Check
  the run; do not infer CI from the local gates.

## §8 — Exact next action

If 5B.1f.1–f.4 all closed: 5B is complete; open Phase 5C or 5D per
`PHASE_5_OPENING`. If 5B.1f is in progress: read §5 for the current increment.

## §9 — 5B closure summary

### 5B.1c

Migrated 28 live schema tables to the repository layer across 1a–1k. The phase
closed at 634 tests, after D1 ledger-id uniqueness at 1e and the missing-pack
receipt path at 1f.3. No production JSONL readers remained for migrated kinds.
Pre-flight records are `5b1c-1f-preflight-v2.md`, `5b1c-1g-preflight.md`,
`5b1c-1g4-preflight.md`, and `5b1c-1k-preflight.md`.

### 5B.1d

Fixed two stale wallet-ledger reads in tests and narrowed two dead store
parameters. The test count stayed at 634. The record is
`docs/5b1c-1d-preflight.md`.

### 5B.1e

Migrated notifications at e.1, dropped the catalog repositories and their tests
at e.2 (634 → 621), and retired the JSONL persistence layer at e.3 (621 → 606).
e.4 added the payments-split and closure documents. The required test decrease
is explained in `docs/5b1e-closure.md`; no replacement Postgres concurrency
tests were added.

### Durable record

`docs/5b1e-closure.md` is the authoritative closure record. The detailed
inventories and audit tables remain in the pre-flight documents.

## §10 — Recorded decisions

All prior decisions carry forward unchanged:

- Per-module increments.
- Wide-type changes as the headline of their increment.
- Per-scenario customers are intentional.
- `payments` / `marketplace_payments` are never merged.
- `Prisma.DbNull` is used for JSON-null.
- Injected `RepositoryClient`.
- `insert` is upsert on id (decision #8).
- `WALLET_FIXED_TIMESTAMP` keeps demo behavior deterministic.
- Production-alive means reachable from ANY shipped entry point (T7.5).
- Atomic source and test changes for signature changes (T7.6).
- Greenfield migrations — no JSONL backfill (T7.11).

## §11 — Files touched (this phase)

Full file list: `git log --stat 8c47494..HEAD` (5B.1 range).

## §12 — Commits from the current session

Only the f.1 commit exists in this session:

```text
docs(5b1f): post-5B.1 handoff + payments-split diagram fix
```

Its parent is `ddc807e` (5B.1e.4).

## §13 — Repo state

- Untracked, must remain untracked: pre-existing monorepo files, including
  `AGENTS-BACKUP.md`, `_open-canva/` design, theme, and export additions,
  `ar-product-assistant/`, `headless-cms/`, `landing-pages/` additions,
  `n8n-lead-recovery/` report and fixture additions, `prisma.config.ts`,
  `prisma/`, `saas-boilerplate/` image, `kaya-renovations/` image,
  `workflows/archive/`, and `landing-check-hero.png`.
- Modified but unstaged, must be preserved: root `package.json`,
  root `package-lock.json`, `.gitignore`,
  `agency-os/package-lock.json` (deleted), and
  `workflows/lead-recovery-engine/measurement/FINDINGS.md`.
- Under `reconcilekit/`: clean.

## §14 — Guard commands

| From                       | Commands                                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| `reconcilekit/`            | `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check` |
| `reconcilekit/storefront/` | `npm test`, `npm run typecheck`                                         |

Counts: core 213, storefront 606.

## §15 — Standing rule

Green means: core 213/213, storefront 606/606 (or higher), both typechecks
pass, ESLint passes, `format:check` passes, CI is green, and the consumer smoke
test passes.

## §16 — Open questions

- `findByCustomer` tiebreak (open since 1e).
- Postgres concurrency coverage: accept the retired class, or add 1–2 tests at
  f.4.
- Phase 5C (webhooks) vs 5D (second PSP adapter) priority — owner decision.

## §17 — What NOT to do next

- Do not reopen D2.
- Do not touch frozen boundaries (`ids.ts`, `wallet.ts`, `marketplace/types.ts`,
  `demo-scenarios.ts`, core `src/**`).
- Do not start 5C or 5D before 5B.1f closes.
- Do not cite line numbers from memory (T4.1).
- Do not assume a fact from a call site without schema verification (T4.10 —
  added at e.4).
- Do not add `list()` speculatively (T2.1).
- Do not skip `format:check` before commit (T5.2, T7.13).
- Do not reconstruct commit bodies (T7.2).
- Do not amend past commits except HEAD-message-only factual corrections.

## §18 — Lessons consolidated

The owner-carried 5B.1 handoff's §18 is consolidated here by theme. Synonymous
lessons are merged with their origins noted; none are dropped.

### T1 — Migration mechanics

- **T1.1 — Canonical id discipline.** Persisted identifiers keep their frozen
  formats and meanings through a migration; do not rewrite them.
- **T1.2 — Truncated-prefix ids must digest the full input.** A readable slug
  is truncated, but the digest covers the full value so distinct inputs cannot
  collide.
- **T1.3 — FK-value audit before migration.** Audit the value each FK will
  carry, not only its type.
- **T1.4 — Read+write cycles migrate together.** Repoint paired reads and
  writes in the same increment or the cycle breaks.
- **T1.5 — Child-before-parent ordering.** Order writes parent-first; fix a
  child-before-parent write before its FK is enforced.
- **T1.6 — Read-modify-write seq accepted.** The `transaction_events` seq race
  inherits the accepted read-modify-write semantics; document it and do not
  change the frozen id format.

### T2 — Repository design

- **T2.1 — `list()` only when `readAll` migrates.** Add a list method when a
  migrated read-all caller needs it, never speculatively.
- **T2.1b — `list()` may already exist.** Check the repository surface before
  adding a method.
- **T2.2 — `list()` ordering uses the schema timestamp field.** Preserve
  append-order semantics with the schema timestamp, not an arbitrary id order.
- **T2.3 — `insert` is upsert on id.** Replay and latest-wins depend on upsert,
  not create.
- **T2.4 — Shared deps field ≠ pass-through.** A shared dependency does not
  justify threading an obsolete store through every layer.
- **T2.5 — Deps safety gate audits reads AND writes.** A no-caller audit must
  cover both directions.

### T3 — Test discipline

- **T3.1 — Committed vs rolled-back matters.** A rollback-isolated test cannot
  see committed writes; use transaction-scoped reads.
- **T3.2 — Absolute counts → before/after deltas.** When a test reads committed
  rows, assert the delta.
- **T3.3 — Append-only → latest-wins flips assertions.** Migrating an
  append-only record changes the expected assertion.
- **T3.3b — Append-count → upsert-count.** A count assertion becomes an
  upsert-count assertion.
- **T3.4 — Behavior-change-in-test is a bug fix; document it.** Fix the stale
  expectation and record why.
- **T3.5 / T7.15 (merged) — `withRollback` isolates writes, not reads.**
  Committed reads remain visible outside the transaction. Merged because the
  two lessons are synonymous.

### T4 — Task-writing discipline

- **T4.1 — Step 0 pre-flight plus pre-edit verification.** Gate the environment
  and verify the source before editing.
- **T4.2 — Line numbers are guides, not authority.** Re-grep before acting.
- **T4.3 — Shorthand construction greps.** Search the shorthand forms used to
  construct a value, not only the full name.
- **T4.4 — Cite reads AND writes.** An inventory that names only writes is
  incomplete.
- **T4.5 — Category rules' examples must fit.** An example must actually belong
  to the category it illustrates.
- **T4.6 — Paste the exact code the task cites.** The task must quote the
  source it relies on.
- **T4.7 — Schema facts need schema excerpts.** Show the model and relation,
  not a paraphrase.
- **T4.8 — “What does the caller do with the store besides forward it?”**
  Trace actual use before assuming pass-through.
- **T4.9 — Code snippets use actual identifiers.** No invented names.
- **T4.10 — Field presence ≠ FK status.** Verify `@relation` in the schema;
  a scalar column can be denormalized.

### T5 — Gate discipline

- **T5.1 — ESLint doesn't lint TS.** The current config covers JS only; treat
  the TS-lint gap as real.
- **T5.2 — WIP must be Prettier-clean at commit time.**
- **T5.3 — Storefront count moves only via regression tests.** Do not change
  the denominator without tests that justify it.

### T6 — Phase boundaries

- **T6.1 — Wide-type changes are the headline.** Announce the type surface
  change at the top of the increment.
- **T6.2 — Don't chase ripple into the next increment.** Stop at the scoped
  edge.
- **T6.3 — Migration diff must stay legible.** Keep the reviewable change set
  readable.

### T7 — Process

- **T7.1 — Trust git log, not handoff claims.**
- **T7.2 — Reported ≠ approved; commit bodies are verbatim.**
- **T7.3 — Amend only HEAD-message-only corrections.**
- **T7.4 — Pre-flight documents are durable artefacts.**
- **T7.5 — Production-alive = any shipped entry point.**
- **T7.6 — Atomic source+test for signature changes.**
- **T7.8 — Contract tests retire with the class they test.**
- **T7.9 — CLI integration tests are separate targets.**
- **T7.10 — Breaking CLI changes need three surfaces.**
- **T7.11 — Clean DB is a precondition.** Use a clean test database and a
  `test:clean` path.
- **T7.12 — Use `execFileSync` for CLI tests.**
- **T7.13 — `Out-File` adds a BOM in PowerShell.** Use a BOM-free writer.
- **T7.14 — Source narrowings land in the migration commit.**
- **T7.16 — A PowerShell profile can shadow the project `.env`.** Verify the
  active environment.

## §19 — Where a fresh agent starts

1. Read this handoff (`docs/5b1-final-handoff.md`) in full.
2. Read `PHASE_5B_DURABLE_PERSISTENCE_SCOPE.md`, `PHASE_5_OPENING.md`,
   `docs/5b1e-closure.md`, and `docs/5b1-payments-split.md`.
3. Read `docs/5b1c-1e-preflight.md` Part 5 (repo no-caller audit).
4. Verify HEAD matches §7. Confirm `git status` is clean under
   `reconcilekit/`.
5. Run the gates from §14. If green, proceed.
6. Read §18 (lessons) before writing any task.
7. Confirm 5B.1f status per §5. Do not start 5C or 5D until 5B.1f closes.
