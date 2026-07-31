export type AiErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_AUTH"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "MODEL_NOT_FOUND"
  | "INVALID_REQUEST"
  | "CONTEXT_TOO_LONG"
  | "NO_ADAPTER_CONFIGURED";

export class AiGatewayError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly provider?: string,
    readonly retryable: boolean = false,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof AiGatewayError) {
    return err.retryable;
  }
  return false;
}
