# SaaS Boilerplate — Launch Your SaaS in Hours

**A production-ready Next.js starter kit with authentication, payments, teams, and everything you need to ship a SaaS product fast.**

---

## What You Get

A complete, modern SaaS application built with Next.js 15, TypeScript, Tailwind CSS, and shadcn/ui. Every feature is production-ready — just add your business logic.

```bash
pnpm install && pnpm db:push && pnpm db:seed && pnpm dev
# → http://localhost:3000 with auth, dashboard, billing, admin panel
```

---

## Features

### Authentication

- Email/password login & registration
- Magic link sign-in (via Resend)
- OAuth: GitHub, Google, Discord, Microsoft
- JWT sessions with role-based access (USER, ADMIN, SUPER_ADMIN)
- Account deletion with confirmation

### Payments & Billing

- **Stripe** integration — checkout, webhooks, customer portal
- **Lemon Squeezy** integration — checkout, webhooks
- Subscription plans: Free, Starter ($29), Pro ($79), Business ($199)
- Monthly & yearly billing cycles
- Invoice history with PDF downloads
- Usage-based feature gating

### Team Management

- Multi-tenant organizations
- Role-based memberships (Owner, Admin, Member, Viewer)
- Invitation system with email tokens
- Team member management dashboard

### Dashboard

- Overview with revenue, user, subscription, API call metrics
- Analytics page
- Billing management with plan upgrades
- Team management
- API keys management
- Notifications feed
- Support page
- Usage tracking with progress bars

### Admin Panel

- User management (search, filter, role badges)
- Subscription overview (plan, status, provider)
- Feature flags (per environment, per organization)
- Audit logs with user/action/entity tracking
- Coupons, announcements, email broadcast pages

### Database

- PostgreSQL via Prisma ORM
- 18 models: User, Profile, Organization, Membership, Subscription, Invoice, Customer, ApiKey, Invitation, Notification, AuditLog, WebhookEvent, FeatureFlag, Team, TeamMember, BillingHistory, Account, Session
- Full-text search, soft deletes, indexes, relations
- Seed script with sample data

### Emails

- 7 React Email templates: Welcome, Verification, Password Reset, Magic Link, Invitation, Subscription Confirmation, Invoice
- Resend integration for sending

### API

- RESTful route handlers
- Server Actions for form mutations
- API key authentication
- Rate limiting
- Pagination, sorting, filtering
- Zod validation on all inputs

### UI Components

- 25+ shadcn/ui components (Button, Card, Dialog, Dropdown, Table, Tabs, etc.)
- Radix UI primitives
- Dark mode / Light mode
- Responsive design
- Loading skeletons
- Toast notifications
- Command palette-style search
- Data tables with pagination

### DevOps

- Docker + Docker Compose (PostgreSQL + Redis)
- Dockerfile for production deployment
- GitHub Actions CI (lint, typecheck, test, build)
- GitHub Actions CD (Vercel deploy, Docker push)
- Vitest for unit testing
- Playwright for E2E testing

### Security

- CSRF protection
- CSP headers
- Rate limiting
- RBAC (role-based access control)
- Secure HTTP headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Webhook signature verification (Stripe + Lemon Squeezy)
- Password hashing with bcrypt (12 rounds)

---

## Tech Stack

| Layer           | Technology               |
| --------------- | ------------------------ |
| Framework       | Next.js 15 (App Router)  |
| Language        | TypeScript (strict mode) |
| Styling         | Tailwind CSS + shadcn/ui |
| Database        | PostgreSQL + Prisma ORM  |
| Auth            | NextAuth v5              |
| Payments        | Stripe + Lemon Squeezy   |
| Email           | React Email + Resend     |
| Storage         | AWS S3 / UploadThing     |
| Package Manager | pnpm                     |
| Build System    | Turborepo                |

---

## Screenshots

| Page         | Preview                     |
| ------------ | --------------------------- |
| Landing Page | [screenshots/landing.png]   |
| Login        | [screenshots/login.png]     |
| Dashboard    | [screenshots/dashboard.png] |
| Billing      | [screenshots/billing.png]   |
| Admin Panel  | [screenshots/admin.png]     |
| Team         | [screenshots/team.png]      |

---

## Pricing

| License        | Price    | What's Included                                                              |
| -------------- | -------- | ---------------------------------------------------------------------------- |
| **Standard**   | **$79**  | 1 developer, 1 product, 12 months updates                                    |
| **Team**       | **$197** | 5 developers, unlimited products, 12 months updates                          |
| **Enterprise** | **$497** | Unlimited developers, unlimited products, lifetime updates, priority support |

---

## What Customers Say

> "Saved me weeks of setup. The Stripe + auth integration alone was worth the price."
> — _Alex, Founder_

> "The admin panel and feature flags are incredibly well done. This is production quality."
> — _Sarah, CTO_

---

## FAQ

**Can I use this for client projects?**
Yes, each license allows one developer to build one commercial product.

**What if I need help?**
Email support included with all licenses. Enterprise gets priority support.

**How are updates delivered?**
Via GitHub repository access or direct download.

**Can I get a refund?**
Yes, within 30 days of purchase if the product doesn't meet expectations.

---

## Ready to Launch?

[Buy on Gumroad — $79]
