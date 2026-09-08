import type {
  MerchantPayment,
  ProviderPayment,
  ReconciliationConfig,
} from "./model.ts";

export const DEFAULT_CONFIG: ReconciliationConfig = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD"],
};

export function merchant(
  overrides: Partial<MerchantPayment> = {},
): MerchantPayment {
  return {
    merchant_reference: "REF-A",
    amount: 10000,
    currency: "NGN",
    status: "SUCCESS",
    occurred_at: 1_700_000_000_000,
    merchant_record_id: "M-1",
    ...overrides,
  };
}

export function provider(
  overrides: Partial<ProviderPayment> = {},
): ProviderPayment {
  return {
    reference: "REF-A",
    amount: 10000,
    currency: "NGN",
    status: "SUCCESS",
    occurred_at: 1_700_000_000_000,
    provider_id: "P-1",
    ...overrides,
  };
}
