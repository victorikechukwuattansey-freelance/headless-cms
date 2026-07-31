# Admin Dashboard Specification

**Platform:** Social Media OS
**Document:** 05-admin-dashboard.md
**Status:** Final
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Management](#2-user-management)
3. [Organization Management](#3-organization-management)
4. [Platform Analytics](#4-platform-analytics)
5. [AI Model Management](#5-ai-model-management)
6. [Billing Admin](#6-billing-admin)
7. [Feature Flags](#7-feature-flags)
8. [System Logs](#8-system-logs)
9. [MCP Server Admin](#9-mcp-server-admin)
10. [Background Job Monitoring](#10-background-job-monitoring)

---

## 1. System Overview

### Purpose

The System Overview dashboard provides at-a-glance health and performance metrics for the entire platform. It is the default landing page for admin users and enables rapid identification of system issues.

### Layout

`
+--------------------------------------------------------------------+
|  System Overview                                                    |
+----------+----------+----------+----------+------------------------+
| Health   | API      | Active   | Queue    | Cost (MTD)             |
| Status   | Latency  | Users    | Depth    |                        |
| 99.8%    | P50: 45ms| 12,847   | Publish: | ,583                |
| uptime   | P95: 210ms| (+3.2%) | 342      | (+8.1% vs last month) |
|          | P99: 890ms|          | AI: 1,204|                        |
+----------+----------+----------+----------+------------------------+
| Service Status                                                      |
| PostgreSQL  Redis  ClickHouse  Meilisearch                          |
| OpenAI API  Stripe  Anthropic  S3 Storage                          |
| Degraded: None                            Offline: None             |
+--------------------------------------------------------------------+
| Recent Errors                                 [View All >]          |
| 10:23:45  [ERR] Post publish failed: Instagram rate limit           |
| 10:22:12  [ERR] AI generation timeout: provider anthropic           |
| 10:18:30  [WARN] Queue backlog: publish queue > 500 items          |
| 10:15:01  [ERR] Webhook delivery failed: stripe invoice            |
+--------------------------------------------------------------------+
| Active Users (24h)         | System Resources                      |
| [Line chart: active users] | CPU: 82%  Mem: 64%  Disk: 41%        |
| over 24h                   | Connections: 847/2000                    |
+--------------------------------------------------------------------+
`

### Metrics Displayed

| Metric | Source | Refresh | Alert Threshold |
|---|---|---|---|
| Uptime (30d) | StatusCake/Pingdom | 1 min | <99.5% |
| API Latency (P50/P95/P99) | OpenTelemetry | 10s | P99 >1s |
| Active Users (24h) | ClickHouse | 1 min | - |
| Error Rate (5min) | Sentry/OTel | 1 min | >1% |
| Queue Depth | Redis/Bull | 5s | >1,000 items |
| MTD Cost | Billing DB | 1h | - |
| Signups (24h) | User DB | 15 min | - |
| Posts Published (24h) | ClickHouse | 5 min | - |
| AI Credits Consumed (24h) | ClickHouse | 5 min | - |
| Service Status | Health checks | 30s | Any degraded |

### API Endpoints

`
GET /api/v1/admin/dashboard/overview         All overview metrics
GET /api/v1/admin/dashboard/active-users     Active user time series
GET /api/v1/admin/dashboard/error-rates      Error rate time series
GET /api/v1/admin/dashboard/service-status   All dependency statuses
GET /api/v1/admin/dashboard/recent-errors    Recent error log (last 50)
`

### Component Specification

SystemOverview
- HealthCard (uptime, current status, incident count)
- LatencyCard (P50/P95/P99 sparkline, comparison to yesterday)
- UsersCard (active count, trend arrow, 24h sparkline)
- QueueCard (per-queue depth, trend, max depth indicator)
- CostCard (MTD cost, trend, projected EOM cost)
- ServiceStatusGrid (all services: healthy/degraded/down, latency)
- RecentErrorFeed (scrolling list, severity color, timestamp, message)
- ResourceUsageBar (CPU, memory, disk, network, connections)

---

## 2. User Management

### Purpose

Search, view, impersonate, disable, and manage feature flags for individual users across all organizations.

### Layout

`
+----------------------------------------------------------------+
|  User Management                                               |
+----------------------------------------------------------------+
| [Search users...]  [Status: All v]  [Org: All v]  [Export]     |
+------+----------+-----------+--------+--------+------+---------+
| User | Email    | Org       | Role   | Status | Last | Actions |
+------+----------+-----------+--------+--------+------+---------+
| John | j@acme   | Acme Corp | Admin  | Active | 2m   | [imp]   |
| Jane | j@beta   | Beta Inc  | Editor | Active | 15m  | [imp]   |
| Bob  | b@acme   | Acme Corp | Viewer | Disab. | 3d   | [imp]   |
+------+----------+-----------+--------+--------+------+---------+
| Showing 1-25 of 12,847 users                       [1] [2] [3]|
+----------------------------------------------------------------+
`

### User Detail Panel (slide-over)

User Details panel contains:
- Identity: Name, Email, Phone, Org, Role, Status
- Security: MFA status, SSO provider, Last Login
- Actions: Impersonate, Disable, Reset Password, Delete User
- Workspace Membership: List of workspaces with roles
- Feature Flags: Per-user flag overrides (inherited vs forced)
- Recent Activity: Timeline of last 20 actions
- Session History: Active sessions with device, IP, timestamp

### Actions

| Action | Effect | Permission Required |
|---|---|---|
| Impersonate | Login as user, audit-logged, admin banner | super-admin |
| Disable | Revoke sessions, prevent login | admin |
| Enable | Restore access | admin |
| Delete | GDPR deletion of user data | super-admin |
| Reset Password | Send reset email, invalidate sessions | admin |
| Force MFA | Require MFA on next login | admin |
| Override FF | Set user-level feature flag override | admin |

### API Endpoints

`
GET    /api/v1/admin/users                       List users
GET    /api/v1/admin/users/:id                   User details
PATCH  /api/v1/admin/users/:id                   Update user
POST   /api/v1/admin/users/:id/impersonate       Get impersonation JWT
POST   /api/v1/admin/users/:id/disable           Disable user
POST   /api/v1/admin/users/:id/enable            Enable user
DELETE /api/v1/admin/users/:id                   GDPR delete user
POST   /api/v1/admin/users/:id/reset-password    Force reset
GET    /api/v1/admin/users/:id/sessions          Active sessions
DELETE /api/v1/admin/users/:id/sessions/:sid     Terminate session
GET    /api/v1/admin/users/:id/activity          Activity log
PATCH  /api/v1/admin/users/:id/feature-flags     Override FFs
`

---

## 3. Organization Management

### Purpose

View and manage all organizations (tenants). Monitor usage, override plans, force settings, and manage lifecycle.

### Layout

`
+----------------------------------------------------------------+
|  Organizations                                                 |
+----------------------------------------------------------------+
| [Search...] [Status: All v] [Plan: All v]  [Export]            |
+------+----------+-------+---------+---------+------+-----------+
| Org  | Plan     | Users | Accts   | Posts/M | Cost | Status    |
+------+----------+-------+---------+---------+------+-----------+
| Acme | Agency   | 18    | 42      | 1,234   |  | Active    |
| Beta | Pro      | 7     | 18      | 387     |   | Active    |
| Char | Ent Cust | 342   | 124     | 8,901   | .4K| Active    |
| Free | Free     | 1     | 3       | 8       |    | Trial     |
| Over | Starter  | 4     | 15*     | 112*    |   | Over Limit|
+------+----------+-------+---------+---------+------+-----------+
| * = Over plan limit                                             |
+----------------------------------------------------------------+
`

### Organization Detail Panel

- Identity: Org ID, tenant schema, owner, domain, SSO config
- Plan: Current plan, billing interval, payment provider, status
- Usage Summary: AI credits, storage, API calls, workspaces, users (with progress bars)
- Plan Override: One-click plan change + custom limit overrides
- Workspaces: List of workspaces with member counts
- Billing Summary: Base cost, add-ons, overage, total, next invoice date
- Actions: Suspend, Force Sync, Re-provision, Export Data, Delete

### Lifecycle Actions

| Action | Effect | Recovery |
|---|---|---|
| Suspend | Block all API access | Unsuspend |
| Force Sync | Reconcile billing/usage data | N/A |
| Re-provision | Re-run tenant setup (fix migrations) | N/A |
| Export Data | Generate download link for all org data | N/A |
| Delete | Permanently delete org and all data | Irreversible |

### API Endpoints

`
GET    /api/v1/admin/organizations                      List orgs
GET    /api/v1/admin/organizations/:id                  Org details
PATCH  /api/v1/admin/organizations/:id                  Update org
POST   /api/v1/admin/organizations/:id/override-plan    Plan override
POST   /api/v1/admin/organizations/:id/suspend          Suspend
POST   /api/v1/admin/organizations/:id/unsuspend        Unsuspend
POST   /api/v1/admin/organizations/:id/re-provision     Re-provision
POST   /api/v1/admin/organizations/:id/export           Export data
DELETE /api/v1/admin/organizations/:id                  Delete org
GET    /api/v1/admin/organizations/:id/usage            Usage metrics
GET    /api/v1/admin/organizations/:id/workspaces       List workspaces
`

---

## 4. Platform Analytics

### Purpose

Aggregate analytics across all connected social platforms. Monitor health, error rates, API costs, and usage trends.

### Layout

`
+----------------------------------------------------------------+
|  Platform Analytics                                            |
+----------------------------------------------------------------+
| [Last 24h] [Last 7d] [Last 30d] [Custom v]                    |
+----------+----------+----------+----------+--------------------+
| Platform | Posts    | Error    | Avg API  | API Cost (MTD)     |
|          | Pub'd    | Rate     | Latency  |                    |
+----------+----------+----------+----------+--------------------+
| Instagram| 12,847   | 0.8%     | 320ms    | .12            |
| Facebook | 8,234    | 1.2%     | 410ms    | .45            |
| X/Twitter| 6,901    | 0.3%     | 180ms    | .78            |
| LinkedIn | 4,567    | 0.5%     | 250ms    | .34             |
| TikTok   | 3,234    | 2.1%     | 890ms    | .56            |
| YouTube  | 1,234    | 1.8%     | 1,200ms  | .89            |
+----------+----------+----------+----------+--------------------+
| Error Breakdown by Platform                    [View Details]   |
| [Stacked bar chart: error types by platform]                   |
+----------------------------------------------------------------+
`

### Metrics per Platform

| Metric | Description | Source |
|---|---|---|
| Posts Published | Total successful publishes | ClickHouse |
| Publish Attempts | Total attempts (incl. failures) | ClickHouse |
| Error Rate | Failed / Total attempts | ClickHouse |
| Error Breakdown | Auth, rate limit, API error, timeout, other | ClickHouse |
| Avg API Latency | P50 latency for platform API calls | OpenTelemetry |
| P95 API Latency | P95 latency | OpenTelemetry |
| API Calls | Total API calls to platform | Metering |
| API Cost | Estimated cost of API calls | Metering + pricing |
| Connected Accounts | Total accounts connected | PostgreSQL |

### API Endpoints

`
GET /api/v1/admin/platforms                    All platform metrics
GET /api/v1/admin/platforms/:code              Single platform detail
GET /api/v1/admin/platforms/:code/errors       Error breakdown
GET /api/v1/admin/platforms/:code/latency      Latency time series
GET /api/v1/admin/platforms/:code/usage        Usage over time
GET /api/v1/admin/platforms/compare            Cross-platform comparison
`

---

## 5. AI Model Management

### Purpose

View and manage AI models. Monitor usage, costs, and toggle availability per tier.

### Layout

`
+----------------------------------------------------------------+
|  AI Model Management                          [Add Model +]    |
+------+----------+----------+--------+--------+------+----------+
| Model| Provider | Cost/1K  | Usage  | Latency| Tiers| Status   |
+------+----------+----------+--------+--------+------+----------+
| GPT4o| OpenAI   | .0050  | 342K t | 850ms  | P,A,E| Active   |
| Cl3.5| Anthropic| .0030  | 187K t | 720ms  | P,A,E| Active   |
| Gem  | Google   | .0040  | 98K t  | 1,200ms| P,A,E| Offline  |
| Mini | OpenAI   | .00015 | 2.1M t | 450ms  | S,P,A| Active   |
| SMOS | SMOS     | .0000  | 8.7M t | 120ms  | S,P,A| Active   |
+------+----------+----------+--------+--------+------+----------+
| Total MTD AI Cost: ,342.15                                    |
+----------------------------------------------------------------+
`

### Model Detail Panel

- Identity: Model ID, provider, model name, version
- Pricing: Cost per 1K input tokens, cost per 1K output tokens
- Capabilities: Text generation, image analysis, sentiment, etc.
- Availability: Per-tier toggle (Starter/Pro/Agency/Enterprise)
- Status: Active, Offline, Maintenance
- Usage Chart: Daily token usage over 30 days (area chart)
- Usage Stats: Total tokens, avg/day, cost MTD, top consuming orgs

### API Endpoints

`
GET    /api/v1/admin/ai/models                      List all models
GET    /api/v1/admin/ai/models/:id                  Model detail
PATCH  /api/v1/admin/ai/models/:id                  Update model
POST   /api/v1/admin/ai/models/:id/toggle           Enable/disable
POST   /api/v1/admin/ai/models/:id/maintenance      Set maintenance
PATCH  /api/v1/admin/ai/models/:id/tiers            Update tiers
GET    /api/v1/admin/ai/models/:id/usage            Usage stats
GET    /api/v1/admin/ai/models/:id/cost             Cost breakdown
GET    /api/v1/admin/ai/summary                     Aggregate metrics
GET    /api/v1/admin/ai/cost/projection             Cost forecast
`

---

## 6. Billing Admin

### Purpose

Administer billing: invoices, refunds, plan changes, usage adjustments, and analytics.

### Layout

`
+----------------------------------------------------------------+
|  Billing Administration                                        |
+----------------------------------------------------------------+
| MRR: ,234 | ARR: ,210,808 | Churn: 3.2% | LTV: ,847   |
+----------------------------------------------------------------+
| Revenue Chart (12 months) - monthly recurring revenue bar chart|
+----------------------------------------------------------------+
| Overdue Invoices (12)                                            |
+------+----------+----------+----------+------+-----------------+
| Org  | Invoice  | Amount   | Due Date| Days | Actions         |
+------+----------+----------+----------+------+-----------------+
| Acme | INV-2026 | .00  | 07/15   | 7    | Resend, Refund  |
| Beta | INV-2026 | .00   | 07/10   | 12   | Resend, Void    |
+------+----------+----------+----------+------+-----------------+
+----------------------------------------------------------------+
`

### Invoice Detail

- Identity: Invoice number, organization, status (paid/open/void/uncollectible)
- Amounts: Amount due, amount paid, amount remaining
- Period: Billing period start/end, issued date, paid date
- Line Items: Base plan, add-ons, overage, taxes, discounts
- Actions: Resend, Refund, Void, Mark as Paid, Issue Credit Note
- Payment History: Attempts with status, method, date

### Billing Actions

| Action | Effect | Notes |
|---|---|---|
| Refund | Full or partial refund to payment method | Requires reason code |
| Void | Cancel invoice without refund | For incorrect invoices |
| Mark Paid | Manually mark invoice as paid | For offline payments |
| Credit Note | Issue credit to balance | Applied to future invoices |
| Adjust Usage | Manually add/remove metered usage | For billing corrections |
| Change Plan | Override org plan immediately | Triggers proration |
| Apply Coupon | Apply promotional coupon to org | Overrides any existing coupon |

### API Endpoints

`
GET    /api/v1/admin/billing/summary                    Billing overview
GET    /api/v1/admin/billing/invoices                   List invoices
GET    /api/v1/admin/billing/invoices/:id               Invoice detail
POST   /api/v1/admin/billing/invoices/:id/refund        Refund invoice
POST   /api/v1/admin/billing/invoices/:id/void          Void invoice
POST   /api/v1/admin/billing/invoices/:id/mark-paid     Mark as paid
POST   /api/v1/admin/billing/invoices/:id/credit-note   Issue credit note
GET    /api/v1/admin/billing/plans                      List all plans
GET    /api/v1/admin/billing/revenue                    Revenue analytics
GET    /api/v1/admin/billing/churn                      Churn analytics
GET    /api/v1/admin/billing/forecast                   Revenue forecast
POST   /api/v1/admin/billing/coupons                    Create coupon
GET    /api/v1/admin/billing/usage-adjustments          Usage adjustments
POST   /api/v1/admin/billing/usage-adjustments          Create adjustment
`

---

## 7. Feature Flags

### Purpose

Control feature availability globally or per tenant. Enables phased rollouts, A/B testing, and emergency feature toggles.

### Layout

`
+----------------------------------------------------------------+
|  Feature Flags                                                 |
+----------------------------------------------------------------+
| [All Flags v] [Global] [Per-Tenant] [Search...]                |
+------+----------+----------+-----------+----------+------------+
| Flag | Global   | Override | Affected  | Type     | Actions    |
|      | Default  | Count    | Tenants   |          |            |
+------+----------+----------+-----------+----------+------------+
| ai_  | ON       | 0        | 0         | release  | Toggle,Edit|
| studio|         |          |           |          |            |
| white| OFF      | 12       | Acme,     | bill     | Toggle,Edit|
|_label|          |          | Beta...   | ing      |            |
| beta_| OFF      | 847      | 5%        | experi   | Toggle,Edit|
|analyt|          |          |           | mental   |            |
+------+----------+----------+-----------+----------+------------+
| [Add Flag +]                                                   |
+----------------------------------------------------------------+
`

### Flag Detail Panel

- Identity: Flag name, description, owner team
- Global Default: ON / OFF with toggle
- Targeting: Global, percentage rollout, specific tenants
- Override List: Per-tenant overrides with edit/remove
- Audit Log: Who changed what and when

### Feature Flag Types

| Type | Description | Examples |
|---|---|---|
| release | Controlled feature rollout | ai_studio, workflow_builder |
| experiment | A/B test or beta | new_dashboard_layout, enhanced_analytics |
| ops | Operational toggle | disable_ai_generation, maintenance_mode |
| billing | Billing-gated feature | white_label, sso, custom_domain |
| permission | Permission-gated toggle | approval_workflows, custom_roles |

### API Endpoints

`
GET    /api/v1/admin/feature-flags                    List all flags
POST   /api/v1/admin/feature-flags                    Create flag
GET    /api/v1/admin/feature-flags/:id                 Flag detail
PATCH  /api/v1/admin/feature-flags/:id                 Update flag
DELETE /api/v1/admin/feature-flags/:id                 Archive flag
POST   /api/v1/admin/feature-flags/:id/toggle          Toggle global
POST   /api/v1/admin/feature-flags/:id/override        Set tenant override
DELETE /api/v1/admin/feature-flags/:id/override/:tid   Remove override
GET    /api/v1/admin/feature-flags/:id/audit           Change history
`

---

## 8. System Logs

### Purpose

Structured log viewer with filtering, search, and export capabilities.

### Layout

`
+----------------------------------------------------------------+
|  System Logs                    [Auto-refresh: 30s v]          |
+----------------------------------------------------------------+
| [Query...] [Level: All v] [Service: All v] [Time: Last 1h v]  |
| [Filter +] [Export] [Share]                                    |
+------+----------+----------+----------+------------------------+
| Time | Level    | Service  | Tenant   | Message                |
+------+----------+----------+----------+------------------------+
|10:23 | ERROR    | api      | tenant_42| Post publish failed...  |
|10:22 | ERROR    | ai       | tenant_18| AI gen timeout...      |
|10:20 | WARN     | worker   | system   | Queue backlog > 500...  |
|10:18 | INFO     | billing  | tenant_42| Invoice paid INV-2026  |
|10:15 | DEBUG    | api      | tenant_7 | Analytics query exec...|
+------+----------+----------+----------+------------------------+
| Showing 1-50 of 1,234 results                      [1] [2] [3] |
+----------------------------------------------------------------+
`

### Log Detail Panel (expand)

- Full message
- Stack trace (for errors)
- Structured metadata JSON
- Trace ID (link to OpenTelemetry trace)
- Request ID, Session ID
- Environment, Region, Pod

### Filter Options

| Filter | Type | Options |
|---|---|---|
| Time Range | Preset + custom | Last 5m, 15m, 1h, 6h, 24h, 7d, Custom |
| Level | Multi-select | DEBUG, INFO, WARN, ERROR, FATAL |
| Service | Multi-select | api, web, worker, ai, billing, social |
| Tenant ID | Text | Exact match |
| User ID | Text | Exact match |
| Trace ID | Text | Exact match |
| Query | Text/JSON | Full-text search on message + metadata |
| Error Code | Text | Error code prefix match |

### Log Retention

| Storage Tier | Retention | Queryable |
|---|---|---|
| ClickHouse (hot) | 7 days | Full-text, full metadata |
| ClickHouse (warm) | 30 days | Full-text, limited metadata |
| S3 (cold) | 1 year | By date + service only |
| S3 Glacier | 7 years | Restore required (24h) |

### API Endpoints

`
GET  /api/v1/admin/logs                           Query logs
POST /api/v1/admin/logs/export                    Export to CSV/JSON
GET  /api/v1/admin/logs/:id                       Log detail
GET  /api/v1/admin/logs/stats                     Log volume stats
`

---

## 9. MCP Server Admin

### Purpose

Register, monitor, and manage MCP servers connected to the platform.

### Layout

`
+----------------------------------------------------------------+
|  MCP Server Admin                                              |
+----------------------------------------------------------------+
| [All Servers v] [Active] [Pending] [Rejected]                  |
+------+----------+----------+--------+----------+-----+---------+
| Server| Provider | Status   | Usage  | Errors   | Lat | Actions |
|       |          |          | (7d)   | (7d)     | ency|         |
+------+----------+----------+--------+----------+-----+---------+
| Image | Stable   | Approved | 12,847 | 23       | 320 | Disable |
| Gen   | Diffus.  |          | calls  | (0.18%)  | ms  | ,Audit  |
| Voice | Eleven   | Pending  | --     | --       | --  | Approve |
| Synth | Labs     |          |        |          |     | ,Reject |
| Anal. | SMOS     | Approved | 89,233 | 12       | 45  | Disable |
| ytics | Built-in |          | calls  | (0.01%)  | ms  | ,Audit  |
+------+----------+----------+--------+----------+-----+---------+
+----------------------------------------------------------------+
`

### Server Detail Panel

- Identity: Server name, provider, version, description
- Status: Approved, Pending, Rejected, Disabled
- Auth: API key (masked), last verified timestamp
- Tools: List of tools provided by server (name, description, parameters)
- Rate Limits: Per-server rate limit configuration
- Usage Stats: Calls over time, latency, error rate, top tenants
- Installations: Which orgs/workspaces have this server installed
- Security: Last security review date, sandbox mode, permissions

### Approval Workflow

`
Developer submits MCP server for marketplace
  -> Automated scan (vulnerabilities, permissions, code quality)
    -> Manual review (security team)
      -> Approved | Rejected | Changes Requested
        -> Server listed in marketplace
`

### API Endpoints

`
GET    /api/v1/admin/mcp/servers                    List servers
GET    /api/v1/admin/mcp/servers/:id                Server detail
PATCH  /api/v1/admin/mcp/servers/:id                Update server
POST   /api/v1/admin/mcp/servers/:id/approve        Approve server
POST   /api/v1/admin/mcp/servers/:id/reject         Reject server
POST   /api/v1/admin/mcp/servers/:id/disable        Disable server
GET    /api/v1/admin/mcp/servers/:id/usage           Usage stats
GET    /api/v1/admin/mcp/servers/:id/errors          Error log
GET    /api/v1/admin/mcp/servers/:id/installations   Install list
GET    /api/v1/admin/mcp/servers/:id/security-report Security report
GET    /api/v1/admin/mcp/marketplace/queue           Pending reviews
`

---

## 10. Background Job Monitoring

### Purpose

Monitor queue health, failed jobs, retry mechanisms, and job execution details.

### Layout

`
+----------------------------------------------------------------+
|  Background Jobs                                               |
+----------------------------------------------------------------+
| Queue Depth Overview                                           |
| Publish: ¦¦¦¦ 342    AI Gen: ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦ 1,204            |
| Webhook: ¦¦ 89       Email:   ¦ 12                              |
| Analytics: ¦¦ 156    Export:  0                                 |
+----------------------------------------------------------------+
| Failed Jobs (24h)                               [Retry All]   |
+------+----------+----------+----------+----------+-------------+
| Job  | Queue    | Failed At| Attempts| Error    | Actions     |
+------+----------+----------+----------+----------+-------------+
| pub_ | publish  | 10:23    | 3/3      | Rate limit| Retry, View|
| 123  |          |          |          | exceeded | Detail     |
| ai_  | ai-gen   | 10:22    | 2/3      | Timeout  | Retry, View|
| 456  |          |          |          |          | Detail     |
| wb_  | webhook  | 10:15    | 1/3      | 500 error| Retry, View|
| 789  |          |          |          |          | Detail     |
+------+----------+----------+----------+----------+-------------+
| Dead Letter Queue (7 jobs)                                     |
| [View Dead Letter Queue]  [Clear DLQ]                          |
+----------------------------------------------------------------+
`

### Job Detail Panel

- Identity: Job ID, type, queue name
- Payload: Full job data (JSON, truncated for very large payloads)
- Status: Waiting, Active, Completed, Failed, Delayed
- Timeline: Created, started, completed (or failed) timestamps
- Attempts: List of all attempts with start time, duration, error
- Error: Error message, stack trace, error code
- Worker: Which worker pod processed the job
- Retry: Manual retry, move to DLQ, or discard

### Queue Metrics

| Metric | Source | Description |
|---|---|---|
| Queue Depth | Redis | Current items waiting |
| Active Jobs | Redis | Currently processing |
| Completion Rate | Redis | Jobs/sec completed |
| Failure Rate | Redis | Failed / Total jobs |
| Avg Processing Time | Redis | P50, P95, P99 |
| Dead Letter Queue | Redis | Jobs exceeded max retries |
| Stalled Jobs | Redis | Jobs processing but worker died |
| Job Latency | Redis | Time from creation to start |

### API Endpoints

`
GET    /api/v1/admin/jobs/queues                    Queue list with depth
GET    /api/v1/admin/jobs/queues/:name              Queue detail
GET    /api/v1/admin/jobs                           List jobs (filterable)
GET    /api/v1/admin/jobs/:id                       Job detail
POST   /api/v1/admin/jobs/:id/retry                 Retry failed job
POST   /api/v1/admin/jobs/:id/discard               Discard job
POST   /api/v1/admin/jobs/:id/move-to-dlq           Move to dead letter
GET    /api/v1/admin/jobs/dead-letter               Dead letter queue
POST   /api/v1/admin/jobs/dead-letter/retry-all     Retry all DLQ
POST   /api/v1/admin/jobs/dead-letter/clear         Clear DLQ
GET    /api/v1/admin/jobs/stats                     Aggregate job stats
GET    /api/v1/admin/jobs/workers                   Worker pool status
`

---

## Appendix A: Admin UI Component Library

Common components used across all admin panels:

| Component | Description | Props |
|---|---|---|
| DataTable | Sortable, filterable, paginated table | columns, data, pageSize, sortable, filterable |
| StatusBadge | Color-coded status indicator | status, size |
| MetricCard | Single metric with label, value, trend | label, value, trend, icon, color |
| Sparkline | Simple inline chart | data, color, height |
| TimeSeriesChart | Line/area chart for time series | data, xKey, yKeys, type |
| BarChart | Vertical/horizontal grouped bar chart | data, xKey, yKeys, stacked |
| SearchInput | Debounced search with filters | placeholder, onSearch, filters |
| SlideOverPanel | Right-side detail panel | open, onClose, title, children |
| ActionMenu | Dropdown menu of actions | items, onSelect |
| ConfirmDialog | Confirmation modal with reason input | title, message, onConfirm, variant |
| FilterBar | Row of filter controls | filters, onFilter, onClear |
| ExportButton | CSV/JSON/PDF export trigger | data, format, filename |
| RefreshIndicator | Auto-refresh toggle + manual refresh | interval, onRefresh, lastRefreshed |

## Appendix B: Admin API Authentication

All admin API endpoints require:
1. Valid JWT with dmin or super-admin role claim
2. Request originates from admin-approved IP range (configurable)
3. MFA verified within the last 4 hours
4. Audit log entry created for all mutating operations

`
Authorization: Bearer <admin_jwt>
X-Admin-Audit-Reason: Investigating billing issue for Acme Corp
`

## Appendix C: Admin API Rate Limits

| Endpoint Category | Rate Limit |
|---|---|
| GET (list/view) | 500 req/min |
| POST/PUT/PATCH (mutate) | 100 req/min |
| DELETE | 20 req/min |
| User impersonation | 10 req/min |
| Data export | 5 req/min |
| Global search | 50 req/min |
