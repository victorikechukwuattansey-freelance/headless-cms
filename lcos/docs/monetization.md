# Monetization Strategy

## Overview

LCOS uses a **tiered SaaS subscription model** with four pricing tiers. Revenue is generated through monthly/annual subscriptions, usage-based overages, and a future partner/reseller program.

---

## 1. Pricing Tiers

### Tier Comparison

| Feature | Starter | Growth | Professional | Enterprise |
|---|---|---|---|---|
| **Price (monthly)** | $49 | $149 | $399 | Custom |
| **Price (annual)** | $490 ($40.83/mo) | $1,490 ($124.17/mo) | $3,990 ($332.50/mo) | Custom |
| **Annual savings** | 17% | 17% | 17% | Custom |
| **Users** | 2 | 5 | 15 | Unlimited |
| **Products** | 500 | 5,000 | 50,000 | Unlimited |
| **Contacts** | 1,000 | 10,000 | 100,000 | Unlimited |
| **API requests** | 1,000/min | 5,000/min | 20,000/min | Custom |

### Starter — $49/mo

**Target**: Small boutiques, solo operators, test-driving LCOS

| Feature | Included |
|---|---|
| Product management | Up to 500 products |
| CRM | Up to 1,000 contacts, basic pipeline |
| Orders | Order management, quotes |
| Dashboard | Core metrics |
| AI Studio | 50 AI queries/month |
| Users | 2 seats |
| Support | Email (48h response) |
| Integrations | Email, basic webhooks |
| Storage | 1 GB file storage |

### Growth — $149/mo

**Target**: Growing luxury brands, small teams

| Feature | Included |
|---|---|
| Everything in Starter | — |
| Products | Up to 5,000 |
| Contacts | Up to 10,000 |
| AI Studio | 500 AI queries/month |
| Automations | Up to 10 active workflows |
| Marketing | Campaigns, segments, email templates |
| Users | 5 seats |
| Support | Email (24h) + chat (business hours) |
| Integrations | Webhooks, Shopify, Mailchimp |
| Storage | 10 GB file storage |
| API rate | 5,000 req/min |

### Professional — $399/mo

**Target**: Established brands, multi-channel operations

| Feature | Included |
|---|---|
| Everything in Growth | — |
| Products | Up to 50,000 |
| Contacts | Up to 100,000 |
| AI Studio | 2,000 AI queries/month |
| Automations | Unlimited workflows |
| Marketing | A/B testing, advanced segments |
| Analytics | Custom reports, scheduled exports |
| Users | 15 seats |
| Support | Priority email (4h) + chat + phone |
| Integrations | Salesforce, advanced webhooks |
| Storage | 100 GB file storage |
| API rate | 20,000 req/min |
| White-label | Custom domain + basic theming |

### Enterprise — Custom Pricing

**Target**: Large retailers, multi-brand groups, platform resellers

| Feature | Included |
|---|---|
| Everything in Professional | — |
| Products | Unlimited |
| Contacts | Unlimited |
| AI Studio | Custom quota |
| Users | Unlimited |
| Support | Dedicated account manager, 1h SLA |
| White-label | Full branding removal, custom theme |
| SSO/SAML | Okta, Azure AD, Google Workspace |
| SCIM | User provisioning |
| Audit logs | 7-year retention |
| Data residency | US, EU, or APAC |
| SLA | 99.99% uptime |
| Custom contract | Annual or multi-year |
| On-premise option | Available |

---

## 2. Usage-Based Overage Pricing

### AI Studio Overage

| Tier | Included | Overage Rate |
|---|---|---|
| Starter | 50 queries/mo | $0.50/query |
| Growth | 500 queries/mo | $0.30/query |
| Professional | 2,000 queries/mo | $0.20/query |
| Enterprise | Custom | Negotiated |

### Storage Overage

| Tier | Included | Overage Rate |
|---|---|---|
| Starter | 1 GB | $5/GB/mo |
| Growth | 10 GB | $3/GB/mo |
| Professional | 100 GB | $2/GB/mo |
| Enterprise | Custom | Negotiated |

### API Overage

Excess API requests beyond the tier limit are throttled (not charged). Tenants can purchase higher rate limits:

- **Rate limit upgrade**: $20/month per additional 1,000 req/min

### SMS Overage

| Tier | Included | Overage Rate |
|---|---|---|
| All tiers | 0 (pay-as-you-go) | $0.0079/SMS (US) |

---

## 3. Billing Models

### Monthly vs Annual

| Aspect | Monthly | Annual |
|---|---|---|
| Payment | Every 30 days | Every 365 days |
| Discount | None | 17% off (2 months free) |
| Commitment | None | 12-month commitment |
| Refund | Prorated cancellation | No refund (annual paid upfront) |

### Invoice vs Credit Card

| Payment Method | Monthly | Annual |
|---|---|---|
| Credit card (Stripe) | ✅ Auto-charged | ✅ Auto-charged |
| ACH/bank transfer | Enterprise only | Enterprise only |
| Invoice (NET 30) | Enterprise only | Enterprise only |

---

## 4. Free Trial Strategy

### Trial Terms

| Parameter | Value |
|---|---|
| Duration | 14 days |
| Features | Full Growth tier access |
| Users | Up to 5 |
| Credit card | Not required |
| Upgrade required | After trial ends |
| Data retention post-expiry | 30 days (read-only) |
| Permanent deletion | After 30 days of expiry |

### Trial Conversion Tactics

| Trigger | Action | Timing |
|---|---|---|
| Day 1 | Welcome email + onboarding tips | Immediate |
| Day 3 | "Add your first product" CTA | End of day 3 |
| Day 7 | Mid-trial check-in email + case study | Day 7 |
| Day 10 | "Your trial is ending" email + limited-time offer | Day 10 |
| Day 13 | "Last chance" email + gift of 7 extra days | Day 13 |
| Day 14 | Trial expires → downgrade to limited free tier | Day 14 |

### Limited Free Tier (Post-Trial)

| Feature | Free Tier |
|---|---|
| Products | 10 |
| Contacts | 50 |
| Orders | View only (last 30 days) |
| AI Studio | 0 queries |
| Support | Knowledge base only |

---

## 5. Upgrade / Downgrade Flows

### Upgrade Flow

1. User clicks "Upgrade" in billing settings or banner
2. Feature comparison modal shown (highlighting new features)
3. User selects new tier and billing frequency
4. Stripe handles proration:
   - **Monthly → Monthly**: Prorated credit for remaining days, new price starts immediately
   - **Monthly → Annual**: Credit applied, annual charge captured
   - **Annual → Annual**: Prorated credit, remaining balance charged
5. All restricted features instantly unlocked
6. Confirmation email sent

### Downgrade Flow

1. User initiates downgrade in billing settings
2. Warning modal shows features that will be lost:
   - List of products exceeding new limit
   - Automations that will be paused
   - Users that will be deactivated
3. User must resolve over-limit items (delete/archive) or choose a different tier
4. Downgrade takes effect at **next billing cycle** (current features remain until then)
5. Confirmation email sent
6. At cycle boundary:
   - Overage items are soft-deleted or locked
   - Extra users are deactivated
   - Automations exceeding limit are paused

### Self-Service Capabilities

| Action | Self-Service | Requires Support |
|---|---|---|
| Upgrade tier | ✅ | — |
| Downgrade tier | ✅ (next cycle) | — |
| Cancel subscription | ✅ | — |
| Reactivate account | ✅ (within 30 days) | — |
| Change billing frequency | ✅ (next cycle) | — |
| Add payment method | ✅ | — |
| Request enterprise quote | — | ✅ |
| Custom contract | — | ✅ |
| Data export on cancel | ✅ | — |

---

## 6. Partner / Reseller Program

### Program Structure

| Partner Level | Min Commitment | Commission | Discount | Requirements |
|---|---|---|---|---|
| Affiliate | None | 20% first year | None | Referral link, apply |
| Reseller | $2,000/mo MRR | 30% first year | 20% off list | Signed agreement |
| Strategic | $10,000/mo MRR | 35% first year | 30% off list | Dedicated partnership |

### Reseller Features

- **White-label sub-accounts**: Resellers manage their own tenants
- **Multi-tenant dashboard**: Reseller sees all their tenants' health
- **Custom pricing**: Reseller sets their own prices (above cost)
- **Billing**: Reseller handles their own billing or uses LCOS billing with commission
- **Support**: Reseller provides L1 support, LCOS provides L2/L3

### Partner Requirements

| Requirement | Affiliate | Reseller | Strategic |
|---|---|---|---|
| Application | ✅ | ✅ | ✅ |
| Background check | — | ✅ | ✅ |
| Minimum revenue | — | $2,000/mo MRR | $10,000/mo MRR |
| Staff training | — | ✅ | ✅ |
| Support SLA | — | 24h | 4h |
| Quarterly review | — | — | ✅ |

### Revenue Share Example

```
List Price: $399/mo (Professional)
Reseller Discount: 20% → Reseller cost: $319.20/mo
Reseller's Price: $499/mo
Reseller Margin: $179.80/mo (36% margin)
Commission to Reseller (Y1): $143.64/mo (36% of list)
```

---

## 7. Revenue Projections

### Year 1 — Conservative

| Tier | Tenants (EOM) | Avg Revenue/Tenant | Monthly Revenue |
|---|---|---|---|
| Starter | 100 | $49 | $4,900 |
| Growth | 40 | $149 | $5,960 |
| Professional | 15 | $399 | $5,985 |
| Enterprise | 3 | $1,500 | $4,500 |
| **Total** | **158** | — | **$21,345** |

### Year 2 — Moderate

| Tier | Tenants (EOM) | Avg Revenue/Tenant | Monthly Revenue |
|---|---|---|---|
| Starter | 300 | $49 | $14,700 |
| Growth | 150 | $149 | $22,350 |
| Professional | 60 | $399 | $23,940 |
| Enterprise | 15 | $2,000 | $30,000 |
| **Total** | **525** | — | **$90,990** |

### Key Assumptions

- Annual discount take-rate: 30% of subscribers
- Monthly churn rate: 5% (Starter), 3% (Growth), 2% (Professional)
- Average revenue per user (ARPU) increases with tier upgrades
- Enterprise deals are annual contracts paid upfront
- Overage revenue is ~5% of subscription revenue

---

## 8. Pricing Principles

1. **Value-based**: Price correlates with value delivered, not cost to serve
2. **Simple**: Tiers are easy to understand and compare
3. **Room to grow**: Natural upgrade path as businesses scale
4. **Generous at start**: Starter tier is viable for small businesses
5. **Enterprise-ready**: Custom pricing for large organizations
6. **Transparent**: No hidden fees, clear overage pricing
7. **Fair usage**: Limits are generous but protect platform stability
