import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../src/domain/model.ts";
import type { Repositories } from "../db/repositories/index.ts";
import type {
  FulfillmentStatus,
  GiftCardEvidenceFacet,
  MarketplacePaymentRecord,
  MarketplaceWallet,
  MockProviderScenario,
  PaymentLifecycleState,
  ProviderAttemptStatus,
  RefundLifecycleStatus,
  ReversalLifecycleStatus,
  TicketEvidenceFacet,
  WalletLedgerEntry,
  WalletLedgerStatus,
  WalletLedgerType,
  WalletStatus,
} from "./types.ts";
import type {
  PaymentProvider,
  ProviderRequestContext,
  ProviderResult,
} from "./providers/contracts.ts";
import { runWalletFunding } from "./providers/payment-provider.ts";
import { stableToken as sharedStableToken } from "../ids.ts";

export const WALLET_FIXED_TIMESTAMP = "2026-01-01T12:00:00.000Z";

/* ── Unchanged: lifecycle tables, canonical mapping, describe ────── */

export const PAYMENT_LIFECYCLE_STATES: readonly PaymentLifecycleState[] = [
  "INITIATED",
  "AUTHORIZED",
  "PENDING",
  "FAILED",
  "SETTLED",
  "REVERSED",
  "REFUND_PENDING",
  "REFUNDED",
];

export type PaymentLifecycleEvent =
  | "INITIATED"
  | "AUTHORIZATION_REQUESTED"
  | "AUTHORIZATION_APPROVED"
  | "AUTHORIZATION_FAILED"
  | "DEBIT_PENDING"
  | "DEBIT_SUCCESS"
  | "DEBIT_FAILED"
  | "SETTLEMENT_PENDING"
  | "SETTLEMENT_MATCHED"
  | "SETTLEMENT_MISMATCH"
  | "REVERSAL_INITIATED"
  | "REVERSAL_COMPLETED"
  | "REFUND_INITIATED"
  | "REFUND_PENDING"
  | "REFUND_COMPLETED";

export const PAYMENT_LIFECYCLE_EDGES: Readonly<
  Record<
    PaymentLifecycleState,
    Readonly<Partial<Record<PaymentLifecycleEvent, PaymentLifecycleState>>>
  >
> = {
  INITIATED: {
    AUTHORIZATION_REQUESTED: "PENDING",
    AUTHORIZATION_FAILED: "FAILED",
    REFUND_INITIATED: "REFUND_PENDING",
  },
  PENDING: {
    AUTHORIZATION_APPROVED: "AUTHORIZED",
    AUTHORIZATION_FAILED: "FAILED",
    DEBIT_SUCCESS: "SETTLED",
    DEBIT_FAILED: "FAILED",
    REFUND_INITIATED: "REFUND_PENDING",
  },
  AUTHORIZED: {
    DEBIT_PENDING: "PENDING",
    DEBIT_SUCCESS: "SETTLED",
    DEBIT_FAILED: "FAILED",
    REVERSAL_INITIATED: "REVERSED",
    REFUND_INITIATED: "REFUND_PENDING",
  },
  SETTLED: {
    REVERSAL_INITIATED: "REVERSED",
    REFUND_INITIATED: "REFUND_PENDING",
  },
  FAILED: { REFUND_INITIATED: "REFUND_PENDING" },
  REVERSED: {},
  REFUND_PENDING: { REFUND_COMPLETED: "REFUNDED" },
  REFUNDED: {},
};

export class InvalidPaymentTransitionError extends Error {
  constructor(current: PaymentLifecycleState, event: PaymentLifecycleEvent) {
    super(`invalid payment lifecycle transition ${current} -> ${event}`);
    this.name = "InvalidPaymentTransitionError";
  }
}

export function advancePaymentLifecycle(
  current: PaymentLifecycleState,
  event: PaymentLifecycleEvent,
): PaymentLifecycleState {
  const next = PAYMENT_LIFECYCLE_EDGES[current][event];
  if (next === undefined)
    throw new InvalidPaymentTransitionError(current, event);
  return next;
}

export function paymentLifecycleToCanonical(
  state: PaymentLifecycleState,
): CanonicalPaymentStatus {
  switch (state) {
    case "SETTLED":
    case "REFUNDED":
      return "SUCCESS";
    case "AUTHORIZED":
    case "PENDING":
    case "INITIATED":
    case "REFUND_PENDING":
      return "PENDING";
    case "FAILED":
      return "FAILED";
    case "REVERSED":
      return "CANCELLED";
  }
}

export function describePaymentLifecycle(state: PaymentLifecycleState): {
  readonly label: string;
  readonly moneyAtRisk: boolean;
} {
  switch (state) {
    case "INITIATED":
      return { label: "Payment initiated", moneyAtRisk: false };
    case "AUTHORIZED":
      return { label: "Payment authorized", moneyAtRisk: true };
    case "PENDING":
      return { label: "Payment pending", moneyAtRisk: true };
    case "FAILED":
      return { label: "Payment failed", moneyAtRisk: false };
    case "SETTLED":
      return { label: "Payment settled", moneyAtRisk: false };
    case "REVERSED":
      return { label: "Payment reversed", moneyAtRisk: false };
    case "REFUND_PENDING":
      return { label: "Refund pending", moneyAtRisk: true };
    case "REFUNDED":
      return { label: "Refunded", moneyAtRisk: false };
  }
}

/* ── Pure: balance derivation, consistency ──────────────────────── */

export interface WalletBalance {
  readonly currency: string;
  readonly availableMinor: number;
  readonly pendingMinor: number;
}

export function deriveWalletBalance(
  walletId: string,
  currency: string,
  entries: readonly WalletLedgerEntry[],
): WalletBalance {
  let availableMinor = 0;
  let pendingMinor = 0;
  for (const entry of entries) {
    if (entry.walletId !== walletId) continue;
    switch (entry.type) {
      case "OPENING_BALANCE":
      case "FUNDING_SUCCESS":
      case "REFUND_COMPLETED":
      case "REVERSAL_COMPLETED":
        availableMinor += entry.amountMinor;
        break;
      case "DEBIT_SUCCESS":
      case "DUPLICATE_DEBIT":
        availableMinor -= entry.amountMinor;
        break;
      case "DEBIT_PENDING":
      case "SETTLEMENT_PENDING":
      case "REFUND_PENDING":
        pendingMinor += entry.amountMinor;
        break;
      default:
        break;
    }
  }
  return { currency, availableMinor, pendingMinor };
}

export interface LedgerConsistencyReport {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly totalEntries: number;
  readonly availableMinor: number;
  readonly duplicateDebitDetected: boolean;
}

export function checkLedgerConsistency(
  walletId: string,
  currency: string,
  entries: readonly WalletLedgerEntry[],
): LedgerConsistencyReport {
  const violations: string[] = [];
  const walletEntries = entries.filter((e) => e.walletId === walletId);
  const seenReferences = new Map<string, WalletLedgerType>();
  let duplicateDebitDetected = false;
  for (const entry of walletEntries) {
    if (entry.amountMinor < 0)
      violations.push(`negative amount on ${entry.id}`);
    const prior = seenReferences.get(entry.reference);
    if (prior !== undefined && prior !== entry.type)
      violations.push(
        `reference collision ${entry.reference} (${prior} vs ${entry.type})`,
      );
    seenReferences.set(entry.reference, entry.type);
    if (
      (entry.type === "DEBIT_SUCCESS" || entry.type === "DUPLICATE_DEBIT") &&
      entry.transactionId !== null
    ) {
      const debits = walletEntries.filter(
        (c) =>
          c.transactionId === entry.transactionId &&
          (c.type === "DEBIT_SUCCESS" || c.type === "DUPLICATE_DEBIT"),
      );
      if (debits.length > 1) duplicateDebitDetected = true;
    }
  }
  const balance = deriveWalletBalance(walletId, currency, walletEntries);
  if (balance.availableMinor < 0)
    violations.push(`negative available balance ${balance.availableMinor}`);
  return {
    consistent: violations.length === 0,
    violations,
    totalEntries: walletEntries.length,
    availableMinor: balance.availableMinor,
    duplicateDebitDetected,
  };
}

/* ── Evidence + outcome types (unchanged) ───────────────────────── */

export interface WalletPaymentEvidence {
  readonly internalTransactionId: string;
  readonly walletReference: string;
  readonly paymentReference: string;
  readonly providerReference: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAt: string;
  readonly paymentState: PaymentLifecycleState;
  readonly providerStatus: CanonicalPaymentStatus | null;
  readonly providerRawStatus: string | null;
  readonly fulfillmentState: FulfillmentStatus;
  readonly reversalState: ReversalLifecycleStatus;
  readonly refundState: RefundLifecycleStatus;
  readonly attemptStatus: ProviderAttemptStatus | null;
  readonly scenario: MockProviderScenario;
  readonly relatedPaymentId: string | null;
  readonly relatedTransactionId: string | null;
  readonly ledgerEntryIds: readonly string[];
  readonly metadata: SourceAttributes;
  readonly ticket?: TicketEvidenceFacet;
  readonly giftCard?: GiftCardEvidenceFacet;
  readonly simulated: true;
}

export interface CreateWalletInput {
  readonly id?: string;
  readonly customerId: string;
  readonly currency: string;
  readonly openingBalanceMinor: number;
  readonly now?: string;
  readonly status?: WalletStatus;
}
export interface CreateWalletOutcome {
  readonly wallet: MarketplaceWallet;
  readonly openingEntry: WalletLedgerEntry;
  readonly balance: WalletBalance;
}
export interface FundWalletInput {
  readonly walletId: string;
  readonly customerId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly scenario: MockProviderScenario;
  readonly now?: string;
  readonly relatedTransactionId?: string;
}
export interface FundWalletOutcome {
  readonly walletId: string;
  readonly transactionId: string;
  readonly scenario: MockProviderScenario;
  readonly lifecycle: PaymentLifecycleState;
  readonly providerResult: ProviderResult;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
  readonly evidence: WalletPaymentEvidence;
  readonly balance: WalletBalance;
}
export interface DebitWalletInput {
  readonly walletId: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly scenario: MockProviderScenario;
  readonly now?: string;
  readonly duplicate?: boolean;
}
export interface DebitWalletOutcome {
  readonly walletId: string;
  readonly transactionId: string;
  readonly scenario: MockProviderScenario;
  readonly lifecycle: PaymentLifecycleState;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
  readonly evidence: WalletPaymentEvidence;
  readonly balance: WalletBalance;
}
export interface ReversalOutcome {
  readonly walletId: string;
  readonly transactionId: string;
  readonly lifecycle: PaymentLifecycleState;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
  readonly evidence: WalletPaymentEvidence;
  readonly balance: WalletBalance;
}
export interface RefundOutcome {
  readonly walletId: string;
  readonly transactionId: string;
  readonly lifecycle: PaymentLifecycleState;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
  readonly evidence: WalletPaymentEvidence;
  readonly balance: WalletBalance;
}
export interface SettlementOutcome {
  readonly walletId: string;
  readonly transactionId: string;
  readonly lifecycle: PaymentLifecycleState;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
  readonly evidence: WalletPaymentEvidence;
  readonly balance: WalletBalance;
}

/* ── Internal helpers (unchanged) ───────────────────────────────── */

function stableToken(v: string): string {
  const c = v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return c === "" ? "ref" : c.slice(0, 40);
}
function walletLedgerReference(
  prefix: string,
  walletId: string,
  transactionId: string | null,
  seq: number,
): string {
  return `${prefix}_${stableToken(walletId)}_${stableToken(transactionId ?? "wallet")}_${seq}`;
}
function buildLedgerEntry(input: {
  readonly walletId: string;
  readonly transactionId: string | null;
  readonly type: WalletLedgerType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: WalletLedgerStatus;
  readonly reference: string;
  readonly occurredAt: string;
  readonly metadata: SourceAttributes;
  readonly seq: number;
}): WalletLedgerEntry {
  return {
    id: `wl_${sharedStableToken(JSON.stringify([input.walletId, input.type, input.reference, input.seq]))}`,
    walletId: input.walletId,
    transactionId: input.transactionId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    status: input.status,
    reference: input.reference,
    occurredAt: input.occurredAt,
    metadata: input.metadata,
    simulated: true,
  };
}
function baseMetadata(input: {
  readonly scenario: MockProviderScenario;
  readonly extra?: Readonly<Record<string, string | null | undefined>>;
}): SourceAttributes {
  const clean = Object.fromEntries(
    Object.entries(input.extra ?? {}).filter(
      (e): e is [string, string] => e[1] !== null && e[1] !== undefined,
    ),
  );
  return { simulated: "true", scenario: input.scenario, ...clean };
}
export function createLedgerEntry(input: {
  readonly walletId: string;
  readonly transactionId?: string | null;
  readonly type: WalletLedgerType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: WalletLedgerStatus;
  readonly reference: string;
  readonly occurredAt: string;
  readonly metadata: SourceAttributes;
  readonly seq: number;
}): WalletLedgerEntry {
  return buildLedgerEntry({
    ...input,
    transactionId: input.transactionId ?? null,
  });
}

/* ── MIGRATED: all wallet↔wallet operations take `repos` ─────────── */

export async function createWallet(
  repos: Repositories,
  input: CreateWalletInput,
): Promise<CreateWalletOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const walletId = input.id ?? `wl_${stableToken(input.customerId)}`;
  const wallet: MarketplaceWallet = {
    id: walletId,
    customerId: input.customerId,
    currency: input.currency,
    openingBalanceMinor: input.openingBalanceMinor,
    status: input.status ?? "ACTIVE",
    simulated: true,
    createdAt: now,
  };
  const openingEntry = buildLedgerEntry({
    walletId,
    transactionId: null,
    type: "OPENING_BALANCE",
    amountMinor: input.openingBalanceMinor,
    currency: input.currency,
    status: "POSTED",
    reference: walletLedgerReference("wl_opening", walletId, null, 1),
    occurredAt: now,
    metadata: baseMetadata({
      scenario: "SUCCESS",
      extra: { reason: "OPENING_BALANCE" },
    }),
    seq: 1,
  });
  await repos.wallets.insert(wallet);
  await repos.walletLedger.insert(openingEntry);
  return {
    wallet,
    openingEntry,
    balance: deriveWalletBalance(walletId, input.currency, [openingEntry]),
  };
}

export async function readWalletById(
  repos: Repositories,
  walletId: string,
): Promise<MarketplaceWallet | null> {
  return repos.wallets.readLatestById(walletId);
}

export async function findWalletByCustomer(
  repos: Repositories,
  customerId: string,
): Promise<MarketplaceWallet | null> {
  return repos.wallets.findByCustomer(customerId);
}

export async function getWalletBalance(
  repos: Repositories,
  walletId: string,
  currency: string,
): Promise<WalletBalance> {
  const entries = await repos.walletLedger.listByWallet(walletId);
  return deriveWalletBalance(walletId, currency, entries);
}

export interface WalletWithBalance {
  readonly wallet: MarketplaceWallet;
  readonly balance: WalletBalance;
  readonly entries: readonly WalletLedgerEntry[];
}

export async function getWallet(
  repos: Repositories,
  customerId: string,
): Promise<WalletWithBalance | null> {
  const wallet = await findWalletByCustomer(repos, customerId);
  if (wallet === null) return null;
  const entries = await repos.walletLedger.listByWallet(wallet.id);
  return {
    wallet,
    balance: deriveWalletBalance(wallet.id, wallet.currency, entries),
    entries,
  };
}

export function buildProviderRequestContext(input: {
  readonly transactionId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly scenario: MockProviderScenario;
  readonly amountMinor: number;
  readonly currency: string;
  readonly now: string;
}): ProviderRequestContext {
  return {
    transactionId: input.transactionId,
    customerId: input.customerId,
    serviceId: input.serviceId,
    providerId: input.providerId,
    providerName: input.providerName,
    requestId: `req_${stableToken(input.transactionId)}`,
    correlationId: `corr_${stableToken(input.transactionId)}`,
    attemptNumber: 1,
    customerReference: `cust_${stableToken(input.customerId)}`,
    idempotencyKey: `idem_${stableToken(input.transactionId)}`,
    requestedAt: input.now,
    scenario: input.scenario,
    amountMinor: input.amountMinor,
    currency: input.currency,
    metadata: { source: "wallet", simulated: "true" },
  };
}

export async function fundWallet(
  repos: Repositories,
  provider: PaymentProvider,
  input: FundWalletInput,
): Promise<FundWalletOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transactionId =
    input.relatedTransactionId ??
    `fund_${stableToken(input.walletId)}_${stableToken(input.scenario)}_${stableToken(now)}`;
  const wallet = await readWalletById(repos, input.walletId);
  if (wallet === null) throw new Error(`wallet not found: ${input.walletId}`);

  const context = buildProviderRequestContext({
    transactionId,
    customerId: input.customerId,
    serviceId: "svc_wallet_funding",
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario: input.scenario,
    amountMinor: input.amountMinor,
    currency: input.currency,
    now,
  });
  const decision = await runWalletFunding(provider, context, {
    paymentIntentId: `pi_${stableToken(transactionId)}`,
    paymentReference: walletLedgerReference(
      "wlf",
      input.walletId,
      transactionId,
      1,
    ),
    authorizationState: "REQUESTED",
    settlementState: input.scenario === "MISMATCH" ? "MISMATCH" : "PENDING",
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  const result = decision.providerResult;
  const walletReference =
    result.sourceAttributes.payment_reference ??
    decision.providerResult.paymentReference;
  const paymentReference = decision.providerResult.paymentReference;
  const entries: WalletLedgerEntry[] = [];
  entries.push(
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId,
      type: "FUNDING_INITIATED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference("wlf", input.walletId, transactionId, 1),
      occurredAt: now,
      metadata: baseMetadata({
        scenario: input.scenario,
        extra: {
          payment_reference: paymentReference,
          wallet_reference: walletReference,
          provider_reference: result.providerReference,
        },
      }),
      seq: 1,
    }),
  );

  let lifecycle: PaymentLifecycleState = "PENDING";
  let fundingEntry: WalletLedgerEntry | null = null;
  if (decision.funded) {
    lifecycle = "SETTLED";
    fundingEntry = buildLedgerEntry({
      walletId: input.walletId,
      transactionId,
      type: "FUNDING_SUCCESS",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "POSTED",
      reference: walletLedgerReference("wlf", input.walletId, transactionId, 2),
      occurredAt: now,
      metadata: baseMetadata({
        scenario: input.scenario,
        extra: {
          payment_reference: paymentReference,
          wallet_reference: walletReference,
          provider_reference: result.providerReference,
          provider_status: result.providerStatus,
          settlement: decision.mismatch ? "MISMATCH" : "MATCHED",
        },
      }),
      seq: 2,
    });
    if (decision.mismatch) {
      entries.push(
        buildLedgerEntry({
          walletId: input.walletId,
          transactionId,
          type: "SETTLEMENT_MISMATCH",
          amountMinor: input.amountMinor,
          currency: input.currency,
          status: "POSTED",
          reference: walletLedgerReference(
            "wls",
            input.walletId,
            transactionId,
            3,
          ),
          occurredAt: now,
          metadata: baseMetadata({
            scenario: input.scenario,
            extra: {
              payment_reference: paymentReference,
              provider_reference: result.providerReference,
              provider_status: result.providerStatus,
              settlement: "MISMATCH",
            },
          }),
          seq: 3,
        }),
      );
    }
  } else if (decision.failed) {
    lifecycle = "FAILED";
    fundingEntry = buildLedgerEntry({
      walletId: input.walletId,
      transactionId,
      type: "FUNDING_FAILED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "FAILED",
      reference: walletLedgerReference("wlf", input.walletId, transactionId, 2),
      occurredAt: now,
      metadata: baseMetadata({
        scenario: input.scenario,
        extra: {
          payment_reference: paymentReference,
          wallet_reference: walletReference,
          provider_reference: result.providerReference,
          provider_status: result.providerStatus,
          reason: "PAYMENT_PROVIDER_FAILED",
        },
      }),
      seq: 2,
    });
  }
  if (decision.pending && !decision.failed && !decision.funded) {
    lifecycle = "PENDING";
    fundingEntry = buildLedgerEntry({
      walletId: input.walletId,
      transactionId,
      type: "FUNDING_INITIATED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference("wlf", input.walletId, transactionId, 2),
      occurredAt: now,
      metadata: baseMetadata({
        scenario: input.scenario,
        extra: {
          payment_reference: paymentReference,
          wallet_reference: walletReference,
          provider_reference: result.providerReference,
          provider_status: result.providerStatus,
        },
      }),
      seq: 2,
    });
  }
  if (fundingEntry !== null) entries.push(fundingEntry);
  for (const entry of entries) await repos.walletLedger.insert(entry);

  const balance = await getWalletBalance(repos, input.walletId, input.currency);
  const evidence: WalletPaymentEvidence = {
    internalTransactionId: transactionId,
    walletReference,
    paymentReference,
    providerReference: result.providerReference,
    amountMinor: input.amountMinor,
    currency: input.currency,
    occurredAt: now,
    paymentState: lifecycle,
    providerStatus: result.canonicalPaymentStatus,
    providerRawStatus: result.providerStatus,
    fulfillmentState: "NOT_STARTED",
    reversalState: "NONE",
    refundState: decision.refundPending
      ? "PENDING"
      : decision.refunded
        ? "COMPLETED"
        : "NONE",
    attemptStatus: result.attemptStatus,
    scenario: input.scenario,
    relatedPaymentId: paymentReference,
    relatedTransactionId: transactionId,
    ledgerEntryIds: entries.map((e) => e.id),
    metadata: baseMetadata({
      scenario: input.scenario,
      extra: {
        provider_reference: result.providerReference,
        provider_status: result.providerStatus,
      },
    }),
    simulated: true,
  };
  return {
    walletId: input.walletId,
    transactionId,
    scenario: input.scenario,
    lifecycle,
    providerResult: result,
    ledgerEntries: entries,
    evidence,
    balance,
  };
}

export async function authorizeDebit(
  repos: Repositories,
  input: {
    readonly walletId: string;
    readonly transactionId: string;
    readonly customerId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly scenario: MockProviderScenario;
    readonly now?: string;
  },
): Promise<{
  readonly walletId: string;
  readonly transactionId: string;
  readonly lifecycle: PaymentLifecycleState;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
  readonly balance: WalletBalance;
}> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const authorized =
    input.scenario !== "FAILED" && input.scenario !== "TIMEOUT";
  const entries: WalletLedgerEntry[] = [
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "AUTHORIZATION_REQUESTED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference(
        "wla",
        input.walletId,
        input.transactionId,
        1,
      ),
      occurredAt: now,
      metadata: baseMetadata({ scenario: input.scenario }),
      seq: 1,
    }),
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: authorized ? "AUTHORIZATION_APPROVED" : "AUTHORIZATION_FAILED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: authorized ? "POSTED" : "FAILED",
      reference: walletLedgerReference(
        "wla",
        input.walletId,
        input.transactionId,
        2,
      ),
      occurredAt: now,
      metadata: baseMetadata({ scenario: input.scenario }),
      seq: 2,
    }),
  ];
  for (const entry of entries) await repos.walletLedger.insert(entry);
  return {
    walletId: input.walletId,
    transactionId: input.transactionId,
    lifecycle: authorized ? "AUTHORIZED" : "FAILED",
    ledgerEntries: entries,
    balance: await getWalletBalance(repos, input.walletId, input.currency),
  };
}

export async function debitWallet(
  repos: Repositories,
  input: DebitWalletInput,
): Promise<DebitWalletOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const entries: WalletLedgerEntry[] = [];
  const insufficient =
    input.scenario !== "FAILED" &&
    (await getWalletBalance(repos, input.walletId, input.currency))
      .availableMinor < input.amountMinor;

  if (input.scenario === "PENDING" || input.scenario === "TIMEOUT") {
    entries.push(
      buildLedgerEntry({
        walletId: input.walletId,
        transactionId: input.transactionId,
        type: "DEBIT_PENDING",
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: "PENDING",
        reference: walletLedgerReference(
          "wld",
          input.walletId,
          input.transactionId,
          1,
        ),
        occurredAt: now,
        metadata: baseMetadata({
          scenario: input.scenario,
          extra: {
            reason:
              input.scenario === "TIMEOUT"
                ? "PROVIDER_TIMEOUT"
                : "DEBIT_PENDING",
          },
        }),
        seq: 1,
      }),
    );
    for (const entry of entries) await repos.walletLedger.insert(entry);
    return {
      walletId: input.walletId,
      transactionId: input.transactionId,
      scenario: input.scenario,
      lifecycle: "PENDING",
      ledgerEntries: entries,
      evidence: walletEvidence({
        input,
        now,
        paymentState: "PENDING",
        providerStatus: null,
        attemptStatus: input.scenario === "TIMEOUT" ? "TIMEOUT" : "PENDING",
        ledgerEntryIds: entries.map((e) => e.id),
        extra: { reason: "DEBIT_PENDING" },
      }),
      balance: await getWalletBalance(repos, input.walletId, input.currency),
    };
  }
  if (input.scenario === "FAILED" || insufficient) {
    entries.push(
      buildLedgerEntry({
        walletId: input.walletId,
        transactionId: input.transactionId,
        type: "DEBIT_FAILED",
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: "FAILED",
        reference: walletLedgerReference(
          "wld",
          input.walletId,
          input.transactionId,
          1,
        ),
        occurredAt: now,
        metadata: baseMetadata({
          scenario: input.scenario,
          extra: {
            reason: insufficient ? "INSUFFICIENT_BALANCE" : "DEBIT_FAILED",
          },
        }),
        seq: 1,
      }),
    );
    for (const entry of entries) await repos.walletLedger.insert(entry);
    return {
      walletId: input.walletId,
      transactionId: input.transactionId,
      scenario: input.scenario,
      lifecycle: "FAILED",
      ledgerEntries: entries,
      evidence: walletEvidence({
        input,
        now,
        paymentState: "FAILED",
        providerStatus: "FAILED",
        attemptStatus: "FAILED",
        ledgerEntryIds: entries.map((e) => e.id),
        extra: {
          reason: insufficient ? "INSUFFICIENT_BALANCE" : "DEBIT_FAILED",
        },
      }),
      balance: await getWalletBalance(repos, input.walletId, input.currency),
    };
  }
  const primary = buildLedgerEntry({
    walletId: input.walletId,
    transactionId: input.transactionId,
    type: "DEBIT_SUCCESS",
    amountMinor: input.amountMinor,
    currency: input.currency,
    status: "POSTED",
    reference: walletLedgerReference(
      "wld",
      input.walletId,
      input.transactionId,
      1,
    ),
    occurredAt: now,
    metadata: baseMetadata({
      scenario: input.scenario,
      extra: {
        payment_reference: walletLedgerReference(
          "wld",
          input.walletId,
          input.transactionId,
          1,
        ),
      },
    }),
    seq: 1,
  });
  entries.push(primary);
  if (input.duplicate === true) {
    entries.push(
      buildLedgerEntry({
        walletId: input.walletId,
        transactionId: input.transactionId,
        type: "DUPLICATE_DEBIT",
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: "POSTED",
        reference: walletLedgerReference(
          "wld",
          input.walletId,
          input.transactionId,
          2,
        ),
        occurredAt: now,
        metadata: baseMetadata({
          scenario: "DUPLICATE",
          extra: { reason: "DUPLICATE_DEBIT", duplicate_of: primary.reference },
        }),
        seq: 2,
      }),
    );
  }
  for (const entry of entries) await repos.walletLedger.insert(entry);
  return {
    walletId: input.walletId,
    transactionId: input.transactionId,
    scenario: input.scenario,
    lifecycle: "SETTLED",
    ledgerEntries: entries,
    evidence: walletEvidence({
      input,
      now,
      paymentState: "SETTLED",
      providerStatus: "SUCCESS",
      attemptStatus: "SUCCESS",
      ledgerEntryIds: entries.map((e) => e.id),
      extra: { payment_reference: primary.reference },
    }),
    balance: await getWalletBalance(repos, input.walletId, input.currency),
  };
}

export async function reverseDebit(
  repos: Repositories,
  input: {
    readonly walletId: string;
    readonly transactionId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly reason?: string;
    readonly now?: string;
    readonly scenario?: MockProviderScenario;
  },
): Promise<ReversalOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const scenario = input.scenario ?? "REVERSED";
  const entries: WalletLedgerEntry[] = [
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "REVERSAL_INITIATED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference(
        "wlr",
        input.walletId,
        input.transactionId,
        1,
      ),
      occurredAt: now,
      metadata: baseMetadata({
        scenario,
        extra: { reason: input.reason ?? "REVERSAL_REQUESTED" },
      }),
      seq: 1,
    }),
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "REVERSAL_COMPLETED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "POSTED",
      reference: walletLedgerReference(
        "wlr",
        input.walletId,
        input.transactionId,
        2,
      ),
      occurredAt: now,
      metadata: baseMetadata({
        scenario,
        extra: { reason: input.reason ?? "REVERSAL_COMPLETED" },
      }),
      seq: 2,
    }),
  ];
  for (const entry of entries) await repos.walletLedger.insert(entry);
  return {
    walletId: input.walletId,
    transactionId: input.transactionId,
    lifecycle: "REVERSED",
    ledgerEntries: entries,
    evidence: walletEvidence({
      input: { ...input, customerId: "" },
      now,
      paymentState: "REVERSED",
      providerStatus: "CANCELLED",
      attemptStatus: "SUCCESS",
      ledgerEntryIds: entries.map((e) => e.id),
      extra: { reason: input.reason ?? "REVERSAL_COMPLETED" },
    }),
    balance: await getWalletBalance(repos, input.walletId, input.currency),
  };
}

export async function initiateRefund(
  repos: Repositories,
  input: {
    readonly walletId: string;
    readonly transactionId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly reason?: string;
    readonly now?: string;
    readonly scenario?: MockProviderScenario;
  },
): Promise<RefundOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const scenario = input.scenario ?? "REFUND_PENDING";
  const entries: WalletLedgerEntry[] = [
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "REFUND_INITIATED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference(
        "wlrf",
        input.walletId,
        input.transactionId,
        1,
      ),
      occurredAt: now,
      metadata: baseMetadata({
        scenario,
        extra: { reason: input.reason ?? "REFUND_REQUESTED" },
      }),
      seq: 1,
    }),
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "REFUND_PENDING",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference(
        "wlrf",
        input.walletId,
        input.transactionId,
        2,
      ),
      occurredAt: now,
      metadata: baseMetadata({
        scenario,
        extra: { reason: input.reason ?? "REFUND_PENDING" },
      }),
      seq: 2,
    }),
  ];
  for (const entry of entries) await repos.walletLedger.insert(entry);
  return {
    walletId: input.walletId,
    transactionId: input.transactionId,
    lifecycle: "REFUND_PENDING",
    ledgerEntries: entries,
    evidence: walletEvidence({
      input: { ...input, customerId: "" },
      now,
      paymentState: "REFUND_PENDING",
      providerStatus: "PENDING",
      attemptStatus: "PENDING",
      ledgerEntryIds: entries.map((e) => e.id),
      extra: { reason: input.reason ?? "REFUND_INITIATED" },
    }),
    balance: await getWalletBalance(repos, input.walletId, input.currency),
  };
}

export async function completeRefund(
  repos: Repositories,
  input: {
    readonly walletId: string;
    readonly transactionId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly reason?: string;
    readonly now?: string;
  },
): Promise<RefundOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const entries: WalletLedgerEntry[] = [
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "REFUND_COMPLETED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "POSTED",
      reference: walletLedgerReference(
        "wlrf",
        input.walletId,
        input.transactionId,
        3,
      ),
      occurredAt: now,
      metadata: baseMetadata({
        scenario: "REFUND_COMPLETED",
        extra: { reason: input.reason ?? "REFUND_COMPLETED" },
      }),
      seq: 3,
    }),
  ];
  for (const entry of entries) await repos.walletLedger.insert(entry);
  return {
    walletId: input.walletId,
    transactionId: input.transactionId,
    lifecycle: "REFUNDED",
    ledgerEntries: entries,
    evidence: walletEvidence({
      input: { ...input, customerId: "" },
      now,
      paymentState: "REFUNDED",
      providerStatus: "SUCCESS",
      attemptStatus: "SUCCESS",
      ledgerEntryIds: entries.map((e) => e.id),
      extra: { reason: input.reason ?? "REFUND_COMPLETED" },
    }),
    balance: await getWalletBalance(repos, input.walletId, input.currency),
  };
}

export async function settlePayment(
  repos: Repositories,
  input: {
    readonly walletId: string;
    readonly transactionId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly match: boolean;
    readonly now?: string;
    readonly scenario?: MockProviderScenario;
  },
): Promise<SettlementOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const scenario = input.scenario ?? (input.match ? "SUCCESS" : "MISMATCH");
  const entries: WalletLedgerEntry[] = [
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: "SETTLEMENT_PENDING",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "PENDING",
      reference: walletLedgerReference(
        "wls",
        input.walletId,
        input.transactionId,
        1,
      ),
      occurredAt: now,
      metadata: baseMetadata({ scenario }),
      seq: 1,
    }),
    buildLedgerEntry({
      walletId: input.walletId,
      transactionId: input.transactionId,
      type: input.match ? "SETTLEMENT_MATCHED" : "SETTLEMENT_MISMATCH",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "POSTED",
      reference: walletLedgerReference(
        "wls",
        input.walletId,
        input.transactionId,
        2,
      ),
      occurredAt: now,
      metadata: baseMetadata({
        scenario,
        extra: { settlement: input.match ? "MATCHED" : "MISMATCH" },
      }),
      seq: 2,
    }),
  ];
  for (const entry of entries) await repos.walletLedger.insert(entry);
  return {
    walletId: input.walletId,
    transactionId: input.transactionId,
    lifecycle: "SETTLED",
    ledgerEntries: entries,
    evidence: walletEvidence({
      input: { ...input, customerId: "" },
      now,
      paymentState: "SETTLED",
      providerStatus: input.match ? "SUCCESS" : "UNKNOWN",
      attemptStatus: input.match ? "SUCCESS" : "MISMATCH",
      ledgerEntryIds: entries.map((e) => e.id),
      extra: { settlement: input.match ? "MATCHED" : "MISMATCH" },
    }),
    balance: await getWalletBalance(repos, input.walletId, input.currency),
  };
}

function walletEvidence(input: {
  readonly input: {
    readonly walletId: string;
    readonly transactionId: string;
    readonly customerId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly scenario?: MockProviderScenario;
  };
  readonly now: string;
  readonly paymentState: PaymentLifecycleState;
  readonly providerStatus: CanonicalPaymentStatus | null;
  readonly attemptStatus: ProviderAttemptStatus | null;
  readonly ledgerEntryIds: readonly string[];
  readonly extra?: Readonly<Record<string, string>>;
}): WalletPaymentEvidence {
  const scenario = input.input.scenario ?? "SUCCESS";
  return {
    internalTransactionId: input.input.transactionId,
    walletReference: `wld_${stableToken(input.input.walletId)}`,
    paymentReference: `wld_${stableToken(input.input.walletId)}_${stableToken(input.input.transactionId)}`,
    providerReference: null,
    amountMinor: input.input.amountMinor,
    currency: input.input.currency,
    occurredAt: input.now,
    paymentState: input.paymentState,
    providerStatus: input.providerStatus,
    providerRawStatus: null,
    fulfillmentState: "NOT_STARTED",
    reversalState: input.paymentState === "REVERSED" ? "COMPLETED" : "NONE",
    refundState:
      input.paymentState === "REFUND_PENDING"
        ? "PENDING"
        : input.paymentState === "REFUNDED"
          ? "COMPLETED"
          : "NONE",
    attemptStatus: input.attemptStatus,
    scenario,
    relatedPaymentId: null,
    relatedTransactionId: input.input.transactionId,
    ledgerEntryIds: input.ledgerEntryIds,
    metadata: baseMetadata({ scenario, extra: input.extra }),
    simulated: true,
  };
}

export function toWalletPaymentRecord(
  evidence: WalletPaymentEvidence,
  orderId: string | null = null,
): MarketplacePaymentRecord {
  return {
    id: `mkpay_${stableToken(evidence.internalTransactionId)}`,
    transactionId: evidence.internalTransactionId,
    orderId: orderId ?? evidence.internalTransactionId,
    customerId: "",
    walletReference: evidence.walletReference,
    providerReference: evidence.providerReference,
    expectedAmountMinor: evidence.amountMinor,
    actualAmountMinor:
      evidence.providerStatus === "SUCCESS" ? evidence.amountMinor : null,
    currency: evidence.currency,
    status: paymentLifecycleToCanonical(evidence.paymentState),
    paidAt:
      evidence.paymentState === "SETTLED" ||
      evidence.paymentState === "REFUNDED"
        ? evidence.occurredAt
        : null,
    metadata: evidence.metadata,
    recordedAt: evidence.occurredAt,
    simulated: true,
  };
}
