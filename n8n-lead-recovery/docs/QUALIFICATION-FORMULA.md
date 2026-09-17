# Verified Leads — Qualification Formula Contract (Q:U)

Owner contract for the **Q:U per-column ARRAYFORMULAs** (Verified Leads, gid=102). This document
is frozen: any formula change must follow §7 (Change Protocol) before the sheet edit is applied.

---

## §1 Current Formula (D1)

### 1.1 Extraction status

**D1 — CLOSED.**

The operator captured the original formulas during the Gemini-assisted sheet backup, and they are
recorded **verbatim** in §1.2. Path B (operator capture) was used; the Sheets API path
(`valueRenderOption=FORMULA` with `GOOGLE_ACCESS_TOKEN`) was unnecessary.

The reconstructed behavior in the earlier version of this doc was **inaccurate**. The actual
original formulas reveal:

- a **90-point** scoring model (not 60), with `rating`/`review_count` as scored signals (not
  cap-gates);
- **score-threshold qualification** (`>=70` QUALIFIED), not signal-gated;
- a **VLOOKUP-based `target_niche`** resolved per-search via `'Search Inputs'!A:B` (not a
  hardcoded HVAC check).

§1.3 now describes the actual original behavior, not the reconstruction. No further extraction is
required.

### 1.2 Original formulas (verbatim, pre-D2 state)

The five original per-column formulas captured during the Gemini sheet backup — the state before
any D2 edit attempt:

```text
Q1 (has_website):
={"has_website"; ARRAYFORMULA(IF(A2:A="", "", IF(LEN(TRIM(I2:I))>0, TRUE, FALSE)))}

R1 (has_phone):
={"has_phone"; ARRAYFORMULA(IF(A2:A="", "", IF(LEN(TRIM(H2:H))>0, TRUE, FALSE)))}

S1 (target_niche):
={"target_niche"; ARRAYFORMULA( IF(A2:A="","", LOWER(TRIM(C2:C)) = LOWER(TRIM(IFERROR(VLOOKUP(O2:O,'Search Inputs'!A:B,2,FALSE),""))) ) )}

T1 (score):
={"score";
 ARRAYFORMULA(
   IF(A2:A="","",
      (Q2:Q=TRUE)*20 +
      (R2:R=TRUE)*15 +
      (IFERROR(VALUE(K2:K),0)>=50)*20 +
      (IFERROR(VALUE(J2:J),0)>=4)*10 +
      (S2:S=TRUE)*15 +
      ((LEN(TRIM(B2:B))>0)*(LEN(TRIM(G2:G))>0))*10
   )
 )}

U1 (qualification_status):
={"qualification_status"; ARRAYFORMULA( IF(A2:A="","", IF(T2:T>=70,"QUALIFIED", IF(T2:T>=50,"REVIEW","DISQUALIFIED") ) ) )}
```

### 1.3 Actual original behavior (corrected — replaces the earlier reconstruction)

The earlier reconstruction in this doc (and in `reports/ENRICHMENT-PREFLIGHT-V1.md §1`) described
a 20/15/25 model with `rating`/`review_count` as cap-gates. **That was wrong.** Using the verbatim
originals in §1.2, the accurate description is:

**a. The original T1 was a SIX-signal, 90-point model:**

| Signal | Points | Condition |
| --- | --- | --- |
| `has_website` (Q=TRUE) | 20 | `LEN(TRIM(I2:I))>0` |
| `has_phone` (R=TRUE) | 15 | `LEN(TRIM(H2:H))>0` |
| `review_count >= 50` (K) | 20 | `IFERROR(VALUE(K2:K),0)>=50` |
| `rating >= 4` (J) | 10 | `IFERROR(VALUE(J2:J),0)>=4` |
| `target_niche` (S=TRUE) | 15 | niche matches the resolved search niche via VLOOKUP |
| name + address present (B + G) | 10 | `(LEN(TRIM(B2:B))>0)*(LEN(TRIM(G2:G))>0)` |
| **Max** | **90** | ... |
| **Pre-enrichment ceiling** (no rating/reviews) | **60** | 20+15+15+10 |

**b. The original U1 was score-threshold-based, NOT signal-gated:**

- `T >= 70` → `QUALIFIED`
- `T >= 50` → `REVIEW`
- `T < 50` → `DISQUALIFIED`

**c. The original S1 used a VLOOKUP against `'Search Inputs'!A:B`**, keyed on the lead's
`search_input_id` (column O), to resolve the **per-search intended niche**. This made the pipeline
**niche-agnostic** — a lead captured in a plumbing search would resolve `target_niche` against
"plumbing", not "HVAC".

**d. This explains the observed zero `QUALIFIED`:** with `rating` and `review_count` hard-coded to
`0` by FSQ/OSM (`src/prospect-finder-embedded-code.js`), pre-enrichment T1 was pinned at 60 —
below the `>=70` threshold. GPL supplied rating/reviews but returned `403` (billing). **No path to
QUALIFIED existed.**

The reconstruction in the earlier report (and the previous version of this doc) was inaccurate;
the corrected understanding is documented here for audit purposes.

---

## §2 Revision History

| Date | Change |
| --- | --- |
| (initial) | Formula original — see §1.2 for verbatim text. Six-signal 90-point score model; `>=70` QUALIFIED (`rating`/`review_count` scored signals). |
| 2026-09-17 | D2 revision designed: remove `rating`/`review_count` as required signals; add `operating_status='open'` as the QUALIFIED gate. Intended as a unified Q:U spill. |
| 2026-09-17 | First sheet edit failed with **#REF!** — sibling per-column formulas in R1:U1 blocked the unified spill. |
| 2026-09-17 | Second edit cleared R1:U1 and applied the unified spill. Introduced two regressions: dropped the Search Inputs VLOOKUP for `target_niche`; used `OR()`/`AND()`, which do not vectorize per-row inside ARRAYFORMULA. |
| 2026-09-17 | **Final state:** per-column structure restored; VLOOKUP preserved; `OR`/`AND` corrected to the `+`/`*` idiom. See §3 for the live formulas. |

---

## §3 Current Formula (live)

The Verified Leads tab uses **five sibling per-column ARRAYFORMULAs** in **Q1:U1** — one formula
per column, each spilling its own data rows. **It is not a single unified spill.**

### Q1 — has_website

```text
={"has_website"; ARRAYFORMULA(IF(A2:A="", "", IF(LEN(TRIM(I2:I))>0, TRUE, FALSE)))}
```

### R1 — has_phone

```text
={"has_phone"; ARRAYFORMULA(IF(A2:A="", "", IF(LEN(TRIM(H2:H))>0, TRUE, FALSE)))}
```

### S1 — target_niche (VLOOKUP restored)

```text
={"target_niche"; ARRAYFORMULA(IF(A2:A="","", LOWER(TRIM(C2:C)) = LOWER(TRIM(IFERROR(VLOOKUP(O2:O,'Search Inputs'!A:B,2,FALSE),"")))))}
```

### T1 — score (D2 model: 20+15+25+25+15 = 100)

```text
={"score"; ARRAYFORMULA(IF(A2:A="","", (Q2:Q=TRUE)*20 + (R2:R=TRUE)*15 + (S2:S=TRUE)*25 + (TRIM(Y2:Y)="open")*25 + (IFERROR(VALUE(Z2:Z),0)>=0.7)*15))}
```

### U1 — qualification_status (D2 gates, vectorized OR/AND)

```text
={"qualification_status"; ARRAYFORMULA(IF(A2:A="","", IF(((LEN(TRIM(H2:H))=0)+(S2:S<>TRUE)+(TRIM(Y2:Y)="closed"))>0, "DISQUALIFIED", IF(((LEN(TRIM(I2:I))>0)*(LEN(TRIM(H2:H))>0)*(S2:S=TRUE)*(TRIM(Y2:Y)="open"))=1, "QUALIFIED", "REVIEW"))))}
```

### Notes on the five-column structure

- These are **five separate formulas**, one per column (Q1, R1, S1, T1, U1).
- **R1:U1 must each hold their own formula.** A unified spill entered into Q1 would collide with
  the sibling formulas already in R1:U1 — this was the cause of the earlier **#REF!**.
- The **OR/AND inside U1 use the `+`/`*` vectorized idiom** because Google Sheets' `OR()` and
  `AND()` are scalar functions, not per-row array functions; inside an ARRAYFORMULA they reduce to
  a single value and break per-row evaluation.

References (Verified Leads columns): `A`=`lead_id`, `B`=`business_name`, `C`=`niche`,
`G`=`address`, `H`=`phone`, `I`=`website`, `J`=`rating`, `K`=`review_count`, `O`=`search_input_id`,
`Y`=`enrichment_business_status` (mirrored `operating_status`), `Z`=`enrichment_confidence`
(case (a) — direct read of the existing H.6 mirrored column; no new columns added).

Scoring (D2): `website` 20 + `phone` 15 + `niche` 25 = **60 (pre-enrichment ceiling preserved)**;
`operating_status='open'` +25 → **85**; `enrichment_confidence≥0.7` +15 → **100**.

---

## §4 Signal Definitions

| Sheet col | Column | Meaning | Source |
| --- | --- | --- | --- |
| Q (16) | `has_website` | TRUE if `website` (col I) non-empty after trim | Verified Leads row (n8n-written input col) |
| R (17) | `has_phone` | TRUE if `phone` (col H) non-empty after trim | Verified Leads row (n8n-written input col) |
| S (18) | `target_niche` | TRUE if `niche` (col C) equals the **resolved search niche** — `VLOOKUP(O,'Search Inputs'!A:B,2,FALSE)` — case-insensitive. **Not a hardcoded HVAC check.** | Verified Leads row + `Search Inputs` tab (VLOOKUP) |
| T (19) | `score` | 0–100 composite (website 20, phone 15, niche 25, open 25, confidence 15) | Computed by formula |
| U (20) | `qualification_status` | QUALIFIED / REVIEW / DISQUALIFIED — **signal-gated** (via `+`/`*` idioms), not score-threshold | Computed by formula |
| Y (24) | `enrichment_business_status` | `open` / `closed` / `` (empty = not yet enriched) — mirrors `operating_status` from Overture (H.1–H.2, H.6) | Enrichment output (n8n-written, H.6 schema) |
| Z (25) | `enrichment_confidence` | 0–1 match confidence (1.0 phone/website, 0.7 name_exact, 0.4 name_fuzzy) | Enrichment output (n8n-written, H.6 schema) |

Column names verified against `src/schema.js` `VERIFIED_COLUMNS` (28 columns): index 24 =
`enrichment_business_status`, index 25 = `enrichment_confidence`. Formula input columns
(`C`,`G`,`H`,`I`,`J`,`K`,`O`,`Y`,`Z`) are all n8n-written; the formula output columns (`Q`–`U`)
remain formula-owned and are **never** written by n8n (unchanged ownership).

---

## §5 Thresholds and Rationale

- **The QUALIFIED gate no longer depends on `rating`/`review_count`.** Score can never exceed 60
  pre-enrichment; qualification now rests on `has_website` + `has_phone` + `target_niche` +
  `operating_status='open'` (and the score reward for confidence ≥ 0.7).
- **The score model was rebalanced.** The original T1 was 20/15/20/10/15/10 (six signals, max 90).
  The D2 T1 is 20/15/25/25/15 (five signals, max 100): `target_niche` went **15 → 25**;
  `rating`/`review_count` were **replaced** by `operating_status` (25) and `confidence` (15);
  the name+address term was **removed**.
- **Pre-enrichment ceiling is still 60** (website 20 + phone 15 + niche 25), preserved for
  historical comparison.
- **Enriched open leads land in 85–100** (`open` +25 → 85; `confidence≥0.7` +15 → 100).
- **Dropped / changed signals:**
  - `rating` and `review_count` were dropped as required signals — the intended D2 change
    (they were the only path above the old `>=70` threshold, and the only providers that supply
    them either hard-code 0 (FSQ/OSM) or 403 (GPL, billing)).
  - **`name` + `address` presence was dropped from the score** as an **unintended** consequence of
    the model change. This is a minor deviation from pre-D2 behavior and is documented as such;
    it is not requested D2 behavior and can be re-added as a scored signal if the operator wants
    parity.
  - The **Search Inputs VLOOKUP for `target_niche` is PRESERVED** (not dropped) — confirmed live
    in §3 S1.
- **May be added later:** `email_verified` / `email` presence (Hunter/AgentData) as an additive
  signal (e.g. +10 scored contact completeness) — explicitly deferred out of V1; the formula is
  intentionally authored without those columns today.

---

## §6 Sequencing Note

- **Enrichment (H.8) runs AFTER qualification** (Option A confirmed). Q:U is computed on the
  pre-enrichment row state; the enrichment pass then writes business/contact signals downstream.
- **Pre-enrichment leads sit at score 60 → REVIEW** (60 ≥ 50, < 70 under the original
  threshold rule; REVIEW under the D2 signal gates because `Y` is empty → not `open`, not
  `closed`).
- **The formula does not require enrichment to produce valid output.** With `Y`/`Z` empty the
  formula still emits correct Q–T and a deterministic U for every row; empty rows render blank
  (no `#ERROR`).
- **After H.8 populates `Y='open'`**, the same rows promote to QUALIFIED on the next
  recalculation (no volatile functions — recalculation happens on edit/insert, which enrichment
  writes trigger).
- **`Y='closed'`** is a hard disqualifier independent of score/other signals.

---

## §7 Change Protocol

Any future formula change requires ALL of the following, in order:

1. A new entry in §2 (Revision History) with the date and a one-line summary.
2. A new formula block in §3 (previous blocks kept for audit).
3. The corresponding update to this document committed **before** the sheet edit is applied.
4. Re-verification of §5 rationale (weights, gates, dropped/added signals) against operator intent.
5. Respect the **five-cell structure**: changes apply per-column (Q1/R1/S1/T1/U1), never as a
   unified spill into Q1 (sibling formulas will collide — #REF!).

The formulas are a **frozen contract** — same authority as the positional schemas. Editing the
sheet without a committed doc update is a freeze breach.

---

## §8 Sheet-Edit Instructions (operator)

> Unlike a single-cell edit, this procedure requires **five cell edits, not one**. The Verified
> Leads tab uses five sibling per-column formulas, not a single spill. Attempting a unified spill
> will fail with #REF!.

1. Open
   `https://docs.google.com/spreadsheets/d/1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ/edit#gid=102`.
2. Verify Q1:U1 contain five independent per-column formulas (each starts with
   `={"header"; ARRAYFORMULA(...)}`). If Q1 currently holds a unified spill that renders R1:U1 as
   part of its output, **clear R1:U1 first**.
3. For each of Q1, R1, S1, T1, U1:
   a. Click the cell
   b. Select the entire formula (Ctrl+A inside the formula bar)
   c. Paste the corresponding §3 block for that cell
   d. Press Enter
   e. Confirm the header row renders as expected
4. After all five cells are entered, verify:
   - Q1:U1 headers are: `has_website`, `has_phone`, `target_niche`, `score`,
     `qualification_status`
   - No cell shows `#ERROR`, `#REF!`, `#NAME?`, `#VALUE!`, `#N/A`
   - Any data rows resolve cleanly; blank rows stay blank
5. **Backup before editing:** copy the current formula text from each cell to a text file. Google
   Sheets version history (File → Version history) is the ultimate rollback, but a text backup is
   faster to restore from.
6. **Spot-check with real data:**
   - A lead with website + phone + matching niche and empty Y/Z → **score 60, status REVIEW**
   - Same with `Y="open"` → **score 85, status QUALIFIED**
   - Same with `Y="open"` and `Z >= 0.7` → **score 100, status QUALIFIED**
   - A lead with `Y="closed"` → **status DISQUALIFIED**
   - A lead without phone → **status DISQUALIFIED**
7. If any row shows `#ERROR`, screenshot and report — do not leave the sheet broken.