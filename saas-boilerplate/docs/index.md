# SaaS Boilerplate Documentation

A production-ready Next.js SaaS starter kit with authentication, payments, teams, and everything you need to launch your SaaS product.

## Quick Start

```bash
# Clone the repository
git clone <repo-url> saas-boilerplate
cd saas-boilerplate

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start database (requires Docker)
docker compose -f docker/docker-compose.yml up -d postgres

# Push schema and seed
pnpm db:push
pnpm db:seed

# Start development
pnpm dev
```

## Architecture

This boilerplate uses a **monorepo** architecture with **Turborepo** and **pnpm workspaces**.

### Folder Structure

```
├── apps/
│   └── web/              # Next.js 15 application
├── packages/
│   ├── api/              # API utilities and helpers
│   ├── auth/             # Authentication (NextAuth v5)
│   ├── config/           # Shared configuration (env, plans)
│   ├── database/         # Prisma client and database
│   ├── emails/           # React Email templates
│   ├── feature-flags/    # Feature flag system
│   ├── payments/         # Stripe + Lemon Squeezy
│   ├── storage/          # File storage abstraction
│   ├── types/            # Shared TypeScript types
│   ├── ui/               # UI components (shadcn/ui)
│   └── utils/            # Utility functions
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
├── docker/
│   ├── Dockerfile        # Production Docker image
│   └── docker-compose.yml # Local development services
├── docs/                 # Documentation
└── tests/                # Test suites
```

## Tech Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Framework       | Next.js 15 (App Router)          |
| Language        | TypeScript                       |
| Styling         | Tailwind CSS + shadcn/ui         |
| Database        | PostgreSQL + Prisma              |
| Auth            | NextAuth v5 (multiple providers) |
| Payments        | Stripe + Lemon Squeezy           |
| Email           | React Email + Resend             |
| Storage         | AWS S3 / UploadThing             |
| Package Manager | pnpm                             |
| Build System    | Turborepo                        |
