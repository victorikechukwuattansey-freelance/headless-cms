import { buildInputsKey } from "../ids.ts";
import { findServiceById } from "./catalog.ts";
import {
  appendTransactionEvent,
  sourceAttributes,
  TransactionEventType,
} from "./timeline.ts";
import type {
  MarketplaceServiceKind,
  MockProviderScenario,
  TicketArtifact,
  TransactionEvent,
} from "./types.ts";
import type {
  ProviderRequestContext,
  TicketAvailability,
  TicketCancelRequest,
  TicketingProvider,
} from "./providers/contracts.ts";
import type { MarketplaceTransactionDeps } from "./transactions.ts";
import { buildServiceContext, buildTicketSearch } from "./transactions.ts";
import { WALLET_FIXED_TIMESTAMP } from "./wallet.ts";
import { ticketArtifactId } from "./artifacts.ts";

/**
 * Phase 2H ticketing application surface.
 *
 * Search, availability, reservation, issuance, and cancellation are the
 * first-class UX primitives for ticketing services. `searchTicketAvailability`
 * is a read-only pre-checkout lookup; `cancelTicketTransaction` is a
 * fulfillment-level state transition that is deliberately distinct from a
 * refund — cancelling a reservation never fabricates a money movement or
 * touches resolution state.
 */

const CANCEL_ATTEMPT_NUMBER = 90;

export type TicketFlowErrorCode =
  | "SERVICE_NOT_FOUND"
  | "NOT_TICKETING_SERVICE"
  | "TRANSACTION_NOT_FOUND"
  | "TICKET_ARTIFACT_NOT_FOUND"
  | "TICKET_NOT_CANCELLABLE"
  | "PROVIDER_CANCELLATION_FAILED";

export class TicketFlowError extends Error {
  readonly code: TicketFlowErrorCode;

  constructor(code: TicketFlowErrorCode, message: string) {
    super(message);
    this.name = "TicketFlowError";
    this.code = code;
  }
}

const TICKETING_KINDS: readonly MarketplaceServiceKind[] = [
  "CINEMA_TICKET",
  "EVENT_TICKET",
  "BUS_TICKET",
  "AIRLINE_TICKET",
];

function isTicketingKind(kind: MarketplaceServiceKind): boolean {
  return TICKETING_KINDS.includes(kind);
}

/**
 * Read-only availability lookup for a ticketing service. Never writes to the
 * store and never moves money; the UI can enumerate options pre-checkout.
 */
export async function searchTicketAvailability(
  deps: MarketplaceTransactionDeps,
  input: {
    readonly serviceId: string;
    readonly scenario?: MockProviderScenario;
    readonly inputs: Readonly<Record<string, string>>;
    readonly now?: string;
  },
): Promise<readonly TicketAvailability[]> {
  const service = findServiceById(deps.catalog, input.serviceId);
  if (service === undefined) {
    throw new TicketFlowError(
      "SERVICE_NOT_FOUND",
      `unknown service ${input.serviceId}`,
    );
  }
  if (!isTicketingKind(service.kind)) {
    throw new TicketFlowError(
      "NOT_TICKETING_SERVICE",
      `service ${input.serviceId} is not a ticketing service`,
    );
  }
  const scenario = input.scenario ?? "SUCCESS";
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const provider = deps.registry.providerForServiceKind(
    service.kind,
  ) as unknown as TicketingProvider;
  const searchTransactionId = `search_${buildInputsKey({
    service: input.serviceId,
    inputs: buildInputsKey(input.inputs),
    scenario,
  })}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40);
  const context: ProviderRequestContext = buildServiceContext({
    transactionId: searchTransactionId,
    customerId: "search_customer",
    service,
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario,
    amountMinor: 0,
    currency: "NGN",
    now,
    attemptNumber: 1,
  });
  return provider.searchAvailability(
    context,
    buildTicketSearch(service.kind, input.inputs),
  );
}

export interface CancelTicketOutcome {
  readonly ticket: TicketArtifact;
  readonly event: TransactionEvent | null;
  readonly cancellationReference: string;
  readonly replayed: boolean;
}

/**
 * Cancel a reserved or issued ticket at the fulfillment layer.
 *
 * Guard rails:
 * - Only a real persisted ticket artifact for the transaction can be cancelled.
 * - A transaction whose money already moved back (REFUNDED/REVERSED) is NOT
 *   cancellable: cancellation is a fulfillment transition, never a refund.
 * - Cancellation appends a TICKET_CANCELLED timeline event and a latest-wins
 *   artifact line; it never rewrites history and never fabricates a refund.
 * - Replaying a cancellation resolves to the existing cancelled state with no
 *   new writes and `replayed: true`.
 */
export async function cancelTicketTransaction(
  deps: MarketplaceTransactionDeps,
  input: {
    readonly transactionId: string;
    readonly reason?: string;
    readonly now?: string;
  },
): Promise<CancelTicketOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await deps.repos.marketplaceTransactions.readLatestById(
    input.transactionId,
  );
  if (transaction === null) {
    throw new TicketFlowError(
      "TRANSACTION_NOT_FOUND",
      `transaction ${input.transactionId} not found`,
    );
  }
  const artifact = await deps.repos.ticketArtifacts.getById(
    ticketArtifactId(input.transactionId),
  );
  if (artifact === null) {
    throw new TicketFlowError(
      "TICKET_ARTIFACT_NOT_FOUND",
      `no ticket artifact for transaction ${input.transactionId}`,
    );
  }

  if (artifact.status === "CANCELLED") {
    return {
      ticket: artifact,
      event: null,
      cancellationReference: artifact.cancellationReference ?? "",
      replayed: true,
    };
  }

  if (
    transaction.resolutionStatus === "REFUNDED" ||
    transaction.resolutionStatus === "REVERSED" ||
    artifact.status === "REFUNDED" ||
    artifact.reservationReference === null
  ) {
    throw new TicketFlowError(
      "TICKET_NOT_CANCELLABLE",
      `transaction ${input.transactionId} cannot be cancelled (resolution ${transaction.resolutionStatus}, ticket status ${artifact.status})`,
    );
  }

  const service = findServiceById(deps.catalog, transaction.serviceId);
  if (service === undefined) {
    throw new TicketFlowError(
      "SERVICE_NOT_FOUND",
      `unknown service ${transaction.serviceId}`,
    );
  }
  const provider = deps.registry.providerForServiceKind(
    service.kind,
  ) as unknown as TicketingProvider;
  const context: ProviderRequestContext = buildServiceContext({
    transactionId: transaction.id,
    customerId: transaction.customerId,
    service,
    providerId: provider.providerId,
    providerName: provider.providerName,
    scenario: "SUCCESS",
    amountMinor: 0,
    currency: "NGN",
    now,
    attemptNumber: CANCEL_ATTEMPT_NUMBER,
  });
  const request: TicketCancelRequest = {
    ticketKind: artifact.ticketKind,
    reservationReference: artifact.reservationReference,
    reason: input.reason ?? "Customer cancellation",
  };
  const result = await provider.cancel(context, request);
  if (result.cancellationReference === null) {
    throw new TicketFlowError(
      "PROVIDER_CANCELLATION_FAILED",
      `provider did not confirm cancellation for reservation ${artifact.reservationReference}`,
    );
  }

  const cancelled: TicketArtifact = {
    ...artifact,
    status: "CANCELLED",
    cancellationReference: result.cancellationReference,
    cancelledAt: now,
    simulated: true,
  };
  await deps.repos.ticketArtifacts.insert(cancelled);

  const event = await appendTransactionEvent(deps.repos, {
    transactionId: transaction.id,
    type: TransactionEventType.TicketCancelled,
    label: "Ticket cancelled",
    description: `Reservation ${artifact.reservationReference} cancelled.`,
    actor: "OPERATOR",
    source: "MARKETPLACE",
    metadata: sourceAttributes({
      reservation_reference: artifact.reservationReference,
      cancellation_reference: result.cancellationReference,
      ticket_kind: artifact.ticketKind,
      reason: input.reason ?? "Customer cancellation",
      provider_status: result.providerStatus,
    }),
    occurredAt: now,
  });

  return {
    ticket: cancelled,
    event,
    cancellationReference: result.cancellationReference,
    replayed: false,
  };
}
