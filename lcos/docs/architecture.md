# System Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Pages  │ │Components│ │  Stores  │ │React Query  │  │
│  │ (AppDir)│ │ (shadcn) │ │(Zustand) │ │(TanStack)   │  │
│  └─────────┘ └──────────┘ └──────────┘ └─────────────┘  │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP/REST + WebSocket
                       ▼
┌──────────────────────────────────────────────────────────┐
│                 API Gateway (NestJS)                       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Auth   │ │  Tenant  │ │  Rate    │ │  Validation │  │
│  │ Guard   │ │  Guard   │ │  Limiter│ │  Pipe       │  │
│  └─────────┘ └──────────┘ └──────────┘ └─────────────┘  │
└──────────────────────┬───────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Modules    │ │  Event   │ │    Queue     │
│  (NestJS)    │ │   Bus    │ │   (BullMQ)   │
│              │ │          │ │              │
│ Products     │ │ pub/sub  │ │ AI Processing│
│ Inventory    │ │ internal │ │ Email/SMS    │
│ CRM          │ │ events   │ │ Webhooks     │
│ Sales        │ │          │ │ Export Jobs  │
│ Auth         │ │          │ │              │
│ AI Agents    │ │          │ │              │
│ Automation   │ │          │ │              │
│ Integrations │ │          │ │              │
└──────┬───────┘ └──────────┘ └──────┬───────┘
       │                              │
       └──────────┬───────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────┐
│                 Prisma ORM + PostgreSQL                     │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Core   │ │   AI     │ │  Audit   │ │  Analytics  │  │
│  │ Models  │ │ Embeddings│ │   Logs   │ │  Aggregates │  │
│  └─────────┘ └──────────┘ └──────────┘ └─────────────┘  │
│                   pgvector extension                      │
└──────────────────────────────────────────────────────────┘
```

## Layer Architecture

### 1. Presentation Layer (Next.js)
- Server-side rendered pages
- Client components for interactivity
- Server actions for mutations
- React Query for data fetching
- Zustand for client state
- Shadcn UI component library

### 2. API Layer (NestJS)
- RESTful API endpoints
- JWT authentication
- Tenant isolation middleware
- Rate limiting
- Request validation
- Response transformation

### 3. Service Layer
- Business logic encapsulation
- Event emission
- Cross-module communication
- AI agent orchestration
- Automation rule evaluation

### 4. Integration Layer
- Third-party API clients
- Webhook delivery
- Queue processing
- File upload/download

### 5. Data Layer (Prisma + PostgreSQL)
- Multi-tenant data isolation
- Vector embeddings for AI search
- Audit logging
- Soft delete support
- Optimistic concurrency

## Key Design Decisions

### Why NestJS over Express/Fastify?
- Module system mirrors business domains
- Built-in DI, guards, interceptors, pipes
- Decorator-based controllers are self-documenting
- Swagger generation is first-class
- Microservice-ready when scaling

### Why PostgreSQL over MongoDB?
- Relational data is inherently relational (products, orders, customers)
- pgvector for embeddings (no separate vector DB needed)
- Mature migration tooling (Prisma)
- JSON columns for flexible metadata

### Why Next.js App Router over Pages Router?
- Server components for performance
- Layout-based routing for dashboard
- Streaming SSR
- Built-in image optimization
- Server actions for forms

## Data Flow

```
User Action → Next.js Component → API Call → NestJS Controller
  → Validation Pipe → Service Layer → Prisma Query → PostgreSQL
  → Event Bus → Automations / AI / Notifications → Response
```

## Security Architecture

```
Client → HTTPS → Cloudflare/WAF → Load Balancer → NestJS
  → Helmet Middleware → Rate Limiter → JWT Auth → Tenant Guard
  → Module Guards (Roles) → Controller → Service
```
