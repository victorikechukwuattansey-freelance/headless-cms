import type { CanonicalPaymentStatus } from "../../../src/domain/model.ts";

export type OrderStatus = "PAYMENT_INITIATED" | "INITIALIZATION_FAILED";

export type RefundStatus = "NONE" | "PARTIAL_REFUND" | "REFUNDED" | "UNKNOWN";

export interface Business {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface Product {
  readonly id: string;
  readonly businessId: string;
  readonly name: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly createdAt: string;
}

export interface Order {
  readonly id: string;
  readonly businessId: string;
  readonly productId: string;
  readonly customerEmail: string;
  readonly expectedAmountMinor: number;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly paystackReference: string | null;
  readonly authorizationUrl: string | null;
  readonly createdAt: string;
}

/**
 * The canonical boundary between the storefront and the reconciliation system.
 *
 * `id` is the order id: exactly one payment record exists per order, and later
 * verification/webhook updates append a new line with the same id (latest wins).
 * Status vocabulary is the frozen reconciliation domain's CanonicalPaymentStatus,
 * never a competing storefront-specific set.
 */
export interface PaymentRecord {
  readonly id: string;
  readonly businessId: string;
  readonly orderId: string;
  readonly expectedAmount: number;
  readonly currency: string;
  readonly paystackReference: string;
  readonly status: CanonicalPaymentStatus;
  readonly paidAt: string | null;
  readonly refundStatus: RefundStatus;
  readonly metadata: Readonly<Record<string, string>>;
  readonly recordedAt: string;
}
