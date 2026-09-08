import type {
  ReconciliationConfig,
  ReconciliationReport,
  ReconciliationSummary,
} from "../../../src/domain/model.ts";
import type { PaymentRecord } from "../domain/types.ts";
import { paymentRecordToProviderPayment } from "./adapter.ts";

/**
 * The reconciliation endpoint's configuration, mirroring the frozen domain's
 * DEFAULT_CONFIG: NGN and USD supported, 60s temporal tolerance.
 */
export const RECONCILE_CONFIG: ReconciliationConfig = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD"],
};

export interface ReconcileViewRow {
  readonly orderId: string;
  readonly businessId: string;
  readonly reference: string;
  readonly status: string;
  readonly expectedAmount: number;
  readonly expectedCurrency: string;
  readonly receivedAmount: number | null;
  readonly receivedCurrency: string | null;
  readonly receivedResolved: boolean;
  readonly difference: number | null;
  readonly currencyMismatch: boolean;
  readonly outcome: string;
  readonly discrepancyCodes: readonly string[];
  readonly validationNotes: readonly string[];
}

export interface ReconcileView {
  readonly config: ReconciliationConfig;
  readonly summary: ReconciliationSummary;
  readonly results: readonly ReconcileViewRow[];
}

/**
 * Expected-vs-received view over one or more PaymentRecords backed by the
 * frozen reconciliation engine's verdicts.
 *
 * Semantics:
 * - expectedAmount always comes from the persisted product price.
 * - receivedAmount comes from the Paystack facts captured at verification
 *   time; PENDING records are unresolved (null), never treated as zero.
 * - difference is only meaningful when both sides exist and the currencies
 *   agree; a currency mismatch is exposed explicitly and yields no numeric
 *   difference (currencies are never silently converted).
 * - canonical status is preserved as recorded; FAILED/UNKNOWN records are
 *   never presented as successfully received.
 */
export function buildReconcileView(
  records: readonly PaymentRecord[],
  report: ReconciliationReport,
): ReconcileView {
  return {
    config: RECONCILE_CONFIG,
    summary: report.summary,
    results: records.map((record) => {
      const provider = paymentRecordToProviderPayment(record);
      const result = report.results.find(
        (candidate) =>
          candidate.merchant_record?.merchant_record_id === record.orderId,
      );
      if (result === undefined) {
        throw new Error(
          `reconciliation view: no engine result for order ${record.orderId}`,
        );
      }
      const receivedAmount = provider === null ? null : provider.amount;
      const receivedCurrency = provider?.currency ?? null;
      const receivedResolved = provider !== null;
      const currencyMismatch =
        receivedResolved && provider.currency !== record.currency;
      const difference =
        provider !== null && !currencyMismatch && provider.amount !== null
          ? provider.amount - record.expectedAmount
          : null;
      return {
        orderId: record.orderId,
        businessId: record.businessId,
        reference: record.paystackReference,
        status: record.status,
        expectedAmount: record.expectedAmount,
        expectedCurrency: record.currency,
        receivedAmount,
        receivedCurrency,
        receivedResolved,
        difference,
        currencyMismatch,
        outcome: result.outcome,
        discrepancyCodes: result.discrepancy_codes,
        validationNotes: result.validation_notes,
      };
    }),
  };
}
