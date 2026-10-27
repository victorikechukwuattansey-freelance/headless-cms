import type {
  VtpassPayRequest,
  VtpassRequeryRequest,
  VtpassResponse,
  VtpassTransactions,
} from "./contracts.ts";
import { VtpassClientError } from "./errors.ts";

export interface VtpassClientOptions {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://sandbox.vtpass.com/api";

export class VtpassClient {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VtpassClientOptions) {
    this.apiKey = options.apiKey;
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async pay(
    request: VtpassPayRequest,
  ): Promise<VtpassResponse<VtpassTransactions>> {
    return this.post<VtpassPayRequest>("/pay", request);
  }

  async requery(
    request: VtpassRequeryRequest,
  ): Promise<VtpassResponse<VtpassTransactions>> {
    return this.post<VtpassRequeryRequest>("/requery", request);
  }

  private async post<Req>(
    path: string,
    body: Req,
  ): Promise<VtpassResponse<VtpassTransactions>> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-key": this.apiKey,
          "secret-key": this.secretKey,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_NETWORK_FAILURE",
        `network failure on ${path}`,
        { cause },
      );
    }

    if (response.status === 401) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_HTTP_UNAUTHORIZED",
        "unauthorized",
        { statusCode: 401 },
      );
    }
    if (response.status === 429) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_HTTP_RATE_LIMITED",
        "rate limited",
        { statusCode: 429 },
      );
    }
    if (response.status >= 500) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_HTTP_SERVER_ERROR",
        `server error ${response.status}`,
        { statusCode: response.status },
      );
    }
    if (!response.ok) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_HTTP_OTHER",
        `HTTP ${response.status}`,
        { statusCode: response.status },
      );
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (cause) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_MALFORMED_RESPONSE",
        "response is not valid JSON",
        { cause },
      );
    }

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("code" in parsed) ||
      typeof (parsed as { code: unknown }).code !== "string"
    ) {
      throw new VtpassClientError(
        "VTPASS_CLIENT_MALFORMED_RESPONSE",
        "response missing code field",
      );
    }

    return parsed as VtpassResponse<VtpassTransactions>;
  }
}
