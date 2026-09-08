import type {
  CanonicalPaymentStatus,
  MerchantPayment,
  ProviderPayment,
  ReconciliationConfig,
  SourceAttributes,
} from "../../../src/domain/model.ts";
import type { ReconcileRecordsRequest } from "../../../src/application/reconcile-records.ts";
import type { TransactionReconciliationFacts } from "./transactions.ts";
import type {
  GiftCardArtifact,
  MarketplaceCatalog,
  MarketplaceServiceKind,
  ProviderAttempt,
  ResolutionStatus,
  TicketArtifact,
} from "./types.ts";

/**
 * Pure, store-free human report of a transaction's reconciliation context.
 * This is the ONLY input the marketplace adapter accepts; it is built from the
 * facts the orchestrator already packages via `marketplaceTransactionFacts()`
 * plus the artifacts and resolution state read from the store by the
 * caller (`reconcile.ts`). No live store reads happen inside this module.
 *
 * Join-key semantics (the single most important rule):
 *
 * The frozen engine pairs the merchant side to the provider side by exact
 * normalized reference equality. In the marketplace the only identity that is
 * authoritative on both sides is `MarketplacePaymentRecord.transactionId`
 * === `facts.transactionId` (`mk_txn_…`, the marketplace exchange identity
 * produced by `buildTransactionId`). The provider's own reference (`air_…`,
 * `res_…`, `iss_…`) is never a marketplace key and must never be used as the
 * join key. The design doc's "transaction reference (`txn_…`)" maps to
 * `facts.transactionId` here: `MarketplaceTransaction.reference` (`txn_…`,
 * from `buildTransactionReference`) is not part of the reconcile context, and
 * the wallet-debit evidence carries the `mk_txn_…` id everywhere.
 */
export interface MarketplaceReconcileContext {
  readonly facts: TransactionReconciliationFacts;
  readonly serviceKind: MarketplaceServiceKind;
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
  readonly resolutionStatus: ResolutionStatus;
  readonly config: ReconciliationConfig;
}

export interface MarketplaceReconcileInput extends ReconcileRecordsRequest {
  readonly config: ReconciliationConfig;
}

/**
 * Terminal, definitive provider statuses that carry enough evidence to emit a
 * provider row. Everything else (holds, timeouts) must not create a row so the
 * engine reports MISSING_PROVIDER_RECORD instead of a fabricated outcome.
 */
const EMITTED_PROVIDER_STATUSES: ReadonlySet<CanonicalPaymentStatus> = new Set([
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
]);

const MERCHANT_JOIN_KEY_TOLERANCE_MS = 60_000;

/**
 * Catalog-aware engine configuration: one currency namespace per service in
 * the marketplace, preserving first-appearance order, with the same 60s
 * temporal tolerance as the Paystack path. This keeps the engine's currency
 * validation in lockstep with what the marketplace actually sells (NGN, USD,
 * GBP in the demo catalog) without touching the frozen engine.
 */
export function marketplaceReconcileConfig(
  catalog: MarketplaceCatalog,
): ReconciliationConfig {
  const supportedCurrencies: string[] = [];
  for (const service of catalog.services) {
    if (!supportedCurrencies.includes(service.currency)) {
      supportedCurrencies.push(service.currency);
    }
  }
  return {
    timestampValidation: {
      enabled: true,
      toleranceMs: MERCHANT_JOIN_KEY_TOLERANCE_MS,
    },
    supportedCurrencies,
  };
}

/**
 * Maps a `MarketplaceReconcileContext` into the frozen engine's input.
 *
 * - Merchant side (expected) is always present: amount from the checkout quote
 *   (`expectedAmountMinor`, server-owned), status from the canonical payment
 *   state, occurred_at from the transaction request time.
 * - Provider side (observed) is emitted according to §4.4 — only when the
 *   latest attempt carries definitive returnable evidence. The provider's own
 *   reference stays in `providerSourceAttributes`; the join key is
 *   `facts.transactionId` on both sides.
 */
export function buildMarketplaceReconcileInput(
  context: MarketplaceReconcileContext,
): MarketplaceReconcileInput {
  const facts = context.facts;
  const merchant: MerchantPayment = {
    merchant_reference: facts.transactionId,
    amount: facts.expectedAmountMinor,
    currency: facts.currency,
    status: facts.paymentState,
    occurred_at: parseEpochMillis(facts.requestedAt),
    merchant_record_id: facts.orderId,
  };
  const latest = facts.providerAttemptHistory.at(-1) ?? null;
  const provider = providerRow(latest, facts);
  return {
    merchantPayments: [merchant],
    providerPayments: provider === null ? [] : [provider.payment],
    config: context.config,
    providerSourceAttributes:
      provider === null ? undefined : [provider.sourceAttributes],
  };
}

function providerRow(
  latest: ProviderAttempt | null,
  facts: TransactionReconciliationFacts,
): {
  readonly payment: ProviderPayment;
  readonly sourceAttributes: SourceAttributes;
} | null {
  if (
    latest === null ||
    latest.providerReference === null ||
    latest.amountMinor === null ||
    latest.canonicalStatus === null ||
    !EMITTED_PROVIDER_STATUSES.has(latest.canonicalStatus)
  ) {
    return null;
  }
  return {
    payment: {
      reference: facts.transactionId,
      amount: latest.amountMinor,
      currency: facts.currency,
      status: latest.canonicalStatus,
      occurred_at: parseEpochMillis(latest.attemptedAt),
      provider_id: facts.providerId,
    },
    sourceAttributes: latest.sourceAttributes,
  };
}

function parseEpochMillis(isoTimestamp: string | null): number | null {
  if (isoTimestamp === null) {
    return null;
  }
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? null : parsed;
}
