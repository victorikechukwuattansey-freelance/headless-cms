#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { DEFAULT_DATA_DIR } from "../config.ts";
import { JsonlStore } from "../store/jsonl-store.ts";
import {
  importCsv,
  recordCsvImport,
  type CsvAmountUnit,
  type CsvImportResult,
} from "../marketplace/payment-sources/csv-intake.ts";
import {
  buildIdempotencyKey,
  buildPaymentEventId,
} from "../marketplace/payment-sources/ingest.ts";
import { toReconcileKitRequest } from "../marketplace/payment-sources/to-reconcilekit.ts";
import type {
  PaymentEvent,
  PaymentEventInput,
} from "../marketplace/payment-sources/types.ts";
import { reconcileRecords } from "../../../src/application/reconcile-records.ts";
import type { ReconcileRecordsRequest } from "../../../src/application/reconcile-records.ts";
import {
  mapPaystackResponse,
  mapPaystackResponses,
  PAYSTACK_TIMESTAMP_FIELDS,
  type PaystackAdapterOptions,
  type PaystackMappedTransaction,
  type PaystackResponse,
  type PaystackTimestampField,
} from "../../../src/adapters/providers/paystack/paystack.ts";
import { fetchPaystackTransactions } from "../../../src/adapters/providers/paystack/transport.ts";
import type {
  MatchResult,
  ReconciliationConfig,
  ReconciliationReport,
  ReconciliationSummary,
} from "../../../src/domain/model.ts";

/**
 * Local operator CLI for the Phase 3B Merchant CSV Intake (Phase 3A unblocker).
 *
 * This is the operator-facing entry point the Phase 3B layer was missing. It
 * composes the existing library boundaries and modifies nothing under
 * `reconcilekit/src/**` (the frozen core): merchant CSV parsing comes from
 * `importCsv`, durable exactly-once recording from `recordCsvImport`, the
 * merchant-side projection from `toReconcileKitRequest`, provider evidence
 * from the existing Paystack adapter, and matching from the unchanged engine
 * (`reconcileRecords`). No CSV parsing, correlation, or matching logic is
 * recreated here.
 *
 * Modes:
 * - preview (default): parse + validate + normalize + show the per-row
 *   interpretation and the projected report WITHOUT writing anything.
 * - --run: record the import exactly once (`recordCsvImport`), then build the
 *   report from the recorded events.
 *
 * Provider evidence is Paystack Verify JSON (--provider) or a live Paystack
 * fetch (--live-paystack) in test mode. Provider CSV files are rejected
 * explicitly: a provider CSV cannot be reconciled structurally (no
 * deterministic join anchor with merchant CSV rows).
 */

export const EXIT_SUCCESS = 0;
export const EXIT_INPUT_FAILURE = 1;
export const EXIT_USAGE_ERROR = 2;
export const EXIT_UNEXPECTED_FAILURE = 3;

const LIVE_SECRET_ENV = "RECONCILEKIT_PAYSTACK_SECRET_KEY";
const STOREFRONT_SECRET_ENV = "STOREFRONT_PAYSTACK_SECRET_KEY";
const DEFAULT_TOLERANCE_MS = 60_000;
const DEFAULT_AMOUNT_UNIT: CsvAmountUnit = "minor";

export interface PilotRunIo {
  readonly readFile: (path: string) => string;
  readonly writeOut: (text: string) => void;
  readonly writeErr: (text: string) => void;
  readonly readEnv?: (name: string) => string | undefined;
  readonly fetchPaystackTransactions?: typeof fetchPaystackTransactions;
  readonly now?: () => number;
}

export const DEFAULT_PILOT_IO: PilotRunIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  writeOut: (text) => process.stdout.write(text),
  writeErr: (text) => process.stderr.write(text),
  readEnv: (name) => process.env[name],
  fetchPaystackTransactions,
  now: () => Date.now(),
};

const PACKAGE_JSON_PATH = fileURLToPath(
  new URL("../../package.json", import.meta.url),
);

const STRING_OPTION_KEYS = [
  "merchant",
  "provider",
  "data-dir",
  "amount-unit",
  "currencies",
  "timestamp-field",
  "tolerance-ms",
  "import-id",
  "output",
] as const;

const PILOT_OPTIONS = {
  merchant: { type: "string" },
  provider: { type: "string" },
  "live-paystack": { type: "boolean" },
  "data-dir": { type: "string" },
  "amount-unit": { type: "string" },
  currencies: { type: "string" },
  "timestamp-field": { type: "string" },
  "tolerance-ms": { type: "string" },
  "import-id": { type: "string" },
  run: { type: "boolean" },
  output: { type: "string" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
} as const;

const HELP_TEXT = `ReconcileKit payment-source pilot - run the Phase 3B merchant CSV intake as an operator

What this does:
  Reads your merchant CSV file, normalizes it through the Phase 3B intake,
  records it exactly once, and reconciles it against provider evidence so a
  local operator can run the merchant-CSV pilot end to end.

Usage:
  pilot-run --merchant <path> (--provider <path> | --live-paystack)
            --timestamp-field <field> --currencies <list> [options]

Modes:
  (default)  preview only - parse, validate, normalize, and show the per-row
             interpretation plus the projected report. Nothing is written.
  --run      record the import exactly once, then reconcile the recorded
             events and report.

Required options:
  --merchant <path>          Path to your merchant CSV file
  --timestamp-field <field>  Which Paystack timestamp to compare:
                             created_at | paid_at | transaction_date
  --currencies <list>        Currency codes your records use, comma-separated
                             (e.g. NGN,USD)

Provider input (choose exactly one):
  --provider <path>          Path to a provider JSON file in the Paystack
                             Verify response shape (a single response object
                             or an array of response objects)
  --live-paystack            Fetch transactions live from Paystack in test
                             mode using the RECONCILEKIT_PAYSTACK_SECRET_KEY
                             (or STOREFRONT_PAYSTACK_SECRET_KEY) environment
                             variable. Mutually exclusive with --provider.

Options:
  --data-dir <path>          Storefront data directory to read or record the
                             payment-events store from (default: the
                             storefront data directory, or $STOREFRONT_DATA_DIR)
  --amount-unit <unit>       How the CSV amount column is denominated:
                             minor (default) | decimal. minor treats values as
                             integer minor units (e.g. kobo/cents); decimal
                             converts decimal major amounts to minor units.
  --tolerance-ms <n>         Allow timestamps to differ by up to n
                             milliseconds when comparing record times
                             (default: 60000)
  --import-id <id>           Explicit import identifier (default: a stable
                             hash of the CSV content, so replays are exact)
  --output <mode>            Output format: text (default) | json
  -h, --help                 Show this help and exit
  --version                  Print the version and exit

Merchant CSV columns:
  reference,amount,currency,status,occurred_at,source_reference
  Amount is interpreted as integer minor units unless --amount-unit decimal
  is passed. The reference column is the merchant-side matching key.

Provider CSV is NOT supported:
  A provider CSV file cannot be used as reconciliation evidence. Provider
  evidence must be Paystack Verify JSON (--provider) or a live Paystack
  fetch (--live-paystack). See docs/PHASE_3A_LOCAL_OPERATOR_GUIDE.md.

Exit codes:
  0  success. Reconciliation findings (such as DISCREPANCY) are report data.
  1  your input, the provider connection, or the store write failed
  2  invalid command-line usage
  3  unexpected internal failure
`;

export interface ProviderCsvRejection {
  readonly reason: string;
}

/** Plain-language rule for why provider CSV is rejected as evidence. */
export function providerCsvError(path: string): string {
  return (
    `error: the provider file ${JSON.stringify(path)} has a CSV structure, but provider CSV files are not supported as reconciliation evidence.\n` +
    `ReconcileKit matches provider evidence as Paystack Verify JSON (--provider) or live Paystack test-mode transactions (--live-paystack).\n` +
    `A provider CSV cannot be reconciled structurally: it carries no deterministic join anchor against merchant CSV rows.\n` +
    `Export Paystack Verify JSON for the transactions, or use --live-paystack in test mode.\n` +
    `See docs/PHASE_3A_LOCAL_OPERATOR_GUIDE.md for the supported provider evidence formats.\n`
  );
}

/** True when `text` looks like a CSV data file rather than JSON. */
export function looksLikeCsv(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length < 2) {
    return false;
  }
  return lines.every((line) => line.includes(","));
}

export async function runPilotCli(
  argv: readonly string[],
  io: PilotRunIo = DEFAULT_PILOT_IO,
): Promise<number> {
  const readEnv = io.readEnv ?? ((name: string) => process.env[name]);
  const fetchTx = io.fetchPaystackTransactions ?? fetchPaystackTransactions;

  let values: Record<string, string | boolean | string[] | undefined>;
  try {
    const parsed = parseArgs({
      args: [...argv],
      options: { ...PILOT_OPTIONS },
      strict: true,
      allowPositionals: false,
    });
    values = parsed.values;
  } catch (error) {
    io.writeErr(usageError(errorMessage(error)));
    return EXIT_USAGE_ERROR;
  }

  for (const key of STRING_OPTION_KEYS) {
    let occurrences = 0;
    for (const arg of argv) {
      if (arg === `--${key}` || arg.startsWith(`--${key}=`)) {
        occurrences += 1;
      }
    }
    if (occurrences > 1) {
      io.writeErr(usageError(`option --${key} was supplied more than once`));
      return EXIT_USAGE_ERROR;
    }
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
  const outputMode = stringOption(values, "output") ?? "text";
  const amountUnitRaw =
    stringOption(values, "amount-unit") ?? DEFAULT_AMOUNT_UNIT;
  const dataDir = stringOption(values, "data-dir") ?? resolveDataDir(readEnv);
  const run = booleanOption(values, "run");

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
  if (outputMode !== "text" && outputMode !== "json") {
    io.writeErr(
      usageError(
        `invalid --output ${JSON.stringify(outputMode)}: expected "text" or "json"`,
      ),
    );
    return EXIT_USAGE_ERROR;
  }
  if (amountUnitRaw !== "minor" && amountUnitRaw !== "decimal") {
    io.writeErr(
      usageError(
        `invalid --amount-unit ${JSON.stringify(amountUnitRaw)}: expected "minor" or "decimal"`,
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

  let toleranceMs = DEFAULT_TOLERANCE_MS;
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
    toleranceMs = Number(tolerance);
  }

  const merchantPath = stringOption(values, "merchant") as string;

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

  const paystackOptions: PaystackAdapterOptions = {
    supportedCurrencies: currencies,
    timestampField: timestampField as PaystackTimestampField,
  };

  let mapped: PaystackMappedTransaction[];
  let providerSourceLabel: string;
  if (live) {
    const secret = readEnv(LIVE_SECRET_ENV) ?? readEnv(STOREFRONT_SECRET_ENV);
    if (secret === undefined || secret.trim() === "") {
      io.writeErr(
        `error: live Paystack mode requires the ${LIVE_SECRET_ENV} environment variable (or ${STOREFRONT_SECRET_ENV})\n` +
          `Set it to your Paystack secret key, then run the command again.\n`,
      );
      return EXIT_INPUT_FAILURE;
    }
    let responses: readonly PaystackResponse[];
    try {
      responses = (await fetchTx({ secretKey: secret })).responses;
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
          "recognizable payment records.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
    providerSourceLabel = "Paystack transactions fetched live (test mode)";
  } else {
    const providerPathValue = providerPath as string;
    if (providerPathValue.toLowerCase().endsWith(".csv")) {
      io.writeErr(providerCsvError(providerPathValue));
      return EXIT_INPUT_FAILURE;
    }
    let providerText: string;
    try {
      providerText = io.readFile(providerPathValue);
    } catch (error) {
      io.writeErr(
        `error: cannot read provider input file ${JSON.stringify(providerPathValue)}: ${errorMessage(error)}\n` +
          "Your provider file could not be opened. Check that the file " +
          "exists at that path and that the path is correct, then run the " +
          "command again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(providerText);
    } catch {
      if (looksLikeCsv(providerText)) {
        io.writeErr(providerCsvError(providerPathValue));
      } else {
        io.writeErr(
          `error: provider input is not valid JSON: ${JSON.stringify(providerPathValue)}\n` +
            "The provider file must contain valid JSON in the expected " +
            "format. If this is a provider CSV, provider CSV files are not " +
            "supported as reconciliation evidence.\n",
        );
      }
      return EXIT_INPUT_FAILURE;
    }
    try {
      mapped = Array.isArray(parsed)
        ? mapPaystackResponses(
            parsed as readonly PaystackResponse[],
            paystackOptions,
          )
        : [mapPaystackResponse(parsed as PaystackResponse, paystackOptions)];
    } catch (error) {
      io.writeErr(
        `error: provider input failed: ${errorMessage(error)}\n` +
          "The provider file could not be mapped to a recognizable " +
          "payment record. Check that it is a Paystack Verify JSON file " +
          "and run the command again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
    providerSourceLabel = "the provider Verify JSON file you supplied";
  }

  const importId = stringOption(values, "import-id");
  const importResult = importCsv(merchantText, {
    importId,
    supportedCurrencies: currencies,
    amountUnit: amountUnitRaw as CsvAmountUnit,
  });

  if (importResult.acceptedRows === 0) {
    io.writeErr(
      `error: merchant CSV import accepted 0 of ${Math.max(importResult.dataRows, 0)} data rows\n` +
        describeImportErrors(importResult.errors) +
        "Fix the file and run the command again.\n",
    );
    return EXIT_INPUT_FAILURE;
  }
  if (importResult.rejectedRows > 0) {
    io.writeErr(
      `error: merchant CSV import rejected ${importResult.rejectedRows} of ${importResult.dataRows} data rows\n` +
        describeImportErrors(importResult.errors) +
        "Fix the file and run the command again.\n",
    );
    return EXIT_INPUT_FAILURE;
  }

  const now = () => io.now?.() ?? Date.now();
  const config: ReconciliationConfig = {
    timestampValidation: { enabled: true, toleranceMs },
    supportedCurrencies: currencies,
  };

  let events: readonly PaymentEvent[];
  let recorded: {
    readonly recorded: number;
    readonly replayed: number;
  } | null = null;
  if (run) {
    try {
      const store = new JsonlStore(dataDir);
      const outcome = await recordCsvImport(store, importResult, {
        now: now(),
      });
      events = outcome.events;
      recorded = { recorded: outcome.recorded, replayed: outcome.replayed };
    } catch (error) {
      io.writeErr(
        `error: cannot record the import in ${JSON.stringify(dataDir)}: ${errorMessage(error)}\n` +
          "The payment-events store could not be written. Check that the " +
          "data directory is writable, then run the command again.\n",
      );
      return EXIT_INPUT_FAILURE;
    }
  } else {
    events = importResult.normalizedEvents.map((draft) =>
      projectEvent(draft, now()),
    );
  }

  const request = buildRequest(events, mapped, config);

  let report: ReconciliationReport;
  try {
    report = reconcileRecords(request);
  } catch (error) {
    io.writeErr(
      `error: unexpected internal failure while reconciling: ${errorMessage(error)}\n`,
    );
    return EXIT_UNEXPECTED_FAILURE;
  }

  try {
    io.writeOut(
      outputMode === "json"
        ? renderJson({
            phase: run ? "recorded" : "preview",
            dataDir,
            currencies,
            importResult,
            amountUnit: amountUnitRaw as CsvAmountUnit,
            providerSourceLabel,
            providerCount: mapped.length,
            recorded,
            report,
          })
        : renderText({
            phase: run ? "recorded" : "preview",
            dataDir,
            currencies,
            importResult,
            amountUnit: amountUnitRaw as CsvAmountUnit,
            providerSourceLabel,
            providerCount: mapped.length,
            recorded,
            report,
          }),
    );
  } catch {
    io.writeErr("error: unexpected failure while writing the report output\n");
    return EXIT_UNEXPECTED_FAILURE;
  }
  return EXIT_SUCCESS;
}

/* ------------------------------------------------------------------ */
/* Report data.                                                       */
/* ------------------------------------------------------------------ */

interface PilotRunContext {
  readonly phase: "preview" | "recorded";
  readonly dataDir: string;
  readonly currencies: readonly string[];
  readonly importResult: CsvImportResult;
  readonly amountUnit: CsvAmountUnit;
  readonly providerSourceLabel: string;
  readonly providerCount: number;
  readonly recorded: {
    readonly recorded: number;
    readonly replayed: number;
  } | null;
  readonly report: ReconciliationReport;
}

function renderJson(context: PilotRunContext): string {
  const document = {
    phase: context.phase,
    dataDir: context.dataDir,
    import: {
      importId: context.importResult.importId,
      source: context.importResult.source,
      totalRows: context.importResult.totalRows,
      dataRows: context.importResult.dataRows,
      acceptedRows: context.importResult.acceptedRows,
      rejectedRows: context.importResult.rejectedRows,
      amountUnit: context.amountUnit,
      rows: context.importResult.normalizedEvents.map((event) => ({
        merchant_reference: event.merchant_reference,
        payment_source_reference: event.payment_source_reference,
        source_event_id: event.source_event_id,
        amount: event.amount,
        currency: event.currency,
        status: event.status,
        occurred_at: event.occurred_at,
      })),
    },
    provider: {
      source: context.providerSourceLabel,
      count: context.providerCount,
    },
    recorded: context.recorded,
    engine: context.report,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

function renderText(context: PilotRunContext): string {
  const report = context.report;
  const lines: string[] = [
    "ReconcileKit payment-source pilot report",
    "",
    `Phase: ${context.phase === "preview" ? "preview - no data was written" : "recorded - the import was written to the payment-events store"}`,
    "",
    "Import",
    `  ${"import id".padEnd(30)}${context.importResult.importId}`,
    `  ${"source".padEnd(30)}${context.importResult.source}`,
    `  ${"rows".padEnd(30)}${context.importResult.totalRows} (${context.importResult.dataRows} data rows)`,
    `  ${"accepted".padEnd(30)}${context.importResult.acceptedRows}`,
    `  ${"rejected".padEnd(30)}${context.importResult.rejectedRows}`,
    `  ${"amount unit".padEnd(30)}${amountUnitLabel(context.amountUnit)}`,
    `  ${"currency set".padEnd(30)}${context.currencies.join(", ")}`,
    "",
    "Merchant row interpretation (per accepted row)",
  ];
  context.importResult.normalizedEvents.forEach((event, index) => {
    lines.push(
      `  ${index + 1}. ${event.merchant_reference ?? "-"}  ${event.currency} ${event.amount} ${context.amountUnit === "decimal" ? "(decimal major converted to minor units)" : "(minor units)"}  ${event.status ?? "-"}  occurred ${event.occurred_at ?? "-"}  source_reference ${event.payment_source_reference ?? "-"}`,
    );
  });
  lines.push(
    "",
    "Provider evidence",
    `  ${"source".padEnd(30)}${context.providerSourceLabel}`,
    `  ${"provider records".padEnd(30)}${context.providerCount}`,
    "  provider CSV files are not supported as reconciliation evidence",
  );
  if (context.recorded !== null) {
    lines.push(
      "",
      "Recording",
      `  ${"recorded".padEnd(30)}${context.recorded.recorded}`,
      `  ${"replayed (exactly-once)".padEnd(30)}${context.recorded.replayed}`,
    );
  }
  lines.push("", ...descriptionLines(report.summary));
  lines.push("", "Results");
  if (report.results.length === 0) {
    lines.push("  (none)");
  } else {
    report.results.forEach((result, index) => {
      lines.push(describeResult(result, index + 1));
    });
  }
  if (context.phase === "preview") {
    lines.push(
      "",
      `Nothing was written to disk. Re-run with --run to record exactly once ` +
        `in ${JSON.stringify(context.dataDir)} and reconcile from the recorded events.`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function descriptionLines(summary: ReconciliationSummary): readonly string[] {
  return [
    "Reconciliation summary",
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
}

function describeResult(result: MatchResult, position: number): string {
  const merchant = result.merchant_record
    ? `merchant ${display(result.merchant_record.merchant_reference)}`
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

function amountUnitLabel(unit: CsvAmountUnit): string {
  return unit === "minor"
    ? "minor - integer minor units (e.g. kobo/cents for NGN)"
    : "decimal - decimal major amounts converted to minor units";
}

function describeImportErrors(
  errors: readonly {
    readonly rowIndex: number;
    readonly code: string;
    readonly message: string;
  }[],
): string {
  if (errors.length === 0) {
    return "";
  }
  const lines = errors.map((error) => {
    const where = error.rowIndex === 0 ? "file" : `row ${error.rowIndex}`;
    return `  ${where}: [${error.code}] ${error.message}\n`;
  });
  return `Rejected rows:\n${lines.join("")}`;
}

/* ------------------------------------------------------------------ */
/* Projection helpers.                                                */
/* ------------------------------------------------------------------ */

/**
 * Project a normalized draft into the PaymentEvent shape ingest will produce,
 * using the exact same deterministic idempotency helpers (`buildIdempotencyKey`
 * then `buildPaymentEventId`). Used ONLY for the preview so the preview report
 * matches the future recorded state without touching a store.
 */
export function projectEvent(
  input: PaymentEventInput,
  now: number,
): PaymentEvent {
  const idempotency_key = buildIdempotencyKey(input);
  const event_id = buildPaymentEventId(idempotency_key);
  return {
    ...input,
    id: event_id,
    event_id,
    idempotency_key,
    observed_at: now,
  };
}

/**
 * Build the reconcile request: the merchant-side projection from the recorded
 * events, plus the provider evidence mapped from Paystack. Identities stay
 * source-owned: the provider reference is the Paystack reference the file uses
 * as its join reference (the engine's exact-match key), and every external
 * reference also survives as source evidence.
 */
export function buildRequest(
  events: readonly PaymentEvent[],
  mapped: readonly PaystackMappedTransaction[],
  config: ReconciliationConfig,
): ReconcileRecordsRequest {
  const base = toReconcileKitRequest(events, config);
  return {
    merchantPayments: base.merchantPayments,
    providerPayments: mapped.map((entry) => entry.payment),
    config,
    providerSourceAttributes: [
      ...(base.providerSourceAttributes ?? []),
      ...mapped.map((entry) => entry.source_attributes),
    ],
  };
}

function resolveDataDir(readEnv: (name: string) => string | undefined): string {
  const fromEnv = readEnv("STOREFRONT_DATA_DIR");
  return fromEnv !== undefined && fromEnv.trim() !== ""
    ? fromEnv
    : DEFAULT_DATA_DIR;
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
  return `error: ${message}\nRun "reconcilekit-pilot --help" for usage.\n`;
}

function readPackageVersion(io: PilotRunIo): string {
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
  process.exitCode = await runPilotCli(process.argv.slice(2));
}
