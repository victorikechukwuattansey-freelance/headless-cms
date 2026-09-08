import type {
  MerchantPayment,
  ProviderPayment,
  ReconciliationConfig,
  ReconciliationReport,
  SourceAttributes,
} from "../domain/model.ts";
import { reconcile } from "../domain/reconcile.ts";

export interface ReconcileRecordsRequest {
  readonly merchantPayments: readonly MerchantPayment[];
  readonly providerPayments: readonly ProviderPayment[];
  readonly config: ReconciliationConfig;
  readonly providerSourceAttributes?: readonly SourceAttributes[];
}

export class ApplicationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApplicationError";
  }
}

export function reconcileRecords(
  request: ReconcileRecordsRequest,
): ReconciliationReport {
  assertRequestEnvelope(request);
  try {
    return reconcile(
      request.merchantPayments,
      request.providerPayments,
      request.config,
      { providerSourceAttributes: request.providerSourceAttributes },
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw new ApplicationError("reconciliation orchestration failed", {
      cause: error,
    });
  }
}

function assertRequestEnvelope(request: ReconcileRecordsRequest): void {
  if (request === null || typeof request !== "object") {
    throw new ApplicationError("reconcileRecords requires a request object");
  }
  if (!Array.isArray(request.merchantPayments)) {
    throw new ApplicationError(
      "merchantPayments must be an array of provider-neutral merchant payment records",
    );
  }
  if (!Array.isArray(request.providerPayments)) {
    throw new ApplicationError(
      "providerPayments must be an array of provider-neutral provider payment records",
    );
  }
  if (request.config === null || typeof request.config !== "object") {
    throw new ApplicationError("config must be provided as an explicit value");
  }
  if (request.providerSourceAttributes !== undefined) {
    if (!Array.isArray(request.providerSourceAttributes)) {
      throw new ApplicationError(
        "providerSourceAttributes must be an array aligned with providerPayments",
      );
    }
    if (
      request.providerSourceAttributes.length !==
      request.providerPayments.length
    ) {
      throw new ApplicationError(
        "providerSourceAttributes must align one-to-one with providerPayments",
      );
    }
  }
}
