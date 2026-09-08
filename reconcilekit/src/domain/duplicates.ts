import type { MerchantPayment, ProviderPayment } from "./model.ts";

export function hasConflictingAttributes(
  records: readonly (MerchantPayment | ProviderPayment)[],
): boolean {
  const amounts = new Set<number>();
  const currencies = new Set<string>();
  const statuses = new Set<string>();
  for (const record of records) {
    amounts.add(record.amount);
    currencies.add(record.currency);
    if (record.status !== null && record.status !== "UNKNOWN") {
      statuses.add(record.status);
    }
  }
  return amounts.size > 1 || currencies.size > 1 || statuses.size > 1;
}
