import type {
  CanonicalPaymentStatus,
  MatchResult,
  Outcome,
  ReconciliationCode,
  ReconciliationReport,
} from "../../../src/domain/model.ts";
import type {
  AdminTransactionStatus,
  CustomerTransactionStatus,
  ReconciliationSnapshot,
  ResolutionStatus,
} from "./types.ts";
import type { TransactionReconciliationFacts } from "./transactions.ts";
import type { MarketplaceReconcileContext } from "./reconcile-bridge.ts";

/**
 * The reconciled truth of one marketplace transaction. This is the surface the
 * dashboard and the treasury rules read; nothing below it may mutate the
 * frozen engine's evaluation.
 */
export interface TransactionTruth {
  readonly transactionId: string;
  readonly reconcileOutcome: Outcome;
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
  readonly moneyAtRisk: boolean;
  readonly nextAction: string;
  readonly explanation: string;
}

/**
 * Everything `buildTransactionTruth` needs is supplied here, purely. The
 * orchestrator (`reconcile.ts`) feeds this directly from the engine report and
 * the store's own facts, so the pure truth logic is fully unit-testable and is
 * also reused on evidence-pack replay (no engine re-run).
 */
export interface TruthDeterminationInput {
  readonly transactionId: string;
  readonly outcome: Outcome;
  readonly codes: readonly ReconciliationCode[];
  readonly paymentState: CanonicalPaymentStatus;
  readonly resolutionStatus: ResolutionStatus;
  readonly expectedAmountMinor: number;
  readonly currency: string;
  readonly providerAmountMinor: number | null;
}

/**
 * Resolution states in which the marketplace has already closed the exposure
 * loop. In every other state (disputes, initiated-but-not-completed reversals,
 * manual review) the treasury is, by construction, still at risk even when the
 * numeric reconciliation would otherwise look clean.
 */
const EXPOSURE_CLOSED_RESOLUTIONS: ReadonlySet<ResolutionStatus> = new Set([
  "REVERSED",
  "REFUNDED",
]);

function statusesFor(input: TruthDeterminationInput): {
  customerStatus: CustomerTransactionStatus;
  adminStatus: AdminTransactionStatus;
} {
  if (input.resolutionStatus === "REVERSED") {
    return { customerStatus: "REVERSED", adminStatus: "HEALTHY" };
  }
  if (input.resolutionStatus === "REFUNDED") {
    return { customerStatus: "REFUNDED", adminStatus: "HEALTHY" };
  }
  if (input.resolutionStatus === "REFUND_PENDING") {
    return { customerStatus: "REFUND_PENDING", adminStatus: "REFUND_QUEUE" };
  }
  switch (input.outcome) {
    case "MATCH":
      return { customerStatus: "CONFIRMED", adminStatus: "HEALTHY" };
    case "UNRESOLVED":
      return { customerStatus: "NEEDS_ATTENTION", adminStatus: "UNRESOLVED" };
    case "DISCREPANCY":
      return {
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: adminStatusForDiscrepancy(input.codes),
      };
    case "MISSING_PROVIDER_RECORD":
      if (input.paymentState === "FAILED") {
        return { customerStatus: "FAILED", adminStatus: "HEALTHY" };
      }
      if (input.paymentState === "PENDING") {
        return { customerStatus: "PENDING", adminStatus: "PENDING_PROVIDER" };
      }
      return { customerStatus: "NEEDS_ATTENTION", adminStatus: "UNRESOLVED" };
    default:
      return {
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "MANUAL_REVIEW",
      };
  }
}

function adminStatusForDiscrepancy(
  codes: readonly ReconciliationCode[],
): AdminTransactionStatus {
  if (codes.includes("AMOUNT_MISMATCH")) {
    return "MISMATCH";
  }
  if (codes.includes("STATUS_MISMATCH")) {
    return "PROVIDER_FAILED";
  }
  return "MANUAL_REVIEW";
}

function moneyAtRiskFor(input: TruthDeterminationInput): boolean {
  if (input.paymentState === "FAILED") {
    return false;
  }
  if (EXPOSURE_CLOSED_RESOLUTIONS.has(input.resolutionStatus)) {
    return false;
  }
  return input.outcome !== "MATCH";
}

function nextActionFor(
  outcome: Outcome,
  paymentState: CanonicalPaymentStatus,
): string {
  switch (outcome) {
    case "MATCH":
      return "None — payment reconciled.";
    case "DISCREPANCY":
      return "Investigate the discrepancy between the expected and provider records.";
    case "UNRESOLVED":
      return "Await provider clarification; do not automatically refund.";
    case "MISSING_PROVIDER_RECORD":
      if (paymentState === "FAILED") {
        return "Payment was declined before any provider call — nothing further to do.";
      }
      return "Monitor the pending payment; there is no definitive provider evidence yet.";
    case "HELD_AMBIGUOUS":
      return "Resolve the duplicate records before reconciling.";
    case "INPUT_ERROR":
      return "Correct the reconciliation input records.";
    case "MISSING_REFERENCE":
      return "Restore the missing reference before reconciling.";
    case "UNMATCHED_PROVIDER_RECORD":
      return "Match the orphan provider record to a transaction.";
  }
}

function explanationFor(input: TruthDeterminationInput): string {
  const expectation = `${input.expectedAmountMinor} ${input.currency} expected`;
  const observation =
    input.providerAmountMinor === null
      ? "no definitive provider evidence recorded"
      : `provider reported ${input.providerAmountMinor} ${input.currency}`;
  const codes =
    input.codes.length === 0 ? "" : ` Codes: ${input.codes.join(", ")}.`;
  const resolution =
    input.resolutionStatus === "NONE"
      ? ""
      : ` Resolution: ${input.resolutionStatus}.`;
  return `Reconcile Kit determined ${input.outcome} (${expectation}; ${observation}).${codes}${resolution}`;
}

/**
 * Pure decision: engine evaluation + marketplace state -> dashboard truth.
 * No I/O, no store access. Safe to call on every replay.
 */
export function buildTransactionTruth(
  input: TruthDeterminationInput,
): TransactionTruth {
  const statuses = statusesFor(input);
  return {
    transactionId: input.transactionId,
    reconcileOutcome: input.outcome,
    customerStatus: statuses.customerStatus,
    adminStatus: statuses.adminStatus,
    moneyAtRisk: moneyAtRiskFor(input),
    nextAction: nextActionFor(input.outcome, input.paymentState),
    explanation: explanationFor(input),
  };
}

/**
 * Adapter wiring: takes the frozen engine's report plus the marketplace
 * context and produces the dashboard truth. Prefers the merchant-side result
 * addressed by `orderId`; falls back to `transactionId` when the report was
 * built with references only.
 */
export function buildMarketplaceTruth(
  report: ReconciliationReport,
  context: MarketplaceReconcileContext,
): TransactionTruth {
  const facts = context.facts;
  const result = findEngineResult(report, facts.orderId, facts.transactionId);
  return buildTransactionTruth({
    transactionId: facts.transactionId,
    outcome: result.outcome,
    codes: result.discrepancy_codes,
    paymentState: facts.paymentState,
    resolutionStatus: context.resolutionStatus,
    expectedAmountMinor: facts.expectedAmountMinor,
    currency: facts.currency,
    providerAmountMinor: facts.providerAmountMinor,
  });
}

export function findEngineResult(
  report: ReconciliationReport,
  orderId: string,
  transactionId: string,
): MatchResult {
  const byOrder = report.results.find(
    (r) =>
      r.merchant_record !== null &&
      r.merchant_record.merchant_record_id === orderId,
  );
  if (byOrder !== undefined) {
    return byOrder;
  }
  const byReference = report.results.find(
    (r) =>
      r.merchant_record !== null &&
      r.merchant_record.merchant_reference === transactionId,
  );
  if (byReference !== undefined) {
    return byReference;
  }
  throw new Error(
    `no engine result for transaction ${transactionId} (order ${orderId})`,
  );
}

/**
 * Compact, persisted evidence of the engine's evaluation — what goes inside the
 * evidence pack so replays can re-project truth without re-running the engine.
 */
export function toReconciliationSnapshot(
  result: MatchResult,
): ReconciliationSnapshot {
  return {
    outcome: result.outcome,
    codes: result.discrepancy_codes,
    notes: result.validation_notes,
    sourceAttributes: result.source_attributes,
  };
}
