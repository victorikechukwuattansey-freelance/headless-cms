# Multi-Tenant Strategy

**Platform:** Social Media OS
**Document:** 01-multi-tenant-strategy.md
**Status:** Final
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [Data Isolation Model](#1-data-isolation-model)
2. [Organization Hierarchy](#2-organization-hierarchy)
3. [Role-Based Access Control](#3-role-based-access-control)
4. [Workspace Architecture](#4-workspace-architecture)
5. [Team Management](#5-team-management)
6. [White-Label Strategy](#6-white-label-strategy)
7. [Usage Metering](#7-usage-metering)
8. [Rate Limiting Per Tenant](#8-rate-limiting-per-tenant)

---

## 1. Data Isolation Model

### Recommendation: Schema-per-Tenant with Shared Pool

We recommend a **hybrid model** that uses schema-per-tenant for the primary SaaS database, combined with a shared-pool operational data store for cross-tenant analytics and billing.

### Comparison

| Criteria | Shared DB + Row-Level Security | Schema-per-Tenant | Hybrid (Recommended) |
|---|---|---|---|
| **Isolation strength** | Weak — row filters can be bypassed | Strong — no cross-tenant data leakage | Strong — schema isolation for core data |
| **Migration complexity** | Low — single schema | High — per-tenant migrations | Moderate — tooling required |
| **Backup/restore** | All tenants at once | Per-tenant granularity | Per-tenant via schema-level backup |
| **Connection pooling** | Efficient — single pool | Complex — per-schema connection routing | Efficient with schema search_path |
| **Cross-tenant queries** | Direct (dangerous) | Requires federation | Limited via operational data store |
| **Operational cost** | Lowest | Higher (N schemas) | Moderate |
| **Compliance (GDPR/SOC2)** | Harder to audit | Clear tenant boundaries | Clear boundaries + shared billing |
| **Scaling** | Vertical first | Horizontally distributable | Vertical + horizontal via sharding |

### Architecture

```
PostgreSQL Cluster
├── public schema — reference data, rate limit counters, job queue
├── billing schema — invoices, subscriptions, meters (shared for reporting)
├── tenant_<id> schema — per-tenant tables:
│   ├── organizations
│   ├── workspaces
│   ├── users
│   ├── social_accounts
│   ├── posts
│   ├── campaigns
│   ├── analytics
│   ├── content_library
│   ├── workflows
│   └── settings
└── analytics schema — materialized views (cross-tenant, aggregation only)
```

### Connection Routing

```
Application
  → TenantResolver middleware (extracts tenant_id from JWT/subdomain)
    → Connection pooler (uses PG schemas search_path)
      → SET search_path TO tenant_<id>, public;
        → Query executed against tenant schema + public tables
```

### Migration Strategy

```sql
-- Run schema migrations per-tenant
CREATE SCHEMA IF NOT EXISTS tenant_123;
SET search_path TO tenant_123;

-- Migration scripts iterate through all active tenant schemas
-- New tenants are provisioned with the latest schema version
-- Zero-downtime: blue/green schema versioning with views
```

### Why Not Row-Level Security

1. **Performance degradation** at scale — RLS policies are re-evaluated per row access, causing query plan complexity and index scan degradation beyond 100 concurrent tenants
2. **Hard to reason about** — RLS policies interacting with JOINs, subqueries, and CTEs produce unexpected permission errors
3. **Difficult backup/restore** — cannot restore a single tenant without affecting all tenants in the shared table
4. **Compliance risk** — a bug in RLS policy leaks data across tenants; schema isolation makes accidental leakage structurally impossible
5. **Deletion complexity** — hard-deleting a tenant's data requires scanning every shared table for that tenant_id

### Data Store Per Service

| Service | Storage | Isolation Model |
|---|---|---|
| **Core API** (campaigns, posts, accounts) | PostgreSQL | Schema-per-tenant |
| **Analytics** | ClickHouse | Shared cluster, tenant_id shard key |
| **AI Engine** (prompts, generations) | PostgreSQL | Schema-per-tenant |
| **Content Media** | S3-compatible | Per-tenant prefix path |
| **Search Index** | Meilisearch | Per-tenant index |
| **Job Queue** | Redis | Namespace-per-tenant |
| **Cache** | Redis | Namespace-per-tenant |
| **Audit Log** | PostgreSQL + S3 | Shared table, tenant index; archived to S3 |

---

## 2. Organization Hierarchy

### Hierarchy Model

```
Platform (Root)
├── Organization 1 (Acme Corp)
│   ├── Workspace: Marketing
│   │   ├── Team: Social Team
│   │   │   └── Users: Alice, Bob
│   │   └── Team: Content Team
│   │       └── Users: Carol, Dave
│   ├── Workspace: Product
│   │   └── Team: Product Launch
│   │       └── Users: Eve, Frank
│   └── Workspace: Executive (cross-org visibility)
│       └── Users: CEO, CMO
├── Organization 2 (Beta Corp)
│   └── Workspace: Main
│       └── Users: Grace
└── Organization 3 (Charlie Inc - Enterprise)
    ├── Workspace: US Region
    ├── Workspace: EU Region
    └── Workspace: APAC Region
```

### Entity Definitions

| Entity | Description | Key Attributes |
|---|---|---|
| **Platform** | Root system owned by provider | Billing master, global feature flags, all tenants |
| **Organization** | A customer (company, agency, individual) | Billing account, subscription, tax info, domain |
| **Workspace** | Isolated silo for campaigns/content/users | Timezone, locale, social account pool, analytics scope |
| **Team** | Logical user group within a workspace | Lead, members, shared content queue, permissions |
| **User** | Individual login account | Email, SSO identity, profile, notification prefs |

### Organization Lifecycle

```
Signup → Trial Org (auto)
  ↓
Activate → Active Org (subscription active)
  ↓
Suspend → Suspended Org (payment failed, ToS violation)
  ↓
Close → Closed Org (scheduled deletion after 90 days)
  ↓
Delete → Purged (GDPR right to erasure, or 90-day retention expiry)
```

### Cross-Organization Relationships

- **Agency Mode**: An organization of type "agency" can manage multiple child organizations. Agency users see aggregated analytics across client organizations.
- **Enterprise Parent/Child**: Enterprise organizations can have sub-organizations (departments, regions, brands) with consolidated billing.
- **SSO Domain Trust**: Organizations can trust specified external domains for cross-org collaboration.

---

## 3. Role-Based Access Control

### Role Hierarchy

```
Platform Owner (super-admin)
  └── Organization Owner
        └── Organization Admin
              └── Workspace Admin
                    └── Workspace Editor
                          └── Workspace Viewer
                                └── Custom Roles (defined per org)
```

### Permission Categories (50+ Granular Permissions)

#### Workspace Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `workspace.view` | View workspace details | ✓ | ✓ | ✓ | ✓ |
| `workspace.edit` | Edit workspace settings | ✓ | ✓ | ✗ | ✗ |
| `workspace.delete` | Delete workspace | ✓ | ✓ | ✗ | ✗ |
| `workspace.members.manage` | Add/remove workspace members | ✓ | ✓ | ✗ | ✗ |
| `workspace.members.view` | View member list | ✓ | ✓ | ✓ | ✓ |
| `workspace.teams.create` | Create teams | ✓ | ✓ | ✗ | ✗ |
| `workspace.teams.manage` | Manage teams | ✓ | ✓ | ✗ | ✗ |
| `workspace.integrations` | Manage platform integrations | ✓ | ✓ | ✗ | ✗ |
| `workspace.export` | Export workspace data | ✓ | ✓ | ✓ | ✗ |
| `workspace.clone` | Clone workspace | ✓ | ✓ | ✓ | ✗ |

#### Content Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `post.create` | Create new posts | ✓ | ✓ | ✓ | ✗ |
| `post.edit` | Edit any post | ✓ | ✓ | ✓ | ✗ |
| `post.edit.own` | Edit own posts | ✓ | ✓ | ✓ | ✗ |
| `post.delete` | Delete any post | ✓ | ✓ | ✗ | ✗ |
| `post.delete.own` | Delete own posts | ✓ | ✓ | ✓ | ✗ |
| `post.publish` | Publish posts | ✓ | ✓ | ✓ | ✗ |
| `post.schedule` | Schedule posts | ✓ | ✓ | ✓ | ✗ |
| `post.view` | View posts | ✓ | ✓ | ✓ | ✓ |
| `post.approve` | Approve posts for publishing | ✓ | ✓ | ✓ | ✗ |
| `post.reject` | Reject posts | ✓ | ✓ | ✓ | ✗ |
| `post.review` | Submit posts for review | ✓ | ✓ | ✓ | ✓ |
| `post.bulk` | Bulk operations on posts | ✓ | ✓ | ✓ | ✗ |
| `post.version_history` | View/edit post version history | ✓ | ✓ | ✓ | ✗ |
| `post.template` | Create/edit post templates | ✓ | ✓ | ✓ | ✗ |

#### Social Account Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `social.connect` | Connect new social accounts | ✓ | ✓ | ✓ | ✗ |
| `social.disconnect` | Disconnect social accounts | ✓ | ✓ | ✗ | ✗ |
| `social.view` | View connected accounts | ✓ | ✓ | ✓ | ✓ |
| `social.reconnect` | Reconnect expired tokens | ✓ | ✓ | ✓ | ✗ |
| `social.analytics.view` | View account analytics | ✓ | ✓ | ✓ | ✓ |
| `social.analytics.export` | Export analytics data | ✓ | ✓ | ✓ | ✗ |

#### AI Engine Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `ai.generate` | Generate content via AI | ✓ | ✓ | ✓ | ✗ |
| `ai.repurpose` | Repurpose content across platforms | ✓ | ✓ | ✓ | ✗ |
| `ai.voice.edit` | Create/edit brand voice profiles | ✓ | ✓ | ✓ | ✗ |
| `ai.voice.view` | View brand voice profiles | ✓ | ✓ | ✓ | ✓ |
| `ai.model.select` | Select AI model for generation | ✓ | ✓ | ✓ | ✗ |
| `ai.custom_model` | Upload/use custom AI models | ✓ | ✓ | ✗ | ✗ |
| `ai.credits.view` | View AI credit usage | ✓ | ✓ | ✓ | ✓ |
| `ai.prompt.save` | Save custom prompt templates | ✓ | ✓ | ✓ | ✗ |
| `ai.batch` | Run batch AI operations | ✓ | ✓ | ✓ | ✗ |

#### Analytics Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `analytics.view` | View dashboards | ✓ | ✓ | ✓ | ✓ |
| `analytics.create` | Create custom dashboards | ✓ | ✓ | ✓ | ✗ |
| `analytics.edit` | Edit dashboards | ✓ | ✓ | ✓ | ✗ |
| `analytics.delete` | Delete dashboards | ✓ | ✓ | ✗ | ✗ |
| `analytics.custom_report` | Create custom reports | ✓ | ✓ | ✓ | ✗ |
| `analytics.export` | Export reports | ✓ | ✓ | ✓ | ✗ |
| `analytics.schedule` | Schedule report delivery | ✓ | ✓ | ✓ | ✗ |
| `analytics.competitor` | View competitor analysis | ✓ | ✓ | ✓ | ✗ |

#### Billing & Admin Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `billing.view` | View billing details | ✓ | ✓ | ✗ | ✗ |
| `billing.manage` | Manage subscription & payment | ✓ | ✓ | ✗ | ✗ |
| `billing.invoices` | View/download invoices | ✓ | ✓ | ✓ | ✗ |
| `billing.usage` | View usage stats | ✓ | ✓ | ✓ | ✗ |
| `admin.settings` | Modify org settings | ✓ | ✓ | ✗ | ✗ |
| `admin.sso` | Configure SSO | ✓ | ✗ | ✗ | ✗ |
| `admin.audit_log` | View audit logs | ✓ | ✓ | ✗ | ✗ |
| `admin.security` | Security policy settings | ✓ | ✓ | ✗ | ✗ |
| `admin.white_label` | White-label configuration | ✓ | ✗ | ✗ | ✗ |
| `admin.api_keys` | Manage API keys | ✓ | ✓ | ✓ | ✗ |

#### Collaboration Permissions

| Code | Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|---|
| `comment.create` | Comment on posts | ✓ | ✓ | ✓ | ✓ |
| `comment.edit` | Edit any comment | ✓ | ✓ | ✓ | ✗ |
| `comment.delete` | Delete comments | ✓ | ✓ | ✓ | ✗ |
| `approval.workflow` | Configure approval workflows | ✓ | ✓ | ✓ | ✗ |
| `collaboration.invite` | Invite external collaborators | ✓ | ✓ | ✓ | ✗ |

### Custom Roles

Organizations can define custom roles by selecting from the 50+ permission codes. Custom roles are scoped to the organization.

```json
{
  "name": "Social Media Manager",
  "description": "Manages daily posting and engagement",
  "permissions": [
    "post.create", "post.edit", "post.schedule", "post.publish",
    "post.view", "post.approve", "social.view",
    "ai.generate", "ai.repurpose", "analytics.view",
    "comment.create", "comment.edit"
  ]
}
```

### Permission Evaluation Flow

```
User Request
  → Resolve user → org → workspace context
    → Load role assignments (user role, team roles)
      → Merge permissions (highest precedence: direct > team > workspace default)
        → Evaluate permission against resource
          → Deny if:
              - No matching permission
              - Resource is in different workspace (no cross-workspace access)
              - Resource requires higher role level
          → Allow if:
              - Permission is granted at any level
              - User is workspace/org owner
```

---

## 4. Workspace Architecture

### Purpose

Workspaces are the primary isolation boundary for content, campaigns, and analytics within an organization. They function like "projects" in Buffer or "accounts" in Hootsuite, but with full data isolation.

### Workspace Attributes

```
Workspace
├── id: uuid
├── organization_id: uuid
├── name: string (e.g., "Marketing", "Product Launch", "US Region")
├── slug: string (unique within org, used in URLs)
├── description: text
├── timezone: string (IANA, e.g., "America/New_York")
├── locale: string (e.g., "en-US")
├── brand_color: string (hex)
├── logo_url: string
├── settings: jsonb (workspace-level feature flags, defaults)
├── created_at: timestamp
├── updated_at: timestamp
└── archived_at: timestamp (null if active)
```

### What Workspaces Isolate

| Resource | Isolation Level | Cross-Workspace Sharing |
|---|---|---|
| **Social Accounts** | Belong to one workspace | Can be shared read-only via Org-level accounts |
| **Posts & Drafts** | Workspace-scoped | Cloning/copying across workspaces with explicit permission |
| **Content Calendar** | Per-workspace | Read-only calendar view for cross-workspace subscribers |
| **Campaigns** | Workspace-scoped | None (isolated) |
| **Content Library** | Per-workspace | Orgs can create shared library items visible to all workspaces |
| **Analytics** | Aggregated per-workspace | Cross-workspace analytics reports at Organization level |
| **AI Brand Voices** | Per-workspace | Can be copied across workspaces |
| **Workflows** | Per-workspace | Can be exported/imported as templates |
| **Teams** | Workspace-scoped | Cross-workspace teams with explicit membership |
| **Settings** | Per-workspace (overrides org defaults) | Org settings cascade down |
| **Billing** | Not isolated — Org-level | N/A |
| **Users** | User accounts are Org-level | Role assignments per workspace |

### Workspace Types

| Type | Use Case | Features |
|---|---|---|
| **Standard** | General use | All features enabled |
| **Agency Client** | Agency managing client | Hide billing, limited settings, agency admin override |
| **Personal** | Individual creator | Simplified UI, no team management |
| **Enterprise Region** | Multi-region enterprise | Region-specific compliance, data residency |
| **Brand** | Multi-brand org | Separate brand identity, social accounts, content |

### Workspace Limits (per plan)

| Limit | Free | Starter | Pro | Agency | Enterprise |
|---|---|---|---|---|---|
| Max workspaces | 1 | 2 | 5 | 15 | Custom |
| Social accounts/workspace | 3 | 10 | 25 | 50 | Custom |
| Users/workspace | 1 | 3 | 10 | 25 | Custom |
| Posts/month/workspace | 10 | 100 | 500 | Unlimited | Unlimited |

### Default Workspace Creation

On signup, a default workspace is created automatically. Users can create additional workspaces based on their plan limits.

---

## 5. Team Management

### Team Model

Teams are logical groups of users within a workspace, designed for collaborative content workflows.

```
Workspace: Marketing
├── Team: Social Media (Lead: Alice)
│   ├── Alice (Team Lead, Editor role)
│   ├── Bob (Content Creator, Editor role)
│   └── Charlie (Reviewer, Viewer with approve permission)
├── Team: Content (Lead: Carol)
│   ├── Carol (Team Lead, Editor role)
│   └── Dave (Writer, Editor role)
└── Unassigned Users
    └── Eve (Viewer, no team)
```

### Team Attributes

| Attribute | Description |
|---|---|
| `id` | UUID |
| `workspace_id` | Parent workspace |
| `name` | Team name |
| `description` | Purpose of the team |
| `lead_user_id` | Team lead (has moderation permissions) |
| `color` | Display color for calendar |
| `notification_prefs` | Team-level notification defaults |
| `created_at` | Timestamp |

### User-to-Team Membership

```json
{
  "user_id": "uuid",
  "team_id": "uuid",
  "role": "editor",
  "joined_at": "timestamp",
  "is_lead": false
}
```

### Team Features

| Feature | Description |
|---|---|
| **Shared Queue** | Team members see a shared content queue with assignments |
| **Team Calendar** | Filter calendar by team, see who owns which posts |
| **Team Analytics** | Aggregate analytics for content produced by team members |
| **Mentions & Notifications** | @team-name mentions notify all members |
| **Team Templates** | Shared post templates for the team |
| **Approval Routing** | Posts auto-route to team lead for approval |
| **Workload Balancing** | Distribute posts evenly across team members |
| **Team Chat** | In-app messaging per team |

### Cross-Workspace Collaboration

Users can be invited to collaborate across workspaces via:

1. **Cross-Workspace Assignment** — User assigned a role in multiple workspaces within the same organization
2. **Guest Access** — External user (different org) granted limited access to a specific workspace
3. **Agency Mode** — Agency user manages multiple client workspaces through a unified dashboard
4. **Workspace Federation** — Users from trusted domains can access shared content libraries

### Team Management API

```
POST   /workspaces/:id/teams                — Create team
GET    /workspaces/:id/teams                — List teams
GET    /workspaces/:id/teams/:team_id       — Get team details
PATCH  /workspaces/:id/teams/:team_id       — Update team
DELETE /workspaces/:id/teams/:team_id       — Delete team
POST   /teams/:id/members                   — Add member
DELETE /teams/:id/members/:user_id          — Remove member
PATCH  /teams/:id/members/:user_id          — Change member role
GET    /teams/:id/members                   — List members
```

---

## 6. White-Label Strategy

### White-Label Tiers

| Tier | Features | Available On |
|---|---|---|
| **Basic White-Label** | Custom logo, brand color, favicon | Pro, Agency, Enterprise |
| **Premium White-Label** | Custom domain, branded login page, remove "Powered by" | Agency, Enterprise |
| **Enterprise White-Label** | Custom email sender, custom SMTP, SLA-backed branding | Enterprise only |

### Custom Domain Setup

```
Customer Domain (e.g., social.acmecorp.com)
  → CNAME → app.socialmediaos.com
    → Cloudflare/ALB termination
      → Tenant resolver via Host header
        → Serve white-labeled React app
          → API requests proxied through custom domain
```

### Implementation

| Feature | Implementation |
|---|---|
| **Custom Logo** | S3 URL stored in org settings, served in nav bar, login page, emails |
| **Brand Colors** | CSS custom properties injected at app bootstrap, stored in org settings |
| **Custom Domain** | CNAME verification + SSL cert provisioning (Let's Encrypt via cert-manager) |
| **Branded Login** | Custom login URL with org lookup by domain SSO branding |
| **Remove "Powered by"** | Feature flag that hides footer branding |
| **Custom Email** | Customer's SMTP server or SendGrid sub-account, verified DKIM/SPF |
| **Favicon** | Upload in settings, served from custom path |

### White-Label Configuration Model

```json
{
  "organization_id": "uuid",
  "logo_url": "https://cdn.socialmediaos.com/orgs/uuid/logo.png",
  "favicon_url": "https://cdn.socialmediaos.com/orgs/uuid/favicon.ico",
  "brand_color_primary": "#4F46E5",
  "brand_color_secondary": "#6366F1",
  "brand_color_accent": "#10B981",
  "custom_domain": "social.acmecorp.com",
  "custom_domain_verified": true,
  "ssl_provisioned": true,
  "login_page_bg": "https://cdn.socialmediaos.com/orgs/uuid/login-bg.jpg",
  "remove_branding": true,
  "email_from_name": "Acme Corp Social",
  "email_from_address": "social@acmecorp.com",
  "custom_smtp_host": "smtp.acmecorp.com",
  "custom_smtp_port": 587,
  "custom_smtp_username": "...",
  "custom_smtp_password_encrypted": "...",
  "terms_url": "https://acmecorp.com/terms",
  "privacy_url": "https://acmecorp.com/privacy",
  "support_email": "support@acmecorp.com"
}
```

### Domain Verification Flow

1. Customer enters custom domain in settings
2. System generates CNAME verification record (e.g., `_smos-verify.social.acmecorp.com → _smos-verify.socialmediaos.com`)
3. Customer adds CNAME to DNS
4. System verifies DNS record (polling every 60s, up to 24h)
5. On verification: provision SSL cert via Let's Encrypt
6. Configure ALB/ingress to route `social.acmecorp.com` to tenant
7. Customer configures their own DNS CNAME: `social.acmecorp.com → app.socialmediaos.com`
8. System validates full CNAME chain
9. White-label activated: serve branded app on custom domain

---

## 7. Usage Metering

### Metered Metrics Per Tenant

| Metric | Unit | Granularity | Tracking Method |
|---|---|---|---|
| **Posts Published** | per post | daily → monthly | Increment counter on publish |
| **AI Credits Consumed** | per token/request | per request | Deduct from balance on generation |
| **AI Image Generations** | per image | per request | Deduct from balance on generation |
| **Storage Used** | MB | real-time | Calculate on upload/delete |
| **Team Members** | active users | daily snapshot | Count active users at end of day |
| **Workspaces Created** | count | real-time | Count active workspaces |
| **Social Accounts** | count | real-time | Count connected accounts |
| **API Calls** | per request | minutely → monthly | Rate limiter counter |
| **MCP Server Calls** | per request | per request | Deduct from allowance |
| **Analytics Exports** | per export | per request | Increment counter |
| **Custom Reports** | per report | per creation | Increment counter |
| **Video Encoding Minutes** | per minute | per video | Track encoding duration |
| **Bandwidth (CDN)** | GB | daily | Sum CDN transfer |

### Usage Tracking Architecture

```
User Action
  → API
    → Metering middleware (async, non-blocking)
      → Write to Redis counter (tenant:<id>:usage:<metric>:<date>)
        → Batch flush to PostgreSQL (every 5 min, or on threshold)
          → Ingest into ClickHouse (for real-time dashboards)
            → Compute billing cycles via cron job
```

### Data Model

```sql
CREATE TABLE usage_meters (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  meter_type VARCHAR(64) NOT NULL,  -- 'posts_published', 'ai_credits', 'storage_mb', etc.
  usage_amount BIGINT NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_meters_org_period ON usage_meters(organization_id, billing_period_start, meter_type);
```

### Metering API

```
GET /api/v1/usage — Current period usage summary
GET /api/v1/usage/meters — List all meter types and current values
GET /api/v1/usage/history?meter=posts_published&from=2026-01-01&to=2026-07-22 — Usage history
GET /api/v1/usage/forecast — Projected end-of-period usage
```

### Overages

| Plan | Soft Cap | Hard Cap | Overage Cost |
|---|---|---|---|
| Free | 10 posts | 10 posts | Must upgrade |
| Starter | 100 posts | 200 posts (auto-block) | $0.10/additional post |
| Pro | 500 posts | 1000 posts | $0.05/additional post |
| Agency | Unlimited | N/A | N/A |
| Enterprise | Custom | Custom | Custom |

- **Soft cap**: Organization receives warning notifications at 80%, 90%, 100% of included usage
- **Hard cap**: API blocks further actions until plan is upgraded or overage is paid
- **Overage billing**: Charged at end of billing period via invoice

---

## 8. Rate Limiting Per Tenant

### Rate Limiting Strategy: Sliding Window + Token Bucket

Combined approach:
- **Sliding window** for API endpoint rate limits per tenant
- **Token bucket** for burst allowances
- **Concurrent request limiter** for long-running operations (AI generation, analytics exports)

### Rate Limit Tiers

| Tier | API Requests | AI Generations | Concurrent Jobs | Burst Multiplier |
|---|---|---|---|---|
| Free | 100 req/min | 5/min | 1 | 2x |
| Starter | 500 req/min | 20/min | 3 | 3x |
| Pro | 2000 req/min | 60/min | 5 | 5x |
| Agency | 10000 req/min | 200/min | 10 | 10x |
| Enterprise | Custom | Custom | Custom | Custom |
| Internal Service | Unlimited | Unlimited | Unlimited | N/A |

### Rate Limit Headers

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 423
X-RateLimit-Reset: 1626960000
X-RateLimit-Burst-Remaining: 1500
Retry-After: 45
```

### Implementation

```typescript
interface RateLimitConfig {
  tier: 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';
  windowMs: number;       // Sliding window in ms
  maxRequests: number;    // Max requests in window
  burstCapacity: number;  // Token bucket size
  burstRefillRate: number;// Tokens per second
  concurrency: number;    // Max concurrent requests
}

class RateLimiter {
  private redis: Redis;
  private slidingWindow: SlidingWindowRateLimiter;
  private tokenBucket: TokenBucket;
  private concurrencyLimiter: ConcurrencyLimiter;

  async check(tenantId: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const [windowResult, burstResult, concurrencyResult] = await Promise.all([
      this.slidingWindow.check(`rl:${tenantId}:api`, config.windowMs, config.maxRequests),
      this.tokenBucket.check(`rl:${tenantId}:burst`, config.burstCapacity, config.burstRefillRate),
      this.concurrencyLimiter.check(`rl:${tenantId}:concurrency`, config.concurrency),
    ]);

    return {
      allowed: windowResult.allowed && burstResult.allowed && concurrencyResult.allowed,
      remaining: Math.min(windowResult.remaining, burstResult.remaining),
      resetAt: windowResult.resetAt,
      retryAfter: this.calculateRetryAfter(windowResult, burstResult, concurrencyResult),
    };
  }
}
```

### Rate Limit by Endpoint Category

| Endpoint Category | Free | Starter | Pro | Agency |
|---|---|---|---|---|
| `POST /api/v1/posts` | 10/min | 30/min | 100/min | 500/min |
| `GET /api/v1/posts` | 30/min | 100/min | 300/min | 1000/min |
| `POST /api/v1/ai/generate` | 5/min | 20/min | 60/min | 200/min |
| `GET /api/v1/analytics` | 10/min | 30/min | 100/min | 300/min |
| `POST /api/v1/analytics/export` | 1/min | 3/min | 10/min | 30/min |
| `GET /api/v1/analytics/reports` | 5/min | 15/min | 50/min | 150/min |
| `POST /api/v1/social/connect` | 1/min | 3/min | 5/min | 10/min |
| `GET /api/v1/platforms` | 60/min | 120/min | 300/min | 1000/min |
| `POST /api/v1/ai/repurpose` | 2/min | 10/min | 30/min | 100/min |
| `POST /api/v1/workflows/run` | 1/min | 5/min | 20/min | 100/min |

### Throttling Response

```json
HTTP 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "API rate limit exceeded. Retry after 45 seconds.",
  "retry_after_seconds": 45,
  "limit": 500,
  "remaining": 0,
  "reset_at": "2026-07-22T14:30:00Z"
}
```

### Fair Use Enforcement

- Rate limits reset at the end of the sliding window (not on the hour)
- Burst allowances accumulate up to the burst capacity (idle periods build burst credits)
- Tenants consistently hitting rate limits are flagged for plan review
- Automatic rate limit increase on plan upgrade (instant, no restart needed)
- Admin dashboard shows real-time rate limit saturation per tenant
- Critical API endpoints (publish, auth) have separate, more generous rate limits
- Webhook deliveries are not subject to API rate limits (separate internal queue rate limits apply)

### Redis Key Design

```
rate_limit:{tenant_id}:{category}:window:{timestamp}
rate_limit:{tenant_id}:{category}:burst:tokens
rate_limit:{tenant_id}:{category}:concurrency:count
rate_limit:{tenant_id}:global:window:{timestamp}
```

### Rate Limit Violation Handling

1. First offense in 24h → Warning header only
2. Second offense → Warning header + 30s throttle
3. Third+ offense → 429 response, logged to audit trail
4. Persistent violator → Auto-trigger support ticket
5. Abuse → Manual tenant rate limit override or suspension

---

## Appendix A: Audit Logging

All permission-sensitive operations are logged to the audit trail:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(64) NOT NULL,      -- 'post.publish', 'workspace.delete', 'role.change'
  resource_type VARCHAR(64) NOT NULL,-- 'post', 'workspace', 'user', 'role'
  resource_id UUID,
  details JSONB,                     -- Before/after state, IP, user agent
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month, archive to S3 after 12 months
```

## Appendix B: Data Deletion & Privacy

- **Soft Delete**: Mark tenant as `deleted_at`, disable access, retain 90 days for recovery
- **Hard Delete**: After 90 days, cascade-delete all tenant schemas, S3 paths, and Redis keys
- **GDPR Export**: API endpoint returns all personal data as JSON within 7 days
- **Right to Erasure**: Immediate hard delete on verified GDPR request (paid customers: 30-day grace for data recovery)
- **Audit Log Retention**: Audit logs are retained for 7 years (anonymized after 90 days)

## Appendix C: Tenant Provisioning Flow

```
Signup Request
  → Create organization record (billing schema)
    → Create tenant schema (tenant_<id>)
      → Run schema migrations on new tenant
        → Create default workspace
          → Create owner user with Owner role
            → Create default content library folders
              → Set up initial feature flags
                → Send welcome email
                  → Redirect to onboarding wizard
```
