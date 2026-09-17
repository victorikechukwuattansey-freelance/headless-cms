# D2-FORMULA Workstream Report — Qualification Formula Revision

**Date:** 2026-09-17
**Workstream:** D2-FORMULA — Qualified/Review/Disqualified rating source for Verified Leads
**Prompt completion status:** **PARTIAL** (D1 extraction operator-deferred; documentation,
design, and repository changes complete)

---

## 1. Completion state

| Prompt section | Status |
| --- | --- |
| D1 — Extract current formula | **PARTIAL (operator-deferred)** — Sheets API unavailable (`GOOGLE_ACCESS_TOKEN` unset on host); Path B applies; placeholder + reconstruction written to `docs/QUALIFICATION-FORMULA.md §1` |
| Design (Option 3) | **COMPLETE** — see §2 |
| Document (`docs/QUALIFICATION-FORMULA.md`) | **COMPLETE** — created with §1–§8 |
| Update REPORT.md + README.md | **COMPLETE** — D2 line added (RESOLVED), key-documents bullet added |
| Test/fixture updates where old formula is encoded | **NONE REQUIRED** — verified: no test or fixture encodes formula behavior (§4) |
| Gates | **PASS** — see §5 |
| Sheet edit | **NOT PERFORMED** — operator action per §8 of the doc |

## 2. Design decision

**Option 3 chosen (operator decision), recorded in `docs/QUALIFICATION-FORMULA.md §3–§5`:**

- **Removed as required signals:** `rating` and `review_count`. They were the only signals that
  could clear the old QUALIFIED `score` cap, and every live provider either blocks on billing
  (Google Places `403`) or hard-codes them to `0` (FSQ/OSM) — so the pipeline was pinned at
  **zero QUALIFIED** in the observed S-HVAC-001 run (57 leads). Removing them makes the pipeline
  reach QUALIFIED **without GCP billing**.
- **Added as the QUALIFIED gate:** `operating_status='open'`, read directly from the existing
  mirrored column `enrichment_business_status` (Verified Leads col Y, index 24) — **case (a)**,
  no new column required (mirror already created by H.1–H.2/H.6 and confirmed in
  `src/enrichment-business.js`: `enrichment_business_status = best.operatingStatus`,
  `'open'/''/closed'`).
- **Scoring (reconstructed weights preserved, enrichment signals additive):**
  - `has_website` 20 + `has_phone` 15 + `target_niche` 25 → **60 pre-enrichment ceiling preserved**
  - `operating_status='open'` +25 → **85**
  - `enrichment_confidence ≥ 0.7` +15 → **100**
- **U (qualification_status) precedence:**
  1. `DISQUALIFIED` — phone missing OR niche ≠ HVAC OR `operating_status='closed'`
  2. `QUALIFIED` — website AND phone AND niche AND `operating_status='open'`
  3. `REVIEW` — otherwise (including enrichment-not-run / status empty)
- **Sequencing:** enrichment (H.8) runs after qualification; pre-enrichment leads stay `REVIEW`
  until `open` is written; recalc promotes them without volatile functions (edit/insert-triggered,
  which enrichment writes already cause).

## 3. Files changed

| File | Change |
| --- | --- |
| `docs/QUALIFICATION-FORMULA.md` | **Created.** §1 D1 placeholder + reconstruction, §2 revision history (incl. 2026-09-17 entry), §3 revised formula (comment-header single ARRAYFORMULA for Q1), §4 signal definitions, §5 thresholds/rationale, §6 sequencing note, §7 change protocol, §8 sheet-edit operator instructions. |
| `REPORT.md` | §9 — added "RESOLVED via the D2-FORMULA workstream" row: D2 Option 3 RESOLVED. |
| `README.md` | §1.6 Key documents — added `docs/QUALIFICATION-FORMULA.md` row. |
| `reports/D2-FORMULA-REPORT.md` | This report. |

No workflow artifacts, manifest, `src/schema.js`, enrichment artifacts, or H.7/H.8 work touched.

## 4. Test/fixture verification (no edits needed)

Searched `ARRAYFORMULA|has_website|target_niche|score|qualification_status` across
`tests/*.test.js` and `fixtures/*.json`. Every hit is a **column-name list** or a **plain input
literal** — none asserts formula output semantics:

- `tests/handoff-engine.test.js` — `VERIFIED_FORMULA_FIELDS` (field-name contract), `lead_score` 91 copyliteral — unaffected.
- `tests/handoff-workflow.test.js` — column list + literal `has_website:'TRUE'`, `target_niche:'HVAC'` inputs — unaffected.
- `tests/harness-offline.test.js` — `VERIFIED_FORMULA_COLUMNS` deep-equal (name contract, unchanged), input literals — unaffected.
- `fixtures/*.json` — plain `.values` inputs / expected outputs, no Q:U behavior — unaffected.

Therefore **no test or fixture file was modified**.

## 5. Gates

| Gate | Result |
| --- | --- |
| `npm test` | PASS — see run output (baseline unchanged; no code touched). |
| `npm run verify:frozen` | PASS — manifest untouched, no rebuild. |
| `npm run security-check` / `enrichment:security` | PASS — no new secrets introduced (no env/scripts changed). |
| `git status` | Only the four expected files above. |

## 6. Operator action required

1. **D1 (optional but recommended):** paste the reigning Q1 ARRAYFORMULA into
   `docs/QUALIFICATION-FORMULA.md §1.2`, so the reconstruction in §1.3 can be confirmed against
   the verbatim text.
2. **Apply the formula (the actual sheet change):** follow `docs/QUALIFICATION-FORMULA.md §8`
   — open the spreadsheet (gid=102), replace Q1 with the §3 block, Enter, and spot-check.
3. Do **not** edit the sheet before the doc is committed (freeze contract).

## 7. Residual/deferred

- **H.7 / H.8** — not touched in this workstream (gated on the H.4-rev probe outcome).
- **Option 4** (email_verified / email presence from Hunter/AgentData as a scored-contact signal)
  — documented in `docs/QUALIFICATION-FORMULA.md §5` as a future additive, explicitly deferred.