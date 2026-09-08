import type { JsonlStore } from "../store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "./wallet.ts";
import type { TransactionTruth } from "./truth.ts";
import type { NotificationRecord, NotificationStatus } from "./types.ts";

/**
 * Phase 2G notification surface.
 *
 * Notifications are derived, presentation-safe statements about a
 * transaction's proven state. They are built from the Phase 2F truth projection
 * (`TransactionTruth`) and the resolution state — never from a second engine,
 * never from provider source attributes.
 *
 * Ids are deterministic per (customer, kind, transaction), so replaying an
 * event stream updates the same notification instead of duplicating it
 * (mirroring the store's latest-wins semantics).
 */

export class NotificationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "NotificationError";
    this.code = code;
  }
}

export type NotificationKind =
  | "payment_failed"
  | "refund_pending"
  | "refunded"
  | "reversed"
  | "needs_attention"
  | "manual_review";

export interface NotificationDraft {
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
}

function slugPart(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return cleaned.replace(/^_+|_+$/g, "").slice(0, 48);
}

export function buildNotificationId(
  customerId: string,
  kind: NotificationKind,
  transactionId: string | null,
): string {
  const txn = transactionId === null ? "none" : slugPart(transactionId);
  return `ntf_${slugPart(customerId)}_${kind}_${txn}`;
}

export interface EmitNotificationInput {
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly status?: NotificationStatus;
  readonly now?: string;
}

export async function emitNotification(
  store: JsonlStore,
  input: EmitNotificationInput,
): Promise<NotificationRecord> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const record: NotificationRecord = {
    id: buildNotificationId(input.customerId, input.kind, input.transactionId),
    customerId: input.customerId,
    transactionId: input.transactionId,
    title: input.title,
    body: input.body,
    status: input.status ?? "UNREAD",
    createdAt: now,
    simulated: true,
  };
  await store.insert("notifications", record);
  return record;
}

/**
 * All notifications for one customer, newest first, collapsed by id so a
 * replayed emission resolves to its latest text.
 */
export async function listNotificationsByCustomer(
  store: JsonlStore,
  customerId: string,
): Promise<readonly NotificationRecord[]> {
  const all = await store.readAll<NotificationRecord>("notifications");
  const latestById = new Map<string, NotificationRecord>();
  for (const record of all) {
    if (record.customerId === customerId) {
      latestById.set(record.id, record);
    }
  }
  return Array.from(latestById.values())
    .slice()
    .sort((a, b) => {
      const byTime = b.createdAt.localeCompare(a.createdAt);
      return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
    });
}

export async function markNotificationRead(
  store: JsonlStore,
  input: {
    readonly customerId: string;
    readonly id: string;
    readonly now?: string;
  },
): Promise<NotificationRecord> {
  const current = await store.readLatestById<NotificationRecord>(
    "notifications",
    input.id,
  );
  if (current === null || current.customerId !== input.customerId) {
    throw new NotificationError(
      "NOTIFICATION_NOT_FOUND",
      `notification ${input.id} does not exist for customer ${input.customerId}`,
    );
  }
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const updated: NotificationRecord = {
    ...current,
    status: "READ",
    createdAt: now,
  };
  await store.insert("notifications", updated);
  return updated;
}

/**
 * Pure truth -> notification drafts. CONFIRMED and PENDING transactions
 * produce nothing; every other customer-facing state produces exactly one
 * deterministic statement. Uses only the Phase 2F truth projection.
 */
export function notificationsForTruth(
  truth: TransactionTruth,
  input: {
    readonly customerId: string;
    readonly transactionId: string | null;
  },
): readonly NotificationDraft[] {
  const transactionId = input.transactionId;
  const base = {
    customerId: input.customerId,
    transactionId,
  };
  if (truth.adminStatus === "MANUAL_REVIEW") {
    return [
      {
        ...base,
        kind: "manual_review",
        title: "Transaction under review",
        body: "This transaction is being reviewed manually. No further action is needed from you.",
      },
    ];
  }
  switch (truth.customerStatus) {
    case "FAILED":
      return [
        {
          ...base,
          kind: "payment_failed",
          title: "Payment failed",
          body: "This payment was declined before any provider was called.",
        },
      ];
    case "REFUND_PENDING":
      return [
        {
          ...base,
          kind: "refund_pending",
          title: "Refund in progress",
          body: "Your refund is pending and will be posted to your wallet.",
        },
      ];
    case "REFUNDED":
      return [
        {
          ...base,
          kind: "refunded",
          title: "Refund completed",
          body: "Your money has been returned to your wallet.",
        },
      ];
    case "REVERSED":
      return [
        {
          ...base,
          kind: "reversed",
          title: "Payment reversed",
          body: "The charge was reversed and the funds returned to your wallet.",
        },
      ];
    case "NEEDS_ATTENTION":
      return [
        {
          ...base,
          kind: "needs_attention",
          title: "Transaction needs attention",
          body: `Your money is ${
            truth.moneyAtRisk ? "at risk" : "not at risk"
          }. ${truth.nextAction}`,
        },
      ];
    default:
      return [];
  }
}
