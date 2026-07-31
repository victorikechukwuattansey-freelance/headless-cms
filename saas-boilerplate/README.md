# SaaS Boilerplate

A production-ready, multi-tenant Next.js SaaS starter kit. Ships with auth (NextAuth / Supabase), billing (Stripe / Lemon Squeezy), teams, analytics, notifications, file storage, emails, feature flags, admin panel, and more — all behind a provider-abstraction adapter pattern that lets you swap vendors without touching application code.

## Architecture

```
apps/web          — Next.js 15 App Router application
packages/
  auth            — Authentication (NextAuth v5 adapter, Supabase skeleton, factory)
  payments        — Billing (Stripe adapter, Lemon Squeezy adapter, factory)
  storage         — File storage (S3 adapter, UploadThing adapter, factory)
  analytics       — Analytics (PostHog, Plausible, Google Analytics adapters, factory)
  notifications   — Notifications (In-App channel, Email channel, singleton service)
  database        — Prisma client + full schema (23 models) + modular seed system
  emails          — React Email templates (welcome, verification, password reset, invoices)
  api             — API utilities (pagination, rate limiting, errors)
  config          — Shared configuration (env vars, plans, feature gates)
  feature-flags   — Feature flag system (per-user, per-org, per-environment)
  types           — Shared TypeScript types
  ui              — shadcn/ui component library (Radix primitives, dark/light mode)
  utils           — Utility functions
```

Every external service follows: **Interface → Adapters → Factory** (see [provider abstraction](docs/architecture/10-provider-abstraction.md)).

## Features

- **Auth** — Email/password, magic links, OAuth (GitHub, Google, Discord, Microsoft), password reset flow
- **Multi-Tenant** — Organizations with teams, roles (OWNER/ADMIN/MEMBER), permissions, invitations
- **Billing** — Subscriptions, trials, customer portal, invoices, webhooks
- **Admin Panel** — User management, payments, coupons, announcements, email broadcast
- **Analytics** — PostHog, Plausible, or Google Analytics via adapter
- **Notifications** — In-app toast + email channels, user preferences
- **File Storage** — S3 or UploadThing via adapter
- **Feature Flags** — Per-user, per-org, per-environment, per-plan
- **Emails** — Transactional emails with React Email + Resend
- **UI** — shadcn/ui, Radix primitives, Tailwind CSS, dark/light mode
- **Infrastructure** — Docker, Docker Compose, CI/CD (GitHub Actions), Husky pre-commit hooks
- **Security** — CSRF, CSP, rate limiting, RBAC, audit logging

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL (requires Docker)
docker compose -f docker/docker-compose.yml up -d postgres

# Push schema and seed
pnpm db:push
pnpm db:seed

# Start development
pnpm dev
```

Visit http://localhost:3000.

### Default Accounts (after seed)

| Role  | Email          | Password |
| ----- | -------------- | -------- |
| Admin | admin@saas.com | admin123 |
| User  | user@saas.com  | user123  |

## Environment Variables

See [Environment Variables](docs/env.md) for the full list. Key variables:

| Variable             | Description                        |
| -------------------- | ---------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string       |
| `AUTH_SECRET`        | Session encryption key (32+ chars) |
| `AUTH_PROVIDER`      | `nextauth` or `supabase`           |
| `BILLING_PROVIDER`   | `stripe` or `lemon-squeezy`        |
| `STORAGE_PROVIDER`   | `s3` or `uploadthing`              |
| `ANALYTICS_PROVIDER` | `posthog`, `plausible`, or `ga`    |

## Tech Stack

| Layer     | Technology                             |
| --------- | -------------------------------------- |
| Framework | Next.js 15 (App Router)                |
| Language  | TypeScript (strict)                    |
| Styling   | Tailwind CSS + shadcn/ui               |
| Database  | PostgreSQL + Prisma ORM                |
| Auth      | NextAuth v5 / Supabase Auth            |
| Payments  | Stripe / Lemon Squeezy                 |
| Email     | React Email + Resend                   |
| Storage   | AWS S3 / UploadThing                   |
| Analytics | PostHog / Plausible / Google Analytics |
| Jobs      | Inngest                                |
| Cache     | Redis                                  |
| Monorepo  | Turborepo + pnpm                       |
| CI/CD     | GitHub Actions + Docker                |

## Commands

```bash
pnpm dev           # Start all apps in dev mode
pnpm build         # Production build
pnpm lint          # ESLint
pnpm typecheck     # TypeScript checks (14 packages)
pnpm test          # Tests
pnpm format        # Prettier formatting

pnpm db:generate   # Generate Prisma client
pnpm db:push       # Push schema to database
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed database
pnpm db:studio     # Open Prisma Studio
```

## Documentation

| Guide                  | Location                                      |
| ---------------------- | --------------------------------------------- |
| Architecture           | `docs/architecture/` (10 docs)                |
| API Reference          | `docs/api.md`                                 |
| Getting Started        | `docs/getting-started.md`                     |
| Deployment             | `docs/deployment.md`                          |
| Environment Variables  | `docs/env.md`                                 |
| Contributing           | `docs/contributing.md`                        |
| Architecture Decisions | `docs/adr/` (6 ADRs)                          |
| Auth Implementation    | `docs/auth/01-phase-4-auth-implementation.md` |
| Database Design        | `docs/database/01-phase-3-database.md`        |
| Infrastructure         | `docs/infrastructure/01-phase-2-polish.md`    |

## License

MIT
