# ReconcileKit — Concrete Package Candidate Evaluation

**Version:** 0.1  
**Status:** DRAFT — EVIDENCE-BASED EVALUATION  
**Date:** 2026-08-13  
**Architecture:** `ARCHITECTURE.md` — FROZEN  
**Specification:** `PACKAGE-DEPENDENCY-SPECIFICATION.md` — READY FOR CONCRETE PACKAGE EVALUATION

## 1. Purpose

This artifact begins concrete dependency evaluation without prematurely freezing the final dependency set.

It evaluates the smallest set of capabilities that may justify third-party packages:

- CSV parsing
- CLI parsing
- testing
- linting
- formatting

It also records where the Node.js runtime can eliminate a third-party dependency.

No package is approved until the approval column explicitly says `APPROVED`.

## 2. Runtime Baseline

**Node 24 → APPROVED BASELINE — RECOMMENDED, NOT FROZEN**

Recorded by `PACKAGE-DEPENDENCY-SPECIFICATION.md` §22 "Node runtime baseline" (evidence date 2026-08-14):

- minimum supported: **Node 24.12.0** (first 24-line release with stable native TypeScript type stripping);
- recommended development: **Node 24.19.0** (current Node 24 LTS);
- Node 22 excluded from baseline (type stripping release-candidate on the 22 line; Maintenance EOL 2027-04-30);
- Node 26 retained as future-compatible line (Active LTS 2026-10-28; not current baseline);
- native type stripping stable on Node 24.12.0+;
- `node:test` stable;
- `node:util.parseArgs` stable;
- approved dependencies compatible (csv-parse@7.0.2 no `engines` field; eslint@10.8.1 `engines` `^20.19.0 || ^22.13.0 || >=24`; prettier@3.9.6 `>=14`; typescript@7.0.2 `>=16.20.0`).

The baseline is recorded as a recommendation and is **not frozen in configuration**. The runtime baseline is **not a package dependency**.

Current official Node.js evidence observed during this evaluation:

- Node.js 24.19.0 — LTS line
- Node.js 26.7.0 — current line
- Node.js 22.23.2 — LTS line

Source: official Node.js release index — <https://nodejs.org/dist/index.json>, observed 2026-08-13.

Node 24 is the approved baseline.

## 3. Candidate Evaluation

Package versions, licenses, dependency counts, and engine requirements in this artifact are official npm registry metadata — <https://registry.npmjs.org/<package>/latest>, observed 2026-08-13.

| Capability        | Candidate             | Current evidence                                                                                                                       | Assessment                                                                                                                                                                                                                                                   | Architectural Layer                       | Approval                                    |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| CSV               | `csv-parse`           | 7.0.2; MIT; 0 direct dependencies; Node stream API                                                                                     | Strong candidate                                                                                                                                                                                                                                             | Merchant adapter                          | APPROVED                                    |
| CSV               | `@fast-csv/parse`     | 5.0.7; MIT                                                                                                                             | Alternative                                                                                                                                                                                                                                                  | Merchant adapter                          | NOT SELECTED                                |
| CLI               | `node:util parseArgs` | Stable Node runtime API; zero dependency                                                                                               | Preferred first                                                                                                                                                                                                                                              | CLI                                       | APPROVED — NATIVE                           |
| CLI               | `commander`           | 15.0.0; MIT; requires Node >=22.12.0                                                                                                   | Strong alternative if native CLI is insufficient                                                                                                                                                                                                             | CLI                                       | NOT SELECTED                                |
| Testing           | `node:test`           | Stable Node runtime API; zero dependency                                                                                               | Preferred first                                                                                                                                                                                                                                              | Development tooling / test infrastructure | APPROVED — NATIVE                           |
| Testing           | `vitest`              | 4.1.10; MIT; 20 direct dependencies                                                                                                    | Alternative; justification required                                                                                                                                                                                                                          | Development tooling / test infrastructure | NOT SELECTED                                |
| Linting           | `eslint`              | 10.8.1; MIT                                                                                                                            | Strong development candidate                                                                                                                                                                                                                                 | Development tooling                       | APPROVED                                    |
| Formatting        | `prettier`            | 3.9.6; MIT; 0 direct dependencies                                                                                                      | Strong development candidate                                                                                                                                                                                                                                 | Development tooling                       | APPROVED                                    |
| TypeScript        | `typescript`          | 7.0.2; Apache-2.0; engines >=16.20.0; 0 OSV advisories (2026-08-13)                                                                    | Approved — required for `tsc --noEmit` type checking of the approved TypeScript language                                                                                                                                                                     | Development/build tooling                 | APPROVED                                    |
| Type declarations | `@types/node`         | 24.13.3; MIT; dependency `undici-types@~7.18.0`; development-only                                                                      | Approved — Node built-in type declarations required for `tsc --noEmit` over Node built-in APIs                                                                                                                                                               | Development tooling / type declarations   | APPROVED — DEVELOPMENT DEPENDENCY           |
| Linting           | `typescript-eslint`   | 8.67.0; MIT; ESLint 10 compatible; TypeScript peer range >=4.8.4 <6.1.0; 0 known security advisories (2026-08-13); actively maintained | NOT SELECTED — TypeScript 7.0.2 peer incompatibility (peer range excludes the approved 7.x compiler); TS7 stable programmatic API not yet available; TypeScript-aware linting not an MVP requirement; TS6 compatibility workaround recorded as evidence only | Development tooling                       | NOT SELECTED — BLOCKED BY TS7 COMPATIBILITY |

## 4. CSV

`csv-parse` is the strongest current candidate because CSV is an explicit MVP capability and the package reports zero direct dependencies, built-in TypeScript declarations, and Node stream support.

Before approval, verify:

- quoted fields;
- escaped quotes;
- delimiters;
- headers;
- empty values;
- line endings;
- malformed-input behavior;
- runtime compatibility;
- complete dependency tree;
- security and maintenance.

`@fast-csv/parse` remains an alternative until the final choice is approved.

## 5. CLI

Evaluate `node:util.parseArgs` first. Node documents it as a stable structured CLI argument parser (see <https://nodejs.org/docs/latest/api/util.html#utilparseargsconfig>).

`commander` 15.0.0 is a valid alternative, but it requires Node >=22.12.0. Do not raise the project's minimum Node version merely to accommodate Commander unless it materially improves the actual MVP CLI.

## 6. Testing

Evaluate `node:test` first. Node documents the test runner as stable (see <https://nodejs.org/docs/latest/api/test.html>).

Vitest 4.1.10 is a strong alternative but has a materially larger dependency footprint. It should only be selected if it provides concrete testing capabilities that justify that cost for this MVP.

## 7. Linting / Formatting

`eslint` 10.8.1 and `prettier` 3.9.6 are development-tool candidates.

Their selection must remain a development/engineering decision, not an architectural dependency.

## 8. TypeScript

TypeScript is the approved implementation language (PROJECT.md charter: MANDATORY; language strategy decision 2026-08-13) — this artifact's earlier "TypeScript not frozen" statement was superseded by that decision.

Evaluated:

- `typescript` — APPROVED (7.0.2, development dependency);
- Node native TypeScript type stripping — APPROVED — NATIVE for development/test execution;
- full TypeScript execution/build packages — NOT APPROVED (no package required for the MVP minimum toolchain);
- compiler/module configuration (exact tsconfig contents) — ESM is the approved module strategy; exact configuration remains an implementation-setup decision.

### Module-system evaluation status

ESM → **APPROVED FOR IMPLEMENTATION** (recorded in `PACKAGE-DEPENDENCY-SPECIFICATION.md` §22 "Module strategy", evidence date 2026-08-14).

- Node 24 supports ESM as a stable module system under the approved baseline (Node 24.12.0 minimum; Node 24.19.0 recommended development).
- typescript@7.0.2 supports Node-oriented ESM configuration; Node's native TypeScript guidance uses NodeNext module semantics.
- csv-parse@7.0.2 is dual-published (`exports` map with both `import` and `require` conditions) — no interoperability wrapper required.
- node:test and node:util.parseArgs are compatible.
- No additional runtime/build dependency is required.
- The project is a new TypeScript/Node implementation rather than a legacy CommonJS codebase.
- ESM preserves the frozen architecture and dependency direction.
- ESM does not imply npm publishing, dual distribution, browser support, or package exports.

CommonJS is NOT SELECTED as an implementation strategy.

ESM approval does not create configuration. Expected future configuration targets (package.json `"type": "module"`; tsconfig `module: "nodenext"` / `moduleResolution: "nodenext"`) remain a separate controlled configuration step; no `package.json` or tsconfig is created by this artifact.

Node's native type stripping is stable in current releases but provides no type checking and does not honor full `tsconfig.json` behavior (see <https://nodejs.org/docs/latest/api/typescript.html>); it is not a substitute for the `typescript` package.

`typescript-eslint@8.67.0` was evaluated and is **NOT SELECTED** — **BLOCKED BY TS7 COMPATIBILITY**:

- the evaluated 8.67.0 release declares a TypeScript peer range of `>=4.8.4 <6.1.0`, which excludes the approved `typescript@7.0.2`;
- the TypeScript 7.x stable programmatic API required by typescript-eslint is not yet available;
- TypeScript-aware linting is not an established MVP requirement — approved `eslint@10.8.1` remains sufficient for the established linting requirement and `tsc --noEmit` remains the authoritative TypeScript correctness mechanism;
- the TS6 side-by-side compatibility arrangement (`typescript@npm:@typescript/typescript6`) is recorded as evidence only and is NOT ADOPTED — it would introduce a second compiler and split type-information authority while the project is committed to `typescript@7.0.2`;
- the package is actively maintained and not generally defective or insecure — the blocker is TypeScript 7.0.2 compatibility;
- re-evaluation is possible when a stable TypeScript programmatic API and a compatible typescript-eslint release support the approved TypeScript version and ESLint 10.

### `@types/node` — type declarations for Node built-ins

`@types/node@24.13.3` → **APPROVED — DEVELOPMENT DEPENDENCY / TYPE DECLARATIONS** (recorded in `PACKAGE-DEPENDENCY-SPECIFICATION.md` §29, evidence date 2026-08-14).

- Node native type stripping executes TypeScript but does not provide type checking or declarations.
- The project explicitly requires `tsc --noEmit` for type checking.
- The implementation directly uses Node built-in APIs (`node:util`, `node:test`, and other Node APIs used by adapters/application/CLI as implementation proceeds).
- Therefore Node built-in type declarations are required for the approved type-checking workflow.
- The declaration major is aligned with the project's Node 24 baseline. Verified current 24.x release: 24.13.3 (npm registry, observed 2026-08-14).
- `@types/node@latest` (26.2.0) is NOT selected — it aligns with the Node 26 line; the project baseline is Node 24.
- License MIT; dependency `undici-types@~7.18.0` (npm registry, observed 2026-08-14).
- Development-only; does not enter the production runtime graph.
- No architectural boundary changes; no domain semantics introduced.

### Execution / build strategy status

Decision: **NATIVE MINIMAL STRATEGY SUFFICIENT** for the current MVP.

| Mechanism                                 | Status                         |
| ----------------------------------------- | ------------------------------ |
| Node native type stripping                | APPROVED — NATIVE              |
| `tsc --noEmit` via `typescript@7.0.2`     | APPROVED                       |
| node:test                                 | APPROVED — NATIVE              |
| dedicated TS runtime (e.g., ts-node, tsx) | NOT REQUIRED / NOT ESTABLISHED |
| bundler (esbuild, rollup, webpack, vite)  | NOT REQUIRED / NOT ESTABLISHED |
| transpiler (swc)                          | NOT REQUIRED / NOT ESTABLISHED |
| build framework / task runner             | NOT REQUIRED / NOT ESTABLISHED |
| declaration generator                     | NOT REQUIRED / NOT ESTABLISHED |

These statuses are NOT package approvals. No additional execution/build dependency is required for the current MVP.

Production build / distribution remains NOT ESTABLISHED:

- production JS output: NOT ESTABLISHED
- `dist/`: NOT ESTABLISHED
- deployment artifacts: NOT ESTABLISHED
- package publishing: NOT ESTABLISHED
- declaration files: NOT ESTABLISHED
- source maps: NOT ESTABLISHED
- bundling: NOT ESTABLISHED

`typescript@7.0.2` CAN perform JavaScript emit, declaration emit, source-map generation, and module transformation, but these remain AVAILABLE CAPABILITIES — NOT PROJECT REQUIREMENTS. Emit is not configured or invoked; no build pipeline is created.

The native strategy requires source to remain within erasable TypeScript syntax (no runtime enums, no namespaces requiring runtime emit, no parameter properties, no legacy decorators, no `import =` / `export =` semantics). This is an implementation-planning constraint, not a tooling prohibition, and no workaround package is introduced.

## 9. Native-First Capabilities

Evaluate native capabilities before adding packages:

- JSON → `JSON`
- HTTP → native `fetch`/HTTP APIs
- CLI → `node:util parseArgs`
- Testing → `node:test`
- date/time → native runtime capabilities
- money → integer arithmetic
- `.env` parsing → native `util.parseEnv` where the chosen runtime supports the required behavior (see <https://nodejs.org/docs/latest/api/util.html#utilparseenvcontent>)

## 10. Preliminary Direction

The evidence currently favors a minimal dependency set:

**Approved runtime dependency**

- `csv-parse@7.0.2`

**Approved development dependencies**

- `eslint@10.8.1`
- `prettier@3.9.6`
- `typescript@7.0.2` (type checking via `tsc --noEmit`)
- `@types/node@24.13.3` (Node built-in type declarations for `tsc --noEmit`)

**Native-first**

- CLI parsing
- testing
- JSON
- HTTP
- date/time
- integer money arithmetic

This is a direction, **not an approved manifest**.

## 11. Approval Gate

Before any candidate becomes approved:

1. confirm the concrete requirement;
2. evaluate the native alternative;
3. verify current version;
4. verify runtime compatibility;
5. inspect the dependency tree;
6. verify license;
7. review security/advisories;
8. review maintenance/activity;
9. verify architecture fit;
10. confirm minimality.

No package should be installed merely because it appears in this artifact.

## 12. Status

**DRAFT — CANDIDATE EVALUATION IN PROGRESS**

No final package set or package manifest is approved by this artifact.

Runtime baseline: **Node 24 → APPROVED BASELINE — RECOMMENDED, NOT FROZEN** — minimum supported Node 24.12.0; recommended development Node 24.19.0; Node 22 excluded; Node 26 future-compatible. Recorded in `PACKAGE-DEPENDENCY-SPECIFICATION.md` §22 "Node runtime baseline" (evidence date 2026-08-14). Module strategy: **ESM → APPROVED FOR IMPLEMENTATION** — CommonJS NOT SELECTED; recorded in §22 "Module strategy" (evidence date 2026-08-14). Type declarations: **`@types/node@24.13.3` → APPROVED — DEVELOPMENT DEPENDENCY** (evidence date 2026-08-14). Configuration (`package.json`, tsconfig) remains a separate controlled action and is NOT created by this artifact.
