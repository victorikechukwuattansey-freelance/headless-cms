# AI Luxury Commerce Operating System (LCOS)

**The "Shopify + HubSpot + Notion + Airtable + Canva + ChatGPT + n8n" for luxury resale.**

LCOS is a production-ready, AI-first, multi-tenant SaaS platform that powers luxury resale businesses. It replaces 10+ standalone tools with one integrated operating system.

## Quick Start

```bash
# 1. Clone and install
git clone <repo> lcos
cd lcos

# 2. Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# 3. Setup backend
cd backend
pnpm install
cp ../.env.example .env  # Configure your environment
npx prisma generate
npx prisma migrate dev
pnpm start:dev

# 4. Setup frontend (new terminal)
cd frontend
pnpm install
pnpm dev
```

## Architecture

```
Frontend (Next.js)         → Vercel
Backend API (NestJS)       → Railway/Render
Database (PostgreSQL)      → Neon/Supabase
Cache (Redis)              → Upstash
AI (OpenAI)                → API
File Storage (Cloudinary)  → CDN
Background Jobs (BullMQ)   → Redis
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Shadcn UI |
| State | Zustand, TanStack React Query |
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL 16, pgvector |
| Auth | JWT, RBAC, MFA |
| AI | OpenAI GPT-4o, Embeddings, Vector Search |
| Payments | Stripe, Paystack |
| Queue | BullMQ, Redis |
| CI/CD | GitHub Actions, Vercel, Railway |
| Monitoring | Sentry, OpenTelemetry |

## Project Structure

```
lcos/
├── backend/            # NestJS API server
│   ├── src/
│   │   ├── modules/    # Business modules (18 modules)
│   │   ├── common/     # Shared services, guards, interceptors
│   │   └── config/     # Application configuration
│   └── prisma/         # Database schema and migrations
├── frontend/           # Next.js application
│   └── src/
│       ├── app/        # Pages and layouts
│       ├── components/ # UI components
│       ├── stores/     # Zustand stores
│       └── lib/        # Utilities and API client
├── docs/               # Comprehensive documentation (25 files)
└── .github/            # CI/CD pipelines
```

## Modules

| Module | Description |
|--------|-------------|
| Products | Multi-category luxury item management with AI descriptions |
| Inventory | Real-time stock tracking with barcode support |
| CRM | Customer management, lead pipeline, VIP segmentation |
| Sales | Quotes, orders, invoices, payments, profit tracking |
| Authentication | Entrupy/Legit integration, certificate management |
| Suppliers | Supplier tracking, reliability scoring |
| AI Studio | 5 AI agents: Sales, Content, Pricing, Marketing, Analytics |
| Automation | Visual workflow engine with 15+ triggers and 10+ actions |
| Marketing | Social posting, campaigns, content calendar |
| Analytics | Revenue, margins, forecasts, demand prediction |
| Integrations | WhatsApp, Instagram, Stripe, Shopify, DHL, and more |
| Assets | Image/video/document management |

## Documentation

All documentation is in the `docs/` directory:

| Document | Description |
|----------|-------------|
| `PRD.md` | Full product requirements document |
| `architecture.md` | System architecture and design decisions |
| `api-spec.md` | Complete OpenAPI specification |
| `multi-tenant.md` | Multi-tenant architecture strategy |
| `auth.md` | Authentication and authorization design |
| `design-system.md` | UI design tokens and component library |
| `event-bus.md` | Event-driven architecture |
| `integrations.md` | Third-party integration patterns |
| `deployment.md` | Deployment and infrastructure |
| `testing.md` | Testing strategy across all layers |
| `ci-cd.md` | CI/CD pipeline design |
| `monitoring.md` | Monitoring and observability |
| `security.md` | Security checklist and OWASP compliance |
| `roadmap.md` | Phased product roadmap |
| `monetization.md` | Pricing and subscription tiers |
| `plugin-sdk.md` | Plugin/extension SDK design |
| `white-label.md` | White-label capabilities |
| `webhooks.md` | Webhook system design |

## License

Proprietary - All rights reserved.
