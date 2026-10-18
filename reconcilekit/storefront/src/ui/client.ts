import type { Outcome, ReconciliationCode } from "../../../src/domain/model.ts";
import type { JsonlStore } from "../store/jsonl-store.ts";
import {
  executeMarketplaceTransaction,
  marketplaceTransactionFacts,
  type ExecuteTransactionInput,
  type MarketplaceTransactionDeps,
  type TransactionReconciliationFacts,
} from "../marketplace/transactions.ts";
import { reconcileMarketplaceTransaction } from "../marketplace/reconcile.ts";
import { buildTransactionTruth } from "../marketplace/truth.ts";
import type {
  TransactionTruth,
  TruthDeterminationInput,
} from "../marketplace/truth.ts";
import { redactEvidencePack } from "../marketplace/evidence.ts";
import { issueReceipt, ReceiptError } from "../marketplace/receipts.ts";
import { listNotificationsByCustomer } from "../marketplace/notifications.ts";
import { listTransactionEvents } from "../marketplace/timeline.ts";
import {
  findWalletByCustomer,
  getWalletBalance,
} from "../marketplace/wallet.ts";
import type { WalletBalance } from "../marketplace/wallet.ts";
import { findServiceById, DEFAULT_SCENARIOS } from "../marketplace/catalog.ts";
import { resolveDemoAlias } from "../marketplace/demo-scenarios.ts";
import type {
  CatalogProduct,
  DisputeRecord,
  EvidencePack,
  GiftCardArtifact,
  ManualReviewRecord,
  MarketplaceCustomer,
  MarketplaceOrder,
  MarketplacePaymentRecord,
  MarketplaceService,
  MarketplaceTransaction,
  NotificationRecord,
  ProviderAttempt,
  ReceiptRecord,
  RefundRecord,
  ReversalRecord,
  TicketArtifact,
  TransactionEvent,
  WalletLedgerEntry,
} from "../marketplace/types.ts";
import { DEMO_ORG_ID } from "../marketplace/tenancy.ts";
import type { Repositories } from "../db/repositories/index.ts";

export const DEMO_CUSTOMER_ID = "cus_demo";

export interface ProfileLike {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly isDemo: boolean;
}

export interface CustomerProfile extends ProfileLike {}

export interface WalletSummary {
  readonly id: string;
  readonly currency: string;
  readonly availableMinor: number;
  readonly pendingMinor: number;
  readonly totalMinor: number;
  readonly ledgerCount: number;
}

export interface TransactionRow {
  readonly id: string;
  readonly reference: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly kind: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly customerStatus: string;
  readonly adminStatus: string;
  readonly moneyAtRisk: boolean;
  readonly reconcileOutcome: string;
  readonly createdAt: string;
  readonly detailHref: string;
}

export interface LedgerRow {
  readonly id: string;
  readonly type: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly reference: string;
  readonly occurredAt: string;
}

export interface NotificationBrief {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface DashboardViewModel {
  readonly customer: CustomerProfile;
  readonly wallet: WalletSummary | null;
  readonly rows: readonly TransactionRow[];
  readonly atRiskCount: number;
  readonly notifications: readonly NotificationBrief[];
}

export interface WalletViewModel {
  readonly customer: CustomerProfile;
  readonly wallet: WalletSummary | null;
  readonly ledger: readonly LedgerRow[];
}

export interface CatalogServiceRow {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  readonly currency: string;
  readonly baseAmountMinor: number;
  readonly complianceStatus: string;
  readonly availability: string;
  readonly fulfillmentType: string;
  readonly href: string;
}

export interface CatalogGroupView {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly services: readonly CatalogServiceRow[];
}

export interface CatalogViewModel {
  readonly customer: CustomerProfile;
  readonly groups: readonly CatalogGroupView[];
}

export interface ServiceDetailViewModel {
  readonly customer: CustomerProfile;
  readonly service: MarketplaceService;
  readonly products: readonly CatalogProduct[];
}

export interface TransactionsViewModel {
  readonly customer: CustomerProfile;
  readonly rows: readonly TransactionRow[];
}

export interface CanAct {
  readonly refund: boolean;
  readonly completeRefund: boolean;
  readonly reverse: boolean;
  readonly openDispute: boolean;
  readonly cancelTicket: boolean;
  readonly resolveDispute: boolean;
  readonly resolveReview: boolean;
}

export interface TransactionDetailViewModel {
  readonly customer: CustomerProfile;
  readonly transaction: MarketplaceTransaction;
  readonly order: MarketplaceOrder | null;
  readonly payment: MarketplacePaymentRecord | null;
  readonly service: MarketplaceService | null;
  readonly inputs: Readonly<Record<string, string>>;
  readonly truth: TransactionTruth;
  readonly evidence: EvidencePack | null;
  readonly providerAttempt: ProviderAttempt | null;
  readonly events: readonly TransactionEvent[];
  readonly tickets: readonly TicketArtifact[];
  readonly giftCards: readonly GiftCardArtifact[];
  readonly receipt: ReceiptRecord | null;
  readonly refund: RefundRecord | null;
  readonly reversal: ReversalRecord | null;
  readonly dispute: DisputeRecord | null;
  readonly review: ManualReviewRecord | null;
  readonly notifications: readonly NotificationRecord[];
  readonly can: CanAct;
  readonly facts: TransactionReconciliationFacts | null;
  readonly ledger: readonly WalletLedgerEntry[];
  readonly isSimulated: true;
}

export interface EvidenceViewModel {
  readonly customer: CustomerProfile;
  readonly transaction: MarketplaceTransaction;
  readonly evidence: EvidencePack | null;
}

export interface ReceiptViewModel {
  readonly customer: CustomerProfile;
  readonly transaction: MarketplaceTransaction;
  readonly receipt: ReceiptRecord;
  readonly label: string;
  readonly references: {
    readonly customerReference: string;
    readonly providerReference: string | null;
  };
  readonly reconciliationOutcome: string;
}

export interface NotificationsViewModel {
  readonly customer: CustomerProfile;
  readonly notifications: readonly NotificationRecord[];
}

export interface DisputesViewModel {
  readonly customer: CustomerProfile;
  readonly disputes: readonly DisputeRecord[];
  readonly rows: readonly TransactionRow[];
}

export interface AdminStatusCount {
  readonly status: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
}

export interface AdminDashboardViewModel {
  readonly counts: readonly AdminStatusCount[];
  readonly atRisk: readonly TransactionRow[];
  readonly total: number;
}

export interface AdminQueueViewModel {
  readonly status: string;
  readonly label: string;
  readonly rows: readonly TransactionRow[];
}

export interface CheckoutOptionService {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}

export interface CheckoutOptionsViewModel {
  readonly customer: CustomerProfile;
  readonly services: readonly CheckoutOptionService[];
  readonly scenarios: readonly string[];
  readonly defaults: Readonly<Record<string, string>>;
}

const DEMO_INPUTS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  {
    svc_airtime_mtn: {
      network: "MTN",
      recipient: "08030000000",
      amount: "1000",
    },
    svc_electricity_aedc: {
      provider: "AEDC",
      meterNumber: "23456781",
      meterType: "prepaid",
      amount: "10000",
    },
    svc_giftcard_amazon: {
      brand: "Amazon",
      region: "US",
      denomination: "$25",
      quantity: "1",
    },
    svc_cinema_filmhouse: {
      venue: "Filmhouse IMAX",
      movie: "Oppenheimer",
      screening: "2026-02-01T19:00:00.000Z",
      seats: "A1",
    },
    svc_bus_lagos_abuja: {
      origin: "Lagos",
      destination: "Abuja",
      date: "2026-02-10",
      passenger: "Ada Obi",
      seat: "A1",
    },
    svc_airline_los_abv: {
      origin: "LOS",
      destination: "ABV",
      date: "2026-02-10",
      passenger: "Chidi Okafor",
      flight: "Economy",
    },
  };

const ADMIN_STATUS_LABELS: Readonly<Record<string, string>> = {
  HEALTHY: "Healthy",
  PENDING_PROVIDER: "Pending provider",
  PROVIDER_FAILED: "Provider failed",
  MISMATCH: "Mismatch",
  DUPLICATE: "Duplicate",
  REFUND_QUEUE: "Refund queue",
  REVERSAL_QUEUE: "Reversal queue",
  MANUAL_REVIEW: "Manual review",
  UNRESOLVED: "Unresolved",
};

const CUSTOMER_STATUS_LABELS: Readonly<Record<string, string>> = {
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  FAILED: "Failed",
  NEEDS_ATTENTION: "Needs attention",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  REVERSED: "Reversed",
  MANUAL_REVIEW: "Under review",
};

export function customerStatusLabel(status: string): string {
  return CUSTOMER_STATUS_LABELS[status] ?? status.split("_").join(" ");
}

export function adminStatusLabel(status: string): string {
  return ADMIN_STATUS_LABELS[status] ?? status.split("_").join(" ");
}

export async function customerProfile(
  repos: Repositories,
  customerId: string,
): Promise<CustomerProfile> {
  const found = await repos.marketplaceCustomers.readLatestById(customerId);
  if (found !== null) {
    return {
      id: found.id,
      org_id: found.org_id,
      name: found.name,
      email: found.email,
      phone: found.phone,
      isDemo: found.isDemo,
    };
  }
  return {
    id: customerId,
    org_id: DEMO_ORG_ID,
    name: "Demo Customer",
    email: "demo@example.com",
    phone: "+2340000000000",
    isDemo: true,
  };
}

async function latestTransactions(
  repos: Repositories,
): Promise<readonly MarketplaceTransaction[]> {
  const all = await repos.marketplaceTransactions.list();
  return Array.from(all).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findTransactionByIdentifier(
  repos: Repositories,
  identifier: string,
): Promise<MarketplaceTransaction | null> {
  const resolved = resolveDemoAlias(identifier);
  const candidateId = resolved?.id ?? identifier;
  const candidateReference = resolved?.reference ?? identifier;
  const all = await latestTransactions(repos);
  return (
    all.find(
      (record) =>
        record.id === candidateId || record.reference === candidateReference,
    ) ?? null
  );
}

async function truthFor(
  repos: Repositories,
  transaction: MarketplaceTransaction,
): Promise<TransactionTruth> {
  const pack = await repos.evidencePacks.readLatestById(
    `evp_${transaction.id}`,
  );
  const facts = await marketplaceTransactionFacts(repos, transaction.id);
  const input: TruthDeterminationInput = {
    transactionId: transaction.id,
    outcome:
      pack?.reconciliation?.outcome ??
      transaction.reconcileOutcome ??
      "UNRESOLVED",
    codes: pack?.reconciliation?.codes ?? [],
    paymentState: facts?.paymentState ?? "UNKNOWN",
    resolutionStatus: transaction.resolutionStatus,
    expectedAmountMinor: facts?.expectedAmountMinor ?? 0,
    currency: facts?.currency ?? "NGN",
    providerAmountMinor: facts?.providerAmountMinor ?? null,
  };
  return buildTransactionTruth(input);
}

async function latestAttempt(
  repos: Repositories,
  transactionId: string,
): Promise<ProviderAttempt | null> {
  const attempts =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  return attempts.at(-1) ?? null;
}

async function artifactsFor(
  repos: Repositories,
  transactionId: string,
): Promise<{
  readonly tickets: readonly TicketArtifact[];
  readonly giftCards: readonly GiftCardArtifact[];
}> {
  const tickets = await repos.ticketArtifacts.listByTransaction(transactionId);
  const giftCards =
    await repos.giftCardArtifacts.listByTransaction(transactionId);
  return { tickets, giftCards };
}

async function ledgerFor(
  repos: Repositories,
  walletId: string,
): Promise<readonly WalletLedgerEntry[]> {
  const entries = await repos.walletLedger.listByWallet(walletId);
  return entries.slice().sort((a, b) => {
    const byTime = b.occurredAt.localeCompare(a.occurredAt);
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
  });
}

async function walletSummary(
  repos: Repositories,
  customerId: string,
): Promise<WalletSummary | null> {
  const wallet = await findWalletByCustomer(repos, customerId);
  if (wallet === null) return null;
  const balance: WalletBalance = await getWalletBalance(
    repos,
    wallet.id,
    wallet.currency,
  );
  const ledger = await ledgerFor(repos, wallet.id);
  return {
    id: wallet.id,
    currency: wallet.currency,
    availableMinor: balance.availableMinor,
    pendingMinor: balance.pendingMinor,
    totalMinor: balance.availableMinor + balance.pendingMinor,
    ledgerCount: ledger.length,
  };
}

async function orderAmounts(
  repos: Repositories,
  orderId: string,
): Promise<{ amountMinor: number; currency: string }> {
  const order = await repos.marketplaceOrders.readLatestById(orderId);
  return {
    amountMinor: order?.quotedAmountMinor ?? 0,
    currency: order?.currency ?? "NGN",
  };
}

function transactionRow(
  transaction: MarketplaceTransaction,
  kind: string,
  serviceName: string,
  amountMinor: number,
  currency: string,
  moneyAtRisk: boolean,
): TransactionRow {
  return {
    id: transaction.id,
    reference: transaction.reference,
    serviceId: transaction.serviceId,
    serviceName,
    kind,
    amountMinor,
    currency,
    customerStatus: transaction.customerStatus,
    adminStatus: transaction.adminStatus,
    moneyAtRisk,
    reconcileOutcome: transaction.reconcileOutcome ?? "UNRESOLVED",
    createdAt: transaction.createdAt,
    detailHref: `/transactions/${encodeURIComponent(transaction.reference)}`,
  };
}

async function buildTransactionRows(
  deps: MarketplaceTransactionDeps,
): Promise<TransactionRow[]> {
  const rows: TransactionRow[] = [];
  for (const transaction of await latestTransactions(deps.repos)) {
    const service = findServiceById(deps.catalog, transaction.serviceId);
    const amounts = await orderAmounts(deps.repos, transaction.orderId);
    const truth = await truthFor(deps.repos, transaction);
    rows.push(
      transactionRow(
        transaction,
        service?.kind ?? "AIRTIME",
        service?.name ?? transaction.serviceId,
        amounts.amountMinor,
        amounts.currency,
        truth.moneyAtRisk,
      ),
    );
  }
  return rows;
}

export async function dashboardViewModel(
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<DashboardViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const wallet = await walletSummary(deps.repos, customerId);
  const rows = await buildTransactionRows(deps);
  const notifications = (await listNotificationsByCustomer(store, customerId))
    .slice(0, 3)
    .map((record) => ({
      id: record.id,
      title: record.title,
      body: record.body,
      status: record.status,
      createdAt: record.createdAt,
    }));
  return {
    customer,
    wallet,
    rows: rows.slice(0, 5),
    atRiskCount: rows.filter((row) => row.moneyAtRisk).length,
    notifications,
  };
}

export async function walletViewModel(
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<WalletViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const wallet = await walletSummary(deps.repos, customerId);
  const walletRecord = await findWalletByCustomer(deps.repos, customerId);
  const ledger =
    walletRecord === null
      ? []
      : (await ledgerFor(deps.repos, walletRecord.id)).map((entry) => ({
          id: entry.id,
          type: entry.type,
          amountMinor: entry.amountMinor,
          currency: entry.currency,
          status: entry.status,
          reference: entry.reference,
          occurredAt: entry.occurredAt,
        }));
  return { customer, wallet, ledger };
}

export async function catalogViewModel(
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<CatalogViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const groups: CatalogGroupView[] = [];
  for (const category of deps.catalog.categories) {
    const services = deps.catalog.services.filter(
      (service) => service.categoryId === category.id,
    );
    if (services.length === 0) {
      continue;
    }
    groups.push({
      id: category.id,
      group: category.group,
      name: category.name,
      description: category.description,
      services: services.map((service) => ({
        id: service.id,
        kind: service.kind,
        name: service.name,
        description: service.description,
        currency: service.currency,
        baseAmountMinor: service.baseAmountMinor,
        complianceStatus: service.complianceStatus,
        availability: service.availability,
        fulfillmentType: service.fulfillmentType,
        href: `/catalog/${encodeURIComponent(service.id)}`,
      })),
    });
  }
  return { customer, groups };
}

export async function serviceDetailViewModel(
  deps: MarketplaceTransactionDeps,
  serviceId: string,
): Promise<ServiceDetailViewModel | null> {
  const service = findServiceById(deps.catalog, serviceId);
  if (service === undefined) {
    return null;
  }
  const customer = await customerProfile(deps.repos, DEMO_CUSTOMER_ID);
  const products = deps.catalog.products.filter(
    (product) => product.serviceId === service.id,
  );
  return { customer, service, products };
}

export async function transactionsViewModel(
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<TransactionsViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const rows = await buildTransactionRows(deps);
  return { customer, rows };
}

export async function transactionDetailViewModel(
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  identifier: string,
): Promise<TransactionDetailViewModel | null> {
  const transaction = await findTransactionByIdentifier(deps.repos, identifier);
  if (transaction === null) {
    return null;
  }
  const customer = await customerProfile(deps.repos, transaction.customerId);
  const order = await deps.repos.marketplaceOrders.readLatestById(
    transaction.orderId,
  );
  const payment = await deps.repos.marketplacePayments.findByOrderId(
    transaction.orderId,
  );
  const service = findServiceById(deps.catalog, transaction.serviceId) ?? null;
  const truth = await truthFor(deps.repos, transaction);
  const pack = await deps.repos.evidencePacks.readLatestById(
    `evp_${transaction.id}`,
  );
  const evidence = pack === null ? null : redactEvidencePack(pack);
  const providerAttempt = await latestAttempt(deps.repos, transaction.id);
  const events = await listTransactionEvents(deps.repos, transaction.id);
  const artifacts = await artifactsFor(deps.repos, transaction.id);
  const receipt = await deps.repos.receipts.readLatestById(
    `rcpt_${transaction.id}`,
  );
  const refund = await deps.repos.refunds.readLatestById(
    `ref_${transaction.id}`,
  );
  const reversal = await deps.repos.reversals.readLatestById(
    `rev_${transaction.id}`,
  );
  const dispute = await deps.repos.disputes.readLatestById(
    `dsp_${transaction.id}`,
  );
  const review = await deps.repos.manualReviews.readLatestById(
    `mr_${transaction.id}`,
  );
  const notifications = (
    await listNotificationsByCustomer(store, transaction.customerId)
  ).filter((record) => record.transactionId === transaction.id);
  const facts = await marketplaceTransactionFacts(deps.repos, transaction.id);
  const ledger = await deps.repos.walletLedger.listByTransaction(
    transaction.id,
  );

  const terminal =
    transaction.resolutionStatus === "REFUNDED" ||
    transaction.resolutionStatus === "REVERSED";
  const refundInFlight =
    refund !== null &&
    (refund.status === "INITIATED" || refund.status === "PENDING");
  const disputeOpen =
    dispute !== null &&
    (dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW");
  const reviewOpen =
    review !== null &&
    (review.status === "OPEN" || review.status === "IN_REVIEW");
  const ticket = artifacts.tickets[0] ?? null;
  const cancellableTicket =
    ticket !== null &&
    ticket.status !== "CANCELLED" &&
    ticket.status !== "REFUNDED" &&
    ticket.reservationReference !== null &&
    !terminal;

  const can: CanAct = {
    refund:
      !terminal &&
      !refundInFlight &&
      (refund === null || refund.status !== "COMPLETED"),
    completeRefund: refund !== null && refund.status === "PENDING",
    reverse:
      !terminal &&
      !refundInFlight &&
      refund?.status !== "COMPLETED" &&
      (reversal === null || reversal.status !== "COMPLETED"),
    openDispute: !terminal && !disputeOpen,
    cancelTicket: cancellableTicket,
    resolveDispute: disputeOpen,
    resolveReview: reviewOpen,
  };

  return {
    customer,
    transaction,
    order,
    payment,
    service,
    inputs: order?.inputs ?? {},
    truth,
    evidence,
    providerAttempt,
    events,
    tickets: artifacts.tickets,
    giftCards: artifacts.giftCards,
    receipt,
    refund,
    reversal,
    dispute,
    review,
    notifications,
    can,
    facts,
    ledger,
    isSimulated: true,
  };
}

export async function evidenceViewModel(
  deps: MarketplaceTransactionDeps,
  identifier: string,
): Promise<EvidenceViewModel | null> {
  const transaction = await findTransactionByIdentifier(deps.repos, identifier);
  if (transaction === null) {
    return null;
  }
  const customer = await customerProfile(deps.repos, transaction.customerId);
  const pack = await deps.repos.evidencePacks.readLatestById(
    `evp_${transaction.id}`,
  );
  return {
    customer,
    transaction,
    evidence: pack === null ? null : redactEvidencePack(pack),
  };
}

export async function ensureReceipt(
  deps: MarketplaceTransactionDeps,
  identifier: string,
): Promise<ReceiptViewModel | null> {
  const transaction = await findTransactionByIdentifier(deps.repos, identifier);
  if (transaction === null) {
    return null;
  }
  const customer = await customerProfile(deps.repos, transaction.customerId);
  const order = await deps.repos.marketplaceOrders.readLatestById(
    transaction.orderId,
  );
  const service = findServiceById(deps.catalog, transaction.serviceId);
  let pack = await deps.repos.evidencePacks.readLatestById(
    `evp_${transaction.id}`,
  );
  if (pack === null) {
    await reconcileMarketplaceTransaction(
      { repos: deps.repos, catalog: deps.catalog },
      { transactionId: transaction.id },
    );
    pack = await deps.repos.evidencePacks.readLatestById(
      `evp_${transaction.id}`,
    );
    if (pack === null) {
      throw new ReceiptError(
        "EVIDENCE_PACK_MISSING",
        `Reconciliation produced no evidence pack for ${transaction.id}`,
      );
    }
  }
  const reconciliationOutcome: Outcome | null =
    pack.reconciliation?.outcome ?? transaction.reconcileOutcome ?? null;
  const receipt = await issueReceipt(deps.repos, {
    transactionId: transaction.id,
    customerReference: order?.customerReference ?? "",
    providerReference: pack?.providerReference ?? null,
    amountMinor: order?.quotedAmountMinor ?? pack.amountMinor,
    currency: order?.currency ?? pack.currency,
    label: service?.name ?? transaction.serviceId,
    reconciliationOutcome,
  });
  return {
    customer,
    transaction,
    receipt,
    label: service?.name ?? transaction.serviceId,
    references: {
      customerReference: order?.customerReference ?? "",
      providerReference: pack?.providerReference ?? null,
    },
    reconciliationOutcome: reconciliationOutcome ?? "UNRESOLVED",
  };
}

export async function notificationsViewModel(
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<NotificationsViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const notifications = await listNotificationsByCustomer(store, customerId);
  return { customer, notifications };
}

export async function disputesViewModel(
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<DisputesViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const allDisputes = await deps.repos.disputes.list();
  const disputes = allDisputes
    .filter((record) => record.customerId === customerId)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const rows = await buildTransactionRows(deps);
  return { customer, disputes, rows };
}

export async function adminDashboardViewModel(
  deps: MarketplaceTransactionDeps,
): Promise<AdminDashboardViewModel> {
  const transactions = await latestTransactions(deps.repos);
  const statuses = [
    "HEALTHY",
    "PENDING_PROVIDER",
    "PROVIDER_FAILED",
    "MISMATCH",
    "DUPLICATE",
    "REFUND_QUEUE",
    "REVERSAL_QUEUE",
    "MANUAL_REVIEW",
    "UNRESOLVED",
  ];
  const counts: AdminStatusCount[] = statuses.map((status) => ({
    status,
    label: adminStatusLabel(status),
    count: transactions.filter(
      (transaction) => transaction.adminStatus === status,
    ).length,
    href: `/admin/queues/${status.toLowerCase()}`,
  }));
  const atRisk = (await buildTransactionRows(deps)).filter(
    (row) => row.moneyAtRisk,
  );
  return { counts, atRisk, total: transactions.length };
}

export async function adminQueueViewModel(
  deps: MarketplaceTransactionDeps,
  status: string,
): Promise<AdminQueueViewModel | null> {
  const normalized = status.toUpperCase();
  const label = adminStatusLabel(normalized);
  const known = ADMIN_STATUS_LABELS[normalized];
  if (known === undefined) {
    return null;
  }
  const rows = (await buildTransactionRows(deps)).filter(
    (row) => row.adminStatus === normalized,
  );
  return { status: normalized, label, rows };
}

export async function checkoutOptionsViewModel(
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<CheckoutOptionsViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const services = deps.catalog.services
    .filter((service) => service.id !== "svc_betting_examplebet")
    .map((service) => ({
      id: service.id,
      name: service.name,
      kind: service.kind,
    }));
  return {
    customer,
    services,
    scenarios: [...DEFAULT_SCENARIOS],
    defaults: DEMO_INPUTS[services[0]?.id ?? ""] ?? {},
  };
}

export function demoInputsForService(
  serviceId: string,
): Readonly<Record<string, string>> {
  return DEMO_INPUTS[serviceId] ?? {};
}

export async function runCheckout(
  deps: MarketplaceTransactionDeps,
  input: ExecuteTransactionInput,
): Promise<{ transaction: MarketplaceTransaction; reference: string }> {
  const result = await executeMarketplaceTransaction(deps, input);
  await reconcileMarketplaceTransaction(deps, {
    transactionId: result.transaction.id,
  });
  return {
    transaction: result.transaction,
    reference: result.transaction.reference,
  };
}

// ============================================================
// Phase 3D — Mismatch investigation view-models
// ============================================================

/**
 * A "finding" is a persisted reconciliation result that is not MATCH.
 * Findings are enumerated from `evidence_packs`, which the reconcile
 * orchestrator writes exactly once per transaction (replay returns the
 * existing pack unchanged). 3D never re-runs the engine.
 */
const FINDING_OUTCOME_RANK: Readonly<Record<string, number>> = {
  DISCREPANCY: 1,
  UNRESOLVED: 2,
  HELD_AMBIGUOUS: 3,
  MISSING_PROVIDER_RECORD: 4,
  UNMATCHED_PROVIDER_RECORD: 5,
  MISSING_REFERENCE: 6,
  INPUT_ERROR: 7,
};

function isFindingOutcome(outcome: string): boolean {
  return FINDING_OUTCOME_RANK[outcome] !== undefined;
}

export interface FindingSummaryRow {
  readonly transactionId: string;
  readonly reference: string;
  readonly outcome: string;
  readonly codes: readonly string[];
  readonly note: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly detailHref: string;
}

export interface FindingsSummaryViewModel {
  readonly customer: CustomerProfile;
  readonly findings: readonly FindingSummaryRow[];
}

export interface FindingRecordSide {
  readonly role: "merchant" | "provider";
  readonly label: string;
  readonly reference: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly status: string | null;
  readonly occurredAt: string | null;
  readonly extraLabel: string;
  readonly extraValue: string;
}

export interface FindingDeterminationViewModel {
  readonly customer: CustomerProfile;
  readonly transaction: MarketplaceTransaction;
  readonly pack: EvidencePack;
  readonly outcome: string;
  readonly codes: readonly string[];
  readonly notes: readonly string[];
  readonly merchantSide: FindingRecordSide;
  readonly providerSide: FindingRecordSide | null;
  readonly whatHappensNext: string;
  readonly transactionHref: string;
  readonly evidenceHref: string;
}

export interface FindingEvidenceViewModel {
  readonly customer: CustomerProfile;
  readonly transaction: MarketplaceTransaction;
  readonly evidence: EvidencePack;
  readonly outcome: string;
  readonly codes: readonly string[];
  readonly determinationHref: string;
  readonly transactionHref: string;
}

function findingCodesFor(pack: EvidencePack): readonly ReconciliationCode[] {
  const codes: ReconciliationCode[] = [];
  for (const code of pack.reconciliation?.codes ?? []) {
    codes.push(code);
  }
  for (const flag of pack.mismatchFlags) {
    codes.push(flag);
  }
  return Array.from(new Set(codes));
}

function latestTransactionMap(
  transactions: readonly MarketplaceTransaction[],
): Map<string, MarketplaceTransaction> {
  const map = new Map<string, MarketplaceTransaction>();
  for (const record of transactions) {
    const existing = map.get(record.id);
    if (existing === undefined || record.updatedAt > existing.updatedAt) {
      map.set(record.id, record);
    }
  }
  return map;
}

function latestPackMap(
  packs: readonly EvidencePack[],
): Map<string, EvidencePack> {
  const map = new Map<string, EvidencePack>();
  for (const pack of packs) {
    const existing = map.get(pack.transactionId);
    if (existing === undefined || pack.createdAt > existing.createdAt) {
      map.set(pack.transactionId, pack);
    }
  }
  return map;
}

export async function findingsSummaryViewModel(
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<FindingsSummaryViewModel> {
  const customer = await customerProfile(deps.repos, customerId);
  const transactions = latestTransactionMap(
    await deps.repos.marketplaceTransactions.list(),
  );
  const packs = latestPackMap(await deps.repos.evidencePacks.list());

  const rows: FindingSummaryRow[] = [];
  for (const pack of packs.values()) {
    const outcome = pack.reconciliation?.outcome ?? "UNRESOLVED";
    if (!isFindingOutcome(outcome)) {
      continue;
    }
    const transaction = transactions.get(pack.transactionId);
    if (transaction === undefined) {
      continue;
    }
    rows.push({
      transactionId: transaction.id,
      reference: transaction.reference,
      outcome,
      codes: findingCodesFor(pack),
      note: pack.reconciliation?.notes[0] ?? "",
      amountMinor: pack.amountMinor,
      currency: pack.currency,
      detailHref: `/findings/${encodeURIComponent(transaction.reference)}`,
    });
  }

  rows.sort((a, b) => {
    const rankDiff =
      (FINDING_OUTCOME_RANK[a.outcome] ?? 100) -
      (FINDING_OUTCOME_RANK[b.outcome] ?? 100);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.reference.localeCompare(b.reference);
  });

  return { customer, findings: rows };
}

function merchantSideFor(
  transaction: MarketplaceTransaction,
  pack: EvidencePack,
  facts: TransactionReconciliationFacts | null,
): FindingRecordSide {
  return {
    role: "merchant",
    label: "What the merchant recorded",
    reference: transaction.id,
    amountMinor: facts?.expectedAmountMinor ?? pack.amountMinor,
    currency: facts?.currency ?? pack.currency,
    status: facts?.paymentState ?? null,
    occurredAt: facts?.requestedAt ?? null,
    extraLabel: "Order id",
    extraValue: facts?.orderId ?? transaction.orderId,
  };
}

function providerSideFor(
  transaction: MarketplaceTransaction,
  pack: EvidencePack,
  facts: TransactionReconciliationFacts | null,
): FindingRecordSide | null {
  if (pack.providerReference === null) {
    return null;
  }
  return {
    role: "provider",
    label: "What the provider recorded",
    reference: transaction.id,
    amountMinor: facts?.providerAmountMinor ?? null,
    currency: facts?.currency ?? pack.currency,
    status: facts?.providerState ?? null,
    occurredAt: facts?.respondedAt ?? null,
    extraLabel: "Provider id",
    extraValue: facts?.providerId ?? transaction.providerId,
  };
}

export async function findingDeterminationViewModel(
  deps: MarketplaceTransactionDeps,
  identifier: string,
): Promise<FindingDeterminationViewModel | null> {
  const transaction = await findTransactionByIdentifier(deps.repos, identifier);
  if (transaction === null) {
    return null;
  }
  const pack = await deps.repos.evidencePacks.readLatestById(
    `evp_${transaction.id}`,
  );
  if (pack === null) {
    return null;
  }
  const customer = await customerProfile(deps.repos, transaction.customerId);
  const facts = await marketplaceTransactionFacts(deps.repos, transaction.id);
  const outcome = pack.reconciliation?.outcome ?? "UNRESOLVED";
  const codes = findingCodesFor(pack);
  const notes = pack.reconciliation?.notes ?? [];
  const truth = buildTransactionTruth({
    transactionId: transaction.id,
    outcome,
    codes,
    paymentState: facts?.paymentState ?? "UNKNOWN",
    resolutionStatus: transaction.resolutionStatus,
    expectedAmountMinor: facts?.expectedAmountMinor ?? pack.amountMinor,
    currency: facts?.currency ?? pack.currency,
    providerAmountMinor: facts?.providerAmountMinor ?? null,
  });

  return {
    customer,
    transaction,
    pack,
    outcome,
    codes,
    notes,
    merchantSide: merchantSideFor(transaction, pack, facts),
    providerSide: providerSideFor(transaction, pack, facts),
    whatHappensNext: truth.nextAction,
    transactionHref: `/transactions/${encodeURIComponent(transaction.reference)}`,
    evidenceHref: `/findings/${encodeURIComponent(transaction.reference)}/evidence`,
  };
}

export async function findingEvidenceViewModel(
  deps: MarketplaceTransactionDeps,
  identifier: string,
): Promise<FindingEvidenceViewModel | null> {
  const transaction = await findTransactionByIdentifier(deps.repos, identifier);
  if (transaction === null) {
    return null;
  }
  const pack = await deps.repos.evidencePacks.readLatestById(
    `evp_${transaction.id}`,
  );
  if (pack === null) {
    return null;
  }
  const customer = await customerProfile(deps.repos, transaction.customerId);
  const redacted = redactEvidencePack(pack);
  return {
    customer,
    transaction,
    evidence: redacted,
    outcome: redacted.reconciliation?.outcome ?? "UNRESOLVED",
    codes: redacted.reconciliation?.codes ?? [],
    determinationHref: `/findings/${encodeURIComponent(transaction.reference)}`,
    transactionHref: `/transactions/${encodeURIComponent(transaction.reference)}`,
  };
}
