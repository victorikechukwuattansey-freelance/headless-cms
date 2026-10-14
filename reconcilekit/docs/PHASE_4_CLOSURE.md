# Phase 4 — Closure

**Project:** ReconcileKit (Core + Storefront)
**Type:** Governance record (documentation only — no implementation, no source/test/config change)
**Date:** 2026-10-14
**Basis:** `PHASE_4_DISTRIBUTION_READINESS.md` §9 (Phase 4 closure criteria)
**Predecessor:** `PHASE_3_CLOSURE.md`
**Baseline authority:** `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` (frozen)

---

## 1. Decision

**Phase 4 is complete under §9 of the scoping document.**

The distribution-readiness subset of the freeze's §10 deferred list has been
delivered. The core is buildable, installable, usable from a fresh
environment, and publishable to npm — with a documented, verified procedure.
The standing guard is enforced by CI. Every other item the freeze deferred
remains deferred, unaltered by this phase.

Phase 4 opened **only** distribution readiness. It did not open auth,
tenancy, durable persistence (3F), webhooks (3E), billing, real PSP
integrations, FX, or production deployment.

## 2. Track status

| Increment                          | Objective                                                                              | Gate                                                      | Status                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **4A** — CI workflow               | Run the four standing guards on Linux from a fresh checkout                            | Green on first run                                        | **ACCEPTED** — first green run `136ba00`; current `.github/workflows/reconcilekit-ci.yml` |
| **4B** — Core package distribution | Build the core to a clean `dist/`; shape `package.json` for npm; verify publishability | 4B.1 build, 4B.2 shape, 4B.3 publishable, 4B.4 smoke test | **ACCEPTED** — `0b25de0`, `0ec6c82`, `518903e`, `5ebca58`                                 |
| **4C** — Consumer README           | A stranger-followable README with a working quick-start                                | Reader can complete quick-start from README alone         | **ACCEPTED** — `b0c7385`                                                                  |
| **4D** — Publishing procedure      | Pre-flight checklist, dry-run gate, versioning, rollback                               | A dry-run publish produces a working tarball              | **ACCEPTED** — `a9c0209`                                                                  |

## 3. What Phase 4 delivered

**Code (core only, no storefront changes):**

- `reconcilekit/tsconfig.build.json` — TS 7 `tsc` build config with explicit
  `rootDir`, `rewriteRelativeImportExtensions`, `declaration` + `declarationMap`
  - `sourceMap` enabled.
- `reconcilekit/package.json` — `bin` at `./dist/cli/index.js`, `license: MIT`,
  `files: ["dist", "README.md", "examples"]`, `publishConfig`, `prepublishOnly`
  guard, `prebuild` clean, `prepack` build, `repository`, `keywords`.
- `reconcilekit/eslint.config.js` — Node globals declared for `.js/.cjs/.mjs`.
- `reconcilekit/scripts/smoke.mjs` — consumer install smoke test.
- `reconcilekit/examples/quickstart/{merchant.csv,provider.json}` — packaged
  fixtures referenced by the README.
- `.github/workflows/reconcilekit-ci.yml` — CI covering core and storefront.

**Documentation:**

- `reconcilekit/README.md` — consumer-facing.
- `reconcilekit/PUBLISHING.md` — publishing procedure.
- `reconcilekit/docs/PHASE_4_DISTRIBUTION_READINESS.md` — Phase 4 scope.

## 4. Standing guard

After Phase 4, the guard is enforced by CI on `ubuntu-latest` from a fresh
`npm ci` on push and PR, path-filtered to `reconcilekit/**`:

| Check                   | Enforced by         | Result                                                           |
| ----------------------- | ------------------- | ---------------------------------------------------------------- |
| Root tests (recursive)  | CI job `core`       | **677/677**                                                      |
| Storefront tests        | CI job `storefront` | **464/464**                                                      |
| Root typecheck          | CI job `core`       | PASS                                                             |
| Storefront typecheck    | CI job `storefront` | PASS                                                             |
| ESLint                  | CI job `core`       | PASS (JS/MJS/CJS only; TS coverage blocked on upstream — see §7) |
| Prettier `format:check` | CI job `core`       | PASS                                                             |

Local runs remain a developer convenience. The authoritative source of
"green" is the CI run for the commit under consideration.

**Consumer smoke test is manual** (`node scripts/smoke.mjs`), per the Phase 4
scope decision. It packs the current tree, installs the tarball into a fresh
consumer directory, and verifies `npx reconcilekit --help` and a real
reconciliation both work. It is not run in CI; adding it to CI is a documented
follow-up (§7).

## 5. Verifiable state after Phase 4

- `reconcilekit/` is buildable: `npm run build` produces a clean `dist/` with
  the correct layout, shebang preserved, `.ts` specifiers rewritten to `.js`.
- `reconcilekit/` is publishable: `npm publish --dry-run` completes without
  the `bin` auto-correct warning that npm emits for an invalid `bin` value.
- `reconcilekit/` is installable: the tarball installs into a fresh consumer
  project and exposes a functioning `reconcilekit` command.
- `reconcilekit/` is documented: the README's quick-start works from
  copy-paste alone, using the shipped `examples/quickstart/*` fixtures.
- The standing guard is externally enforced.

No item in the freeze's §10 deferred list has been silently pulled into scope.

## 6. Frozen boundaries preserved

The following frozen decisions were **not** touched during Phase 4
(`PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` §4–§9):

- Provider-neutral boundary (freeze §4.1).
- Payment / ledger / fulfillment truth separation (freeze §4.2, §6).
- Single matcher `reconcileRecords()` (freeze §4.3).
- Exact-reference matching only (freeze §4.4).
- Identifier hierarchy (`mk_txn_…` join anchor; evidence-only external
  references) (freeze §5).
- Wallet ledger authority and append-only semantics (freeze §4.5, §7).
- Gift-card secret masking (freeze §4.7).
- Ticket reservation ≠ issuance (freeze §4.8).
- Betting compliance gate (freeze §4.9).

No code path added by Phase 4 modifies `reconcilekit/src/**`. The build is
purely additive — a `tsconfig.build.json` that compiles what already exists.

## 7. Open items (recorded, not blocking closure)

| Item                                     | Source                 | Status                                                                                                                                   |
| ---------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript sources are linted as JS only | Audit §21 D2           | **BLOCKED ON UPSTREAM** — typescript-eslint peer range excludes TypeScript 7. Recorded in `PHASE_3_CLOSURE.md` §8.                       |
| Storefront README staleness              | Audit §21 D4           | Discharged — `6cebdc9`                                                                                                                   |
| `- Copy.md` duplicates                   | Audit §21 D5           | Discharged — deleted                                                                                                                     |
| Smoke test in CI                         | Phase 4 scope decision | **Manual by choice.** Re-evaluate when publish cadence picks up. Adding it is a one-job workflow change; the script is already portable. |
| Automated publish workflow               | `PUBLISHING.md` §8     | Not implemented. Manual publish only. Adding an automation token and a `workflow_dispatch` job is a separate, explicit increment.        |
| `reconcilekit` name ownership on npm     | `PUBLISHING.md` §0     | Unknown until first `npm view reconcilekit` is run. This is a one-time check, not an increment.                                          |

None of these blocks Phase 4 closure. All are recorded so a future reader
knows exactly what remains.

## 8. Deferred items — unchanged from Phase 3

Every item below remains deferred. None was opened by Phase 4.

- Authentication / authorization.
- Tenant / org isolation.
- Durable persistence (**3F** — `PHASE_3F_FINDINGS.md`).
- Provider webhook ingestion (**3E** — `PHASE_3E_FINDINGS.md`).
- Production deployment of the storefront.
- Billing.
- Real PSP integrations beyond Paystack.
- FX / currency conversion engine.
- Real money movement.

Any of these requires a separate decision and, where the freeze applies, the
freeze's §14 architecture-change procedure.

## 9. What closure does and does not authorize

**Does:** mark Phase 4 as complete under the scoping document's §9;
record the delivered artifacts; confirm the standing guard is CI-enforced;
reiterate that all freeze-§10 deferrals are still in force.

**Does not:** authorize `npm publish` (the procedure is documented, not
executed); authorize Phase 5 or any subsequent phase; reopen any frozen
decision; authorize 3E, 3F, auth, tenancy, billing, FX, real PSPs, or
production deployment; authorize the TypeScript-ESLint workaround that D2
would require.

Any of the above requires a separate decision by the owner.

## 10. Status

**PHASE 4 COMPLETE — tracks 4A / 4B / 4C / 4D accepted. Baseline verified in CI:
root 677/677, storefront 464/464, both typechecks + lint + format PASS.
Consumer smoke test passes. `npm publish --dry-run` completes clean.
Frozen architecture intact. Every freeze-§10 deferral remains in force.**
