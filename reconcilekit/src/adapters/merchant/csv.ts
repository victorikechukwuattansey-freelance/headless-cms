import { parse } from "csv-parse/sync";
import type {
  CanonicalPaymentStatus,
  CurrencyCode,
  MerchantPayment,
  Timestamp,
} from "../../domain/model.ts";
import { CANONICAL_STATUSES } from "../../domain/validation.ts";

export type MerchantCsvErrorCode =
  | "MERCHANT_CSV_INVALID_OPTION"
  | "MERCHANT_CSV_PARSE_ERROR"
  | "MERCHANT_CSV_MISSING_COLUMN"
  | "MERCHANT_CSV_MAPPING_ERROR";

export class MerchantCsvError extends Error {
  readonly code: MerchantCsvErrorCode;
  readonly record: number | null;

  constructor(
    code: MerchantCsvErrorCode,
    message: string,
    options?: { cause?: unknown; record?: number },
  ) {
    super(message, options);
    this.name = "MerchantCsvError";
    this.code = code;
    this.record = options?.record ?? null;
  }
}

export interface MerchantCsvOptions {
  readonly delimiter?: string;
}

const REQUIRED_COLUMNS = ["amount", "currency"] as const;

const AMOUNT_PATTERN = /^\d+$/;
const EPOCH_MILLIS_PATTERN = /^\d+$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXPLICIT_TIME_ZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

export function parseMerchantCsv(
  input: string,
  options: MerchantCsvOptions = {},
): MerchantPayment[] {
  const delimiter = options.delimiter ?? ",";
  if (delimiter.length !== 1) {
    throw new MerchantCsvError(
      "MERCHANT_CSV_INVALID_OPTION",
      `delimiter must be a single character, received ${JSON.stringify(delimiter)}`,
    );
  }
  let rows: string[][];
  try {
    rows = parse(input, {
      delimiter,
      skip_empty_lines: true,
      trim: false,
      cast: false,
    }) as string[][];
  } catch (error) {
    throw new MerchantCsvError(
      "MERCHANT_CSV_PARSE_ERROR",
      `merchant CSV parsing failed: ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0];
  const columnIndex = buildColumnIndex(header);
  for (const column of REQUIRED_COLUMNS) {
    if (columnIndex.get(column) === undefined) {
      throw new MerchantCsvError(
        "MERCHANT_CSV_MISSING_COLUMN",
        `merchant CSV is missing required column "${column}" (header: ${header.join(",")})`,
      );
    }
  }
  const payments: MerchantPayment[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    payments.push(mapRow(rows[index], columnIndex, index));
  }
  return payments;
}

function buildColumnIndex(
  header: readonly string[],
): ReadonlyMap<string, number> {
  const index = new Map<string, number>();
  header.forEach((column, position) => {
    if (!index.has(column)) {
      index.set(column, position);
    }
  });
  return index;
}

function mapRow(
  row: readonly string[],
  columnIndex: ReadonlyMap<string, number>,
  recordNumber: number,
): MerchantPayment {
  return {
    merchant_record_id: cell(row, columnIndex, "merchant_record_id"),
    merchant_reference: cell(row, columnIndex, "merchant_reference"),
    amount: mapAmount(cell(row, columnIndex, "amount"), recordNumber),
    currency: mapCurrency(cell(row, columnIndex, "currency")),
    status: mapStatus(cell(row, columnIndex, "status")),
    occurred_at: mapTimestamp(
      cell(row, columnIndex, "occurred_at"),
      recordNumber,
    ),
  };
}

function cell(
  row: readonly string[],
  columnIndex: ReadonlyMap<string, number>,
  column: string,
): string | null {
  const position = columnIndex.get(column);
  return position === undefined ? null : row[position];
}

function mapAmount(raw: string | null, recordNumber: number): number {
  if (raw === null) {
    throw mappingError(
      `amount is missing in record ${recordNumber}`,
      recordNumber,
    );
  }
  if (!AMOUNT_PATTERN.test(raw)) {
    throw mappingError(
      `invalid amount ${JSON.stringify(raw)} in record ${recordNumber}: expected a non-negative integer in minor units`,
      recordNumber,
    );
  }
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount)) {
    throw mappingError(
      `amount exceeds the safe integer range in record ${recordNumber}`,
      recordNumber,
    );
  }
  return amount;
}

function mapCurrency(raw: string | null): CurrencyCode {
  if (raw === null) {
    return "";
  }
  return raw;
}

function mapStatus(raw: string | null): CanonicalPaymentStatus | null {
  if (raw === null || raw === "") {
    return null;
  }
  if (CANONICAL_STATUSES.includes(raw as CanonicalPaymentStatus)) {
    return raw as CanonicalPaymentStatus;
  }
  return "UNKNOWN";
}

function mapTimestamp(
  raw: string | null,
  recordNumber: number,
): Timestamp | null {
  if (raw === null || raw === "") {
    return null;
  }
  if (EPOCH_MILLIS_PATTERN.test(raw)) {
    const epochMillis = Number(raw);
    if (!Number.isSafeInteger(epochMillis)) {
      throw mappingError(
        `timestamp exceeds the safe integer range in record ${recordNumber}`,
        recordNumber,
      );
    }
    return epochMillis;
  }
  if (DATE_ONLY_PATTERN.test(raw) || EXPLICIT_TIME_ZONE_PATTERN.test(raw)) {
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      throw mappingError(
        `invalid timestamp ${JSON.stringify(raw)} in record ${recordNumber}`,
        recordNumber,
      );
    }
    return parsed;
  }
  throw mappingError(
    `invalid timestamp ${JSON.stringify(raw)} in record ${recordNumber}: expected epoch milliseconds or ISO-8601 with an explicit timezone`,
    recordNumber,
  );
}

function mappingError(message: string, recordNumber: number): MerchantCsvError {
  return new MerchantCsvError("MERCHANT_CSV_MAPPING_ERROR", message, {
    record: recordNumber,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
