import type {
  CanonicalPaymentStatus,
  CurrencyCode,
  InputValidation,
  MerchantPayment,
  ProviderPayment,
  ReconciliationConfig,
  ReconciliationCode,
  ValidationResult,
} from "./model.ts";

export const CANONICAL_STATUSES: readonly CanonicalPaymentStatus[] = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
];

function isCanonicalStatus(status: string): status is CanonicalPaymentStatus {
  return CANONICAL_STATUSES.includes(status as CanonicalPaymentStatus);
}

export function validatePaymentInput(
  payment: MerchantPayment | ProviderPayment,
  config: ReconciliationConfig,
): InputValidation {
  if (!Number.isSafeInteger(payment.amount) || payment.amount < 0) {
    return {
      valid: false,
      note: `invalid amount representation: ${payment.amount}`,
    };
  }
  if (!isSupportedCurrency(payment.currency, config.supportedCurrencies)) {
    return {
      valid: false,
      note: `unsupported or invalid currency: ${payment.currency}`,
    };
  }
  if (payment.status !== null && !isCanonicalStatus(payment.status)) {
    return { valid: false, note: `invalid status value: ${payment.status}` };
  }
  if (
    payment.occurred_at !== null &&
    !Number.isSafeInteger(payment.occurred_at)
  ) {
    return {
      valid: false,
      note: `invalid timestamp representation: ${payment.occurred_at}`,
    };
  }
  return { valid: true };
}

export function isSupportedCurrency(
  currency: CurrencyCode,
  supportedCurrencies: readonly CurrencyCode[],
): boolean {
  return currency !== "" && supportedCurrencies.includes(currency);
}

export function validateAmount(
  merchant: MerchantPayment,
  provider: ProviderPayment,
): ValidationResult {
  if (merchant.amount === provider.amount) {
    return { applicable: true, passed: true, code: null, note: null };
  }
  return {
    applicable: true,
    passed: false,
    code: "AMOUNT_MISMATCH",
    note: `amount mismatch: merchant ${merchant.amount} vs provider ${provider.amount}`,
  };
}

export function validateCurrency(
  merchant: MerchantPayment,
  provider: ProviderPayment,
): ValidationResult {
  if (merchant.currency === provider.currency) {
    return { applicable: true, passed: true, code: null, note: null };
  }
  return {
    applicable: true,
    passed: false,
    code: "CURRENCY_MISMATCH",
    note: `currency mismatch: merchant ${merchant.currency} vs provider ${provider.currency}`,
  };
}

export function validateStatus(
  merchant: MerchantPayment,
  provider: ProviderPayment,
): ValidationResult {
  const merchantStatus = merchant.status;
  const providerStatus = provider.status;
  if (merchantStatus === null || providerStatus === null) {
    const absent =
      merchantStatus === null
        ? "merchant status absent"
        : "provider status absent";
    return {
      applicable: false,
      passed: false,
      code: null,
      note: `status validation unavailable: ${absent}`,
    };
  }
  if (merchantStatus === "UNKNOWN" && providerStatus === "UNKNOWN") {
    return {
      applicable: true,
      passed: false,
      code: "STATUS_UNRESOLVED",
      note: "status unresolved: both statuses are UNKNOWN",
    };
  }
  if (merchantStatus === "UNKNOWN" || providerStatus === "UNKNOWN") {
    return {
      applicable: true,
      passed: false,
      code: "STATUS_UNRESOLVED",
      note: `status unresolved: merchant ${merchantStatus} vs provider ${providerStatus}`,
    };
  }
  if (merchantStatus === providerStatus) {
    return { applicable: true, passed: true, code: null, note: null };
  }
  return {
    applicable: true,
    passed: false,
    code: "STATUS_MISMATCH",
    note: `status mismatch: merchant ${merchantStatus} vs provider ${providerStatus}`,
  };
}

export function validateTimestamp(
  merchant: MerchantPayment,
  provider: ProviderPayment,
  config: ReconciliationConfig,
): ValidationResult {
  if (!config.timestampValidation.enabled) {
    return {
      applicable: false,
      passed: false,
      code: null,
      note: "timestamp validation disabled",
    };
  }
  const merchantTimestamp = merchant.occurred_at;
  const providerTimestamp = provider.occurred_at;
  if (merchantTimestamp === null || providerTimestamp === null) {
    const absent =
      merchantTimestamp === null
        ? "merchant occurred_at absent"
        : "provider occurred_at absent";
    return {
      applicable: false,
      passed: false,
      code: null,
      note: `timestamp validation unavailable: ${absent}`,
    };
  }
  const difference = Math.abs(merchantTimestamp - providerTimestamp);
  if (difference <= config.timestampValidation.toleranceMs) {
    return { applicable: true, passed: true, code: null, note: null };
  }
  return {
    applicable: true,
    passed: false,
    code: "TEMPORAL_ANOMALY" as ReconciliationCode,
    note: `temporal anomaly: difference ${difference}ms exceeds tolerance ${config.timestampValidation.toleranceMs}ms`,
  };
}
