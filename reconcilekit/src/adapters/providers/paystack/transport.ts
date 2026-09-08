import type { PaystackResponse, PaystackTransactionData } from "./paystack.ts";

export type PaystackTransportErrorCode =
  | "PAYSTACK_TRANSPORT_NETWORK_FAILURE"
  | "PAYSTACK_TRANSPORT_ABORTED"
  | "PAYSTACK_TRANSPORT_HTTP_BAD_REQUEST"
  | "PAYSTACK_TRANSPORT_HTTP_UNAUTHORIZED"
  | "PAYSTACK_TRANSPORT_HTTP_NOT_FOUND"
  | "PAYSTACK_TRANSPORT_HTTP_RATE_LIMITED"
  | "PAYSTACK_TRANSPORT_HTTP_SERVER_ERROR"
  | "PAYSTACK_TRANSPORT_HTTP_OTHER"
  | "PAYSTACK_TRANSPORT_MALFORMED_RESPONSE"
  | "PAYSTACK_TRANSPORT_INVALID_OPTION";

export interface PaystackRateLimitMetadata {
  readonly limit: string | null;
  readonly remaining: string | null;
  readonly reset: string | null;
}

export class PaystackTransportError extends Error {
  readonly code: PaystackTransportErrorCode;
  readonly statusCode: number | null;
  readonly rateLimit: PaystackRateLimitMetadata | null;

  constructor(
    code: PaystackTransportErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      statusCode?: number;
      rateLimit?: PaystackRateLimitMetadata | null;
    },
  ) {
    super(message, options);
    this.name = "PaystackTransportError";
    this.code = code;
    this.statusCode = options?.statusCode ?? null;
    this.rateLimit = options?.rateLimit ?? null;
  }
}

export interface PaystackTransportOptions {
  readonly secretKey: string;
  readonly baseUrl?: string;
  readonly perPage?: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export interface PaystackTransportResult {
  readonly responses: readonly PaystackResponse[];
  readonly rateLimit: PaystackRateLimitMetadata | null;
}

const DEFAULT_BASE_URL = "https://api.paystack.co";
const DEFAULT_PER_PAGE = 50;

interface PaystackListBody {
  readonly status: unknown;
  readonly message: unknown;
  readonly data: readonly unknown[];
  readonly meta: unknown;
}

export async function fetchPaystackTransactions(
  options: PaystackTransportOptions,
): Promise<PaystackTransportResult> {
  const config = resolveOptions(options);
  const responses: PaystackResponse[] = [];
  let rateLimit: PaystackRateLimitMetadata | null = null;
  let page = 1;

  for (;;) {
    const url = buildListUrl(config.baseUrl, page, config.perPage);
    const request = await performRequest(url, config);
    rateLimit = request.rateLimit;
    const body = parseListBody(request.body);

    for (const transaction of body.data) {
      responses.push({
        status: body.status,
        message: typeof body.message === "string" ? body.message : null,
        data: transaction as PaystackTransactionData,
      });
    }

    if (body.data.length === 0) {
      break;
    }

    const nextPage = nextPageNumber(body.meta, page);
    if (nextPage === null) {
      break;
    }
    page = nextPage;
  }

  return { responses, rateLimit };
}

interface ResolvedTransportOptions {
  readonly secretKey: string;
  readonly baseUrl: string;
  readonly perPage: number;
  readonly signal: AbortSignal | undefined;
  readonly fetchImpl: typeof fetch;
}

function resolveOptions(
  options: PaystackTransportOptions,
): ResolvedTransportOptions {
  if (options === null || typeof options !== "object") {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_INVALID_OPTION",
      "transport options are required",
    );
  }
  if (
    typeof options.secretKey !== "string" ||
    options.secretKey.trim() === ""
  ) {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_INVALID_OPTION",
      "secretKey must be a non-empty string",
    );
  }
  if (
    options.perPage !== undefined &&
    (!Number.isSafeInteger(options.perPage) || options.perPage <= 0)
  ) {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_INVALID_OPTION",
      "perPage must be a positive safe integer",
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
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_INVALID_OPTION",
      "baseUrl must be a valid absolute URL",
    );
  }
  if (parsedBaseUrl.protocol !== "https:") {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_INVALID_OPTION",
      "baseUrl must use HTTPS",
    );
  }
  return {
    secretKey: options.secretKey,
    baseUrl: parsedBaseUrl.origin,
    perPage: options.perPage ?? DEFAULT_PER_PAGE,
    signal: options.signal,
    fetchImpl: options.fetchImpl ?? fetch,
  };
}

function buildListUrl(baseUrl: string, page: number, perPage: number): string {
  const url = new URL("/transaction", baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(perPage));
  return url.toString();
}

interface RequestOutcome {
  readonly body: unknown;
  readonly rateLimit: PaystackRateLimitMetadata | null;
}

async function performRequest(
  url: string,
  config: ResolvedTransportOptions,
): Promise<RequestOutcome> {
  const init: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      Accept: "application/json",
    },
  };
  if (config.signal !== undefined) {
    init.signal = config.signal;
  }

  let response: Response;
  try {
    response = await config.fetchImpl(url, init);
  } catch (error) {
    if (
      isAbortError(error) ||
      (config.signal !== undefined && config.signal.aborted)
    ) {
      throw new PaystackTransportError(
        "PAYSTACK_TRANSPORT_ABORTED",
        "Paystack request was aborted",
        { cause: error },
      );
    }
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_NETWORK_FAILURE",
      "Paystack request failed at the network layer",
      { cause: error },
    );
  }

  const rateLimit = readRateLimit(response.headers);

  if (!response.ok) {
    throw new PaystackTransportError(
      classifyStatus(response.status),
      `Paystack request failed with HTTP ${response.status}`,
      { statusCode: response.status, rateLimit },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_MALFORMED_RESPONSE",
      "Paystack response body is not valid JSON",
      { cause: error },
    );
  }

  return { body, rateLimit };
}

function parseListBody(raw: unknown): PaystackListBody {
  if (raw === null || typeof raw !== "object") {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_MALFORMED_RESPONSE",
      "Paystack list response must be an object",
    );
  }
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.data)) {
    throw new PaystackTransportError(
      "PAYSTACK_TRANSPORT_MALFORMED_RESPONSE",
      "Paystack list response data must be an array",
    );
  }
  return {
    status: body.status,
    message: body.message,
    data: body.data,
    meta: body.meta,
  };
}

function nextPageNumber(meta: unknown, currentPage: number): number | null {
  if (meta === null || typeof meta !== "object") {
    return null;
  }
  const pagination = (meta as Record<string, unknown>).pagination;
  if (pagination === null || typeof pagination !== "object") {
    return null;
  }
  const pageCount = (pagination as Record<string, unknown>).pageCount;
  if (
    typeof pageCount !== "number" ||
    !Number.isSafeInteger(pageCount) ||
    pageCount <= 0
  ) {
    return null;
  }
  if (currentPage >= pageCount) {
    return null;
  }
  return currentPage + 1;
}

function classifyStatus(status: number): PaystackTransportErrorCode {
  if (status === 400) {
    return "PAYSTACK_TRANSPORT_HTTP_BAD_REQUEST";
  }
  if (status === 401) {
    return "PAYSTACK_TRANSPORT_HTTP_UNAUTHORIZED";
  }
  if (status === 404) {
    return "PAYSTACK_TRANSPORT_HTTP_NOT_FOUND";
  }
  if (status === 429) {
    return "PAYSTACK_TRANSPORT_HTTP_RATE_LIMITED";
  }
  if (status >= 500) {
    return "PAYSTACK_TRANSPORT_HTTP_SERVER_ERROR";
  }
  return "PAYSTACK_TRANSPORT_HTTP_OTHER";
}

function readRateLimit(headers: Headers): PaystackRateLimitMetadata | null {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  if (limit === null && remaining === null && reset === null) {
    return null;
  }
  return {
    limit,
    remaining,
    reset,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
