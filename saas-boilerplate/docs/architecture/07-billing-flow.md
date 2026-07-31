# Billing Flow

## BillingService Interface

```typescript
interface BillingService {
  // Subscriptions
  createCheckoutSession(priceId: string, orgId: string, opts?: CheckoutOpts): Promise<string>;
  getSubscription(orgId: string): Promise<Subscription | null>;
  updateSubscription(orgId: string, priceId: string): Promise<Subscription>;
  cancelSubscription(orgId: string, atPeriodEnd: boolean): Promise<void>;
  resumeSubscription(orgId: string): Promise<Subscription>;

  // Customer Portal
  createCustomerPortalLink(orgId: string, returnUrl: string): Promise<string>;

  // Invoices
  getInvoices(orgId: string): Promise<Invoice[]>;
  getInvoice(invoiceId: string): Promise<Invoice>;

  // Webhooks
  handleWebhook(payload: unknown, signature: string): Promise<void>;

  // Plans
  getPlans(): Promise<Plan[]>;
  getPlan(priceId: string): Promise<Plan>;
}
```

## Subscription Lifecycle

```text
User selects plan
       │
       ▼
Create Checkout Session (returns Stripe Checkout URL)
       │
       ▼
User completes payment on Checkout page
       │
       ▼
┌──────────────────┐
│ Webhook received │  ──► Verify signature ──► Find org
│ checkout.session │                                │
│   .completed     │                          Create Subscription
└──────────────────┘                           (active / trialing)
       │                                              │
       ▼                                              ▼
┌──────────────────┐                            ┌──────────────┐
│ Webhook received │  ──► Update status         │ Feature Gating│
│ invoice.paid     │      to active             │ Check plan    │
└──────────────────┘                            │ limits on     │
       │                                         │ every request │
       ▼                                         └──────────────┘
┌──────────────────┐
│ Webhook received │  ──► Set status to past_due
│ invoice.payment  │      Send reminder email
│   .failed        │      (retry logic)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Webhook received │  ──► Set status to canceled / expired
│ customer.sub     │      Revoke access after grace period
│ .deleted         │      Archive data per retention policy
└──────────────────┘
```

## Plan & Feature Gating

Plans define feature access. Checked at the application layer, not per-keystroke.

```typescript
interface Plan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: {
    maxMembers: number;
    maxTeams: number;
    maxStorage: number; // MB
    analytics: boolean;
    apiAccess: boolean;
    customDomain: boolean;
    prioritySupport: boolean;
  };
}
```

Check pattern:

```typescript
async function requireFeature(orgId: string, feature: keyof Plan["features"]) {
  const sub = await billing.getSubscription(orgId);
  if (!sub || !sub.plan.features[feature]) {
    throw new ForbiddenError(`Upgrade required for ${feature}`);
  }
}
```
