#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import type {
  MatchResult,
  ReconciliationConfig,
  ReconciliationReport,
  ReconciliationSummary,
} from "../domain/model.ts";
import { reconcileRecords } from "../application/reconcile-records.ts";
import { parseMerchantCsv } from "../adapters/merchant/csv.ts";
import {
  mapPaystackResponse,
  mapPaystackResponses,
} from "../adapters/providers/paystack/paystack.ts";
import { PAYSTACK_TIMESTAMP_FIELDS } from "../adapters/providers/paystack/paystack.ts";
import type {
  PaystackAdapterOptions,
  PaystackMappedTransaction,
  PaystackResponse,
  PaystackTimestampField,
} from "../adapters/providers/paystack/paystack.ts";
import { fetchPaystackTransactions } from "../adapters/providers/paystack/transport.ts";

const LIVE_SECRET_ENV = "RECONCILEKIT_PAYSTACK_SECRET_KEY";

export const EXIT_SUCCESS = 0;
export const EXIT_INPUT_FAILURE = 1;
export const EXIT_USAGE_ERROR = 2;
export const EXIT_UNEXPECTED_FAILURE = 3;

export interface CliIo {
  readonly readFile: (path: string) => string;
  readonly writeOut: (text: string) => void;
  readonly writeErr: (text: string) => void;
  readonly readEnv?: (name: string) => string | undefined;
  readonly fetchPaystackTransactions?: typeof fetchPaystackTransactions;
}

export const DEFAULT_IO: CliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  writeOut: (text) => process.stdout.write(text),
  writeErr: (text) => process.stderr.write(text),
  readEnv: (name) => process.env[name],
  fetchPaystackTransactions,
};

const PACKAGE_JSON_PATH = fileURLToPath(
  new URL("../../package.json", import.meta.url),
);

const CLI_OPTIONS = {
  merchant: { type: "string" },
  provider: { type: "string" },
  "live-paystack": { type: "boolean" },
  output: { type: "string" },
  "timestamp-field": { type: "string" },
  currencies: { type: "string" },
  "tolerance-ms": { type: "string" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

const HELP_TEXT = `ReconcileKit - compare your payment records against provider records

What this does:
  ReconcileKit compares the payments listed in your merchant CSV file
  against payment-provider records and reports, for each record, whether
  it matches, differs, or needs attention.

Usage:
  reconcilekit --merchant <path> (--provider <path> | --live-paystack) [options]

Required options:
  --merchant <path>          Path to your merchant CSV file
  --timestamp-field <field>  Which Paystack timestamp to compare:
                             created_at | paid_at | transaction_date
  --currencies <list>        Currency codes your records use, comma-separated
                             (e.g. NGN,USD)

Provider input (choose exactly one):
  --provider <path>          Path to a provider JSON file in the Paystack
                             Verify response shape
  --live-paystack            Fetch transactions live from Paystack using the
                             RECONCILEKIT_PAYSTACK_SECRET_KEY environment
                             variable. Mutually exclusive with --provider.

Options:
  --output <mode>            Output format: text (default) | json
  --tolerance-ms <n>         Allow timestamps to differ by up to n
                             milliseconds when comparing record times
  -h, --help                 Show this help and exit
  --version                  Print the version and exit

Merchant CSV columns:
  merchant_reference,amount,currency,status,occurred_at,merchant_record_id
  amount is in the currency's minor units (e.g. kobo for NGN).

Output:
  text - a plain-language summary with per-record results
  json - the full machine-readable reconciliation report

Exit codes:
  0  success. Reconciliation findings (such as DISCREPANCY) are report
     data, not errors.
  1  your input or the Paystack connection failed (unreadable file,
     malformed CSV/JSON, missing secret, or failed Paystack request)
  2  invalid command-line usage (unknown or missing options, bad
     combinations)
  3  unexpected internal failure
`;

export async function runCli(
  argv: readonly string[],
  io: CliIo = DEFAULT_IO,
): Promise<number> {
  const readEnv = io.readEnv ?? ((name: string) => process.env[name]);
  const fetchTx = io.fetchPaystackTransactions ?? fetchPaystackTransactions;

  let values: Record<string, string | boolean | string[] | undefined>;
  try {
    const parsed = parseArgs({
      args: [...argv],
      options: { ...CLI_OPTIONS },
      strict: true,
      allowPositionals: false,
    });
    values = parsed.values;
  } catch (error) {
    io.writeErr(usageError(errorMessage(error)));
    return EXIT_USAGE_ERROR;
  }

  if (booleanOption(values, "help")) {
    io.writeOut(HELP_TEXT);
    return EXIT_SUCCESS;
  }
  if (booleanOption(values, "version")) {
    io.writeOut(readPackageVersion(io));
    return EXIT_SUCCESS;
  }

  const live = booleanOption(values, "live-paystack");
  const providerPath = stringOption(values, "provider");

  if (stringOption(values, "merchant") === undefined) {
    io.writeErr(usageError("missing required option --merchant"));
    return EXIT_USAGE_ERROR;
  }
  if (live && providerPath !== undefined) {
    io.writeErr(
      usageError("--provider and --live-paystack are mutually exclusive"),
    );
    return EXIT_USAGE_ERROR;
  }
  if (!live && providerPath === undefined) {
    io.writeErr(usageError("missing required option --provider"));
    return EXIT_USAGE_ERROR;
  }
  for (const option of ["timestamp-field", "currencies"]) {
    if (stringOption(values, option) === undefined) {
      io.writeErr(usageError(`missing required option --${option}`));
      return EXIT_USAGE_ERROR;
    }
  }

  const merchantPath = stringOption(values, "merchant") as string;

  const outputMode = stringOption(values, "output") ?? "text";
  if (outputMode !== "text" && outputMode !== "json") {
    io.writeErr(
      usageError(
        `invalid --output ${JSON.stringify(outputMode)}: expected "text" or "json"`,
      ),
    );
    return EXIT_USAGE_ERROR;
  }

  const timestampField = stringOption(values, "timestamp-field") as string;
  if (
    !PAYSTACK_TIMESTAMP_FIELDS.includes(
      timestampField as PaystackTimestampField,
    )
  ) {
    io.writeErr(
      usageError(
        `invalid --timestamp-field ${JSON.stringify(timestampField)}: expected one of ${PAYSTACK_TIMESTAMP_FIELDS.join(", ")}`,
      ),
    );
    return EXIT_USAGE_ERROR;
  }

  const currencies = (stringOption(values, "currencies") as string)
    .split(",")
    .map((code) => code.trim());
  if (currencies.length === 0 || currencies.some((code) => code === "")) {
    io.writeErr(
      usageError(
        "invalid --currencies: expected a comma-separated list of currency codes",
      ),
    );
    return EXIT_USAGE_ERROR;
  }

  let timestampValidation: ReconciliationConfig["timestampValidation"] = {
    enabled: false,
  };
  const tolerance = stringOption(values, "tolerance-ms");
  if (tolerance !== undefined) {
    if (!/^\d+$/.test(tolerance) || !Number.isSafeInteger(Number(tolerance))) {
      io.writeErr(
        usageError(
          `invalid --tolerance-ms ${JSON.stringify(tolerance)}: expected a non-negative integer`,
        ),
      );
      return EXIT_USAGE_ERROR;
    }
    timestampValidation = { enabled: true, toleranceMs: Number(tolerance) };
  }

  let merchantText: string;
  try {
    merchantText = io.readFile(merchantPath);
  } catch (error) {
    io.writeErr(
      `error: cannot read merchant input file ${JSON.stringify(merchantPath)}: ${errorMessage(error)}\n` +
        "Your merchant CSV file could not be opened. Check that the file " +
        "exists at that path and that the path is correct, then run the " +
        "command again.\n",
    );
    return EXIT_INPUT_FAILURE;
  }

  let providerText: string | undefined;
  let secret: string | undefined;
  if (!live) {
    try {
      providerText = io.readFile(providerPath as string);
    } catch (error) {
      io.writeErr(
        `error: cannot read provider input file ${JSON.stringify(providerPath)}: ${errorMessage(error)}\n` +
          "Your provider file could not be opened. Check that the file " +
          "exists at that path and that the path is correct, then run the " +
          "command again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
  } else {
    secret = readEnv(LIVE_SECRET_ENV);
    if (secret === undefined || secret.trim() === "") {
      io.writeErr(
        `error: live Paystack mode requires the ${LIVE_SECRET_ENV} environment variable\n` +
          `Set the ${LIVE_SECRET_ENV} environment variable to your Paystack ` +
          `secret key, then run the command again.\n`,
      );
      return EXIT_INPUT_FAILURE;
    }
  }

  let merchantPayments;
  try {
    merchantPayments = parseMerchantCsv(merchantText);
  } catch (error) {
    io.writeErr(
      `error: merchant input failed: ${errorMessage(error)}\n` +
        "Your merchant CSV file has a data problem. Fix the invalid " +
        "record(s) and run the command again.\n",
    );
    return EXIT_INPUT_FAILURE;
  }

  const paystackOptions: PaystackAdapterOptions = {
    supportedCurrencies: currencies,
    timestampField: timestampField as PaystackTimestampField,
  };

  let mapped: PaystackMappedTransaction[];
  if (!live) {
    let providerResponse: PaystackResponse;
    try {
      providerResponse = JSON.parse(providerText as string) as PaystackResponse;
    } catch (error) {
      io.writeErr(
        `error: provider input is not valid JSON: ${errorMessage(error)}\n` +
          "The provider file must contain valid JSON in the expected " +
          "format. Check the file and run the command again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
    try {
      mapped = [mapPaystackResponse(providerResponse, paystackOptions)];
    } catch (error) {
      io.writeErr(
        `error: provider input failed: ${errorMessage(error)}\n` +
          "The provider file could not be mapped to a recognizable " +
          "payment record. Check that it is a Paystack transaction file " +
          "and run the command again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
  } else {
    let responses: readonly PaystackResponse[];
    try {
      responses = (await fetchTx({ secretKey: secret as string })).responses;
    } catch (error) {
      io.writeErr(
        `error: live Paystack request failed: ${errorMessage(error)}\n` +
          "This is a Paystack connection or access problem, not a " +
          "reconciliation finding - no records were matched. Check that " +
          "your secret key is correct and your network can reach Paystack, " +
          "then try again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
    try {
      mapped = mapPaystackResponses(responses, paystackOptions);
    } catch (error) {
      io.writeErr(
        `error: provider input failed: ${errorMessage(error)}\n` +
          "The data returned by Paystack could not be mapped to " +
          "recognizable payment records. Run the command again later.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
  }

  let report: ReconciliationReport;
  try {
    report = reconcileRecords({
      merchantPayments,
      providerPayments: mapped.map((m) => m.payment),
      config: { timestampValidation, supportedCurrencies: currencies },
      providerSourceAttributes: live
        ? mapped.map((m) => m.source_attributes)
        : undefined,
    });
  } catch (error) {
    io.writeErr(
      `error: unexpected internal failure while reconciling: ${errorMessage(error)}\n`,
    );
    return EXIT_UNEXPECTED_FAILURE;
  }

  try {
    io.writeOut(
      outputMode === "json" ? renderJson(report) : renderText(report, { live }),
    );
  } catch {
    io.writeErr("error: unexpected failure while writing the report output\n");
    return EXIT_UNEXPECTED_FAILURE;
  }
  return EXIT_SUCCESS;
}

function renderJson(report: ReconciliationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function renderText(
  report: ReconciliationReport,
  context: { readonly live: boolean },
): string {
  const summary = report.summary;
  const comparedAgainst = context.live
    ? "Paystack transactions fetched live from Paystack"
    : "the provider file you supplied";
  const lines: string[] = [
    "ReconcileKit reconciliation report",
    "",
    `This report compares your merchant records against ${comparedAgainst}.`,
    "",
    "Summary",
    `  ${"Records processed".padEnd(30)}${summary.totalRecords}`,
    `  ${"Matched".padEnd(30)}${summary.matched}`,
    `  ${"Discrepancies found".padEnd(30)}${summary.discrepancies}`,
    `  ${"Unresolved".padEnd(30)}${summary.unresolved}`,
    `  ${"Held for review (ambiguous)".padEnd(30)}${summary.heldAmbiguous}`,
    `  ${"Input errors".padEnd(30)}${summary.inputErrors}`,
    `  ${"Missing from provider records".padEnd(30)}${summary.missingProviderRecords}`,
    `  ${"Provider-only (unmatched)".padEnd(30)}${summary.unmatchedProviderRecords}`,
    `  ${"Missing or unusable reference".padEnd(30)}${summary.missingReference}`,
  ];
  const attention = attentionLines(summary);
  if (attention.length > 0) {
    lines.push(
      "",
      "What needs attention",
      ...attention.map((line) => `  ${line}`),
    );
  }
  lines.push("", "Results");
  if (report.results.length === 0) {
    lines.push("  (none)");
  } else {
    report.results.forEach((result, index) => {
      lines.push(describeResult(result, index + 1));
    });
  }
  return `${lines.join("\n")}\n`;
}

function attentionLines(summary: ReconciliationSummary): readonly string[] {
  const lines: string[] = [];
  if (summary.discrepancies > 0) {
    lines.push(
      `${summary.discrepancies} payment(s) matched at the provider but the details differ from your records. Review each Discrepancy result below.`,
    );
  }
  if (summary.inputErrors > 0) {
    lines.push(
      `${summary.inputErrors} record(s) have invalid input data and could not be compared. Fix them in the file and run the command again.`,
    );
  }
  if (summary.missingProviderRecords > 0) {
    lines.push(
      `${summary.missingProviderRecords} of your records have no matching provider payment. Check the reference or confirm all provider payments were fetched.`,
    );
  }
  if (summary.unmatchedProviderRecords > 0) {
    lines.push(
      `${summary.unmatchedProviderRecords} provider payment(s) have no matching record in your merchant file. They may be extra payments or may need records in your file.`,
    );
  }
  if (summary.unresolved > 0) {
    lines.push(
      `${summary.unresolved} record(s) could not be fully confirmed because a payment status is unresolved.`,
    );
  }
  if (summary.heldAmbiguous > 0) {
    lines.push(
      `${summary.heldAmbiguous} record(s) were held back because duplicate entries prevented a safe match.`,
    );
  }
  if (summary.missingReference > 0) {
    lines.push(
      `${summary.missingReference} record(s) have no usable reference and could not be compared.`,
    );
  }
  return lines;
}

function describeResult(result: MatchResult, position: number): string {
  const merchant = result.merchant_record
    ? `merchant ${display(result.merchant_record.merchant_reference)} (${display(result.merchant_record.merchant_record_id)})`
    : "no merchant record";
  const provider = result.provider_record
    ? `provider ${display(result.provider_record.reference)} (${display(result.provider_record.provider_id)})`
    : "no provider record";
  const codes =
    result.discrepancy_codes.length > 0
      ? ` | codes: ${result.discrepancy_codes.join(", ")}`
      : "";
  return `  ${position}. ${result.outcome} - ${merchant} | ${provider}${codes}`;
}

function display(value: string | null): string {
  return value === null || value === "" ? "-" : value;
}

function stringOption(
  values: Record<string, string | boolean | string[] | undefined>,
  key: string,
): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}

function booleanOption(
  values: Record<string, string | boolean | string[] | undefined>,
  key: string,
): boolean {
  return values[key] === true;
}

function usageError(message: string): string {
  return `error: ${message}\nRun "reconcilekit --help" for usage.\n`;
}

function readPackageVersion(io: CliIo): string {
  try {
    const metadata = JSON.parse(io.readFile(PACKAGE_JSON_PATH)) as {
      version?: string;
    };
    return `${metadata.version ?? "unknown"}\n`;
  } catch {
    return "unknown\n";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}
