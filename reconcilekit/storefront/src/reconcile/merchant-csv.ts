import type { PaymentRecord } from "../domain/types.ts";
import { paymentRecordToMerchantPayment } from "./adapter.ts";

const HEADER =
  "merchant_reference,amount,currency,status,occurred_at,merchant_record_id";

/**
 * Deterministic export of storefront PaymentRecords into the exact CSV shape
 * the frozen ReconcileKit merchant loader (parseMerchantCsv) consumes:
 * merchant_reference,amount,currency,status,occurred_at,merchant_record_id.
 *
 * occurred_at is emitted as epoch milliseconds; amount/status are the
 * canonical values from the persisted record. Round-trips through the frozen
 * loader field-for-field (see reconcile-adapter.test.ts).
 */
export function toMerchantCsv(records: readonly PaymentRecord[]): string {
  const rows = records.map((record) => {
    const merchant = paymentRecordToMerchantPayment(record);
    return [
      merchant.merchant_reference ?? "",
      String(merchant.amount),
      merchant.currency,
      merchant.status ?? "",
      merchant.occurred_at === null ? "" : String(merchant.occurred_at),
      merchant.merchant_record_id ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  return [HEADER, ...rows].join("\n") + "\n";
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
