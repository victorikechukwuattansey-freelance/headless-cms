import { mapPaystackResponse } from "../../../src/adapters/providers/paystack/paystack.ts";
import type {
  PaystackMappedTransaction,
  PaystackResponse,
  PaystackTimestampField,
  PaystackTransactionData,
} from "../../../src/adapters/providers/paystack/paystack.ts";

export type PaystackClientErrorCode =
  | "PAYSTACK_CLIENT_INVALID_OPTION"
  | "PAYSTACK_CLIENT_NETWORK_FAILURE"
  | "PAYSTACK_CLIENT_HTTP_BAD_REQUEST"
  | "PAYSTACK_CLIENT_HTTP_UNAUTHORIZED"
  | "PAYSTACK_CLIENT_HTTP_NOT_FOUND"
  | "PAYSTACK_CLIENT_HTTP_RATE_LIMITED"
  | "PAYSTACK_CLIENT_HTTP_SERVER_ERROR"
  | "PAYSTACK_CLIENT_HTTP_OTHER"
  | "PAYSTACK_CLIENT_API_REJECTED"
  | "PAYSTACK_CLIENT_MALFORMED_RESPONSE";

export class PaystackClientError extends Error {
  readonly code: PaystackClientErrorCode;
  readonly statusCode: number | null;

  constructor(
    code: PaystackClientErrorCode,
    message: string,
    options?: { cause?: unknown; statusCode?: number },
  ) {
    super(message, options);
    this.name = "PaystackClientError";
    this.code = code;
    this.statusCode = options?.statusCode ?? null;
  }
}

export interface PaystackClientOptions {
  readonly secretKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface InitializeTransactionInput {
  readonly email: string;
  readonly amount: number;
  readonly currency: string;
  readonly reference: string;
  readonly callbackUrl?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface InitializeTransactionResult {
  readonly authorizationUrl: string;
  readonly accessCode: string;
  readonly reference: string;
}

export interface VerifyTransactionInput {
  readonly reference: string;
  readonly supportedCurrencies: readonly string[];
  readonly timestampField?: PaystackTimestampField;
}

const DEFAULT_BASE_URL = "https://api.paystack.co";

/**
 * Initiates a Paystack transaction. The response reference is authoritative:
 * whatever Paystack acknowledges becomes the stored paystackReference, even if
 * it differs from the requested one (the requested value is preserved in
 * metadata by the caller).
 */
export async function initializeTransaction(
  options: PaystackClientOptions,
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  const config = resolveOptions(options);
  const url = `${config.baseUrl}/transaction/initialize`;
  const requestBody: Record<string, unknown> = {
    email: input.email,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    metadata: input.metadata ?? {},
  };
  if (input.callbackUrl !== undefined && input.callbackUrl !== "") {
    requestBody.callback_url = input.callbackUrl;
  }
  const body = JSON.stringify(requestBody);

  const response = await performRequest(config, url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });

  const data = extractData(response, url);
  const authorizationUrl = data.authorization_url;
  const reference = data.reference;
  if (typeof authorizationUrl !== "string" || authorizationUrl === "") {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
      "initialize response is missing data.authorization_url",
    );
  }
  if (typeof reference !== "string" || reference === "") {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
      "initialize response is missing data.reference",
    );
  }
  return {
    authorizationUrl,
    accessCode: typeof data.access_code === "string" ? data.access_code : "",
    reference,
  };
}

/**
 * Verifies a Paystack transaction and maps it through the frozen toolkit's
 * Paystack adapter mapping, producing the canonical ProviderPayment plus
 * source attributes. This is the same vocabulary the reconciliation engine
 * consumes.
 *
 * Response-currency handling is permissive on purpose: if the response
 * currency is not in the supplied allowlist it is appended to the list for
 * mapping (the frozen mapper stays untouched), so a currency mismatch
 * surfaces as an application-level integrity finding instead of a mapping
 * error. Reference matching is also left to the application layer.
 */
export async function verifyTransaction(
  options: PaystackClientOptions,
  input: VerifyTransactionInput,
): Promise<PaystackMappedTransaction> {
  const config = resolveOptions(options);
  const url = `${config.baseUrl}/transaction/verify/${encodeURIComponent(input.reference)}`;

  const response = await performRequest(config, url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      Accept: "application/json",
    },
  });

  const data = response.data as PaystackTransactionData | null | undefined;
  const responseCurrency =
    data !== null && data !== undefined && typeof data.currency === "string"
      ? data.currency
      : null;
  const supportedCurrencies =
    responseCurrency !== null &&
    !input.supportedCurrencies.includes(responseCurrency)
      ? [...input.supportedCurrencies, responseCurrency]
      : input.supportedCurrencies;

  return mapPaystackResponse(response, {
    supportedCurrencies,
    timestampField: input.timestampField ?? "paid_at",
  });
}

interface ResolvedClientOptions {
  readonly secretKey: string;
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
}

function resolveOptions(options: PaystackClientOptions): ResolvedClientOptions {
  if (options === null || typeof options !== "object") {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_INVALID_OPTION",
      "client options are required",
    );
  }
  if (
    typeof options.secretKey !== "string" ||
    options.secretKey.trim() === ""
  ) {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_INVALID_OPTION",
      "secretKey must be a non-empty string",
    );
  }
  let baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    baseUrl = DEFAULT_BASE_URL;
  }
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_INVALID_OPTION",
      "baseUrl must be a valid absolute URL",
    );
  }
  if (parsedBaseUrl.protocol !== "https:") {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_INVALID_OPTION",
      "baseUrl must use HTTPS",
    );
  }
  return {
    secretKey: options.secretKey,
    baseUrl: parsedBaseUrl.origin,
    fetchImpl: options.fetchImpl ?? fetch,
  };
}

async function performRequest(
  config: ResolvedClientOptions,
  url: string,
  init: RequestInit,
): Promise<PaystackResponse> {
  let response: Response;
  try {
    response = await config.fetchImpl(url, init);
  } catch (error) {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_NETWORK_FAILURE",
      "Paystack request failed at the network layer",
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new PaystackClientError(
      classifyStatus(response.status),
      `Paystack request failed with HTTP ${response.status}`,
      { statusCode: response.status },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
      "Paystack response body is not valid JSON",
      { cause: error },
    );
  }

  const envelope = body as PaystackResponse;
  if (envelope === null || typeof envelope !== "object") {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
      "Paystack response must be an object",
    );
  }
  if (envelope.status === false) {
    const message =
      typeof envelope.message === "string" && envelope.message !== ""
        ? envelope.message
        : "Paystack rejected the request";
    throw new PaystackClientError("PAYSTACK_CLIENT_API_REJECTED", message);
  }
  return envelope;
}

function extractData(
  response: PaystackResponse,
  url: string,
): Record<string, unknown> {
  const data = response.data;
  if (data === null || data === undefined) {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
      "Paystack response is missing the data object",
    );
  }
  if (typeof data !== "object") {
    throw new PaystackClientError(
      "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
      `response from ${url} has a non-object data payload`,
    );
  }
  return data as Record<string, unknown>;
}

function classifyStatus(status: number): PaystackClientErrorCode {
  if (status === 400) {
    return "PAYSTACK_CLIENT_HTTP_BAD_REQUEST";
  }
  if (status === 401) {
    return "PAYSTACK_CLIENT_HTTP_UNAUTHORIZED";
  }
  if (status === 404) {
    return "PAYSTACK_CLIENT_HTTP_NOT_FOUND";
  }
  if (status === 429) {
    return "PAYSTACK_CLIENT_HTTP_RATE_LIMITED";
  }
  if (status >= 500) {
    return "PAYSTACK_CLIENT_HTTP_SERVER_ERROR";
  }
  return "PAYSTACK_CLIENT_HTTP_OTHER";
}
