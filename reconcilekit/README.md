# ReconcileKit

ReconcileKit compares the payments listed in your merchant CSV file against payment-provider records and reports, for each record, whether it matches, differs, or needs attention.

The current MVP runs locally on your machine. The first supported provider is Paystack.

## Requirements

- Node.js `>=24.12.0`
- npm
- Access to the ReconcileKit project directory

## Install

The current distribution model is the project source directory — there is no npm registry package yet. From the project root:

```powershell
npm install
```

## Quick Start — File Mode

Compare a merchant CSV against a saved provider file (no network, no secret):

```powershell
node src/cli/index.ts --merchant ".\merchant.csv" --provider ".\provider.json" --timestamp-field paid_at --currencies NGN
```

- `--merchant` (required): path to your merchant CSV.
- `--provider` (required in file mode): path to a provider JSON file in the Paystack Verify response shape.
- File mode makes no network request and does not need a Paystack secret.

## Quick Start — Live Paystack Mode

Fetch transactions live from Paystack:

```powershell
node src/cli/index.ts --merchant ".\merchant.csv" --live-paystack --timestamp-field paid_at --currencies NGN
```

- `--live-paystack` is the explicit network opt-in.
- `--provider` and `--live-paystack` are mutually exclusive.
- Absence of `--provider` does not silently enable live mode — you must pass `--live-paystack` explicitly.
- `--merchant` is always required.
- Requires the `RECONCILEKIT_PAYSTACK_SECRET_KEY` environment variable (see below).

## Paystack Secret

Live mode reads your Paystack secret from the environment variable:

```text
RECONCILEKIT_PAYSTACK_SECRET_KEY
```

Set it for the current PowerShell session:

```powershell
$env:RECONCILEKIT_PAYSTACK_SECRET_KEY = "<your-paystack-secret>"
```

Warnings:

- Never put the secret on the command line.
- Never commit it.
- Never put it in merchant CSV files.
- Never paste the value into reports, issues, or logs.
- Do not create a committed `.env` file containing the secret (`.env` and `.env.*` are ignored by repository hygiene rules, but ReconcileKit does not load `.env` files — set the environment variable directly).

The CLI reads the environment variable and passes the credential to the Paystack request. The secret never appears in reports or error messages.

## Merchant CSV Contract

The merchant CSV uses these columns:

```text
merchant_reference,amount,currency,status,occurred_at,merchant_record_id
```

| Column               | Meaning                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `merchant_reference` | Your reference for the payment (used as the primary matching key) |
| `amount`             | Amount in the currency's minor units (required)                   |
| `currency`           | Currency code, e.g. `NGN` (required)                              |
| `status`             | Canonical status value (see Status Values)                        |
| `occurred_at`        | When the payment occurred (see Timestamp Formats)                 |
| `merchant_record_id` | Your record identifier for the payment                            |

Example record (illustrative):

```csv
merchant_reference,amount,currency,status,occurred_at,merchant_record_id
RK-1001,250000,NGN,SUCCESS,1750000000000,M-1001
```

## Provider JSON (File Mode)

File mode reads a provider JSON file in the Paystack Verify response shape. Live mode receives the same shape from the Paystack Verify Transaction endpoint.

The CLI reads these fields from the `data` object:

| Field                                         | Required | Notes                                                                                                |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `data` (object)                               | Yes      | A response without the `data` object is rejected                                                     |
| `amount`                                      | Yes      | Whole-number amount in the currency's minor units (kobo for NGN)                                     |
| `currency`                                    | Yes      | Must be in your `--currencies` list, e.g. `NGN`                                                      |
| `reference`                                   | No       | Primary matching key against `merchant_reference`; absent references cannot be matched               |
| `status`                                      | No       | Lowercase Paystack values are canonicalized, e.g. `success` → `SUCCESS`                              |
| `id`                                          | No       | Reported as the provider record id                                                                   |
| `created_at` / `paid_at` / `transaction_date` | No       | The field selected by `--timestamp-field` is used for comparison; ISO-8601 with an explicit timezone |
| `status` / `message` (top level)              | No       | Verify response metadata, not used for reconciliation                                                |

Example file (illustrative values only):

```json
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "id": 4123456789,
    "reference": "REF-A",
    "amount": 20000,
    "currency": "NGN",
    "status": "success",
    "created_at": "2023-11-14T22:13:20.000Z",
    "paid_at": "2023-11-14T22:13:20.000Z",
    "transaction_date": "2023-11-14T22:13:20.000Z"
  }
}
```

## IMPORTANT — Amount Units

ReconcileKit expects monetary amounts in the currency's minor units.

For NGN:

```text
₦1 = 100 kobo
₦10,000.00 = 1,000,000 kobo
```

Caution when importing Paystack dashboard/export data: dashboards and exports may display amounts in major currency units.

Demonstrated real-world example:

```text
Paystack dashboard:       NGN 10,000.00
ReconcileKit NGN amount:  1,000,000
```

Entering `10000` as the ReconcileKit NGN amount would represent ₦100.00 under the minor-unit contract — not ₦10,000.00 — and would produce an `AMOUNT_MISMATCH` against the provider record. Always convert export values to minor units before creating your merchant CSV.

## Timestamp Formats

`occurred_at` accepts exactly these formats:

1. Epoch milliseconds — `1787029755000`
2. Date only — `2026-08-18`
3. ISO-8601 with an explicit timezone — `2026-08-18T06:09:15+01:00`

Ambiguous timezone-less timestamps such as `2026-08-18T06:09:15` are rejected. Use an explicit timezone when representing a precise transaction instant.

## Status Values

Canonical status values:

```text
SUCCESS
FAILED
PENDING
CANCELLED
UNKNOWN
```

Normalize your source values to these canonical values. Unrecognized or lowercase values (for example `success`) are mapped to `UNKNOWN`, which makes the status comparison unresolved rather than matched.

## CLI Options

| Option                      | Purpose                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- |
| `--merchant <path>`         | Merchant CSV input (required)                                                 |
| `--provider <path>`         | Provider JSON input for file mode                                             |
| `--live-paystack`           | Explicit live Paystack mode                                                   |
| `--timestamp-field <field>` | Provider timestamp to compare: `created_at`, `paid_at`, or `transaction_date` |
| `--currencies <list>`       | Allowed currency codes, comma-separated (e.g. `NGN,USD`)                      |
| `--output <mode>`           | Output format: `text` (default) or `json`                                     |
| `--tolerance-ms <n>`        | Allow timestamps to differ by up to n milliseconds when comparing             |
| `-h, --help`                | Show usage                                                                    |
| `--version`                 | Show version                                                                  |

## File vs Live Mode

|                 | File mode    | Live Paystack     |
| --------------- | ------------ | ----------------- |
| Merchant CSV    | Required     | Required          |
| Provider JSON   | Required     | Not used          |
| Paystack secret | Not required | Required          |
| Network access  | No           | Yes               |
| Flag            | `--provider` | `--live-paystack` |

Live mode is explicit — the CLI never falls back to a network request automatically.

## Understanding Results

The report summarizes:

```text
Records processed
Matched
Discrepancies found
Unresolved
Held for review (ambiguous)
Input errors
Missing from provider records
Provider-only (unmatched)
Missing or unusable reference
```

A "What needs attention" section appears when something needs review, and each record has a per-record result.

Records with absent or unusable reference fields are reported as `MISSING_REFERENCE` report data with a "What needs attention" line — the command still succeeds with exit code `0`. Absent reference fields are not a hard input failure. Only the required columns (`amount`, `currency`) cause a hard rejection: a merchant CSV missing a required column fails with a non-zero exit code (see Troubleshooting).

Two different kinds of failures exist:

- Reconciliation findings (for example a discrepancy) are report data — the reconciliation ran successfully.
- Operational/input failures (unreadable file, missing secret, failed Paystack request) are errors and exit with a non-zero code.

A successful command may return exit code `0` while reporting legitimate discrepancies.

## Exit Codes

```text
0 — successful completion (reconciliation findings are report data, not errors)
1 — input/configuration/provider-input failure
2 — CLI usage error
3 — unexpected internal failure
```

## Troubleshooting

- `missing required option` — run `node src/cli/index.ts --help` and supply the required option.
- Merchant file cannot be opened — check that the path exists and is correct.
- Missing required CSV column — the merchant CSV must follow the documented schema (Merchant CSV Contract).
- Amount mismatch — verify the currency, the minor-unit conversion, whether the source (for example a Paystack dashboard/export) displayed major units, and the reference.
- Missing Paystack secret — set `RECONCILEKIT_PAYSTACK_SECRET_KEY` in the current session. Do not paste the secret into a support request.
- Paystack access/connection failure — this is a provider access, network, or authentication problem, not a reconciliation finding. Check the secret and connectivity, then retry.

## Security Notes

- Paystack credentials stay on your machine.
- Live credentials are supplied only through `RECONCILEKIT_PAYSTACK_SECRET_KEY`.
- Never put credentials in CSVs, CLI arguments, source code, reports, logs, or committed files.
- `.env` and `.env.*` are ignored by repository hygiene rules; the supported workflow is to set the environment variable directly in your session.
- Do not commit credential material.

## Example End-to-End Workflow

```powershell
# 1. Install dependencies
npm install

# 2. Set the Paystack secret for this PowerShell session
$env:RECONCILEKIT_PAYSTACK_SECRET_KEY = "<your-paystack-secret>"

# 3. Run live reconciliation
node src/cli/index.ts --merchant ".\merchant.csv" --live-paystack --timestamp-field paid_at --currencies NGN
```

For file mode, use `--provider ".\provider.json"` instead of `--live-paystack` (no secret needed).
