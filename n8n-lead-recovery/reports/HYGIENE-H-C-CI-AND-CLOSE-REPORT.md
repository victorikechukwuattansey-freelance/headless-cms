# Hygiene Workstream Prompt H-C — CI + Close

**Date:** 2026-09-15
**Scope:** CI setup + REPORT §9 consolidation + PHASES append + final security scan + close.
**Constraints honored:** no push; no workflow JSON, frozen artifacts, `src/`, `scripts/`,
`tests/`, or `fixtures/` modified; `REPORT.md` changed only in §9 and the completion
statement; `docs/PHASES.md` appended only.

---

## 1. CI file created

**Path:** `.github/workflows/test.yml` (git root is the workspace root; `n8n-lead-recovery/`
is a subdirectory, so the job uses `defaults.run.working-directory: n8n-lead-recovery`).

**Contents:**

- Trigger: `push` to `main` + `pull_request`; no scheduled runs; no secrets in the file.
- `actions/checkout@v4` → `actions/setup-node@v4` with `node-version: 18`
  (matches `package.json` `engines: { node: ">=18" }` — declared, so not an open item).
- Steps:
  1. `npm install --no-audit --no-fund`
  2. `npm test`
  3. `npm run verify:frozen`
  4. `node scripts/security-check.js`

**Reconciliation with pre-existing file:** a `.github/workflows/test.yml` already existed
(`1162e80`, "H6", tracked) but differed from the H-C spec: it used Node 20, a
`cache: npm` step **without any lockfile** (would have failed — no `package-lock.json`
exists), and it had **no security gate**. The file was rewritten to the H-C spec: Node 18,
`npm install` (correct — no lockfile; `npm ci` unavailable), cache step removed, and the
security gate added.

**Deviation surfaced:** the H-C prompt's sample workflow (and gate list) called the gate
`npm run security-check`, but **no such npm script exists** — H-B established the real
command is `node scripts/security-check.js` (see `README.md` §1.5). The workflow therefore
invokes the real command. Adding a `security-check` npm alias is recorded as a candidate
follow-up (REPORT §9 item 17). If a lockfile is later committed, the workflow should switch
to `npm ci` (open item).

**Not run locally** — offline (unit/harness/frozen) steps were executed locally as the
equivalent gates (§6) since GitHub Actions cannot run from here.

---

## 2. REPORT.md §9 diff summary

`REPORT.md` §9 was consolidated from 11 flat rows into three labeled groups, each item
keeping a one-line scope + a `security | hygiene | coverage | CI | docs | ops` tag.

**CLOSED (4):** Foursquare token-shaped value (verified not a hardcoded secret; H-A scan) ·
~40 uncommitted artifacts (committed `a12d86a`) · README Google Places debt (rebased H-B
`744d0ea`) · missing credentials documentation (`docs/CREDENTIALS.md`, H-B).

**REPOSITIONED (7):** Prospect Finder coverage/hardening incl. the D7 Merge defect →
parked to the Prospect Finder GPL workstream (cited real path
`reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md` §D7 — see §8) · Approved Outreach
Handoff engine test · Overpass loop wiring · live execution in CI (offline-only CI added by
H-C; live deliberately stays out) · runner `verify_input` `failure_info` detail · run-report
archive decision · live seed + verify leg (post-freeze, credential-blocked).

**NEW (6):** workflow artifacts are n8n exports not API payloads (`docs/ARTIFACT-IMPORT.md`)
· Response Interpretation artifact lacks top-level `id` → UI import (`docs/ARTIFACT-IMPORT.md`)
· container durability via named volume (`docs/CONTAINER-RUNBOOK.md`) · credential-ID
migration on rebuild (runbook §2.4) · out-of-scope workspace projects (separate
workspace-level baseline) · missing `security-check` npm script (CI uses
`node scripts/security-check.js`).

The completion statement (§10) now adds a hygiene-workstream closure line.

---

## 3. PHASES.md rows appended

Three rows appended **only** (14-phase index untouched, not renumbered):

| phase | verdict | commit |
| --- | --- | --- |
| H-A | PASS | `a12d86a` |
| H-B | PASS | `744d0ea` |
| H-C | PASS | `cb16285` |

---

## 4. Final security scan

- `node scripts/security-check.js` → **exit 0** (PASS). Informational hits are the known
  env/`{{$credentials.value}}` reference patterns (`GOOGLE_PLACES_API_KEY` env name, Bearer
  token reference) — **no hardcoded secrets**. Consistent with the H-A baseline.
- Regex sweep over `README.md` + `docs\*.md` for
  `Bearer\s+[A-Za-z0-9_\-\.]{20,}|AIza|fsq3|eyJhbGci` → **zero matches**.
- No private URLs beyond `localhost`; no credential values in committed files.

---

## 5. Commit

- **Hash:** `cb16285`
- **Message:** `ci(n8n-lead-recovery): add offline CI workflow + consolidate open items, close hygiene workstream (H-C)`
- Scoped files: `.github/workflows/test.yml`, `n8n-lead-recovery/REPORT.md`,
  `n8n-lead-recovery/docs/PHASES.md`, this report.
- **Not pushed.** Tagging: repo has **no git tags** (convention undecided) — no tag created.

---

## 6. Gates

| gate | result |
| --- | --- |
| `npm test` | **PASS — 857/857** (0 fail / 0 cancelled / 0 skipped) |
| `npm run verify:frozen` | **PASS — 10/10** SHA-256 match |
| `node scripts/security-check.js` | **PASS — exit 0** |
| README/docs regex sweep | **PASS — 0 matches** |
| `.github/workflows/test.yml` YAML validity | **PASS** (parses) |
| Repo-scoped `git status` | **CLEAN** for `n8n-lead-recovery/` + `.github/` (only the 3 intended files dirty; remaining dirt is the documented out-of-scope workspace projects) |

---

## 7. Completion statement

The hygiene workstream is now closed in three committed increments: H-A git/security
baseline (`a12d86a`), H-B documentation rebase (`744d0ea`), and H-C CI + consolidation +
final scan (this report). All H-C gates pass. The offline CI reflects the documented scope
decision that live n8n execution remains out of CI. 

**PASS — HYGIENE WORKSTREAM COMPLETE.**

---

## 8. Statement of non-modification

This workstream modified **only** `.github/workflows/test.yml` (new CI file), `REPORT.md`
(§9 + completion statement), `docs/PHASES.md` (appended rows), and this report. No n8n
workflow JSON, frozen artifact, manifest, `src/`, `scripts/`, `tests/`, or `fixtures/` file
was touched. No live execution was run. No commits were pushed.

**Correction to prompt-cited paths (honest record):** the prompt referenced
`reports/PROSPECT-FINDER-ISOLATION-MATRIX-FINAL.md` for the D7 Merge defect. That file does
not exist. The D7 defect is recorded in `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`
(§D7 "Merge waits for all inputs"); the D7 row in
`reports/PROSPECT-FINDER-ISOLATION-MATRIX.md` is a performance note (555s), not the Merge
defect. REPORT.md §9 and this report cite the real path.