import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import type {
  MarketplaceServiceKind,
  MockProviderScenario,
  ProviderAttemptStatus,
} from "../types.ts";

export type ProviderMode = "MOCK" | "REAL";

export type ProviderStatus =
  | "PROVIDER_SUCCESS"
  | "PROVIDER_FAILED"
  | "PROVIDER_PENDING"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_DUPLICATE"
  | "PROVIDER_PARTIAL_SUCCESS"
  | "PROVIDER_REVERSED"
  | "PROVIDER_REFUND_PENDING"
  | "PROVIDER_REFUND_COMPLETED"
  | "PROVIDER_MISMATCH"
  | "PROVIDER_UNKNOWN";

export interface ProviderRequestContext {
  readonly transactionId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attemptNumber: number;
  readonly customerReference: string;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
  readonly scenario: MockProviderScenario;
  readonly amountMinor: number;
  readonly currency: string;
  readonly metadata: SourceAttributes;
}

export interface ProviderReconciliationFacts {
  readonly providerId: string;
  readonly providerReference: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly canonicalStatus: CanonicalPaymentStatus;
  readonly occurredAt: string | null;
  readonly sourceAttributes: SourceAttributes;
}

export interface ProviderResult {
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKind: MarketplaceServiceKind;
  readonly scenario: MockProviderScenario;
  readonly providerReference: string | null;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attemptNumber: number;
  readonly requestTimestamp: string;
  readonly responseTimestamp: string | null;
  readonly providerStatus: ProviderStatus;
  readonly providerStatusCode: string;
  readonly providerMessage: string;
  readonly attemptStatus: ProviderAttemptStatus;
  readonly canonicalPaymentStatus: CanonicalPaymentStatus;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly latencyMs: number;
  readonly sourceAttributes: SourceAttributes;
  readonly reconciliationFacts: ProviderReconciliationFacts | null;
  readonly safeMetadata: SourceAttributes;
  readonly duplicateResults: readonly ProviderReconciliationFacts[];
  readonly simulated: boolean;
}

export interface ProviderAdapter<Request> {
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly mode: ProviderMode;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  execute(
    context: ProviderRequestContext,
    request: Request,
  ): Promise<ProviderResult>;
}

export interface AmountRequest {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface AirtimeProviderRequest extends AmountRequest {
  readonly recipient: string;
  readonly network: string;
  readonly productCode: string;
}

export interface DataProviderRequest extends AmountRequest {
  readonly recipient: string;
  readonly network: string;
  readonly bundleId: string;
}

export interface ElectricityProviderRequest extends AmountRequest {
  readonly meterNumber: string;
  readonly disco: string;
  readonly customerName: string | null;
  readonly tokenRequired: boolean;
}

export interface CableProviderRequest extends AmountRequest {
  readonly subscriberId: string;
  readonly packageCode: string;
  readonly provider: string;
}

export interface InternetProviderRequest extends AmountRequest {
  readonly accountId: string;
  readonly planId: string;
  readonly provider: string;
}

export interface EducationProviderRequest extends AmountRequest {
  readonly examBody: string;
  readonly productCode: string;
  readonly candidateName: string | null;
  readonly deliveryTarget: string | null;
}

export interface GiftCardProviderRequest {
  readonly brand: string;
  readonly region: string;
  readonly denominationMinor: number;
  readonly quantity: number;
  readonly currency: string;
  readonly recipientEmail: string | null;
}

export type GiftCardDeliveryStatus =
  "NOT_DELIVERED" | "PENDING" | "DELIVERED" | "FAILED";

export type GiftCardCodeStatus = "UNREDEEMED" | "REDEEMED" | "UNKNOWN";

export interface GiftCardProviderResult extends ProviderResult {
  readonly deliveryStatus: GiftCardDeliveryStatus;
  readonly codeStatus: GiftCardCodeStatus;
  readonly maskedCodePreview: string | null;
  readonly riskFlags: readonly string[];
}

export type TicketProviderKind = "CINEMA" | "EVENT" | "BUS" | "AIRLINE";

export interface TicketSearchRequest {
  readonly ticketKind: TicketProviderKind;
  readonly originOrVenue: string;
  readonly destination: string | null;
  readonly date: string;
  readonly passengers: number;
}

export interface TicketAvailability {
  readonly id: string;
  readonly ticketKind: TicketProviderKind;
  readonly providerName: string;
  readonly title: string;
  readonly routeOrVenue: string;
  readonly departureOrStartAt: string;
  readonly availableSeats: readonly string[];
  readonly amountMinor: number;
  readonly currency: string;
  readonly simulated: true;
}

export interface TicketReservationRequest extends AmountRequest {
  readonly ticketKind: TicketProviderKind;
  readonly availabilityId: string;
  readonly passengerOrAttendeeName: string;
  readonly seat: string | null;
}

export interface TicketIssueRequest {
  readonly ticketKind: TicketProviderKind;
  readonly reservationReference: string;
  readonly passengerOrAttendeeName: string;
}

export interface TicketCancelRequest {
  readonly ticketKind: TicketProviderKind;
  readonly reservationReference: string;
  readonly reason: string;
}

export interface TicketProviderResult extends ProviderResult {
  readonly ticketKind: TicketProviderKind;
  readonly reservationReference: string | null;
  readonly issueReference: string | null;
  readonly maskedTicketCode: string | null;
  readonly cancellationReference: string | null;
}

export interface PaymentProviderRequest extends AmountRequest {
  readonly paymentIntentId: string;
  readonly paymentReference: string;
  readonly authorizationState: "REQUESTED" | "AUTHORIZED" | "DECLINED";
  readonly settlementState: "NOT_SETTLED" | "PENDING" | "SETTLED" | "MISMATCH";
}

export interface PaymentProviderResult extends ProviderResult {
  readonly paymentReference: string;
  readonly authorizationState:
    "AUTHORIZED" | "DECLINED" | "PENDING" | "UNKNOWN";
  readonly settlementState: "NOT_SETTLED" | "PENDING" | "SETTLED" | "MISMATCH";
}

export interface AirtimeProvider extends ProviderAdapter<AirtimeProviderRequest> {}

export interface DataProvider extends ProviderAdapter<DataProviderRequest> {}

export interface ElectricityProvider extends ProviderAdapter<ElectricityProviderRequest> {}

export interface CableProvider extends ProviderAdapter<CableProviderRequest> {}

export interface InternetProvider extends ProviderAdapter<InternetProviderRequest> {}

export interface EducationProvider extends ProviderAdapter<EducationProviderRequest> {}

export interface GiftCardProvider extends ProviderAdapter<GiftCardProviderRequest> {
  execute(
    context: ProviderRequestContext,
    request: GiftCardProviderRequest,
  ): Promise<GiftCardProviderResult>;
}

export interface TicketingProvider {
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly mode: ProviderMode;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  searchAvailability(
    context: ProviderRequestContext,
    request: TicketSearchRequest,
  ): Promise<readonly TicketAvailability[]>;
  reserve(
    context: ProviderRequestContext,
    request: TicketReservationRequest,
  ): Promise<TicketProviderResult>;
  issue(
    context: ProviderRequestContext,
    request: TicketIssueRequest,
  ): Promise<TicketProviderResult>;
  cancel(
    context: ProviderRequestContext,
    request: TicketCancelRequest,
  ): Promise<TicketProviderResult>;
}

export interface CinemaProvider extends TicketingProvider {}

export interface EventProvider extends TicketingProvider {}

export interface BusProvider extends TicketingProvider {}

export interface AirlineProvider extends TicketingProvider {}

export interface PaymentProvider extends ProviderAdapter<PaymentProviderRequest> {
  execute(
    context: ProviderRequestContext,
    request: PaymentProviderRequest,
  ): Promise<PaymentProviderResult>;
}
