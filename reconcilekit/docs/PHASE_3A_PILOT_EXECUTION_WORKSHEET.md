# Phase 3A Operational Pilot — Execution Worksheet

**Project:** ReconcileKit (Core + Storefront)
**Type:** Operator instructions + evidence-capture worksheet (documentation only — no implementation performed)
**Date:** 2026-09-10
**Status:** `PENDING EXECUTION` — companion to `docs/PHASE_3A_LOCAL_OPERATOR_GUIDE.md`

This worksheet lets two independent real operators execute the same Phase 3A
reconciliation procedure and produce comparable evidence. It is both the
operator instructions and the structured evidence-capture record.

---

## 1. Purpose

Phase 3A is the **operational gate** for ReconcileKit: the first time the tool
runs in **real operator hands** against **real merchant exports** and
**Paystack test-mode provider evidence**. It exists to answer the Phase 3 plan's
first question (plan §3):

> can a real operator read a reconciliation report and answer "what did I ask
> for / what happened to my money / what did the provider say / what did
> ReconcileKit determine / what happens next"?

The pilot validates **operator usability and evidence sufficiency**, not merely
software correctness. Software correctness on synthetic data is already
established (operator CLI, preview, persisted run, exactly-once replay, and
deterministic findings all pass locally). Phase 3A is an **operational gate**
(plan §10, gate 3A): it measures whether operators can, on their own, prepare
inputs, run the procedure, and interpret results.

Phase 3A acceptance requires (plan §8, §10; input contract §11):

- at least 2 real operators recruited;
- Paystack test-mode accounts available;
- each operator completes at least 1 full end-to-end reconciliation;
- real merchant data is used;
- Paystack test-mode provider evidence is used;
- at least 1 real discrepancy is surfaced and understood;
- findings log is produced;
- decision record is produced.

> Synthetic/local execution has already passed. This worksheet is for real
> operator execution using real merchant exports and Paystack test-mode
> evidence.

Synthetic fixture execution does **not** satisfy Phase 3A. It is the local
readiness demonstration only.

## 2. Pilot Acceptance Criteria

Nothing below is complete yet. Do not mark an item during preparation or
rehearsal; mark it only when a real operator has completed it during the pilot.

- [ ] Operator 1 completed a full pilot run.
- [ ] Operator 2 completed a full pilot run.
- [ ] Real merchant CSV used.
- [ ] Paystack test-mode provider evidence used.
- [ ] Preview completed before recording.
- [ ] Persisted run completed.
- [ ] Replay/idempotency behavior verified where applicable.
- [ ] At least one real discrepancy surfaced.
- [ ] Discrepancy was understood with operator.
- [ ] Evidence was sufficient to explain the result.
- [ ] Findings captured.
- [ ] Pilot decision recorded.

## 3. Roles

### Operator

Runs the reconciliation procedure (steps in Sections 8 and 12) and explains
what they would normally do with the transaction evidence, using their own
words and their normal operational judgment.

### Observer / Pilot Owner

Records observations, questions, friction, discrepancies, and evidence
sufficiency. The Observer does not lead the Operator through the procedure and
does not volunteer conclusions before the Operator has formed their own.

The same person may perform both roles, but the worksheet must identify who
performed each role (Sections 7 and 12, preflight fields).

## 4. Required Inputs

### Merchant input

A **real merchant-side Paystack CSV export** — one row per payment — converted
to the frozen merchant CSV contract. The conversion reference and the
minor-unit rule are normative in `README.md` §Amount Units and
`PHASE_3A_PILOT_INPUT_CONTRACT.md` §3. Merchant contract columns (names exact
for the intake aliases; order-insensitive):

```
reference,amount,currency,status,occurred_at,source_reference
```

- `reference` is the merchant-side matching key.
- `amount` is integer **minor units** (NGN = kobo) unless the preview reports
  otherwise.
- `status` uses canonical values (`SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`,
  `UNKNOWN`); the intake also normalizes lower-case raw values.
- `source_reference` is optional evidence; it is preserved but is **not** a
  matching key.

Record for the merchant input:

| Field                             | Record |
| --------------------------------- | ------ |
| file name                         |        |
| export date/time                  |        |
| source/system                     |        |
| row count                         |        |
| currency                          |        |
| amount denomination               |        |
| timestamp field                   |        |
| reference field                   |        |
| status vocabulary                 |        |
| reference populated consistently? |        |

### Provider evidence

For Wave 1, use **Paystack test-mode evidence**.

Allowed:

- `--provider <Paystack Verify JSON>` — a single Verify response object or an
  array of them (file mode).
- `--live-paystack` — fetch Paystack test-mode transactions live (explicit
  network opt-in; reads `RECONCILEKIT_PAYSTACK_SECRET_KEY`, fallback
  `STOREFRONT_PAYSTACK_SECRET_KEY`; the secret is never printed).

Not allowed:

- Paystack dashboard CSV as `--provider`.

Why provider CSV is not accepted by the current pilot path: the operator CLI
accepts only Paystack Verify JSON (file mode) or `--live-paystack`. More
fundamentally, a provider CSV cannot be reconciled structurally — it carries no
deterministic join anchor against merchant CSV rows (blocker analysis §5;
guide "Why provider CSVs are rejected"). The accepted engine joins on Paystack
`reference`, not on CSV row order or a manual amount heuristic; treating a
provider CSV as evidence would mean guessing the join, which this project
rejects. Export the transactions as Paystack Verify JSON, or fetch them live in
test mode. Do not introduce an alternative join strategy.

## 5. Identifier / Join-Honesty Rules

Frozen identifier semantics (concise; normative in the Phase 2 freeze §5 and
input contract §6):

- `transaction_id` = `mk_txn_...` canonical marketplace transaction ID when
  present. Raw CSV intake keeps it `null` — it is never fabricated.
- `merchant_reference` = merchant-side reconciliation key.
- `ProviderPayment.reference` = reconciliation-side provider join reference.
- `payment_source_reference` = payment-source evidence.
- `provider_reference` = provider evidence.
- `MarketplaceTransaction.reference` = display reference, never the engine
  input.

> Do not fabricate `mk_txn_...` identifiers to make records match.

> No fuzzy, probabilistic, timestamp-only, or amount-only correlation is
> permitted.

> If a deterministic join anchor is absent, record the limitation rather than
> inventing one.

Engine join (the only anchor): exact string equality after trimming —
`merchant_reference` equals `ProviderPayment.reference` (in Model B,
`ProviderPayment.reference = Paystack data.reference`). A row matches only when
the operator's `merchant_reference` is byte-equivalent to the Paystack
transaction reference. Mismatched references are reported as
`MISSING_PROVIDER_RECORD` / `UNMATCHED_PROVIDER_RECORD` (or `MISSING_REFERENCE`
report data) — they are findings, not bugs, and never re-correlated.

## 6. Environment / Safety Checklist

Nothing below is complete yet. Check each item only when the Pilot Owner has
confirmed it for the run.

- [ ] Paystack test-mode account available.
- [ ] Test-mode credentials available through the approved environment
      variable mechanism.
- [ ] No production Paystack secret is being used.
- [ ] Merchant CSV contains no unnecessary sensitive customer information.
- [ ] Pilot output will not expose secrets.
- [ ] Operator understands that this is test-mode evidence.
- [ ] Pilot data is stored only in the intended local pilot data directory.

Do **not** paste secrets into the worksheet, a terminal transcript, a Git
repository, or the findings document. Test-mode secret keys are set via the
environment variable mechanism only.

## 7. Operator 1 — Preflight Record

| Field                    | Value     |
| ------------------------ | --------- |
| Operator                 |           |
| Observer                 |           |
| Date/time                |           |
| Environment              |           |
| Merchant/system          |           |
| Merchant CSV filename    |           |
| CSV row count            |           |
| Currency                 |           |
| Amount unit              |           |
| Timestamp field selected |           |
| Provider evidence mode   |           |
| Paystack environment     | Test mode |
| Data period              |           |

### Operator's normal reconciliation process

Ask the operator:

> Before seeing Reconcile Kit, how would you determine whether these
> transactions actually reconciled?

Capture the answer verbatim or as a faithful summary.

```
[answer]
```

## 8. Operator 1 — Step-by-Step Procedure

### Step 1 — Inspect merchant CSV

Before running any command, record:

- columns;
- amount unit (is `amount` in minor units, e.g. kobo, or decimal major units?);
- currency;
- timestamp field;
- reference quality (present, unique, consistent?);
- status values;
- obvious missing fields.

```
[observations]
```

### Step 2 — Run preview

Preview parses, validates, interprets, and reports. **Nothing is written.**

Local provider file (one Verify response object or an array):

```powershell
npm run pilot:run --prefix storefront -- --merchant <MERCHANT_CSV> --provider <PAYSTACK_VERIFY_JSON> --timestamp-field <FIELD> --currencies <CURRENCIES>
```

Live Paystack test mode (explicit network opt-in):

```powershell
npm run pilot:run --prefix storefront -- --merchant <MERCHANT_CSV> --live-paystack --timestamp-field <FIELD> --currencies <CURRENCIES>
```

Optional but recommended for keeping pilot data contained: append
`--data-dir <LOCAL_PILOT_DATA_DIR>` (or set `STOREFRONT_DATA_DIR`) so the
payment-events store stays in the intended local pilot data directory. Optional
`--output json` emits machine-readable output for evidence capture. Do not
invent values for the `<...>` placeholders; the fixed values you chose are the
ones recorded in the Step 1 and Section 7 fields.

Record:

- accepted rows;
- rejected rows;
- amount-unit interpretation;
- currency set;
- provider record count;
- reconciliation summary;
- findings.

```
[preview output / observations]
```

### Step 3 — Review preview before writing

Ask:

- Does the interpretation look correct?
- Are amounts in the expected unit?
- Are currencies correct?
- Are references usable?
- Are statuses understood?
- Does any finding appear surprising?

Capture the operator's observations before anything is recorded.

```
[observations]
```

### Step 4 — Run persisted reconciliation

Re-run the same command used in Step 2 with:

```text
--run
```

`--run` records the import exactly once into `payment-events.jsonl` in the data
directory, then reconciles the recorded events. Record:

- recorded count;
- replayed count;
- reconciliation summary;
- all findings.

```
[recorded output / observations]
```

### Step 5 — Replay

If the pilot procedure permits local replay verification, execute the same
command again (with `--run`) and record whether the import was recorded again
or recognized as already processed. Expected: `recorded 0` /
`replayed (exactly-once) N`, and the store file does not grow.

> Do not interpret replay success as evidence that the business reconciliation
> result itself is correct. Replay only proves the import is idempotent.

```
[replay output / observations]
```

## 9. Operator 1 — Results

| Metric                      | Result |
| --------------------------- | -----: |
| Merchant rows               |        |
| Accepted                    |        |
| Rejected                    |        |
| Provider records            |        |
| Matched                     |        |
| Discrepancies               |        |
| Missing provider records    |        |
| Provider-only records       |        |
| Missing/unusable references |        |
| Input errors                |        |
| Held for review             |        |
| Unresolved                  |        |

### Findings observed

For every finding, capture one row. Do not force findings into predetermined
categories if the actual output differs.

| Finding | Merchant reference | Provider reference | Code(s) | Operator interpretation | Evidence sufficient? |
| ------- | ------------------ | ------------------ | ------- | ----------------------- | -------------------- |
|         |                    |                    |         |                         |                      |
|         |                    |                    |         |                         |                      |

## 10. Real Discrepancy Investigation

This section is mandatory. Identify at least one real discrepancy.

### Discrepancy

- Finding type:
- Reference:
- Amount/currency:
- Merchant-side state:
- Provider-side state:
- Reconciliation code(s):

### Operator interpretation

Ask:

> What do you believe actually happened?

Capture the operator's answer (verbatim or faithful summary).

```
[answer]
```

### Evidence used

Record which evidence supports the conclusion.

```
[evidence]
```

### Evidence sufficiency

- [ ] Sufficient to understand what happened
- [ ] Partially sufficient
- [ ] Insufficient

### Missing evidence

If insufficient or partial, document exactly what evidence was missing.

```
[missing evidence]
```

### Operational consequence

Record what the operator would normally do next. Do not invent a resolution
merely to close the finding.

```
[next action]
```

## 11. Operator 1 — Usability / Workflow Findings

### What was clear?

-

### What was confusing?

-

### What required explanation?

-

### What did the operator expect that the tool did not provide?

-

### Where did the operator hesitate?

-

### Did the terminology make sense?

-

### Could the operator independently interpret the reconciliation result?

- [ ] Yes
- [ ] Partially
- [ ] No

### What should change before a real merchant-facing pilot?

-

Do not automatically convert these observations into implementation
requirements. They are pilot findings first.

## 12. Operator 2

Repeat Sections 7–11 independently with Operator 2.

Do not give Operator 2 Operator 1's conclusions before execution unless doing
so is necessary for safety. Use the same procedure, the same data expectations,
and the same evidence-capture fields.

## 13. Cross-Operator Comparison

| Dimension                       | Operator 1 | Operator 2 | Same? | Notes |
| ------------------------------- | ---------- | ---------- | ----- | ----- |
| CSV interpretation              |            |            |       |       |
| Amount-unit interpretation      |            |            |       |       |
| Reference interpretation        |            |            |       |       |
| Provider evidence understanding |            |            |       |       |
| MATCH interpretation            |            |            |       |       |
| Discrepancy interpretation      |            |            |       |       |
| Missing-provider interpretation |            |            |       |       |
| Evidence sufficiency            |            |            |       |       |
| Next-action understanding       |            |            |       |       |
| Workflow usability              |            |            |       |       |

### Agreement

What did both operators understand consistently?

```
[notes]
```

### Divergence

Where did their interpretations differ?

```
[notes]
```

### Product implications

Which differences indicate:

- documentation problems;
- UX problems;
- data-quality problems;
- reconciliation-model limitations;
- genuine unresolved product questions.

Do not automatically label all differences as software defects.

```
[notes]
```

## 14. Pilot Findings Summary

### Confirmed strengths

-

### Confirmed friction

-

### Evidence gaps

-

### Data-quality problems

-

### Reconciliation limitations

-

### Operator requests

-

### Safety / privacy observations

-

## 15. Phase 3A Decision Preparation

### Evidence that the pilot is ready to pass

- [ ] Two independent real operators completed the procedure.
- [ ] At least one real discrepancy was understood.
- [ ] Evidence was sufficient to explain the discrepancy.
- [ ] Operators could interpret results without substantial assistance.
- [ ] No critical workflow blocker was discovered.

### Evidence requiring another iteration

- [ ] Operator cannot reliably prepare merchant input.
- [ ] Provider evidence cannot be obtained reliably.
- [ ] Join anchor is routinely absent or ambiguous.
- [ ] Findings cannot be explained from available evidence.
- [ ] Operators disagree materially about what results mean.
- [ ] A critical safety/privacy issue exists.
- [ ] A software defect blocks completion.

## 16. Pilot Decision Record

Do not pre-populate PASS or FAIL. The decision below must be based on the
evidence collected in Sections 7–15, **not** merely on whether the CLI executed
successfully.

```text
Decision: ______________________

Date: __________________________

Decision owner: ________________

Evidence reviewed:
-
-
-

Primary reasons:
-
-
-

Required follow-up:
-

Implementation required before next phase:
-

Operational follow-up required:
-
```

Possible decision values:

- PASS
- PASS WITH CONDITIONS
- ITERATE
- BLOCKED

## 17. Evidence Handling Rules

- Never record secrets.
- Never paste Paystack secret keys into markdown.
- Never commit production credentials.
- Avoid unnecessary customer PII.
- Redact sensitive identifiers where the evidence record does not require them.
- Keep raw merchant/provider files outside the repository unless explicitly
  approved as synthetic fixtures.
- Findings documents should contain only the evidence necessary to support the
  decision.

## 18. Final Operator Checklist

- [ ] Both operators completed independent runs.
- [ ] Real merchant data used.
- [ ] Paystack test-mode evidence used.
- [ ] Preview completed.
- [ ] Persisted run completed.
- [ ] Replay behavior recorded where applicable.
- [ ] At least one real discrepancy identified.
- [ ] Discrepancy understood.
- [ ] Evidence sufficiency recorded.
- [ ] Operator workflow friction recorded.
- [ ] Cross-operator comparison completed.
- [ ] Findings summary completed.
- [ ] Decision record prepared.

## 19. Relationship to Other Phase 3 Documents

This worksheet is the **execution companion** to the existing Phase 3
documents; it re-states only what an operator must know to execute, and does
not duplicate their full contents:

- `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` — pilot definition (§8), sequence
  (§9), acceptance gate (§10, gate 3A), pilot readiness (§11), success metrics
  (§12).
- `PHASE_3A_BLOCKER_ANALYSIS.md` — why the pilot model is merchant CSV +
  Paystack Verify/live, and why provider CSV is structurally impossible under
  the frozen gate.
- `PHASE_3A_PILOT_INPUT_CONTRACT.md` — the exact field-by-field input contract
  (merchant CSV contract, provider evidence contract, join semantics, exit
  codes, acceptance gate).
- `PHASE_3A_LOCAL_OPERATOR_GUIDE.md` — the operator CLI command shape, workflow,
  example output, outcome meanings, restrictions, and troubleshooting.
- `PHASE_3B_ACCEPTANCE_REPORT.md` — the merchant CSV intake delivered by 3B and
  its frozen status.

For command help at any time: `node storefront/src/cli/pilot-run.ts --help`.

## 20. Current Status

> **Phase 3A Operational Pilot Status: PENDING EXECUTION**

Distinguish:

> Synthetic/local readiness: COMPLETE

from:

> Real two-operator operational validation: NOT YET COMPLETE
