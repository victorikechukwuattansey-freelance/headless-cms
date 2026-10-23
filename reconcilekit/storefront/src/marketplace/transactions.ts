import type {
  CanonicalPaymentStatus,
  ReconciliationCode,
  SourceAttributes,
} from "../../../src/domain/model.ts";
import type { Repositories } from "../db/repositories/index.ts";
import {
  buildCorrelationId,
  buildCustomerReference,
  buildInputsKey,
  buildMarketplaceSeed,
  buildOrderId,
  buildProviderAttemptId,
  buildRequestId,
  buildStableSuffix,
  buildTransactionId,
  buildTransactionReference,
} from "../ids.ts";
import {
  buildGiftCardArtifact,
  buildTicketArtifact,
  decorateEvidence,
} from "./artifacts.ts";
import { WALLET_FIXED_TIMESTAMP } from "./wallet.ts";
import {
  completeRefund,
  createWallet,
  debitWallet,
  initiateRefund,
  readWalletById,
  reverseDebit,
  toWalletPaymentRecord,
  type WalletPaymentEvidence,
} from "./wallet.ts";
import {
  assertCheckoutEligible,
  buildDemoCatalog,
  findServiceById,
  productsInService,
  quoteForProduct,
} from "./catalog.ts";
import type {
  MarketplaceProviderRegistry,
  RegisteredProvider,
} from "./providers/registry.ts";
import type {
  GiftCardProviderResult,
  ProviderAdapter,
  ProviderRequestContext,
  ProviderResult,
  TicketAvailability,
  TicketProviderResult,
} from "./providers/contracts.ts";
import {
  appendTransactionEvent,
  listTransactionEvents,
  sourceAttributes,
  TransactionEventType,
} from "./timeline.ts";
import type {
  AdminTransactionStatus,
  CustomerTransactionStatus,
  FulfillmentStatus,
  GiftCardArtifact,
  MarketplaceCatalog,
  MarketplaceOrder,
  MarketplaceOrderStatus,
  MarketplacePaymentRecord,
  MarketplaceService,
  MarketplaceServiceKind,
  MarketplaceTransaction,
  MockProviderScenario,
  ProviderAttempt,
  ResolutionStatus,
  ServiceInputDescriptor,
  TicketArtifact,
  TransactionEvent,
} from "./types.ts";

export interface MarketplaceTransactionDeps {
  readonly repos: Repositories;
  readonly registry: MarketplaceProviderRegistry;
  readonly catalog: MarketplaceCatalog;
}

export interface ExecuteTransactionInput {
  readonly customerId: string;
  readonly serviceId: string;
  readonly scenario: MockProviderScenario;
  readonly inputs: Readonly<Record<string, string>>;
  readonly walletId?: string;
  readonly openingBalanceMinor?: number;
  readonly now?: string;
}

export interface TransactionReconciliationFacts {
  readonly transactionId: string;
  readonly orderId: string;
  readonly customerReference: string;
  readonly providerId: string;
  readonly serviceId: string;
  readonly serviceKind: MarketplaceServiceKind;
  readonly scenario: MockProviderScenario;
  readonly expectedAmountMinor: number;
  readonly paymentAmountMinor: number | null;
  readonly providerAmountMinor: number | null;
  readonly currency: string;
  readonly paymentState: CanonicalPaymentStatus;
  readonly providerState: CanonicalPaymentStatus | null;
  readonly fulfillmentState: FulfillmentStatus;
  readonly providerReference: string | null;
  readonly requestedAt: string;
  readonly respondedAt: string | null;
  readonly providerAttemptHistory: readonly ProviderAttempt[];
  readonly evidenceLedgerEntryIds: readonly string[];
  readonly reversal: {
    readonly status: "NONE" | "INITIATED" | "COMPLETED" | "FAILED_REVIEW";
  };
  readonly refund: {
    readonly status:
      "NONE" | "INITIATED" | "PENDING" | "COMPLETED" | "FAILED_REVIEW";
  };
  readonly flags: readonly ReconciliationCode[];
  readonly simulated: true;
}

export interface ExecuteTransactionResult {
  readonly transaction: MarketplaceTransaction;
  readonly order: MarketplaceOrder;
  readonly payment: MarketplacePaymentRecord | null;
  readonly evidence: WalletPaymentEvidence | null;
  readonly providerResult: ProviderResult | null;
  readonly providerAttempts: readonly ProviderAttempt[];
  readonly events: readonly TransactionEvent[];
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
  readonly facts: TransactionReconciliationFacts | null;
  readonly replayed: boolean;
}

export class OrchestrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OrchestrationError";
  }
}

export class TransactionInputError extends OrchestrationError {
  constructor(message: string) {
    super(message);
    this.name = "TransactionInputError";
  }
}

export type ServiceInputValidationCode =
  | "MISSING_REQUIRED"
  | "INVALID_SELECT"
  | "INVALID_NUMBER"
  | "INVALID_PHONE"
  | "INVALID_EMAIL"
  | "INVALID_DATE";

/**
 * Deterministic checkout-time failure for a malformed or incomplete service
 * input payload. Thrown before any money-affecting or provider-affecting work
 * begins, so a bad payload can never reach the wallet, payment, or provider.
 */
export class ServiceInputValidationError extends OrchestrationError {
  readonly field: string;
  readonly code: ServiceInputValidationCode;

  constructor(options: {
    readonly field: string;
    readonly code: ServiceInputValidationCode;
    readonly detail: string;
  }) {
    super(`${options.field}: ${options.detail}`);
    this.name = "ServiceInputValidationError";
    this.field = options.field;
    this.code = options.code;
  }
}

/**
 * Generic, declarative input validation driven entirely by the service's
 * inputSchema. No bespoke per-service validators: every rule (required,
 * SELECT membership, and type checks) is derived from the schema descriptors.
 * Errors are collected in schema order so the first rejected field is always
 * deterministic.
 */
export function validateServiceInputs(
  schema: readonly ServiceInputDescriptor[],
  inputs: Readonly<Record<string, string>>,
): readonly ServiceInputValidationError[] {
  const errors: ServiceInputValidationError[] = [];
  for (const descriptor of schema) {
    const value = inputs[descriptor.name];
    const present =
      value !== undefined && value.trim() !== "" ? value.trim() : null;

    if (present === null) {
      if (descriptor.required) {
        errors.push(
          new ServiceInputValidationError({
            field: descriptor.name,
            code: "MISSING_REQUIRED",
            detail: `${descriptor.label} is required`,
          }),
        );
      }
      continue;
    }

    if (descriptor.type === "SELECT" && descriptor.options !== undefined) {
      if (!descriptor.options.includes(present)) {
        errors.push(
          new ServiceInputValidationError({
            field: descriptor.name,
            code: "INVALID_SELECT",
            detail: `must be one of: ${descriptor.options.join(", ")}`,
          }),
        );
      }
      continue;
    }

    switch (descriptor.type) {
      case "NUMBER":
        if (!/^\d+$/.test(present)) {
          errors.push(
            new ServiceInputValidationError({
              field: descriptor.name,
              code: "INVALID_NUMBER",
              detail: "must be a non-negative integer",
            }),
          );
        }
        break;
      case "PHONE": {
        const digits = present.replace(/[\s-]/g, "");
        if (!/^\+?\d{7,15}$/.test(digits)) {
          errors.push(
            new ServiceInputValidationError({
              field: descriptor.name,
              code: "INVALID_PHONE",
              detail: "must be a valid phone number",
            }),
          );
        }
        break;
      }
      case "EMAIL":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(present)) {
          errors.push(
            new ServiceInputValidationError({
              field: descriptor.name,
              code: "INVALID_EMAIL",
              detail: "must be a valid email address",
            }),
          );
        }
        break;
      case "DATE":
        if (
          !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/.test(
            present,
          ) ||
          Number.isNaN(Date.parse(present))
        ) {
          errors.push(
            new ServiceInputValidationError({
              field: descriptor.name,
              code: "INVALID_DATE",
              detail: "must be a valid ISO-8601 date",
            }),
          );
        }
        break;
      default:
        break;
    }
  }
  return errors;
}

interface DerivedState {
  readonly paymentStatus: CanonicalPaymentStatus;
  readonly fulfillmentStatus: FulfillmentStatus;
  readonly resolutionStatus: ResolutionStatus;
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
  readonly orderStatus: MarketplaceOrderStatus;
}

/**
 * One documented, deterministic semantics table: the mutually-exclusive
 * payment accept/decline is decoupled from the provider outcome. A scenario
 * of FAILED means the provider declined AFTER funds were captured — the
 * canonical "success payment + provider failure, resolvable" case. The only
 * way a payment itself fails end-to-end is a declined wallet debit (e.g.
 * insufficient balance), which stops the flow before any provider call.
 */
export function paymentScenarioForService(
  serviceScenario: MockProviderScenario,
): MockProviderScenario {
  switch (serviceScenario) {
    case "PENDING":
    case "TIMEOUT":
      return serviceScenario;
    default:
      return "SUCCESS";
  }
}

export function deriveTransactionState(input: {
  readonly scenario: MockProviderScenario;
  readonly paymentStatus: CanonicalPaymentStatus;
}): DerivedState {
  switch (input.scenario) {
    case "SUCCESS":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "FULFILLED",
        resolutionStatus: "NONE",
        customerStatus: "CONFIRMED",
        adminStatus: "HEALTHY",
        orderStatus: "COMPLETED",
      };
    case "FAILED":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "FAILED",
        resolutionStatus: "NONE",
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "PROVIDER_FAILED",
        orderStatus: "FAILED",
      };
    case "PENDING":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "PENDING",
        resolutionStatus: "NONE",
        customerStatus: "PENDING",
        adminStatus: "PENDING_PROVIDER",
        orderStatus: "PROVIDER_PENDING",
      };
    case "TIMEOUT":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "PENDING",
        resolutionStatus: "NONE",
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "UNRESOLVED",
        orderStatus: "MANUAL_REVIEW",
      };
    case "DUPLICATE":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "FULFILLED",
        resolutionStatus: "NONE",
        customerStatus: "CONFIRMED",
        adminStatus: "DUPLICATE",
        orderStatus: "COMPLETED",
      };
    case "PARTIAL_SUCCESS":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "PARTIAL",
        resolutionStatus: "NONE",
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "UNRESOLVED",
        orderStatus: "MANUAL_REVIEW",
      };
    case "REVERSED":
      return {
        paymentStatus: "CANCELLED",
        fulfillmentStatus: "CANCELLED",
        resolutionStatus: "REVERSED",
        customerStatus: "REVERSED",
        adminStatus: "REVERSAL_QUEUE",
        orderStatus: "CANCELLED",
      };
    case "REFUND_PENDING":
      return {
        paymentStatus: "PENDING",
        fulfillmentStatus: "PENDING",
        resolutionStatus: "REFUND_PENDING",
        customerStatus: "REFUND_PENDING",
        adminStatus: "REFUND_QUEUE",
        orderStatus: "PROVIDER_PENDING",
      };
    case "REFUND_COMPLETED":
      return {
        paymentStatus: "SUCCESS",
        fulfillmentStatus: "CANCELLED",
        resolutionStatus: "REFUNDED",
        customerStatus: "REFUNDED",
        adminStatus: "HEALTHY",
        orderStatus: "CANCELLED",
      };
    case "MISMATCH":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "PENDING",
        resolutionStatus: "NONE",
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "MISMATCH",
        orderStatus: "MANUAL_REVIEW",
      };
    case "UNKNOWN":
      return {
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: "PENDING",
        resolutionStatus: "NONE",
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "MANUAL_REVIEW",
        orderStatus: "MANUAL_REVIEW",
      };
  }
}

function paymentFailureState(): DerivedState {
  return {
    paymentStatus: "FAILED",
    fulfillmentStatus: "NOT_STARTED",
    resolutionStatus: "NONE",
    customerStatus: "FAILED",
    adminStatus: "HEALTHY",
    orderStatus: "FAILED",
  };
}

export async function executeMarketplaceTransaction(
  deps: MarketplaceTransactionDeps,
  input: ExecuteTransactionInput,
): Promise<ExecuteTransactionResult> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const service = findServiceById(deps.catalog, input.serviceId);
  if (!service) {
    throw new TransactionInputError(`unknown service ${input.serviceId}`);
  }
  assertCheckoutEligible(service);

  const validationErrors = validateServiceInputs(
    service.inputSchema,
    input.inputs,
  );
  if (validationErrors.length > 0) {
    throw validationErrors[0];
  }

  const inputsKey = buildInputsKey(input.inputs);
  const seed = buildMarketplaceSeed({
    customerId: input.customerId,
    serviceId: input.serviceId,
    scenario: input.scenario,
    inputsKey,
  });
  const transactionId = buildTransactionId(seed);
  const reference = buildTransactionReference(seed);
  const orderId = buildOrderId(seed);

  const existing =
    await deps.repos.marketplaceTransactions.readLatestById(transactionId);
  if (existing !== null) {
    return replayResult(deps.repos, existing, orderId, transactionId);
  }

  const quote = quoteService(deps.catalog, service);
  const customerReference = buildCustomerReference(input.customerId);
  const createdOrder = await insertOrder(deps.repos, {
    id: orderId,
    customerId: input.customerId,
    serviceId: service.id,
    inputs: input.inputs,
    quotedAmountMinor: quote.expectedCheckoutMinor,
    currency: quote.currency,
    customerReference,
    now,
  });

  const initial = buildTransactionRecord({
    transactionId,
    orderId,
    customerId: input.customerId,
    service,
    reference,
    scenario: input.scenario,
    paymentStatus: "PENDING",
    fulfillmentStatus: "NOT_STARTED",
    resolutionStatus: "NONE",
    customerStatus: "PENDING",
    adminStatus: "PENDING_PROVIDER",
    orderStatus: "CREATED",
    now,
  });
  await deps.repos.marketplaceTransactions.insert(initial);

  const queued: TransactionEvent[] = [];
  queued.push(
    await appendTransactionEvent(deps.repos, {
      transactionId,
      type: TransactionEventType.OrderCreated,
      label: "Order created",
      description: `Order ${orderId} created for service ${service.id}.`,
      actor: "SYSTEM",
      source: "MARKETPLACE",
      metadata: sourceAttributes({
        order_id: orderId,
        customer_id: input.customerId,
        service_id: service.id,
        scenario: input.scenario,
      }),
      occurredAt: now,
    }),
  );
  queued.push(
    await appendTransactionEvent(deps.repos, {
      transactionId,
      type: TransactionEventType.QuoteRecorded,
      label: "Price quote recorded",
      description: `Checked-out amount ${quote.expectedCheckoutMinor} ${quote.currency} (${quote.source}).`,
      actor: "SYSTEM",
      source: "MARKETPLACE",
      metadata: sourceAttributes({
        expected_amount_minor: String(quote.expectedCheckoutMinor),
        currency: quote.currency,
        quote_source: quote.source,
        product_id: quote.productId,
      }),
      occurredAt: now,
    }),
  );

  const walletId = await resolveWallet(deps.repos, {
    customerId: input.customerId,
    currency: quote.currency,
    walletId: input.walletId,
    openingBalanceMinor: input.openingBalanceMinor,
    now,
  });

  return runPaymentAndFulfillment({
    deps,
    service,
    sourceInput: input,
    quote,
    transactionId,
    reference,
    orderId,
    customerReference,
    now,
    queued,
    seed,
    walletId,
  });
}

interface Quote {
  readonly expectedCheckoutMinor: number;
  readonly currency: string;
  readonly source: "PRODUCT" | "SERVICE_BASE";
  readonly productId: string | null;
}

export function quoteService(
  catalog: MarketplaceCatalog,
  service: MarketplaceService,
): Quote {
  const inventory = productsInService(catalog, service.id).filter(
    (product) => product.availability !== "SOLD_OUT",
  );
  const product = inventory[0];
  if (product) {
    return {
      expectedCheckoutMinor: quoteForProduct(product).expectedCheckoutMinor,
      currency: quoteForProduct(product).currency,
      source: "PRODUCT",
      productId: product.id,
    };
  }
  return {
    expectedCheckoutMinor: service.baseAmountMinor,
    currency: service.currency,
    source: "SERVICE_BASE",
    productId: null,
  };
}

async function runPaymentAndFulfillment(input: {
  readonly deps: MarketplaceTransactionDeps;
  readonly service: MarketplaceService;
  readonly sourceInput: ExecuteTransactionInput;
  readonly quote: Quote;
  readonly transactionId: string;
  readonly reference: string;
  readonly orderId: string;
  readonly customerReference: string;
  readonly now: string;
  readonly queued: readonly TransactionEvent[];
  readonly seed: string;
  readonly walletId: string;
}): Promise<ExecuteTransactionResult> {
  const {
    deps,
    service,
    sourceInput,
    quote,
    transactionId,
    reference,
    orderId,
    customerReference,
    now,
    queued,
    seed,
    walletId,
  } = input;
  const events = [...queued];

  const paymentScenario = paymentScenarioForService(sourceInput.scenario);
  events.push(
    await appendTransactionEvent(deps.repos, {
      transactionId,
      type: TransactionEventType.PaymentInitiated,
      label: "Payment initiated",
      description: `Wallet debit initiated for ${quote.expectedCheckoutMinor} ${quote.currency}.`,
      actor: "SYSTEM",
      source: "WALLET",
      metadata: sourceAttributes({
        wallet_id: walletId,
        amount_minor: String(quote.expectedCheckoutMinor),
        currency: quote.currency,
        scenario: paymentScenario,
      }),
      occurredAt: now,
    }),
  );

  const debit = await debitWallet(deps.repos, {
    walletId,
    transactionId,
    customerId: sourceInput.customerId,
    serviceId: service.id,
    amountMinor: quote.expectedCheckoutMinor,
    currency: quote.currency,
    scenario: paymentScenario,
    now,
  });

  const paymentRecord = {
    ...toWalletPaymentRecord(debit.evidence, orderId),
    customerId: sourceInput.customerId,
  };
  await deps.repos.marketplacePayments.insert(paymentRecord);

  if (debit.lifecycle === "FAILED") {
    const state = paymentFailureState();
    events.push(
      await appendTransactionEvent(deps.repos, {
        transactionId,
        type: TransactionEventType.PaymentFailed,
        label: "Payment failed",
        description: "Wallet debit declined; provider was not invoked.",
        actor: "SYSTEM",
        source: "WALLET",
        metadata: sourceAttributes({
          wallet_id: walletId,
          amount_minor: String(quote.expectedCheckoutMinor),
          reason: "WALLET_DECLINED",
        }),
        occurredAt: now,
      }),
    );
    events.push(
      await appendTransactionEvent(deps.repos, {
        transactionId,
        type: TransactionEventType.TransactionFailed,
        label: "Transaction failed",
        description: "No funds were moved and no fulfillment was attempted.",
        actor: "SYSTEM",
        source: "MARKETPLACE",
        metadata: { simulated: "true", scenario: sourceInput.scenario },
        occurredAt: now,
      }),
    );
    const finalTx = await persistTransaction(deps.repos, {
      transactionId,
      orderId,
      customerId: sourceInput.customerId,
      service,
      reference,
      scenario: sourceInput.scenario,
      state,
      now,
    });
    await persistOrderStatus(deps.repos, orderId, state.orderStatus, now);
    return finishResult({
      repos: deps.repos,
      transaction: finalTx,
      service,
      scenario: sourceInput.scenario,
      quote,
      debitEvidence: debit.evidence,
      paymentRecord,
      attempts: [],
      artifacts: [],
      events,
      requestedAt: now,
      respondedAt: null,
      customerReference,
      providerReference: null,
      providerResult: null,
      replayed: false,
    });
  }

  if (debit.lifecycle === "PENDING") {
    events.push(
      await appendTransactionEvent(deps.repos, {
        transactionId,
        type: TransactionEventType.PaymentPending,
        label: "Payment pending",
        description:
          "Wallet funds are held pending while the provider is reached.",
        actor: "SYSTEM",
        source: "WALLET",
        metadata: sourceAttributes({
          wallet_id: walletId,
          amount_minor: String(quote.expectedCheckoutMinor),
        }),
        occurredAt: now,
      }),
    );
  } else {
    events.push(
      await appendTransactionEvent(deps.repos, {
        transactionId,
        type: TransactionEventType.PaymentAuthorized,
        label: "Payment authorized",
        description: `Wallet debit settled for ${quote.expectedCheckoutMinor} ${quote.currency}.`,
        actor: "SYSTEM",
        source: "WALLET",
        metadata: sourceAttributes({
          wallet_id: walletId,
          amount_minor: String(quote.expectedCheckoutMinor),
        }),
        occurredAt: now,
      }),
    );
  }

  const provider = deps.registry.providerForServiceKind(service.kind);
  events.push(
    await appendTransactionEvent(deps.repos, {
      transactionId,
      type: TransactionEventType.ProviderRequestSent,
      label: "Provider request sent",
      description: `Request sent to ${provider.providerName} (${service.kind}).`,
      actor: "SYSTEM",
      source: "PROVIDER",
      metadata: sourceAttributes({
        provider_id: provider.providerId,
        provider_name: provider.providerName,
        service_kind: service.kind,
      }),
      occurredAt: now,
    }),
  );

  const providerRun = await runProvider({
    deps,
    service,
    sourceInput,
    quote,
    provider,
    transactionId,
    reference,
    orderId,
    customerReference,
    now,
    events,
    seed,
    walletId,
    debitEvidence: debit.evidence,
    paymentRecord,
  });
  return providerRun;
}

async function runProvider(run: {
  readonly deps: MarketplaceTransactionDeps;
  readonly service: MarketplaceService;
  readonly sourceInput: ExecuteTransactionInput;
  readonly quote: Quote;
  readonly provider: RegisteredProvider;
  readonly transactionId: string;
  readonly reference: string;
  readonly orderId: string;
  readonly customerReference: string;
  readonly now: string;
  readonly events: readonly TransactionEvent[];
  readonly seed: string;
  readonly walletId: string;
  readonly debitEvidence: WalletPaymentEvidence;
  readonly paymentRecord: MarketplacePaymentRecord;
}): Promise<ExecuteTransactionResult> {
  const {
    service,
    sourceInput,
    quote,
    provider,
    transactionId,
    reference,
    orderId,
    customerReference,
    now,
    events,
    walletId,
    debitEvidence,
    paymentRecord,
  } = run;
  const scenario = sourceInput.scenario;
  const kind = service.kind;

  if (isTicketingKind(kind)) {
    return runTicketingFlow(run);
  }
  if (isGiftCardKind(kind)) {
    return runGiftCardFlow(run);
  }

  const context = buildServiceContext({
    transactionId,
    customerId: sourceInput.customerId,
    service,
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario,
    inputs: sourceInput.inputs,
    amountMinor: quote.expectedCheckoutMinor,
    currency: quote.currency,
    now,
    attemptNumber: 1,
  });
  const executor = provider as unknown as ProviderAdapter<{
    readonly amountMinor?: number;
    readonly currency?: string;
  }>;
  const request = buildServiceRequest(kind, service, quote, sourceInput.inputs);
  const result = await executor.execute(context, request);
  const attempt = await recordProviderAttempt(run.deps.repos, {
    transactionId,
    providerId: provider.providerId,
    serviceId: service.id,
    scenario,
    requestReference: context.requestId,
    result,
  });

  const allEvents = [
    ...events,
    await appendTransactionEvent(run.deps.repos, {
      transactionId,
      type: TransactionEventType.ProviderResponseReceived,
      label: "Provider response received",
      description: `${provider.providerName} returned ${result.providerStatus}.`,
      actor: "MOCK_PROVIDER",
      source: "PROVIDER",
      metadata: sourceAttributes({
        provider_status: result.providerStatus,
        provider_status_code: result.providerStatusCode,
        provider_reference: result.providerReference,
        attempt_id: attempt.id,
        provider_amount_minor:
          result.amountMinor !== null ? String(result.amountMinor) : null,
      }),
      occurredAt: now,
    }),
  ];

  const extras = await appendScenarioEvents(run.deps.repos, {
    transactionId,
    scenario,
    result,
    attempt,
    allEvents,
    now,
  });

  const withResolution = await applyResolutionToEvents(run.deps.repos, {
    transactionId,
    scenario,
    result,
    walletId,
    quote,
    events: extras.events,
    now,
  });

  const terminal = await finalizeTransaction(run.deps.repos, {
    transactionId,
    orderId,
    customerId: sourceInput.customerId,
    service,
    reference,
    scenario,
    debitEvidence,
    allEvents: withResolution.events,
    attempts: [attempt],
    artifacts: withResolution.artifacts,
    now,
  });

  return finishResult({
    repos: run.deps.repos,
    transaction: terminal.transaction,
    service,
    scenario,
    quote,
    debitEvidence,
    paymentRecord,
    attempts: terminal.attempts,
    artifacts: terminal.artifacts,
    events: terminal.events,
    requestedAt: result.requestTimestamp,
    respondedAt: result.responseTimestamp,
    customerReference,
    providerReference: result.providerReference,
    providerResult: result,
    replayed: false,
  });
}

async function runGiftCardFlow(run: {
  readonly deps: MarketplaceTransactionDeps;
  readonly service: MarketplaceService;
  readonly sourceInput: ExecuteTransactionInput;
  readonly quote: Quote;
  readonly provider: RegisteredProvider;
  readonly transactionId: string;
  readonly reference: string;
  readonly orderId: string;
  readonly customerReference: string;
  readonly now: string;
  readonly events: readonly TransactionEvent[];
  readonly seed: string;
  readonly walletId: string;
  readonly debitEvidence: WalletPaymentEvidence;
  readonly paymentRecord: MarketplacePaymentRecord;
}): Promise<ExecuteTransactionResult> {
  const {
    service,
    sourceInput,
    quote,
    provider,
    transactionId,
    reference,
    orderId,
    customerReference,
    now,
    events,
    walletId,
    debitEvidence,
    paymentRecord,
  } = run;
  const scenario = sourceInput.scenario;
  const context = buildServiceContext({
    transactionId,
    customerId: sourceInput.customerId,
    service,
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario,
    inputs: sourceInput.inputs,
    amountMinor: quote.expectedCheckoutMinor,
    currency: quote.currency,
    now,
    attemptNumber: 1,
  });
  const giftCardProvider = provider as unknown as {
    execute(
      context: ProviderRequestContext,
      request: GiftCardRequest,
    ): Promise<GiftCardProviderResult>;
  };
  const request: GiftCardRequest = {
    brand: pick(sourceInput.inputs, ["brand", "cardBrand"]) ?? "Amazon",
    region: pick(sourceInput.inputs, ["region"]) ?? "US",
    denominationMinor: parseDenomination(
      sourceInput.inputs,
      quote.expectedCheckoutMinor,
    ),
    quantity: parseQuantity(sourceInput.inputs),
    currency: quote.currency,
    recipientEmail: null,
  };
  const result = await giftCardProvider.execute(context, request);
  const attempt = await recordProviderAttempt(run.deps.repos, {
    transactionId,
    providerId: provider.providerId,
    serviceId: service.id,
    scenario,
    requestReference: context.requestId,
    result,
  });

  const artifact: GiftCardArtifact = buildGiftCardArtifact({
    transactionId,
    brand: request.brand,
    region: request.region,
    denominationMinor: request.denominationMinor,
    currency: request.currency,
    quantity: request.quantity,
    deliveryStatus: result.deliveryStatus,
    redemptionStatus: result.codeStatus,
    maskedCodePreview: result.maskedCodePreview,
    riskFlags: result.riskFlags,
  });
  await run.deps.repos.giftCardArtifacts.insert(artifact);

  const allEvents = [
    ...events,
    await appendTransactionEvent(run.deps.repos, {
      transactionId,
      type: TransactionEventType.ProviderResponseReceived,
      label: "Provider response received",
      description: `${provider.providerName} returned ${result.providerStatus} for gift card delivery.`,
      actor: "MOCK_PROVIDER",
      source: "PROVIDER",
      metadata: sourceAttributes({
        provider_status: result.providerStatus,
        provider_reference: result.providerReference,
        delivery_status: result.deliveryStatus,
        code_status: result.codeStatus,
        attempt_id: attempt.id,
      }),
      occurredAt: now,
    }),
  ];
  if (result.deliveryStatus === "DELIVERED") {
    allEvents.push(
      await appendTransactionEvent(run.deps.repos, {
        transactionId,
        type: TransactionEventType.GiftCardDelivered,
        label: "Gift card delivered",
        description: `Gift card for ${request.brand} (${request.region}) delivered.`,
        actor: "MOCK_PROVIDER",
        source: "PROVIDER",
        metadata: sourceAttributes({
          brand: request.brand,
          region: request.region,
          quantity: String(request.quantity),
          masked_code_preview: result.maskedCodePreview,
        }),
        occurredAt: now,
      }),
    );
  } else if (result.deliveryStatus === "FAILED") {
    allEvents.push(
      await appendTransactionEvent(run.deps.repos, {
        transactionId,
        type: TransactionEventType.GiftCardFulfillmentFailed,
        label: "Gift card fulfillment failed",
        description: `${request.brand} gift card was not delivered.`,
        actor: "MOCK_PROVIDER",
        source: "PROVIDER",
        metadata: sourceAttributes({
          brand: request.brand,
          delivery_status: result.deliveryStatus,
        }),
        occurredAt: now,
      }),
    );
  }

  const extras = await appendScenarioEvents(run.deps.repos, {
    transactionId,
    scenario,
    result,
    attempt,
    allEvents,
    now,
  });

  const withResolution = await applyResolutionToEvents(run.deps.repos, {
    transactionId,
    scenario,
    result,
    walletId,
    quote,
    events: extras.events,
    now,
  });

  const terminal = await finalizeTransaction(run.deps.repos, {
    transactionId,
    orderId,
    customerId: sourceInput.customerId,
    service,
    reference,
    scenario,
    debitEvidence,
    allEvents: withResolution.events,
    attempts: [attempt],
    artifacts:
      withResolution.artifacts.length > 0
        ? withResolution.artifacts
        : [artifact],
    now,
  });

  return finishResult({
    repos: run.deps.repos,
    transaction: terminal.transaction,
    service,
    scenario,
    quote,
    debitEvidence,
    paymentRecord,
    attempts: terminal.attempts,
    artifacts: terminal.artifacts,
    events: terminal.events,
    requestedAt: result.requestTimestamp,
    respondedAt: result.responseTimestamp,
    customerReference,
    providerReference: result.providerReference,
    providerResult: result,
    replayed: false,
  });
}

export interface GiftCardRequest {
  readonly brand: string;
  readonly region: string;
  readonly denominationMinor: number;
  readonly quantity: number;
  readonly currency: string;
  readonly recipientEmail: string | null;
}

async function runTicketingFlow(run: {
  readonly deps: MarketplaceTransactionDeps;
  readonly service: MarketplaceService;
  readonly sourceInput: ExecuteTransactionInput;
  readonly quote: Quote;
  readonly provider: RegisteredProvider;
  readonly transactionId: string;
  readonly reference: string;
  readonly orderId: string;
  readonly customerReference: string;
  readonly now: string;
  readonly events: readonly TransactionEvent[];
  readonly seed: string;
  readonly walletId: string;
  readonly debitEvidence: WalletPaymentEvidence;
  readonly paymentRecord: MarketplacePaymentRecord;
}): Promise<ExecuteTransactionResult> {
  const {
    service,
    sourceInput,
    quote,
    provider,
    transactionId,
    reference,
    orderId,
    customerReference,
    now,
    events,
    walletId,
    debitEvidence,
    paymentRecord,
  } = run;
  const scenario = sourceInput.scenario;
  const ticketProvider = provider as unknown as TicketingProviderLike;
  const ticketKind = ticketKindFor(service.kind);
  const search = buildTicketSearch(service.kind, sourceInput.inputs);

  const searchContext = buildServiceContext({
    transactionId,
    customerId: sourceInput.customerId,
    service,
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario,
    inputs: sourceInput.inputs,
    amountMinor: quote.expectedCheckoutMinor,
    currency: quote.currency,
    now,
    attemptNumber: 1,
  });
  const availabilities = await ticketProvider.searchAvailability(
    searchContext,
    search,
  );
  const availability = availabilities[0] ?? null;
  const passengers = parseQuantity(sourceInput.inputs);

  const reserveContext = buildServiceContext({
    transactionId,
    customerId: sourceInput.customerId,
    service,
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario,
    inputs: sourceInput.inputs,
    amountMinor: availability?.amountMinor ?? quote.expectedCheckoutMinor,
    currency: availability?.currency ?? quote.currency,
    now,
    attemptNumber: 2,
  });
  const reserveResult = await ticketProvider.reserve(reserveContext, {
    ticketKind,
    availabilityId: availability?.id ?? "avail_missing",
    passengerOrAttendeeName:
      pick(sourceInput.inputs, ["passenger", "passengerName", "attendee"]) ??
      "Demo Customer",
    seat: pick(sourceInput.inputs, ["seat", "seats"]) ?? null,
  });
  const reserveAttempt = await recordProviderAttempt(run.deps.repos, {
    transactionId,
    providerId: provider.providerId,
    serviceId: service.id,
    scenario,
    requestReference: reserveContext.requestId,
    result: reserveResult,
  });

  const allEvents = [
    ...events,
    await appendTransactionEvent(run.deps.repos, {
      transactionId,
      type: TransactionEventType.ProviderResponseReceived,
      label: "Provider response received",
      description: `${provider.providerName} reserved a ${ticketKind} seat.`,
      actor: "MOCK_PROVIDER",
      source: "PROVIDER",
      metadata: sourceAttributes({
        provider_status: reserveResult.providerStatus,
        reservation_reference: reserveResult.reservationReference,
        attempt_id: reserveAttempt.id,
        availability_id: availability?.id ?? null,
        venue_or_route: availability?.routeOrVenue ?? null,
      }),
      occurredAt: now,
    }),
  ];
  let issuedResult: TicketProviderResult | null = null;
  let issuedAttempt: ProviderAttempt | null = null;
  if (reserveResult.reservationReference !== null) {
    allEvents.push(
      await appendTransactionEvent(run.deps.repos, {
        transactionId,
        type: TransactionEventType.TicketReserved,
        label: "Ticket reserved",
        description: `Reservation ${reserveResult.reservationReference} confirmed.`,
        actor: "MOCK_PROVIDER",
        source: "PROVIDER",
        metadata: sourceAttributes({
          reservation_reference: reserveResult.reservationReference,
          ticket_kind: ticketKind,
        }),
        occurredAt: now,
      }),
    );

    const issueContext = buildServiceContext({
      transactionId,
      customerId: sourceInput.customerId,
      service,
      providerId: provider.providerId,
      providerName: provider.providerName,
      scenario,
      inputs: sourceInput.inputs,
      amountMinor: quote.expectedCheckoutMinor,
      currency: quote.currency,
      now,
      attemptNumber: 3,
    });
    issuedResult = await ticketProvider.issue(issueContext, {
      ticketKind,
      reservationReference: reserveResult.reservationReference,
      passengerOrAttendeeName:
        pick(sourceInput.inputs, ["passenger", "passengerName", "attendee"]) ??
        "Demo Customer",
    });
    issuedAttempt = await recordProviderAttempt(run.deps.repos, {
      transactionId,
      providerId: provider.providerId,
      serviceId: service.id,
      scenario,
      requestReference: issueContext.requestId,
      result: issuedResult,
    });
    allEvents.push(
      await appendTransactionEvent(run.deps.repos, {
        transactionId,
        type: TransactionEventType.ProviderResponseReceived,
        label: "Provider response received",
        description: `${provider.providerName} issued the ticket.`,
        actor: "MOCK_PROVIDER",
        source: "PROVIDER",
        metadata: sourceAttributes({
          provider_status: issuedResult.providerStatus,
          issue_reference: issuedResult.issueReference,
          attempt_id: issuedAttempt.id,
        }),
        occurredAt: now,
      }),
    );
    if (issuedResult.issueReference !== null) {
      allEvents.push(
        await appendTransactionEvent(run.deps.repos, {
          transactionId,
          type: TransactionEventType.TicketIssued,
          label: "Ticket issued",
          description: `Ticket ${issuedResult.issueReference} issued.`,
          actor: "MOCK_PROVIDER",
          source: "PROVIDER",
          metadata: sourceAttributes({
            issue_reference: issuedResult.issueReference,
            masked_ticket_code: issuedResult.maskedTicketCode,
          }),
          occurredAt: now,
        }),
      );
    }
  }

  const artifact: TicketArtifact = buildTicketArtifact({
    transactionId,
    ticketKind,
    reservationReference: reserveResult.reservationReference,
    issueReference: issuedResult?.issueReference ?? null,
    passengerOrAttendee:
      pick(sourceInput.inputs, ["passenger", "passengerName", "attendee"]) ??
      "Demo Customer",
    routeOrVenue: availability?.routeOrVenue ?? "",
    seat: pick(sourceInput.inputs, ["seat", "seats"]) ?? null,
    status:
      issuedResult !== null && issuedResult.maskedTicketCode !== null
        ? "ISSUED"
        : "PENDING",
    maskedCode: issuedResult?.maskedTicketCode ?? null,
    issuedAt: issuedResult?.responseTimestamp ?? null,
  });
  await run.deps.repos.ticketArtifacts.insert(artifact);

  const extras = await appendScenarioEvents(run.deps.repos, {
    transactionId,
    scenario,
    result: issuedResult ?? reserveResult,
    attempt: issuedAttempt ?? reserveAttempt,
    allEvents,
    now,
  });

  const withResolution = await applyResolutionToEvents(run.deps.repos, {
    transactionId,
    scenario,
    result: issuedResult ?? reserveResult,
    walletId,
    quote,
    events: extras.events,
    now,
  });

  const terminal = await finalizeTransaction(run.deps.repos, {
    transactionId,
    orderId,
    customerId: sourceInput.customerId,
    service,
    reference,
    scenario,
    debitEvidence,
    allEvents: withResolution.events,
    attempts: issuedAttempt
      ? [reserveAttempt, issuedAttempt]
      : [reserveAttempt],
    artifacts: [...withResolution.artifacts, artifact],
    now,
  });

  return finishResult({
    repos: run.deps.repos,
    transaction: terminal.transaction,
    service,
    scenario,
    quote,
    debitEvidence,
    paymentRecord,
    attempts: terminal.attempts,
    artifacts: terminal.artifacts,
    events: terminal.events,
    requestedAt: (issuedResult ?? reserveResult).requestTimestamp,
    respondedAt: (issuedResult ?? reserveResult).responseTimestamp,
    customerReference,
    providerReference:
      issuedResult?.providerReference ??
      reserveResult.providerReference ??
      null,
    providerResult: issuedResult ?? reserveResult,
    replayed: false,
  });
}

async function applyResolutionToEvents(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly scenario: MockProviderScenario;
    readonly result: ProviderResult;
    readonly walletId: string;
    readonly quote: Quote;
    readonly events: readonly TransactionEvent[];
    readonly now: string;
  },
): Promise<{
  readonly events: readonly TransactionEvent[];
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
}> {
  const { transactionId, scenario, result, walletId, quote, events, now } =
    input;
  const collected: TransactionEvent[] = [...events];
  let reversalLedgerReference: string | null = null;
  let refundLedgerReference: string | null = null;

  if (scenario === "REVERSED") {
    collected.push(
      await appendTransactionEvent(repos, {
        transactionId,
        type: TransactionEventType.ReversalInitiated,
        label: "Reversal initiated",
        description: "Provider reported the transaction was reversed.",
        actor: "SYSTEM",
        source: "RESOLUTION",
        metadata: sourceAttributes({
          provider_reference: result.providerReference,
          reason: "PROVIDER_REPORTED_REVERSAL",
        }),
        occurredAt: now,
      }),
    );
    const reversal = await reverseDebit(repos, {
      walletId,
      transactionId,
      amountMinor: quote.expectedCheckoutMinor,
      currency: quote.currency,
      reason: "PROVIDER_REPORTED_REVERSAL",
      now,
      scenario,
    });
    reversalLedgerReference =
      reversal.ledgerEntries.find(
        (entry) => entry.type === "REVERSAL_COMPLETED",
      )?.reference ?? null;
    collected.push(
      await appendTransactionEvent(repos, {
        transactionId,
        type: TransactionEventType.ReversalCompleted,
        label: "Reversal completed",
        description: `Reversal ${reversalLedgerReference ?? ""} posted to the wallet ledger.`,
        actor: "SYSTEM",
        source: "RESOLUTION",
        metadata: sourceAttributes({
          ledger_reference: reversalLedgerReference,
          amount_minor: String(quote.expectedCheckoutMinor),
        }),
        occurredAt: now,
      }),
    );
  } else if (scenario === "REFUND_PENDING") {
    collected.push(
      await appendTransactionEvent(repos, {
        transactionId,
        type: TransactionEventType.RefundInitiated,
        label: "Refund initiated",
        description: "Provider reported the refund is pending.",
        actor: "SYSTEM",
        source: "RESOLUTION",
        metadata: sourceAttributes({
          provider_reference: result.providerReference,
          reason: "PROVIDER_REPORTED_REFUND_PENDING",
        }),
        occurredAt: now,
      }),
    );
    const refund = await initiateRefund(repos, {
      walletId,
      transactionId,
      amountMinor: quote.expectedCheckoutMinor,
      currency: quote.currency,
      reason: "PROVIDER_REPORTED_REFUND_PENDING",
      now,
      scenario,
    });
    refundLedgerReference =
      refund.ledgerEntries.find((entry) => entry.type === "REFUND_PENDING")
        ?.reference ?? null;
    collected.push(
      await appendTransactionEvent(repos, {
        transactionId,
        type: TransactionEventType.RefundPending,
        label: "Refund pending",
        description: `Refund pending (${refundLedgerReference ?? ""}).`,
        actor: "SYSTEM",
        source: "RESOLUTION",
        metadata: sourceAttributes({
          ledger_reference: refundLedgerReference,
          amount_minor: String(quote.expectedCheckoutMinor),
        }),
        occurredAt: now,
      }),
    );
  } else if (scenario === "REFUND_COMPLETED") {
    collected.push(
      await appendTransactionEvent(repos, {
        transactionId,
        type: TransactionEventType.RefundInitiated,
        label: "Refund initiated",
        description: "Provider reported the refund was completed.",
        actor: "SYSTEM",
        source: "RESOLUTION",
        metadata: sourceAttributes({
          provider_reference: result.providerReference,
          reason: "PROVIDER_REPORTED_REFUND_COMPLETED",
        }),
        occurredAt: now,
      }),
    );
    const initiated = await initiateRefund(repos, {
      walletId,
      transactionId,
      amountMinor: quote.expectedCheckoutMinor,
      currency: quote.currency,
      reason: "PROVIDER_REPORTED_REFUND_COMPLETED",
      now,
      scenario: "REFUND_PENDING",
    });
    const refund = await completeRefund(repos, {
      walletId,
      transactionId,
      amountMinor: quote.expectedCheckoutMinor,
      currency: quote.currency,
      reason: "PROVIDER_REPORTED_REFUND_COMPLETED",
      now,
    });
    refundLedgerReference =
      refund.ledgerEntries.find((entry) => entry.type === "REFUND_COMPLETED")
        ?.reference ??
      initiated.ledgerEntries.find((entry) => entry.type === "REFUND_PENDING")
        ?.reference ??
      null;
    collected.push(
      await appendTransactionEvent(repos, {
        transactionId,
        type: TransactionEventType.RefundCompleted,
        label: "Refund completed",
        description: `Refund completed (${refundLedgerReference ?? ""}).`,
        actor: "SYSTEM",
        source: "RESOLUTION",
        metadata: sourceAttributes({
          ledger_reference: refundLedgerReference,
          amount_minor: String(quote.expectedCheckoutMinor),
        }),
        occurredAt: now,
      }),
    );
  }

  return { events: collected, artifacts: [] };
}

async function appendScenarioEvents(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly scenario: MockProviderScenario;
    readonly result: ProviderResult;
    readonly attempt: ProviderAttempt;
    readonly allEvents: readonly TransactionEvent[];
    readonly now: string;
  },
): Promise<{
  readonly events: readonly TransactionEvent[];
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
}> {
  const { transactionId, scenario, result, attempt, allEvents, now } = input;
  const events: TransactionEvent[] = [...allEvents];
  switch (scenario) {
    case "DUPLICATE":
      events.push(
        await appendTransactionEvent(repos, {
          transactionId,
          type: TransactionEventType.DuplicateProviderResponse,
          label: "Duplicate provider response",
          description:
            "Provider returned duplicate facts; a single debit and single fulfillment were preserved.",
          actor: "MOCK_PROVIDER",
          source: "PROVIDER",
          metadata: sourceAttributes({
            duplicate_result_count: String(result.duplicateResults.length),
            provider_reference: result.providerReference,
          }),
          occurredAt: now,
        }),
      );
      break;
    case "FAILED":
      events.push(
        await appendTransactionEvent(repos, {
          transactionId,
          type: TransactionEventType.ProviderFailed,
          label: "Provider failed",
          description: `${result.providerMessage}`,
          actor: "MOCK_PROVIDER",
          source: "PROVIDER",
          metadata: sourceAttributes({
            provider_status: result.providerStatus,
            provider_status_code: result.providerStatusCode,
            provider_reference: result.providerReference,
          }),
          occurredAt: now,
        }),
      );
      break;
    case "TIMEOUT":
      events.push(
        await appendTransactionEvent(repos, {
          transactionId,
          type: TransactionEventType.ProviderTimeout,
          label: "Provider timed out",
          description:
            "Provider did not respond before the timeout; no provider facts were recorded.",
          actor: "SYSTEM",
          source: "PROVIDER",
          metadata: {
            simulated: "true",
            attempt_id: attempt.id,
            provider_reference_preserved_as_absent: "true",
          },
          occurredAt: now,
        }),
      );
      break;
    case "MISMATCH":
      events.push(
        await appendTransactionEvent(repos, {
          transactionId,
          type: TransactionEventType.ProviderAmountMismatch,
          label: "Provider amount mismatch",
          description:
            "Provider reported an amount different from the checked-out quote.",
          actor: "MOCK_PROVIDER",
          source: "PROVIDER",
          metadata: sourceAttributes({
            provider_amount_minor:
              result.amountMinor !== null ? String(result.amountMinor) : null,
            expected_amount_minor: String(attempt.amountMinor ?? ""),
            flag: "AMOUNT_MISMATCH",
          }),
          occurredAt: now,
        }),
      );
      break;
    case "PARTIAL_SUCCESS":
      events.push(
        await appendTransactionEvent(repos, {
          transactionId,
          type: TransactionEventType.ProviderPartialFulfillment,
          label: "Provider partial fulfillment",
          description: "Provider completed part of the requested value.",
          actor: "MOCK_PROVIDER",
          source: "PROVIDER",
          metadata: sourceAttributes({
            provider_amount_minor:
              result.amountMinor !== null ? String(result.amountMinor) : null,
          }),
          occurredAt: now,
        }),
      );
      break;
    default:
      break;
  }
  return { events, artifacts: [] };
}

async function finalizeTransaction(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly orderId: string;
    readonly customerId: string;
    readonly service: MarketplaceService;
    readonly reference: string;
    readonly scenario: MockProviderScenario;
    readonly debitEvidence: WalletPaymentEvidence;
    readonly allEvents: readonly TransactionEvent[];
    readonly attempts: readonly ProviderAttempt[];
    readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
    readonly now: string;
  },
): Promise<{
  readonly transaction: MarketplaceTransaction;
  readonly attempts: readonly ProviderAttempt[];
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
  readonly events: readonly TransactionEvent[];
}> {
  const {
    transactionId,
    orderId,
    customerId,
    service,
    reference,
    scenario,
    debitEvidence,
    allEvents,
    attempts,
    artifacts,
    now,
  } = input;
  const paymentStatus =
    debitEvidence.paymentState === "REVERSED"
      ? ("CANCELLED" as const)
      : debitEvidence.paymentState === "REFUNDED"
        ? ("SUCCESS" as const)
        : debitEvidence.paymentState === "REFUND_PENDING"
          ? ("PENDING" as const)
          : debitEvidence.paymentState === "FAILED"
            ? ("FAILED" as const)
            : debitEvidence.paymentState === "PENDING"
              ? ("PENDING" as const)
              : ("SUCCESS" as const);
  const state = deriveTransactionState({ scenario, paymentStatus });
  const events: TransactionEvent[] = [...allEvents];
  events.push(
    await finalStatusEvent(repos, { transactionId, scenario, state, now }),
  );

  const tx = await persistTransaction(repos, {
    transactionId,
    orderId,
    customerId,
    service,
    reference,
    scenario,
    state,
    now,
  });
  await persistOrderStatus(repos, orderId, state.orderStatus, now);
  return { transaction: tx, attempts, artifacts, events };
}

async function finalStatusEvent(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly scenario: MockProviderScenario;
    readonly state: DerivedState;
    readonly now: string;
  },
): Promise<TransactionEvent> {
  const { transactionId, scenario, state, now } = input;
  if (state.orderStatus === "COMPLETED") {
    return appendTransactionEvent(repos, {
      transactionId,
      type: TransactionEventType.TransactionFulfilled,
      label: "Transaction fulfilled",
      description: `Transaction reached ${state.customerStatus} (${state.adminStatus}).`,
      actor: "SYSTEM",
      source: "MARKETPLACE",
      metadata: { simulated: "true", scenario, outcome: "FULFILLED" },
      occurredAt: now,
    });
  }
  if (state.orderStatus === "FAILED" || state.orderStatus === "CANCELLED") {
    return appendTransactionEvent(repos, {
      transactionId,
      type: TransactionEventType.TransactionFailed,
      label: "Transaction failed",
      description: `Transaction ended ${state.orderStatus}.`,
      actor: "SYSTEM",
      source: "MARKETPLACE",
      metadata: { simulated: "true", scenario, outcome: state.orderStatus },
      occurredAt: now,
    });
  }
  if (scenario === "PENDING" || scenario === "REFUND_PENDING") {
    return appendTransactionEvent(repos, {
      transactionId,
      type: TransactionEventType.TransactionPending,
      label: "Transaction pending",
      description: `Transaction is pending (${state.adminStatus}).`,
      actor: "SYSTEM",
      source: "MARKETPLACE",
      metadata: { simulated: "true", scenario },
      occurredAt: now,
    });
  }
  return appendTransactionEvent(repos, {
    transactionId,
    type: TransactionEventType.TransactionRequiresReview,
    label: "Transaction requires review",
    description: `Transaction needs attention (${state.adminStatus}).`,
    actor: "SYSTEM",
    source: "MARKETPLACE",
    metadata: { simulated: "true", scenario, admin: state.adminStatus },
    occurredAt: now,
  });
}

function buildTransactionRecord(input: {
  readonly transactionId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly service: MarketplaceService;
  readonly reference: string;
  readonly scenario: MockProviderScenario;
  readonly paymentStatus: CanonicalPaymentStatus;
  readonly fulfillmentStatus: FulfillmentStatus;
  readonly resolutionStatus: ResolutionStatus;
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
  readonly orderStatus: MarketplaceOrderStatus;
  readonly now: string;
}): MarketplaceTransaction {
  return {
    id: input.transactionId,
    orderId: input.orderId,
    customerId: input.customerId,
    serviceId: input.service.id,
    providerId: input.service.providerId,
    reference: input.reference,
    scenario: input.scenario,
    paymentStatus: input.paymentStatus,
    fulfillmentStatus: input.fulfillmentStatus,
    reconcileOutcome: null,
    resolutionStatus: input.resolutionStatus,
    customerStatus: input.customerStatus,
    adminStatus: input.adminStatus,
    simulated: true,
    createdAt: input.now,
    updatedAt: input.now,
    demoScenarioName: input.scenario,
  };
}

async function persistTransaction(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly orderId: string;
    readonly customerId: string;
    readonly service: MarketplaceService;
    readonly reference: string;
    readonly scenario: MockProviderScenario;
    readonly state: DerivedState;
    readonly now: string;
  },
): Promise<MarketplaceTransaction> {
  const record = buildTransactionRecord({
    ...input,
    paymentStatus: input.state.paymentStatus,
    fulfillmentStatus: input.state.fulfillmentStatus,
    resolutionStatus: input.state.resolutionStatus,
    customerStatus: input.state.customerStatus,
    adminStatus: input.state.adminStatus,
    orderStatus: input.state.orderStatus,
  });
  await repos.marketplaceTransactions.insert(record);
  return record;
}

async function persistOrderStatus(
  repos: Repositories,
  orderId: string,
  status: MarketplaceOrderStatus,
  now: string,
): Promise<void> {
  const order = await repos.marketplaceOrders.readLatestById(orderId);
  if (order === null) {
    return;
  }
  await repos.marketplaceOrders.insert({
    ...order,
    status,
    updatedAt: now,
  });
}

async function insertOrder(
  repos: Repositories,
  input: {
    readonly id: string;
    readonly customerId: string;
    readonly serviceId: string;
    readonly inputs: Readonly<Record<string, string>>;
    readonly quotedAmountMinor: number;
    readonly currency: string;
    readonly customerReference: string;
    readonly now: string;
  },
): Promise<MarketplaceOrder> {
  const order: MarketplaceOrder = {
    id: input.id,
    customerId: input.customerId,
    serviceId: input.serviceId,
    inputs: input.inputs,
    quotedAmountMinor: input.quotedAmountMinor,
    currency: input.currency,
    customerReference: input.customerReference,
    status: "CREATED",
    createdAt: input.now,
    updatedAt: input.now,
    simulated: true,
  };
  await repos.marketplaceOrders.insert(order);
  return order;
}

async function resolveWallet(
  repos: Repositories,
  input: {
    readonly customerId: string;
    readonly currency: string;
    readonly walletId?: string;
    readonly openingBalanceMinor?: number;
    readonly now: string;
  },
): Promise<string> {
  // Current customer ids fit within the 24-char suffix; revisit if they grow.
  const walletId =
    input.walletId ??
    `wl_${buildStableSuffix(input.customerId)}_${buildStableSuffix(input.currency)}`;
  const existing = await readWalletById(repos, walletId);
  if (existing !== null) return walletId;
  await createWallet(repos, {
    id: walletId,
    customerId: input.customerId,
    currency: input.currency,
    openingBalanceMinor: input.openingBalanceMinor ?? 500_000,
    now: input.now,
  });
  return walletId;
}

async function recordProviderAttempt(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly providerId: string;
    readonly serviceId: string;
    readonly scenario: MockProviderScenario;
    readonly requestReference: string;
    readonly result: ProviderResult;
  },
): Promise<ProviderAttempt> {
  const attempt: ProviderAttempt = {
    id: buildProviderAttemptId(input.transactionId, input.result.attemptNumber),
    transactionId: input.transactionId,
    providerId: input.providerId,
    serviceId: input.serviceId,
    scenario: input.scenario,
    requestReference: input.requestReference,
    providerReference: input.result.providerReference,
    status: input.result.attemptStatus,
    canonicalStatus: input.result.canonicalPaymentStatus,
    amountMinor: input.result.amountMinor,
    currency: input.result.currency,
    latencyMs: input.result.latencyMs,
    sourceAttributes: input.result.sourceAttributes,
    attemptedAt: input.result.requestTimestamp,
    simulated: true,
  };
  await repos.marketplaceProviderAttempts.insert(attempt);
  return attempt;
}

export function buildServiceContext(input: {
  readonly transactionId: string;
  readonly customerId: string;
  readonly service: MarketplaceService;
  readonly providerId: string;
  readonly providerName: string;
  readonly scenario: MockProviderScenario;
  readonly inputs: Readonly<Record<string, string>>;
  readonly amountMinor: number;
  readonly currency: string;
  readonly now: string;
  readonly attemptNumber: number;
}): ProviderRequestContext {
  const {
    transactionId,
    customerId,
    service,
    providerId,
    providerName,
    scenario,
    inputs,
    amountMinor,
    currency,
    now,
    attemptNumber,
  } = input;
  const inputsKey = buildInputsKey(inputs);
  const transactionRef = buildTransactionReference(
    buildMarketplaceSeed({
      customerId,
      serviceId: service.id,
      scenario,
      inputsKey,
    }),
  );
  return {
    transactionId,
    customerId,
    serviceId: service.id,
    providerId,
    providerName,
    requestId: buildRequestId(transactionId, attemptNumber),
    correlationId: buildCorrelationId(transactionId),
    attemptNumber,
    customerReference: buildCustomerReference(customerId),
    idempotencyKey: `idem_${transactionRef}_${attemptNumber}`,
    requestedAt: now,
    scenario,
    amountMinor,
    currency,
    metadata: { source: "marketplace", simulated: "true" },
  };
}

export function buildServiceRequest(
  kind: MarketplaceServiceKind,
  service: MarketplaceService,
  quote: Quote,
  inputs: Readonly<Record<string, string>>,
): {
  readonly amountMinor: number;
  readonly currency: string;
  readonly [key: string]: string | number | boolean | null;
} {
  switch (kind) {
    case "AIRTIME":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        recipient: pick(inputs, ["recipient", "phoneNumber"]) ?? "",
        network: pick(inputs, ["network"]) ?? "MTN",
        productCode:
          pick(inputs, ["amount", "productCode"]) ??
          String(quote.expectedCheckoutMinor),
      };
    case "DATA":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        recipient: pick(inputs, ["recipient", "phoneNumber"]) ?? "",
        network: pick(inputs, ["network"]) ?? "MTN",
        bundleId: pick(inputs, ["plan", "bundleId"]) ?? "1GB",
      };
    case "ELECTRICITY":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        meterNumber: pick(inputs, ["meterNumber"]) ?? "",
        disco: pick(inputs, ["provider", "disco"]) ?? "AEDC",
        customerName: pick(inputs, ["customerName"]) ?? null,
        tokenRequired: pick(inputs, ["meterType"]) === "prepaid",
      };
    case "CABLE_TV":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        subscriberId: pick(inputs, ["subscriberNumber", "subscriberId"]) ?? "",
        packageCode: pick(inputs, ["package", "packageCode"]) ?? "Compact",
        provider: pick(inputs, ["provider"]) ?? "DStv",
      };
    case "INTERNET":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        accountId: pick(inputs, ["accountNumber", "accountId"]) ?? "",
        planId: pick(inputs, ["plan", "planId"]) ?? "Monthly",
        provider: pick(inputs, ["provider"]) ?? "Spectranet",
      };
    case "EDUCATION":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        examBody: pick(inputs, ["institution", "examBody"]) ?? "JAMB",
        productCode: pick(inputs, ["applicationNumber"]) ?? "",
        candidateName: pick(inputs, ["candidateName"]) ?? null,
        deliveryTarget: pick(inputs, ["deliveryTarget", "email"]) ?? null,
      };
    case "GIFT_CARD":
    case "DIGITAL_VOUCHER":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        brand: pick(inputs, ["brand", "cardBrand"]) ?? "Amazon",
        region: pick(inputs, ["region"]) ?? "US",
        denominationMinor: parseDenomination(
          inputs,
          quote.expectedCheckoutMinor,
        ),
        quantity: parseQuantity(inputs),
      };
    case "CINEMA_TICKET":
    case "EVENT_TICKET":
    case "BUS_TICKET":
    case "AIRLINE_TICKET":
      return {
        amountMinor: quote.expectedCheckoutMinor,
        currency: quote.currency,
        ticketKind: ticketKindFor(kind),
        originOrVenue: pick(inputs, ["venue", "eventName", "origin"]) ?? "",
        destination: pick(inputs, ["destination", "movie"]) ?? null,
        date: pick(inputs, ["screening", "date"]) ?? "2026-02-01",
        passengers: parseQuantity(inputs),
      };
    case "WALLET_FUNDING":
      throw new TransactionInputError(
        "WALLET_FUNDING is not an orderable service kind",
      );
    case "BETTING":
      throw new TransactionInputError(
        "BETTING is compliance-gated and cannot be checked out",
      );
  }
}

export function buildTicketSearch(
  kind: MarketplaceServiceKind,
  inputs: Readonly<Record<string, string>>,
): TicketSearchLike {
  const ticketKind = ticketKindFor(kind);
  switch (kind) {
    case "CINEMA_TICKET":
      return {
        ticketKind,
        originOrVenue: pick(inputs, ["venue"]) ?? "Filmhouse IMAX",
        destination: pick(inputs, ["movie"]) ?? null,
        date: pick(inputs, ["screening", "date"]) ?? "2026-02-01",
        passengers: parseQuantity(inputs),
      };
    case "EVENT_TICKET":
      return {
        ticketKind,
        originOrVenue: pick(inputs, ["eventName"]) ?? "Lagos Tech Fest",
        destination: null,
        date: pick(inputs, ["date"]) ?? "2026-02-01",
        passengers: parseQuantity(inputs),
      };
    case "BUS_TICKET":
      return {
        ticketKind,
        originOrVenue: pick(inputs, ["origin"]) ?? "Lagos",
        destination: pick(inputs, ["destination"]) ?? null,
        date: pick(inputs, ["date"]) ?? "2026-02-01",
        passengers: parseQuantity(inputs),
      };
    case "AIRLINE_TICKET":
      return {
        ticketKind,
        originOrVenue: pick(inputs, ["origin"]) ?? "LOS",
        destination: pick(inputs, ["destination"]) ?? null,
        date: pick(inputs, ["date"]) ?? "2026-02-01",
        passengers: parseQuantity(inputs),
      };
    default:
      return {
        ticketKind: ticketKindFor(kind),
        originOrVenue: "",
        destination: null,
        date: "2026-02-01",
        passengers: 1,
      };
  }
}

export interface TicketSearchLike {
  readonly ticketKind: "CINEMA" | "EVENT" | "BUS" | "AIRLINE";
  readonly originOrVenue: string;
  readonly destination: string | null;
  readonly date: string;
  readonly passengers: number;
}

export interface TicketingProviderLike {
  readonly providerId: string;
  readonly providerName: string;
  searchAvailability(
    context: ProviderRequestContext,
    request: TicketSearchLike,
  ): Promise<readonly TicketAvailability[]>;
  reserve(
    context: ProviderRequestContext,
    request: {
      readonly ticketKind: "CINEMA" | "EVENT" | "BUS" | "AIRLINE";
      readonly availabilityId: string;
      readonly passengerOrAttendeeName: string;
      readonly seat: string | null;
    },
  ): Promise<TicketProviderResult>;
  issue(
    context: ProviderRequestContext,
    request: {
      readonly ticketKind: "CINEMA" | "EVENT" | "BUS" | "AIRLINE";
      readonly reservationReference: string;
      readonly passengerOrAttendeeName: string;
    },
  ): Promise<TicketProviderResult>;
}

function isTicketingKind(kind: MarketplaceServiceKind): boolean {
  return (
    kind === "CINEMA_TICKET" ||
    kind === "EVENT_TICKET" ||
    kind === "BUS_TICKET" ||
    kind === "AIRLINE_TICKET"
  );
}

function isGiftCardKind(kind: MarketplaceServiceKind): boolean {
  return kind === "GIFT_CARD" || kind === "DIGITAL_VOUCHER";
}

function ticketKindFor(
  kind: MarketplaceServiceKind,
): "CINEMA" | "EVENT" | "BUS" | "AIRLINE" {
  switch (kind) {
    case "CINEMA_TICKET":
      return "CINEMA";
    case "EVENT_TICKET":
      return "EVENT";
    case "BUS_TICKET":
      return "BUS";
    case "AIRLINE_TICKET":
      return "AIRLINE";
    default:
      return "CINEMA";
  }
}

function pick(
  inputs: Readonly<Record<string, string>>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = inputs[key];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function parseQuantity(inputs: Readonly<Record<string, string>>): number {
  const raw = pick(inputs, ["quantity", "ticketType"]);
  if (raw === null) {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseDenomination(
  inputs: Readonly<Record<string, string>>,
  fallbackMinor: number,
): number {
  const raw = pick(inputs, ["denomination"]);
  if (raw === null || raw === "") {
    return fallbackMinor;
  }
  const digits = raw.replace(/[^0-9]/g, "");
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMinor;
  }
  return parsed * 100;
}

async function finishResult(input: {
  readonly repos: Repositories;
  readonly transaction: MarketplaceTransaction;
  readonly service: MarketplaceService;
  readonly scenario: MockProviderScenario;
  readonly quote: Quote;
  readonly debitEvidence: WalletPaymentEvidence;
  readonly paymentRecord: MarketplacePaymentRecord;
  readonly attempts: readonly ProviderAttempt[];
  readonly artifacts: readonly (TicketArtifact | GiftCardArtifact)[];
  readonly events: readonly TransactionEvent[];
  readonly requestedAt: string;
  readonly respondedAt: string | null;
  readonly customerReference: string;
  readonly providerReference: string | null;
  readonly providerResult: ProviderResult | null;
  readonly replayed: boolean;
}): Promise<ExecuteTransactionResult> {
  const facts: TransactionReconciliationFacts = {
    transactionId: input.transaction.id,
    orderId: input.transaction.orderId,
    customerReference: input.customerReference,
    providerId: input.transaction.providerId,
    serviceId: input.transaction.serviceId,
    serviceKind: input.service.kind,
    scenario: input.scenario,
    expectedAmountMinor: input.quote.expectedCheckoutMinor,
    paymentAmountMinor:
      input.debitEvidence.paymentState === "SETTLED" ||
      input.debitEvidence.paymentState === "REVERSED"
        ? input.quote.expectedCheckoutMinor
        : null,
    providerAmountMinor: input.providerResult?.amountMinor ?? null,
    currency: input.quote.currency,
    paymentState: input.transaction.paymentStatus,
    providerState: input.providerResult?.canonicalPaymentStatus ?? null,
    fulfillmentState: input.transaction.fulfillmentStatus,
    providerReference: input.providerReference,
    requestedAt: input.requestedAt,
    respondedAt: input.respondedAt,
    providerAttemptHistory: input.attempts,
    evidenceLedgerEntryIds: input.debitEvidence.ledgerEntryIds,
    reversal: {
      status:
        input.transaction.resolutionStatus === "REVERSED"
          ? "COMPLETED"
          : "NONE",
    },
    refund: {
      status:
        input.transaction.resolutionStatus === "REFUNDED"
          ? "COMPLETED"
          : input.transaction.resolutionStatus === "REFUND_PENDING"
            ? "PENDING"
            : "NONE",
    },
    flags: factFlags(input.scenario),
    simulated: true,
  };
  return {
    transaction: input.transaction,
    order: (await input.repos.marketplaceOrders.readLatestById(
      input.transaction.orderId,
    ))!,
    payment: input.paymentRecord,
    evidence: decorateEvidence(input.debitEvidence, input.artifacts),
    providerResult: input.providerResult,
    providerAttempts: input.attempts,
    events: input.events,
    artifacts: input.artifacts,
    facts,
    replayed: input.replayed,
  };
}

export function factFlags(
  scenario: MockProviderScenario,
): readonly ReconciliationCode[] {
  switch (scenario) {
    case "MISMATCH":
    case "PARTIAL_SUCCESS":
      return ["AMOUNT_MISMATCH"];
    case "DUPLICATE":
      return ["DUPLICATE_PROVIDER_RECORD"];
    case "FAILED":
      return ["STATUS_MISMATCH"];
    case "TIMEOUT":
    case "PENDING":
    case "UNKNOWN":
      return ["STATUS_UNRESOLVED"];
    default:
      return [];
  }
}

export async function marketplaceTransactionFacts(
  repos: Repositories,
  transactionId: string,
): Promise<TransactionReconciliationFacts | null> {
  const transaction =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  if (transaction === null) {
    return null;
  }
  const attempts =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  const lastAttempt = attempts.at(-1) ?? null;
  const payment = await repos.marketplacePayments.findByOrderId(
    transaction.orderId,
  );
  return {
    transactionId: transaction.id,
    orderId: transaction.orderId,
    customerReference: buildCustomerReference(transaction.customerId),
    providerId: transaction.providerId,
    serviceId: transaction.serviceId,
    serviceKind:
      findServiceById(buildDemoCatalog(), transaction.serviceId)?.kind ??
      "AIRTIME",
    scenario: transaction.scenario,
    expectedAmountMinor: payment?.expectedAmountMinor ?? 0,
    paymentAmountMinor: payment?.actualAmountMinor ?? null,
    providerAmountMinor: lastAttempt?.amountMinor ?? null,
    currency: payment?.currency ?? "NGN",
    paymentState: transaction.paymentStatus,
    providerState: lastAttempt?.canonicalStatus ?? null,
    fulfillmentState: transaction.fulfillmentStatus,
    providerReference: lastAttempt?.providerReference ?? null,
    requestedAt: transaction.createdAt,
    respondedAt: lastAttempt?.attemptedAt ?? null,
    providerAttemptHistory: attempts,
    evidenceLedgerEntryIds: [],
    reversal: {
      status:
        transaction.resolutionStatus === "REVERSED" ? "COMPLETED" : "NONE",
    },
    refund: {
      status:
        transaction.resolutionStatus === "REFUNDED"
          ? "COMPLETED"
          : transaction.resolutionStatus === "REFUND_PENDING"
            ? "PENDING"
            : "NONE",
    },
    flags: factFlags(transaction.scenario),
    simulated: true,
  };
}

async function replayResult(
  repos: Repositories,
  transaction: MarketplaceTransaction,
  orderId: string,
  transactionId: string,
): Promise<ExecuteTransactionResult> {
  const order = await repos.marketplaceOrders.readLatestById(orderId);
  const attempts =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  const payment = await repos.marketplacePayments.findByOrderId(orderId);
  const events = await listTransactionEvents(repos, transactionId);
  const ticketArtifacts =
    await repos.ticketArtifacts.listByTransaction(transactionId);
  const giftArtifacts =
    await repos.giftCardArtifacts.listByTransaction(transactionId);
  return {
    transaction,
    order: order!,
    payment,
    evidence: null,
    providerResult: null,
    providerAttempts: attempts,
    events,
    artifacts: [...ticketArtifacts, ...giftArtifacts],
    facts: null,
    replayed: true,
  };
}
