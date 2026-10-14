# Phase 4 — Distribution Readiness

**Project:** ReconcileKit (Core + Storefront)
**Type:** Phase scoping document (planning deliverable — no implementation from this document alone)
**Date:** 2026-10-14
**Baseline authority:** `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` (frozen)
**Predecessor:** `PHASE_3_CLOSURE.md`
**Decision:** Phase 4 opens **only** the distribution-readiness subset of the
freeze's §10 deferred list. All other deferred items remain deferred.

---

## 1. Goal

Make the ReconcileKit **core** usable by someone who has never seen this
repository, without weakening any frozen decision.

Concretely: a stranger can install the package, run the CLI against two files,
get an explainable reconciliation, and understand the architecture from the
README — all verifiable from a fresh clone on Linux, in CI, without the
monorepo around it.

The storefront remains a demo pilot. It is not a distributable artifact.

## 2. Why this is the right Phase 4 opening

- **No gate override.** The freeze did not gate distribution behind a pilot
  finding. It was implicitly deferred by never having been done.
- **No frozen decision touched.** No matcher change, no identifier change, no
  wallet change. Packaging, CI, docs, and publish procedure are all outside
  `reconcilekit/src/**`.
- **Every other candidate benefits.** Auth, durable persistence, a second PSP
  — all want CI protecting them and a published core to build against.
- **Bounded.** The core is one package, one runtime dependency (`csv-parse`),
  and a domain layer with zero external imports. It is the cleanest thing in
  the repo to package.
- **It produces real evidence.** If a stranger can install and use the core,
  the toolkit is a toolkit. If they cannot, we learn exactly what is missing.

## 3. Tracks

Ordered. Each track has its own gate.

### 4A — CI (this increment)

GitHub Actions workflow that runs the four standing guards on push and PR:

- Core: `test`, `typecheck`, `lint`, `format:check`
- Storefront: `test`, `typecheck`

Path-filtered to `reconcilekit/**` and the workflow file itself. Runs on
`ubuntu-latest` (Linux). This is the piece that closes the audit's "no CI"
gap and makes every future "green" claim externally verifiable.

**Gate:** first run is green on Linux from a fresh checkout.

### 4B — Core package distribution readiness

Prepare `reconcilekit/package.json` and its build configuration for `npm
publish` — or explicitly decide not to publish, with reasons.

Work items (indicative, not exhaustive):

- `package.json` metadata: `license`, `repository`, `description`, `keywords`,
  `files`, `exports`, `publishConfig`.
- Build configuration. The core currently ships `.ts` files and relies on
  Node's type-stripping (Node ≥24). Distribution needs a decision:
  - **(a)** Continue shipping `.ts` and document the Node 24+ requirement.
  - **(b)** Add a `tsconfig.build.json` and compile to `.js` + `.d.ts` in
    `dist/`.
  - **(c)** Ship both.
    This is an **open decision** (see §5). 4B cannot complete without resolving
    it.
- Consumer-facing CLI behavior: verify `npx reconcilekit --help` and a real
  reconciliation work from a fresh install.

**Gate:** `npm pack --dry-run` produces a package that, when installed in a
clean directory, exposes a working `reconcilekit` binary and produces a
deterministic reconciliation report on the existing synthetic fixtures.

### 4C — Consumer documentation

A stranger-followable README at `reconcilekit/README.md`:

- What ReconcileKit is and is not (one paragraph).
- Install (exact command from 4B's packaging decision).
- Quick-start: reconcile two files; show the actual output.
- Architecture in one diagram plus one paragraph.
- Link to the frozen docs (`ARCHITECTURE.md`, `CANONICAL-DOMAIN-MODEL-v0.3.md`).

**Gate:** a reader who has never seen the repo can complete the quick-start
and understand the output without consulting internal docs.

### 4D — Publishing procedure

`PUBLISHING.md` with:

- Exact commands (`npm run build`, `npm pack`, `npm publish`).
- The dry-run checklist.
- Versioning policy (semver, one line).
- Rollback procedure (`npm deprecate` or a patch release).
- A note that the workflow publishes only on manual trigger.

**Gate:** a dry-run publish produces a tarball that installs cleanly and runs
the quick-start.

## 4. Out of scope (unchanged)

The following remain **deferred** and are **not** authorized by this Phase 4
opening:

- 3E (webhook ingestion) — deferred with evidence in `PHASE_3E_FINDINGS.md`.
- 3F (durable persistence) — deferred with evidence in `PHASE_3F_FINDINGS.md`.
- Authentication / authorization.
- Tenant / org isolation.
- Deployment of the storefront beyond local pilot.
- Billing.
- Real PSP integrations beyond Paystack.
- FX / currency conversion.
- Any engine change: no new matcher, no new discrepancy codes, no change to
  `reconcileRecords()`, no change to the identifier hierarchy, no change to
  wallet semantics.

Any of the above requires a separate decision and, where the freeze applies,
the freeze's §14 architecture-change procedure.

## 5. Open decisions to resolve before 4B completes

**OD-1 — Distribution format.** `.ts` (rely on Node 24 type-stripping) vs
compiled `.js` + `.d.ts` vs both. Recommendation: compile (option b) — it is
the standard expectation for an npm-installed CLI, and it makes the package
usable on Node versions the current tree cannot support.

**OD-2 — License.** None is declared today. Recommendation: MIT — consistent
with the stated open-source intent and the simplest for adoption.

**OD-3 — Scope of the first publish.** Whether 4D covers the core only, or
also provides a placeholder path for future packages (storefront, adapters).
Recommendation: core only; add more packages when they actually exist.

Each open decision is resolved in writing before the corresponding track is
implemented. No track silently decides a frozen-adjacent question.

## 6. Preserved invariants

The following remain frozen and untouched across Phase 4:

- Provider-neutral boundary (freeze §4.1).
- Payment / ledger / fulfillment truth separation (freeze §4.2, §6).
- Single matcher `reconcileRecords()` (freeze §4.3).
- Exact-reference matching only; no fuzzy/probabilistic/amount-only/timestamp-
  only correlation (freeze §4.4).
- Identifier hierarchy (`mk_txn_…` join anchor; evidence-only external refs)
  (freeze §5).
- Wallet ledger authority and append-only semantics (freeze §4.5, §7).
- Gift-card secret masking (freeze §4.7).
- Ticket reservation ≠ issuance (freeze §4.8).
- Betting compliance gate (freeze §4.9).
- `reconcilekit/src/**` behavior unchanged by any Phase 4 track.
- Storefront remains a demonstration surface; it is not published.

## 7. Standing guard

After each Phase 4 increment:

- Root tests: **665/665** (or higher; no regressions).
- Storefront tests: **464/464** (or higher).
- Both typechecks: PASS.
- ESLint: PASS (JS-only config — D2 blocked on upstream).
- Prettier `format:check`: PASS.
- **New:** CI green on `ubuntu-latest` from a fresh checkout.

## 8. Smallest first increment

**4A — the CI workflow.** Delivered alongside this document. No code change
to either package; no dependency added; no frozen decision touched.

## 9. What closure looks like

Phase 4 closes when:

- 4A/4B/4C/4D each pass their gates.
- The core is installable and usable from a fresh environment.
- The README is followable end-to-end by a stranger.
- A dry-run publish has produced a working tarball.
- The standing guard remains green, now including CI.
- Every deferred item in §4 is either still deferred with reasons, or has been
  separately authorized.

Until closure, no item in §4 may be silently pulled into scope.

## 10. Status

**PHASE 4 OPEN — distribution-readiness subset only. First increment (4A: CI)
delivered alongside this document. Open decisions OD-1, OD-2, OD-3 to be
resolved in writing before 4B completes.**
