import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../src/domain/model.ts";
import type {
  MarketplaceServiceKind,
  ProviderAttemptStatus,
} from "../marketplace/types.ts";
import type {
  ProviderReconciliationFacts,
  ProviderRequestContext,
  ProviderResult,
  ProviderStatus,
} from "../marketplace/providers/contracts.ts";
import type {
  VtpassResponse,
  VtpassTransactions,
  VtpassTransactionStatus,
} from "./contracts.ts";

interface Statuses {
  readonly ps: ProviderStatus;
  readonly as: ProviderAttemptStatus;
  readonly cs: CanonicalPaymentStatus;
}

function s(
  ps: ProviderStatus,
  as: ProviderAttemptStatus,
  cs: CanonicalPaymentStatus,
): Statuses {
  return { ps, as, cs };
}

// ProviderAttemptStatus and CanonicalPaymentStatus have no REVERSED
// literal. A VTPass reversal (code 040) is treated as a failed terminal
// outcome on those fields; the reversal signal lives on providerStatus
// (PROVIDER_REVERSED) so downstream code can distinguish reversed from
// plain failed.
function mapStatuses(
  code: string,
  inner: VtpassTransactionStatus | null,
): Statuses {
  if (code === "000") {
    if (inner === "delivered")
      return s("PROVIDER_SUCCESS", "SUCCESS", "SUCCESS");
    if (inner === "failed") return s("PROVIDER_FAILED", "FAILED", "FAILED");
    if (inner === "reversed") return s("PROVIDER_REVERSED", "FAILED", "FAILED");
    return s("PROVIDER_PENDING", "PENDING", "PENDING");
  }
  if (code === "099") return s("PROVIDER_PENDING", "PENDING", "PENDING");
  if (code === "016") return s("PROVIDER_FAILED", "FAILED", "FAILED");
  if (code === "040") return s("PROVIDER_REVERSED", "FAILED", "FAILED");
  if (code === "014" || code === "019")
    return s("PROVIDER_DUPLICATE", "DUPLICATE", "UNKNOWN");
  return s("PROVIDER_UNKNOWN", "UNKNOWN", "UNKNOWN");
}

export function mapVtpassResponseToProviderResult(
  response: VtpassResponse<VtpassTransactions>,
  context: ProviderRequestContext,
  serviceKind: MarketplaceServiceKind,
): ProviderResult {
  const txn = response.content?.transactions ?? null;
  const statuses = mapStatuses(response.code, txn?.status ?? null);
  const amountMinor =
    response.amount !== undefined && Number.isFinite(response.amount)
      ? Math.round(response.amount * 100)
      : null;
  const responseTimestamp = new Date().toISOString();
  const latencyMs = Math.max(
    0,
    Date.now() - new Date(context.requestedAt).getTime(),
  );
  const sourceAttributes: SourceAttributes = {
    vtpass_code: response.code,
    vtpass_response_description: response.response_description,
    vtpass_transaction_status: txn?.status ?? "unknown",
    ...(response.purchased_code
      ? { vtpass_purchased_code: response.purchased_code }
      : {}),
  };
  const uniqueElement = txn?.unique_element ?? "";
  const safeMetadata: SourceAttributes = {
    vtpass_unique_element_masked:
      uniqueElement.length > 4
        ? `****${uniqueElement.slice(-4)}`
        : uniqueElement,
  };
  const reconciliationFacts: ProviderReconciliationFacts = {
    providerId: context.providerId,
    providerReference: txn?.transactionId ?? null,
    amountMinor,
    currency: context.currency,
    canonicalStatus: statuses.cs,
    occurredAt: response.transaction_date ?? null,
    sourceAttributes,
  };
  return {
    providerId: context.providerId,
    providerName: context.providerName,
    serviceKind,
    providerReference: txn?.transactionId ?? null,
    requestId: context.requestId,
    correlationId: context.correlationId,
    attemptNumber: context.attemptNumber,
    requestTimestamp: context.requestedAt,
    responseTimestamp,
    providerStatus: statuses.ps,
    providerStatusCode: response.code,
    providerMessage: response.response_description,
    attemptStatus: statuses.as,
    canonicalPaymentStatus: statuses.cs,
    amountMinor,
    currency: context.currency,
    latencyMs,
    sourceAttributes,
    reconciliationFacts,
    safeMetadata,
    duplicateResults: [],
    simulated: false,
  };
}
