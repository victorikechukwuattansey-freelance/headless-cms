# PHASE 3A — BLOCKER ANALYSIS

**Project:** ReconcileKit (Core + Storefront)
**Type:** Decision artifact (read-only analysis; no implementation performed)
**Date:** 2026-09-09
**Status:** `3A UNBLOCKER DEFINED` — recommended pilot model **B** (merchant CSV + Paystack Verify/live)

> **Method.** Read-only investigation. Frozen baselines re-verified this analysis and in the
> current session: Storefront **405/405**, Root **618/618**, both typechecks PASS, ESLint PASS,
> Prettier PASS. Two rehearsal runs were executed with temp artifacts **outside the repo**
> (`%TEMP%\opencode\reconcilekit-rehearsal\`) to confirm the operator- and library-level behavior
> described below. No source, test, config, or protected file was modified.

---

## 1. Decision

- **Phase 3A is not blocked by the frozen reconciliation engine.** The engine, the CLI, and
  exact-reference matching all work at the operator and library levels (Rehearsals A and B).
- **Phase 3A is blocked by an operator-rail gap:** the intake/conversion path shipped in 3B
  (`importCsv`/`recordCsvImport`) exists as a library with **no operator-facing caller**, and
  the pilot's provider-line "provider CSV" model is architecturally impossible under the frozen
  payment-source gate.
- **Two-CSV input (merchant CSV + provider CSV): `NO DETERMINISTIC JOIN ANCHOR ESTABLISHED`**
  and structurally impossible under the frozen gate — see §4, §5.
- **Merchant CSV + Paystack Verify (JSON / live): deterministic anchor EXISTS**
  (`merchant_reference` == Paystack `data.reference`) — this is the pilot model. Blocked only by
  operator wiring (conversion guide + operator entry point), which is specified in §8 and in
  `PHASE_3A_PILOT_INPUT_CONTRACT.md`.

---

## 2. Authoritative Sources (in priority order)

1. `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` — frozen decisions: single engine (§4.3),
   exact-reference matching (§4.4), identifier hierarchy (§5), payment-source boundary (§4.13, §8),
   architecture-change procedure (§14), Phase 3 entry criteria (§13).
2. `docs/PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` — 3A pilot definition (§8), acceptance gate (§10),
   pilot readiness (§11), non-goals (§13), completion criteria (§17).
3. `docs/PHASE_3B_ACCEPTANCE_REPORT.md` — 3B IMPLEMENTED AND ACCEPTED; 3A remains pending (§J).
4. `RECONCILE-KIT-PAYMENT-SOURCE-LAYER-ADDENDUM.md` — provider-neutral payment-source layer,
   identifier semantics (§5.1–5.3), ingestion modes (§7, incl. §7.3 Manual/CSV).
5. `src/...` and `storefront/src/...` implementation (cited inline below).

---

## 3. What Was Verified (rehearsals, read-only checks)

### Rehearsal A — operator-level CLI (file mode)

Temp artifacts: `%TEMP%\opencode\reconcilekit-rehearsal\` (provider-891.json, provider-892.json,
provider-893.json) built from the Paystack Verify envelope `{status, message, data}` with
`data.reference` `T545417640929891/892/893`.

| Input (merchant)                                 | Input (provider)    | Result                                                                              |
| ------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
| `synthetic-reconcilekit.csv` (refs 901–903, NGN) | `provider-891.json` | Exit 0; 3 `MISSING_PROVIDER_RECORD` (901–903) + 1 `UNMATCHED_PROVIDER_RECORD` (891) |
| `synthetic-paystack-export.csv` (Refs 891–893)   | `provider-891.json` | Exit 1 — `provider input is not valid JSON` (provider CSV rejected)                 |
| `synthetic-paystack-export.csv` as merchant      | `provider-891.json` | Exit 1 — `merchant CSV is missing required column "amount"`                         |

**Finding:** the operator CLI accepts only (a) a merchant CSV in the frozen SDK contract and
(b) a single Paystack Verify JSON (file mode) or `--live-paystack`. A provider **CSV** is rejected
in both roles. The real Paystack dashboard export (`merchant.csv`, 22 columns) is rejected as
merchant input ("missing required column `amount`").

### Rehearsal B — library-level payment-source flow

Both fixtures through `importCsv` → `recordCsvImport` → `reconcilePaymentEvents`:

- 3/3 + 3/3 rows ingested (source `MANUAL_CSV`, confidence `IMPORTED`,
  `source_event_id = csv_<importId>_<rowIndex>`, exactly-once replay-safe).
- **All six events carry `transaction_id = null`** (frozen: never fabricated from CSV).
- `reconcilePaymentEvents` ⇒ total 6, **matched 0**, **missingProviderRecords 6** —
  provider side is **empty** because the provider-row gate in `to-reconcilekit.ts`
  requires `transaction_id !== null`.

### Read-only verification

- Grep over `storefront/src`: `importCsv`, `recordCsvImport`, `reconcilePaymentEvents`,
  `toReconcileKitRequest` have **no caller** outside `payment-sources/` modules and tests.
  The intake flow is reachable only from `storefront/test/marketplace/csv-intake.test.ts`.
- `storefront/src/server.ts`: no CSV-intake route; marketplace mode shadows the legacy
  `/reconcile` and `/reconcile/merchant.csv` routes (return 404 text/html). The storefront
  **cannot** receive an operator CSV through HTTP.
- The operator CLI (`src/cli/index.ts`) bypasses the payment-source layer entirely: it feeds
  `parseMerchantCsv` (frozen `src/adapters/merchant/csv.ts`, requires exact columns `amount`,
  `currency`) and one mapped Verify response straight into `reconcileRecords`.

---

## 4. Blocker Categorization (six categories)

### B1 — Merchant CSV input contract (BLOCKER at operator level)

- Real operator exports (Paystack dashboard) are not the SDK contract: `merchant.csv` has 22
  columns (`Reference`, `Amount Paid`, `Currency`, `Status`, …); the CLI requires
  `merchant_reference,amount,currency,status,occurred_at,merchant_record_id`.
- 3B's `importCsv` **does** normalize dashboard shapes (aliases: `reference`, `amount_paid`,
  `currency`, `status`, `transaction_date`, minor-unit conversion preview), but nothing calls it
  from an operator surface.
- The promised conversion guide (Phase 3 plan §11: "Merchant CSV contract + minor-unit conversion
  guide (3B deliverable)") exists only as the README §"IMPORTANT — Amount Units" rule
  (₦10,000.00 → 1,000,000 kobo); there is no shipped step-by-step operator guide or converter
  executable.

### B2 — Provider evidence (BLOCKER for CSV provider model)

- **A provider-dashboard CSV cannot act as provider evidence** in this architecture:
  - CLI `--provider` requires JSON (Rehearsal A); a provider CSV is rejected.
  - If a provider CSV were routed through `importCsv`, every row becomes a `MANUAL_CSV` merchant
    event with `transaction_id = null`, and `to-reconcilekit.ts` emits a provider row **only when
    `transaction_id !== null`** (frozen gate in `payment-sources/to-reconcilekit.ts`).
  - Result under any CSV-provider model: every merchant row ⇒ `MISSING_PROVIDER_RECORD`.
- The only provider evidence forms that work: **Paystack Verify JSON (file mode)** or
  **`--live-paystack`**.

### B3 — Operator entry point (BLOCKER — the core gap)

- No CLI subcommand, no HTTP route, and no script wires
  `importCsv → recordCsvImport → reconcilePaymentEvents → report`.
- The CLI and the payment-source intake pipeline are two **disjoint** paths; 3B's conversion
  output cannot reach the operator-visible report without a new wiring point.
- Result: the plan's sequencing ("3B feeds pilot wave 1") is not delivered at the operator level.

### B4 — Reconcile engine reachability (NOT a blocker)

- `reconcileRecords()` is reachable and correct from the CLI (Rehearsal A). It is the sole matcher;
  no engine defect exists.
- What is _not_ reachable is the 3B-converted merchant evidence path with provider evidence —
  a wiring gap, not an engine gap.

### B5 — Identifier / join semantics (BLOCKER for CSV-to-CSV, RESOLVED for CSV-to-Verify)

- Frozen hierarchy (freeze §5, addendum §5.2–5.3): `transaction_id` (`mk_txn_…`) is the anchor;
  `merchant_reference` is the merchant-side matching key; `ProviderPayment.reference` is the
  provider-side join reference; CSV columns like `source_reference`/`source_identifier` are
  **evidence only**.
- CSV intake never fabricates identifiers (`transaction_id` always `null`; `merchant_reference`
  = CSV `reference` column; `payment_source_reference` = CSV `source_reference` column).
- Therefore **two CSVs have no deterministic common anchor**:
  - a provider CSV's reference is, by construction, evidence (`payment_source_reference`) or,
    if read as merchant input, a `merchant_reference` — never a `ProviderPayment.reference`;
  - no `mk_txn_` value exists in either file;
  - Rehearsal B confirms the provider side is empty by the frozen gate, not by data coincidence.

### B6 — Docs / workflow / sequencing (BLOCKER — explicit deliverables missing)

- Phase 3 plan §11 ("Required before pilot wave 1"): operator on-ramp doc, merchant CSV contract +
  minor-unit conversion guide (3B deliverable), masked evidence packs, Paystack test accounts.
  The conversion guide and an operator-run intake command are the missing items; the evidence-pack
  masking machinery already exists in-storefront (no new truth machinery needed).

---

## 5. Joint-Anchor Verdict

**For the CSI-vs-CSV pilot model (Option A): `NO DETERMINISTIC JOIN ANCHOR ESTABLISHED`.**

Reasons (all verified against source):

1. `importCsv` sets `transaction_id = null` for every row (`csv-intake.ts` `buildDraft`;
   `manual-csv.ts` `context.transactionId ?? null`).
2. `toReconcileKitRequest` emits `ProviderPayment` rows only when
   `event.transaction_id !== null && status ∈ DEFINITIVE_SOURCE_STATUSES`; a provider CSV ingested
   as `MANUAL_CSV` can never satisfy that gate, so the provider side is empty by design.
3. Even ignoring the gate, frozen §5 forbids treating an external CSV reference as the join key:
   `ProviderPayment.reference` is the join reference and for marketplace projections it is
   `mk_txn_…`; external references are never join keys.
4. Rehearsal B demonstrates the outcome: 6/6 queries ⇒ `MISSING_PROVIDER_RECORD`.

**For the merchant-CSV + Paystack-Verify model (Option B): anchor EXISTS and is deterministic** —
exact equality `merchant_reference` (CSV `Reference` column) == Paystack `data.reference`. Proven
by Rehearsal A, the CLI suite (`REF-A` merchant / `REF-A` provider ⇒ MATCH), and the live
12,500 NGN test-mode transaction in `PILOT-READINESS-REPORT.md`.

---

## 6. Pilot Model Evaluation

| Model                                                        | Anchor                                                     | Provider side                                                                               | Verdict                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A — merchant CSV + provider CSV**                          | None (see §5)                                              | Structurally empty (CSV cannot pass the frozen provider gate)                               | **REJECT** — impossible under freeze §4.3/§4.4/§5; every record becomes `MISSING_PROVIDER_RECORD`            |
| **B — merchant CSV + Paystack Verify JSON / live**           | `merchant_reference == data.reference`                     | Paystack Verify (file mode) or `--live-paystack` (test mode) for the operator's own account | **RECOMMENDED** — deterministic anchor, engine untouched, matches plan §8 3A definition                      |
| **C — merchant CSV + existing storefront provider evidence** | Requires marketplace `mk_txn_` anchors in the merchant CSV | Wallet/mock-provider evidence is keyed to `mk_txn_…` (in the store)                         | **REJECT** for the operator pilot — a real operator's CSV carries no `mk_txn_`; demo-value only              |
| **NONE**                                                     | —                                                          | —                                                                                           | Only if the pilot were _required_ to use provider CSVs. Not the case; **B** is reachable with the wiring fix |

---

## 7. Risk Analysis (§13-class)

| Risk                                                    | Likelihood | Impact | Position                                                                                                                                                 |
| ------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator CSV cannot be normalized (messy headers/units) | MED        | MED    | Mitigated by `importCsv` validation (typed diagnostics, minor-unit preview). Blocked only by missing operator wiring.                                    |
| Silent kobo/naira mismatch in the merchant CSV          | MED        | HIGH   | README §Amount Units warns; the pilot input contract makes `amountUnit` explicit (file-mode CLI stays minor-only; intake supports `decimal` w/ preview). |
| Merchant CSV `Reference` ≠ Verify `data.reference`      | LOW        | HIGH   | Deterministic mismatch ⇒ `MISSING_REFERENCE`/`MISSING_PROVIDER_RECORD`; surfaced clearly by the engine, never fuzzed.                                    |
| Operator never returns ⇒ PENDING drift                  | MED        | MED    | Existing limitation (no webhook); mitigable via `POST /orders/:id/verify` / `--live-paystack`. Out of 3A fix scope.                                      |
| Temptation to "fix the engine" to accept provider CSVs  | LOW        | HIGH   | Freeze §14 procedure; this analysis explicitly does **not** change the engine. Provider CSV remains evidence-only, never a join key, per §4.3/§4.4.      |
| Entry-point scope creep (a CLI subcommand or route)     | MED        | MED    | Specified but **not implemented** here; any build is a normal storefront change and never touches `reconcilekit/src/**`.                                 |

**Stop conditions** (unchanged from plan §15): a pilot "finding" is never claimed as real-money
inconsistency; provider-access failures stay distinct from reconciliation findings; no
production-infra or engine work begins without the 3E/3F gate + owner approval.

---

## 8. Minimum 3A Unblocker (specification only — NOT implemented)

1. **Operator conversion path.** Make the 3B intake reachable by an operator, through one of:
   (a) a minimal CLI subcommand/script that runs `importCsv → recordCsvImport` against an
   operator-provided export with an explicit conversion preview (the 3B `amountUnit` + per-row
   diagnostics are the preview), or
   (b) a storefront HTTP route exposing the same intake boundary.
   The module already exists (`csv-intake.ts`); this is wiring + a small operator runner, not an
   engine change.
2. **Wave-1 provider evidence = Paystack test mode only** — `--provider <verify.json>` (file mode)
   then `--live-paystack` (explicit network opt-in). **No provider CSV.**
3. **Conversion guide shipped** (the 3B promise): step-by-step operator guide
   (dashboard export → contract rows incl. minor-unit conversion and reference mapping), with the
   README §Amount Units rule as the normative authority.
4. **Explicit pilot record**: join honesty — the only deterministic anchor is
   `merchant_reference == Verify data.reference`; mismatched references must be reported as
   `MISSING_REFERENCE`/`MISSING_PROVIDER_RECORD`, never correlated by amount/timestamp/CSV-column.

**Out of the unblocker (remain gated/deferred):** provider CSV ingestion as evidence (blocked by
freeze), 3C detail surface, 3D investigation workflows, 3E webhooks, 3F persistence, auth, CSRF,
multi-tenancy, billing, deployment.

---

## 9. Frozen Invariants Preserved

- `reconcileRecords()` remains the **sole matcher**; no fuzzy/probabilistic/amount-only/
  timestamp-only/customer-data correlation (freeze §4.3, §4.4).
- Identifier hierarchy untouched (freeze §5): CSV references are evidence; `mk_txn_…` is the
  marketplace anchor; `ProviderPayment.reference` is the join reference; nothing fabricated.
- Payment-source layer is normalization + exact-once ingestion only (§4.13, §8) — never a second
  reconciliation engine.
- `reconcilekit/src/**` unchanged (no `wallet|marketplace|mk_txn|wld_` references).
  Phase-3B verified this; this analysis also modified nothing.

---

## 10. Phase Boundary

| Track                                 | Status                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| 3B (Merchant CSV intake & onboarding) | **IMPLEMENTED AND ACCEPTED** (17/17; 405/405; 618/618)                                  |
| 3A (Operational Reconciliation Pilot) | **PENDING — BLOCKED at operator level by B1/B2/B3/B6 (rail gap); unblocker defined §8** |
| 3C / 3D / 3E / 3F                     | NOT implemented; 3E/3F gated behind pilot finding + owner approval                      |

---

## 11. Conclusion

**`3A UNBLOCKER DEFINED`.** The engine is not the blocker. The blocker is that 3B's conversion
intake has no operator-facing runner and the frozen provider gate makes a "provider CSV" impossible
by design. The recommended pilot model is **B** (merchant CSV + Paystack Verify/live). The minimum
unblocker is an operator conversion/run path (§8.1), the wave-1 provider-evidence rule (§8.2), and
a shipped conversion guide (§8.3). No engine, matcher, identifier, or frozen-decision change is
required — only storefront-side wiring (specified, not implemented here).
