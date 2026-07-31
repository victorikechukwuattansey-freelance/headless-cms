# Subscription & Billing System

**Platform:** Social Media OS
**Document:** 02-subscription-system.md
**Status:** Final
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [Pricing Tiers](#1-pricing-tiers)
2. [Add-On Pricing](#2-add-on-pricing)
3. [Billing Flow](#3-billing-flow)
4. [Usage-Based Billing](#4-usage-based-billing)
5. [Plan Management](#5-plan-management)
6. [Invoice System](#6-invoice-system)
7. [Trial Management](#7-trial-management)
8. [Coupon & Discount System](#8-coupon--discount-system)
9. [Churn Prevention](#9-churn-prevention)

---

## 1. Pricing Tiers

### Tier Overview

| Feature | Free | Starter | Pro | Agency | Enterprise |
|---|---|---|---|---|---|
| **Price** | $0 | $19/mo | $49/mo | $149/mo | Custom |
| **Annual Discount** | — | $190/yr (-17%) | $490/yr (-17%) | $1,490/yr (-17%) | Custom |
| **Social Accounts** | 3 | 10 | 25 | 50 | Unlimited |
| **Posts/Month** | 10 | 100 | 500 | Unlimited | Unlimited |
| **Users** | 1 | 3 | 10 | 25 | Custom |
| **Workspaces** | 1 | 2 | 5 | 15 | Custom |
| **AI Credits/Month** | 5,000 | 50,000 | 250,000 | 1,000,000 | Custom |
| **Storage** | 100 MB | 1 GB | 5 GB | 25 GB | Custom |
| **Supported Platforms** | 6 core | 6 core | 12+ | All | All |
| **Post Scheduling** | Basic | Calendar | Calendar + Queue | Unlimited Queues | Unlimited |
| **AI Content Studio** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **AI Repurposing** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Brand Voice** | ✗ | 1 voice | 5 voices | 25 voices | Custom |
| **AI Images** | ✗ | 10/mo | 100/mo | 500/mo | Custom |
| **Analytics** | Basic | Standard | Advanced | Advanced + Custom | Enterprise BI |
| **Custom Reports** | ✗ | ✗ | 5 reports | 25 reports | Unlimited |
| **Competitor Analysis** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Best Time to Post** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Content Approval** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Approval Workflows** | ✗ | ✗ | 1 workflow | 10 workflows | Unlimited |
| **White-Label (Basic)** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **White-Label (Premium)** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Custom Domain** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Remove Branding** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Custom Email Sender** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **SSO / SAML** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **SCIM Provisioning** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Audit Logs** | ✗ | ✗ | ✗ | 30 days | 7 years |
| **Advanced RBAC** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Custom Roles** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **API Access** | ✗ | ✓ (1,000 req/hr) | ✓ (5,000 req/hr) | ✓ (20,000 req/hr) | Custom |
| **MCP Marketplace** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Workflow Automation** | ✗ | ✗ | 5 workflows | 25 workflows | Unlimited |
| **AI Agents** | ✗ | ✗ | 1 agent | 5 agents | Custom |
| **Browser Extension** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Priority Support** | ✗ | Community | Email (24h) | Chat (4h) | Dedicated (1h SLA) |
| **Onboarding** | Self-serve | Self-serve | Guided | White-Glove | Enterprise Launch |
| **Data Retention** | 3 months | 12 months | 24 months | 36 months | Custom |

### Detailed Tier Breakdown

#### Free
- **Target**: Individual creators, evaluation
- **Revenue model**: Conversion to paid, limited feature showcase
- **Limitations**: Watermarked exports, "Powered by SocialMediaOS" on published content preview, 3-month analytics retention
- **Support**: Community forum only, no email/chat

#### Starter ($19/mo)
- **Target**: Solopreneurs, small business owners
- **Revenue model**: Low-friction entry with upsell to Pro
- **Key differentiator**: AI Content Studio access (basic generation, text-only)
- **Support**: Community forum + email (72h response time)

#### Pro ($49/mo)
- **Target**: Professional marketers, growing SMBs
- **Revenue model**: Core revenue driver, highest volume tier
- **Key differentiator**: AI repurposing engine, advanced analytics, approval workflows, white-label basic
- **Support**: Email (24h response time)

#### Agency ($149/mo)
- **Target**: Social media agencies, marketing firms
- **Revenue model**: High-value accounts, add-on attach rate
- **Key differentiator**: White-label premium, custom domain, multi-workspace (up to 15), MCP marketplace, 25 users
- **Support**: Chat (4h response time)

#### Enterprise (Custom)
- **Target**: Large organizations, regulated industries
- **Revenue model**: Annual contracts, seven-figure ACVs
- **Key differentiator**: Custom AI models, dedicated infrastructure, SLA guarantees, SSO/SCIM, 7-year audit retention, custom integrations, dedicated success manager
- **Support**: Dedicated (1h SLA, 24/7)

### Pricing Architecture

```json
{
  "tiers": [
    {
      "id": "free",
      "name": "Free",
      "price_monthly": 0,
      "price_yearly": 0,
      "stripe_price_id_monthly": "price_free_monthly",
      "stripe_price_id_yearly": null,
      "features": { ... },
      "limits": { "accounts": 3, "posts": 10, "users": 1, "ai_credits": 5000 }
    },
    {
      "id": "starter",
      "name": "Starter",
      "price_monthly": 1900,  // cents
      "price_yearly": 19000,  // cents (17% off = $190/yr)
      "stripe_price_id_monthly": "price_starter_monthly",
      "stripe_price_id_yearly": "price_starter_yearly",
      "features": { ... },
      "limits": { "accounts": 10, "posts": 100, "users": 3, "ai_credits": 50000 }
    },
    {
      "id": "pro",
      "name": "Pro",
      "price_monthly": 4900,
      "price_yearly": 49000,
      "stripe_price_id_monthly": "price_pro_monthly",
      "stripe_price_id_yearly": "price_pro_yearly",
      "features": { ... },
      "limits": { "accounts": 25, "posts": 500, "users": 10, "ai_credits": 250000 }
    },
    {
      "id": "agency",
      "name": "Agency",
      "price_monthly": 14900,
      "price_yearly": 149000,
      "stripe_price_id_monthly": "price_agency_monthly",
      "stripe_price_id_yearly": "price_agency_yearly",
      "features": { ... },
      "limits": { "accounts": 50, "posts": -1, "users": 25, "ai_credits": 1000000 }
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "price_monthly": null,
      "price_yearly": null,
      "stripe_price_id_monthly": null,
      "stripe_price_id_yearly": null,
      "features": { ... },
      "limits": { "accounts": -1, "posts": -1, "users": -1, "ai_credits": -1 }
    }
  ]
}
```

---

## 2. Add-On Pricing

### Add-On Catalog

| Add-On | Price | Unit | Available On |
|---|---|---|---|
| **AI Credit Pack S** | $5 | 10,000 credits | Starter+ |
| **AI Credit Pack M** | $20 | 50,000 credits | Starter+ |
| **AI Credit Pack L** | $75 | 250,000 credits | Pro+ |
| **AI Credit Pack XL** | $250 | 1,000,000 credits | Agency+ |
| **Extra Storage S** | $2/mo | 1 GB/month | Starter+ |
| **Extra Storage M** | $10/mo | 10 GB/month | Pro+ |
| **Extra Storage L** | $40/mo | 50 GB/month | Agency+ |
| **Extra Workspace** | $10/mo | Per additional workspace | Pro+ |
| **Extra User** | $5/mo | Per additional user | Starter+ (beyond plan limit) |
| **Extra Social Account** | $3/mo | Per additional account | Starter+ (beyond plan limit) |
| **White-Label Premium** | $49/mo | Per workspace | Pro |
| **White-Label Enterprise** | Included | — | Agency, Enterprise |
| **API Access (unlimited)** | $99/mo | Uncapped | Pro+ |
| **Premium AI Model — GPT-4o** | $20/mo | Per month | Pro+ |
| **Premium AI Model — Claude 3.5** | $20/mo | Per month | Pro+ |
| **Premium AI Model — Gemini Ultra** | $15/mo | Per month | Pro+ |
| **Custom AI Model Hosting** | Custom | Per model/month | Enterprise |
| **Video AI (repurpose to video)** | $15/mo | Per month | Pro+ |
| **SSO/SAML** | Included | — | Agency (Pro add-on $29/mo) |
| **Advanced Audit Logs** | $25/mo | Per month | Pro+ |
| **API Webhook Credits** | $10/mo | 100,000 webhook calls | Pro+ |
| **Dedicated Support** | $99/mo | Per month | Pro+ |
| **Onboarding Session** | $199 | One-time | Pro+ |
| **Migration Service** | $499 | One-time | Agency+ |
| **Custom Integration** | Custom | One-time | Enterprise |

### Credit Pack Mechanics

- AI credits are consumed per request based on model and output length
- Credits expire at end of billing period (use-it-or-lose-it)
- Unused add-on storage rolls over up to 2x the base allocation
- Users can set auto-purchase thresholds (e.g., auto-buy M pack when credits fall below 5,000)

### Add-On Management

```
POST   /api/v1/billing/addons                      — Purchase/pause add-on
GET    /api/v1/billing/addons                       — List active add-ons
PATCH  /api/v1/billing/addons/:id/quantity          — Change quantity
DELETE /api/v1/billing/addons/:id                   — Cancel add-on
POST   /api/v1/billing/addons/:id/auto-recharge     — Enable auto-purchase
```

---

## 3. Billing Flow

### Payment Processors

**Primary**: Stripe (PCI-compliant, Subscription APIs, Customer Portal)
**Secondary**: Lemon Squeezy (for EU customers, VAT/MOSS handling)
**Fallback**: Paddle (for rest-of-world where Stripe is limited)

### Checkout Flow

```
User clicks "Upgrade" / "Subscribe"
  →
  1. Create/retrieve Stripe Customer object (mapped to Organization)
  2. Determine price ID from selected plan + billing interval
  3. Create Stripe Checkout Session:
     - success_url: /billing/success?session_id={CHECKOUT_SESSION_ID}
     - cancel_url: /billing/cancel
     - allow_promotion_codes: true
     - tax_behavior: inclusive (Stripe Tax or provider)
     - metadata: { organization_id, plan_id, source: 'in-app' }
  4. Redirect to Stripe Checkout
  5. Stripe webhook (checkout.session.completed):
     a. Verify session
     b. Activate subscription in database
     c. Update organization plan
     d. Apply feature flag overrides
     e. Send confirmation email
     f. Create initial invoice record
  6. User redirected back to app → success page
  7. Welcome flow triggered for new subscribers
```

### Billing Integration Data Model

```sql
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255),
  lemonsqueezy_customer_id VARCHAR(255),
  paddle_customer_id VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  tax_id VARCHAR(64),
  tax_id_type VARCHAR(32),  -- 'eu_vat', 'us_ein', 'gb_vat', etc.
  currency VARCHAR(3) DEFAULT 'USD',
  billing_address JSONB,
  shipping_address JSONB,
  default_payment_method_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  billing_customer_id UUID NOT NULL,
  plan_id VARCHAR(64) NOT NULL,         -- 'free', 'starter', 'pro', 'agency', 'enterprise'
  status VARCHAR(32) NOT NULL,           -- 'active', 'past_due', 'canceled', 'incomplete', 'trialing', 'paused'
  billing_interval VARCHAR(16) NOT NULL, -- 'monthly', 'yearly'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(255),
  stripe_subscription_item_id VARCHAR(255),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscription_addons (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL,
  addon_code VARCHAR(64) NOT NULL,  -- 'ai_credits_m', 'extra_storage_s'
  quantity INT NOT NULL DEFAULT 1,
  stripe_price_id VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Webhook Handling

```typescript
// Stripe webhook handler priority ordering
const WEBHOOK_EVENT_HANDLERS = {
  'checkout.session.completed': handleCheckoutCompleted,
  'customer.subscription.created': handleSubscriptionCreated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'invoice.paid': handleInvoicePaid,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'invoice.upcoming': handleInvoiceUpcoming,
  'customer.payment_method.attached': handlePaymentMethodAttached,
  'customer.payment_method.detached': handlePaymentMethodDetached,
  'charge.dispute.created': handleDisputeCreated,
  'charge.refunded': handleRefunded,
  'customer.subscription.trial_will_end': handleTrialWillEnd,
};
```

### Tax Handling

| Region | Method | Auto-Charged? |
|---|---|---|
| US (states) | Stripe Tax (or TaxJar) | Yes, per-location rate |
| EU/EEA | Stripe Tax / Lemon Squeezy | Yes, VAT MOSS |
| UK | Stripe Tax | Yes |
| Canada | Stripe Tax | Yes (GST/HST/QST) |
| Australia | Stripe Tax | Yes (GST) |
| Rest of World | Stripe Tax or manual | Calculated at checkout |

- Tax amounts are displayed at checkout before payment
- Invoices show tax breakdown line items
- B2B customers can provide VAT/Tax IDs for reverse charge (EU) or exemption (US)
- Annual reconciliation via Stripe Tax Reports

---

## 4. Usage-Based Billing

### Metered Billing Model

Two modes:

1. **Included Usage** — Each plan includes a base allocation. Usage within allocation is covered by the flat monthly fee.
2. **Overage Billing** — Usage beyond included allocation is billed per-unit at the end of the billing period.

### Overage Rates

| Meter | Free Overage | Starter Overage | Pro Overage | Agency Overage |
|---|---|---|---|---|
| **Posts** | N/A (hard cap) | $0.10/post | $0.05/post | N/A (unlimited) |
| **AI Credits** | N/A (hard cap) | $5/10K credits | $5/10K credits | $3/10K credits |
| **Storage** | N/A (hard cap) | $0.05/GB | $0.03/GB | $0.02/GB |
| **API Calls** | N/A | $0.001/100 calls | $0.0005/100 calls | $0.0002/100 calls |
| **Users** | N/A | $5/user | $4/user | $3/user |

### Soft vs Hard Caps

| Plan | Soft Cap | Hard Cap |
|---|---|---|
| **Free** | N/A | Strict hard cap on all resources |
| **Starter** | Posts: soft (warning at 90%) | Hard cap at 200 posts, AI credits at 100K |
| **Pro** | Posts: soft (warning at 80%, 95%) | Hard cap at 1,000 posts |
| **Agency** | Soft cap on storage (warning) | No hard cap (unlimited posts, credits) |
| **Enterprise** | Custom soft thresholds | Custom hard caps |

### Overage Invoice Cycle

1. Daily usage aggregation via ClickHouse
2. At period end: compute overage for each meter
3. Generate invoice line items for overage
4. Charge payment method (if auto-pay enabled)
5. Send invoice via email
6. If payment fails: enter dunning flow (see churn prevention)

### Usage Notification Triggers

```
80% of included → Email: "You've used 80% of your posts this month"
90% of included → Email + In-app notification: "Almost at your limit"
100% of included → Email + In-app banner: "You've hit your limit"
Overage incurred → Email: "Overage charges applied"
Threshold breached → Email + Push: "Consider upgrading to avoid caps"
```

### Real-Time Usage Dashboard

```typescript
interface UsageDashboard {
  currentPeriod: {
    start: string;  // ISO 8601
    end: string;
    daysRemaining: number;
  };
  meters: Array<{
    code: string;         // 'posts_published'
    label: string;        // 'Posts Published'
    included: number;     // 500
    used: number;         // 342
    percentage: number;   // 68.4
    projectedEndOfPeriod: number;  // 487
    overageRate: number;  // 0.05 (dollars per unit)
    estimatedOverage: number;  // $0 (if under), $2.50 (if over)
    status: 'ok' | 'warning' | 'critical' | 'over';
    hardCap: number | null;
  }>;
  totalEstimatedCost: number;
  currency: string;
}
```

---

## 5. Plan Management

### Upgrade Flow

```
User initiates upgrade (e.g., Starter → Pro)
  →
  1. Validate current subscription is active
  2. Calculate proration:
     - Remaining value on current plan (prorated refund)
     - Cost of new plan for remainder of billing period
     - Net amount due (or credit)
  3. If net amount due > $0: charge payment method immediately
  4. If net amount due ≤ $0: issue credit toward next invoice
  5. Update subscription in Stripe:
     - stripe.subscription.update(subscriptionId, {
         items: [{ id: subItemId, price: proPriceId }],
         proration_behavior: 'create_prorations',
         billing_cycle_anchor: 'now'
       })
  6. Apply new plan limits immediately
  7. Send confirmation email: "Welcome to Pro!"
  8. Log to audit trail
```

### Downgrade Flow

```
User initiates downgrade (e.g., Pro → Starter)
  →
  1. Check if downgrade is allowed:
     - Current usage must fit within Starter limits:
       - Accounts ≤ 10, Users ≤ 3, Workspaces ≤ 2, Storage ≤ 1GB
     - If over limits: warn user, suggest upgrade or offboarding workflow
  2. If user confirms despite overage:
     - Schedule downgrade at end of current billing period
     - Apply "over-limit hold" — user cannot create new content until within limits
     - System flags accounts for archiving
  3. If within limits:
     - Immediate downgrade or end-of-period (configurable)
     - Prorated credit applied to future invoices
     - Update subscription in Stripe
     - Feature flags adjusted
     - Confirmation email sent
```

### Proration Rules

| Scenario | Proration |
|---|---|
| Upgrade mid-cycle | Credit unused portion of current plan, charge prorated new plan |
| Downgrade mid-cycle | No refund; credit applied to next invoice |
| Switch from monthly to annual | Charge annual rate immediately, cancel monthly subscription |
| Switch from annual to monthly | Prorated refund for unused months |
| Add add-on mid-cycle | Charge full add-on price immediately (no proration) |
| Remove add-on mid-cycle | Prorated refund to credit balance |
| Cancel mid-cycle | Service continues until end of billing period; no refund |

### Plan Switching Rules Matrix

| From → To | Allowed? | Timing | Data Impact |
|---|---|---|---|
| Free → Starter | Instant | Immediate | None |
| Free → Pro | Instant | Immediate | None |
| Free → Agency | Instant | Immediate | None |
| Starter → Free | Yes | End of period | Archives accounts over limit (30-day grace) |
| Starter → Pro | Instant | Immediate | None |
| Starter → Agency | Instant | Immediate | None |
| Pro → Starter | Yes | End of period | Limits enforced, archive excess data |
| Pro → Free | Yes | End of period | Major feature loss, data retained 30 days |
| Pro → Agency | Instant | Immediate | None |
| Agency → Pro | Yes | End of period | Limits enforced |
| Agency → Free/Starter | Yes | End of period | Strict limits enforced |
| Enterprise → Anything | By contract | Contract end | Custom transition |
| Free → Enterprise | Via sales | Custom | Enterprise onboarding |
| Any → Enterprise | Via sales | Custom | Enterprise onboarding |

### Enterprise Plan Management

- No self-service enterprise plan changes
- Sales team manages via admin dashboard
- Custom contracts with fixed terms (annual, multi-year)
- Usage overrides set manually by admin
- Billing via invoice (net 30/60) + ACH/wire transfer

---

## 6. Invoice System

### Invoice Generation

Invoices are generated via Stripe/Lemon Squeezy with local database mirror for redundancy:

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  stripe_invoice_id VARCHAR(255),
  invoice_number VARCHAR(64) NOT NULL,  -- e.g., "INV-2026-00042"
  status VARCHAR(32) NOT NULL,          -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  amount_due BIGINT NOT NULL,           -- cents
  amount_paid BIGINT NOT NULL,
  amount_remaining BIGINT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_reason VARCHAR(64),           -- 'subscription_create', 'subscription_cycle', 'subscription_update', 'manual'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  pdf_url VARCHAR(512),
  hosted_invoice_url VARCHAR(512),
  line_items JSONB,                     -- Array of line item details
  tax_amounts JSONB,                    -- Tax breakdown by jurisdiction
  credit_notes JSONB,                   -- Applied credit notes
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credit_notes (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  credit_note_number VARCHAR(64),
  amount BIGINT NOT NULL,
  reason VARCHAR(255),                  -- 'duplicate', 'fraudulent', 'order_change', 'product_unsatisfactory'
  status VARCHAR(32),                   -- 'issued', 'applied'
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Invoice Email Delivery

| Trigger | Email Template |
|---|---|
| Invoice issued | `invoice-issued.html` — Summary, pay now link, PDF attachment |
| Invoice paid | `invoice-paid.html` — Receipt, link to dashboard |
| Invoice past due | `invoice-past-due.html` — Warning, payment link |
| Invoice voided | `invoice-voided.html` — Explanation |
| Credit note issued | `credit-note-issued.html` — Credit note PDF |
| Receipt available | `receipt-available.html` — For one-time payments |

### Invoice Numbering

Format: `INV-{YEAR}-{SEQUENTIAL}` with per-organization prefix option for white-label:
- Default: `INV-2026-00001`
- White-label: `ACME-INV-2026-00001`

### Invoice Payment History

```
GET /api/v1/billing/invoices                    — List invoices (paginated, filterable)
GET /api/v1/billing/invoices/:id                — Invoice details
GET /api/v1/billing/invoices/:id/pdf            — Download PDF
GET /api/v1/billing/invoices/:id/credit-notes   — Associated credit notes
GET /api/v1/billing/payment-methods             — List saved payment methods
POST /api/v1/billing/payment-methods            — Add payment method (SetupIntent)
DELETE /api/v1/billing/payment-methods/:id      — Remove payment method
POST /api/v1/billing/payment-methods/:id/default — Set default
```

---

## 7. Trial Management

### Trial Configuration

| Plan | Trial Duration | Features During Trial | Conversion Trigger |
|---|---|---|---|
| Free | Unlimited (indefinite) | All Free features | N/A |
| Starter | 14 days | All Starter features | Post count, account count, user invite |
| Pro | 14 days | All Pro features | Any AI feature, analytics export |
| Agency | 14 days | All Agency features (white-label locked) | Workspace creation, team setup |
| Enterprise | Custom (30-90 days) | Full platform | Custom sales-led |

### Trial Start

```
Signup
  →
  1. Create organization with trial plan
  2. Set trial_end = NOW() + 14 days
  3. Feature flags set to trial plan (e.g., pro features for pro trial)
  4. Trial badge shown in UI
  5. Onboarding flow: emphasize key trial features
  6. No credit card required for free/starter trial
  7. Pro trial: credit card required (Stripe trial without charge)
```

### Trial Conversion Flow

```
D-7: Email "Your trial ends in 7 days"
  → Feature highlight: things they've used
  → Testimonial from similar customer
  → Link to select plan

D-3: Email "3 days left"
  → Usage summary: "You've scheduled X posts in your trial"
  → "Don't lose your data — subscribe to keep everything"
  → Pricing comparison

D-1: Email "Last day of trial"
  → Urgency: "Tomorrow your account will be limited"
  → Direct CTA to checkout

D-Day:
  - If trial expired: convert to Free plan
  - Data preserved (not deleted)
  - Feature restrictions applied
  - Banner: "Your trial has ended. Upgrade to Pro to continue."
  - 30-day grace period to upgrade with data intact
```

### Trial Feature Restrictions

| Feature | Trial Restriction |
|---|---|
| AI credits | Full allocation (50K for starter trial, 250K for pro trial) |
| Posts | Full allocation |
| Analytics | Full access |
| Export | Watermarked on trial (removed on subscription) |
| White-label | Locked (requires subscription) |
| Custom domain | Configuration possible, won't serve until subscriber |
| API | Limited (100 req/hr) |

### Trial Extensions

```
POST /api/v1/admin/trials/extend
Body: { organization_id, additional_days: 14, reason: "sales_approved" }
```

Available for:
- Sales-approved extensions (Enterprise prospects)
- Technical issue during trial (support override)
- Customer request (manual approval by CS)

---

## 8. Coupon & Discount System

### Coupon Types

| Type | Description | Example |
|---|---|---|
| **Percentage** | % off recurring price | 20% off for 6 months |
| **Fixed Amount** | $ off recurring price | $10 off/month for 3 months |
| **Free Months** | N months at $0 | 2 months free on annual |
| **First Invoice Only** | One-time discount | 50% off first month |
| **Forever Discount** | Permanent % off | 15% off lifetime (legacy) |

### Coupon Model

```json
{
  "id": "coupon_uuid",
  "code": "LAUNCH2026",
  "type": "percentage",
  "value": 20,                // 20%
  "duration_months": 6,       // null = forever
  "max_redemptions": 1000,
  "current_redemptions": 342,
  "min_plan_tier": "starter", // null = all tiers
  "max_plan_tier": "agency",
  "excluded_plans": ["free"],
  "new_customers_only": true,
  "expires_at": "2026-12-31T23:59:59Z",
  "stripe_coupon_id": "Z7kL9mPn",
  "metadata": { "campaign": "producthunt_launch" }
}
```

### Referral Discounts

```
Existing User shares referral link
  →
  Referred user signs up with referral code
    →
    Referred user: gets 1 month free ($0 first month on any paid plan)
    Referrer: gets $10 account credit per referral (max $100/year)
```

### Annual vs Monthly Pricing

| Plan | Monthly | Annual (per mo) | Annual (total) | Savings |
|---|---|---|---|---|
| Starter | $19 | $15.83 | $190 | 17% |
| Pro | $49 | $40.83 | $490 | 17% |
| Agency | $149 | $124.17 | $1,490 | 17% |

### Discount Display

In-app:
```
Current Plan: Pro ($49/mo)
Annual Billing: $40.83/mo ($490/yr — save 17%)
Coupon Applied: LAUNCH2026 (20% off first 6 months) → $39.20/mo for 6 months, then $49/mo
```

### Coupon Validation Rules

1. Code must be active and not expired
2. Max redemptions not exceeded
3. Plan tier eligibility met
4. New customer restriction (if set)
5. Not combinable with other discounts (exception: annual discount + coupon = stacked)
6. One coupon per subscription
7. Cannot be applied retroactively to existing paid periods

### Admin Coupon Management

```
POST   /api/v1/admin/coupons                — Create coupon
GET    /api/v1/admin/coupons                — List coupons
PATCH  /api/v1/admin/coupons/:id            — Update coupon
DELETE /api/v1/admin/coupons/:id            — Deactivate coupon
GET    /api/v1/admin/coupons/:id/redemptions — Usage report
POST   /api/v1/admin/coupons/validate       — Test validation
```

---

## 9. Churn Prevention

### Dunning System

Multi-step dunning flow for failed payments:

```
Payment fails
  →
  Attempt 1 (Day 0, immediate retry):
    - Retry payment immediately
    - Send notification: "Payment declined — please update your payment method"
    - In-app banner: "Payment failed. Update billing info to continue."

  Attempt 2 (Day 3):
    - Retry payment
    - Email: "Action required: update your payment method"
    - In-app persistent banner + top banner

  Attempt 3 (Day 7):
    - Retry payment
    - Email: "Your account will be suspended in 3 days"
    - SMS notification (if phone on file)
    - Subject: stronger urgency

  Attempt 4 (Day 10, final):
    - Retry payment
    - Email: "Final notice: account suspension imminent"
    - Countdown banner in app

  Day 14 — Failed:
    - Suspend account
    - Downgrade to Free plan
    - Email: "Your account has been suspended. Reactivate anytime."
    - Data preserved for 30 days
```

### Payment Retry Logic

```typescript
interface DunningConfig {
  maxRetries: 4;
  retryIntervals: [0, 3, 7, 10];  // days after first failure
  retryTimes: ['10:00', '14:00', '10:00', '10:00'];  // UTC
  smartRetry: {
    // If card declined due to insufficient funds: retry on payday (Fri/Sat)
    // If expired: stop retrying, ask for new card
    // If fraud suspected: stop, contact customer
    bankDeclineStrategy: 'extend_interval' | 'stop';
  };
  suspensionPolicy: {
    suspendAfterDays: 14;
    dataRetentionDays: 30;
    permanentDeletionAfterDays: 90;
  };
}
```

### Downgrade Path

Instead of canceling, users are offered:

1. **Downgrade to Free** — Keep account, lose premium features, data preserved
2. **Pause Subscription** — Freeze billing for up to 3 months, data preserved, no access during pause
3. **Slim Plan** — Custom mini-plan (Enterprise only)
4. **Cancel** — Full cancellation, data exported and deleted after 90 days

### Retention Offers

| Cancellation Reason | Offer |
|---|---|
| Too expensive | "We'd hate to see you go. Here's 25% off for 3 months." |
| Not using enough | "Downgrade to Starter — save $30/mo, keep your data." |
| Missing feature | "We're launching that feature in 2 weeks. Want early access?" |
| Technical issues | "Let's fix this. Our support team will reach out within 24h." |
| Going out of business | "We understand. Pause your account for free, come back anytime." |
| Switching to competitor | "We'll match their price for 6 months. Plus, here's 3 premium AI models free." |

### Voluntary Cancellation Flow

```
User initiates cancel
  →
  1. Show retention survey: "Help us improve — why are you leaving?"
     Options: [Too expensive, Missing features, Technical issues, Not using enough, Switching to competitor, Other]
  2. Based on response: show dynamic retention offer (see table above)
  3. If user proceeds:
     a. Offer: "Downgrade to Free instead? Keep your data."
     b. Offer: "Pause your subscription for up to 3 months."
     c. If confirmed cancel:
        - Schedule cancellation at end of billing period
        - Email: cancellation confirmation + data export link
        - 30-day data retention window
        - Final email: "We miss you already. Come back with 20% off next 3 months."
  4. Mark in CRM: churned, reason, offer made, offer accepted/rejected
```

### Churn Analytics Dashboard

```
Churn Rate: 3.2% (monthly)
Voluntary Churn: 2.1%
Involuntary Churn (payment): 1.1%

Churn by Plan:
  Free → Churned: 5.1%  (to not-active)
  Starter → Churned: 4.2%
  Pro → Churned: 2.8%
  Agency → Churned: 1.5%

Churn by Reason (voluntary):
  Too expensive: 34%
  Missing features: 22%
  Not using enough: 18%
  Switching to competitor: 14%
  Technical issues: 8%
  Other: 4%

Retention Offer Win Rate:
  25% off 3mo: 22%
  Downgrade to Free: 31%
  Pause subscription: 18%
  Price match: 15%
  Total Saved: 26% of cancellation intents
```

### Reactivation Campaigns

| Trigger | Action |
|---|---|
| 7 days after churn | Email: "We've improved X feature you asked about" |
| 30 days after churn | Email: "Check out our new AI Repurposing Engine" |
| 60 days after churn | Email: "Come back — we've launched X, Y, Z" |
| 90 days after churn | Final email: "Your data will be deleted in 30 days" |
| Product launch | Re-engagement campaign to all churned users |
| Feature release (requested) | Personalized email to users who cited missing feature |

---

## Appendix A: Billing System Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Web Client  │     │  API Server  │     │  Admin Panel │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                  Billing Service                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Plan Mgmt│  │ Invoice  │  │ Usage Metering   │  │
│  └────┬─────┘  └────┬─────┘  └───────┬──────────┘  │
│       │              │                │              │
│  ┌────▼──────────────▼────────────────▼──────────┐  │
│  │               Stripe/Lemon API                 │  │
│  └────────────────────┬──────────────────────────┘  │
└───────────────────────┼──────────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  Stripe / LQ / P   │
              │  Payment Processors │
              └────────────────────┘
```

## Appendix B: Stripe Product & Price Data Model

```json
{
  "product": {
    "id": "prod_social_media_os_pro",
    "name": "Pro Monthly",
    "description": "For professional marketers and growing teams",
    "metadata": {
      "plan_id": "pro",
      "billing_interval": "monthly",
      "features": "ai_studio,ai_repurposing,advanced_analytics,approval_workflows"
    }
  },
  "prices": {
    "monthly": {
      "id": "price_pro_monthly",
      "currency": "usd",
      "unit_amount": 4900,
      "recurring": { "interval": "month" }
    },
    "yearly": {
      "id": "price_pro_yearly",
      "currency": "usd",
      "unit_amount": 49000,
      "recurring": { "interval": "year" }
    }
  }
}
```

## Appendix C: Webhook Reliability

- **Idempotency**: All webhook handlers use Stripe `Idempotency-Key` header to prevent duplicate processing
- **Retry**: Stripe retries failed webhooks for up to 3 days with exponential backoff
- **Dead Letter Queue**: Webhooks that fail permanently are logged to DLQ for manual review
- **Webhook Log**: All webhook events stored in `webhook_events` table for audit
- **Signature Verification**: Every webhook payload is verified using `stripe.webhooks.constructEvent()`
