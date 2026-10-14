# Publishing ReconcileKit

This is the procedure for publishing the `reconcilekit` package to npm. It
assumes the repository is in the state described by `PHASE_4_DISTRIBUTION_READINESS.md`
and that the four standing guards are green.

Publishing is a deliberate, manual action. It is not automated by CI.

---

## 0. One-time prerequisites

Before the first publish, confirm:

- [ ] You are logged in to npm as the account that owns the `reconcilekit`
      package name: `npm whoami` should print your npm username.
- [ ] The name `reconcilekit` is either unclaimed or owned by you. Check with:
      `npm view reconcilekit` — if it returns metadata, the name is taken and
      this procedure cannot proceed as written.
- [ ] Two-factor authentication is enabled on your npm account and configured
      for **auth-and-writes**, not just auth.
- [ ] You have run `npm login` in this shell session at least once since the
      last credential rotation.

If the name `reconcilekit` is taken, stop and decide: rename the package,
publish under a scope (e.g. `@youruser/reconcilekit`), or open a support
request with the current owner. Do not attempt a publish under a name you do
not control.

## 1. Pre-flight checklist

Every box must be ticked before step 2.

- [ ] `cd reconcilekit`
- [ ] `npm run typecheck` — clean
- [ ] `npm test` — **677/677** or the current expected count
- [ ] `npm run lint` — clean
- [ ] `npm run format:check` — clean
- [ ] `node scripts/smoke.mjs` — prints `SMOKE TEST PASSED`
- [ ] `npm pack --dry-run` — tarball contents look correct: - `README.md`, `dist/**`, `examples/quickstart/**`, `package.json` - no `src/`, no `test/`, no configs
- [ ] `git status --short` — no uncommitted changes under `reconcilekit/`;
      the branch you are on is the branch you intend to publish from
- [ ] `git log -1 --oneline` — this is the commit you are publishing

The `prepublishOnly` script will run the four guards again during the actual
publish. If any of them fail at that point, the publish aborts before any
network call. This checklist exists so the publish does not reach that stage
with a fixable problem.

## 2. Publish a dry run first

Always run the dry run. It executes the full local pipeline (`prepublishOnly`,
`prepack`, `build`) but stops before uploading.

```bash
npm publish --dry-run
```

Expected end of output:

```text
+ reconcilekit@0.1.0
```

If you see `npm warn publish "bin[...]" script name ... was invalid and removed`
or any other `npm warn publish errors corrected` line, stop. That warning means
the published tarball would differ from what you tested. Fix the package.json
problem first, re-run the dry run, and only proceed when the warning is gone.

## 3. Publish

```bash
npm publish
```

Expected end of output:

```text
+ reconcilekit@0.1.0
```

2FA prompt will appear; enter the current code. Do not paste a code from a
previous session.

If the network drops mid-upload, npm will report the failure and no version
will be published. Re-run `npm publish` once connectivity is restored.

## 4. Post-publish verification

Within a minute of the publish succeeding:

```bash
# Wait a few seconds for the registry to propagate
npm view reconcilekit version
```

Expected: the version you just published.

Then confirm the package installs and runs from a clean directory:

```bash
cd "$(mktemp -d)"
npm init -y > /dev/null
npm install reconcilekit
npx reconcilekit --help
```

The `--help` output must show the ReconcileKit help text. If it does not, the
published tarball is broken and step 5 applies immediately.

Optional: verify the full quick-start from `README.md` runs against the
packaged fixtures:

```bash
npx reconcilekit \
  --merchant node_modules/reconcilekit/examples/quickstart/merchant.csv \
  --provider node_modules/reconcilekit/examples/quickstart/provider.json \
  --timestamp-field paid_at \
  --currencies NGN
```

Expected: a report ending in `1. MATCH - merchant TEST-001 (rec_001) | provider TEST-001 (123456789)`.

## 5. Versioning policy

`reconcilekit` follows semantic versioning:

- **MAJOR** — a breaking change to the CLI contract, the merchant CSV contract,
  the provider JSON contract, the outcome vocabulary, or the discrepancy codes.
- **MINOR** — a new option, a new adapter, a new discrepancy code, or a new
  provider added without breaking existing invocations.
- **PATCH** — a bug fix that does not change any documented contract.

The engine's matching semantics (exact reference equality only, no fuzzy
matching) are part of the contract. Changing them would be a MAJOR bump.

Update `version` in `reconcilekit/package.json` before the publish. Do not
publish two different tarballs under the same version number — the registry
will reject the second.

## 6. Rollback

If a published version is broken:

**Within the first 72 hours** — unpublish is available but strongly discouraged.
It breaks consumers who have already installed the version. Prefer a patch.

**The preferred rollback** is a patch release:

1. Fix the defect on `main`.
2. Re-run the pre-flight checklist.
3. Bump `version` to `X.Y.Z+1` (patch).
4. `npm publish`.

Consumers running `npm install reconcilekit@latest` will receive the fix.

**If the broken version should be marked untrustworthy** without deleting it:

```bash
npm deprecate reconcilekit@X.Y.Z "Broken release — install @X.Y.Z+1 instead"
```

Deprecated versions still install if requested by exact version, but
`npm install reconcilekit` and `npm update` avoid them. The deprecation message
is shown to anyone who tries.

**If the publish was an accident** (wrong version, wrong branch, wrong commit):

- If less than 72 hours have passed and no one has installed the version, you
  may `npm unpublish reconcilekit@X.Y.Z`. Verify with `npm view reconcilekit@X.Y.Z`
  that no one has downloaded it.
- If more than 72 hours have passed, or the version has downloads, treat it as
  a permanent release and publish a patch.
- Never delete a version and re-publish the same version number. The registry
  blocks this by design.

## 7. What NOT to publish

The `reconcilekit/storefront/` package is a demonstration surface and is
**not** published. It has no `bin`, no `files` whitelist, and no intention of
being distributable. Do not run `npm publish` from inside `storefront/`.

If the storefront ever becomes publishable as a separate artifact, it will
need its own distribution-readiness pass mirroring 4A–4D. Until then, it stays
private.

## 8. Automating the publish (not yet implemented)

The current workflow (`​.github/workflows/reconcilekit-ci.yml`) does not publish.
Publishing is manual for three reasons:

1. The `reconcilekit` name ownership has not been confirmed. Automation would
   fail on the first run if the name is taken.
2. Manual publishes keep a human in the loop for the version-bump decision.
3. npm's 2FA requirement for writes means an automated token would need to be
   configured carefully, and that configuration is not in place.

When publish cadence justifies automation, the pattern is:

- Add a manual-trigger workflow (`workflow_dispatch` only, never `push`) that
  runs the pre-flight checklist as a job.
- Grant it an `NPM_TOKEN` secret scoped to the package.
- Configure npm to accept the token despite 2FA by using an automation token
  (`npm token create --read-only=false --automation`).
- Merge only after the first manual publish has succeeded.

That is a separate increment; it is not scoped by this document.

---

## Quick reference

```bash
# Pre-flight
cd reconcilekit
npm run typecheck && npm test && npm run lint && npm run format:check
node scripts/smoke.mjs
npm pack --dry-run

# Publish
npm publish --dry-run   # verify no auto-correct warnings
npm publish             # 2FA prompt

# Verify
npm view reconcilekit version
cd "$(mktemp -d)" && npm init -y > /dev/null && npm install reconcilekit
npx reconcilekit --help

# Rollback (only if needed)
npm deprecate reconcilekit@X.Y.Z "message"
# then fix and publish X.Y.(Z+1)
```
