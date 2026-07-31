# Developer Playbook

**Platform:** Social Media OS
**Document:** 04-developer-playbook.md
**Status:** Final
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [Development Setup](#1-development-setup)
2. [Code Standards](#2-code-standards)
3. [Git Workflow](#3-git-workflow)
4. [Adding a New Social Platform](#4-adding-a-new-social-platform)
5. [Adding a New AI Model](#5-adding-a-new-ai-model)
6. [Database Migration Guide](#6-database-migration-guide)
7. [Debugging Guide](#7-debugging-guide)
8. [Performance Checklist](#8-performance-checklist)

---

## 1. Development Setup

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | >=20 LTS | Runtime |
| pnpm | >=9 | Package manager |
| Docker Desktop | >=4.30 | Local services |
| PostgreSQL | 16 (Docker) | Primary database |
| Redis | 7 (Docker) | Cache, queues, rate limiting |
| ClickHouse | 24 (Docker) | Analytics database |
| Meilisearch | 1.8 (Docker) | Search engine |
| MinIO | Latest (Docker) | S3-compatible storage |
| Stripe CLI | Latest | Webhook forwarding |
| OpenAPI Generator | 7.x | SDK generation |
| Terraform | 1.8+ | Infrastructure as code |

### Local Environment Setup

`ash
git clone git@github.com:socialmediaos/platform.git
cd platform
pnpm install
docker compose up -d
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
`

### Docker Compose Services

`yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports: ['5432:5432']
    environment:
      POSTGRES_DB: socialmediaos_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev_password
    volumes: ['pgdata:/var/lib/postgresql/data']
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
  clickhouse:
    image: clickhouse/clickhouse-server:24-alpine
    ports: ['8123:8123', '9000:9000']
  meilisearch:
    image: getmeili/meilisearch:v1.8
    ports: ['7700:7700']
    environment:
      MEILI_MASTER_KEY: dev_master_key
  minio:
    image: minio/minio:latest
    ports: ['9000:9000', '9001:9001']
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
  stripe-cli:
    image: stripe/stripe-cli
    command: listen --api-key sk_test_xxx --forward-to host.docker.internal:3000/api/webhooks/stripe
    environment:
      STRIPE_API_KEY: sk_test_xxx
`

### Environment Variables

`ash
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
APP_URL=http://localhost:5173

DATABASE_URL=postgresql://dev:dev_password@localhost:5432/socialmediaos_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20

REDIS_URL=redis://localhost:6379
REDIS_PREFIX=smos_dev

CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_KEY=dev_master_key

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=socialmediaos-dev

JWT_SECRET=dev-jwt-secret-do-not-use-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
STABILITY_AI_KEY=...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
LEMONSQUEEZY_API_KEY=...

RATE_LIMIT_ENABLED=true
RATE_LIMIT_MODE=local

FF_AI_STUDIO=true
FF_WHITE_LABEL=false
FF_SSO=false
FF_MCP_MARKETPLACE=false

SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
LOG_LEVEL=debug
`

### Database Commands

`ash
pnpm db:setup
pnpm db:migrate
pnpm db:rollback
pnpm db:create-migration --name add_content_library
pnpm db:status
pnpm db:seed
pnpm db:reset
pnpm db:seed --tenant=all
pnpm db:seed:orgs
pnpm db:seed:users
pnpm db:seed:posts
pnpm db:seed:analytics
`

### Seed Data

Seed data creates: 3 organizations, 5 workspaces, 10 users with varying roles, 6 connected social platforms per org, 50 sample posts, 2 brand voice profiles, 5 content library items, 90 days of analytics data, and sample subscription records.

---

## 2. Code Standards

### Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Packages | @smos/<scope>-<name> | @smos/api-core |
| Directories | kebab-case | content-studio/ |
| TypeScript files | kebab-case | post-composer.tsx |
| React components | PascalCase | PostComposer.tsx |
| Hooks | use + camelCase | useAuth(), useWorkspace() |
| Functions | camelCase | createPost(), schedulePublish() |
| Classes | PascalCase | TenantResolver |
| Interfaces | PascalCase | Post, ICampaign |
| Types | PascalCase, T prefix | PublishStatus |
| Enums | PascalCase, members UPPER | PostStatus.PUBLISHED |
| Constants | UPPER_SNAKE_CASE | MAX_POST_LENGTH |
| DB tables | snake_case, plural | social_accounts |
| DB columns | snake_case | published_at |
| API endpoints | kebab-case, plural | /api/v1/social-accounts |
| JSON fields | camelCase | socialAccountId |

### File Structure

`
src/
  apps/
    api/
      routes/          # Route definitions
      controllers/     # Request handlers
      middleware/      # Express middleware
      validators/      # Zod validation
      transformers/    # Response transformers
    web/
      pages/           # Page-level components
      features/
        posts/
          components/  # Components
          hooks/       # Hooks
          api/         # API client
          types/       # Types
      shared/
        ui/            # Design system
        lib/           # Utilities
        hooks/         # Shared hooks
    workers/
      queues/          # Queue definitions
      jobs/            # Job handlers
  packages/
    core/
      entities/
      services/
      repositories/
    db/                # Migrations, seeds
    ai/
      providers/
      templates/
      pipeline/
    social/
      platforms/
      oauth/
      rate-limit/
    billing/
    infra/
      config/
      logger/
      metrics/
      cache/
`

### Import Ordering

`	ypescript
// 1. Node built-ins
import { randomUUID } from 'node:crypto';
// 2. Third-party (alphabetical)
import { z } from 'zod';
// 3. Internal packages
import { TenantResolver } from '@smos/core/tenant';
// 4. Relative imports
import { authenticate } from '../../middleware/auth';
// 5. Styles
import styles from './post-composer.module.css';
`

### TypeScript Strictness

`json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true,
  "noPropertyAccessFromIndexSignature": true,
  "noFallthroughCasesInSwitch": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "forceConsistentCasingInFileNames": true,
  "skipLibCheck": true
}
`

### ESLint + Prettier

`json
{
  "extends": ["@smos/eslint-config/base", "@smos/eslint-config/react"],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": \"^_\" }],
    "import/order": ["error", { "groups": ["builtin", "external", "internal", "parent", "sibling"], "newlines-between": "always" }],
    "react/jsx-no-leaked-render": "error",
    "react/self-closing-comp": "error"
  }
}
`

`json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "bracketSpacing": true,
  "arrowParens": "always"
}
`

### Linting Commands

`ash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm type-check
pnpm lint:staged
`

---

## 3. Git Workflow

### Branching Strategy: Trunk-Based Development

`
main ----+-----------+-------------+--------->
          \         / \           /
feature/  +--+----+   +--+----+
fix/          +--+----+
chore/            +--+
release/           +---------+ (tag: v1.2.0)
`

| Branch | Purpose | Source | Merge to |
|---|---|---|---|
| main | Production-ready | -- | -- |
| feature/<name> | New features | main | main (squash) |
| fix/<name> | Bug fixes | main | main |
| chore/<name> | Dependencies, tooling | main | main |
| release/v* | Release prep | main | main (after tag) |
| hotfix/<name> | Production emergency | main tag | main |

### Commit Conventions: Conventional Commits

Format: <type>(<scope>): <description>

| Type | Usage |
|---|---|
| feat | New feature |
| fix | Bug fix |
| chore | Maintenance |
| docs | Documentation |
| style | Formatting |
| refactor | Code restructuring |
| perf | Performance |
| test | Tests |
| build | Build system |
| ci | CI/CD |

Examples:
`
feat(posts): add recurring post scheduling
fix(oauth): handle token refresh race condition
chore(deps): update drizzle-orm to 0.38.0
docs(api): add webhook event reference
perf(calendar): virtualize post list
`

### PR Template

`markdown
## Description
Brief description of the change.

## Type
[ ] feat — New feature
[ ] fix — Bug fix
[ ] chore — Maintenance
[ ] docs — Documentation

## Related Issues
Closes #123

## Checklist
- [ ] Code follows project style guide
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Database migration included (if needed)
- [ ] No breaking changes to public API
- [ ] Error handling covers edge cases
- [ ] Logging added for key operations
`

### Code Review Checklist

- **Functionality**: Does the code do what it says? Are edge cases handled?
- **Security**: Are inputs validated? Is tenant isolation maintained?
- **Performance**: Are N+1 queries avoided? Is caching used?
- **Error Handling**: Are all error paths handled?
- **Observability**: Are key operations logged? Metrics recorded?
- **Testing**: Are there tests for success and failure cases?
- **API Design**: Does it follow REST conventions? Consistent response shapes?
- **Database**: Are migrations reversible? Indexes added?

## 6. Database Migration Guide

### Creating Migrations

`ash
pnpm db:create-migration --name add_content_library
`

Creates: db/migrations/YYYYMMDDHHMMSS_add_content_library.ts

\\\	ypescript
import { sql } from 'drizzle-orm';

export const up = async (tx: DrizzleTransaction) => {
  await tx.execute(sql\ 
    CREATE TABLE content_library_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      workspace_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL,
      url TEXT NOT NULL,
      mime_type VARCHAR(127),
      file_size BIGINT,
      metadata JSONB DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  \);
  
  await tx.execute(sql\CREATE INDEX idx_library_tenant ON content_library_items(tenant_id)\);
  await tx.execute(sql\ALTER TABLE content_library_items ENABLE ROW LEVEL SECURITY\);
  await tx.execute(sql\
    CREATE POLICY tenant_isolation ON content_library_items
      USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  \);
};

export const down = async (tx: DrizzleTransaction) => {
  await tx.execute(sql\DROP TABLE IF EXISTS content_library_items CASCADE\);
};
\\\

### Data Backfills

\\\	ypescript
export const up = async (tx: DrizzleTransaction) => {
  const items = await tx.execute(sql\
    SELECT id, name, metadata->>'description' as description
    FROM content_library_items WHERE tags = '{}' OR tags IS NULL
  \);

  for (const item of items.rows) {
    const tags = await aiService.generateTags(item.name, item.description);
    await tx.execute(sql\
      UPDATE content_library_items SET tags = \
      WHERE id = \
    \);
  }
};
\\\

### Rollback Procedures

`ash
pnpm db:rollback
pnpm db:rollback --to 20260722000000
pnpm db:rollback --dry-run
`

### Zero-Downtime Migration Patterns

| Migration Type | Strategy | Downtime? |
|---|---|---|
| Add nullable column | ALTER TABLE ADD COLUMN | None |
| Add non-null column | Add nullable, backfill, set NOT NULL | None |
| Add index | CREATE INDEX CONCURRENTLY | None |
| Remove column | Stop using in app, drop later | None (phased) |
| Rename column | Add new, dual-write, backfill, drop old | None (phased) |

Example: zero-downtime column rename:

`
Phase 1: ALTER TABLE posts ADD COLUMN published_at TIMESTAMPTZ;
Phase 2: Dual-write (app writes to both columns)
Phase 3: UPDATE posts SET published_at = publish_date WHERE published_at IS NULL;
Phase 4: App reads from new column only
Phase 5: ALTER TABLE posts DROP COLUMN publish_date;
`

### Migration Best Practices

- Always write reversible migrations (up + down)
- Test against a copy of production data
- Run during low-traffic windows
- Use CREATE INDEX CONCURRENTLY for large tables
- Never use LOCK TABLE in migrations
- Keep individual migrations small and focused

---

## 7. Debugging Guide

### Common Issues

| Issue | Symptoms | Root Cause | Fix |
|---|---|---|---|
| OAuth token expired | Publish fails with 401 | Token not refreshed | Check refresh middleware |
| Rate limited | 429 from platform | Too many rapid requests | Backoff, burst allowance |
| Tenant leak | Cross-tenant data | Missing search_path | Verify TenantResolver |
| Migration failed | App won't start | Conflicting order | Rollback to last good state |
| AI timeout | 504 on AI endpoints | Provider slow | Timeout + fallback model |
| Webhook missing | No engagement updates | Signature mismatch | Verify webhook secret |
| OOM | Slow responses, crash | Unbounded cache | Cache TTL + max size |
| Stale analytics | Dashboard outdated | ClickHouse sync delay | Check analytics cron |

### Logging Patterns

\\\	ypescript
// Always log tenant context
logger.info({ tenantId, workspaceId, userId }, 'Creating post');

// Structured data, not concatenated strings
logger.debug({ postId, platform, publishAt }, 'Post scheduled');

// Errors with full context
logger.error({ err, postId, platform, attempt: retryCount }, 'Failed to publish');

// Performance tracking
const start = performance.now();
// ...operation...
logger.info({ duration: performance.now() - start }, 'Operation completed');

// Rate limit warnings
logger.warn({ tenantId, platform, remaining }, 'Rate limit approaching');

// Audit trail
logger.audit({
  action: 'post.publish',
  actor: userId,
  resource: { type: 'post', id: postId },
  changes: { status: 'draft -> published' },
  ip: req.ip,
});
\\\

### Local Debugging

`ash
pnpm dev:debug                          # Debug API with inspect
redis-cli KEYS "smos_dev:*"            # View Redis keys
pnpm worker:watch                       # Watch queue
stripe listen --forward-to localhost:3000/api/webhooks/stripe
kubectl logs -l app=api --tail=100 | jq 'select(.level == "error")'
redis-cli LLEN bull:smos:publish:waiting  # Check queue depth
`

### Health Check Endpoints

`
GET /health              Basic health check
GET /health/ready        Readiness (DB, Redis, queue)
GET /health/live         Liveness (process running)
GET /health/dependencies All external dependencies
GET /metrics             Prometheus metrics
`

---

## 8. Performance Checklist

### Pre-Launch Performance Review

#### Database
- [ ] All queries use proper indexes (verify with EXPLAIN ANALYZE)
- [ ] No N+1 queries in API response paths
- [ ] Cursor-based pagination on all list endpoints
- [ ] Connection pool tuned for expected load
- [ ] Slow query logging enabled (>100ms threshold)
- [ ] Read replicas for analytics workloads
- [ ] ClickHouse partitioning validated

#### API
- [ ] Brotli compression enabled
- [ ] HTTP/2 for multiplexing
- [ ] Caching headers (Cache-Control, ETag)
- [ ] Rate limiting at gateway + service level
- [ ] Request body size limits configured
- [ ] Timeouts for all external API calls
- [ ] Payload sizes minimized (field selection)

#### Frontend
- [ ] Bundle size: JS <300KB gzipped, CSS <50KB gzipped
- [ ] Route-level code splitting (React.lazy + Suspense)
- [ ] Image lazy loading
- [ ] Virtual scrolling for large lists (calendar, analytics)
- [ ] Debounced search (>300ms)
- [ ] API response caching (SWR / React Query)
- [ ] Optimistic UI updates
- [ ] Web Workers for heavy computation

#### Cache
- [ ] Redis cache for frequently accessed data
- [ ] TTLs per data type (posts: 30s, settings: 5min, analytics: 1min)
- [ ] Cache invalidation on mutation
- [ ] CDN caching for static assets (hash-based filenames)
- [ ] Service worker for offline support

#### Background Jobs
- [ ] Max concurrency per worker type configured
- [ ] Job timeouts set
- [ ] Dead letter queue configured
- [ ] Retry with exponential backoff (max 3, capped 24h)
- [ ] Rate limiting for external API calls from jobs
- [ ] Job metrics: enqueued, processing, completed, failed, latency

#### Infrastructure
- [ ] Auto-scaling: CPU >70%, memory >80%, queue depth triggers
- [ ] Load balancer health checks on /health/ready
- [ ] Graceful shutdown on deploy (connection draining)
- [ ] Cross-region failover plan documented
- [ ] Backup restore tested within SLA
- [ ] DDoS protection (rate limiting, WAF)

#### Testing
- [ ] Load test passes at 5x expected peak traffic
- [ ] Endurance test: 4h sustained traffic
- [ ] Spike test: 10x traffic for 5 minutes
- [ ] Stress test: identifies breaking point
- [ ] P99 latency <500ms for critical endpoints under load
- [ ] Error rate <0.1% under load
- [ ] Rate limiting behavior verified
- [ ] Tenant isolation tested under load
- [ ] Memory stable over 24h (no leaks)

#### Monitoring
- [ ] Dashboards: API latency, error rates, queue depths, cache hit ratio
- [ ] Alerts: P99 >1s, error rate >1%, queue backlog >10K
- [ ] Log sampling: 100% errors, 10% info, 1% debug
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Business metrics: posts published, active users, AI credits
- [ ] Cost monitoring per service
- [ ] Synthetic monitoring for critical user journeys
- [ ] RUM with Core Web Vitals
- [ ] Anomaly detection
- [ ] On-call runbook for common failure scenarios
