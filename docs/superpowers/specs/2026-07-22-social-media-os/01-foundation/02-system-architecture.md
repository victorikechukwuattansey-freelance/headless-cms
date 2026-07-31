# System Architecture & Database Schema: Social Media OS

**Version:** 1.0
**Date:** 2026-07-22
**Status:** Draft
**Author:** Principal Software Architect

---

## Table of Contents

1. High-Level Architecture Diagram
2. System Components
3. Data Flow Diagrams
4. Database Schema (PostgreSQL)
5. Redis Data Structures
6. Vector Database Schema
7. Scalability Considerations

---

## 1. High-Level Architecture Diagram

```
+----------------------------------------------------------------------------------------------------------+
|                                       CLIENT LAYER                                                       |
+----------------------+-----------------------+--------------------+-------------------------------------+
|  Web App (React/Next)|  Mobile (React Native)|  Desktop (Electron) |  API Consumers (REST/GraphQL)       |
|  app.socialos.com    |  ios / android        |  desktop.app       |  SDK / Webhooks                     |
+----------+-----------+-----------+-----------+---------+----------+-------------+-----------------------+
           |                       |                     |                        |
           +-----------------------+---------------------+------------------------+
                                   |                     |
                                   v                     v
+----------------------------------------------------------------------------------------------------------+
|                                API GATEWAY LAYER                                                         |
|  +----------------------------------------------------------------------------------------------------+ |
|  |                         Kong / Envoy API Gateway                                                   | |
|  |  +------------+ +------------+ +------------+ +------------+ +-------------------------------+    | |
|  |  | Rate       | | Auth       | | Request    | | Response   | | WebSocket / SSE               |    | |
|  |  | Limiting   | | JWT / OAuth | | Routing    | | Caching    | | Manager                       |    | |
|  |  +------------+ +------------+ +------------+ +------------+ +-------------------------------+    | |
|  +----------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------+
                                   |                     |
                                   v                     v
+----------------------------------------------------------------------------------------------------------+
|                              MICROSERVICES LAYER                                                         |
|                                                                                                          |
|  +-------------+ +-------------+ +-------------+ +-------------+ +------------------+ +----------------+ |
|  | Auth        | | User/Org    | | Content     | | Publishing  | | AI Service       | | Analytics      | |
|  | Service     | | Service     | | Service     | | Service     | | (LLM Orchestr.)  | | Service        | |
|  +------+------+ +------+------+ +------+------+ +------+------+ +--------+---------+ +-------+--------+ |
|         |               |               |               |                  |                   |          |
|  +------+------+ +------+------+ +------+------+ +------+------+ +--------+---------+ +-------+--------+ |
|  | Media       | | Workflow    | | MCP         | | Notification| | Billing          | | Search         | |
|  | Service     | | Service     | | Gateway     | | Service     | | Service          | | Service        | |
|  +------+------+ +------+------+ +------+------+ +------+------+ +------------------+ +-------+--------+ |
|         |               |               |               |                                      |          |
|  +------+------+ +------+------+ +------+------+                                               |          |
|  | Campaign    | | Trend       | | Engagement  |                                               |          |
|  | Service     | | Service     | | Service     |                                               |          |
|  +-------------+ +-------------+ +-------------+                                               |          |
+----------------------------------------------------------------------------------------------------------+
         |               |               |               |                   |                   |
         v               v               v               v                   v                   v
+----------------------------------------------------------------------------------------------------------+
|                                   DATA LAYER                                                              |
|                                                                                                          |
|  +-------------------------+  +-------------------------+  +------------------------------------------+  |
|  | PostgreSQL (RDS Aurora) |  | Redis (ElastiCache)     |  | Message Queue (RabbitMQ / Kafka)         |  |
|  |  - Primary (writes)     |  |  - Cache (API/Session)  |  |  - Analytics events                     |  |
|  |  - Read Replicas (x3)   |  |  - BullMQ Queues         |  |  - Publish queue                        |  |
|  |  - Shards by workspace  |  |  - Rate Limit Counters   |  |  - Workflow triggers                    |  |
|  |  - TimescaleDB ext      |  |  - Rate Limit Buckets    |  |  - Notification queue                   |  |
|  +-------------------------+  |  - Pub/Sub Channels      |  +------------------------------------------+  |
|                               +-------------------------+                                                    |
|  +-------------------------+  +-------------------------+  +------------------------------------------+  |
|  | S3 / Cloudflare R2      |  | Elasticsearch / OpenSearch|  | Vector DB (pgvector / Qdrant /        |  |
|  | (Media Storage)         |  | (Search Indexing + Logs)  |  |           Pinecone)                    |  |
|  +-------------------------+  +-------------------------+  |  - Brand voice embeddings               |  |
|                                                              |  - Content similarity vectors           |  |
|                                                              |  - Trend / topic embeddings             |  |
|                                                              +------------------------------------------+  |
+----------------------------------------------------------------------------------------------------------+
         |               |               |               |                   |                   |
         v               v               v               v                   v                   v
+----------------------------------------------------------------------------------------------------------+
|                              INFRASTRUCTURE LAYER                                                        |
|                                                                                                          |
|  +----------------+ +----------------+ +----------------+ +----------------+ +------------------------+  |
|  | Docker / K8s   | | CI/CD (GitHub  | | Monitoring     | | CDN (Cloudflare| | External Services     |  |
|  | (EKS / GKE)    | | Actions)       | | (Datadog/Graf)  | | / CloudFront)  | | (Stripe, SendGrid,    |  |
|  +----------------+ +----------------+ +----------------+ +----------------+ | Twilio, GA4, etc.)    |  |
|  +----------------+ +----------------+ +----------------+ +----------------+ +------------------------+  |
|  | Secrets Mgr    | | Terraform/Open | | Service Mesh   | | Logging        |                         |  |
|  | (AWS Secrets / | | Tofu (IaC)     | | (Istio / Linker)| | (Loki / ELK)   |                         |  |
|  | HashiCorp Vault)| +----------------+ +----------------+ +----------------+                         |  |
|  +----------------+                                                                                     |  |
+----------------------------------------------------------------------------------------------------------+
```

### Layer Descriptions

| Layer | Technology | Responsibility |
|---|---|---|
| **Client Layer** | React/Next.js (web), React Native (mobile), Electron (desktop) | UI rendering, client-side state, caching, offline support |
| **API Gateway** | Kong / Envoy | Rate limiting, auth, request routing, response caching, WebSocket management |
| **Microservices** | Node.js/TypeScript (primary), Go/FastAPI (specialized) | Business logic per domain, event emission, inter-service communication |
| **Data Layer** | PostgreSQL, Redis, Kafka, S3, Elasticsearch, Qdrant | Persistence, caching, messaging, search, vector embeddings |
| **Infrastructure** | Kubernetes, Terraform, Datadog, Cloudflare | Compute orchestration, IaC, monitoring, CDN, service mesh |

---

## 2. System Components

### 2.1 API Gateway

**Technology:** Kong Gateway (self-managed on K8s) or AWS API Gateway
**Purpose:** Single entry point for all client traffic. Handles cross-cutting concerns so individual microservices don't have to.

| Capability | Implementation |
|---|---|
| **Rate Limiting** | Per-user (1,000 req/min standard, 10,000 req/min enterprise), per-endpoint (varies), per-workspace aggregate. Sliding window algorithm backed by Redis |
| **Authentication** | JWT validation for web/mobile, API key validation (SHA-256 + prefix lookup) for programmatic access, OAuth 2.0 for third-party |
| **Request Routing** | Path-based routing: `/api/v1/auth/*` -> Auth Service, `/api/v1/content/*` -> Content Service, `/api/v1/ai/*` -> AI Service |
| **Response Caching** | Cache GET responses in Redis with configurable TTL: 30s for analytics, 5min for static config, 1s for real-time |
| **WebSocket/SSE** | Manages persistent connections for real-time calendar updates, workflow execution logs, AI generation streaming |
| **CORS** | Strict whitelist per environment. Preflight caching for 24hr |
| **Request Validation** | OpenAPI 3.1 schema validation on all requests. Rejects malformed payloads before reaching services |
| **TLS Termination** | TLS 1.3 only. HSTS with 1-year max-age. Certificate auto-renewal via cert-manager |
| **IP Whitelisting** | Enterprise feature: restrict dashboard access to corporate CIDR ranges |
| **RequestID** | Each request tagged with `X-Request-ID` for distributed tracing |

### 2.2 Auth Service

**Technology:** Node.js/TypeScript, Express or Fastify
**Database:** PostgreSQL (`auth` schema), Redis (session store)
**Replicas:** 2-4 (auto-scaled)

| Capability | Implementation |
|---|---|
| **Registration** | Email + password (bcrypt, 12 rounds), Google OAuth, Apple OAuth, GitHub OAuth, Microsoft OAuth/OIDC. Passwordless login via magic link (email) |
| **JWT Management** | Access token: 15min (short-lived, sent in Authorization header). Refresh token: 30 days (httpOnly cookie, rotated on use). Token families to prevent replay |
| **OAuth 2.0 / OIDC** | Authorization code flow with PKCE. Supports any OIDC provider (Okta, Azure AD, OneLogin, Keycloak). Auto-provision users on first OIDC login |
| **RBAC** | Hierarchical roles: Owner > Admin > Editor > Contributor > Viewer. Custom roles via role-permission mapping table. Row-level security enforced at application layer |
| **MFA** | TOTP (RFC 6238), SMS backup codes (10 codes, single-use), hardware security keys (WebAuthn/FIDO2). Recovery email fallback |
| **Session Management** | View active sessions (device info, IP, last active). Force logout from specific devices or all devices. Session length configurable by org policy |
| **Password Policy** | Minimum 12 chars, 3 of 4 character types, breached password check (HaveIBeenPwned API, k-anonymity model), no password reuse (last 10), max 5 failed attempts before lockout (30min cooldown) |
| **API Key Management** | Generate with custom scopes, revoke, rotate. Key prefix (e.g., `sos_dev_abc123`) for identification without exposing full key. SHA-256 hash stored at rest |
| **Audit Logging** | All auth events: login, logout, failed login (with IP + user agent), MFA enroll/remove, token refresh, permission change, role assignment |

### 2.3 User/Org Service

**Technology:** Node.js/TypeScript, Express
**Database:** PostgreSQL (`user_org` schema)
**Replicas:** 2-3

| Capability | Implementation |
|---|---|
| **Multi-Tenant** | Data isolated by `organization_id` on every table. Application-layer filter on all queries. Row-level security (RLS) enabled as defense-in-depth |
| **Team Management** | Invite by email (auto-create account if new), resend invite, revoke invite, change role, remove member. Bulk invite CSV upload |
| **Workspace Settings** | Timezone (auto-detected or manual), locale/date format, currency, white-label branding (logo, colors, custom domain for enterprise), feature flags |
| **User Profile** | Name, avatar (auto-crop + CDN), bio, social links (website, X, LinkedIn), notification preferences, theme preference (light/dark/system) |
| **Account Deletion** | Soft delete with 30-day grace period (enterprise: 90 days). Account can be restored within grace period. After grace: permanent deletion with GDPR data export |
| **Usage Limits** | Per-plan limits enforced: team members, scheduled posts, AI credits, media storage (GB), API rate limits, analytics retention. Usage dashboard |
| **Feature Flags** | Per-org and per-user feature flags via Unleash/LaunchDarkly. Supports gradual rollout, A/B testing, kill switches |

### 2.4 Content Service

**Technology:** Node.js/TypeScript, Express or Fastify
**Database:** PostgreSQL (`content` schema), S3 (media), Redis (draft caching)
**Replicas:** 3-5 (auto-scaled based on queue depth)

| Capability | Implementation |
|---|---|
| **Post CRUD** | Full create, read, update, delete for posts and drafts. Supports soft delete with recovery |
| **Version Management** | Full version history stored as JSON diffs (RFC 6902 JSON Patch). Max 50 versions per post. Auto-purge oldest when limit reached |
| **Post Status Machine** | `draft -> pending_approval -> approved -> scheduled -> publishing -> published -> [archived]`. Branches: `-> cancelled`, `-> failed`. Recovery from any failure state |
| **Post Relationships** | Posts belong to 0-1 campaigns. Posts reference 0-1 brand voices. Posts can be templates (cloned by other posts) |
| **Cross-Platform Posts** | Single post logical entity with platform-specific content stored in `post_versions`. Each version per platform with independent schedule |
| **Bulk Operations** | Bulk create (from CSV/JSON), bulk schedule, bulk status change, bulk delete. Progress tracking via WebSocket |
| **Content Search** | Full-text search via PostgreSQL FTS (tier 1) and Elasticsearch (tier 2). Search fields: title, content_text, tags, platform, status, date range |
| **Calendar Generation** | Query posts by date range, group by platform. Returns calendar data with all statuses, campaign colors, optimal time overlays |
| **Template Rendering** | Apply content templates with variable substitution (e.g., `{{product_name}}`, `{{date}}`, `{{discount_percentage}}`). Preview before render |
| **Post Locking** | Optimistic locking via `version` column. If two users edit simultaneously, second save fails with conflict error and diff of changes |

### 2.5 Publishing Service

**Technology:** Node.js/TypeScript or Go
**Database:** PostgreSQL (`publishing` schema), Redis (BullMQ queues), Kafka (events)
**Replicas:** 3-5 workers per platform queue

| Capability | Implementation |
|---|---|
| **Scheduling Engine** | Cron polling every 30 seconds: `SELECT * FROM publish_queue WHERE scheduled_for <= NOW() AND status = 'queued' AND (locked_until IS NULL OR locked_until < NOW())`. Locks rows for worker processing |
| **Platform Adapters** | Pluggable adapter interface per platform. Adapter handles: OAuth refresh, request formatting, media upload, rate limit header parsing, error mapping. Adapter catalog in `services/publishing/adapters/{platform}.ts` |
| **Queue Management** | Priority queue per platform. Higher priority posts jump ahead. Rate-limit-aware: pauses queue when `X-RateLimit-Remaining` nears zero, resumes after `X-RateLimit-Reset` |
| **Publish Pipeline** | `Validate & Refresh Token -> Pre-Publish Check (Posting Assistant) -> Build Platform Request -> Execute API Call -> Parse Response -> Log Success -> Emit Event -> Notify User` |
| **Retry Logic** | Exponential backoff: 1min -> 5min -> 15min -> 1hr -> 4hrs. Max 5 retries. Different backoff per error type: rate limit (reset time), 5xx (exponential), 4xx (immediate fail) |
| **Rate Limit Handler** | Parses `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers. Stores in `platform_rate_limits` table. Pauses queue for remaining duration when limit exhausted |
| **Webhook Receiver** | Receives platform webhooks (post published confirmation, comment received, etc.). Validates signature, routes to appropriate handler |
| **Evergreen Recycling** | Cron job: `SELECT * FROM posts WHERE evergreen = TRUE AND evergreen_expires_at > NOW() AND NOT EXISTS (schedule within evergreen_interval_days)`. Creates new schedule entry |
| **Dead Letter Queue** | Posts that fail all retries moved to `publish_queue` with status `failed`. Notification sent to workspace admins. Manual review or manual retry |

### 2.6 AI Service

**Technology:** Python/FastAPI (LLM orchestration) + Node.js (prompt management)
**Database:** PostgreSQL (`ai` schema), Vector DB, Redis (prompt cache, rate limits)
**Replicas:** 5-10 (auto-scaled based on queue depth — AI is most compute-intensive)

| Capability | Implementation |
|---|---|
| **LLM Orchestration** | Routes requests to optimal provider based on: task type (text gen, image gen, analysis), cost optimization (cheapest capable model), availability (circuit breaker health), latency requirements |
| **Provider Abstraction** | Unified interface for all providers: `generate_text(prompt, config)`, `generate_image(prompt, config)`, `analyze(content, config)`. Adapter pattern per provider |
| **Prompt Management** | Versioned prompt templates with variable injection. System prompt assembly: base persona + brand voice context + platform specs + audience context + forbidden words |
| **Provider Fallback** | Configurable fallback chain per task: GPT-4o -> Claude 4 -> Gemini 2.5 Pro -> Ollama. Fallback triggered on: timeout (>15s), 5xx error, content moderation rejection |
| **Cost Management** | Per-request cost tracking (token count * provider rate). Per-workspace monthly budget cap. Provider selection includes cost optimization (use GPT-4o-mini for simple tasks) |
| **Context Assembly** | Automatic injection of: brand voice rules, platform constraints (char limits, format), audience profile, forbidden words, content history, trend context |
| **Generation Pipeline** | `Validate Request -> Check Cache -> Assemble System Prompt -> Inject Context -> Select Provider -> Execute -> Parse Response -> Quality Check (brand voice, forbidden words) -> Score -> Log -> Return` |
| **Streaming** | Server-Sent Events (SSE) for real-time content streaming to Content Studio UI. Supports interrupt (stop generation mid-stream) |
| **Safety Filters** | Output filtering: forbidden word scan (full regex + fuzzy match), PII detection (email, phone, SSN), NSFW content detection, brand name compliance, competitor name filter |
| **Usage Metering** | Track: tokens (prompt + completion), images generated, audio seconds, latency, cost, model used. Exposed to Billing Service via API |

### 2.7 Analytics Service

**Technology:** Python/FastAPI (data processing, ML) + Node.js (API layer)
**Database:** PostgreSQL + TimescaleDB hypertables, Redis (aggregation cache), Elasticsearch (log search)
**Replicas:** 3-5

| Capability | Implementation |
|---|---|
| **Event Ingestion** | REST API (`POST /api/v1/analytics/events`), batch endpoint (`POST /api/v1/analytics/events/batch`), Kafka consumer for high-volume events. Events validated, enriched, and written to partitioned table |
| **Event Types** | `post_published`, `post_viewed`, `post_liked`, `post_shared`, `post_commented`, `post_saved`, `post_clicked`, `profile_viewed`, `follower_gained`, `follower_lost`, `story_viewed`, `story_completed`, `video_viewed`, `video_completed`, `link_clicked`, `conversion`, `impression`, `reach` |
| **Daily Aggregation** | Nightly cron (or TimescaleDB continuous aggregate): aggregates raw events into `daily_post_analytics` and `daily_account_analytics`. Supports backfill for late-arriving events |
| **AI Insight Generation** | On-demand and scheduled: calls Analytics Interpreter agent with metric data, receives natural language explanation: "Your LinkedIn posts performed 35% better this week because..." |
| **Predictive Models** | ML models trained per workspace (or globally for new workspaces): engagement prediction, follower growth forecasting, optimal time detection. Models exported to ONNX, served via Triton Inference Server |
| **Revenue Attribution** | Ingests conversion events from: Shopify webhook, Stripe webhook, GA4 Data API, custom CRM API. Runs attribution models (first-touch, last-touch, linear, time-decay, position-based) |
| **Report Engine** | Renders PDF/CSV/HTML/XLSX reports from analytics data. White-label support (brand logo, colors, custom domain). Scheduled delivery via Notification Service |
| **Data Retention Policies** | Raw events: 90 days (standard), 2 years (enterprise). Aggregated data: indefinite. Automatic partition drop via pg_partman |

### 2.8 Media Service

**Technology:** Node.js/TypeScript
**Storage:** S3/R2/CDN, PostgreSQL (metadata)
**Replicas:** 2-3

| Capability | Implementation |
|---|---|
| **File Upload** | Presigned URL uploads directly to S3 from client. `POST /api/v1/media/upload-url` returns presigned PUT URL. Multipart upload for files >100MB |
| **Image Optimization** | Auto-transcode to WebP (default) and AVIF (browser detection). Resize to platform specs: Instagram square 1080x1080, LinkedIn 1200x627, etc. Strip EXIF for privacy |
| **Video Transcoding** | Async pipeline: transcode to HLS (adaptive bitrate streaming) + MP4 fallback. Generate thumbnail at 00:00, 25%, 50%, 75%. Extract duration, dimensions, codec info |
| **Format Support** | Image: JPEG, PNG, WebP, AVIF, GIF, SVG, HEIC, BMP. Video: MP4 (H.264/H.265), MOV, WebM (VP9), AVI. Audio: MP3, WAV, AAC, OGG, FLAC, M4A. Document: PDF (preview generation) |
| **Content Moderation** | Automatic NSFW detection (API or on-device model). Rejects flagged content or moves to quarantine for manual review. Logs all moderation decisions |
| **CDN Integration** | Cloudflare/CloudFront distribution with 1yr TTL for immutable assets. Cache invalidation on asset update. Geo-replication for global performance |
| **Media Library Search** | Full-text search on filename + tags. AI auto-tagging (object detection, scene classification, text extraction). Visual similarity search (via vector embeddings) |
| **Usage Tracking** | Track which posts reference each media asset. Alert if deleting asset that's in use. Show usage count in library UI |

### 2.9 Workflow Service

**Technology:** Node.js/TypeScript (workflow engine) or Temporal/Temporalite
**Database:** PostgreSQL (`workflow` schema), Redis (BullMQ for triggers)
**Replicas:** 2-4

| Capability | Implementation |
|---|---|
| **Visual Builder Backend** | CRUD API for workflow DAGs. Stores nodes (type, config, position) and edges (source, target, label) as JSON in `workflows` table. Validates DAG for cycles on save |
| **Workflow Engine** | Directed Acyclic Graph (DAG) executor. Traverses nodes in topological order. Supports parallel branches. Each node receives context from parent node outputs |
| **Trigger Manager** | Listens on multiple channels: cron (node-cron), webhook (HTTP endpoint), Kafka events (post.published, comment.created), analytics threshold alerts. Matches to workflows and creates execution |
| **Action Executor** | Dispatches actions to microservices via internal HTTP or gRPC. Available actions: create/schedule/publish post, generate AI content, upload media, send notification, call webhook, create task (Linear/Asana/Todoist) |
| **Execution Log** | Full trace per execution: node start time, node end time, conditions evaluated, action results, errors. Stored in `workflow_executions` and `workflow_execution_logs` |
| **Error Handling** | Per-node retry: exponential backoff (1s -> 5s -> 30s -> 2min). Max 3 retries. Dead letter queue after max retries. Error notification configured per workflow |
| **Workflow Templates** | Pre-built templates for common automations: "Blog to social," "Engagement alert," "Weekly report," "Content repurpose." Templates versioned and can be forked |
| **Version Management** | Versioned workflow edits. Rollback to any previous version. Canary testing: run new version alongside old version for X executions |

### 2.10 MCP Gateway

**Technology:** Node.js/TypeScript
**Database:** PostgreSQL (`mcp` schema), Redis (connection pools, rate limits)
**Replicas:** 2-3

| Capability | Implementation |
|---|---|
| **MCP Server Registry** | CRUD for registered MCP servers. Each server has: name, endpoint URL, auth type/credentials, supported capabilities, health status, version |
| **Connection Management** | Persistent HTTP/2 connections (or WebSocket for streaming MCP). Connection pooling (5-20 connections per server). Automatic reconnect with exponential backoff. Circuit breaker: 5 failures in 60s -> open circuit -> 30s cooldown -> half-open -> 1 success -> close |
| **Provider-Agnostic API** | Unified MCP request format: `{ method: string, params: object, id: string }`. Unified response format: `{ result: any, error?: { code: string, message: string } }` |
| **Request Routing** | Routes by capability: `generate_text` -> text generation servers. Capability-based discovery: find first healthy server supporting requested capability |
| **Credential Management** | AES-256-GCM encryption at rest. Encryption keys stored in KMS/Vault, rotated every 90 days. Credentials per workspace per MCP server |
| **Usage Metering** | Track per-request: tokens, latency, cost (where applicable). Aggregate per workspace per billing period. Expose via API for Billing Service |
| **Caching** | Cache idempotent MCP responses (e.g., trending topics, model lists) with Redis. Configurable TTL per capability. Cache invalidation events |
| **Health Monitoring** | Passive (monitor request latency/error rates) + active (periodic health check pings). Prometheus metrics: request count, latency p50/p95/p99, error rate, circuit breaker state |

### 2.11 Notification Service

**Technology:** Node.js/TypeScript
**Queues:** RabbitMQ (or Kafka)
**Replicas:** 2-3

| Capability | Implementation |
|---|---|
| **Channel Support** | Email (SendGrid/Resend), Slack webhook, Discord webhook, SMS (Twilio), in-app notification (WebSocket + React toast), push notification (Firebase Cloud Messaging + APNs), webhook (custom HTTP endpoint) |
| **Template System** | Handlebars-based email/SMS templates. Variable substitution: `{{user_name}}`, `{{post_url}}`, `{{metric_value}}`. Multi-language support (locale detection from user profile) |
| **Preference Management** | Per-user notification preferences: which event types, which channels, immediate vs digest (daily/weekly), quiet hours (do not disturb). Default: all channels on, no digest |
| **Digest Generation** | Daily/weekly digest cron: aggregates pending notifications into single email. "Weekly performance summary," "Pending approvals," "Failed posts review" |
| **Rate Limiting** | Max 50 notifications per user per hour. Digest mode bypasses rate limit. Prevents notification overload |

### 2.12 Billing Service

**Technology:** Node.js/TypeScript or Go
**Integration:** Stripe (primary), Paddle (EU backup)
**Replicas:** 2-3

| Capability | Implementation |
|---|---|
| **Subscription Management** | Stripe Customer Portal for plan changes. Plans: Starter ($19/mo), Creator ($49/mo), Agency ($199/mo), Enterprise (custom). Upgrade: prorated. Downgrade: effective at next billing period |
| **Usage Metering** | Ingest usage from AI Service (AI generation credits), Media Service (storage GB), Publishing Service (post count). Bill per-unit over plan allowance. Metered usage reported to Stripe |
| **Plan Configuration** | Plans defined in Stripe products + internal config: base price, included units (AI credits, posts, team members, workspaces), overage rates, feature access matrix |
| **Invoice Generation** | Stripe auto-invoices on billing cycle. PDF invoices stored and accessible from UI. Tax ID support for B2B |
| **Tax Handling** | Automatic tax calculation via Stripe Tax. Supports VAT (EU), GST (Australia/NZ/India/Singapore/Canada), sales tax (US), consumption tax (Japan) |
| **Coupons/Discounts** | Promo codes (percentage or fixed), referral credits ($10 per referral max $100/yr), annual discount (2 months free) |
| **Enterprise Quotes** | Custom quote generation via Stripe. Annual contracts with net-30 invoicing. Minimum commit: $24K/yr |

---

## 3. Data Flow Diagrams

### 3.1 Publish a Post

```
User clicks "Schedule" in Calendar / Post Editor
           |
           v
[Web App] POST /api/v1/content/posts/:id/schedule
  Body: { scheduled_at: "2026-07-25T14:00:00Z", social_account_ids: [...] }
           |
           v
[API Gateway] Validate JWT -> Check rate limit (user: 1000/min, endpoint: 100/min)
  -> Route to Content Service
  -> Add X-Request-ID header
           |
           v
[Content Service]
  1. Load post from DB (with all post_versions, post_media)
  2. Validate:
     - Post exists and belongs to user's organization
     - User has 'content:schedule' permission
     - scheduled_at is in the future (within 1 year)
     - Each social_account belongs to this organization
     - Platform limits: char count, media count, media size
  3. Run Pre-Publish Check (call AI Posting Assistant):
     - Spellcheck & grammar
     - Brand voice compliance
     - Forbidden word scan
     - Platform limit enforcement
     - Engagement score prediction
  4. If checks pass:
     - Create schedule records per social_account
     - Update post status: draft -> scheduled
     - Emit event: post.scheduled
  5. If checks fail:
     - Return violations to client with details
     - Post stays in draft
           |
           v
[Content Service] Return { success: true, schedule_ids: [...] }
  -> Cache invalidation: post/{id}, calendar/{workspace}/{date}
           |
           v
[Redis Pub/Sub] event: post.scheduled
  -> Notification Service sends confirmation
  -> WebSocket push to other sessions
           |
           v
[Publishing Service] Scheduler (cron every 30s)
  -> Query: SELECT * FROM publish_queue pq
     JOIN schedules s ON pq.schedule_id = s.id
     WHERE pq.status = 'queued'
     AND pq.scheduled_for <= NOW()
     AND (pq.locked_until IS NULL OR pq.locked_until < NOW())
     ORDER BY pq.priority DESC, pq.scheduled_for ASC
     LIMIT 200
  -> Lock rows: UPDATE publish_queue SET locked_until = NOW()+interval'5min',
     locked_by = worker_id, status = 'processing'
           |
           v
[Publish Queue Worker] (per platform, per worker)
  1. Refresh OAuth token if expired:
     - Check token expiry from platform_credentials
     - If expired, use refresh_token to get new tokens
     - Store new tokens (encrypted)
  2. Build platform-specific request:
     - X: POST /2/tweets { text, media_ids }
     - LinkedIn: POST /rest/posts { author, commentary, visibility, distribution }
     - Instagram: POST /{ig-user-id}/media { image_url, caption }
     - etc.
  3. Execute API call with retry logic:
     - Timeout: 30s per call
     - On rate limit (429): read Retry-After, pause queue
     - On 5xx: retry with backoff
     - On 4xx (other): mark as failed, skip retry
  4. On success:
     - Update schedule: status=published, platform_post_id, platform_post_url, published_at=NOW()
     - Update publish_queue: status=completed, completed_at=NOW()
     - Emit event: post.published { post_id, platform, url, published_at }
  5. On failure (after max retries):
     - Update schedule: status=failed, error_message
     - Update publish_queue: status=failed
     - Emit event: post.failed { post_id, platform, error, retry_count }
           |
           v
[Analytics Service] Consume post.published event
  -> Write analytics event: { type: 'post_published', post_id, platform, timestamp }
  -> Update daily aggregates
           |
           v
[Notification Service] Consume post.published / post.failed
  -> In-app notification (WebSocket)
  -> Optional: email, Slack, Discord based on user preferences
           |
           v
[Web App] WebSocket receives status update
  -> Calendar UI refreshes post status
  -> Dashboard widgets update
  -> User sees success/failure indicator
```

### 3.2 AI Generate Content

```
User types prompt in Content Studio
           |
           v
[Web App] POST /api/v1/ai/generate
  Body: {
    provider: "gpt-4o",
    model: "gpt-4o-2026-05-13",
    prompt: "Write a LinkedIn post about our new AI scheduling feature",
    platform: "linkedin",
    brand_voice_id: "uuid-here",
    count: 3,
    temperature: 0.7,
    max_tokens: 1000
  }
           |
           v
[API Gateway] Rate limit: 50 AI requests/min per user -> Route to AI Service
           |
           v
[AI Service]
  1. Validate request:
     - Provider supported and configured
     - User's workspace has AI credits available
     - Brand voice exists and belongs to organization
  2. Load context:
     - Brand voice profile (personality, forbidden words, vocabulary)
     - Platform specs (LinkedIn: 3000 char max, professional tone, line breaks)
     - Organization's industry/product info (from workspace settings)
  3. Check cache (Redis):
     - Key: ai:gen:{sha256(prompt + brand_voice_id + platform)}
     - Hit -> Return cached result (skip generation)
     - Miss -> Continue with generation
  4. Assemble prompt:
     System: "You are an expert social media content writer..."
     Context: Brand voice rules + Platform constraints + Audience
     User: The prompt text
  5. Select provider:
     - Check provider availability (circuit breaker)
     - Check cost optimization (use GPT-4o-mini for simple tasks if enabled)
     - Route to selected provider via MCP Gateway
           |
           v
[MCP Gateway]
  1. Load MCP connection for OpenAI
  2. Check rate limits (per workspace, per provider)
  3. Build provider-specific request:
     - OpenAI: { model, messages: [...], temperature, max_tokens, n: count }
  4. Execute with 20s timeout
  5. On success: parse response, return to AI Service
  6. On failure: try fallback provider (if configured)
  7. Log: tokens, latency, cost
           |
           v
[AI Service] (continued)
  6. Post-process each variant:
     a. Forbidden word scan (regex + fuzzy match)
     b. Brand voice compliance scoring (1-100)
     c. Platform limit enforcement (truncate if needed, warn if close)
     d. Format adjustment (add line breaks, emoji spacing, hashtag block)
  7. Score each variant:
     - Engagement prediction (0-100) based on: length optimality, hashtag count,
       emoji usage, question presence, call-to-action, sentiment
     - Sort by score descending
  8. Cache result: Redis SET with 1hr TTL
  9. Store generation record in ai_generations table
 10. Return { variants: [{ text, score, char_count, compliance_score }] }
           |
           v
[Web App]
  -> Display variants with score badges
  -> User can: select, edit, regenerate specific variant, rate quality
  -> Selected variant flows to post editor for scheduling
```

### 3.3 Workflow Execution

```
Trigger event fires:
  Example: "New blog post published" (webhook from external CMS)
           |
           v
[Workflow Service - Trigger Manager]
  1. Receive HTTP POST on /api/v1/webhooks/workflow/{org_id}
     Body: { event: "blog.published", data: { title, url, content } }
  2. Validate webhook signature (HMAC-SHA256)
  3. Match against active workflow triggers:
     SELECT w.* FROM workflows w
     JOIN workflow_triggers wt ON wt.workflow_id = w.id
     WHERE wt.trigger_type = 'external_webhook'
     AND wt.config->>'endpoint_path' = '/api/v1/webhooks/workflow/{org_id}'
     AND w.is_active = TRUE
     AND w.organization_id = {org_id}
  4. For each matching workflow, create execution:
     - INSERT INTO workflow_executions (workflow_id, triggered_by='webhook',
       trigger_data={...full event...}, status='running')
     - Push execution to BullMQ queue for processing
           |
           v
[Workflow Service - Workflow Engine]
  1. Dequeue execution from BullMQ
  2. Load workflow DAG (nodes + edges from JSON)
  3. Initialize execution context with trigger_data
  4. Topological sort of DAG nodes
  5. Execute nodes in order:
     For each node:
       a. Load node config based on type:
          - "trigger": already processed, skip
          - "condition": evaluate IF/ELSE based on context variables
               e.g., "if {{trigger_data.title}} contains 'product launch'"
               -> Sets context.path = 'true' or 'false'
          - "action:generate_content":
               Call AI Service: POST /api/v1/ai/generate
               with prompt template from node config
               -> Store result in context.{node_id}.output
          - "action:create_post":
               Call Content Service: POST /api/v1/content/posts
               -> Store created post ID in context
          - "action:schedule_post":
               Call Content Service: POST /api/v1/content/posts/:id/schedule
               -> Store schedule result
          - "action:send_notification":
               Call Notification Service
          - "action:webhook":
               HTTP POST to configured URL
          - "delay": Wait for configured duration (seconds, minutes, hours)
               -> Push execution back to queue with delayed availability
       b. Log node execution: status, duration, output, errors
       c. If error and retry configured:
            -> Wait retry delay, re-execute node
            -> Max retries exceeded -> mark node as failed -> error path
       d. Pass context to next nodes
  6. On completion:
     - Update workflow_execution: status='completed', completed_at=NOW(),
       node_results = { all node outputs }
     - Emit event: workflow.completed
  7. On error (workflow-level):
     - Update workflow_execution: status='failed', error_message
     - Execute error path if configured (separate error branch in DAG)
           |
           v
[Notification Service] Consume workflow.completed / workflow.failed
  -> In-app notification
  -> Optional: email/Slack with execution summary
           |
           v
[Web App] WebSocket push -> Workflow Builder UI updates
  -> Execution history shows: status, duration, node-by-node trace
  -> User can: view logs, retry failed execution, edit workflow
```

---

## 4. Database Schema (PostgreSQL)

### Naming Conventions

- **Tables:** `snake_case`, plural
- **Columns:** `snake_case`
- **Indexes:** `idx_{table}_{column(s)}`
- **Unique constraints:** `uq_{table}_{column(s)}`
- **Foreign keys:** `fk_{child_table}_{parent_table}`
- **Primary keys:** `UUID` type, `gen_random_uuid()`
- **Timestamps:** `TIMESTAMPTZ` (always UTC)
- **Soft delete:** `deleted_at TIMESTAMPTZ` (NULL = not deleted)
- **Enum types:** `snake_case`, lowercase

### 4.1 Users, Organizations, Teams, Roles, Permissions

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'editor', 'contributor', 'viewer');
CREATE TYPE subscription_status AS ENUM (
    'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid'
);
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked', 'cancelled');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255),
    name            VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    bio             TEXT,
    timezone        VARCHAR(50) DEFAULT 'UTC',
    locale          VARCHAR(10) DEFAULT 'en-US',
    status          user_status NOT NULL DEFAULT 'active',
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret      VARCHAR(255),
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_users_email ON users(LOWER(email)) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE status != 'deleted';
CREATE INDEX idx_users_created_at ON users(created_at);

COMMENT ON TABLE users IS 'Core user accounts. Supports soft delete via deleted_at column.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash with 12 rounds. NULL for OAuth-only accounts.';

-- ============================================================
-- SOCIAL LOGINS (OAuth connections)
-- ============================================================

CREATE TYPE oauth_provider AS ENUM ('google', 'apple', 'github', 'microsoft', 'linkedin', 'discord');

CREATE TABLE user_social_logins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        oauth_provider NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email  VARCHAR(255),
    profile_data    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_user_social_login ON user_social_logins(provider, provider_user_id);
CREATE INDEX idx_user_social_login_user ON user_social_logins(user_id);

-- ============================================================
-- ORGANIZATIONS (Workspaces)
-- ============================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    logo_url        TEXT,
    plan_id         UUID REFERENCES subscription_plans(id),
    subscription_status subscription_status,
    timezone        VARCHAR(50) DEFAULT 'UTC',
    locale          VARCHAR(10) DEFAULT 'en-US',
    feature_flags   JSONB NOT NULL DEFAULT '{}',
    settings        JSONB NOT NULL DEFAULT '{}',       -- white-label, domain, etc.
    max_members     INTEGER NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_plan ON organizations(plan_id);

COMMENT ON TABLE organizations IS 'Multi-tenant workspaces. Every piece of data belongs to an organization.';
COMMENT ON COLUMN organizations.settings IS 'JSON: white_label, custom_domain, saml_config, ip_whitelist, etc.';

-- ============================================================
-- ORGANIZATION MEMBERS (Team membership + roles)
-- ============================================================

CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            org_role NOT NULL DEFAULT 'editor',
    invited_by      UUID REFERENCES users(id),
    invite_status   invite_status NOT NULL DEFAULT 'pending',
    joined_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_org_member ON organization_members(organization_id, user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

COMMENT ON TABLE organization_members IS 'Maps users to organizations with role assignments.';

-- ============================================================
-- PERMISSION SCOPES (RBAC)
-- ============================================================

CREATE TYPE permission_scope AS ENUM (
    'content:read', 'content:write', 'content:delete', 'content:approve',
    'content:publish', 'content:schedule',
    'analytics:read', 'analytics:export',
    'media:read', 'media:write', 'media:delete',
    'settings:read', 'settings:write',
    'members:read', 'members:write', 'members:delete',
    'billing:read', 'billing:write',
    'ai:generate', 'ai:manage_prompts', 'ai:manage_voices',
    'workflows:read', 'workflows:write', 'workflows:execute',
    'campaigns:read', 'campaigns:write', 'campaigns:delete',
    'mcp:manage', 'mcp:use'
);

CREATE TABLE role_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role            org_role NOT NULL,
    permission      permission_scope NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_role_permission ON role_permissions(role, permission);

COMMENT ON TABLE role_permissions IS 'Maps role names to permission scopes for RBAC enforcement.';

-- Seed default role permissions
INSERT INTO role_permissions (role, permission) VALUES
    -- Owner: full access
    ('owner', 'content:read'), ('owner', 'content:write'), ('owner', 'content:delete'),
    ('owner', 'content:approve'), ('owner', 'content:publish'), ('owner', 'content:schedule'),
    ('owner', 'analytics:read'), ('owner', 'analytics:export'),
    ('owner', 'media:read'), ('owner', 'media:write'), ('owner', 'media:delete'),
    ('owner', 'settings:read'), ('owner', 'settings:write'),
    ('owner', 'members:read'), ('owner', 'members:write'), ('owner', 'members:delete'),
    ('owner', 'billing:read'), ('owner', 'billing:write'),
    ('owner', 'ai:generate'), ('owner', 'ai:manage_prompts'), ('owner', 'ai:manage_voices'),
    ('owner', 'workflows:read'), ('owner', 'workflows:write'), ('owner', 'workflows:execute'),
    ('owner', 'campaigns:read'), ('owner', 'campaigns:write'), ('owner', 'campaigns:delete'),
    ('owner', 'mcp:manage'), ('owner', 'mcp:use'),
    -- Admin: nearly full, no billing/member deletion
    ('admin', 'content:read'), ('admin', 'content:write'), ('admin', 'content:delete'),
    ('admin', 'content:approve'), ('admin', 'content:publish'), ('admin', 'content:schedule'),
    ('admin', 'analytics:read'), ('admin', 'analytics:export'),
    ('admin', 'media:read'), ('admin', 'media:write'), ('admin', 'media:delete'),
    ('admin', 'settings:read'), ('admin', 'settings:write'),
    ('admin', 'members:read'), ('admin', 'members:write'),
    ('admin', 'ai:generate'), ('admin', 'ai:manage_prompts'), ('admin', 'ai:manage_voices'),
    ('admin', 'workflows:read'), ('admin', 'workflows:write'), ('admin', 'workflows:execute'),
    ('admin', 'campaigns:read'), ('admin', 'campaigns:write'),
    ('admin', 'mcp:use'),
    -- Editor: create/edit content, schedule, AI generation
    ('editor', 'content:read'), ('editor', 'content:write'), ('editor', 'content:schedule'),
    ('editor', 'analytics:read'),
    ('editor', 'media:read'), ('editor', 'media:write'),
    ('editor', 'ai:generate'),
    ('editor', 'workflows:read'), ('editor', 'workflows:execute'),
    ('editor', 'campaigns:read'), ('editor', 'campaigns:write'),
    -- Contributor: create drafts, use media library
    ('contributor', 'content:read'), ('contributor', 'content:write'),
    ('contributor', 'media:read'), ('contributor', 'media:write'),
    ('contributor', 'ai:generate'),
    -- Viewer: read-only
    ('viewer', 'content:read'), ('viewer', 'analytics:read'), ('viewer', 'media:read');

-- ============================================================
-- USER SESSIONS (for JWT refresh token tracking)
-- ============================================================

CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info     JSONB,
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

COMMENT ON TABLE user_sessions IS 'Tracks active refresh tokens for JWT session management.';

-- ============================================================
-- API KEYS
-- ============================================================

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_prefix      VARCHAR(20) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    scopes          permission_scope[] NOT NULL,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE UNIQUE INDEX uq_api_keys_hash ON api_keys(key_hash);

COMMENT ON TABLE api_keys IS 'Programmatic API access keys. key_prefix stored for identification, key_hash for verification.';
```

### 4.2 Social Accounts and Platform Credentials

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE platform_type AS ENUM (
    'x', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube',
    'pinterest', 'threads', 'bluesky', 'google_business', 'mastodon', 'slack'
);

CREATE TYPE account_status AS ENUM ('active', 'expired', 'revoked', 'rate_limited', 'error');

-- ============================================================
-- SOCIAL ACCOUNTS
-- ============================================================

CREATE TABLE social_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform        platform_type NOT NULL,
    account_id      VARCHAR(255) NOT NULL,
    account_name    VARCHAR(255) NOT NULL,
    account_avatar  TEXT,
    account_url     TEXT,
    account_type    VARCHAR(50),            -- personal, business, creator, page, channel
    status          account_status NOT NULL DEFAULT 'active',
    is_verified     BOOLEAN DEFAULT FALSE,
    follower_count  BIGINT DEFAULT 0,
    following_count BIGINT DEFAULT 0,
    metadata        JSONB,
    last_sync_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_social_account ON social_accounts(organization_id, platform, account_id);
CREATE INDEX idx_social_accounts_org ON social_accounts(organization_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX idx_social_accounts_status ON social_accounts(status);

COMMENT ON TABLE social_accounts IS 'Connected social media profiles per organization. One organization can have multiple accounts per platform.';

-- ============================================================
-- PLATFORM CREDENTIALS (OAuth Tokens)
-- ============================================================

CREATE TABLE platform_credentials (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    access_token      TEXT NOT NULL,
    refresh_token     TEXT,
    token_type        VARCHAR(50) DEFAULT 'Bearer',
    scope             TEXT,
    expires_at        TIMESTAMPTZ,
    encryption_key_id VARCHAR(255),
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_creds_account ON platform_credentials(social_account_id);

COMMENT ON TABLE platform_credentials IS 'OAuth tokens and API credentials. All token fields are encrypted with AES-256-GCM.';

-- ============================================================
-- PLATFORM RATE LIMIT STATE
-- ============================================================

CREATE TABLE platform_rate_limits (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    endpoint          VARCHAR(255) NOT NULL,
    limit_count       INTEGER NOT NULL,
    remaining         INTEGER NOT NULL,
    reset_at          TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_platform_rate_limit ON platform_rate_limits(social_account_id, endpoint);
CREATE INDEX idx_platform_rate_limits_reset ON platform_rate_limits(reset_at);
```

### 4.3 Posts, Drafts, Versions, Schedules, Queues

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE post_status AS ENUM (
    'draft', 'pending_approval', 'approved', 'scheduled',
    'publishing', 'published', 'failed', 'cancelled', 'archived'
);

CREATE TYPE post_type AS ENUM (
    'text', 'image', 'video', 'carousel', 'reel', 'story',
    'thread', 'link', 'poll', 'event', 'offer', 'community_post'
);

-- ============================================================
-- POSTS
-- ============================================================

CREATE TABLE posts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_by        UUID REFERENCES users(id),
    campaign_id       UUID REFERENCES campaigns(id),
    brand_voice_id    UUID REFERENCES brand_voices(id),
    title             VARCHAR(500),
    post_type         post_type NOT NULL DEFAULT 'text',
    status            post_status NOT NULL DEFAULT 'draft',
    evergreen         BOOLEAN NOT NULL DEFAULT FALSE,
    evergreen_interval_days INTEGER,
    evergreen_expires_at     TIMESTAMPTZ,
    is_template       BOOLEAN NOT NULL DEFAULT FALSE,
    template_id       UUID REFERENCES posts(id),
    tags              VARCHAR[],
    notes             TEXT,
    version           INTEGER NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at      TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_posts_org ON posts(organization_id);
CREATE INDEX idx_posts_org_status ON posts(organization_id, status);
CREATE INDEX idx_posts_campaign ON posts(campaign_id);
CREATE INDEX idx_posts_created_by ON posts(created_by);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_evergreen ON posts(evergreen) WHERE evergreen = TRUE;
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

COMMENT ON TABLE posts IS 'Core content entity. A post can be published to multiple platforms via schedules.';

-- ============================================================
-- POST VERSIONS (platform-specific content + version history)
-- ============================================================

CREATE TABLE post_versions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    version_number    INTEGER NOT NULL,
    platform          platform_type,
    content_text       TEXT,
    content_html       TEXT,
    character_count    INTEGER,
    language           VARCHAR(10) DEFAULT 'en',
    status             post_status,
    created_by         UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    diff_json          JSONB
);

CREATE INDEX idx_post_versions_post ON post_versions(post_id);
CREATE INDEX idx_post_versions_platform ON post_versions(platform);
CREATE UNIQUE INDEX uq_post_version ON post_versions(post_id, COALESCE(platform, 'NULL'), version_number);

COMMENT ON TABLE post_versions IS 'Stores platform-specific content per version. NULL platform = applies to all. Version diffs for history.';

-- ============================================================
-- POST MEDIA (media-post associations with ordering)
-- ============================================================

CREATE TABLE post_media (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_version_id   UUID NOT NULL REFERENCES post_versions(id) ON DELETE CASCADE,
    media_id          UUID NOT NULL REFERENCES media_assets(id),
    position          INTEGER NOT NULL DEFAULT 0,
    alt_text           TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_media_version ON post_media(post_version_id);
CREATE INDEX idx_post_media_media ON post_media(media_id);
CREATE UNIQUE INDEX uq_post_media_position ON post_media(post_version_id, position);

-- ============================================================
-- SCHEDULES (per-platform publishing schedule)
-- ============================================================

CREATE TYPE queue_strategy AS ENUM ('fifo', 'priority', 'random', 'manual');

CREATE TABLE schedules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    scheduled_at       TIMESTAMPTZ,
    timezone           VARCHAR(50) DEFAULT 'UTC',
    queue_priority     INTEGER DEFAULT 0,
    queue_strategy     queue_strategy DEFAULT 'fifo',
    status             post_status NOT NULL DEFAULT 'scheduled',
    platform_post_id   VARCHAR(255),
    platform_post_url  TEXT,
    published_at       TIMESTAMPTZ,
    error_message      TEXT,
    retry_count        INTEGER DEFAULT 0,
    max_retries        INTEGER DEFAULT 5,
    last_error_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_post ON schedules(post_id);
CREATE INDEX idx_schedules_account ON schedules(social_account_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE UNIQUE INDEX uq_schedule_post_account ON schedules(post_id, social_account_id);

COMMENT ON TABLE schedules IS 'Per-social-account schedule for each post. Enables multi-platform publishing with different timings.';

-- ============================================================
-- PUBLISH QUEUE (managed schedulers or background workers)
-- ============================================================

CREATE TABLE publish_queue (
    id                BIGSERIAL PRIMARY KEY,
    schedule_id       UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_accounts(id),
    priority          INTEGER NOT NULL DEFAULT 0,
    status            VARCHAR(50) DEFAULT 'queued',
    attempt           INTEGER DEFAULT 0,
    max_attempts      INTEGER DEFAULT 5,
    last_error        TEXT,
    scheduled_for     TIMESTAMPTZ NOT NULL,
    locked_until      TIMESTAMPTZ,
    locked_by         VARCHAR(255),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at       TIMESTAMPTZ
);

CREATE INDEX idx_publish_queue_status ON publish_queue(status);
CREATE INDEX idx_publish_queue_scheduled ON publish_queue(scheduled_for);
CREATE INDEX idx_publish_queue_account ON publish_queue(social_account_id);
CREATE INDEX idx_publish_queue_lock ON publish_queue(locked_until) WHERE locked_until IS NOT NULL;

COMMENT ON TABLE publish_queue IS 'Queue of posts ready for publishing. Workers lock rows for processing. Dead letter queue = status=failed, attempt=max_attempts.';
```

### 4.4 Media Assets and Content Library

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document', 'gif', 'other');
CREATE TYPE media_status AS ENUM ('uploading', 'processing', 'ready', 'failed', 'rejected');

-- ============================================================
-- MEDIA ASSETS
-- ============================================================

CREATE TABLE media_assets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by       UUID NOT NULL REFERENCES users(id),
    filename          VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    media_type        media_type NOT NULL,
    status            media_status NOT NULL DEFAULT 'uploading',
    file_size         BIGINT NOT NULL,
    width             INTEGER,
    height            INTEGER,
    duration_seconds  DECIMAL(10,3),
    storage_key       VARCHAR(1000) NOT NULL,
    cdn_url           TEXT,
    thumbnail_url     TEXT,
    alt_text          TEXT,
    caption           TEXT,
    tags              VARCHAR[],
    ai_tags           JSONB,
    nsfw_score        DECIMAL(5,4),
    brand_safe        BOOLEAN DEFAULT TRUE,
    usage_count       INTEGER DEFAULT 0,
    checksum          VARCHAR(64),
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_media_org ON media_assets(organization_id);
CREATE INDEX idx_media_type ON media_assets(media_type);
CREATE INDEX idx_media_status ON media_assets(status);
CREATE INDEX idx_media_tags ON media_assets USING GIN(tags);
CREATE INDEX idx_media_ai_tags ON media_assets USING GIN(ai_tags);
CREATE INDEX idx_media_checksum ON media_assets(checksum);

COMMENT ON TABLE media_assets IS 'Central media library. Files stored in S3/R2, metadata in PostgreSQL.';

-- ============================================================
-- CONTENT TEMPLATES
-- ============================================================

CREATE TABLE content_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by        UUID NOT NULL REFERENCES users(id),
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    platform          platform_type,
    category          VARCHAR(100),
    template_text     TEXT NOT NULL,
    template_html     TEXT,
    variables         JSONB,
    is_public         BOOLEAN DEFAULT FALSE,
    usage_count       INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_content_templates_org ON content_templates(organization_id);
CREATE INDEX idx_content_templates_category ON content_templates(category);
CREATE INDEX idx_content_templates_platform ON content_templates(platform);

-- ============================================================
-- CONTENT LIBRARY ITEMS (saved/cloned content)
-- ============================================================

CREATE TABLE content_library_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    post_id           UUID REFERENCES posts(id),
    post_version_id   UUID REFERENCES post_versions(id),
    name              VARCHAR(500),
    description       TEXT,
    platform          platform_type,
    tags              VARCHAR[],
    is_favorite       BOOLEAN DEFAULT FALSE,
    performance_score DECIMAL(5,2),
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_library_org ON content_library_items(organization_id);
CREATE INDEX idx_content_library_tags ON content_library_items USING GIN(tags);
CREATE INDEX idx_content_library_fav ON content_library_items(organization_id, is_favorite) WHERE is_favorite = TRUE;
```

### 4.5 AI Prompts, Generations, Brand Voices

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE ai_provider AS ENUM ('openai', 'anthropic', 'google', 'ollama', 'custom_mcp');
CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'rejected');

-- ============================================================
-- BRAND VOICES
-- ============================================================

CREATE TABLE brand_voices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    tone                VARCHAR(50) DEFAULT 'professional',
    formality_level     INTEGER DEFAULT 5 CHECK (formality_level BETWEEN 1 AND 10),
    humor_level         INTEGER DEFAULT 3 CHECK (humor_level BETWEEN 1 AND 10),
    empathy_level       INTEGER DEFAULT 5 CHECK (empathy_level BETWEEN 1 AND 10),
    energy_level        INTEGER DEFAULT 5 CHECK (energy_level BETWEEN 1 AND 10),
    personality_free    TEXT,
    target_audience     TEXT,
    audience_pain_points TEXT,
    audience_language_level VARCHAR(20) DEFAULT 'intermediate',
    cultural_considerations TEXT,
    always_use_words    TEXT[],
    never_use_words     TEXT[],
    industry_terms      TEXT[],
    regional_spelling   VARCHAR(10) DEFAULT 'en-US',
    preferred_pronouns  VARCHAR(10) DEFAULT 'they',
    sentence_length     VARCHAR(10) DEFAULT 'mixed',
    emoji_policy        VARCHAR(10) DEFAULT 'moderate',
    hashtag_policy      VARCHAR(15) DEFAULT 'branded_only',
    use_contractions    BOOLEAN DEFAULT TRUE,
    oxford_comma        BOOLEAN DEFAULT TRUE,
    first_person        BOOLEAN DEFAULT TRUE,
    primary_color       VARCHAR(7),
    secondary_color     VARCHAR(7),
    accent_color        VARCHAR(7),
    font_preferences    JSONB,
    logo_light_url      TEXT,
    logo_dark_url       TEXT,
    image_style_guide   TEXT,
    parent_voice_id     UUID REFERENCES brand_voices(id),
    context             VARCHAR(50),
    is_active           BOOLEAN DEFAULT TRUE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_brand_voices_org ON brand_voices(organization_id);
CREATE INDEX idx_brand_voices_active ON brand_voices(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE brand_voices IS 'Brand personality configuration. Enforced across all AI-generated content. Supports multi-voice variants per brand.';

-- ============================================================
-- AI PROMPT LIBRARY
-- ============================================================

CREATE TABLE ai_prompts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    category            VARCHAR(100),
    provider            ai_provider,
    model               VARCHAR(100),
    system_prompt       TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    variables           JSONB,
    temperature         DECIMAL(3,2) DEFAULT 0.7,
    max_tokens          INTEGER DEFAULT 1000,
    provider_params     JSONB,
    performance_score   DECIMAL(5,2),
    usage_count         INTEGER DEFAULT 0,
    is_public           BOOLEAN DEFAULT FALSE,
    version             INTEGER NOT NULL DEFAULT 1,
    parent_prompt_id    UUID REFERENCES ai_prompts(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_ai_prompts_org ON ai_prompts(organization_id);
CREATE INDEX idx_ai_prompts_category ON ai_prompts(category);
CREATE INDEX idx_ai_prompts_provider ON ai_prompts(provider);

-- ============================================================
-- AI GENERATION LOG (audit + billing)
-- ============================================================

CREATE TABLE ai_generations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    workspace_id        UUID NOT NULL,
    prompt_id           UUID REFERENCES ai_prompts(id),
    provider            ai_provider NOT NULL,
    model               VARCHAR(100) NOT NULL,
    system_prompt       TEXT,
    user_prompt         TEXT,
    prompt_tokens       INTEGER,
    completion_tokens    INTEGER,
    total_tokens        INTEGER,
    generated_text       TEXT,
    generated_images     JSONB,
    status              generation_status NOT NULL DEFAULT 'pending',
    error_message       TEXT,
    quality_score       DECIMAL(3,2),
    user_feedback       TEXT,
    cost_usd            DECIMAL(10,6),
    latency_ms          INTEGER,
    brand_voice_id      UUID REFERENCES brand_voices(id),
    compliance_passed    BOOLEAN,
    forbidden_word_hits  TEXT[],
    source              VARCHAR(50),
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_gen_org ON ai_generations(organization_id);
CREATE INDEX idx_ai_gen_user ON ai_generations(user_id);
CREATE INDEX idx_ai_gen_provider ON ai_generations(provider);
CREATE INDEX idx_ai_gen_created ON ai_generations(created_at);
CREATE INDEX idx_ai_gen_source ON ai_generations(source);
CREATE INDEX idx_ai_gen_prompt ON ai_generations(prompt_id);

COMMENT ON TABLE ai_generations IS 'Audit log for all AI generation requests. Used for billing, quality tracking, and debugging. Auto-archived after 30 days (standard plans) or 2 years (enterprise).';
```

### 4.6 Analytics Events and Aggregations

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE analytics_event_type AS ENUM (
    'post_published', 'post_viewed', 'post_liked', 'post_shared',
    'post_commented', 'post_saved', 'post_clicked', 'profile_viewed',
    'follower_gained', 'follower_lost', 'story_viewed', 'story_completed',
    'video_viewed', 'video_completed', 'link_clicked',
    'conversion', 'impression', 'reach'
);

-- ============================================================
-- ANALYTICS EVENTS (raw event store, partitioned)
-- ============================================================

CREATE TABLE analytics_events (
    id                BIGSERIAL,
    organization_id   UUID NOT NULL,
    social_account_id UUID NOT NULL,
    post_id           UUID,
    event_type        analytics_event_type NOT NULL,
    platform          platform_type NOT NULL,
    event_date        DATE NOT NULL,
    event_time        TIMESTAMPTZ NOT NULL,
    value             BIGINT DEFAULT 1,
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (event_date);

COMMENT ON TABLE analytics_events IS 'Raw analytics events partitioned by date. Short retention: 90 days (standard), 2 years (enterprise).';

-- Monthly partition example (managed by pg_partman or application cron)
CREATE TABLE analytics_events_2026_07 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE analytics_events_2026_08 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_analytics_events_org ON analytics_events(organization_id, event_date);
CREATE INDEX idx_analytics_events_account ON analytics_events(social_account_id, event_date);
CREATE INDEX idx_analytics_events_post ON analytics_events(post_id, event_date);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, event_date);

-- ============================================================
-- DAILY POST AGGREGATIONS
-- ============================================================

CREATE TABLE daily_post_analytics (
    post_id           UUID NOT NULL,
    social_account_id UUID NOT NULL,
    organization_id   UUID NOT NULL,
    platform          platform_type NOT NULL,
    date              DATE NOT NULL,
    impressions       BIGINT DEFAULT 0,
    reach             BIGINT DEFAULT 0,
    likes             BIGINT DEFAULT 0,
    comments          BIGINT DEFAULT 0,
    shares            BIGINT DEFAULT 0,
    saves             BIGINT DEFAULT 0,
    clicks            BIGINT DEFAULT 0,
    video_views       BIGINT DEFAULT 0,
    video_completions BIGINT DEFAULT 0,
    story_views       BIGINT DEFAULT 0,
    story_completions BIGINT DEFAULT 0,
    engagement_rate   DECIMAL(10,6),
    ctr               DECIMAL(10,6),
    engagement_total  BIGINT GENERATED ALWAYS AS (likes + comments + shares + saves) STORED,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, platform, date)
);

CREATE INDEX idx_daily_post_analytics_org ON daily_post_analytics(organization_id, date);
CREATE INDEX idx_daily_post_analytics_account ON daily_post_analytics(social_account_id, date);

COMMENT ON TABLE daily_post_analytics IS 'Daily post-level aggregated analytics. Updated by nightly cron job. Indefinite retention.';

-- ============================================================
-- ACCOUNT DAILY AGGREGATIONS
-- ============================================================

CREATE TABLE daily_account_analytics (
    social_account_id   UUID NOT NULL,
    organization_id     UUID NOT NULL,
    platform            platform_type NOT NULL,
    date                DATE NOT NULL,
    follower_count      BIGINT,
    following_count     BIGINT,
    total_posts         INTEGER,
    total_impressions   BIGINT,
    total_reach         BIGINT,
    total_engagement    BIGINT,
    engagement_rate     DECIMAL(10,6),
    followers_gained    INTEGER DEFAULT 0,
    followers_lost      INTEGER DEFAULT 0,
    net_followers       INTEGER GENERATED ALWAYS AS (followers_gained - followers_lost) STORED,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (social_account_id, date)
);

CREATE INDEX idx_daily_account_analytics_org ON daily_account_analytics(organization_id, date);

-- ============================================================
-- REVENUE ATTRIBUTION
-- ============================================================

CREATE TYPE attribution_model AS ENUM ('first_touch', 'last_touch', 'linear', 'time_decay', 'position_based');

CREATE TABLE revenue_attributions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    post_id             UUID REFERENCES posts(id),
    social_account_id   UUID REFERENCES social_accounts(id),
    revenue_usd         DECIMAL(12,2) NOT NULL,
    order_id            VARCHAR(255),
    customer_id         VARCHAR(255),
    conversion_type     VARCHAR(50),
    attribution_model   attribution_model NOT NULL DEFAULT 'last_touch',
    attribution_weight  DECIMAL(5,4) DEFAULT 1.0,
    touch_timestamp     TIMESTAMPTZ NOT NULL,
    source_system       VARCHAR(50),
    source_data         JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_attr_org ON revenue_attributions(organization_id);
CREATE INDEX idx_revenue_attr_post ON revenue_attributions(post_id);
CREATE INDEX idx_revenue_attr_date ON revenue_attributions(touch_timestamp);

-- ============================================================
-- ANALYTICS REPORTS
-- ============================================================

CREATE TABLE analytics_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by        UUID NOT NULL REFERENCES users(id),
    name              VARCHAR(255) NOT NULL,
    report_type       VARCHAR(50),
    platforms         platform_type[],
    metrics           VARCHAR[],
    date_range_start  DATE NOT NULL,
    date_range_end    DATE NOT NULL,
    group_by          VARCHAR(20) DEFAULT 'day',
    filters           JSONB,
    white_label       BOOLEAN DEFAULT FALSE,
    brand_logo_url    TEXT,
    status            VARCHAR(50) DEFAULT 'generating',
    file_url          TEXT,
    file_format       VARCHAR(10),
    ai_insights       TEXT,
    scheduled         BOOLEAN DEFAULT FALSE,
    cron_expression   VARCHAR(100),
    last_generated_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_reports_org ON analytics_reports(organization_id);
CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX idx_analytics_reports_scheduled ON analytics_reports(scheduled) WHERE scheduled = TRUE;
```

### 4.7 Workflows, Triggers, Actions, Executions

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE trigger_type AS ENUM (
    'cron', 'webhook', 'post_published', 'post_scheduled', 'post_failed',
    'post_performance_threshold', 'follower_milestone', 'new_comment',
    'mention_detected', 'trend_detected', 'engagement_spike',
    'follower_loss_threshold', 'sentiment_threshold', 'report_ready',
    'ai_content_generated', 'campaign_completed', 'brand_voice_updated',
    'external_webhook'
);

CREATE TYPE execution_status AS ENUM ('running', 'completed', 'failed', 'cancelled', 'paused');

-- ============================================================
-- WORKFLOWS
-- ============================================================

CREATE TABLE workflows (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by        UUID NOT NULL REFERENCES users(id),
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    category          VARCHAR(100),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    version           INTEGER NOT NULL DEFAULT 1,
    nodes             JSONB NOT NULL,
    edges             JSONB NOT NULL,
    canvas_position   JSONB,
    total_executions  BIGINT DEFAULT 0,
    last_executed_at  TIMESTAMPTZ,
    last_execution_status VARCHAR(50),
    error_count       BIGINT DEFAULT 0,
    is_template       BOOLEAN DEFAULT FALSE,
    template_category VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_workflows_org ON workflows(organization_id);
CREATE INDEX idx_workflows_active ON workflows(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_workflows_category ON workflows(category);

COMMENT ON TABLE workflows IS 'Workflow definitions stored as DAGs (nodes + edges as JSONB). Nodes contain type, config. Edges define execution flow.';

-- ============================================================
-- WORKFLOW TRIGGERS
-- ============================================================

CREATE TABLE workflow_triggers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_type      trigger_type NOT NULL,
    config            JSONB NOT NULL,
    node_id           VARCHAR(255) NOT NULL,
    is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX idx_workflow_triggers_type ON workflow_triggers(trigger_type);

-- ============================================================
-- WORKFLOW EXECUTIONS
-- ============================================================

CREATE TABLE workflow_executions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    triggered_by      trigger_type NOT NULL,
    trigger_data      JSONB,
    status            execution_status NOT NULL DEFAULT 'running',
    current_node_id   VARCHAR(255),
    node_results      JSONB,
    execution_context JSONB,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    duration_ms       INTEGER,
    error_message     TEXT,
    error_node_id     VARCHAR(255),
    retry_of          UUID REFERENCES workflow_executions(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_exec_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_exec_status ON workflow_executions(status);
CREATE INDEX idx_workflow_exec_started ON workflow_executions(started_at);

-- ============================================================
-- WORKFLOW EXECUTION LOGS
-- ============================================================

CREATE TABLE workflow_execution_logs (
    id                BIGSERIAL,
    execution_id      UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id           VARCHAR(255),
    log_level         VARCHAR(20) NOT NULL DEFAULT 'info',
    message           TEXT NOT NULL,
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_logs_exec ON workflow_execution_logs(execution_id);
CREATE INDEX idx_workflow_logs_created ON workflow_execution_logs(created_at);

-- ============================================================
-- WORKFLOW TEMPLATES (pre-built, community-shared)
-- ============================================================

CREATE TABLE workflow_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    category          VARCHAR(100),
    nodes             JSONB NOT NULL,
    edges             JSONB NOT NULL,
    trigger_type      trigger_type,
    trigger_config    JSONB,
    install_count     INTEGER DEFAULT 0,
    rating            DECIMAL(3,2),
    is_official       BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
```

### 4.8 MCP Connections and Registered Servers

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE mcp_server_status AS ENUM ('active', 'inactive', 'error', 'deprecated');

-- ============================================================
-- MCP SERVERS REGISTRY
-- ============================================================

CREATE TABLE mcp_servers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    display_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    endpoint_url        TEXT NOT NULL,
    connection_type     VARCHAR(50) NOT NULL DEFAULT 'rest',
    auth_type           VARCHAR(50),
    capabilities        JSONB NOT NULL,
    status              mcp_server_status NOT NULL DEFAULT 'active',
    health_check_url    TEXT,
    health_check_interval INTEGER DEFAULT 60,
    last_healthy_at     TIMESTAMPTZ,
    version             VARCHAR(50),
    provider            VARCHAR(100),
    is_official         BOOLEAN DEFAULT FALSE,
    documentation_url   TEXT,
    pricing_model       JSONB,
    requires_approval   BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_mcp_servers_name ON mcp_servers(name);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX idx_mcp_servers_capabilities ON mcp_servers USING GIN(capabilities);

COMMENT ON TABLE mcp_servers IS 'Global registry of available MCP servers. Official servers are pre-installed. Users can add custom servers.';

-- ============================================================
-- WORKSPACE MCP CONNECTIONS
-- ============================================================

CREATE TABLE workspace_mcp_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    mcp_server_id       UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    credentials         TEXT,
    encryption_key_id   VARCHAR(255),
    config              JSONB,
    rate_limit          INTEGER,
    monthly_limit       BIGINT,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    usage_count         BIGINT DEFAULT 0,
    last_used_at        TIMESTAMPTZ,
    cost_tracking       JSONB,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_workspace_mcp ON workspace_mcp_connections(organization_id, mcp_server_id);
CREATE INDEX idx_workspace_mcp_org ON workspace_mcp_connections(organization_id);

-- ============================================================
-- MCP REQUEST LOG
-- ============================================================

CREATE TABLE mcp_request_log (
    id                      BIGSERIAL,
    organization_id         UUID NOT NULL,
    mcp_server_id           UUID NOT NULL,
    workspace_connection_id UUID REFERENCES workspace_mcp_connections(id),
    request_type            VARCHAR(100),
    request_body            JSONB,
    response_status         INTEGER,
    response_time_ms        INTEGER,
    tokens_used             INTEGER,
    cost_usd                DECIMAL(10,6),
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_request_log_org ON mcp_request_log(organization_id, created_at);
CREATE INDEX idx_mcp_request_log_server ON mcp_request_log(mcp_server_id, created_at);
```

### 4.9 Campaigns

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE campaign_type AS ENUM (
    'thirty_day_plan', 'holiday', 'product_launch', 'sales_funnel',
    'brand_awareness', 'ugc_campaign', 'custom'
);

CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');

-- ============================================================
-- CAMPAIGNS
-- ============================================================

CREATE TABLE campaigns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by        UUID NOT NULL REFERENCES users(id),
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    campaign_type     campaign_type NOT NULL,
    status            campaign_status NOT NULL DEFAULT 'draft',
    goal              TEXT,
    target_audience   TEXT,
    key_messages      TEXT[],
    kpis              JSONB,
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    timezone          VARCHAR(50) DEFAULT 'UTC',
    budget_usd        DECIMAL(12,2),
    content_strategy  TEXT,
    platform_allocation JSONB,
    post_frequency    JSONB,
    total_posts       INTEGER DEFAULT 0,
    total_engagement  BIGINT DEFAULT 0,
    total_reach       BIGINT DEFAULT 0,
    total_conversions BIGINT DEFAULT 0,
    total_revenue_usd DECIMAL(14,2) DEFAULT 0,
    is_archived       BOOLEAN DEFAULT FALSE,
    ai_generated      BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_campaigns_type ON campaigns(campaign_type);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
```

### 4.10 Subscriptions, Plans, Usage, Invoices

```sql
-- ============================================================
-- SUBSCRIPTION PLANS
-- ============================================================

CREATE TABLE subscription_plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    code              VARCHAR(50) NOT NULL UNIQUE,   -- starter, creator, agency, enterprise
    description       TEXT,
    -- Pricing
    price_monthly_usd DECIMAL(10,2) NOT NULL,
    price_yearly_usd  DECIMAL(10,2),
    currency          VARCHAR(3) DEFAULT 'USD',
    -- Included units
    max_team_members  INTEGER NOT NULL DEFAULT 1,
    max_workspaces    INTEGER NOT NULL DEFAULT 1,
    max_posts_month   INTEGER,
    max_social_accounts INTEGER NOT NULL DEFAULT 3,
    ai_credits_month    INTEGER,
    media_storage_gb    INTEGER DEFAULT 5,
    analytics_retention_days INTEGER DEFAULT 90,
    -- Features
    features          JSONB NOT NULL,              -- feature access matrix
    is_active         BOOLEAN DEFAULT TRUE,
    sort_order        INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS (per organization)
-- ============================================================

CREATE TABLE subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id           UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id     VARCHAR(255),
    status            subscription_status NOT NULL DEFAULT 'incomplete',
    current_period_start   TIMESTAMPTZ NOT NULL,
    current_period_end     TIMESTAMPTZ NOT NULL,
    trial_end              TIMESTAMPTZ,
    cancel_at_period_end   BOOLEAN DEFAULT FALSE,
    cancelled_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- USAGE METERING
-- ============================================================

CREATE TYPE usage_metric AS ENUM (
    'ai_generation_tokens', 'ai_generation_images', 'ai_generation_audio_seconds',
    'posts_published', 'media_storage_bytes', 'api_requests',
    'workflow_executions', 'mcp_requests'
);

CREATE TABLE usage_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric            usage_metric NOT NULL,
    value             BIGINT NOT NULL,
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_records_org ON usage_records(organization_id, recorded_at);
CREATE INDEX idx_usage_records_metric ON usage_records(metric);

COMMENT ON TABLE usage_records IS 'Usage metering for billing. Recorded per-event or periodic batch.';

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id),
    stripe_invoice_id VARCHAR(255),
    amount_usd        DECIMAL(12,2) NOT NULL,
    currency          VARCHAR(3) DEFAULT 'USD',
    status            VARCHAR(50) NOT NULL,         -- draft, open, paid, void, uncollectible
    invoice_pdf_url   TEXT,
    period_start      TIMESTAMPTZ NOT NULL,
    period_end        TIMESTAMPTZ NOT NULL,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

### 4.11 Audit Logs

```sql
-- ============================================================
-- AUDIT LOGS (all mutations)
-- ============================================================

CREATE TABLE audit_logs (
    id                BIGSERIAL,
    organization_id   UUID NOT NULL,
    user_id           UUID,
    action            VARCHAR(100) NOT NULL,        -- post.created, post.deleted, member.invited, etc.
    entity_type       VARCHAR(50) NOT NULL,          -- post, schedule, media, user, etc.
    entity_id         UUID,
    changes           JSONB,                         -- { before: {...}, after: {...} }
    ip_address        INET,
    user_agent        TEXT,
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all data mutations. Partitioned by month. Retention: 3 years minimum.';

-- Monthly partition example
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

---

## 5. Redis Data Structures

Redis serves as the caching, queuing, rate limiting, and real-time communication layer.

### 5.1 Cache Keys

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `cache:org:{id}:settings` | String (JSON) | 5 min | Organization settings |
| `cache:user:{id}:profile` | String (JSON) | 5 min | User profile |
| `cache:brand_voice:{id}` | String (JSON) | 10 min | Brand voice config |
| `cache:calendar:{org_id}:{date_from}:{date_to}` | String (JSON) | 30 sec | Calendar data |
| `cache:analytics:post:{id}:{date_from}:{date_to}` | String (JSON) | 1 min | Analytics query cache |
| `cache:ai:gen:{prompt_hash}` | String (JSON) | 1 hr | AI generation cache |
| `cache:trends:{platform}:{location}` | String (JSON) | 15 min | Trending data |
| `cache:plan:{plan_code}` | String (JSON) | 1 hr | Plan configuration |

### 5.2 Queue Keys (BullMQ / Redis Queue)

| Key Pattern | Type | Purpose |
|---|---|---|
| `queue:publish:{platform}` | List (sorted) | Publishing queue per platform |
| `queue:workflow:execute` | List | Workflow execution queue |
| `queue:media:process` | List | Media processing queue (transcode, optimize) |
| `queue:analytics:ingest` | List | Analytics event ingestion queue |
| `queue:email:send` | List | Email sending queue |
| `queue:notification:send` | List | Push/Slack notification queue |
| `queue:ai:generate` | List | AI generation queue |
| `queue:analytics:aggregate` | List | Daily aggregation queue |
| `queue:evergreen:recycle` | List | Evergreen content recycling queue |

### 5.3 Rate Limit Keys

| Key Pattern | Type | Purpose |
|---|---|---|
| `ratelimit:{user_id}:api` | Sorted Set (sliding window) | Per-user API rate limit |
| `ratelimit:{org_id}:api` | Sorted Set | Per-org API rate limit |
| `ratelimit:{user_id}:ai` | Sorted Set | Per-user AI generation rate limit |
| `ratelimit:{ip}:anonymous` | Sorted Set | Per-IP rate limit for unauthenticated requests |
| `ratelimit:{mcp_server_id}:{org_id}` | Sorted Set | Per-workspace per-MCP rate limit |

Sliding window algorithm:
- Key: `ratelimit:{id}:{scope}`
- Member: `${request_id}:${timestamp}`
- Score: timestamp
- On each request: `ZREMRANGEBYSCORE` to remove entries older than window (e.g., 60s), `ZCARD` to count, `ZADD` to add current request
- If count > limit: reject

### 5.4 Session Keys

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `session:{session_id}` | Hash | Refresh token TTL | User session data |
| `session:user:{user_id}:active` | Set | 30 days | Active session IDs per user |
| `oauth:state:{state}` | String | 10 min | OAuth 2.0 state parameter (PKCE) |
| `oauth:nonce:{nonce}` | String | 10 min | OAuth nonce for CSRF protection |

### 5.5 Rate Limit Bucket Keys

| Key Pattern | Type | Purpose |
|---|---|---|
| `ratelimit:bucket:{platform}:{social_account_id}` | String | Token bucket for platform rate limits |
| `ratelimit:bucket:{platform}:{social_account_id}:remaining` | String | Remaining tokens |
| `ratelimit:bucket:{platform}:{social_account_id}:reset` | String | Unix timestamp of reset |

### 5.6 Pub/Sub Channels

| Channel | Payload | Purpose |
|---|---|---|
| `events:post.published` | JSON: `{post_id, platform, url, timestamp}` | Cross-service notification |
| `events:post.failed` | JSON: `{post_id, platform, error, retry_count}` | Cross-service notification |
| `events:workflow.completed` | JSON: `{workflow_id, execution_id, status}` | Cross-service notification |
| `events:analytics.threshold` | JSON: `{metric, value, threshold, org_id}` | Trigger workflow conditions |
| `events:ai.generation.completed` | JSON: `{generation_id, status}` | Notification to Content Studio |
| `ws:user:{user_id}` | JSON | WebSocket messages per user |

### 5.7 Distributed Lock Keys

| Key Pattern | TTL | Purpose |
|---|---|---|
| `lock:publish:{schedule_id}` | 5 min | Prevent double-publishing on retry |
| `lock:workflow:execution:{execution_id}` | 10 min | Prevent duplicate workflow execution |
| `lock:analytics:aggregate:{org_id}:{date}` | 30 min | Prevent duplicate daily aggregation |

---

## 6. Vector Database Schema

Using pgvector (PostgreSQL extension) for MVP, with option to migrate to Qdrant or Pinecone at scale.

### 6.1 pgvector Extension Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6.2 Content Embeddings (for similarity search)

```sql
CREATE TABLE content_embeddings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL,
    post_id           UUID REFERENCES posts(id) ON DELETE CASCADE,
    post_version_id   UUID REFERENCES post_versions(id),
    content_text      TEXT,                          -- original text for reference
    embedding         VECTOR(1536),                  -- OpenAI ada-002 or similar
    model             VARCHAR(100),                  -- which model generated this
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_embeddings ON content_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_content_embeddings_org ON content_embeddings(organization_id);

COMMENT ON TABLE content_embeddings IS 'Vector embeddings for content similarity search. Used for: "find similar posts", deduplication, content recommendations.';

-- Similarity query example:
-- SELECT post_id, 1 - (embedding <=> query_embedding) AS similarity
-- FROM content_embeddings
-- WHERE organization_id = '...'
-- ORDER BY embedding <=> query_embedding
-- LIMIT 10;
```

### 6.3 Brand Voice Embeddings

```sql
CREATE TABLE brand_voice_embeddings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_voice_id    UUID NOT NULL REFERENCES brand_voices(id) ON DELETE CASCADE,
    chunk_text        TEXT NOT NULL,                  -- chunk of brand guidelines
    chunk_type        VARCHAR(50),                    -- personality, vocabulary, style, sample
    embedding         VECTOR(1536),
    model             VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_voice_embeddings ON brand_voice_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
CREATE INDEX idx_brand_voice_embeddings_voice ON brand_voice_embeddings(brand_voice_id);

COMMENT ON TABLE brand_voice_embeddings IS 'Vector embeddings of brand voice guidelines for context injection into AI prompts.';
```

### 6.4 Trend/Topic Embeddings

```sql
CREATE TABLE trend_embeddings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL,
    topic             VARCHAR(500) NOT NULL,
    platform          platform_type,
    source            VARCHAR(50),                    -- hashtag, audio, competitor_post, news
    content_text      TEXT,
    embedding         VECTOR(1536),
    trend_score       DECIMAL(5,2),                   -- relevance score for this org
    discovered_at     TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trend_embeddings ON trend_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_trend_embeddings_org ON trend_embeddings(organization_id);

COMMENT ON TABLE trend_embeddings IS 'Vector embeddings of trending topics for relevance matching against brand content.';
```

### 6.5 Media Visual Embeddings

```sql
CREATE TABLE media_visual_embeddings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id          UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    embedding         VECTOR(512),                    -- CLIP or similar visual model
    model             VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_visual_embeddings ON media_visual_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_media_visual_embeddings_media ON media_visual_embeddings(media_id);

COMMENT ON TABLE media_visual_embeddings IS 'Visual embeddings for image similarity search ("find similar images").';
```

---

## 7. Scalability Considerations

### 7.1 Database Sharding

PostgreSQL sharding strategy by `organization_id`:

```
Shard Key: (organization_id % num_shards)  -> shard_id

Shard 0: organizations with id % 4 = 0
Shard 1: organizations with id % 4 = 1
Shard 2: organizations with id % 4 = 2
Shard 3: organizations with id % 4 = 3
```

**Sharded Tables:**
- `posts`, `post_versions`, `post_media`, `schedules`, `publish_queue`
- `analytics_events`, `daily_post_analytics`, `daily_account_analytics`
- `media_assets`
- `ai_generations`
- `audit_logs`

**Global Tables (replicated to all shards or in separate global DB):**
- `users`, `organizations`, `organization_members`, `subscription_plans`, `subscriptions`
- `mcp_servers`

**Sharding Middleware:** PostgreSQL FDW (foreign data wrappers) for cross-shard queries. Application-level shard routing via connection pooling (PgBouncer per shard).

**Cross-Shard Queries:** Avoid where possible. Analytics queries stay within org. Search queries use Elasticsearch. Calendar queries use shard-local query + aggregation.

### 7.2 Read Replicas

| Service | Read Replicas | Purpose |
|---|---|---|
| Content Service | 3 replicas | Calendar views, post listing, search |
| Analytics Service | 3 replicas | Dashboard queries, report generation |
| User/Org Service | 2 replicas | Profile loads, team listing |
| AI Service | 2 replicas | Prompt library reads, brand voice loads |

**Replication:** PostgreSQL streaming replication (synchronous for critical data, asynchronous for analytics). Lag < 1s typically.

**Read/Write Split:** Application layer routes: `SELECT` to replica, `INSERT/UPDATE/DELETE` to primary. Replica health checked every 10s. Auto-failover to primary if all replicas down.

### 7.3 CDN Strategy

| Asset Type | CDN | Cache TTL | Invalidation |
|---|---|---|---|
| Static JS/CSS | Cloudflare | 1 year (immutable content hash) | Deploy new version |
| User images (avatars) | Cloudflare | 1 day | On upload |
| Media assets (optimized) | Cloudflare | 1 year | On re-upload |
| AI-generated images | Cloudflare | 1 year | Never (immutable) |
| Analytics reports (PDF) | Cloudflare | 1 day | On re-generation |
| Public API docs | Cloudflare | 1 hour | On deploy |

**CDN Provider:** Cloudflare (global edge network, 330+ locations). CloudFront as backup.

### 7.4 Auto-Scaling

| Service | Metric | Min Replicas | Max Replicas | Cooldown |
|---|---|---|---|---|
| API Gateway | CPU > 70%, requests/sec > 5000 | 3 | 20 | 60s |
| Auth Service | CPU > 70%, latency > 500ms p95 | 2 | 10 | 60s |
| Content Service | CPU > 70%, request queue depth > 100 | 3 | 15 | 120s |
| AI Service | Queue depth > 50, latency > 5s p95 | 5 | 30 | 180s |
| Publishing Service | Queue depth per platform > 100 | 3 | 20 | 120s |
| Analytics Service | CPU > 70% | 3 | 10 | 120s |
| Media Service | CPU > 70% | 2 | 10 | 120s |
| Workflow Service | Queue depth > 50 | 2 | 15 | 120s |
| Web App (frontend) | CPU > 70% | 3 | 20 | 60s |

**Scaling Strategy:** Horizontal pod autoscaling (HPA) on Kubernetes. Predictive scaling for AI Service (peak usage patterns: mornings, afternoons, campaign launch days).

### 7.5 Caching Strategy

| Layer | Cache | Hit Ratio Target | Eviction |
|---|---|---|---|
| Browser | Service Worker cache | 30% | LRU, max 50MB |
| CDN | Cloudflare edge cache | 40% | TTL-based |
| API Gateway | Kong cache (Redis) | 20% | TTL-based |
| Application | Redis cache | 60% | TTL-based + LRU |
| Database | PostgreSQL shared buffers | 95% | LRU |

**Write-Through Cache:** All writes go to DB + invalidate/update cache. Cache-aside pattern for reads.

**Cache Invalidation:** Event-driven: `post.updated` -> invalidate `cache:calendar:{org}`, `cache:post:{id}`. Batch invalidation on bulk operations.

### 7.6 Message Queue Strategy

| Queue | Technology | Durability | Ordering |
|---|---|---|---|
| Publish Queue | Redis BullMQ | At-least-once | Per-platform FIFO (sorted by scheduled_for) |
| Analytics Events | Kafka | Exactly-once (idempotent) | Per-partition order (by post_id or account_id) |
| Workflow Triggers | Redis BullMQ | At-least-once | Not required |
| Notifications | RabbitMQ | At-least-once | Not required |
| Media Processing | Redis BullMQ | At-least-once | Not required |

**Kafka Partitioning:** `analytics` topic -> 12 partitions (by `post_id % 12`). Ensures ordered events per post.

**Dead Letter Queues:** Every queue has a DLQ. Failed messages moved to DLQ after max retries. Alert on DLQ size > threshold.

### 7.7 Performance Budgets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| API Gateway request | < 5ms | < 20ms | < 50ms |
| Auth (JWT validation) | < 2ms | < 5ms | < 10ms |
| Post CRUD | < 50ms | < 200ms | < 500ms |
| Calendar query (500 posts) | < 200ms | < 500ms | < 1s |
| Analytics query (6mo data) | < 500ms | < 2s | < 5s |
| AI text generation | < 2s | < 5s | < 10s |
| AI image generation | < 5s | < 10s | < 20s |
| Workflow execution (per node) | < 100ms | < 500ms | < 1s |
| Schedule publish (queue + exec) | < 10s | < 30s | < 60s |
| Full page load (TTFB) | < 100ms | < 300ms | < 1s |

### 7.8 Disaster Recovery

| Scenario | RTO | RPO | Strategy |
|---|---|---|---|
| Single AZ failure | < 5 min | 0 (synchronous replication) | Multi-AZ deployment |
| Region failure | < 1 hr | < 5 min | Active-passive cross-region (read replica in DR region) |
| Database corruption | < 2 hr | < 1 hr | Point-in-time recovery (PITR), hourly snapshots |
| Accidental data deletion | < 2 hr | < 5 min | Soft delete + 30-day recovery window |
| Full region disaster | < 4 hr | < 15 min | Pilot light: DNS switch to DR region, scale up replicas |

---

*End of System Architecture & Database Schema — Version 1.0*
