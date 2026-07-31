# Provider Abstraction Strategy

## Pattern: Adapter + Factory

Every external service follows a consistent three-layer pattern:

### 1. Service Interface (Public Contract)

Defined in the package's main export. The rest of the application depends only on this.

```typescript
// packages/billing/src/BillingService.ts
export interface BillingService {
  createCheckoutSession(priceId: string, orgId: string, opts?: CheckoutOpts): Promise<string>;
  getSubscription(orgId: string): Promise<Subscription | null>;
  handleWebhook(payload: unknown, signature: string): Promise<void>;
  // ...
}
```

### 2. Adapter Implementations

One per provider. The adapter translates between the service interface and the vendor SDK.

```typescript
// packages/billing/src/adapters/stripe/StripeBillingAdapter.ts
export class StripeBillingAdapter implements BillingService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  async createCheckoutSession(
    priceId: string,
    orgId: string,
    opts?: CheckoutOpts,
  ): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      client_reference_id: orgId,
      // ...
    });
    return session.url!;
  }
  // ...
}
```

### 3. Factory / DI

Selects the active adapter based on environment configuration.

```typescript
// packages/billing/src/index.ts
export function createBillingService(): BillingService {
  switch (env.BILLING_PROVIDER) {
    case "stripe":
      return new StripeBillingAdapter();
    case "lemon-squeezy":
      return new LemonSqueezyAdapter();
    default:
      throw new ConfigError(`Unknown billing provider: ${env.BILLING_PROVIDER}`);
  }
}

export type { BillingService };
export * from "./types";
```

## Abstracted Modules

| Module                   | Interface             | Adapters                              |
| ------------------------ | --------------------- | ------------------------------------- |
| `packages/auth`          | `AuthService`         | NextAuth, Supabase Auth, Clerk, Auth0 |
| `packages/billing`       | `BillingService`      | Stripe, Lemon Squeezy, Paddle, Polar  |
| `packages/storage`       | `StorageService`      | UploadThing, Supabase Storage, S3     |
| `packages/email`         | `EmailService`        | Resend, SendGrid, SES                 |
| `packages/analytics`     | `AnalyticsService`    | PostHog, Plausible, GA                |
| `packages/notifications` | `NotificationService` | In-app, Email, Push (future)          |

## Rules

1. Application code must **never** import vendor SDKs directly
2. Adapters are the only code that imports vendor SDKs
3. Adding a new provider = new adapter file only (no app code changes)
4. Service interfaces must be stable — avoid breaking changes
5. Shared types (Subscription, Invoice, Plan, etc.) are provider-agnostic
