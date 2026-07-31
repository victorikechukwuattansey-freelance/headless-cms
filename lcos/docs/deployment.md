# Deployment Architecture

> **Version:** 1.0.0  
> **Status:** Approved  
> **Last Updated:** 2026-07-21  

---

## 1. Architecture Overview

```
Internet
    |
    v
Cloudflare (DNS, CDN, DDoS protection)
    |
    +---> Vercel (Frontend - Next.js)
    |       app.lcos.io, *.lcos.io, tenant custom domains
    |
    +---> Railway (Backend API + Workers)
    |       api.lcos.io
    |       workers: webhook processor, cron jobs, event consumers
    |
    +---> Neon (PostgreSQL - Primary Database)
    |       Shared DB (row-level tenants)
    |       Dedicated DBs (enterprise tenants)
    |
    +---> Upstash (Redis)
    |       Event bus streams, sessions, cache, rate limiting
    |
    +---> AWS S3 (File Storage)
    |       Product images, media, backups, exports
    |
    +---> SendGrid (Email)
    |       Transactional emails, marketing campaigns
    |
    +---> Provider APIs
        Stripe, Shopify, WhatsApp, Instagram, DHL
```

### Technology Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 14 (React), Tailwind CSS | Vercel |
| Backend API | Node.js, Express, TypeScript | Railway |
| Background Jobs | BullMQ + Redis workers | Railway |
| Database | PostgreSQL 16 | Neon (Serverless) |
| Cache & Queue | Redis 7 | Upstash |
| File Storage | S3-compatible | AWS S3 / Cloudflare R2 |
| Email | SendGrid | Twilio SendGrid |
| Monitoring | Sentry, Grafana, Prometheus | Self-hosted / Grafana Cloud |

---

## 2. Vercel (Frontend) Configuration

### Project Setup

```json
// vercel.json
{
  "framework": "nextjs",
  "regions": ["fra1", "iad1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.lcos.io/v1",
    "NEXT_PUBLIC_APP_URL": "https://app.lcos.io",
    "NEXT_PUBLIC_SENTRY_DSN": "@sentry_dsn"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ],
  "redirects": [
    { "source": "/", "destination": "/dashboard", "permanent": true }
  ]
}
```

### Custom Domains

Tenant custom domains (e.g., shop.maisondupont.com) are handled via Vercel's domain wildcard:

1. Vercel project accepts all hostnames via `*.lcos.io` wildcard
2. Tenant custom domain: CNAME -> `cname.vercel-dns.com`
3. SSL auto-provisioned by Vercel
4. Tenant resolution happens at the application layer (not Vercel)

### Preview Deployments

- Every PR creates a preview deployment: `pr-{number}.lcos.preview.vercel.app`
- Preview env uses staging API (api-staging.lcos.io)
- Database: isolated Neon branch for each PR

### Environment Variables (Vercel)

```
NEXT_PUBLIC_API_URL=https://api.lcos.io/v1
NEXT_PUBLIC_APP_URL=https://app.lcos.io
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=...
```

---

## 3. Railway (Backend) Configuration

### Services

| Service | Type | Instances | Memory |
|---------|------|-----------|--------|
| api-web | HTTP (Express) | 2-4 (auto-scale) | 512MB |
| api-worker | Background jobs | 1-2 (auto-scale) | 512MB |
| webhook-processor | HTTP + queue | 1-2 | 256MB |
| cron-scheduler | Scheduled tasks | 1 | 256MB |

### railway.json

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "numReplicas": 2,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

### Health Check

```
GET /health -> { "status": "ok", "uptime": 123456, "version": "1.0.0" }
GET /health/ready -> { "database": "connected", "redis": "connected" }
```

Railway uses the `/health` endpoint for load balancer health checks.

### Auto-scaling

- CPU > 70% for 2 minutes -> add instance (max 4)
- CPU < 30% for 5 minutes -> remove instance (min 2)
- Memory > 80% for 2 minutes -> add instance

---

## 4. Neon (Database) Configuration

### Setup

```sql
-- Production database
CREATE DATABASE lcos_prod;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Connection pooling
-- Primary:       postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/lcos_prod
-- Pooled:        postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/lcos_prod?pooled=true
```

### Connection String Format

```
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/lcos_prod
DATABASE_URL_POOLED=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/lcos_prod?pooled=true&pgbouncer=true
```

### Connection Pool Configuration

```typescript
// database.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,  // Connection rotation
});

export const transactionalPool = new Pool({
  connectionString: process.env.DATABASE_URL_POOLED,
  max: 10,
});
```

### Branching (Preview Environments)

Neon's branching feature creates isolated database copies for preview deployments:

```
main (production)
  |
  +-- staging (always-on, mirrors main)
  |     |
  |     +-- pr-123-feature (auto-created, auto-deleted on merge)
  |     +-- pr-124-fix (auto-created, auto-deleted on merge)
  |
  +-- developer-abc (manual, long-lived)
```

### Backup Strategy

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Continuous | Real-time | 7 days | WAL archiving (built-in) |
| Daily snapshot | Daily | 30 days | pg_dump to S3 |
| Weekly snapshot | Weekly | 12 weeks | pg_dump to S3 |
| Monthly snapshot | Monthly | 12 months | pg_dump to S3 (cold storage) |

---

## 5. Environment Variables

### Backend (Railway)

```
# Node
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://...
DATABASE_URL_POOLED=postgresql://...

# Redis
REDIS_URL=redis://...
REDIS_PASSWORD=...

# JWT
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption
INTEGRATION_ENCRYPTION_KEY=...

# Auth
MFA_ISSUER=LCOS
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...
OAUTH_APPLE_CLIENT_ID=...
OAUTH_APPLE_TEAM_ID=...
OAUTH_APPLE_KEY_ID=...
OAUTH_APPLE_PRIVATE_KEY=...

# Payment
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Shipping
DHL_API_KEY=...
DHL_ACCOUNT_NUMBER=...

# Messaging
WHATSAPP_ACCESS_TOKEN=EAAx...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_PHONE_NUMBER_ID=...

# Email
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@lcos.io

# AI
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# File Storage
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=lcos-prod-media

# Monitoring
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
POSTHOG_API_KEY=...

# URLs
API_URL=https://api.lcos.io/v1
APP_URL=https://app.lcos.io
ADMIN_URL=https://admin.lcos.io

# Tenant config
DEFAULT_PLAN=starter
TRIAL_DAYS=14
```

---

## 6. Docker Configuration

### Dockerfile (Backend)

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Build
FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lcos
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER lcos
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "dist/main.js"]
```

### docker-compose.yml (Local Development)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: lcos_dev
      POSTGRES_USER: lcos
      POSTGRES_PASSWORD: lcos_dev_pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://lcos:lcos_dev_pass@postgres:5432/lcos_dev
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
```

---

## 7. Domain Setup & SSL

### Domain Architecture

```
app.lcos.io           -> Vercel (Frontend)
api.lcos.io           -> Railway (Backend)
admin.lcos.io         -> Vercel (Admin panel)
*.lcos.io             -> Vercel (Tenant subdomain wildcard)
cdn.lcos.io           -> Cloudflare R2 / S3 (Media CDN)
status.lcos.io        -> Statuspage (Status page)
```

### SSL/TLS

| Domain | Provider | Type |
|--------|----------|------|
| *.lcos.io | Vercel (automatic) | Let's Encrypt, auto-renew |
| api.lcos.io | Railway (automatic) | Let's Encrypt, auto-renew |
| *.lcos.io wildcard | Cloudflare | Edge certificate |
| Custom tenant domains | Vercel (automatic) | Let's Encrypt, auto-renew |

### DNS Records (Cloudflare)

```
A @ 188.114.97.7 (Cloudflare proxy)
AAAA @ 2a06:98c1:3120:: (Cloudflare proxy)

CNAME app  -> cname.vercel-dns.com (Cloudflare proxy)
CNAME api  -> railway-route.up.railway.app (DNS only, no proxy)
CNAME www  -> app.lcos.io (Cloudflare proxy)
CNAME cdn  -> cdn.lcos.io.s3.amazonaws.com

TXT _lcos-domain-verification -> lcos-verification-code
TXT _dmarc -> v=DMARC1; p=quarantine;
TXT _lcos-verify -> v=spf1 include:_spf.google.com ~all
```

### Rate Limiting (Cloudflare WAF)

```
- 2000 req/min per IP (API)
- 100 req/min per IP (Auth endpoints)
- 10 req/s per IP (Unauthenticated)
- Block: non-GET/HEAD requests from non-browser UAs that lack proper headers
```

---

## 8. Backup Strategy

### Database Backups

| Backup | Schedule | Retention | Method |
|--------|----------|-----------|--------|
| Point-in-time | Continuous | 7 days | Neon built-in WAL |
| Daily dump | Daily 02:00 UTC | 30 days | pg_dump -> S3 |
| Weekly dump | Sunday 02:00 UTC | 12 weeks | pg_dump -> S3 |
| Monthly dump | 1st 02:00 UTC | 12 months | pg_dump -> S3 Glacier |

### File Backups

| Storage | Schedule | Retention | Method |
|---------|----------|-----------|--------|
| Product media | Continuous | N/A | S3 cross-region replication |
| Exports | On-demand | 7 days | S3 lifecycle policy |
| Logs | Real-time | 30 days | CloudWatch -> S3 |

### Disaster Recovery

**Recovery Point Objective (RPO):** 5 minutes (via WAL streaming)
**Recovery Time Objective (RTO):** 1 hour

**Recovery Procedure:**

1. Provision new Neon database from latest backup
2. Point Railway service to new database URL
3. Verify data integrity
4. Flush CDN cache
5. Resume traffic

### Backup Verification

- Daily: Automated restore test on staging environment
- Weekly: Data integrity checks (checksum verification)
- Monthly: Full DR drill (complete restore + traffic switch)

---

## 9. CI/CD Pipeline

### GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test -- --coverage
      - run: npm run build

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - run: npx vercel --token ${{ secrets.VERCEL_TOKEN }} --prod

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npx vercel --token ${{ secrets.VERCEL_TOKEN }} --prod
```

---

## 10. Monitoring & Alerting

### Monitoring Stack

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking, performance monitoring |
| Grafana + Prometheus | Metrics dashboards, custom alerts |
| Uptime Kuma | Uptime monitoring |
| Better Stack | Incident management, status page |
| Logtail / Mezmo | Log aggregation and search |

### Critical Alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| API error rate | > 1% for 5 min | PagerDuty call |
| API p95 latency | > 2s for 5 min | Slack alert |
| Database CPU | > 80% for 10 min | Slack alert |
| Database connections | > 80% of max | Slack alert |
| Redis memory | > 80% for 5 min | Slack alert |
| Integration failure | > 3 consecutive | Slack alert |
| SSL certificate expiry | < 14 days | Email alert |

---

## 11. Security Checklist

- [ ] All traffic over HTTPS (HSTS enforced)
- [ ] Secrets stored in Railway/Vercel environment variables (NOT in code)
- [ ] Database accessible only via private network (not public internet)
- [ ] WAF enabled (Cloudflare) with rate limiting
- [ ] DDoS protection enabled
- [ ] Regular dependency scanning (Dependabot, Snyk)
- [ ] Automated CVE patching
- [ ] Access logs retained for 90 days
- [ ] Regular penetration testing (quarterly)
- [ ] SOC 2 compliance in progress
- [ ] GDPR data processing agreement in place
