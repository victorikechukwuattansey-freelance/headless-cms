import type { MerchantPayment, ProviderPayment } from "./model.ts";

export function normalizeReference(reference: string | null): string | null {
  if (reference === null) {
    return null;
  }
  const trimmed = reference.trim();
  return trimmed === "" ? null : trimmed;
}

export function buildMerchantIndex(
  payments: readonly MerchantPayment[],
): ReadonlyMap<string, readonly MerchantPayment[]> {
  const index = new Map<string, MerchantPayment[]>();
  for (const payment of payments) {
    const reference = normalizeReference(payment.merchant_reference);
    if (reference === null) {
      continue;
    }
    const bucket = index.get(reference);
    if (bucket === undefined) {
      index.set(reference, [payment]);
    } else {
      bucket.push(payment);
    }
  }
  return index;
}

export function buildProviderIndex(
  payments: readonly ProviderPayment[],
): ReadonlyMap<string, readonly ProviderPayment[]> {
  const index = new Map<string, ProviderPayment[]>();
  for (const payment of payments) {
    const reference = normalizeReference(payment.reference);
    if (reference === null) {
      continue;
    }
    const bucket = index.get(reference);
    if (bucket === undefined) {
      index.set(reference, [payment]);
    } else {
      bucket.push(payment);
    }
  }
  return index;
}
