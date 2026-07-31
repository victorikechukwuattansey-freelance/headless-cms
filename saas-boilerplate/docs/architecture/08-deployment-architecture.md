# Deployment Architecture

## Environment Strategy

| Environment   | Purpose             | Database       | Hosting           |
| ------------- | ------------------- | -------------- | ----------------- |
| `development` | Local dev           | Local Postgres | localhost:3000    |
| `staging`     | Integration testing | Staging DB     | Vercel Preview    |
| `production`  | Live customers      | Production DB  | Vercel Production |

## Infrastructure Layout

```text
                         ┌──────────────────┐
                         │   Cloudflare DNS  │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │   Vercel Edge    │
                         │   (CDN + Proxy)  │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
     │  Next.js App    │ │  API Routes    │ │  Static Assets │
     │  (Serverless)   │ │  (Serverless)  │ │  (CDN Cache)   │
     └────────┬────────┘ └───────┬────────┘ └────────────────┘
              │                   │
              └───────────────────┼───────────────────┐
                                  │                   │
                         ┌────────▼────────┐ ┌───────▼────────┐
                         │   PostgreSQL    │ │     Redis      │
                         │  (Managed DB)   │ │  (Upstash/...  )│
                         └─────────────────┘ └────────────────┘
```

## Services

| Service         | Provider                     | Scaling                  |
| --------------- | ---------------------------- | ------------------------ |
| Hosting         | Vercel                       | Auto-scaling serverless  |
| Database        | Supabase / Neon / Railway    | Vertical + read replicas |
| Cache           | Upstash Redis                | Auto-scaling             |
| File Storage    | UploadThing / S3             | Object store (infinite)  |
| Email           | Resend                       | Usage-based              |
| Background Jobs | Inngest                      | Auto-scaling             |
| Analytics       | PostHog Cloud                | Usage-based              |
| Auth            | NextAuth (database sessions) | Stateless JWTs           |

## CI/CD Pipeline

```text
Push to main ──► GitHub Actions
       │
       ├── Lint (ESLint + Prettier)
       ├── Type check (tsc --noEmit)
       ├── Unit tests (Vitest)
       ├── Build (pnpm build)
       ├── E2E tests (Playwright)
       │
       ▼
  Vercel Preview Deploy (staging)
       │
       ▼
  Merge to production ──► Vercel Production Deploy
       │
       ▼
  Post-deploy: smoke tests, migration run
```

## Docker (Local Development)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: saas-boilerplate
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on: [postgres, redis]
    env_file: .env
```
