export type BillingProvider = "stripe" | "lemon-squeezy";

export type SubscriptionInterval = "monthly" | "yearly";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid"
  | "paused";

export type PlanTier = "free" | "starter" | "pro" | "business" | "enterprise";

export interface CheckoutOptions {
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  url: string;
  sessionId?: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  provider: BillingProvider;
  providerId: string | null;
  status: SubscriptionStatus;
  planTier: PlanTier;
  interval: SubscriptionInterval;
  quantity: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  canceledReason: string | null;
  createdAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: SubscriptionInterval;
  features: string[];
  limits: {
    projects: number;
    teamMembers: number;
    storage: number;
    apiCalls: number;
  };
}

export interface Invoice {
  id: string;
  organizationId: string;
  provider: BillingProvider;
  providerId: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  createdAt: Date;
}

export interface Customer {
  id: string;
  organizationId: string;
  provider: BillingProvider;
  providerId: string;
  email: string;
  name: string | null;
}

export class BillingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export class PaymentFailedError extends BillingError {
  constructor() {
    super("PAYMENT_FAILED", "Payment processing failed");
  }
}

export class NoActiveSubscriptionError extends BillingError {
  constructor() {
    super("NO_ACTIVE_SUBSCRIPTION", "No active subscription found");
  }
}

export class CustomerNotFoundError extends BillingError {
  constructor() {
    super("CUSTOMER_NOT_FOUND", "Customer not found");
  }
}

export class WebhookSignatureError extends BillingError {
  constructor() {
    super("INVALID_WEBHOOK_SIGNATURE", "Invalid webhook signature");
  }
}
