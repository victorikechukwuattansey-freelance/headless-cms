import type {
  PaymentProvider,
  PaymentProviderRequest,
  PaymentProviderResult,
  ProviderRequestContext,
} from "./contracts.ts";
import { MockPaymentProvider } from "./mock-provider.ts";

export { MockPaymentProvider };

export type {
  PaymentProvider,
  PaymentProviderRequest,
  PaymentProviderResult,
  ProviderRequestContext,
};

export interface WalletFundingDecision {
  readonly funded: boolean;
  readonly pending: boolean;
  readonly failed: boolean;
  readonly duplicate: boolean;
  readonly mismatch: boolean;
  readonly reversed: boolean;
  readonly refundPending: boolean;
  readonly refunded: boolean;
  readonly providerResult: PaymentProviderResult;
}

export function classifyWalletFunding(
  result: PaymentProviderResult,
): WalletFundingDecision {
  const canonical = result.canonicalPaymentStatus;
  return {
    funded:
      canonical === "SUCCESS" &&
      (result.attemptStatus === "SUCCESS" ||
        result.attemptStatus === "DUPLICATE" ||
        result.attemptStatus === "MISMATCH"),
    pending:
      canonical === "PENDING" ||
      canonical === "UNKNOWN" ||
      result.attemptStatus === "PENDING" ||
      result.attemptStatus === "TIMEOUT" ||
      result.attemptStatus === "UNKNOWN",
    failed: canonical === "FAILED",
    duplicate: result.attemptStatus === "DUPLICATE",
    mismatch: result.attemptStatus === "MISMATCH",
    reversed: result.providerStatus === "PROVIDER_REVERSED",
    refundPending: result.providerStatus === "PROVIDER_REFUND_PENDING",
    refunded: result.providerStatus === "PROVIDER_REFUND_COMPLETED",
    providerResult: result,
  };
}

export async function runWalletFunding(
  provider: PaymentProvider,
  context: ProviderRequestContext,
  request: PaymentProviderRequest,
): Promise<WalletFundingDecision> {
  const result = await provider.execute(context, request);
  return classifyWalletFunding(result);
}
