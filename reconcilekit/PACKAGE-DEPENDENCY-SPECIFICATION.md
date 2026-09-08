# ReconcileKit — Package & Dependency Specification

**Version:** 0.1  
**Status:** DRAFT — REQUIREMENTS-FIRST  
**Architecture basis:** `ARCHITECTURE.md` — FROZEN  
**Scope:** MVP

## 1. Purpose

This artifact defines the package and dependency requirements for the ReconcileKit MVP.

It deliberately separates:

1. required capabilities;
2. dependency-selection criteria;
3. candidate evaluation;
4. approved dependencies.

No package is approved merely because it is familiar, popular, or previously suggested.

Concrete package names and versions are implementation decisions and must be validated against the current runtime and dependency ecosystem before approval.

## 2. Authority

This specification is subordinate to:

1. user instructions;
2. `AGENTS.md`;
3. `JARVIS-OPERATING-SYSTEM.md`;
4. domain manuals;
5. project instructions;
6. frozen `ARCHITECTURE.md`.

It must not contradict the frozen architecture.

If a package requirement would require changing an architectural boundary, stop and surface the conflict rather than adapting the architecture silently.

## 3. Frozen Architectural Constraints

Package selection must preserve:

- provider-neutral domain logic;
- Domain → Application → outer/interface dependency direction;
- Paystack-specific behavior inside the adapter;
- thin CLI;
- CSV/JSON interface boundaries;
- deterministic exact-reference reconciliation;
- integer monetary values;
- configurable timestamp validation;
- no arbitrary duplicate pairing;
- multi-discrepancy aggregation;
- explainable results;
- local-first MVP;
- in-memory MVP operation;
- open-source core reusability.

## 4. Dependency Classification

Every dependency must be classified as one of:

### Runtime dependency

Required for normal execution.

### Development dependency

Required only for development, testing, linting, formatting, type checking, or build tasks.

### Optional dependency

Not required for the MVP's normal execution path and must not become a hidden requirement.

### Deferred dependency

Potentially useful later but explicitly not justified by the current MVP.

A dependency must not be classified as runtime merely because it is convenient during development.

## 5. Capability Requirements

### 5.1 Runtime

The MVP requires capabilities for:

| Capability                        |                          Required? | Architectural owner                 |
| --------------------------------- | ---------------------------------: | ----------------------------------- |
| CLI argument parsing              |                                Yes | CLI                                 |
| CSV input parsing                 |                                Yes | Merchant adapter                    |
| JSON input/serialization          |                                Yes | Input/output adapters               |
| HTTP communication                | Yes, for live Paystack integration | Paystack adapter                    |
| Environment/configuration loading |                Yes, where required | CLI/application infrastructure      |
| Structured error handling         |                                Yes | Cross-layer/application             |
| Date/time parsing and comparison  |                                Yes | Domain/application/adapter boundary |
| Integer monetary arithmetic       |                                Yes | Domain                              |
| Exact-reference indexing          |                                Yes | Domain                              |
| Human-readable report rendering   |                                Yes | CLI                                 |
| Machine-readable JSON output      |                                Yes | Output adapter                      |

Indexing serves the domain's exact-reference matching semantics. The Application layer may coordinate and invoke reconciliation, but it does not own matching or indexing semantics.

### 5.2 Development

The project requires tooling for:

- automated tests;
- coverage/reporting where justified;
- static type checking if applicable;
- linting;
- formatting;
- build/package validation where required;
- dependency/security auditing.

## 6. Dependency Selection Rules

Every candidate dependency must pass these checks:

1. Does it solve a requirement in this specification?
2. Is the capability actually needed by the MVP?
3. Can the capability reasonably be implemented without a dependency?
4. Does the dependency fit the frozen architecture?
5. Is it compatible with the selected runtime version?
6. Is it actively maintained?
7. Is its license compatible with the project?
8. Does it introduce unnecessary transitive dependencies?
9. Does it introduce disproportionate security or supply-chain risk?
10. Does it create unnecessary implementation coupling?
11. Does it have stable, documented APIs?
12. Is there a materially better-maintained or simpler alternative?

No dependency should be added merely to reduce a small amount of local code.

## 7. Core Domain Dependency Policy

The domain should have **zero third-party runtime dependencies unless a concrete requirement proves one necessary**.

Prefer language/runtime standard-library capabilities.

The domain must not depend on:

- Paystack SDKs;
- HTTP clients;
- CLI frameworks;
- CSV parsers;
- configuration loaders;
- filesystem libraries;
- direct environment/configuration access;
- database clients;
- ORM packages;
- logging frameworks solely for domain behavior.

Filesystem and environment access are infrastructure concerns. The domain operates as pure, provider-neutral reconciliation logic and must not perform filesystem or environment access (including via runtime standard-library primitives); it receives inputs and configuration as explicit values through its boundary.

## 8. Application Dependency Policy

The application layer should remain lightweight.

It may depend on:

- domain modules;
- application-defined ports;
- explicit configuration values;
- standard runtime functionality.

It must not directly depend on raw Paystack response structures.

## 9. Paystack HTTP Dependency

Live Paystack integration requires HTTP transport.

Selection rule:

- prefer a runtime-native HTTP implementation when sufficient;
- introduce a third-party HTTP client only for a concrete required capability;
- keep HTTP implementation inside the Paystack adapter/infrastructure boundary.

The dependency must not appear in the domain.

## 10. CSV Dependency

CSV support is an MVP requirement.

Selection criteria:

- quoted fields;
- delimiters;
- escaped quotes;
- line endings;
- headers;
- empty values;
- predictable errors;
- acceptable performance/streaming characteristics;
- maintenance/security profile.

Do not select a CSV package solely because it has the largest feature set.

## 11. JSON Dependency

Use the runtime's native JSON capability unless a concrete requirement justifies another library.

JSON schema validation is not automatically an MVP requirement.

## 12. CLI Dependency

The CLI requires:

- command parsing;
- options/flags;
- help output;
- required-argument validation;
- appropriate process exit codes.

A CLI framework may be selected only if it materially improves these requirements without disproportionate complexity.

It must not contain reconciliation logic.

## 13. Configuration Dependency

Configuration remains outside the domain.

Relevant configuration includes:

- input format;
- output format;
- provider selection;
- timestamp validation enabled/disabled;
- timestamp tolerance;
- provider credentials.

If `.env` files are supported, an environment-file loader may be considered.

A `.env` library is not automatically required.

Secrets must not enter domain objects.

## 14. Date/Time Dependency

Timestamp validation requires reliable:

- timezone handling;
- ISO-8601 parsing;
- explicit timezone semantics;
- duration/tolerance arithmetic;
- deterministic comparison.

Prefer runtime-native capabilities if sufficient.

Do not add a date library solely for convenience.

The architecture does not establish a universal Paystack timestamp field or tolerance.

## 15. Monetary Arithmetic

No floating-point monetary dependency is permitted for reconciliation comparison.

Canonical amounts are integer minor/subunit values.

A decimal/money library is not automatically required.

Introduce one only if a concrete requirement cannot be satisfied safely with integer amounts and runtime arithmetic.

## 16. Persistence Dependencies

No persistence dependency is approved for MVP.

Explicitly deferred:

- PostgreSQL;
- Prisma;
- other ORMs;
- database drivers;
- migrations;
- Redis;
- hosted persistence.

MVP reconciliation operates on in-memory domain representations.

Any future persistence requirement must be justified by a new project requirement and reviewed against the architecture.

## 17. Logging / Observability Dependencies

The MVP requires diagnosable behavior but does not automatically require a third-party logging framework.

Prefer runtime facilities initially.

Any logging package must:

- avoid secrets;
- avoid sensitive payment data;
- support appropriate levels;
- remain outside the domain;
- not become part of domain semantics.

## 18. Validation Dependencies

The domain's reconciliation rules must remain domain code.

Do not replace domain decisions with a generic validation framework.

A validation library may be appropriate for external input shape validation, but:

- input schema validation is distinct from reconciliation validation;
- `INPUT_ERROR` semantics remain controlled by the project domain;
- adapter validation must not silently become business-rule validation.

## 19. Testing Dependencies

Testing is required at multiple levels.

### Domain

- 20 validated scenarios;
- invariant/property tests where justified;
- deterministic results;
- duplicate safety;
- discrepancy aggregation;
- missing-vs-unknown behavior.

### Paystack adapter

- response parsing;
- `data.status` handling;
- reference extraction;
- amount/currency mapping;
- source-status preservation;
- timestamp extraction.

### Integration

- input → adapter → application → domain → report → output.

### End-to-end

At least one explainability test covering source values, normalized values, validation results, and final classification.

Testing tools may be development dependencies.

## 20. Type Checking

If the implementation language/toolchain supports static typing, strict type checking should be enabled where practical.

Exact compiler/type-checker configuration belongs to implementation setup.

## 21. Linting and Formatting

A consistent linting and formatting toolchain is recommended for maintainability. Linting and formatting are a development/engineering practice, not an architectural requirement.

Selection criteria:

- runtime compatibility;
- stable configuration;
- compatibility with tests/build;
- minimal tool overlap;
- minimal formatting churn.

Exact tools remain unselected.

## 22. Build / Package Tooling

Use the package manager and build mechanism appropriate to the selected runtime/language.

The exact package manager, compiler, bundler, or task runner is not frozen here.

No build tool should be introduced if native tooling is sufficient.

### Execution / build strategy decision (evidence date 2026-08-13)

Decision: **NATIVE MINIMAL STRATEGY SUFFICIENT** for the current MVP.

### Execution

Node native TypeScript type stripping is the approved native execution mechanism for the current MVP.

It is used for:

- CLI execution;
- application execution;
- adapter execution;
- domain execution;
- development/test execution.

It does NOT perform:

- type checking;
- full compilation;
- declaration generation;
- arbitrary syntax transformation.

### Type checking

`typescript@7.0.2` provides the approved compiler/type-checking capability.

The current project uses:

```text
tsc --noEmit
```

for compile-time type checking.

### Testing

`node:test` remains the approved native behavioral test mechanism.

### Build

No production build, bundling, transpilation, or dedicated build framework is currently required.

Explicitly recorded:

```text
NO ADDITIONAL EXECUTION/BUILD DEPENDENCY REQUIRED FOR CURRENT MVP.
```

### Production build / distribution status

- production JS output: NOT ESTABLISHED
- `dist/`: NOT ESTABLISHED
- deployment artifacts: NOT ESTABLISHED
- package publishing: NOT ESTABLISHED
- declaration files: NOT ESTABLISHED
- source maps: NOT ESTABLISHED
- bundling: NOT ESTABLISHED

No publishing or build requirement is inferred merely because the project has an open-source core.

### TypeScript emit — available capability, not a project requirement

`typescript@7.0.2` CAN perform:

- JavaScript emit;
- declaration emit;
- source-map generation;
- module transformation.

But these are currently:

```text
AVAILABLE CAPABILITIES — NOT PROJECT REQUIREMENTS
```

Do not configure or invoke emit. Do not create a build pipeline.

### Native type-stripping constraint

The native execution strategy requires source to remain within TypeScript syntax that Node can erase without transformation.

Examples of non-erasable constructs that would require a future transformation strategy include:

- runtime enums;
- namespaces requiring runtime emit;
- parameter properties;
- legacy decorators;
- `import =` / `export =` semantics.

This is recorded as an implementation-planning constraint to be resolved before source implementation. It is not prohibited through tooling yet, and no workaround package is introduced.

### Unselected execution/build tooling

The following remain unnecessary/unselected for the current MVP and may only be reconsidered under a separate future requirement gate:

- ts-node
- tsx
- esbuild
- swc
- rollup
- webpack
- vite
- any bundler
- any transpiler
- any build framework
- any declaration generator

### Node runtime baseline (evidence date 2026-08-14)

Decision: **APPROVE NODE 24 BASELINE** — recorded as a recommendation, not frozen in configuration.

**Minimum supported: Node 24.12.0**

Reason:

- first Node 24-line release with stable native TypeScript type stripping (Stability 2);
- supports the approved native-minimal execution strategy;
- satisfies the approved development-tool engine requirements (eslint@10.8.1 `engines` `^20.19.0 || ^22.13.0 || >=24`).

**Recommended development: Node 24.19.0**

Reason:

- current Node 24 LTS compatibility reference established by the evaluation;
- provides the same required native capabilities;
- maintains the Active LTS baseline.

**Status:**

- recommended baseline only;
- not frozen;
- no `package.json` `engines` field;
- no CI pin;
- no runtime version configuration created by this decision.

Node 24.12.0 is the minimum supported version. It is NOT described as the currently installed or pinned version. Node 24.19.0 is the recommended development version. It is NOT described as the minimum supported version.

### Runtime strategy

```text
Node 24.12.0+  →  native TypeScript type stripping  →  Node execution
typescript@7.0.2  →  tsc --noEmit  →  compile-time type checking
node:test  →  behavioral testing
node:util.parseArgs  →  CLI argument parsing
```

No additional execution/build dependency is required.

### Node 22 — excluded from current recommended baseline

Reason:

- native TypeScript type stripping is not stable on the Node 22 line (release-candidate, Stability 1.2);
- the remaining support horizon is materially shorter than Node 24 (Maintenance; EOL 2027-04-30);
- selecting Node 22 would weaken the approved native-minimal execution strategy.

Node 22 is not described as insecure. Existing Node 22 evidence and historical compatibility references are retained unchanged.

### Node 26 — compatible future line

- Node 26 supports the required native capabilities;
- it is not the current baseline because it is not yet the current Active LTS line at the time of the evaluation;
- future migration/recommendation may be reconsidered when its support status changes (Active LTS 2026-10-28).

Node 26 is not approved as the project baseline. Its existing compatibility evidence is retained.

### Module strategy (evidence date 2026-08-14)

Decision: **ESM — APPROVED FOR IMPLEMENTATION**

ESM is an implementation strategy selected after the evidence review. It is **not** an explicit architectural requirement and it does not alter the frozen architecture or dependency direction.

Rationale:

- Node 24 supports ESM as a stable module system under the approved baseline (Node 24.12.0 minimum supported; Node 24.19.0 recommended development).
- typescript@7.0.2 supports Node-oriented ESM configuration.
- Node's native TypeScript guidance uses NodeNext module semantics.
- csv-parse@7.0.2 is dual-published (`exports` map with both `import` and `require` conditions, npm registry observed 2026-08-14) and therefore does not require an interoperability wrapper.
- node:test is compatible with ESM.
- node:util.parseArgs is module-agnostic and compatible.
- No additional runtime/build dependency is required.
- The project is a new TypeScript/Node implementation rather than a legacy CommonJS codebase.
- ESM preserves the frozen architecture and dependency direction (outer layers → inner domain).
- ESM does not imply npm publishing, dual distribution, browser support, or package exports — none of these are established.

CommonJS is NOT SELECTED as an implementation strategy.

### Module configuration — NOT YET CREATED

ESM approval does not create configuration. No `package.json`, `tsconfig.json`, `eslint.config.*`, Prettier configuration, CI files, source files, or test files are created or modified by this record.

Configuration creation is the NEXT controlled action and is not performed by this record.

The eventual configuration is expected to use Node-aware TypeScript module semantics, subject to the controlled configuration step. The exact future configuration may include:

- package.json `"type": "module"`;
- TypeScript `module: "nodenext"`;
- TypeScript `moduleResolution: "nodenext"`.

These are configuration targets, NOT files or configuration changes made by this record. The complete tsconfig is not invented here; exact contents remain an open implementation-setup decision.

### Module strategy evidence (implementation-level)

The implementation-level evidence gap is resolved by the ESM decision above:

- concrete CLI entry point: implementation-setup decision;
- package.json `"type"`: configuration target — see "Module configuration" above;
- tsconfig `module` / `moduleResolution`: configuration targets — see "Module configuration" above;
- package exports shape: NOT ESTABLISHED — publishing is not established.

None of these are created or modified by this record.

### Explicit non-decisions

- ESM is APPROVED as the implementation module strategy.
- CommonJS is NOT SELECTED as an implementation strategy.
- Dual ESM/CommonJS is NOT REQUIRED.
- npm publishing is NOT ESTABLISHED.
- package exports are NOT ESTABLISHED.
- browser compatibility is NOT ESTABLISHED.
- bundled distribution is NOT ESTABLISHED.

No requirement is inferred from the open-source-core description.

### Development vs production runtime

- Minimum supported runtime: Node 24.12.0
- Recommended development runtime: Node 24.19.0
- Project runtime baseline: recommended, NOT CONFIGURATION-FROZEN

No production deployment environment has been selected. No deployment configuration is created.

### Open decisions (not resolved by this record)

- exact package.json scripts;
- exact tsconfig contents;
- CI configuration;
- deployment packaging;
- project LTS/support policy;
- future Node 26 migration;
- future build/emit strategy if requirements emerge;
- declaration generation;
- package publishing.

This record resolves the ESM module strategy. It does NOT resolve any of the remaining items. The Node runtime baseline is resolved by the "Node runtime baseline" record above. ESM itself is no longer open.

### Architecture preservation

Execution/build tooling remains infrastructure. It must not own:

- matching;
- normalization;
- amount validation;
- currency validation;
- status mapping;
- timestamp validation;
- discrepancy classification;
- reconciliation outcomes.

The execution strategy does not change any validated scenario outcome. The same TypeScript domain source is:

- type-checked by `tsc --noEmit`;
- executed natively by Node type stripping;
- behaviorally tested by `node:test`.

No build/transpilation layer is permitted to become a semantic authority.

## 23. Dependency Security

Before approving any dependency, verify:

- current maintained release;
- known security advisories;
- license;
- transitive dependency footprint;
- install scripts or other supply-chain-sensitive behavior;
- runtime compatibility;
- maintenance/activity.

Security review is required again when versions are actually selected.

## 24. Version Policy

Do not record package versions from memory.

For each selected dependency, record:

```text
Package
Purpose
Layer
Runtime/dev/optional
Selected version
Supported runtime
Reason selected
Alternatives considered
Security/maintenance check
```

Versions must be verified against current official package/repository documentation immediately before approval.

## 25. Dependency Graph Constraints

The intended dependency graph is:

```text
                 CLI
                  │
                  ▼
             Application
              │       │
              ▼       ▼
           Domain   Adapters
                      │
                      ▼
               External systems
```

The precise implementation graph may contain application-defined ports, but it must preserve:

```text
outer layers → inner domain
```

and never:

```text
domain → infrastructure
domain → provider
domain → CLI
```

## 26. Initial Capability Matrix

This matrix identifies capabilities before package names.

| Capability        | Preferred first option        | Third-party package justified? |
| ----------------- | ----------------------------- | ------------------------------ |
| JSON              | Runtime-native JSON           | Only with concrete requirement |
| HTTP              | Runtime-native HTTP           | Only with concrete requirement |
| Date/time         | Runtime-native capabilities   | Only with concrete requirement |
| Money             | Integer runtime arithmetic    | Only with concrete requirement |
| CSV               | Small maintained parser       | Evaluate                       |
| CLI               | Minimal CLI parser/framework  | Evaluate                       |
| Configuration     | Process environment/runtime   | `.env` loader only if needed   |
| Testing           | Mature test runner            | Evaluate                       |
| Type checking     | Runtime/language tooling      | If applicable                  |
| Linting           | One maintained lint toolchain | Evaluate                       |
| Formatting        | One formatter                 | Evaluate                       |
| Coverage          | Only if required              | Evaluate                       |
| Schema validation | Adapter/input layer only      | Only with concrete need        |

This is not package approval.

## 27. Invalid Selection Logic

These are not valid reasons to select a dependency:

- "everyone uses it";
- "it is popular";
- "the agent knows it";
- "it is already in another project";
- "it makes the architecture look complete";
- "it is the modern stack";
- "we might need it later";
- "it is convenient for the coding agent."

Selection must be tied to an actual requirement.

## 28. Agent-Development Constraint

OpenCode/Agent Dev may assist with implementation, but must not independently introduce dependencies because they appear convenient.

When proposing a new dependency, the agent must identify:

1. required capability;
2. why runtime/standard library is insufficient;
3. candidate alternatives;
4. maintenance/security considerations;
5. architectural layer;
6. runtime vs development-only classification.

Dependency addition requires review under the project hierarchy.

## 29. Package Approval Record

**Current approved set (evidence date 2026-08-13):**

APPROVED THIRD-PARTY DEPENDENCIES

- Runtime: `csv-parse@7.0.2`
- Development: `eslint@10.8.1`, `prettier@3.9.6`, `typescript@7.0.2`, `@types/node@24.13.3`

APPROVED NATIVE RUNTIME CAPABILITIES

- `node:util.parseArgs`
- `node:test`
- Node native TypeScript type stripping

NOT SELECTED

- `@fast-csv/parse@5.0.7`
- `commander@15.0.0`
- `vitest@4.1.10`
- `typescript-eslint@8.67.0` — NOT SELECTED FOR CURRENT MVP — BLOCKED BY TYPESCRIPT 7.0.2 COMPATIBILITY

This list does not freeze a project Node runtime version.

APPROVED RUNTIME BASELINE (recommended, evidence date 2026-08-14)

- Node 24 — minimum supported Node 24.12.0 (first 24-line release with stable native TypeScript type stripping); recommended development Node 24.19.0 (current Node 24 LTS).
- Status: recommended baseline only; NOT frozen in configuration. No `package.json` engines field, CI pin, or runtime version configuration created.
- Node 22 excluded: type stripping release-candidate on the 22 line; Maintenance EOL 2027-04-30. Historical Node 22 evidence retained.
- Node 26 compatible future line once Active LTS (2026-10-28); not the current baseline; future migration may be reconsidered when its support status changes.
- ESM = APPROVED FOR IMPLEMENTATION (recorded 2026-08-14); CommonJS = NOT SELECTED. Module configuration (`package.json` `"type"`, tsconfig `module`/`moduleResolution`) NOT CREATED — configuration creation is the next controlled action. See §22 "Module strategy".
- The runtime baseline is NOT a package dependency. See §22 "Node runtime baseline".

| Package                        | Capability                                                                                                                                                 | Layer                                   | Type                                            | Version            | Alternatives                                                                                                                          | Evidence                                                                                                                                                                                     | Approval                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| csv-parse                      | CSV parsing in the Merchant adapter                                                                                                                        | Merchant adapter                        | Runtime dependency                              | 7.0.2              | @fast-csv/parse@5.0.7 — NOT SELECTED for current MVP                                                                                  | npm registry <https://registry.npmjs.org/csv-parse/latest> (observed 2026-08-13); official documentation <https://csv.js.org/parse/>                                                         | APPROVED                                    |
| @fast-csv/parse                | CSV parsing in the Merchant adapter                                                                                                                        | Merchant adapter                        | Runtime dependency                              | 5.0.7              | csv-parse@7.0.2 — APPROVED                                                                                                            | npm registry <https://registry.npmjs.org/@fast-csv/parse/latest> (observed 2026-08-13); official documentation <https://c2fo.github.io/fast-csv/>                                            | NOT SELECTED                                |
| `node:util.parseArgs` (native) | CLI argument parsing                                                                                                                                       | CLI                                     | Native runtime capability                       | N/A — Node runtime | commander@15.0.0 — NOT SELECTED for current MVP                                                                                       | Node.js API documentation <https://nodejs.org/api/util.html#utilparseargsconfig> (observed 2026-08-13)                                                                                       | APPROVED — NATIVE                           |
| commander                      | CLI argument parsing                                                                                                                                       | CLI                                     | Runtime dependency (candidate)                  | 15.0.0             | `node:util.parseArgs` — APPROVED — NATIVE                                                                                             | npm registry <https://registry.npmjs.org/commander/latest> (observed 2026-08-13)                                                                                                             | NOT SELECTED                                |
| `node:test` (native)           | Testing                                                                                                                                                    | Development / test infrastructure       | Native runtime capability (development/testing) | N/A — Node runtime | vitest — NOT SELECTED for current MVP                                                                                                 | Node.js API documentation <https://nodejs.org/api/test.html> (observed 2026-08-13)                                                                                                           | APPROVED — NATIVE                           |
| vitest                         | Testing                                                                                                                                                    | Development / test infrastructure       | Development dependency (candidate)              | 4.1.10             | `node:test` — APPROVED — NATIVE                                                                                                       | npm registry <https://registry.npmjs.org/vitest/latest> (observed 2026-08-13)                                                                                                                | NOT SELECTED                                |
| eslint                         | Static analysis / linting                                                                                                                                  | Development tooling                     | Development dependency                          | 10.8.1             | n/a — no native linter; no competing candidate evaluated                                                                              | npm registry <https://registry.npmjs.org/eslint/latest> (observed 2026-08-13); official documentation <https://eslint.org/>                                                                  | APPROVED                                    |
| prettier                       | Deterministic source formatting                                                                                                                            | Development tooling                     | Development dependency                          | 3.9.6              | n/a — no native formatter; no competing candidate evaluated                                                                           | npm registry <https://registry.npmjs.org/prettier/latest> (observed 2026-08-13); official documentation <https://prettier.io/>                                                               | APPROVED                                    |
| typescript                     | Type checking / compiler (`tsc --noEmit`)                                                                                                                  | Development/build tooling               | Development dependency                          | 7.0.2              | n/a — no native type-checker; Node type stripping executes erasable syntax only and is not a substitute                               | npm registry <https://registry.npmjs.org/typescript/latest> (observed 2026-08-13); official documentation <https://www.typescriptlang.org/>                                                  | APPROVED                                    |
| @types/node                    | TypeScript declarations for Node built-in APIs required by `tsc --noEmit` (`node:util`, `node:test`, and other Node APIs used by adapters/application/CLI) | Development tooling / type declarations | Development dependency                          | 24.13.3            | `@types/node@latest` (26.2.0) — NOT SELECTED — aligns with the Node 26 line, not the Node 24 baseline                                 | npm registry <https://registry.npmjs.org/@types/node> (verified 2026-08-14: 24.13.3 is the current 24.x release; dist-tag `latest` = 26.2.0); license MIT; dependency `undici-types@~7.18.0` | APPROVED — DEVELOPMENT DEPENDENCY           |
| typescript-eslint              | TypeScript-aware linting                                                                                                                                   | Development tooling (candidate)         | Development dependency (candidate)              | 8.67.0             | n/a — `eslint@10.8.1` remains APPROVED for the established linting requirement; `tsc --noEmit` remains the type-correctness mechanism | npm registry <https://registry.npmjs.org/typescript-eslint/latest> (observed 2026-08-13); TypeScript peer range `>=4.8.4 <6.1.0`                                                             | NOT SELECTED — BLOCKED BY TS7 COMPATIBILITY |
| TBD                            | TBD                                                                                                                                                        | TBD                                     | TBD                                             | TBD                | TBD                                                                                                                                   | TBD                                                                                                                                                                                          | PENDING                                     |

### csv-parse@7.0.2 — Approval rationale (evidence date 2026-08-13)

- CSV parsing is an explicit MVP capability.
- Node.js provides no native CSV parser sufficient for the required parsing behavior.
- csv-parse provides the required CSV parsing capabilities.
- It has zero declared runtime dependencies.
- It supports the required parsing/error behavior.
- It fits entirely within the Merchant adapter boundary.
- It does not own domain validation, matching, classification, or reconciliation semantics.

### @fast-csv/parse@5.0.7 — NOT SELECTED FOR CURRENT MVP

- three runtime dependencies versus zero for csv-parse;
- no compensating capability required by the current MVP;
- coarser documented parser-error taxonomy;
- formatting capability is unnecessary because this project currently requires CSV parsing, not CSV generation.

@fast-csv/parse is not insecure or unsuitable generally; it is simply not selected for this project's current requirements.

### `node:util.parseArgs` — APPROVED — NATIVE (CLI mechanism, evidence date 2026-08-13)

- `node:util.parseArgs` is a stable Node API.
- It provides the option and positional parsing required by the MVP.
- The current MVP does not establish requirements requiring a richer CLI framework.
- Using the native API avoids an unnecessary runtime dependency.
- This preserves the native-runtime-first and minimal-dependency policies.
- CLI parsing remains entirely within the CLI layer.

Official Node.js documentation: <https://nodejs.org/api/util.html#utilparseargsconfig>

### commander@15.0.0 — NOT SELECTED FOR CURRENT MVP

- Native `node:util.parseArgs` satisfies the currently established CLI requirements.
- Commander would introduce an unnecessary third-party runtime dependency.
- Commander-specific features such as richer command/subcommand handling and generated help have not been established as MVP requirements.
- Commander may be reconsidered if future CLI requirements exceed the native API.

Commander is not defective, insecure, or unsuitable generally; it is simply not justified by the current requirements.

### `node:test` — APPROVED — NATIVE (testing mechanism, evidence date 2026-08-13)

- `node:test` is a stable Node.js test runner.
- It satisfies the established MVP testing requirements.
- It supports the 20 validated reconciliation scenarios.
- It supports domain unit tests.
- It supports domain invariant tests where justified.
- It supports adapter contract tests.
- It supports Paystack adapter tests.
- It supports integration tests.
- It supports CLI/application tests.
- It supports end-to-end explainability tests.
- It supports deterministic assertions, malformed-input cases, outcome classification, and multiple simultaneous discrepancies.
- No established MVP requirement requires Vitest-specific capability.
- Using the native runner avoids an unnecessary third-party development dependency and preserves the minimal-dependency policy.

Property-based testing remains conditional: "Property-based tests where justified" — it is not mandatory and is not resolved by this decision.

Official Node.js documentation: <https://nodejs.org/api/test.html>

### vitest — NOT SELECTED FOR CURRENT MVP

- `node:test` satisfies the currently established testing requirements.
- No concrete MVP requirement requires a Vitest-specific capability.
- Vitest would introduce a substantial third-party development dependency tree without sufficient demonstrated benefit.
- Watch-mode improvements are not an established requirement.
- Typecheck integration is not an established MVP test-runner requirement.
- UI/browser testing is not an established project requirement.
- Vitest may be reconsidered if future requirements materially exceed `node:test`.

Vitest is not defective or insecure generally; it is simply not selected for the current MVP.

### eslint@10.8.1 — APPROVED (development tooling, evidence date 2026-08-13)

- The package specification recommends a maintained linting toolchain for maintainability.
- ESLint provides useful static-analysis protection for common coding defects.
- Node.js provides no equivalent native linter.
- ESLint remains development-only and does not enter the production dependency graph.
- ESLint does not own domain semantics or architectural authority.

Evidence preserved: MIT license; Node engine compatibility (`^20.19.0 || ^22.13.0 || >=24`); 30 direct dependencies (development-only); 0 known security advisories (OSV, 2026-08-13); flat-config model (default since ESLint 9).

Official documentation: <https://eslint.org/>

### prettier@3.9.6 — APPROVED (development tooling, evidence date 2026-08-13)

- The package specification recommends a consistent formatting toolchain for maintainability.
- Prettier provides deterministic formatting and format checking.
- Node.js provides no equivalent native formatter.
- Prettier has zero runtime dependencies according to the evaluation.
- Prettier remains development-only and does not enter the production dependency graph.

Evidence preserved: MIT license; Node compatibility (`>=14`); zero runtime dependencies; current stable version 3.9.6; 0 known security advisories (OSV, 2026-08-13).

Official documentation: <https://prettier.io/>

### typescript@7.0.2 — APPROVED (development tooling, evidence date 2026-08-13)

- TypeScript is the project's approved implementation language (PROJECT.md charter: MANDATORY; language strategy decision 2026-08-13).
- Static type checking via `tsc --noEmit` is required at development time.
- Node's native type stripping executes erasable TypeScript syntax only — it performs no type checking and is not a substitute for the compiler.
- TypeScript 7.0 is the native Go port of the compiler and language service (GA announced 2026-07-08; type-checking semantics identical to 6.0).
- The package reports zero known security advisories (OSV, 2026-08-13).
- Apache-2.0 license; engines `>=16.20.0`; compatible with the Node 22/24/26 compatibility references; no runtime version frozen by this approval.
- Its 20 platform-specific binary dependencies (`@typescript/typescript-*`) are the official per-platform delivery mechanism for the native compiler (version-pinned 7.0.2; only the matching platform binary installs).
- TypeScript remains development-only and does not enter the production dependency graph.

Evidence preserved: Microsoft TypeScript repository (github.com/microsoft/TypeScript, observed 2026-08-13); official announcement (devblogs.microsoft.com, 2026-07-08); npm registry dist-tags (latest 7.0.2; next 7.1.0-dev).

Official documentation: <https://www.typescriptlang.org/>

Notes (non-blocking): the TypeScript 7.x stable programmatic API targets 7.1 — tooling that imports the compiler API (e.g., typescript-eslint) must use the 6.0 alias (`typescript@npm:@typescript/typescript6`) or wait for 7.1; this does not affect `tsc` CLI usage. The `next` dist-tag is 7.1.0-dev; a 7.1 upgrade should be evaluated when typescript-eslint is evaluated.

### @types/node@24.13.3 — APPROVED (development dependency / type declarations, evidence date 2026-08-14)

- Node native type stripping executes TypeScript but does not provide TypeScript type checking or declarations.
- The project explicitly requires `tsc --noEmit` (typescript@7.0.2) for compile-time type checking.
- The implementation directly uses Node built-in APIs (`node:util`, `node:test`, and other Node APIs used by adapters/application/CLI as implementation proceeds).
- Therefore Node built-in type declarations are required for the approved type-checking workflow.
- The declaration major is aligned with the project's Node 24 baseline. Verified current 24.x release: **24.13.3** (npm registry, observed 2026-08-14).
- `@types/node@latest` (26.2.0) is NOT selected — it aligns with the Node 26 line, and the project baseline is Node 24.
- `@types/node` is development-only and does not enter the production runtime graph.
- It introduces no new production execution capability and no domain ownership.
- No architectural boundary changes and no domain semantics are introduced.

Dependency surface:

- License: MIT.
- Purpose: Node built-in TypeScript declarations.
- Dependency: `undici-types@~7.18.0`.
- Development-only.
- No runtime dependency.
- Not characterized as runtime code.

Official package metadata: <https://registry.npmjs.org/@types/node> (observed 2026-08-14).

### typescript-eslint@8.67.0 — NOT SELECTED FOR CURRENT MVP (evidence date 2026-08-13)

Status: **NOT SELECTED FOR CURRENT MVP** — **BLOCKED BY TYPESCRIPT 7.0.2 COMPATIBILITY**.

This is a current MVP decision, not a general rejection of the typescript-eslint project. The package is actively maintained; ESLint 10.8.1 compatibility is supported; security is not the blocker; TypeScript 7.0.2 compatibility is the blocker.

Rationale:

- The current approved compiler is `typescript@7.0.2`.
- The evaluated `typescript-eslint@8.67.0` release declares a TypeScript peer range of `>=4.8.4 <6.1.0`.
- Therefore it does not support the approved TypeScript 7.0.2 compiler.
- Forced installation is not an acceptable project strategy because the evaluated TypeScript 7 programmatic API required by typescript-eslint is unavailable.
- TypeScript-aware linting is not an established MVP requirement.
- Existing approved `eslint@10.8.1` remains sufficient for the current established linting requirement.
- `tsc --noEmit` remains the authoritative TypeScript correctness mechanism.
- `node:test` remains the behavioral testing mechanism.

Conceptual distinction (preserved):

- ESLint: development linting / maintainability
- TypeScript: compile-time type correctness
- node:test: behavioral correctness

Neither ESLint nor typescript-eslint may own:

- matching;
- normalization;
- amount validation;
- currency validation;
- status mapping;
- timestamp validation;
- discrepancy classification;
- outcome semantics;
- reconciliation rules.

Tooling remains outside production domain semantics.

Correctness responsibility split:

- `typescript@7.0.2` / `tsc --noEmit` → compile-time type correctness
- `eslint@10.8.1` → general linting / maintainability
- `prettier@3.9.6` → deterministic formatting
- `node:test` → behavioral testing
- `typescript-eslint` → NOT SELECTED

`tsc --noEmit` does not perform linting. ESLint does not perform type checking.

#### Reopening condition

Re-evaluate typescript-eslint when BOTH are true:

1. TypeScript provides the stable programmatic API required by typescript-eslint; and
2. a compatible stable typescript-eslint release supports the approved TypeScript version and ESLint 10.

Do not automatically approve it when those conditions occur. A future re-evaluation remains required because TypeScript-aware linting is not currently an established MVP requirement.

#### TS6 compatibility alias — NOT ADOPTED

The TypeScript 6 side-by-side compatibility arrangement is NOT ADOPTED.

Do NOT add:

- `@typescript/typescript6`;
- a `typescript@npm:...` alias;
- a second TypeScript compiler;
- any other compatibility workaround.

Reason: it would introduce a second compiler and split type-information authority while the project is committed to `typescript@7.0.2`. Any future adoption requires an explicit user decision and separate evaluation.

Evidence preserved: version 8.67.0; MIT license; ESLint 10 compatibility; TypeScript peer range `>=4.8.4 <6.1.0`; security result; maintenance evidence; TypeScript 7 API blocker; TS6 compatibility workaround recorded as evidence only.

No integration packages (e.g., `eslint-config-prettier`), TypeScript ESLint packages, ESLint plugins, or Prettier plugins are approved by this record.

A package cannot move from `PENDING` to `APPROVED` without evidence-based evaluation.

## 30. Deferred Dependencies

Remain explicitly deferred unless requirements change:

- Prisma;
- PostgreSQL;
- Redis;
- database migration tooling;
- ORM;
- hosted infrastructure;
- queue/worker system;
- authentication libraries;
- billing libraries;
- dashboard/UI framework;
- API framework.

## 31. Package Selection Gate

Before implementation:

```text
Capability requirements
        ↓
Candidate packages
        ↓
Current-version verification
        ↓
Runtime compatibility
        ↓
Dependency-tree review
        ↓
Security / maintenance review
        ↓
Architecture compatibility
        ↓
Explicit approval
        ↓
Package manifest
```

No implementation agent should invent the final dependency set during coding.

## 32. Status

**DRAFT — READY FOR PACKAGE EVALUATION**

This artifact establishes the rules for selecting dependencies.

It does not approve a concrete package set.

The next step is to evaluate actual candidate packages against these requirements using current package/repository evidence, then freeze the approved dependency set before implementation.
