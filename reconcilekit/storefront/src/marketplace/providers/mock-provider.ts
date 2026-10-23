import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import type {
  MarketplaceServiceKind,
  MockProviderScenario,
  ProviderAttemptStatus,
} from "../types.ts";
import type {
  AirtimeProvider,
  AirtimeProviderRequest,
  AirlineProvider,
  BusProvider,
  CableProvider,
  CableProviderRequest,
  CinemaProvider,
  DataProvider,
  DataProviderRequest,
  EducationProvider,
  EducationProviderRequest,
  ElectricityProvider,
  ElectricityProviderRequest,
  EventProvider,
  GiftCardCodeStatus,
  GiftCardDeliveryStatus,
  GiftCardProvider,
  GiftCardProviderRequest,
  GiftCardProviderResult,
  InternetProvider,
  InternetProviderRequest,
  PaymentProvider,
  PaymentProviderRequest,
  PaymentProviderResult,
  ProviderReconciliationFacts,
  ProviderRequestContext,
  ProviderResult,
  ProviderStatus,
  TicketAvailability,
  TicketCancelRequest,
  TicketingProvider,
  TicketIssueRequest,
  TicketProviderKind,
  TicketProviderResult,
  TicketReservationRequest,
  TicketSearchRequest,
} from "./contracts.ts";

interface MockProviderOptions {
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  readonly referencePrefix: string;
}

const SCENARIO_LATENCY_MS: Readonly<Record<MockProviderScenario, number>> = {
  SUCCESS: 240,
  FAILED: 260,
  PENDING: 1_200,
  TIMEOUT: 15_000,
  DUPLICATE: 320,
  PARTIAL_SUCCESS: 480,
  REVERSED: 360,
  REFUND_PENDING: 760,
  REFUND_COMPLETED: 920,
  MISMATCH: 410,
  UNKNOWN: 530,
};

const SCENARIO_STATUS: Readonly<Record<MockProviderScenario, ProviderStatus>> =
  {
    SUCCESS: "PROVIDER_SUCCESS",
    FAILED: "PROVIDER_FAILED",
    PENDING: "PROVIDER_PENDING",
    TIMEOUT: "PROVIDER_TIMEOUT",
    DUPLICATE: "PROVIDER_DUPLICATE",
    PARTIAL_SUCCESS: "PROVIDER_PARTIAL_SUCCESS",
    REVERSED: "PROVIDER_REVERSED",
    REFUND_PENDING: "PROVIDER_REFUND_PENDING",
    REFUND_COMPLETED: "PROVIDER_REFUND_COMPLETED",
    MISMATCH: "PROVIDER_MISMATCH",
    UNKNOWN: "PROVIDER_UNKNOWN",
  };

const SCENARIO_ATTEMPT_STATUS: Readonly<
  Record<MockProviderScenario, ProviderAttemptStatus>
> = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  PENDING: "PENDING",
  TIMEOUT: "TIMEOUT",
  DUPLICATE: "DUPLICATE",
  PARTIAL_SUCCESS: "SUCCESS",
  REVERSED: "SUCCESS",
  REFUND_PENDING: "PENDING",
  REFUND_COMPLETED: "SUCCESS",
  MISMATCH: "MISMATCH",
  UNKNOWN: "UNKNOWN",
};

const SCENARIO_CANONICAL_STATUS: Readonly<
  Record<MockProviderScenario, CanonicalPaymentStatus>
> = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  PENDING: "PENDING",
  TIMEOUT: "UNKNOWN",
  DUPLICATE: "SUCCESS",
  PARTIAL_SUCCESS: "SUCCESS",
  REVERSED: "CANCELLED",
  REFUND_PENDING: "PENDING",
  REFUND_COMPLETED: "SUCCESS",
  MISMATCH: "SUCCESS",
  UNKNOWN: "UNKNOWN",
};

export class MockServiceProvider<
  Request extends { readonly amountMinor?: number; readonly currency?: string },
> {
  readonly mode = "MOCK" as const;
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  private readonly referencePrefix: string;

  constructor(options: MockProviderOptions) {
    this.id = options.id;
    this.providerId = options.providerId;
    this.providerName = options.providerName;
    this.serviceKinds = options.serviceKinds;
    this.referencePrefix = options.referencePrefix;
  }

  async execute(
    context: ProviderRequestContext,
    request: Request,
  ): Promise<ProviderResult> {
    return buildProviderResult({
      context,
      request,
      serviceKind: this.serviceKinds[0] ?? "AIRTIME",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: this.referencePrefix,
      extraMetadata: serviceRequestMetadata(request),
    });
  }

  async queryStatus(context: ProviderRequestContext): Promise<ProviderResult> {
    return buildMockStatusResult({
      context,
      serviceKind: this.serviceKinds[0] ?? "AIRTIME",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: this.referencePrefix,
    });
  }
}

export class MockGiftCardProvider implements GiftCardProvider {
  readonly mode = "MOCK" as const;
  readonly id = "mock_gift_card_adapter";
  readonly providerId = "mock_gift_card_provider";
  readonly providerName = "Mock Gift Card Provider";
  readonly serviceKinds = ["GIFT_CARD", "DIGITAL_VOUCHER"] as const;

  async execute(
    context: ProviderRequestContext,
    request: GiftCardProviderRequest,
  ): Promise<GiftCardProviderResult> {
    const scenario = getMockScenario(context);
    const result = buildProviderResult({
      context,
      request: {
        amountMinor: request.denominationMinor * request.quantity,
        currency: request.currency,
      },
      serviceKind: "GIFT_CARD",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: "gift",
      extraMetadata: {
        brand: request.brand,
        region: request.region,
        quantity: String(request.quantity),
        recipient_email_present: String(request.recipientEmail !== null),
        masked_code_preview: maskedCode(context),
      },
    });

    const deliveryStatus = giftCardDeliveryStatus(scenario);
    return {
      ...result,
      deliveryStatus,
      codeStatus: giftCardCodeStatus(scenario),
      maskedCodePreview:
        deliveryStatus === "DELIVERED" ? maskedCode(context) : null,
      riskFlags: scenario === "MISMATCH" ? ["AMOUNT_DISCREPANCY"] : [],
    };
  }

  async queryStatus(context: ProviderRequestContext): Promise<ProviderResult> {
    return buildMockStatusResult({
      context,
      serviceKind: "GIFT_CARD",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: "gift",
    });
  }
}

export class MockTicketingProvider
  implements CinemaProvider, EventProvider, BusProvider, AirlineProvider
{
  readonly mode = "MOCK" as const;
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  private readonly referencePrefix: string;
  private readonly ticketKind: TicketProviderKind;

  constructor(
    options: MockProviderOptions & { readonly ticketKind: TicketProviderKind },
  ) {
    this.id = options.id;
    this.providerId = options.providerId;
    this.providerName = options.providerName;
    this.serviceKinds = options.serviceKinds;
    this.referencePrefix = options.referencePrefix;
    this.ticketKind = options.ticketKind;
  }

  async searchAvailability(
    context: ProviderRequestContext,
    request: TicketSearchRequest,
  ): Promise<readonly TicketAvailability[]> {
    const baseId = stableToken(
      `${context.serviceId}_${request.ticketKind}_${request.originOrVenue}_${request.destination ?? "local"}_${request.date}`,
    );
    return [
      {
        id: `avail_${baseId}_1`,
        ticketKind: request.ticketKind,
        providerName: this.providerName,
        title: `${request.ticketKind} option 1`,
        routeOrVenue: routeOrVenue(request),
        departureOrStartAt: `${request.date}T09:00:00.000Z`,
        availableSeats: ["A1", "A2", "A3"],
        amountMinor: context.amountMinor,
        currency: context.currency,
        simulated: true,
      },
      {
        id: `avail_${baseId}_2`,
        ticketKind: request.ticketKind,
        providerName: this.providerName,
        title: `${request.ticketKind} option 2`,
        routeOrVenue: routeOrVenue(request),
        departureOrStartAt: `${request.date}T13:00:00.000Z`,
        availableSeats: ["B1", "B2"],
        amountMinor: context.amountMinor + 500,
        currency: context.currency,
        simulated: true,
      },
    ];
  }

  async reserve(
    context: ProviderRequestContext,
    request: TicketReservationRequest,
  ): Promise<TicketProviderResult> {
    return this.ticketResult(context, request, {
      ticket_phase: "reserve",
      availability_id: request.availabilityId,
      passenger_or_attendee: request.passengerOrAttendeeName,
      seat: request.seat ?? "",
    });
  }

  async issue(
    context: ProviderRequestContext,
    request: TicketIssueRequest,
  ): Promise<TicketProviderResult> {
    return this.ticketResult(
      context,
      { amountMinor: context.amountMinor, currency: context.currency },
      {
        ticket_phase: "issue",
        reservation_reference: request.reservationReference,
        passenger_or_attendee: request.passengerOrAttendeeName,
      },
    );
  }

  async cancel(
    context: ProviderRequestContext,
    request: TicketCancelRequest,
  ): Promise<TicketProviderResult> {
    const cancellationReference = `cnx_${stableToken(request.reservationReference)}`;
    const base = await this.ticketResult(
      context,
      { amountMinor: context.amountMinor, currency: context.currency },
      {
        ticket_phase: "cancel",
        reservation_reference: request.reservationReference,
        reason: request.reason,
        cancellation_reference: cancellationReference,
      },
    );
    return {
      ...base,
      reservationReference: request.reservationReference,
      issueReference: null,
      maskedTicketCode: null,
      cancellationReference,
      providerStatusCode: "PROVIDER_CANCELLED",
      providerMessage: `Reservation ${request.reservationReference} cancelled.`,
      safeMetadata: compactAttributes({
        ...base.safeMetadata,
        ticket_phase: "cancel",
        reservation_reference: request.reservationReference,
        cancellation_reference: cancellationReference,
        reason: request.reason,
      }),
    };
  }

  private async ticketResult(
    context: ProviderRequestContext,
    request: { readonly amountMinor: number; readonly currency: string },
    metadata: SourceAttributes,
  ): Promise<TicketProviderResult> {
    const scenario = getMockScenario(context);
    const result = buildProviderResult({
      context,
      request,
      serviceKind: this.serviceKinds[0] ?? "CINEMA_TICKET",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: this.referencePrefix,
      extraMetadata: metadata,
    });

    return {
      ...result,
      ticketKind: this.ticketKind,
      reservationReference:
        scenario === "TIMEOUT" ? null : `res_${result.providerReference}`,
      issueReference:
        scenario === "SUCCESS" || scenario === "DUPLICATE"
          ? `iss_${result.providerReference}`
          : null,
      maskedTicketCode:
        scenario === "SUCCESS" || scenario === "DUPLICATE"
          ? `TKT-${stableToken(context.transactionId).slice(0, 4)}-****`
          : null,
      cancellationReference: null,
    };
  }
}

export class MockPaymentProvider implements PaymentProvider {
  readonly mode = "MOCK" as const;
  readonly id = "mock_payment_adapter";
  readonly providerId = "mock_payment_provider";
  readonly providerName = "Mock Payment Provider";
  readonly serviceKinds = ["WALLET_FUNDING"] as const;

  async execute(
    context: ProviderRequestContext,
    request: PaymentProviderRequest,
  ): Promise<PaymentProviderResult> {
    const scenario = getMockScenario(context);
    const result = buildProviderResult({
      context,
      request,
      serviceKind: "WALLET_FUNDING",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: "pay",
      extraMetadata: {
        payment_intent_id: request.paymentIntentId,
        payment_reference: request.paymentReference,
        requested_authorization_state: request.authorizationState,
        requested_settlement_state: request.settlementState,
      },
    });

    return {
      ...result,
      paymentReference: request.paymentReference,
      authorizationState: authorizationState(scenario),
      settlementState:
        scenario === "MISMATCH" ? "MISMATCH" : request.settlementState,
    };
  }

  async queryStatus(context: ProviderRequestContext): Promise<ProviderResult> {
    return buildMockStatusResult({
      context,
      serviceKind: "WALLET_FUNDING",
      providerId: this.providerId,
      providerName: this.providerName,
      referencePrefix: "pay",
    });
  }
}

export function createMockServiceProvider<
  Request extends { readonly amountMinor?: number; readonly currency?: string },
>(options: MockProviderOptions): MockServiceProvider<Request> {
  return new MockServiceProvider<Request>(options);
}

function buildProviderResult<
  Request extends { readonly amountMinor?: number; readonly currency?: string },
>(input: {
  readonly context: ProviderRequestContext;
  readonly request: Request;
  readonly serviceKind: MarketplaceServiceKind;
  readonly providerId: string;
  readonly providerName: string;
  readonly referencePrefix: string;
  readonly extraMetadata: SourceAttributes;
}): ProviderResult {
  const scenario = getMockScenario(input.context);
  const amountMinor = resultAmountMinor(input.context, input.request);
  const currency = input.request.currency ?? input.context.currency;
  const latencyMs = SCENARIO_LATENCY_MS[scenario];
  const responseTimestamp =
    scenario === "TIMEOUT"
      ? null
      : addMilliseconds(input.context.requestedAt, latencyMs);
  const providerReference =
    scenario === "TIMEOUT"
      ? null
      : deriveProviderReference(input.referencePrefix, input.context);
  const canonicalPaymentStatus = SCENARIO_CANONICAL_STATUS[scenario];
  const sourceAttributes = compactAttributes({
    ...input.context.metadata,
    ...input.extraMetadata,
    simulated: "true",
    scenario,
    provider_id: input.providerId,
    provider_name: input.providerName,
    service_kind: input.serviceKind,
    request_id: input.context.requestId,
    correlation_id: input.context.correlationId,
    attempt_number: String(input.context.attemptNumber),
    provider_status: SCENARIO_STATUS[scenario],
    provider_status_code: providerStatusCode(scenario),
    provider_message: providerMessage(scenario),
    provider_reference: providerReference,
    requested_at: input.context.requestedAt,
    responded_at: responseTimestamp,
    latency_ms: String(latencyMs),
  });
  const reconciliationFacts =
    scenario === "TIMEOUT"
      ? null
      : {
          providerId: input.providerId,
          providerReference,
          amountMinor,
          currency,
          canonicalStatus: canonicalPaymentStatus,
          occurredAt: responseTimestamp,
          sourceAttributes,
        };

  return {
    providerId: input.providerId,
    providerName: input.providerName,
    serviceKind: input.serviceKind,
    scenario,
    providerReference,
    requestId: input.context.requestId,
    correlationId: input.context.correlationId,
    attemptNumber: input.context.attemptNumber,
    requestTimestamp: input.context.requestedAt,
    responseTimestamp,
    providerStatus: SCENARIO_STATUS[scenario],
    providerStatusCode: providerStatusCode(scenario),
    providerMessage: providerMessage(scenario),
    attemptStatus: SCENARIO_ATTEMPT_STATUS[scenario],
    canonicalPaymentStatus,
    amountMinor,
    currency,
    latencyMs,
    sourceAttributes,
    reconciliationFacts,
    safeMetadata: sourceAttributes,
    duplicateResults:
      scenario === "DUPLICATE" && reconciliationFacts !== null
        ? [reconciliationFacts]
        : [],
    simulated: true,
  };
}

function buildMockStatusResult(input: {
  readonly context: ProviderRequestContext;
  readonly serviceKind: MarketplaceServiceKind;
  readonly providerId: string;
  readonly providerName: string;
  readonly referencePrefix: string;
}): ProviderResult {
  return buildProviderResult({
    context: input.context,
    request: {
      amountMinor: input.context.amountMinor,
      currency: input.context.currency,
    },
    serviceKind: input.serviceKind,
    providerId: input.providerId,
    providerName: input.providerName,
    referencePrefix: input.referencePrefix,
    extraMetadata: {},
  });
}

function getMockScenario(
  context: ProviderRequestContext,
): MockProviderScenario {
  if (context.scenario === undefined) {
    throw new Error(
      "MockProvider requires context.scenario; got undefined. " +
        "Mock mode is misconfigured - scenario should be set by " +
        "buildServiceContext.",
    );
  }
  return context.scenario;
}

function resultAmountMinor(
  context: ProviderRequestContext,
  request: { readonly amountMinor?: number },
): number | null {
  const scenario = getMockScenario(context);
  if (scenario === "TIMEOUT") {
    return null;
  }
  const requested = request.amountMinor ?? context.amountMinor;
  if (scenario === "MISMATCH") {
    return requested + 100;
  }
  if (scenario === "PARTIAL_SUCCESS") {
    return Math.floor(requested / 2);
  }
  return requested;
}

function deriveProviderReference(
  prefix: string,
  context: ProviderRequestContext,
): string {
  const scenario = getMockScenario(context);
  const base = stableToken(
    `${context.providerId}_${context.transactionId}_${context.customerReference}_${context.attemptNumber}`,
  );
  if (scenario === "MISMATCH") {
    return `${prefix}_mismatch_${base}`;
  }
  return `${prefix}_${base}`;
}

function serviceRequestMetadata(request: object): SourceAttributes {
  return Object.fromEntries(
    Object.entries(request).map(([key, value]) => [key, String(value)]),
  );
}

function compactAttributes(attributes: {
  readonly [key: string]: string | null | undefined;
}): SourceAttributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, string] =>
        entry[1] !== null && entry[1] !== undefined,
    ),
  );
}

function addMilliseconds(isoTimestamp: string, milliseconds: number): string {
  return new Date(Date.parse(isoTimestamp) + milliseconds).toISOString();
}

function stableToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function providerStatusCode(scenario: MockProviderScenario): string {
  return `MOCK_${scenario}`;
}

function providerMessage(scenario: MockProviderScenario): string {
  switch (scenario) {
    case "SUCCESS":
      return "Simulated provider completed the request.";
    case "FAILED":
      return "Simulated provider rejected the request.";
    case "PENDING":
      return "Simulated provider has not completed confirmation.";
    case "TIMEOUT":
      return "Simulated provider did not respond before timeout.";
    case "DUPLICATE":
      return "Simulated provider returned duplicate facts.";
    case "PARTIAL_SUCCESS":
      return "Simulated provider completed part of the request.";
    case "REVERSED":
      return "Simulated provider reports the transaction was reversed.";
    case "REFUND_PENDING":
      return "Simulated provider reports refund pending.";
    case "REFUND_COMPLETED":
      return "Simulated provider reports refund completed.";
    case "MISMATCH":
      return "Simulated provider returned facts that do not match the request.";
    case "UNKNOWN":
      return "Simulated provider returned an unmapped status.";
  }
}

function maskedCode(context: ProviderRequestContext): string {
  return `GC-${stableToken(context.transactionId).slice(0, 4)}-****`;
}

function giftCardDeliveryStatus(
  scenario: MockProviderScenario,
): GiftCardDeliveryStatus {
  switch (scenario) {
    case "SUCCESS":
    case "DUPLICATE":
      return "DELIVERED";
    case "FAILED":
    case "TIMEOUT":
      return "FAILED";
    case "PENDING":
    case "REFUND_PENDING":
      return "PENDING";
    default:
      return "NOT_DELIVERED";
  }
}

function giftCardCodeStatus(
  scenario: MockProviderScenario,
): GiftCardCodeStatus {
  if (scenario === "UNKNOWN") {
    return "UNKNOWN";
  }
  return "UNREDEEMED";
}

function authorizationState(
  scenario: MockProviderScenario,
): PaymentProviderResult["authorizationState"] {
  switch (scenario) {
    case "SUCCESS":
    case "DUPLICATE":
    case "PARTIAL_SUCCESS":
    case "REFUND_COMPLETED":
    case "MISMATCH":
      return "AUTHORIZED";
    case "FAILED":
    case "REVERSED":
      return "DECLINED";
    case "PENDING":
    case "REFUND_PENDING":
    case "TIMEOUT":
      return "PENDING";
    case "UNKNOWN":
      return "UNKNOWN";
  }
}

function routeOrVenue(request: TicketSearchRequest): string {
  return request.destination === null
    ? request.originOrVenue
    : `${request.originOrVenue} to ${request.destination}`;
}
