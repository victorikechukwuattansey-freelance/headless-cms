import type {
  CanonicalPaymentStatus,
  CurrencyCode,
  ProviderPayment,
  SourceAttributes,
  Timestamp,
} from "../../../domain/model.ts";

export type PaystackAdapterErrorCode =
  | "PAYSTACK_INVALID_OPTION"
  | "PAYSTACK_MALFORMED_RESPONSE"
  | "PAYSTACK_MISSING_FIELD"
  | "PAYSTACK_INVALID_AMOUNT"
  | "PAYSTACK_INVALID_CURRENCY"
  | "PAYSTACK_UNSUPPORTED_CURRENCY"
  | "PAYSTACK_INVALID_REFERENCE"
  | "PAYSTACK_INVALID_TIMESTAMP";

export class PaystackAdapterError extends Error {
  readonly code: PaystackAdapterErrorCode;
  readonly record: number | null;

  constructor(
    code: PaystackAdapterErrorCode,
    message: string,
    options?: { cause?: unknown; record?: number },
  ) {
    super(message, options);
    this.name = "PaystackAdapterError";
    this.code = code;
    this.record = options?.record ?? null;
  }
}

export interface PaystackTransactionData {
  readonly id?: number | string | null;
  readonly reference?: string | null;
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly status?: string | null;
  readonly created_at?: string | null;
  readonly paid_at?: string | null;
  readonly transaction_date?: string | null;
}

export interface PaystackResponse {
  readonly status?: unknown;
  readonly message?: string | null;
  readonly data?: PaystackTransactionData | null;
}

export type PaystackTimestampField =
  "created_at" | "paid_at" | "transaction_date";

export const PAYSTACK_TIMESTAMP_FIELDS: readonly PaystackTimestampField[] = [
  "created_at",
  "paid_at",
  "transaction_date",
];

export interface PaystackAdapterOptions {
  readonly supportedCurrencies: readonly string[];
  readonly timestampField: PaystackTimestampField;
}

export interface PaystackMappedTransaction {
  readonly payment: ProviderPayment;
  readonly source_attributes: SourceAttributes;
}

export const PAYSTACK_STATUS_MAPPING: Readonly<
  Record<string, CanonicalPaymentStatus>
> = {
  success: "SUCCESS",
  failed: "FAILED",
  pending: "PENDING",
  processing: "PENDING",
  ongoing: "PENDING",
  queued: "PENDING",
  abandoned: "UNKNOWN",
  reversed: "UNKNOWN",
};

const EXPLICIT_TIME_ZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

export function mapPaystackResponse(
  response: PaystackResponse,
  options: PaystackAdapterOptions,
): PaystackMappedTransaction {
  assertOptions(options);
  const data = envelopeData(response);
  const timestampField = options.timestampField;
  return {
    payment: {
      reference: mapReference(data.reference),
      amount: mapAmount(data.amount),
      currency: mapCurrency(data.currency, options.supportedCurrencies),
      status: mapStatus(data.status),
      occurred_at: mapTimestamp(data[timestampField], timestampField),
      provider_id: mapProviderId(data.id),
    },
    source_attributes: buildSourceAttributes(data),
  };
}

export function mapPaystackResponses(
  responses: readonly PaystackResponse[],
  options: PaystackAdapterOptions,
): PaystackMappedTransaction[] {
  assertOptions(options);
  return responses.map((response, index) => {
    try {
      return mapPaystackResponse(response, options);
    } catch (error) {
      if (error instanceof PaystackAdapterError && error.record === null) {
        throw new PaystackAdapterError(
          error.code,
          `record ${index + 1}: ${error.message}`,
          { cause: error, record: index + 1 },
        );
      }
      throw error;
    }
  });
}

function assertOptions(options: PaystackAdapterOptions): void {
  if (options === null || typeof options !== "object") {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_OPTION",
      "adapter options are required",
    );
  }
  if (!PAYSTACK_TIMESTAMP_FIELDS.includes(options.timestampField)) {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_OPTION",
      `timestampField must be one of ${PAYSTACK_TIMESTAMP_FIELDS.join(", ")}, received ${JSON.stringify(options.timestampField)}`,
    );
  }
  if (!Array.isArray(options.supportedCurrencies)) {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_OPTION",
      "supportedCurrencies must be an array of currency codes",
    );
  }
}

function envelopeData(response: PaystackResponse): PaystackTransactionData {
  if (response === null || typeof response !== "object") {
    throw new PaystackAdapterError(
      "PAYSTACK_MALFORMED_RESPONSE",
      "Paystack response must be an object",
    );
  }
  const data = response.data;
  if (data === null || data === undefined) {
    throw new PaystackAdapterError(
      "PAYSTACK_MALFORMED_RESPONSE",
      "Paystack response is missing the data object",
    );
  }
  if (typeof data !== "object") {
    throw new PaystackAdapterError(
      "PAYSTACK_MALFORMED_RESPONSE",
      "Paystack response data must be an object",
    );
  }
  return data as PaystackTransactionData;
}

function mapReference(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_REFERENCE",
      `data.reference must be a string, received ${typeof raw}`,
    );
  }
  return raw;
}

function mapAmount(raw: unknown): number {
  if (raw === null || raw === undefined) {
    throw new PaystackAdapterError(
      "PAYSTACK_MISSING_FIELD",
      "data.amount is missing",
    );
  }
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_AMOUNT",
      `data.amount must be a non-negative safe integer in subunit units, received ${JSON.stringify(raw)}`,
    );
  }
  return raw;
}

function mapCurrency(
  raw: unknown,
  supportedCurrencies: readonly string[],
): CurrencyCode {
  if (raw === null || raw === undefined || raw === "") {
    throw new PaystackAdapterError(
      "PAYSTACK_MISSING_FIELD",
      "data.currency is missing",
    );
  }
  if (typeof raw !== "string") {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_CURRENCY",
      `data.currency must be a string, received ${typeof raw}`,
    );
  }
  if (!supportedCurrencies.includes(raw)) {
    throw new PaystackAdapterError(
      "PAYSTACK_UNSUPPORTED_CURRENCY",
      `currency ${JSON.stringify(raw)} is not supported by this adapter configuration`,
    );
  }
  return raw;
}

function mapStatus(raw: unknown): CanonicalPaymentStatus | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  const status = String(raw);
  return PAYSTACK_STATUS_MAPPING[status] ?? "UNKNOWN";
}

function mapTimestamp(
  raw: unknown,
  field: PaystackTimestampField,
): Timestamp | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw !== "string") {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_TIMESTAMP",
      `data.${field} must be an ISO-8601 string, received ${typeof raw}`,
    );
  }
  if (!EXPLICIT_TIME_ZONE_PATTERN.test(raw)) {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_TIMESTAMP",
      `data.${field} must carry an explicit timezone designator (Z or +/-HH:MM)`,
    );
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    throw new PaystackAdapterError(
      "PAYSTACK_INVALID_TIMESTAMP",
      `data.${field} is not a parseable ISO-8601 timestamp`,
    );
  }
  return parsed;
}

function mapProviderId(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  return String(raw);
}

function buildSourceAttributes(
  data: PaystackTransactionData,
): SourceAttributes {
  const attributes: Record<string, string> = {};
  if (data.status !== null && data.status !== undefined) {
    attributes.original_status = String(data.status);
  }
  for (const field of PAYSTACK_TIMESTAMP_FIELDS) {
    const value = data[field];
    if (value !== null && value !== undefined) {
      attributes[field] = String(value);
    }
  }
  return attributes;
}
