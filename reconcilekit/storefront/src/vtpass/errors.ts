import type { MarketplaceServiceKind } from "../marketplace/types.ts";

export type VtpassClientErrorCode =
  | "VTPASS_CLIENT_INVALID_OPTION"
  | "VTPASS_CLIENT_NETWORK_FAILURE"
  | "VTPASS_CLIENT_HTTP_UNAUTHORIZED"
  | "VTPASS_CLIENT_HTTP_RATE_LIMITED"
  | "VTPASS_CLIENT_HTTP_SERVER_ERROR"
  | "VTPASS_CLIENT_HTTP_OTHER"
  | "VTPASS_CLIENT_MALFORMED_RESPONSE";

export class VtpassClientError extends Error {
  readonly code: VtpassClientErrorCode;
  readonly statusCode: number | null;

  constructor(
    code: VtpassClientErrorCode,
    message: string,
    options?: { cause?: unknown; statusCode?: number },
  ) {
    super(message, options);
    this.name = "VtpassClientError";
    this.code = code;
    this.statusCode = options?.statusCode ?? null;
  }
}

export class VtpassUnsupportedServiceError extends Error {
  readonly serviceKind: MarketplaceServiceKind;
  readonly catalogServiceId: string;

  constructor(kind: MarketplaceServiceKind, catalogServiceId: string) {
    super(
      `VTPass does not support service "${catalogServiceId}" (kind ${kind}); see docs/vtpass-scoping.md §7.4`,
    );
    this.name = "VtpassUnsupportedServiceError";
    this.serviceKind = kind;
    this.catalogServiceId = catalogServiceId;
  }
}
