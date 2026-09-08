import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import { manualCsvPaymentEvent } from "./adapters/manual-csv.ts";
import { ingestPaymentEvent } from "./ingest.ts";
import type { JsonlStore } from "../../store/jsonl-store.ts";
import type {
  IngestOutcome,
  PaymentEvent,
  PaymentEventInput,
  PaymentSource,
  SourceConfidence,
} from "./types.ts";

/**
 * Deterministic merchant CSV intake and onboarding boundary (Phase 3B).
 *
 * This module converts raw merchant-dashboard CSV exports into the existing
 * Payment Source Layer representation (`PaymentEventInput`) and records them
 * exactly once. It is intentionally NOT a reconciliation engine: ingestion
 * ends at normalized source/payment evidence. The frozen engine
 * (`reconcileRecords()` in `reconcilekit/src/application/reconcile-records.ts`)
 * remains the sole matching authority; CSV source references are evidence
 * only and never become the marketplace anchor (`mk_txn_…`).
 *
 * Identifier semantics (frozen in `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` §5):
 * - `payment_source_reference` = the raw CSV `source_reference` column (evidence).
 * - `source_event_id`          = `${importId}_${rowIndex}` (deterministic, replay-safe).
 * - `merchant_reference`       = the CSV `reference` column (merchant-side matching
 *   key). The layer never correlates or fuzzy-matches — exact matching is the engine's job.
 * - `transaction_id`           = always `null` for raw intake; never fabricated
 *   from CSV data. Hosts supply a marketplace anchor when one exists.
 *
 * Column aliasing is schema normalization only, never transaction correlation.
 */

/** CSV intake error categories. Each maps to a row, field, or the file itself. */
export const CsvImportErrorCode = {
  MALFORMED_CSV: "malformed_csv",
  MISSING_REQUIRED_COLUMN: "missing_required_column",
  MISSING_REFERENCE: "missing_reference",
  INVALID_AMOUNT: "invalid_amount",
  MISSING_CURRENCY: "missing_currency",
  INVALID_CURRENCY: "invalid_currency",
  INVALID_STATUS: "invalid_status",
  INVALID_TIMESTAMP: "invalid_timestamp",
  CONFLICTING_FIELDS: "conflicting_fields",
  NO_SOURCE_IDENTITY: "no_source_identity",
} as const;
export type CsvImportErrorCode =
  (typeof CsvImportErrorCode)[keyof typeof CsvImportErrorCode];

/** A per-row validation failure, carrying the offending row and field. */
export interface CsvRowError {
  readonly rowIndex: number;
  readonly code: CsvImportErrorCode;
  readonly message: string;
  readonly field?: string;
}

/** Per-row outcome within an import. */
export type CsvRowStatus = "accepted" | "rejected" | "duplicate";

export interface CsvRowDiagnostic {
  readonly rowIndex: number;
  status: CsvRowStatus;
  error?: CsvRowError;
}

/** Structured, provenance-rich result of a CSV import (pure parsing step). */
export interface CsvImportResult {
  readonly importId: string;
  readonly source: PaymentSource;
  readonly totalRows: number;
  readonly dataRows: number;
  readonly acceptedRows: number;
  readonly rejectedRows: number;
  /** Ingest-ready normalized events. Replay is reported by `recordCsvImport`. */
  readonly normalizedEvents: readonly PaymentEventInput[];
  readonly rowDiagnostics: readonly CsvRowDiagnostic[];
  readonly errors: readonly CsvRowError[];
}

/** Durable result after ingesting a CSV import exactly once. */
export interface CsvRecordedResult {
  readonly importId: string;
  readonly recorded: number;
  readonly replayed: number;
  readonly events: readonly PaymentEvent[];
}

/* ------------------------------------------------------------------ */
/* Column aliases (schema normalization, not matching).               */
/* ------------------------------------------------------------------ */

const REFERENCE_ALIASES: Readonly<string[]> = [
  "reference",
  "transaction_reference",
  "payment_reference",
  "merchant_reference",
];

const AMOUNT_ALIASES: Readonly<string[]> = [
  "amount",
  "amount_paid",
  "paid_amount",
  "amount_minor",
];

const CURRENCY_ALIASES: Readonly<string[]> = ["currency", "currency_code"];

const STATUS_ALIASES: Readonly<string[]> = ["status", "payment_status"];

const TIMESTAMP_ALIASES: Readonly<string[]> = [
  "occurred_at",
  "transaction_date",
  "created_at",
  "paid_at",
];

const SOURCE_REFERENCE_ALIASES: Readonly<string[]> = [
  "source_reference",
  "provider_reference",
  "source_identifier",
];

const SOURCE_EVENT_ID_ALIASES: Readonly<string[]> = ["source_event_id"];

const KNOWN_ALIASES: ReadonlySet<string> = new Set([
  ...REFERENCE_ALIASES,
  ...AMOUNT_ALIASES,
  ...CURRENCY_ALIASES,
  ...STATUS_ALIASES,
  ...TIMESTAMP_ALIASES,
  ...SOURCE_REFERENCE_ALIASES,
  ...SOURCE_EVENT_ID_ALIASES,
]);

interface ColumnMap {
  readonly referenceIndex: number | null;
  readonly amountIndex: number | null;
  readonly currencyIndex: number | null;
  readonly statusIndex: number | null;
  readonly timestampIndex: number | null;
  readonly sourceReferenceIndex: number | null;
  readonly headers: readonly string[];
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s]+/g, "_");
}

function firstMatching(
  headers: readonly string[],
  aliases: Readonly<string[]>,
): number | null {
  const found: number[] = [];
  for (let i = 0; i < headers.length; i += 1) {
    if (aliases.includes(normalizeHeader(headers[i]))) {
      found.push(i);
    }
  }
  if (found.length === 0) {
    return null;
  }
  if (found.length > 1) {
    // Ambiguous → caller treats as a conflict.
    return -2;
  }
  return found[0];
}

function buildColumnMap(headers: readonly string[]): {
  readonly map: ColumnMap;
  readonly error: CsvRowError | null;
} {
  const map: ColumnMap = {
    referenceIndex: firstMatching(headers, REFERENCE_ALIASES),
    amountIndex: firstMatching(headers, AMOUNT_ALIASES),
    currencyIndex: firstMatching(headers, CURRENCY_ALIASES),
    statusIndex: firstMatching(headers, STATUS_ALIASES),
    timestampIndex: firstMatching(headers, TIMESTAMP_ALIASES),
    sourceReferenceIndex: firstMatching(headers, SOURCE_REFERENCE_ALIASES),
    headers,
  };
  const required: Array<{
    readonly label: string;
    readonly index: number | null;
    readonly aliases: Readonly<string[]>;
  }> = [
    {
      label: "reference",
      index: map.referenceIndex,
      aliases: REFERENCE_ALIASES,
    },
    { label: "amount", index: map.amountIndex, aliases: AMOUNT_ALIASES },
    { label: "currency", index: map.currencyIndex, aliases: CURRENCY_ALIASES },
  ];
  for (const col of required) {
    if (col.index === null) {
      return {
        map,
        error: {
          rowIndex: 0,
          code: CsvImportErrorCode.MISSING_REQUIRED_COLUMN,
          message: `no distinct ${col.label} column found; expected one of [${col.aliases.join(
            ", ",
          )}], got [${headers.join(", ")}]`,
          field: col.label,
        },
      };
    }
    if (col.index === -2) {
      return {
        map,
        error: {
          rowIndex: 0,
          code: CsvImportErrorCode.CONFLICTING_FIELDS,
          message: `ambiguous header for ${col.label}; multiple distinct columns match [${col.aliases.join(
            ", ",
          )}], got [${headers.join(", ")}]`,
          field: col.label,
        },
      };
    }
  }
  return { map, error: null };
}

/* ------------------------------------------------------------------ */
/* Value normalization.                                               */
/* ------------------------------------------------------------------ */

/**
 * How the CSV `amount` column is denominated. `minor` (the default, matching
 * the reconcilekit fixture convention) treats the value as already-minor
 * integer units and uses it verbatim. `decimal` treats it as a decimal major
 * amount and converts to minor units on an explicit `scale`.
 */
export type CsvAmountUnit = "minor" | "decimal";

/**
 * Parse a monetary amount string into integer minor units, deterministically,
 * without floating point.
 * - `unit: "minor"` — value is already minor units: `"100000"` → 100000.
 * - `unit: "decimal"` — value is a decimal major amount: `"1000"` → 100000,
 *   `"9750.00"` → 975000, `"250.5"` → 25050 at a 2-decimal scale.
 * Returns `null` on any malformed or unit-mismatched input (decimal input in
 * `minor` mode, fractional input beyond scale in `decimal` mode).
 */
export function parseAmountMinor(
  value: string,
  unit: CsvAmountUnit = "minor",
  scale = 2,
): number | null {
  const raw = value.trim();
  if (raw === "") {
    return null;
  }
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  let minor: number;
  if (unit === "minor") {
    if (!/^\d{1,15}$/.test(unsigned)) {
      return null;
    }
    minor = Number(unsigned);
  } else {
    if (!/^\d{1,15}(\.\d{1,9})?$/.test(unsigned)) {
      return null;
    }
    const parts = unsigned.split(".");
    const whole = parts[0];
    const frac = parts.length > 1 ? parts[1] : "";
    if (frac.length > scale) {
      return null;
    }
    minor = Number(`${whole}${frac.padEnd(scale, "0")}`);
  }
  if (!Number.isSafeInteger(minor)) {
    return null;
  }
  return negative ? -minor : minor;
}

const STATUS_ALIAS_MAP: Readonly<Record<string, CanonicalPaymentStatus>> = {
  success: "SUCCESS",
  approved: "SUCCESS",
  failed: "FAILED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  pending: "PENDING",
  unknown: "UNKNOWN",
};

/** Map a raw CSV status to a canonical payment status, or `null` if unrecognized. */
export function normalizeStatus(
  raw: string | null,
): CanonicalPaymentStatus | null {
  if (raw === null) {
    return null;
  }
  const key = raw.trim().toLowerCase();
  const mapped = STATUS_ALIAS_MAP[key];
  if (mapped !== undefined) {
    return mapped;
  }
  return KNOWN_CANONICAL_STATUS.has(raw.trim())
    ? (raw.trim() as CanonicalPaymentStatus)
    : null;
}

const KNOWN_CANONICAL_STATUS: ReadonlySet<string> = new Set([
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "PENDING",
  "UNKNOWN",
]);

/** True when `value` parses as a timestamp (used only for diagnostics, never matching). */
export function isIso8601(value: string): boolean {
  return !Number.isNaN(Date.parse(value.trim()));
}

export function toEpochMs(value: string): number | null {
  const raw = value.trim();
  // A bare 10–16 digit string is unambiguously epoch milliseconds in this
  // domain (reconcilekit fixtures carry them verbatim); accept it directly.
  if (/^\d{10,16}$/.test(raw)) {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/* ------------------------------------------------------------------ */
/* CSV parsing (header detection + row splitting).                    */
/* ------------------------------------------------------------------ */

/** Minimal RFC-4180-ish CSV splitter (handles quoted fields and embedded commas). */
export function parseCsv(text: string): readonly string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const flushRow = (): void => {
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      flushRow();
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  if (row.length > 1 || field.trim() !== "") {
    flushRow();
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/* ------------------------------------------------------------------ */
/* Import.                                                            */
/* ------------------------------------------------------------------ */

export interface CsvImportOptions {
  /** Deterministic import identifier (must be stable across replays). */
  readonly importId?: string;
  /** Source provider label; defaults to `MANUAL_CSV`. */
  readonly source?: PaymentSource;
  /** Currencies accepted for validation (defaults to `NGN`). */
  readonly supportedCurrencies?: readonly string[];
  /** How the `amount` column is denominated; defaults to `minor` (already
   *  integer minor units), matching real reconcilekit/Paystack exports that
   *  carry kobo/cents verbatim. The conversion preview surfaces this so a
   *  decimal-major export user passes `amountUnit: "decimal"` explicitly. */
  readonly amountUnit?: CsvAmountUnit;
}

const DEFAULT_SUPPORTED_CURRENCIES: readonly string[] = ["NGN", "USD", "GBP"];

/**
 * Parse, validate, and normalize a merchant CSV into ingest-ready
 * `PaymentEventInput` drafts. Pure — does not touch a store.
 *
 * Each accepted row gains a deterministic `source_event_id` of
 * `${importId}_${rowIndex}` so the same import replay is exactly-once per row
 * (no random UUIDs). Persistence/replay is handled by `recordCsvImport`.
 */
export function importCsv(
  text: string,
  options: CsvImportOptions = {},
): CsvImportResult {
  const source = options.source ?? "MANUAL_CSV";
  const importId = options.importId ?? buildImportId(text);
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return emptyResult(importId, source);
  }
  const headers = rows[0];
  const { map, error: columnError } = buildColumnMap(headers);
  if (columnError !== null) {
    return {
      importId,
      source,
      totalRows: rows.length,
      dataRows: rows.length - 1,
      acceptedRows: 0,
      rejectedRows: rows.length - 1,
      normalizedEvents: [],
      rowDiagnostics: [],
      errors: [columnError],
    };
  }

  const supportedCurrencies =
    options.supportedCurrencies ?? DEFAULT_SUPPORTED_CURRENCIES;
  const amountUnit = options.amountUnit ?? "minor";
  const confidence: SourceConfidence = "IMPORTED";
  const diagnostics: CsvRowDiagnostic[] = [];
  const errors: CsvRowError[] = [];
  const normalized: PaymentEventInput[] = [];

  const dataRows = rows.slice(1);
  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < dataRows.length; i += 1) {
    const rowIndex = i + 1;
    const fields = dataRows[i];
    const diag: CsvRowDiagnostic = { rowIndex, status: "rejected" };

    const rowError = validateRow(fields, map, {
      rowIndex,
      supportedCurrencies,
      amountUnit,
    });
    if (rowError !== null) {
      diag.error = rowError;
      diagnostics.push(diag);
      errors.push(rowError);
      rejected += 1;
      continue;
    }

    const base = buildDraft(fields, map, {
      source,
      confidence,
      amountUnit,
    });
    if (base === null) {
      const err: CsvRowError = {
        rowIndex,
        code: CsvImportErrorCode.NO_SOURCE_IDENTITY,
        message: "row produced no source identity; refusing to fabricate one",
      };
      diag.error = err;
      diagnostics.push(diag);
      errors.push(err);
      rejected += 1;
      continue;
    }

    diag.status = "accepted";
    diagnostics.push(diag);
    normalized.push({
      ...base,
      source_event_id: `${importId}_${rowIndex}`,
    });
    accepted += 1;
  }

  return {
    importId,
    source,
    totalRows: rows.length,
    dataRows: rows.length - 1,
    acceptedRows: accepted,
    rejectedRows: rejected,
    normalizedEvents: normalized,
    rowDiagnostics: diagnostics,
    errors,
  };
}

function validateRow(
  fields: readonly string[],
  map: ColumnMap,
  ctx: {
    readonly rowIndex: number;
    readonly supportedCurrencies: readonly string[];
    readonly amountUnit: CsvAmountUnit;
  },
): CsvRowError | null {
  const reference = getField(fields, map, "reference");
  if (reference === null || reference.trim() === "") {
    return {
      rowIndex: ctx.rowIndex,
      code: CsvImportErrorCode.MISSING_REFERENCE,
      message: "row has no reference; refusing to fabricate one",
      field: "reference",
    };
  }

  const amountRaw = getField(fields, map, "amount");
  if (amountRaw === null || amountRaw.trim() === "") {
    return {
      rowIndex: ctx.rowIndex,
      code: CsvImportErrorCode.INVALID_AMOUNT,
      message:
        "row has no amount; rejecting from reconciliation-ready normalization",
      field: "amount",
    };
  }
  if (parseAmountMinor(amountRaw, ctx.amountUnit) === null) {
    return {
      rowIndex: ctx.rowIndex,
      code: CsvImportErrorCode.INVALID_AMOUNT,
      message: `cannot parse amount ${JSON.stringify(amountRaw)} as integer minor units (amountUnit=${ctx.amountUnit})`,
      field: "amount",
    };
  }

  const currencyRaw = getField(fields, map, "currency");
  if (currencyRaw === null || currencyRaw.trim() === "") {
    return {
      rowIndex: ctx.rowIndex,
      code: CsvImportErrorCode.MISSING_CURRENCY,
      message: "row has no currency; refusing to infer from amount or merchant",
      field: "currency",
    };
  }
  const currency = currencyRaw.trim().toUpperCase();
  if (!ctx.supportedCurrencies.includes(currency)) {
    return {
      rowIndex: ctx.rowIndex,
      code: CsvImportErrorCode.INVALID_CURRENCY,
      message: `currency ${JSON.stringify(currency)} not in supported set [${ctx.supportedCurrencies.join(
        ", ",
      )}]`,
      field: "currency",
    };
  }

  const statusRaw = getField(fields, map, "status");
  if (statusRaw !== null && statusRaw.trim() !== "") {
    if (normalizeStatus(statusRaw) === null) {
      return {
        rowIndex: ctx.rowIndex,
        code: CsvImportErrorCode.INVALID_STATUS,
        message: `status ${JSON.stringify(statusRaw)} is not a recognized payment status`,
        field: "status",
      };
    }
  }

  const timestampRaw = getField(fields, map, "timestamp");
  if (timestampRaw !== null && timestampRaw.trim() !== "") {
    if (toEpochMs(timestampRaw) === null) {
      return {
        rowIndex: ctx.rowIndex,
        code: CsvImportErrorCode.INVALID_TIMESTAMP,
        message: `cannot parse timestamp ${JSON.stringify(timestampRaw)}`,
        field: "timestamp",
      };
    }
  }

  return null;
}

function buildDraft(
  fields: readonly string[],
  map: ColumnMap,
  ctx: {
    readonly source: PaymentSource;
    readonly confidence: SourceConfidence;
    readonly amountUnit: CsvAmountUnit;
  },
): PaymentEventInput | null {
  const reference = getField(fields, map, "reference");
  const amountRaw = getField(fields, map, "amount");
  const amountMinor = parseAmountMinor(amountRaw ?? "", ctx.amountUnit);
  if (reference === null || amountMinor === null) {
    return null;
  }
  const currency =
    getField(fields, map, "currency")?.trim().toUpperCase() ?? "";
  const statusRaw = getField(fields, map, "status");
  const status =
    statusRaw !== null && statusRaw.trim() !== ""
      ? normalizeStatus(statusRaw)
      : null;
  const timestampRaw = getField(fields, map, "timestamp");
  const occurredAtEpoch =
    timestampRaw !== null && timestampRaw.trim() !== ""
      ? toEpochMs(timestampRaw)
      : null;
  const sourceReference = getField(fields, map, "sourceReference");
  const occurredAtIso =
    occurredAtEpoch !== null ? new Date(occurredAtEpoch).toISOString() : null;

  return manualCsvPaymentEvent(
    {
      reference,
      amountMinor,
      currency,
      occurredAt: occurredAtIso,
      status,
      sourceReference:
        sourceReference !== null && sourceReference.trim() !== ""
          ? sourceReference.trim()
          : null,
      sourceAttributes: buildSourceAttributes(fields, map),
    },
    {
      transactionId: null,
      sourceConfidence: ctx.confidence,
    },
  );
}

function buildSourceAttributes(
  fields: readonly string[],
  map: ColumnMap,
): SourceAttributes {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 1) {
    const header = map.headers[i];
    if (header === undefined) {
      continue;
    }
    const h = normalizeHeader(header);
    if (KNOWN_ALIASES.has(h)) {
      continue;
    }
    const value = fields[i]?.trim();
    if (value !== undefined && value !== "" && !(h in attrs)) {
      attrs[h] = value;
    }
  }
  return attrs;
}

/**
 * Ingest an already-normalized CSV import exactly once, reusing the frozen
 * `buildIdempotencyKey`/`ingestPaymentEvent` mechanism. Reports recorded versus
 * replayed (duplicate) events. Rows rejected at parse time are not persisted.
 */
export async function recordCsvImport(
  store: JsonlStore,
  result: CsvImportResult,
  options: { readonly now?: number } = {},
): Promise<CsvRecordedResult> {
  const events: PaymentEvent[] = [];
  let recorded = 0;
  let replayed = 0;
  for (const draft of result.normalizedEvents) {
    const outcome: IngestOutcome = await ingestPaymentEvent(store, draft, {
      now: options.now,
    });
    events.push(outcome.event);
    if (outcome.replay) {
      replayed += 1;
    } else {
      recorded += 1;
    }
  }
  return { importId: result.importId, recorded, replayed, events };
}

function emptyResult(importId: string, source: PaymentSource): CsvImportResult {
  return {
    importId,
    source,
    totalRows: 0,
    dataRows: 0,
    acceptedRows: 0,
    rejectedRows: 0,
    normalizedEvents: [],
    rowDiagnostics: [],
    errors: [],
  };
}

function getField(
  fields: readonly string[],
  map: ColumnMap,
  field:
    | "reference"
    | "amount"
    | "currency"
    | "status"
    | "timestamp"
    | "sourceReference",
): string | null {
  let idx: number | null = null;
  switch (field) {
    case "reference":
      idx = map.referenceIndex;
      break;
    case "amount":
      idx = map.amountIndex;
      break;
    case "currency":
      idx = map.currencyIndex;
      break;
    case "status":
      idx = map.statusIndex;
      break;
    case "timestamp":
      idx = map.timestampIndex;
      break;
    case "sourceReference":
      idx = map.sourceReferenceIndex;
      break;
  }
  if (idx === null || idx < 0 || idx >= fields.length) {
    return null;
  }
  return fields[idx] ?? null;
}

/** Stable import identifier derived from CSV text (replay-safe, no random UUIDs). */
export function buildImportId(csvText: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < csvText.length; i += 1) {
    hash ^= csvText.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return `csv_${hash.toString(16).padStart(8, "0")}`;
}
