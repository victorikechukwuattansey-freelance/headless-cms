# 5B.1f.2b Pre-Flight — ESLint TS lint coverage

## Summary (recommendation A/B/C + one-line risk)

**Recommendation: C — large blast radius.**

The recommended TypeScript preset reports **165 violations across 29 files**, all
at error severity by default. The largest source is `no-unused-vars` at 153
violations. A further blocker sits outside the violation count: the latest
`@typescript-eslint` release (`8.72.0`) refuses TypeScript 7.0, and this repo
uses TypeScript `7.0.2`.

**One-line risk:** f.2b needs a toolchain ruling before it can install cleanly;
if split, f.2b.1 would add a 165-warning backlog and f.2b.2 would be a sizeable
cleanup increment.

## Part 1 — Current ESLint config

### 1a. Root config

`reconcilekit/eslint.config.js` is a flat config. Full file:

```js
import js from "@eslint/js";

// Node.js globals. The package targets Node >=24 and every .js/.mjs/.cjs
// file in this tree runs under Node, so these are declared once here rather
// than per-file.
const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  global: "readonly",
  globalThis: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
  fetch: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  DOMException: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals,
    },
  },
];
```

Findings:

- **Linted globs:** `**/*.js`, `**/*.cjs`, `**/*.mjs` only.
- **Plugins:** `@eslint/js` only.
- **Rules:** `js.configs.recommended`.
- **TS rules:** none.
- **Parser:** ESLint default (Espree).
- **languageOptions:** `ecmaVersion: "latest"`, `sourceType: "module"`, Node
  globals.
- **Ignores:** `dist/**`, `node_modules/**`.
- `eslint .` runs from `reconcilekit/`, so any future `**/*.ts` block would
  cover both core `src/**` and `storefront/**`.

### 1b. Installed packages and versions

Root `reconcilekit/package.json`:

```text
"lint": "eslint ."
"@eslint/js": "10.0.1"
"eslint": "10.8.1"
```

Storefront `reconcilekit/storefront/package.json`:

```text
"typescript": "7.0.2"
```

Findings:

- ESLint: `10.8.1` at root.
- `@eslint/js`: `10.0.1` at root.
- TypeScript: `7.0.2` at root and storefront.
- `@typescript-eslint/*`: **none installed** in either package.
- Storefront has TypeScript but no ESLint dependency or lint script of its own.

### 1c. Node modules presence

```text
Test-Path reconcilekit/node_modules/@typescript-eslint              False
Test-Path reconcilekit/storefront/node_modules/@typescript-eslint   False
```

Both expected values confirmed.

## Part 2 — Baseline TS-lint violations

### Method and limitation

The literal suggested `npx --yes @typescript-eslint/parser@latest --version`
does not work because that package has no CLI binary. ESLint 10 also uses flat
config, so the legacy `--no-eslintrc --parser` example is not applicable.

Instead, a **scratch directory under `%TEMP%`** was used. Nothing in the repo
was installed or modified.

Scratch toolchain:

```text
eslint                              10.8.1
@typescript-eslint/parser           8.72.0
@typescript-eslint/eslint-plugin    8.72.0
typescript (scratch, peer-chosen)   6.0.3
```

Scratch config used `...tseslint.configs["flat/recommended"]` with
`**/*.ts`, then linted `src/**/*.ts` and `test/**/*.ts` from
`reconcilekit/storefront/`. No `--fix` was run.

**Critical limitation:** `@typescript-eslint` 8.72.0 declares peer
`typescript >=4.8.4 <6.1.0`. With the repo's TypeScript 7.0.2 installed, the
plugin aborts:

```text
typescript-eslint does not support TS 7.0.
Error: typescript-eslint does not support TS 7.0.
```

The counts below were therefore produced with the parser's TypeScript 6.0.3
peer. They are the best available baseline, but the exact TypeScript-7 run is
unavailable until the toolchain supports TS 7.1 (or a TS 6 side-by-side alias is
adopted).

### 2a/2b. Violation table

Preset default severity is **error** for every rule below. The “warn-only”
column describes the recommended f.2b posture, not the preset default.

| Rule                                       | Violations | Files affected | Severity / disposition                                            |
| ------------------------------------------ | ---------: | -------------: | ----------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`       |          0 |              0 | Not triggered; preset error if triggered                          |
| `@typescript-eslint/no-unused-vars`        |        153 |             27 | Preset error; 122 test / 31 src; warn-only if f.2b overrides      |
| `@typescript-eslint/no-non-null-assertion` |          0 |              0 | Not triggered; preset error if triggered                          |
| `@typescript-eslint/ban-ts-comment`        |          0 |              0 | Not triggered; preset error if triggered                          |
| `@typescript-eslint/no-empty-interface`    |          0 |              0 | Not active in v8; renamed to `no-empty-object-type`               |
| `@typescript-eslint/prefer-as-const`       |          0 |              0 | Not surfaced by the recommended preset                            |
| `@typescript-eslint/no-empty-object-type`  |         11 |              2 | Preset error; 10 in `providers/contracts.ts`, 1 in `ui/client.ts` |
| `@typescript-eslint/no-unused-expressions` |          1 |              1 | Preset error; `test/reconcile-server.test.ts:104`                 |
| **Total**                                  |    **165** |         **29** | All errors under `flat/recommended`; warn-only if f.2b overrides  |

Severity under the actual scratch run:

```text
total=165 errors=165 warnings=0
```

Warn-mode override run (all typescript-eslint recommended rules set to `warn`):

```text
warn_exit=0
total=165 errors=0 warnings=165
```

Violation distribution:

| Surface              | Violations |
| -------------------- | ---------: |
| `storefront/src/**`  |         42 |
| `storefront/test/**` |        123 |

`no-unused-vars` detail:

- 147 are “defined but never used”; 6 are “assigned a value but never used”.
- 122 are in tests, 31 in source.

Highest-volume files:

| File                                         | Violations |
| -------------------------------------------- | ---------: |
| `test/marketplace/input-validation.test.ts`  |         33 |
| `test/marketplace/transactions.test.ts`      |         25 |
| `test/marketplace/payment-sources.test.ts`   |         14 |
| `src/marketplace/providers/mock-provider.ts` |         14 |
| `test/marketplace/ticketing.test.ts`         |         11 |
| `test/marketplace/wallet-lifecycle.test.ts`  |         11 |
| `test/marketplace/webhook-harness.test.ts`   |          7 |
| `test/marketplace/gift-card.test.ts`         |          6 |
| `src/marketplace/seed.ts`                    |          5 |
| `test/marketplace/csv-intake.test.ts`        |          4 |

No parse/fatal errors were reported.

### 2c. Frozen-file exposure

Storefront frozen paths:

```text
storefront/src/marketplace/wallet.ts
storefront/src/ids.ts
storefront/src/marketplace/types.ts
storefront/src/marketplace/demo-scenarios.ts
```

**Zero violations** in those files.

Core frozen path `reconcilekit/src/**` has **one** violation:

```text
src/cli/ux.test.ts:90:5
@typescript-eslint/no-unused-vars
'options' is defined but never used.
```

Because core `src/**` is frozen, a config that lints `**/*.ts` must exclude
`src/**` (from the `reconcilekit/` config root), or be scoped to
`storefront/**/*.ts`. This is a hard config requirement for f.2b, not a
suggestion.

## Part 3 — Config shape recommendation

**C — large blast radius.**

Reasons:

- 165 violations exceeds the 100+ threshold.
- 153 of 165 are `no-unused-vars`; this is a cleanup task, not a config-only
  switch.
- One violation sits in frozen core `src/**`, so the config must exclude that
  tree.
- The latest parser cannot run against TypeScript 7.0.2 at all.

Proposed split:

1. **Toolchain ruling (blocking):** choose a supported TypeScript 7 path before
   installing `@typescript-eslint`.
2. **f.2b.1 — config only:** add TypeScript parser/plugin and
   `flat/recommended` in warn mode; scope to `storefront/**/*.ts`; keep
   `src/**` excluded; zero code changes. This makes CI green with 165
   warnings.
3. **f.2b.2 — cleanup:** remove or justify the 165 warnings in non-frozen
   storefront files. This may need its own split, especially the 123 test
   violations.

Do not attempt a single f.2b increment that installs the preset in error mode.
It would turn CI red immediately.

## Part 4 — Downstream CI impact

`.github/workflows/reconcilekit-ci.yml`:

- The **core** job runs `npm run lint` (lines 62–63).
- The **storefront** job has Test and Typecheck, but no lint step.
- The root lint command therefore covers the storefront TS tree once the root
  config includes it.

CI posture:

- **Warn mode:** `eslint` exits 0 on warnings. CI stays green. Verified with
  the scratch warn config: `warn_exit=0`, 165 warnings.
- **Error mode:** `eslint` exits 1. CI turns red on 165 violations. Not
  acceptable for f.2b without the cleanup increment.
- **Dependency install:** root `npm ci` must install the parser/plugin. With
  TypeScript 7.0.2, the parser peer range `<6.1.0` is not satisfied, and the
  plugin aborts. CI can fail before lint runs unless the toolchain is resolved.
  Do not use `--legacy-peer-deps` as a silent workaround.

Recommendation: **warn mode** for f.2b.1. Enforcement is a separate decision
after f.2b.2.

## Part 5 — Package install scope

**Recommendation: root `reconcilekit/package.json`.**

Reasons:

- The ESLint config already lives at the root.
- `eslint`, `@eslint/js`, and the `lint` script already live at the root.
- The lint command is `eslint .` from the root; the config and its plugins
  should travel with it.
- Storefront has TypeScript but no ESLint dependency or lint script. Installing
  there would split lint ownership across two package trees.

Caveat: both root and storefront pin TypeScript `7.0.2`, so moving the install
to the storefront does **not** avoid the peer blocker. The TypeScript 7
toolchain decision comes first.

A supported-looking path exists for TypeScript 7 side-by-side operation:
alias `typescript` to `@typescript/typescript6@^6.0.2` for tools that still
need the 6.0 API, and add `@typescript/native` for the 7.0 `tsc`. That changes
which compiler `tsc` resolves to and is an owner-level decision, not an f.2b
config change. The alternative is to wait for typescript-eslint support for
TS 7.1.

## Open questions requiring owner ruling

1. **TypeScript 7 lint path:** wait for `@typescript-eslint` TS 7.1 support,
   adopt the TS 6 alias side-by-side layout, or use a different linter. This
   blocks all install work.
2. **Core scope:** confirm f.2b is storefront-only. If core `src/**` is included,
   the config must exclude it because of the frozen
   `src/cli/ux.test.ts:90` violation.
3. **Warn-mode acceptance:** is a 165-warning backlog acceptable for f.2b.1, or
   should f.2b wait until the cleanup is ready?
4. **Test coverage:** 123 of 165 violations are in `storefront/test/**`. Confirm
   tests are in scope immediately, or stage source first (`42` violations) and
   tests second.
5. **Empty marker interfaces:** the 11 `no-empty-object-type` hits may be
   intentional declaration shapes in `providers/contracts.ts`; confirm whether
   cleanup is safe or whether the rule needs a documented, named exception.
