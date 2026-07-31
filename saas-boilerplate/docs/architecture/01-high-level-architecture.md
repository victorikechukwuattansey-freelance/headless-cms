# High-Level Architecture

## System Overview

The SaaS Boilerplate is a multi-tenant, production-grade platform designed for commercial SaaS products. It follows a modular monorepo architecture with clean domain boundaries and provider abstraction.

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                       Clients                               │
│  Browser (Next.js)  │  Mobile App  │  API Clients           │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │   CDN   │  (Vercel Edge / Cloudflare)
                    └────┬────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Presentation Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js App Router                                   │   │
│  │  • Server Components (default)                        │   │
│  │  • Client Components (when needed)                    │   │
│  │  • Route Handlers (API)                               │   │
│  │  • Server Actions                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Application Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services & Use Cases                                 │   │
│  │  • Orchestration                                      │   │
│  │  • Workflows                                          │   │
│  │  • Commands / Queries                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Domain Layer                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Entities                                           │   │
│  │  • Business Rules                                     │   │
│  │  • Policies & Permissions                             │   │
│  │  • Domain Services                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐   │
│  │ Auth   │Billing │Database│ Email  │Storage │Analytics│   │
│  │Adapter │Adapter │(Prisma)│Adapter │Adapter │Adapter  │   │
│  └────────┴────────┴────────┴────────┴────────┴────────┘   │
└──────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   External Services                          │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐ │
│  │Next │Supab│Stripe│Resend│Upload│PostHog│Inngest│Redis │ │
│  │Auth │ase  │      │      │Thing │       │(Jobs)│(Cache│ │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

| Decision        | Choice                   | Rationale                                                    |
| --------------- | ------------------------ | ------------------------------------------------------------ |
| Monorepo        | Turborepo + pnpm         | Shared packages, incremental builds, workspace boundaries    |
| Framework       | Next.js 15 App Router    | Server Components, streaming, route handlers, server actions |
| Language        | TypeScript (strict)      | Type safety across the full stack                            |
| Styling         | Tailwind + shadcn/ui     | Utility-first with accessible primitives                     |
| Database        | PostgreSQL + Prisma      | Type-safe ORM, migrations, strong ecosystem                  |
| Auth            | NextAuth / Supabase Auth | Adapter pattern for provider independence                    |
| Payments        | Stripe (+ Lemon Squeezy) | Adapter pattern, subscription + one-time support             |
| Background Jobs | Inngest                  | Reliable queues, scheduling, retries                         |
| Email           | Resend + React Email     | Component-based templates, preview workflow                  |
| Storage         | UploadThing / S3         | Adapter pattern, signed URLs                                 |
| Analytics       | PostHog                  | Self-hostable, event tracking                                |
| Caching         | Redis                    | Session cache, rate limiting, job queues                     |

## Dependency Direction

```text
apps/web  ──►  packages/*  ──►  external services
                    │
                    ▼
           Infrastructure adapters
```

Dependencies flow inward. Infrastructure never owns business rules.
