# Folder Structure

```
saas-boilerplate/
├── apps/
│   └── web/                          # Next.js 15 application
│       ├── app/                      # App Router pages
│       │   ├── (marketing)/          # Public marketing pages
│       │   │   ├── page.tsx          # Landing page
│       │   │   ├── pricing/
│       │   │   ├── blog/
│       │   │   └── docs/
│       │   ├── (dashboard)/          # Authenticated app shell
│       │   │   ├── dashboard/
│       │   │   ├── settings/
│       │   │   └── admin/
│       │   ├── api/                  # Route handlers
│       │   │   ├── auth/
│       │   │   ├── webhooks/
│       │   │   └── trpc/
│       │   └── layout.tsx
│       ├── components/               # App-specific components
│       │   ├── ui/                   # shadcn/ui primitives
│       │   ├── forms/
│       │   └── layouts/
│       ├── lib/                      # App utilities
│       ├── styles/                   # Global styles
│       └── public/                   # Static assets
│
├── packages/
│   ├── auth/                         # Authentication (adapter pattern)
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   ├── nextauth/
│   │   │   │   └── supabase/
│   │   │   ├── AuthService.ts        # Public contract
│   │   │   ├── types.ts
│   │   │   └── errors.ts
│   │   └── package.json
│   │
│   ├── billing/                      # Payment processing (adapter pattern)
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   ├── stripe/
│   │   │   │   └── lemon-squeezy/
│   │   │   ├── BillingService.ts     # Public contract
│   │   │   ├── types.ts
│   │   │   └── errors.ts
│   │   └── package.json
│   │
│   ├── database/                     # Prisma client + utilities
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── utils.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── emails/                       # React Email templates
│   │   ├── src/
│   │   │   ├── templates/
│   │   │   └── components/
│   │   └── package.json
│   │
│   ├── storage/                      # File storage (adapter pattern)
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   └── StorageService.ts
│   │   └── package.json
│   │
│   ├── analytics/                    # Analytics (adapter pattern)
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   └── AnalyticsService.ts
│   │   └── package.json
│   │
│   ├── notifications/                # Centralized notification service
│   │   ├── src/
│   │   │   ├── channels/
│   │   │   └── NotificationService.ts
│   │   └── package.json
│   │
│   ├── feature-flags/                # Feature flag system
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── ui/                           # Shared UI component library
│   │   ├── src/
│   │   │   ├── atoms/
│   │   │   ├── molecules/
│   │   │   └── organisms/
│   │   └── package.json
│   │
│   ├── config/                       # Shared configuration
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── src/
│   │   └── package.json
│   │
│   └── shared/                       # Shared utilities
│       ├── src/
│       └── package.json
│
├── prisma/                           # Prisma schema + migrations
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── scripts/                          # DevOps scripts
│   ├── setup.sh
│   ├── seed.ts
│   └── docker/
│
├── docs/                             # Project documentation
│   ├── architecture/
│   ├── adr/
│   └── guides/
│
├── tests/                            # E2E and integration tests
│   ├── e2e/
│   └── integration/
│
├── .github/                          # GitHub Actions CI/CD
│   └── workflows/
│
├── docker-compose.yml
├── Dockerfile
├── turbo.json
├── package.json                      # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.json
├── .env.example
└── README.md
```

## Package Boundaries

| Package         | Responsibility                          | Dependencies                    |
| --------------- | --------------------------------------- | ------------------------------- |
| `auth`          | Authentication, authorization, sessions | database, config, types         |
| `billing`       | Subscriptions, payments, invoices       | database, config, types, emails |
| `database`      | Prisma client, queries, transactions    | config                          |
| `emails`        | Email templates, rendering              | types                           |
| `storage`       | File uploads, CDN, signed URLs          | config, types                   |
| `analytics`     | Event tracking, reporting               | config, types                   |
| `notifications` | Multi-channel notifications             | emails, types                   |
| `ui`            | Shared React components                 | types                           |
| `config`        | Environment config, validation          | types                           |
| `types`         | Shared type definitions, DTOs           | none                            |
| `shared`        | Utilities, helpers, constants           | types                           |

## Import Rules

- `apps/web` may import any `packages/*`
- `packages/*` may **not** import `apps/web`
- `packages/*` may import other `packages/*` only through stable interfaces
- Cross-package imports must use exported public APIs only
- No circular dependencies permitted
