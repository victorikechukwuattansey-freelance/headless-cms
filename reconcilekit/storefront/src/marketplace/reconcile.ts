import type {
  ReconciliationCode,
  ReconciliationReport,
  SourceAttributes,
} from "../../../src/domain/model.ts";
import { reconcileRecords } from "../../../src/application/reconcile-records.ts";
import type { JsonlStore } from "../store/jsonl-store.ts";
import type { Repositories } from "../db/repositories/index.ts";
import { findServiceById } from "./catalog.ts";
import {
  buildMarketplaceReconcileInput,
  marketplaceReconcileConfig,
  type MarketplaceReconcileContext,
} from "./reconcile-bridge.ts";
import {
  buildMarketplaceTruth,
  buildTransactionTruth,
  findEngineResult,
  toReconciliationSnapshot,
  type TransactionTruth,
} from "./truth.ts";
import { appendTransactionEvent, sourceAttributes } from "./timeline.ts";
import { marketplaceTransactionFacts } from "./transactions.ts";
import type {
  EvidencePack,
  GiftCardArtifact,
  MarketplaceCatalog,
  MarketplaceService,
  MarketplaceTransaction,
  TicketArtifact,
  TransactionEvent,
} from "./types.ts";

export interface MarketplaceReconcileDeps {
  readonly store: JsonlStore;
  readonly repos: Repositories;
  readonly catalog: MarketplaceCatalog;
}

export interface ReconcileTransactionInput {
  readonly transactionId: string;
  readonly now?: string;
}

export interface ReconcileTransactionResult {
  readonly transactionId: string;
  readonly truth: TransactionTruth;
  readonly report: ReconciliationReport | null;
  readonly pack: EvidencePack;
  readonly events: readonly TransactionEvent[];
  readonly replayed: boolean;
}

type ReconcileErrorCode = "TRANSACTION_NOT_FOUND" | "SERVICE_NOT_FOUND";

export class ReconcileError extends Error {
  readonly code: ReconcileErrorCode;
  constructor(code: ReconcileErrorCode, message: string) {
    super(message);
    this.name = "ReconcileError";
    this.code = code;
  }
}

function evidencePackId(transactionId: string): string {
  return `evp_${transactionId}`;
}

interface EvidenceFacts {
  readonly service: MarketplaceService;
  readonly providerFacts: SourceAttributes;
}

async function readEvidenceFacts(
  repos: Repositories,
  transaction: MarketplaceTransaction,
  catalog: MarketplaceCatalog,
): Promise<EvidenceFacts> {
  const service = findServiceById(catalog, transaction.serviceId);
  if (service === undefined) {
    throw new ReconcileError(
      "SERVICE_NOT_FOUND",
      `service ${transaction.serviceId} not found in catalog`,
    );
  }
  const last = (
    await repos.marketplaceProviderAttempts.listByTransaction(transaction.id)
  ).at(-1);
  return {
    service,
    providerFacts: last === undefined ? {} : last.sourceAttributes,
  };
}

async function readArtifacts(
  store: JsonlStore,
  repos: Repositories,
  transactionId: string,
): Promise<readonly (TicketArtifact | GiftCardArtifact)[]> {
  const ticket = await repos.ticketArtifacts.listByTransaction(transactionId);
  const gift = await repos.giftCardArtifacts.listByTransaction(transactionId);
  return [...ticket, ...gift];
}

async function replayTruth(
  store: JsonlStore,
  repos: Repositories,
  transaction: MarketplaceTransaction,
  pack: EvidencePack,
): Promise<TransactionTruth> {
  const facts = await marketplaceTransactionFacts(store, repos, transaction.id);
  return buildTransactionTruth({
    transactionId: transaction.id,
    outcome:
      pack.reconciliation?.outcome ??
      transaction.reconcileOutcome ??
      "UNRESOLVED",
    codes: pack.reconciliation?.codes ?? [],
    paymentState: facts?.paymentState ?? "UNKNOWN",
    resolutionStatus: transaction.resolutionStatus,
    expectedAmountMinor: facts?.expectedAmountMinor ?? 0,
    currency: facts?.currency ?? "NGN",
    providerAmountMinor: facts?.providerAmountMinor ?? null,
  });
}

/**
 * Reconcile one marketplace transaction through the frozen Reconcile Kit
 * engine. Idempotent per transaction: the first call runs the engine and
 * records a deterministic evidence pack; every later call replays the pack and
 * re-derives truth without touching the engine.
 */
export async function reconcileMarketplaceTransaction(
  deps: MarketplaceReconcileDeps,
  input: ReconcileTransactionInput,
): Promise<ReconcileTransactionResult> {
  const store = deps.store;
  const now = input.now ?? new Date().toISOString();
  const transaction = await deps.repos.marketplaceTransactions.readLatestById(
    input.transactionId,
  );
  if (transaction === null) {
    throw new ReconcileError(
      "TRANSACTION_NOT_FOUND",
      `transaction ${input.transactionId} not found`,
    );
  }

  const existingPack = await deps.repos.evidencePacks.readLatestById(
    evidencePackId(input.transactionId),
  );
  if (existingPack !== null) {
    const truth = await replayTruth(
      store,
      deps.repos,
      transaction,
      existingPack,
    );
    return {
      transactionId: input.transactionId,
      truth,
      report: null,
      pack: existingPack,
      events: [],
      replayed: true,
    };
  }

  const facts = await marketplaceTransactionFacts(
    store,
    deps.repos,
    input.transactionId,
  );
  if (facts === null) {
    throw new ReconcileError(
      "TRANSACTION_NOT_FOUND",
      `transaction ${input.transactionId} not found`,
    );
  }

  const { service, providerFacts } = await readEvidenceFacts(
    deps.repos,
    transaction,
    deps.catalog,
  );
  const artifacts = await readArtifacts(store, deps.repos, input.transactionId);

  const context: MarketplaceReconcileContext = {
    facts,
    serviceKind: service.kind,
    artifacts,
    resolutionStatus: transaction.resolutionStatus,
    config: marketplaceReconcileConfig(deps.catalog),
  };
  const inputRecords = buildMarketplaceReconcileInput(context);
  const report = await reconcileRecords(inputRecords);
  const result = findEngineResult(report, facts.orderId, facts.transactionId);
  const truth = buildMarketplaceTruth(report, context);
  const snapshot = toReconciliationSnapshot(result);

  const eventInputBuilt = await appendTransactionEvent(deps.repos, {
    transactionId: input.transactionId,
    type: "RECONCILE_INPUT_BUILT",
    label: "Marketplace reconciliation input built",
    description: `Emitted ${inputRecords.merchantPayments.length} merchant row(s) and ${inputRecords.providerPayments.length} provider row(s) for the Reconcile Kit engine.`,
    actor: "RECONCILE_KIT",
    source: "RECONCILE_KIT",
    metadata: sourceAttributes({
      marketplace_transaction_id: facts.transactionId,
      provider_rows: String(inputRecords.providerPayments.length),
      currencies: inputRecords.config.supportedCurrencies.join(","),
    }),
    occurredAt: now,
  });
  const eventDetermined = await appendTransactionEvent(deps.repos, {
    transactionId: input.transactionId,
    type:
      truth.reconcileOutcome === "MATCH"
        ? "RECONCILE_DETERMINED"
        : "RECONCILE_REQUIRES_REVIEW",
    label:
      truth.reconcileOutcome === "MATCH"
        ? "Marketplace reconciliation determined"
        : "Marketplace reconciliation requires review",
    description: `Reconcile Kit determined ${truth.reconcileOutcome} (customer: ${truth.customerStatus}, admin: ${truth.adminStatus}).`,
    actor: "RECONCILE_KIT",
    source: "RECONCILE_KIT",
    metadata: sourceAttributes({
      outcome: truth.reconcileOutcome,
      customer_status: truth.customerStatus,
      admin_status: truth.adminStatus,
      money_at_risk: String(truth.moneyAtRisk),
    }),
    occurredAt: now,
  });

  const pack: EvidencePack = {
    id: evidencePackId(input.transactionId),
    transactionId: input.transactionId,
    customerReference: facts.customerReference,
    providerReference: facts.providerReference,
    paymentReference: null,
    serviceSnapshot: service,
    amountMinor: facts.expectedAmountMinor,
    currency: facts.currency,
    timelineEventIds: [eventInputBuilt.id, eventDetermined.id],
    providerFacts,
    reconciliation: snapshot,
    mismatchFlags: dedupe([...facts.flags, ...snapshot.codes]),
    resolutionStatus: transaction.resolutionStatus,
    auditEventIds: facts.evidenceLedgerEntryIds,
    createdAt: now,
    simulated: true,
  };
  await deps.repos.evidencePacks.insert(pack);
  await deps.repos.marketplaceTransactions.insert({
    ...transaction,
    reconcileOutcome: truth.reconcileOutcome,
    customerStatus: truth.customerStatus,
    adminStatus: truth.adminStatus,
    updatedAt: now,
  });

  return {
    transactionId: input.transactionId,
    truth,
    report,
    pack,
    events: [eventInputBuilt, eventDetermined],
    replayed: false,
  };
}

function dedupe(
  codes: readonly ReconciliationCode[],
): readonly ReconciliationCode[] {
  return Array.from(new Set(codes));
}
