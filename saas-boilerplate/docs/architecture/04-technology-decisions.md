# Technology Decisions

## Stack Rationale

| Layer           | Technology            | Why Not Alternatives                                                                                        |
| --------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 15            | Remix: smaller ecosystem. Nuxt: limits to Vue developers. Pure Express: no SSR/streaming built in.          |
| Monorepo        | Turborepo + pnpm      | Nx: heavier, steeper config. npm workspaces: slower. yarn: pnpm has better disk efficiency.                 |
| Styling         | Tailwind CSS          | CSS Modules: slower to develop. styled-components: runtime cost. vanilla CSS: no design system consistency. |
| UI Library      | shadcn/ui + Radix     | MUI: too opinionated, heavy bundle. Ant Design: harder to theme. Headless UI: fewer primitives.             |
| ORM             | Prisma                | Drizzle: younger ecosystem, raw SQL mindset. TypeORM: stale maintenance. Knex: no type safety.              |
| Validation      | Zod                   | Yup: weaker TypeScript inference. Joi: Node-only. Valibot: too new.                                         |
| Auth            | NextAuth + Supabase   | Clerk: vendor lock-in, cost. Auth0: expensive at scale. Firebase: Google lock-in.                           |
| Payments        | Stripe                | Paddle: fewer features. Lemon Squeezy: smaller ecosystem. Chargebee: higher complexity.                     |
| Background Jobs | Inngest               | Bull/Redis: manual queue management. Trigger.dev: newer, smaller ecosystem. AWS SQS: too low-level.         |
| Email           | Resend + React Email  | SendGrid: no React components. Mailgun: fewer features. AWS SES: low-level.                                 |
| Forms           | React Hook Form + Zod | Formik: larger bundle, manual validation. Final Form: smaller community.                                    |
| Testing         | Vitest + Playwright   | Jest: slower. Cypress: heavier. React Testing Library is the industry standard.                             |

## Provider Abstraction Pattern

All external services follow the same pattern:

```typescript
// Service interface (public contract)
interface BillingService {
  createCheckoutSession(plan: Plan, orgId: string): Promise<CheckoutUrl>;
  handleWebhook(event: WebhookPayload): Promise<void>;
  getSubscription(orgId: string): Promise<Subscription>;
  cancelSubscription(orgId: string): Promise<void>;
  getInvoices(orgId: string): Promise<Invoice[]>;
  createCustomerPortalLink(orgId: string): Promise<string>;
}

// Adapter implementation
class StripeBillingAdapter implements BillingService {
  // Stripe-specific SDK calls here
}

// Factory / DI
function createBillingService(): BillingService {
  const provider = env.BILLING_PROVIDER;
  switch (provider) {
    case "stripe":
      return new StripeBillingAdapter();
    case "lemon-squeezy":
      return new LemonSqueezyAdapter();
    default:
      throw new Error(`Unknown billing provider: ${provider}`);
  }
}
```

This pattern applies to: Auth, Billing, Storage, Email, Analytics, Notifications.
