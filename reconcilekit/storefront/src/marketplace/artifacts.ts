import { buildStableSuffix } from "../ids.ts";
import type { WalletPaymentEvidence } from "./wallet.ts";
import type {
  GiftCardArtifact,
  GiftCardDeliveryStatus,
  GiftCardEvidenceFacet,
  GiftCardRedemptionStatus,
  TicketArtifact,
  TicketEvidenceFacet,
  TicketKind,
  TicketStatus,
} from "./types.ts";

/**
 * Phase 2H artifact surface.
 *
 * Gift-card and ticket artifacts are the marketplace's own durable records of
 * what a provider actually delivered. They are built here (never in Reconcile
 * Kit core) and are snapshotted into payment evidence as readonly facets, so
 * later fulfillment churn (cancellations, redeliveries) never rewrites
 * already-emitted evidence packs.
 */

export interface GiftCardArtifactInput {
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
}

export interface TicketArtifactInput {
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
}

/**
 * Deterministic gift-card artifact id for a transaction. Idempotent replays
 * and late reads (e.g. reconciliation, post-execution lookup) resolve the same
 * record id, which is the store's latest-wins join key.
 */
export function giftCardArtifactId(transactionId: string): string {
  return `gift_${buildStableSuffix(transactionId)}`;
}

/**
 * Deterministic ticket artifact id for a transaction. `cancelTicketTransaction`
 * and the cancellation-replay path both resolve the same latest record.
 */
export function ticketArtifactId(transactionId: string): string {
  return `tkt_${buildStableSuffix(transactionId)}`;
}

/**
 * Factory for the marketplace's gift-card artifact record. Only ever receives
 * already-masked provider data; the raw card code is never materialized here.
 */
export function buildGiftCardArtifact(
  input: GiftCardArtifactInput,
): GiftCardArtifact {
  return {
    id: giftCardArtifactId(input.transactionId),
    transactionId: input.transactionId,
    brand: input.brand,
    region: input.region,
    denominationMinor: input.denominationMinor,
    currency: input.currency,
    quantity: input.quantity,
    deliveryStatus: input.deliveryStatus,
    redemptionStatus: input.redemptionStatus,
    maskedCodePreview: input.maskedCodePreview,
    riskFlags: input.riskFlags,
    simulated: true,
  };
}

/**
 * Factory for the marketplace's ticket artifact record. Cancellation is
 * applied in place (a new latest-wins line), never by rewriting history.
 */
export function buildTicketArtifact(
  input: TicketArtifactInput,
): TicketArtifact {
  return {
    id: ticketArtifactId(input.transactionId),
    transactionId: input.transactionId,
    ticketKind: input.ticketKind,
    reservationReference: input.reservationReference,
    issueReference: input.issueReference,
    passengerOrAttendee: input.passengerOrAttendee,
    routeOrVenue: input.routeOrVenue,
    seat: input.seat,
    status: input.status,
    maskedCode: input.maskedCode,
    issuedAt: input.issuedAt,
    cancellationReference: null,
    cancelledAt: null,
    simulated: true,
  };
}

/**
 * Read-only snapshot of a ticket artifact for evidence emission. The facet
 * carries no secrets: the ticket code is already masked before it reaches the
 * marketplace.
 */
export function ticketEvidenceFacet(
  artifact: TicketArtifact,
): TicketEvidenceFacet {
  return {
    ticketKind: artifact.ticketKind,
    reservationReference: artifact.reservationReference,
    issueReference: artifact.issueReference,
    cancellationReference: artifact.cancellationReference,
    status: artifact.status,
    routeOrVenue: artifact.routeOrVenue,
    seat: artifact.seat,
    maskedCode: artifact.maskedCode,
    issuedAt: artifact.issuedAt,
  };
}

/**
 * Read-only snapshot of a gift-card artifact for evidence emission. Only the
 * masked preview is ever present; the raw card code is not a gift-card
 * artifact field by construction.
 */
export function giftCardEvidenceFacet(
  artifact: GiftCardArtifact,
): GiftCardEvidenceFacet {
  return {
    brand: artifact.brand,
    region: artifact.region,
    denominationMinor: artifact.denominationMinor,
    quantity: artifact.quantity,
    deliveryStatus: artifact.deliveryStatus,
    redemptionStatus: artifact.redemptionStatus,
    maskedCodePreview: artifact.maskedCodePreview,
    riskFlags: artifact.riskFlags,
  };
}

/**
 * Attach flow artifacts to wallet debit evidence as optional facets. Evidence
 * emitted for non-artifact flows is returned unchanged, and absent artifacts
 * produce absent facets — never empty placeholders.
 */
export function decorateEvidence(
  evidence: WalletPaymentEvidence,
  artifacts: readonly (TicketArtifact | GiftCardArtifact)[],
): WalletPaymentEvidence {
  const ticket = artifacts.find(
    (artifact): artifact is TicketArtifact => "ticketKind" in artifact,
  );
  const giftCard = artifacts.find(
    (artifact): artifact is GiftCardArtifact => "brand" in artifact,
  );
  if (ticket === undefined && giftCard === undefined) {
    return evidence;
  }
  return {
    ...evidence,
    ...(ticket !== undefined ? { ticket: ticketEvidenceFacet(ticket) } : {}),
    ...(giftCard !== undefined
      ? { giftCard: giftCardEvidenceFacet(giftCard) }
      : {}),
  };
}
