import type {
  CheckoutOptions,
  CheckoutResult,
  Customer,
  Invoice,
  PlanTier,
  Subscription,
  SubscriptionInterval,
} from "./types";

export interface BillingService {
  // Checkout
  createCheckoutSession(
    priceId: string,
    planTier: PlanTier,
    interval: SubscriptionInterval,
    organizationId: string,
    email: string,
    name?: string,
    opts?: CheckoutOptions,
  ): Promise<CheckoutResult>;

  // Customer portal
  createCustomerPortalLink(organizationId: string, returnUrl: string): Promise<string>;

  // Subscriptions
  getSubscription(organizationId: string): Promise<Subscription | null>;
  updateSubscription(organizationId: string, priceId: string): Promise<Subscription>;
  cancelSubscription(organizationId: string, atPeriodEnd?: boolean): Promise<void>;
  resumeSubscription(organizationId: string): Promise<Subscription>;

  // Invoices
  getInvoices(organizationId: string): Promise<Invoice[]>;
  getInvoice(invoiceId: string): Promise<Invoice>;

  // Customer
  getOrCreateCustomer(organizationId: string, email: string, name?: string): Promise<Customer>;

  // Webhooks
  handleWebhook(body: string, signature: string): Promise<{ received: boolean }>;
}
