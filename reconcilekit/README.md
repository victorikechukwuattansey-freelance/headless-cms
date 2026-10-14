# ReconcileKit

ReconcileKit compares the payments in your merchant CSV file against payment-provider records and reports, for each row, whether it matches, differs, or needs attention — using exact transaction-reference matching only. No fuzzy matching, no guessing, no hidden correlation.

The first supported provider is Paystack. The engine is provider-neutral; the Paystack adapter is a plugin.

## What this is (and is not)

**It is:** a small, local-first CLI toolkit. You give it two files (or one file plus a live Paystack fetch). It produces a deterministic, explainable reconciliation report.

**It is not:** a hosted service, a dashboard, a payment processor, a wallet, a ledger, or a database. It does not move money, store your data, or require an account. It runs on your machine and exits.

## Requirements

- Node.js `>=24.12.0`
- No other runtime dependency for the CLI itself; the engine uses one package (`csv-parse`) for CSV parsing.

## Install

**Recommended — no install, run directly:**

```bash
npx reconcilekit --help
```

**Or install globally:**

```bash
npm install -g reconcilekit
reconcilekit --help
```

**From source** (for contributors, or before the package is published to npm):

```bash
git clone https://github.com/victorikechukwuattansey-freelance/jarvis-demo.git
cd jarvis-demo/reconcilekit
npm install
npm run build
node dist/cli/index.js --help
```

## Quick start

Two files, one command, no network.

### 1. Create a merchant CSV

Save this as `merchant.csv`:

```csv
merchant_reference,amount,currency,status,occurred_at,merchant_record_id
TEST-001,1000,NGN,SUCCESS,1700000000000,rec_001
```

`amount` is in minor units — kobo for NGN. So `1000` is ₦10.00.

### 2. Create a provider JSON file

Save this as `provider.json`:

```json
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "id": 123456789,
    "reference": "TEST-001",
    "amount": 1000,
    "currency": "NGN",
    "status": "success",
    "created_at": "2023-11-14T22:13:20.000Z",
    "paid_at": "2023-11-14T22:13:20.000Z",
    "transaction_date": "2023-11-14T22:13:20.000Z"
  }
}
```

### 3. Run the reconciliation

```bash
npx reconcilekit --merchant merchant.csv --provider provider.json --timestamp-field paid_at --currencies NGN
```

Expected output:

```text
ReconcileKit reconciliation report

This report compares your merchant records against the provider file you supplied.

Summary
  Records processed             2
  Matched                       1
  Discrepancies found           0
  Unresolved                    0
  Held for review (ambiguous)   0
  Input errors                  0
  Missing from provider records 0
  Provider-only (unmatched)     0
  Missing or unusable reference 0

Results
  1. MATCH - merchant TEST-001 (rec_001) | provider TEST-001 (123456789)
```

That's a full reconciliation. The same two fixture files are also shipped with the package at `examples/quickstart/`.

## How it works

```text
merchant CSV  ──► merchant adapter ──┐
                                     ├──► normalized domain records ──► reconcile engine ──► report
provider JSON ──► provider adapter ──┘
```

Four layers, in dependency order:

1. **Domain** — the canonical types (`MerchantPayment`, `ProviderPayment`, the outcome vocabulary, the discrepancy codes). Zero external imports.
2. **Application** — `reconcileRecords()`, the single matcher. Delegates every validation to the domain.
3. **Adapters** — CSV parsing, Paystack response mapping, live HTTP. Provider-specific knowledge stops here.
4. **CLI** — argument parsing, file I/O, output rendering.

The engine joins rows on **exact transaction-reference equality** and compares amount, currency, status, and timestamp (within a tolerance you control). Mismatches are classified by code (`AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `STATUS_MISMATCH`, `TEMPORAL_ANOMALY`, and others). Missing references and unresolved statuses are reported distinctly — ReconcileKit never fabricates a match and never falls back to fuzzy correlation.

More detail: see [`ARCHITECTURE.md`](ARCHITECTURE.md), [`CANONICAL-DOMAIN-MODEL-v0.3.md`](CANONICAL-DOMAIN-MODEL-v0.3.md), and [`RECONCILIATION-DOMAIN.md`](RECONCILIATION-DOMAIN.md).

## Merchant CSV contract

| Column               | Required | Meaning                                                                               |
| -------------------- | -------- | ------------------------------------------------------------------------------------- |
| `merchant_reference` | no       | Your reference for the payment; used as the primary matching key against the provider |
| `amount`             | **yes**  | Integer amount in the currency's **minor units** (kobo for NGN)                       |
| `currency`           | **yes**  | Currency code, e.g. `NGN`. Must be in the `--currencies` list                         |
| `status`             | no       | Canonical status value (see below)                                                    |
| `occurred_at`        | no       | Epoch milliseconds, `YYYY-MM-DD`, or ISO-8601 with an explicit timezone               |
| `merchant_record_id` | no       | Your internal record identifier; reported verbatim, never used as a matching key      |

Extra columns are tolerated. Missing `amount` or `currency` is a hard input failure.

## Provider JSON contract (file mode)

File mode reads the Paystack **Verify** response shape. The CLI reads the `data` object:

| Field                                         | Required | Notes                                                                |
| --------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `data` (object)                               | yes      | A response without `data` is rejected                                |
| `data.amount`                                 | yes      | Integer minor-unit amount                                            |
| `data.currency`                               | yes      | Must be in `--currencies`                                            |
| `data.reference`                              | no       | Join key against `merchant_reference`. Absent ⇒ no match is possible |
| `data.status`                                 | no       | Lowercase Paystack values are canonicalized (`success` → `SUCCESS`)  |
| `data.id`                                     | no       | Reported as the provider record id                                   |
| `created_at` / `paid_at` / `transaction_date` | no       | The one you name in `--timestamp-field` is used                      |
| top-level `status` / `message`                | no       | Verify response metadata; not used in reconciliation                 |

## Amount units — read this before you build a CSV

ReconcileKit uses **integer minor units** throughout. For NGN:

```text
₦1           = 100 kobo
₦10,000.00   = 1,000,000 kobo
```

Paystack dashboard and export views may show amounts in **major units**. If your dashboard shows `NGN 10,000.00`, the amount that goes into your merchant CSV is `1000000` — not `10000`. Getting this wrong produces a false `AMOUNT_MISMATCH`.

## Timestamp formats

`occurred_at` accepts exactly:

- Epoch milliseconds — `1787029755000`
- Date only — `2026-08-18`
- ISO-8601 with an explicit timezone — `2026-08-18T06:09:15+01:00`

Timezone-less timestamps like `2026-08-18T06:09:15` are rejected. Always include a timezone when the timestamp is a precise instant.

## Status values

Canonical tokens:

```text
SUCCESS
FAILED
PENDING
CANCELLED
UNKNOWN
```

Unrecognized or lowercase values are mapped to `UNKNOWN`, which produces an unresolved status comparison rather than a match.

## CLI reference

| Option                      | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `--merchant <path>`         | Merchant CSV input (**required**)                                                 |
| `--provider <path>`         | Provider JSON input (file mode)                                                   |
| `--live-paystack`           | Explicit live Paystack mode                                                       |
| `--timestamp-field <field>` | `created_at`, `paid_at`, or `transaction_date`                                    |
| `--currencies <list>`       | Comma-separated allowed currencies, e.g. `NGN` or `NGN,USD`                       |
| `--output <mode>`           | `text` (default) or `json`                                                        |
| `--tolerance-ms <n>`        | Timestamp tolerance in milliseconds; if omitted, timestamp validation is disabled |
| `-h`, `--help`              | Show usage                                                                        |
| `--version`                 | Print version                                                                     |

`--provider` and `--live-paystack` are mutually exclusive. Exactly one is required.

### File vs live mode

|                 | File mode    | Live Paystack     |
| --------------- | ------------ | ----------------- |
| Merchant CSV    | required     | required          |
| Provider JSON   | required     | not used          |
| Paystack secret | not required | required          |
| Network access  | no           | yes               |
| Flag            | `--provider` | `--live-paystack` |

Live mode is explicit. The CLI never falls back to a network request on its own.

### Live mode secret

Live mode reads the secret from the environment variable `RECONCILEKIT_PAYSTACK_SECRET_KEY`. Set it for the current shell session:

```powershell
# PowerShell
$env:RECONCILEKIT_PAYSTACK_SECRET_KEY = "<your-paystack-secret>"
```

```bash
# bash / zsh
export RECONCILEKIT_PAYSTACK_SECRET_KEY="<your-paystack-secret>"
```

Rules:

- Never pass the secret as a CLI argument.
- Never commit it. Never write it into a CSV, JSON, log, or issue.
- The CLI never prints the secret, never writes it to disk, and never includes it in reports.

### Exit codes

```text
0 — successful completion (reconciliation findings are report data, not errors)
1 — input, configuration, or provider-access failure
2 — CLI usage error
3 — unexpected internal failure
```

A successful run may exit `0` while reporting legitimate `DISCREPANCY` or `UNRESOLVED` results. Those are findings, not errors.

## Understanding the report

The summary counts:

- **Matched** — reference, amount, currency, status, and timestamp all agree.
- **Discrepancies found** — matched on reference but one or more attributes differ. Codes name which.
- **Unresolved** — a status pair the engine will not resolve (e.g. merchant `PENDING` vs provider `UNKNOWN`). Do not treat as paid; follow up.
- **Held for review** — duplicate records prevented a safe match.
- **Missing from provider records** — a merchant row with no provider counterpart.
- **Provider-only (unmatched)** — a provider row with no merchant counterpart.
- **Missing or unusable reference** — the row carries no join key. Reported as `MISSING_REFERENCE` with exit code `0`.

The per-record list shows the merchant and provider sides plus any discrepancy codes.

## Example end-to-end

```powershell
# 1. Set the secret for this session
$env:RECONCILEKIT_PAYSTACK_SECRET_KEY = "<your-paystack-secret>"

# 2. Reconcile live against Paystack test mode
npx reconcilekit `
  --merchant merchant.csv `
  --live-paystack `
  --timestamp-field paid_at `
  --currencies NGN
```

For file mode, swap `--live-paystack` for `--provider provider.json`. No secret is required.

## Troubleshooting

| Symptom                               | Likely cause / fix                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `missing required option`             | Run `reconcilekit --help`. `--merchant`, `--timestamp-field`, and `--currencies` are always required                 |
| Merchant file cannot be opened        | Check the path. Use quotes if the path contains spaces                                                               |
| Missing required CSV column           | `amount` and `currency` are required columns; check the header row                                                   |
| `AMOUNT_MISMATCH` that "shouldn't be" | Almost always minor-unit conversion. See _Amount units_                                                              |
| Missing Paystack secret               | `RECONCILEKIT_PAYSTACK_SECRET_KEY` is not set in the current session. Do not paste the secret into a support request |
| Paystack access or connection failure | Provider-access problem, not a reconciliation finding. Check the secret and network, retry                           |
| `STATUS_UNRESOLVED` on a pending row  | Merchant `PENDING` vs provider `UNKNOWN` (e.g. `abandoned`). Do not fulfill; follow up with the customer             |

## License

MIT. See the repository for the license text.

## Repository

Source, issues, and documentation: <https://github.com/victorikechukwuattansey-freelance/jarvis-demo>
