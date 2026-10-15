import type {
  CanonicalPaymentStatus,
  Outcome,
  ReconciliationCode,
  SourceAttributes,
} from "../../../src/domain/model.ts";

export type MarketplaceServiceKind =
  | "AIRTIME"
  | "DATA"
  | "ELECTRICITY"
  | "CABLE_TV"
  | "INTERNET"
  | "EDUCATION"
  | "GIFT_CARD"
  | "DIGITAL_VOUCHER"
  | "CINEMA_TICKET"
  | "EVENT_TICKET"
  | "BUS_TICKET"
  | "AIRLINE_TICKET"
  | "WALLET_FUNDING"
  | "BETTING";

export type CatalogGroup =
  | "CORE_VTU_BILL_PAYMENT"
  | "DIGITAL_GOODS"
  | "TICKETING"
  | "WALLET_PAYMENT"
  | "FUTURE_COMPLIANCE_GATED";

export type ComplianceStatus = "AVAILABLE" | "MOCK_ONLY" | "COMPLIANCE_GATED";

export type MockProviderScenario =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "TIMEOUT"
  | "DUPLICATE"
  | "PARTIAL_SUCCESS"
  | "REVERSED"
  | "REFUND_PENDING"
  | "REFUND_COMPLETED"
  | "MISMATCH"
  | "UNKNOWN";

export type MarketplaceOrderStatus =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_AUTHORIZED"
  | "PROVIDER_PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "MANUAL_REVIEW";

export type FulfillmentStatus =
  "NOT_STARTED" | "PENDING" | "FULFILLED" | "FAILED" | "PARTIAL" | "CANCELLED";

export type ResolutionStatus =
  | "NONE"
  | "REFUND_INITIATED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REVERSAL_INITIATED"
  | "REVERSED"
  | "MANUAL_REVIEW"
  | "DISPUTED";

export type CustomerTransactionStatus =
  | "CONFIRMED"
  | "PENDING"
  | "FAILED"
  | "NEEDS_ATTENTION"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REVERSED"
  | "MANUAL_REVIEW";

export type AdminTransactionStatus =
  | "HEALTHY"
  | "PENDING_PROVIDER"
  | "PROVIDER_FAILED"
  | "MISMATCH"
  | "DUPLICATE"
  | "REFUND_QUEUE"
  | "REVERSAL_QUEUE"
  | "MANUAL_REVIEW"
  | "UNRESOLVED";

export type WalletStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export type WalletLedgerType =
  | "OPENING_BALANCE"
  | "FUNDING_INITIATED"
  | "FUNDING_SUCCESS"
  | "FUNDING_FAILED"
  | "AUTHORIZATION_REQUESTED"
  | "AUTHORIZATION_APPROVED"
  | "AUTHORIZATION_FAILED"
  | "DEBIT_PENDING"
  | "DEBIT_SUCCESS"
  | "DEBIT_FAILED"
  | "DUPLICATE_DEBIT"
  | "REVERSAL_INITIATED"
  | "REVERSAL_COMPLETED"
  | "REFUND_INITIATED"
  | "REFUND_PENDING"
  | "REFUND_COMPLETED"
  | "SETTLEMENT_PENDING"
  | "SETTLEMENT_MATCHED"
  | "SETTLEMENT_MISMATCH";

export type WalletLedgerStatus = "PENDING" | "POSTED" | "FAILED" | "REVERSED";

export type PaymentLifecycleState =
  | "INITIATED"
  | "AUTHORIZED"
  | "PENDING"
  | "FAILED"
  | "SETTLED"
  | "REVERSED"
  | "REFUND_PENDING"
  | "REFUNDED";

export type ProviderAttemptStatus =
  | "NOT_SENT"
  | "SENT"
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "TIMEOUT"
  | "DUPLICATE"
  | "MISMATCH"
  | "UNKNOWN";

export type TransactionEventActor =
  "CUSTOMER" | "SYSTEM" | "MOCK_PROVIDER" | "RECONCILE_KIT" | "OPERATOR";

export type TransactionEventSource =
  "MARKETPLACE" | "WALLET" | "PROVIDER" | "RECONCILE_KIT" | "RESOLUTION";

export type RefundLifecycleStatus =
  "NONE" | "INITIATED" | "PENDING" | "COMPLETED" | "FAILED_REVIEW";

export type ReversalLifecycleStatus =
  "NONE" | "INITIATED" | "COMPLETED" | "FAILED_REVIEW";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CANCELLED";

export type TicketKind = "CINEMA" | "EVENT" | "BUS" | "AIRLINE";

export type TicketStatus =
  "RESERVED" | "ISSUED" | "PENDING" | "CANCELLED" | "REFUNDED";

export type GiftCardDeliveryStatus =
  "NOT_DELIVERED" | "PENDING" | "DELIVERED" | "FAILED";

export type GiftCardRedemptionStatus = "UNREDEEMED" | "REDEEMED" | "UNKNOWN";

export type ManualReviewStatus =
  "OPEN" | "IN_REVIEW" | "RESOLVED" | "ESCALATED";

export type NotificationStatus = "UNREAD" | "READ" | "ARCHIVED";

export interface MarketplaceCustomer {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly isDemo: boolean;
  readonly createdAt: string;
}

export interface MarketplaceCategory {
  readonly id: string;
  readonly group: CatalogGroup;
  readonly name: string;
  readonly description: string;
  readonly complianceStatus: ComplianceStatus;
  readonly displayOrder: number;
  readonly simulated: true;
}

export interface MarketplaceService {
  readonly id: string;
  readonly categoryId: string;
  readonly providerId: string;
  readonly kind: MarketplaceServiceKind;
  readonly name: string;
  readonly description: string;
  readonly currency: string;
  readonly baseAmountMinor: number;
  readonly complianceStatus: ComplianceStatus;
  readonly fulfillmentType: FulfillmentType;
  readonly availability: AvailabilityStatus;
  readonly inputSchema: readonly ServiceInputDescriptor[];
  readonly simulated: true;
}

export interface ServiceInputDescriptor {
  readonly name: string;
  readonly label: string;
  readonly type: "TEXT" | "NUMBER" | "EMAIL" | "PHONE" | "SELECT" | "DATE";
  readonly required: boolean;
  readonly options?: readonly string[];
}

/**
 * Explicit fulfillment classification describing HOW a service is delivered.
 * Kept coarse so every service maps to exactly one category without bespoke
 * product systems. See docs/MARKETPLACE_CATALOG_ARCHITECTURE.md.
 */
export type FulfillmentType =
  | "INSTANT_DIGITAL"
  | "UTILITY"
  | "SUBSCRIPTION"
  | "DIGITAL_GOOD"
  | "RESERVATION"
  | "TICKET"
  | "FUTURE_COMPLIANCE_GATED";

export type AvailabilityStatus =
  "AVAILABLE" | "UNAVAILABLE" | "BUSY" | "SOLD_OUT" | "COMPLIANCE_GATED";

/**
 * Pricing ladder for a product or service. Each rung corresponds to a point in
 * the eventual transaction lifecycle; none of them is assumed to equal the
 * final reconciliation truth. See docs/MARKETPLACE_CATALOG_ARCHITECTURE.md.
 */
export interface ProductPricing {
  readonly catalogPriceMinor: number;
  readonly currency: string;
  readonly previewPriceMinor?: number;
  readonly availabilitySearchMinimumMinor?: number;
}

export interface CatalogProduct {
  readonly id: string;
  readonly serviceId: string;
  readonly categoryId: string;
  readonly providerId: string;
  readonly name: string;
  readonly description: string;
  readonly kind: MarketplaceServiceKind;
  readonly fulfillmentType: FulfillmentType;
  readonly pricing: ProductPricing;
  readonly availability: AvailabilityStatus;
  readonly attributes: Readonly<Record<string, string>>;
  readonly simulated: true;
}

export interface MarketAvailabilityResult {
  readonly productId: string;
  readonly serviceId: string;
  readonly available: boolean;
  readonly displayAvailable: boolean;
  readonly capacityRemaining: number | null;
  readonly priceMinor: number | null;
  readonly message: string;
  readonly simulated: true;
}

export interface MarketplaceCatalog {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly categories: readonly MarketplaceCategory[];
  readonly services: readonly MarketplaceService[];
  readonly products: readonly CatalogProduct[];
  readonly simulated: true;
  readonly createdAt: string;
}

export interface MarketplaceProvider {
  readonly id: string;
  readonly name: string;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  readonly simulated: true;
  readonly createdAt: string;
}

export interface MarketplaceWallet {
  readonly id: string;
  readonly customerId: string;
  readonly currency: string;
  readonly openingBalanceMinor: number;
  readonly status: WalletStatus;
  readonly simulated: true;
  readonly createdAt: string;
}

export interface WalletLedgerEntry {
  readonly id: string;
  readonly walletId: string;
  readonly transactionId: string | null;
  readonly type: WalletLedgerType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: WalletLedgerStatus;
  readonly reference: string;
  readonly occurredAt: string;
  readonly metadata: SourceAttributes;
  readonly simulated: true;
}

export interface MarketplaceOrder {
  readonly id: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly inputs: Readonly<Record<string, string>>;
  readonly quotedAmountMinor: number;
  readonly currency: string;
  readonly customerReference: string;
  readonly status: MarketplaceOrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly simulated: true;
}

export interface MarketplacePaymentRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly walletReference: string;
  readonly providerReference: string | null;
  readonly expectedAmountMinor: number;
  readonly actualAmountMinor: number | null;
  readonly currency: string;
  readonly status: CanonicalPaymentStatus;
  readonly paidAt: string | null;
  readonly metadata: SourceAttributes;
  readonly recordedAt: string;
  readonly simulated: true;
}

export interface MarketplaceTransaction {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly reference: string;
  readonly scenario: MockProviderScenario;
  readonly paymentStatus: CanonicalPaymentStatus;
  readonly fulfillmentStatus: FulfillmentStatus;
  readonly reconcileOutcome: Outcome | null;
  readonly resolutionStatus: ResolutionStatus;
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
  readonly simulated: true;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly demoScenarioName?: string;
}

export interface ProviderAttempt {
  readonly id: string;
  readonly transactionId: string;
  readonly providerId: string;
  readonly serviceId: string;
  readonly scenario: MockProviderScenario;
  readonly requestReference: string;
  readonly providerReference: string | null;
  readonly status: ProviderAttemptStatus;
  readonly canonicalStatus: CanonicalPaymentStatus | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly latencyMs: number;
  readonly sourceAttributes: SourceAttributes;
  readonly attemptedAt: string;
  readonly simulated: true;
}

export interface TransactionEvent {
  readonly id: string;
  readonly transactionId: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly actor: TransactionEventActor;
  readonly source: TransactionEventSource;
  readonly metadata: SourceAttributes;
  readonly simulated: true;
}

export interface ReconciliationSnapshot {
  readonly outcome: Outcome;
  readonly codes: readonly ReconciliationCode[];
  readonly notes: readonly string[];
  readonly sourceAttributes: SourceAttributes;
}

export interface EvidencePack {
  readonly id: string;
  readonly transactionId: string;
  readonly customerReference: string;
  readonly providerReference: string | null;
  readonly paymentReference: string | null;
  readonly serviceSnapshot: MarketplaceService;
  readonly amountMinor: number;
  readonly currency: string;
  readonly timelineEventIds: readonly string[];
  readonly providerFacts: SourceAttributes;
  readonly reconciliation: ReconciliationSnapshot | null;
  readonly mismatchFlags: readonly ReconciliationCode[];
  readonly resolutionStatus: ResolutionStatus;
  readonly auditEventIds: readonly string[];
  readonly createdAt: string;
  readonly simulated: true;
}

export interface ReceiptRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly evidencePackId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly issuedAt: string;
  readonly simulated: true;
}

export interface RefundRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: RefundLifecycleStatus;
  readonly reason: string;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly ledgerReference: string | null;
  readonly simulated: true;
}

export interface ReversalRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: ReversalLifecycleStatus;
  readonly reason: string;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly ledgerReference: string | null;
  readonly simulated: true;
}

export interface DisputeRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly reason: string;
  readonly status: DisputeStatus;
  readonly message: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolutionNote: string | null;
  readonly simulated: true;
}

export interface TicketArtifact {
  readonly id: string;
  readonly transactionId: string;
  readonly ticketKind: TicketKind;
  readonly reservationReference: string | null;
  readonly issueReference: string | null;
  readonly passengerOrAttendee: string;
  readonly routeOrVenue: string;
  readonly seat: string | null;
  readonly status: TicketStatus;
  readonly maskedCode: string | null;
  readonly issuedAt: string | null;
  readonly cancellationReference: string | null;
  readonly cancelledAt: string | null;
  readonly simulated: true;
}

export interface GiftCardArtifact {
  readonly id: string;
  readonly transactionId: string;
  readonly brand: string;
  readonly region: string;
  readonly denominationMinor: number;
  readonly currency: string;
  readonly quantity: number;
  readonly deliveryStatus: GiftCardDeliveryStatus;
  readonly redemptionStatus: GiftCardRedemptionStatus;
  readonly maskedCodePreview: string | null;
  readonly riskFlags: readonly string[];
  readonly simulated: true;
}

/**
 * Snapshot of the ticket artifact as it stood when evidence was produced.
 * Deliberately decoupled from the artifact record so later cancellation or
 * issuance churn never mutates already-emitted evidence.
 */
export interface TicketEvidenceFacet {
  readonly ticketKind: TicketKind;
  readonly reservationReference: string | null;
  readonly issueReference: string | null;
  readonly cancellationReference: string | null;
  readonly status: TicketStatus;
  readonly routeOrVenue: string;
  readonly seat: string | null;
  readonly maskedCode: string | null;
  readonly issuedAt: string | null;
}

/**
 * Snapshot of the gift-card artifact as it stood when evidence was produced.
 * Only presents masked code previews; the raw code never leaves the provider.
 */
export interface GiftCardEvidenceFacet {
  readonly brand: string;
  readonly region: string;
  readonly denominationMinor: number;
  readonly quantity: number;
  readonly deliveryStatus: GiftCardDeliveryStatus;
  readonly redemptionStatus: GiftCardRedemptionStatus;
  readonly maskedCodePreview: string | null;
  readonly riskFlags: readonly string[];
}

export interface ManualReviewRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly reason: string;
  readonly status: ManualReviewStatus;
  readonly assignedTo: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly operatorNote: string | null;
  readonly simulated: true;
}

export interface NotificationRecord {
  readonly id: string;
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly title: string;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly createdAt: string;
  readonly simulated: true;
}

export interface FxTransparency {
  readonly sourceCurrency: string;
  readonly destinationCurrency: string;
  readonly quotedRate: string;
  readonly quoteTimestamp: string;
  readonly serviceFeeMinor: number;
  readonly fxFeeMinor: number;
  readonly expectedAmountMinor: number;
  readonly actualAmountMinor: number | null;
  readonly finalDebitMinor: number;
  readonly settlementStatus: CanonicalPaymentStatus;
  readonly discrepancyStatus: Outcome | null;
  readonly simulated: true;
}

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly display_name: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly simulated: true;
}

export interface SessionRecord {
  readonly id: string;
  readonly user_id: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly revoked_at: string | null;
  readonly simulated: true;
}

export interface OrganizationRecord {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly simulated: true;
}

export type MembershipRole = "OWNER" | "OPERATOR" | "VIEWER";

export interface MembershipRecord {
  readonly id: string;
  readonly user_id: string;
  readonly org_id: string;
  readonly role: MembershipRole;
  readonly created_at: string;
  readonly simulated: true;
}
