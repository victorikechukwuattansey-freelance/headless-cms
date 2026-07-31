# Backend Architecture — AI Social Media OS

**Status:** Draft v1.0  
**Last Updated:** 2026-07-22  
**Owner:** Staff Engineer  

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 22 LTS | Non-blocking I/O for high-concurrency API gateway, webhook receivers |
| Framework | NestJS 11 | Modular DI, GraphQL + REST coexistence, middleware pipeline, lifecycle hooks |
| API Layer | GraphQL (Apollo Server) + REST (Express) | GraphQL for complex dashboard queries; REST for webhooks, file uploads, OAuth callbacks |
| ORM | Prisma 6 | Type-safe queries, migrations, multi-tenant schema support, connection pooling |
| Database | PostgreSQL 16 | JSONB for flexible social post metadata, row-level security, Pub/Sub triggers |
| Cache / Pub-Sub | Redis 7 (Stack) | BullMQ queues, rate limiting, session store, distributed locks, cache-aside |
| Message Queue | BullMQ | Redis-backed, delayed jobs, rate limiter, sandboxed workers, DLQ support |
| Containerization | Docker + Docker Compose (dev) | Consistent dev, CI, prod environments |
| Orchestration | Kubernetes (EKS / GKE) | Prod deployment (see 03-deployment-architecture.md) |
| Monitoring | Prometheus + Grafana + Sentry | Metrics, structured logging, error tracking |
| CI/CD | GitHub Actions + ArgoCD | Prisma migrations, Docker build, canary deployments |

---

## 2. Module Structure

Each NestJS module follows the convention: one domain, one module, one `module.ts`. Cross-module communication uses the NestJS `@Global()` pattern only for shared infrastructure (Prisma, Redis, Config). All domain modules inject via `forwardRef` where needed.

### AuthModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `auth.controller.ts` | REST: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/mfa`, `/auth/logout` |
| Service | `auth.service.ts` | Password hashing (bcrypt), JWT signing/verification, MFA TOTP validation |
| Resolver | `auth.resolver.ts` | GraphQL: `login`, `refreshToken`, `logout` mutations for SPA clients |
| Guard | `jwt-auth.guard.ts` | Passport JWT strategy, extract token from `Authorization: Bearer` |
| Guard | `api-key.guard.ts` | API key validation for M2M integrations |
| Strategy | `jwt.strategy.ts` | Passport strategy: validate JWT payload, attach user to request |
| Strategy | `social-oauth.strategy.ts` | Passport strategy for each social platform (Google, Facebook, LinkedIn, Twitter, TikTok, Instagram, Pinterest, YouTube) |
| Module | `auth.module.ts` | Configures Passport, registers strategies, exports `AuthService` |

### UserModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `user.controller.ts` | REST: profile CRUD, avatar upload, preferences |
| Service | `user.service.ts` | User CRUD, email verification, password reset |
| Resolver | `user.resolver.ts` | GraphQL: `me`, `updateProfile`, `changePassword`, `deleteAccount` |
| Module | `user.module.ts` | Exports `UserService` to AuthModule |

### OrgModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `org.controller.ts` | REST: org CRUD, member management, roles |
| Service | `org.service.ts` | Org CRUD, role-based access control (RBAC), member invites |
| Resolver | `org.resolver.ts` | GraphQL: `organizations`, `createOrganization`, `inviteMember`, `updateRole` |
| Module | `org.module.ts` | Cross-module with BillingModule (plan limits per org) |

### WorkspaceModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `workspace.controller.ts` | REST: workspace CRUD, member assignment |
| Service | `workspace.service.ts` | Workspace hierarchy management |
| Resolver | `workspace.resolver.ts` | GraphQL: `workspaces`, `createWorkspace`, `movePost` |
| Module | `workspace.module.ts` | Child of OrgModule |

### SocialAccountModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `social-account.controller.ts` | REST: OAuth connect/disconnect, account list, profile sync |
| Service | `social-account.service.ts` | OAuth flow orchestration, token persistence, profile fetch |
| Resolver | `social-account.resolver.ts` | GraphQL: `accounts`, `connectAccount`, `disconnectAccount` |
| Adapter Factory | `platform-adapter.factory.ts` | Factory that resolves the correct platform adapter by `platform` enum |
| Module | `social-account.module.ts` | Imports all platform adapter modules |

### PostModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `post.controller.ts` | REST: CRUD, publish, schedule, bulk operations |
| Service | `post.service.ts` | Post lifecycle: draft → scheduled → queued → published → failed → archived |
| Resolver | `post.resolver.ts` | GraphQL: `posts`, `createPost`, `updatePost`, `publishPost`, `schedulePost` |
| Publisher | `post.publisher.ts` | Orchestrates cross-platform publishing via social account adapters |
| Module | `post.module.ts` | Core domain; publishes events via EventEmitter to AnalyticsModule |

### ContentModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `content.controller.ts` | REST: content library CRUD, folder management, tagging |
| Service | `content.service.ts` | Content asset management, versioning, metadata |
| Resolver | `content.resolver.ts` | GraphQL: `contentItems`, `uploadContent`, `searchLibrary` |
| Module | `content.module.ts` | Integrates with MediaModule for file processing |

### MediaModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `media.controller.ts` | REST: upload presigned URL generation, direct upload callback |
| Service | `media.service.ts` | Media pipeline orchestration (upload → scan → optimize → thumbnail → CDN) |
| Processor | `media.processor.ts` | BullMQ worker: image/video transformation, thumbnail generation |
| Module | `media.module.ts` | Emits `MediaProcessed` event for ContentModule |

### AIGenerationModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `ai-generation.controller.ts` | REST: generate, rewrite, expand, shorten, change tone |
| Service | `ai-generation.service.ts` | LLM provider abstraction (OpenAI, Anthropic, open-source via MCP), prompt templates |
| Resolver | `ai-generation.resolver.ts` | GraphQL: `generateContent`, `rewriteText`, `suggestHashtags`, `generateImagePrompt` |
| Module | `ai-generation.module.ts` | Uses MCPModule for external AI tool access |

### AnalyticsModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `analytics.controller.ts` | REST: report generation, data export (CSV, PDF) |
| Service | `analytics.service.ts` | Aggregation queries, data warehousing, trend detection |
| Resolver | `analytics.resolver.ts` | GraphQL: `dashboardMetrics`, `postAnalytics`, `audienceInsights`, `comparePeriods` |
| Worker | `analytics.worker.ts` | BullMQ worker: nightly aggregation, materialized view refresh |
| Module | `analytics.module.ts` | Reads from analytics materialized views for performance |

### EngagementModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `engagement.controller.ts` | REST: webhook receivers for platform callbacks |
| Service | `engagement.service.ts` | Ingest likes, comments, shares, saves; sentiment analysis |
| Resolver | `engagement.resolver.ts` | GraphQL: `postEngagement`, `commentStream`, `sentimentOverTime` |
| Module | `engagement.module.ts` | Listens to webhook events from SocialAccountModule |

### WorkflowModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `workflow.controller.ts` | REST: CRUD for automation workflows, trigger definitions |
| Service | `workflow.service.ts` | Workflow execution engine: trigger → condition → action chain |
| Resolver | `workflow.resolver.ts` | GraphQL: `workflows`, `createWorkflow`, `enableWorkflow`, `workflowLogs` |
| Worker | `workflow.executor.ts` | BullMQ worker: executes workflow steps, retries on failure |
| Module | `workflow.module.ts` | Trigger types: scheduled, webhook, content-published, engagement-received |

### MCPModule

| Layer | File | Purpose |
|---|---|---|
| Service | `mcp.service.ts` | MCP client: tool discovery, capability negotiation, tool invocation |
| Registry | `mcp.tool-registry.ts` | Registry of available MCP tools (image gen, video gen, research, SEO) |
| Resolver | `mcp.resolver.ts` | GraphQL: `availableTools`, `invokeMCPTool` |
| Module | `mcp.module.ts` | Exposes tools to AIGenerationModule and WorkflowModule |

### BrandVoiceModule

| Layer | File | Purpose |
|---|---|---|
| Service | `brand-voice.service.ts` | Brand voice profile CRUD, tone analysis, content scoring |
| Resolver | `brand-voice.resolver.ts` | GraphQL: `brandVoices`, `analyzeContentAlignment`, `suggestAdjustments` |
| Module | `brand-voice.module.ts` | Uses AIGenerationModule for tone analysis |

### CampaignModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `campaign.controller.ts` | REST: campaign CRUD, budget tracking, performance |
| Service | `campaign.service.ts` | Campaign lifecycle: draft → active → paused → completed |
| Resolver | `campaign.resolver.ts` | GraphQL: `campaigns`, `createCampaign`, `campaignAnalytics` |
| Module | `campaign.module.ts` | References PostModule, AnalyticsModule |

### BillingModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `billing.controller.ts` | REST: subscription CRUD, invoices, payment methods |
| Service | `billing.service.ts` | Stripe integration: checkout sessions, webhooks, usage metering |
| Resolver | `billing.resolver.ts` | GraphQL: `currentPlan`, `changePlan`, `billingHistory` |
| Guard | `plan.guard.ts` | Checks org plan limits before mutation execution |
| Module | `billing.module.ts` | Webhook endpoint for Stripe events (unauthenticated, validated via Stripe signature) |

### NotificationModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `notification.controller.ts` | REST: preferences, delivery status, dismiss |
| Service | `notification.service.ts` | Notification dispatch: in-app (SSE/WS), email (SendGrid/Mailgun), push (FCM/APNs) |
| Resolver | `notification.resolver.ts` | GraphQL subscription: `notificationReceived` |
| Worker | `notification.worker.ts` | BullMQ worker: batch email dispatch, push notification send |
| Module | `notification.module.ts` | Subscribes to domain events across modules |

### AdminModule

| Layer | File | Purpose |
|---|---|---|
| Controller | `admin.controller.ts` | REST: user management, org management, feature flags, system health |
| Service | `admin.service.ts` | Administrative operations, audit log query |
| Resolver | `admin.resolver.ts` | GraphQL: `adminUsers`, `adminOrgs`, `systemMetrics`, `featureFlags` |
| Guard | `admin.guard.ts` | Role-based: requires `admin` or `superadmin` role |
| Module | `admin.module.ts` | Protected behind admin-only SSO, IP whitelist |

### Infrastructure Modules (Shared)

| Module | Purpose |
|---|---|
| PrismaModule (`@Global()`) | Singleton PrismaService, connection management, health check |
| RedisModule (`@Global()`) | Redis client, cache manager, distributed lock service |
| ConfigModule (`@Global()`) | Env-var validation (zod), YAML config files, secrets injection |
| LoggerModule (`@Global()`) | Structured JSON logger (Pino), request ID injection, log levels |
| QueueModule (`@Global()`) | BullMQ queue registry, worker management, DLQ handler |

---

## 3. Authentication Flow

### 3.1 OAuth 2.0 Social Login

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Browser  │     │ NestJS        │     │ Social       │     │ PostgreSQL   │
│          │     │ AuthModule    │     │ Platform     │     │              │
└────┬─────┘     └──────┬────────┘     └──────┬──────┘     └──────┬───────┘
     │                  │                      │                  │
     │ GET /auth/social │                      │                  │
     │ ?platform=google │                      │                  │
     │─────────────────>│                      │                  │
     │                  │ Redirect to Google   │                  │
     │<─────────────────│  OAuth URL           │                  │
     │                  │                      │                  │
     │ User consents    │                      │                  │
     │────────────────────────────────────────>│                  │
     │                  │                      │                  │
     │ Callback         │                      │                  │
     │ /auth/callback   │                      │                  │
     │ ?code=xyz        │                      │                  │
     │<─────────────────│─────────────────────────────────────────│
     │                  │ Exchange code for    │                  │
     │                  │ access + refresh     │                  │
     │                  │──────────────────────>│                 │
     │                  │                      │                  │
     │                  │ Find or create user  │                  │
     │                  │────────────────────────────────────────>│
     │                  │                      │                  │
     │                  │ Encrypt & store      │                  │
     │                  │ social tokens        │                  │
     │                  │────────────────────────────────────────>│
     │                  │                      │                  │
     │                  │ Issue JWT + refresh  │                  │
     │<─────────────────│                      │                  │
     │ Set cookie +     │                      │                  │
     │ redirect to app  │                      │                  │
```

**Token Storage:**
- Access tokens for social platforms are encrypted at rest (AES-256-GCM) using a key derived from the tenant's org-specific encryption key.
- Refresh tokens for social platforms are stored alongside access tokens and rotated on each use.
- Tokens are validated before every platform API call; auto-refresh uses a BullMQ delayed job with a TTL equal to the token expiry minus 5 minutes.

### 3.2 JWT + Refresh Token Rotation

| Aspect | Detail |
|---|---|
| Access Token | 15-min TTL, signed RS256, payload: `{sub, orgId, roles, tenantId}` |
| Refresh Token | 7-day TTL, opaque UUID v7, stored hashed (SHA-256) in DB |
| Rotation | Each refresh invalidates the previous refresh token (rotation prevents replay) |
| Fingerprint | Client sends a device fingerprint hashed into refresh token family |
| Blacklist | Revoked tokens stored in Redis (TTL = token expiry) for immediate invalidation |

```
POST /auth/refresh
Body: { refreshToken: "opaque-uuid", fingerprint: "device-hash" }

Response: { accessToken, refreshToken: "new-opaque-uuid", expiresIn: 900 }
```

### 3.3 API Key Authentication

| Aspect | Detail |
|---|---|
| Use case | M2M integrations, webhook callers, CLI tools |
| Key format | `sk_live_` prefix + 48 chars of `crypto.randomBytes` |
| Storage | Hashed (bcrypt) in DB, prefix stored in plaintext for lookup |
| Scoping | Each API key is scoped to a specific org + workspace + permission set |
| Rate Limits | Separate rate limit tiers per API key (configurable via admin) |
| Rotation | Keys can be rotated via Admin UI; old key is blacklisted for a 24h grace period |

### 3.4 Multi-Factor Authentication (MFA)

| Method | Implementation |
|---|---|
| TOTP | Standard RFC 6238, QR code enrollment, recovery codes (10 codes, bcrypt hashed) |
| SMS | Twilio Verify API, rate-limited to 3 sends/hour per user |
| Backup Codes | 10 single-use codes generated on enrollment, hashed in DB |
| Remember Device | Signed cookie with device fingerprint, 30-day TTL |

**MFA Enrollment Flow:**
1. User enables MFA in settings
2. Backend generates TOTP secret, returns QR code URI
3. User scans with authenticator app, submits TOTP code
4. Backend verifies code, enables MFA, returns recovery codes
5. Next login requires TOTP code after password verification

**MFA Login Flow:**
1. User submits email + password
2. If MFA enabled, response includes `{ mfaRequired: true, mfaToken: "short-lived-token" }`
3. User submits `{ mfaToken, code }` to `/auth/mfa/verify`
4. On success, issues JWT + refresh token

---

## 4. Multi-Tenancy

### 4.1 Architecture Decision

**Strategy: Row-Level Tenancy (shared database, isolated via `tenantId` column)**

Rationale:
- Schema-per-tenant was rejected: operational overhead of 10,000+ schemas, migration complexity, connection pooling inefficiency
- Row-level tenancy with composite primary keys (`(tenantId, id)`) provides the best balance of isolation and operational simplicity
- PostgreSQL Row-Level Security (RLS) enforces tenant isolation at the database layer

### 4.2 Implementation

**Schema Pattern:**
```prisma
model Post {
  tenantId String   @default(dbgenerated("current_setting('app.tenant_id')::text"))
  id       String   @id @default(cuid())
  // ... fields

  @@unique([tenantId, id])
  @@index([tenantId])
}
```

**Tenant Context Middleware:**
```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const tenantId = this.extractTenantId(req);
    // Set PostgreSQL session variable for RLS
    await this.prisma.$executeRawUnsafe(
      `SELECT set_config('app.tenant_id', $1, true)`,
      tenantId
    );
    // Attach to request for application-level filtering
    req.tenantId = tenantId;
    next();
  }

  private extractTenantId(req: Request): string {
    // Priority: JWT claim > API key > header > subdomain
    return req.user?.tenantId
      ?? req.apiKey?.tenantId
      ?? req.headers['x-tenant-id']
      ?? this.extractFromSubdomain(req.hostname);
  }
}
```

**PostgreSQL RLS Policy:**
```sql
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Post"
  USING (tenantId = current_setting('app.tenant_id')::text);
```

### 4.3 Data Isolation Boundaries

| Entity | Isolation Key | Notes |
|---|---|---|
| User | `tenantId` | Users can belong to multiple orgs via `OrgMembership` |
| Org | self-isolated | Each org is itself a tenant |
| Post | `tenantId` | Cannot be shared across orgs |
| SocialAccount | `tenantId` | OAuth tokens are tenant-scoped |
| Analytics | `tenantId` | Aggregated data is per-tenant |

### 4.4 Tenant Onboarding Flow

```
1. User registers → creates Org → Org is assigned a tenantId
2. Billing plan selected → plan limits stored in Org record
3. Prisma middleware injects tenantId on all write operations
4. RLS policies prevent cross-tenant reads at the database level
5. Application-layer guards double-check tenant boundaries in GraphQL resolvers
```

---

## 5. Platform Integration Layer

### 5.1 Adapter Pattern

```typescript
// Interface every platform adapter must implement
interface SocialPlatformAdapter {
  platform: SocialPlatform; // enum: FACEBOOK | INSTAGRAM | LINKEDIN | TWITTER | TIKTOK | YOUTUBE | PINTEREST

  // Auth
  getOAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  // Profile
  getProfile(accessToken: string): Promise<PlatformProfile>;

  // Publishing
  publishPost(post: PublishRequest): Promise<PublishResult>;
  schedulePost(post: ScheduleRequest): Promise<ScheduleResult>;
  deletePost(platformPostId: string): Promise<void>;

  // Media
  uploadMedia(media: Buffer, options: MediaOptions): Promise<MediaResult>;

  // Analytics
  getPostAnalytics(platformPostId: string): Promise<PostAnalytics>;
  getAccountAnalytics(since: Date, until: Date): Promise<AccountAnalytics>;

  // Engagement
  getComments(platformPostId: string, cursor?: string): Promise<PaginatedComments>;
  replyToComment(commentId: string, message: string): Promise<CommentResult>;

  // Webhook
  verifyWebhookSignature(payload: any, signature: string): boolean;
  parseWebhookEvent(payload: any): WebhookEvent;
}
```

**Implemented Adapters:**

| Platform | Adapter Class | Rate Limit Strategy | Special Considerations |
|---|---|---|---|
| Facebook | `FacebookAdapter` | Per-page + per-app, batch graph requests | Page access tokens, IG business account linking |
| Instagram | `InstagramAdapter` | Per-account, media category tags | IG Graph API for business accounts, hashtag limitations |
| LinkedIn | `LinkedInAdapter` | Per-user, share limits | UGC vs organizational posts, article publishing |
| Twitter/X | `TwitterAdapter` | Per-endpoint, tweet limits | Thread support, poll creation, media tagging |
| TikTok | `TikTokAdapter` | Per-video, daily video cap | Video upload via URL, QR code auth, sandbox mode |
| YouTube | `YouTubeAdapter` | Per-channel, quota units | Video processing time, captions, playlist management |
| Pinterest | `PinterestAdapter` | Per-board, pin limits | Rich pins, video pins, board sections |

### 5.2 OAuth Token Refresh Strategy

```typescript
@Injectable()
export class OAuthTokenRefreshService {
  async getValidToken(accountId: string): Promise<string> {
    const account = await this.socialAccountRepo.findById(accountId);
    const adapter = this.adapterFactory.getAdapter(account.platform);

    if (this.isTokenExpiring(account.tokenExpiresAt)) {
      const newTokens = await adapter.refreshToken(account.refreshToken);
      await this.socialAccountRepo.updateTokens(accountId, {
        accessToken: this.encrypt(newTokens.accessToken),
        refreshToken: this.encrypt(newTokens.refreshToken),
        expiresAt: newTokens.expiresAt,
      });
      return newTokens.accessToken;
    }

    return this.decrypt(account.accessToken);
  }

  private isTokenExpiring(expiresAt: Date): boolean {
    // Refresh if expiring within 5 minutes
    return expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  }
}
```

### 5.3 Rate Limit Handling

```typescript
@Injectable()
export class RateLimitHandler {
  private rateLimiters = new Map<string, Bottleneck>();

  getLimiter(platform: SocialPlatform, accountId: string): Bottleneck {
    const key = `${platform}:${accountId}`;
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, new Bottleneck({
        reservoir: platformConfigs[platform].maxRequestsPerWindow,
        reservoirRefreshAmount: platformConfigs[platform].maxRequestsPerWindow,
        reservoirRefreshInterval: platformConfigs[platform].windowMs,
        maxConcurrent: platformConfigs[platform].concurrency,
      }));
    }
    return this.rateLimiters.get(key)!;
  }
}
```

### 5.4 Webhook Receivers

| Endpoint | Platform | Events Handled |
|---|---|---|
| `POST /webhooks/facebook` | Facebook | `feed.status`, `mentions`, `leadgen`, `page_engagement` |
| `POST /webhooks/instagram` | Instagram | `comments`, `mentions`, `story_insights`, `message_activity` |
| `POST /webhooks/linkedin` | LinkedIn | `share.metrics`, `organization.social.action` |
| `POST /webhooks/twitter` | Twitter/X | `tweet.create`, `tweet.delete`, `favorite`, `follow` |
| `POST /webhooks/tiktok` | TikTok | `video.status`, `comment.create`, `share` |
| `POST /webhooks/youtube` | YouTube | `video.published`, `comment.add`, `subscription` |
| `POST /webhooks/stripe` | Stripe | `invoice.paid`, `subscription.updated`, `payment_failed` |

All webhook receivers verify payload signatures before processing. Verified events are pushed to the `webhook` BullMQ queue for processing.

---

## 6. Queue Architecture

### 6.1 Queue Registry

```typescript
// queue-registry.constant.ts
export const QUEUES = {
  PUBLISH: { name: 'publish', concurrency: 10, maxRetries: 5 },
  AI_GENERATE: { name: 'ai-generate', concurrency: 5, maxRetries: 3 },
  ANALYTICS: { name: 'analytics', concurrency: 3, maxRetries: 2 },
  NOTIFICATION: { name: 'notification', concurrency: 15, maxRetries: 3 },
  WEBHOOK: { name: 'webhook', concurrency: 20, maxRetries: 5 },
  MEDIA_PROCESS: { name: 'media-process', concurrency: 4, maxRetries: 2 },
  TOKEN_REFRESH: { name: 'token-refresh', concurrency: 30, maxRetries: 3 },
  WORKFLOW: { name: 'workflow', concurrency: 8, maxRetries: 3 },
} as const;
```

### 6.2 BullMQ Configuration

```typescript
// queue.config.ts
@Module({})
export class QueueModule {
  static register(config: QueueConfig): DynamicModule {
    return {
      module: QueueModule,
      providers: [
        {
          provide: 'QUEUE_REGISTRY',
          useFactory: (redisService: RedisService) => {
            const queues = Object.values(QUEUES).map((q) => ({
              queue: new BullMQ.Queue(q.name, {
                connection: redisService.getConnection(),
                defaultJobOptions: {
                  attempts: q.maxRetries,
                  backoff: { type: 'exponential', delay: 1000 },
                  removeOnComplete: { age: 24 * 3600 }, // keep for 24h
                  removeOnFail: { age: 7 * 24 * 3600 },  // keep for 7d
                },
              }),
              worker: new BullMQ.Worker(q.name, processorFactory(q.name), {
                connection: redisService.getConnection(),
                concurrency: q.concurrency,
                limiter: { max: q.concurrency, duration: 1000 },
              }),
            }));

            return queues;
          },
          inject: [RedisService],
        },
      ],
      exports: ['QUEUE_REGISTRY'],
    };
  }
}
```

### 6.3 Job Definitions

| Queue | Job Type | Payload | Retry Strategy |
|---|---|---|---|
| `publish` | `publish-to-platform` | `{postId, accountId, scheduledAt?}` | Exponential backoff: 1m, 5m, 15m, 30m, 1h; DLQ after 5 |
| `publish` | `cross-post` | `{postId, accountIds[]}` | Retry per account independently |
| `publish` | `delete-post` | `{postId, platformPostId}` | Retry 3x, then flag for manual review |
| `ai-generate` | `generate-content` | `{prompt, tone, platform, length}` | Retry 3x (LLM throttling), rate-limited per-tier |
| `ai-generate` | `suggest-hashtags` | `{content, platform}` | Fast: 2 retries, cached results |
| `analytics` | `aggregate-daily` | `{orgId, date}` | Idempotent, retry 2x |
| `analytics` | `refresh-mv` | `{materializedViewName}` | Runs nightly at 2 AM; skip if already fresh |
| `notification` | `send-email` | `{template, to, context}` | Retry 5x for transient failures; dropped for permanent |
| `notification` | `send-push` | `{userId, title, body, data}` | Retry 3x with backoff |
| `webhook` | `process-event` | `{platform, eventType, payload}` | Retry 5x; dedup via event ID |
| `media-process` | `process-image` | `{mediaId, variants[]}` | Retry 3x; skip if source deleted |
| `media-process` | `process-video` | `{mediaId, variants[]}` | Single attempt (idempotent); long timeout (10 min) |
| `token-refresh` | `refresh-expiring` | `{accountId}` | Runs before expiry; retry daily until expiry |
| `workflow` | `execute-step` | `{workflowId, stepId, context}` | Retry 3x per step; escalate to admin after |

### 6.4 Dead Letter Queue Pattern

```typescript
@Processor('dlq-handler')
export class DeadLetterHandler {
  @Process()
  async handle(job: Job) {
    const originalQueue = job.data.queueName;
    const originalJob = job.data.jobData;
    const errorHistory = job.data.errorHistory;

    // Log to alerting system
    await this.alertService.sendAlert({
      severity: 'warning',
      title: `Job failed after all retries`,
      message: `Queue: ${originalQueue}, JobID: ${originalJob.id}`,
      metadata: { errorHistory, jobData: originalJob },
    });

    // For publish jobs: flag post as failed, notify user
    if (originalQueue === 'publish') {
      await this.postService.markAsFailed(originalJob.postId, errorHistory);
      await this.notificationService.sendInApp(originalJob.creatorId, {
        title: 'Post failed to publish',
        body: `Your post to ${originalJob.platform} failed after all retries.`,
      });
    }
  }
}
```

---

## 7. Background Jobs

### 7.1 Schedule Publisher (Cron)

```typescript
@Injectable()
export class SchedulePublisher {
  constructor(
    @InjectQueue(QUEUES.PUBLISH.name) private publishQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchScheduledPosts() {
    const duePosts = await this.postRepo.findScheduledDue({
      scheduledAt: { lte: new Date() },
      status: PostStatus.SCHEDULED,
    });

    for (const post of duePosts) {
      await this.publishQueue.add('publish-to-platform', {
        postId: post.id,
        accountIds: post.targetAccounts,
      }, {
        jobId: `publish:${post.id}`,
        timestamp: post.scheduledAt,
      });
    }
  }
}
```

### 7.2 Analytics Aggregation (Cron)

```typescript
@Injectable()
export class AnalyticsAggregator {
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateHourly() {
    const accounts = await this.accountRepo.findAllActive();
    const batch = [];

    for (const account of accounts) {
      batch.push(this.analyticsQueue.add('aggregate-hourly', {
        accountId: account.id,
        hour: moment().subtract(1, 'hour').toDate(),
      }, {
        jobId: `analytics:hourly:${account.id}:${moment().format('YYYYMMDDHH')}`,
      }));

      // Batch in groups of 50 to avoid overwhelming the queue
      if (batch.length >= 50) {
        await Promise.all(batch);
        batch.length = 0;
      }
    }
    await Promise.all(batch);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async aggregateDaily() {
    // Full daily rollup: refresh materialized views
    await this.analyticsService.refreshMaterializedViews();
  }
}
```

### 7.3 Token Refresh Job

```typescript
@Injectable()
export class TokenRefreshScheduler {
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkExpiringTokens() {
    const expiringSoon = await this.socialAccountRepo.findExpiringWithin(60); // within 60 min

    for (const account of expiringSoon) {
      await this.tokenRefreshQueue.add('refresh-expiring', {
        accountId: account.id,
      }, {
        jobId: `refresh:${account.id}`,
        delay: account.expiresAt.getTime() - Date.now() - 5 * 60 * 1000,
      });
    }
  }
}
```

### 7.4 Content Recycling (Cron)

```typescript
@Injectable()
export class ContentRecycler {
  @Cron(CronExpression.EVERY_WEEK)
  async suggestRecyclableContent() {
    // Find top-performing posts from 30-90 days ago with declining engagement
    const candidates = await this.analyticsRepo.findRecyclingCandidates({
      minAgeDays: 30,
      maxAgeDays: 90,
      minEngagementPercentile: 80,
    });

    for (const post of candidates) {
      await this.aiGenerationService.suggestRepurpose({
        originalPostId: post.id,
        suggestions: [
          { action: 'refresh_timestamp', reason: 'Update stats/context' },
          { action: 'thread_format', reason: 'Expand into thread' },
          { action: 'video_script', reason: 'Turn into short video' },
          { action: 'infographic', reason: 'Summarize key points' },
        ],
      });
    }
  }
}
```

---

## 8. Caching Strategy

### 8.1 Cache Layers

| Layer | Technology | TTL | Use Case |
|---|---|---|---|
| L1: In-Memory | Node.js `Map` with TTL | Seconds | Hot config, feature flags, tenant settings |
| L2: Redis | Redis 7 (Stack) | Minutes | API response cache, session store, rate counters |
| L3: CDN | Cloudflare / CloudFront | Variable | Static assets, media files, published content snapshots |
| L4: Browser | Cache-Control headers | Per-request | GraphQL persisted queries, static resources |

### 8.2 Cache-Aside Pattern (Default)

```typescript
@Injectable()
export class CacheService {
  constructor(@Inject('CACHE') private cache: Redis) {}

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 60_000,
  ): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const value = await fetchFn();
    await this.cache.setex(key, ttlMs / 1000, JSON.stringify(value));
    return value;
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }
}
```

### 8.3 Cache Invalidation Events

| Trigger | Invalidated Pattern | Strategy |
|---|---|---|
| Post created/updated | `post:${postId}`, `analytics:dashboard:${orgId}` | Direct key deletion |
| Post published | `post:${postId}`, `account:${accountId}:posts` | Direct + pattern |
| Social account connected | `account:${accountId}` | Direct |
| Analytics refresh | `analytics:*:${orgId}` | Pattern broadcast via Redis Pub/Sub |
| Settings changed | `config:${tenantId}:*` | Pattern |
| Workflow toggled | `workflow:${orgId}:active` | Direct |

### 8.4 Distributed Locks

```typescript
@Injectable()
export class DistributedLockService {
  constructor(@Inject('CACHE') private cache: Redis) {}

  async acquireLock(
    resource: string,
    ttlMs: number = 10_000,
    retryMs: number = 200,
    maxRetries: number = 25,
  ): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const lockValue = uuidv7();

    for (let i = 0; i < maxRetries; i++) {
      const acquired = await this.cache.set(
        lockKey, lockValue, 'PX', ttlMs, 'NX'
      );
      if (acquired) {
        // Store in local map for release
        this.activeLocks.set(lockKey, lockValue);
        return true;
      }
      await sleep(retryMs);
    }
    return false;
  }

  async releaseLock(resource: string): Promise<void> {
    const lockKey = `lock:${resource}`;
    const lockValue = this.activeLocks.get(lockKey);

    if (lockValue) {
      // Lua script: atomic check-and-release
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.cache.eval(script, 1, lockKey, lockValue);
      this.activeLocks.delete(lockKey);
    }
  }
}
```

---

## 9. File Processing Pipeline

### 9.1 Pipeline Stages

```
Client Upload
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Presigned URL Generation         │
│    - Validate file type             │
│    - Validate file size             │
│    - Rate limit check               │
│    - Return presigned S3 URL        │
└─────────────────────────────────────┘
    │ (client uploads directly to S3)
    ▼
┌─────────────────────────────────────┐
│ 2. Upload Complete Callback         │
│    - POST /media/callback           │
│    - Verify S3 object exists        │
│    - Create Media record (status:   │
│      PROCESSING)                    │
│    - Push to media-process queue    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Virus Scan (BullMQ Worker)       │
│    - ClamAV scan (clamd socket)     │
│    - Quarantine infected files      │
│    - Skip remaining stages if       │
│      infected; notify uploader      │
└─────────────────────────────────────┘
    │ (if clean)
    ▼
┌─────────────────────────────────────┐
│ 4. Optimization (BullMQ Worker)     │
│    - Images: sharp.js (resize,      │
│      compress to WebP/AVIF)         │
│    - Videos: FFmpeg (compress,      │
│      transcode to H.264/H.265)      │
│    - Documents: PDF compression     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Thumbnail Generation             │
│    - Images: 150x150, 300x300,      │
│      800x800 WebP                   │
│    - Videos: extract frame at 3s,   │
│      generate thumbnail sprites     │
│    - Documents: first page render   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. CDN Upload                       │
│    - Upload optimized variants to   │
│      CDN (Cloudflare Images /       │
│      Cloudinary / S3+CloudFront)    │
│    - Generate CDN URLs              │
│    - Update Media record with URLs  │
│    - Status: READY                  │
│    - Emit media.processed event     │
└─────────────────────────────────────┘
```

### 9.2 Supported File Types

| Category | Formats | Max Size | Processing |
|---|---|---|---|
| Images | JPG, PNG, WebP, AVIF, GIF, SVG | 20 MB | Resize, compress, thumbnail, convert to WebP/AVIF |
| Videos | MP4, MOV, AVI, WebM, MKV | 500 MB (2 GB billed) | Transcode, compress, thumbnail sprite, captions |
| Audio | MP3, WAV, AAC, OGG, FLAC | 100 MB | Transcode to MP3/AAC, waveform generation |
| Documents | PDF, DOCX, PPTX, XLSX | 50 MB | First-page thumbnail, text extraction |
| Graphics | PSD, AI, EPS, TIFF | 100 MB | Rasterize to PNG, thumbnail |

### 9.3 Video Transcoding Profiles

| Profile | Resolution | Codec | Bitrate | Use Case |
|---|---|---|---|---|
| `thumbnail` | 640x360 | H.264 | 500 Kbps | Preview in library |
| `sd` | 854x480 | H.264 | 1.5 Mbps | Quick preview |
| `hd` | 1280x720 | H.264 | 4 Mbps | Standard delivery |
| `fullhd` | 1920x1080 | H.264 | 8 Mbps | High quality |
| `optimized` | varies | H.265/HEVC | 50% of H.264 | Bandwidth saver |

---

## 10. Error Handling

### 10.1 Global Exception Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private sentryService: SentryService,
    private logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.normalizeError(exception, request);

    // Log structured error
    this.logger.error({
      message: errorResponse.message,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      userId: request.user?.id,
      path: request.url,
      method: request.method,
      statusCode: errorResponse.statusCode,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Report to Sentry (skip 4xx for non-5xx)
    if (errorResponse.statusCode >= 500) {
      this.sentryService.captureException(exception, {
        tags: { tenantId: request.tenantId, correlationId: request.correlationId },
        level: 'error',
      });
    }

    response.status(errorResponse.statusCode).json({
      statusCode: errorResponse.statusCode,
      message: errorResponse.message,
      correlationId: request.correlationId,
      // Only include details in non-production
      ...(process.env.NODE_ENV !== 'production' && {
        details: errorResponse.details,
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    });
  }

  private normalizeError(exception: unknown, request: Request): NormalizedError {
    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        message: exception.message,
        details: exception.getResponse(),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    if (exception instanceof GraphQLError) {
      return {
        statusCode: 400,
        message: exception.message,
        details: exception.extensions,
      };
    }

    // Unknown error
    return {
      statusCode: 500,
      message: 'Internal server error',
      details: undefined,
    };
  }
}
```

### 10.2 Error Categories & HTTP Status Codes

| Category | Status | Conditions |
|---|---|---|
| ValidationError | 400 | Zod schema failure, input malformed |
| AuthenticationError | 401 | Token expired, invalid, missing |
| AuthorizationError | 403 | Insufficient role/plan, cross-tenant access |
| NotFoundError | 404 | Resource not found in tenant context |
| RateLimitError | 429 | API rate limit exceeded |
| ConflictError | 409 | Duplicate publish, concurrent edit |
| PlatformError | 502 | Upstream social API failure |
| QuotaExceededError | 402 (Payment Required) | Plan limits exceeded |
| InternalError | 500 | Unhandled exceptions, infrastructure failure |

### 10.3 Structured Logging Format

```json
{
  "timestamp": "2026-07-22T14:30:00.123Z",
  "level": "error",
  "correlationId": "c7f8a2b1-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
  "tenantId": "tenant_abc123",
  "userId": "user_xyz789",
  "service": "post-service",
  "resource": "PostController.publish",
  "duration": 1523,
  "message": "Platform returned 403: insufficient permissions",
  "metadata": {
    "postId": "post_456",
    "platform": "linkedin",
    "platformError": "INSUFFICIENT_PERMISSIONS",
    "httpStatus": 502
  },
  "stack": "Error: ..."
}
```

---

## 11. Testing Strategy

### 11.1 Test Pyramid

```
        ╱╲
       ╱ e2e ╲              Few — critical user journeys
      ╱────────╲
     ╱integration╲           Some — module boundaries, DB, queue, platform
    ╱──────────────╲
   ╱    unit tests   ╲       Many — services, utils, adapters, resolvers
  ╱────────────────────╲
```

### 11.2 Unit Tests (Jest)

| Target | Runner | Pattern | Coverage Target |
|---|---|---|---|
| Services | Jest | `*.service.spec.ts` | 90%+ |
| Resolvers | Jest | `*.resolver.spec.ts` | 85%+ |
| Guards/Pipes | Jest | `*.guard.spec.ts`, `*.pipe.spec.ts` | 95%+ |
| Adapters | Jest | `*.adapter.spec.ts` | 90%+ |
| Utils/Helpers | Jest | `*.util.spec.ts` | 95%+ |

**Factory Pattern for Test Data:**

```typescript
// test/factories/post.factory.ts
export class PostFactory {
  static create(overrides: Partial<PostInput> = {}): PostInput {
    return {
      content: 'Test post content',
      platformAccounts: ['acc_1'],
      scheduledAt: null,
      mediaIds: [],
      tags: [],
      ...overrides,
    };
  }

  static createScheduled(overrides: Partial<PostInput> = {}): PostInput {
    return PostFactory.create({
      scheduledAt: moment().add(2, 'hours').toDate(),
      ...overrides,
    });
  }

  static createCrossPost(accounts: string[]): PostInput {
    return PostFactory.create({ platformAccounts: accounts });
  }
}
```

### 11.3 Integration Tests (Testcontainers)

```typescript
// test/integration/post-publish.integration-spec.ts
describe('Post Publishing (Integration)', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16')
      .withDatabase('social_os_test')
      .start();
    redis = await new RedisContainer('redis:7-alpine').start();

    const module = await Test.createTestingModule({
      imports: [
        PostModule,
        PrismaModule.register({ url: postgres.getConnectionUri() }),
        QueueModule.register({ redisUrl: redis.getRedisUri() }),
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should publish a post to a mock platform', async () => {
    const post = await postService.create(PostFactory.create());
    const result = await postService.publish(post.id);

    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(result.platformResults).toHaveLength(1);
    expect(result.platformResults[0].status).toBe('success');
  });

  afterAll(async () => {
    await app.close();
    await postgres.stop();
    await redis.stop();
  });
});
```

### 11.4 E2E Tests (Supertest)

```typescript
// test/e2e/auth.e2e-spec.ts
describe('Auth Flow (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2ETestApp();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'Str0ng!Pass' })
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'Str0ng!Pass' })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'Str0ng!Pass' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 11.5 Test Configuration

```typescript
// jest.config.ts
export default {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      modulePathIgnorePatterns: ['integration', 'e2e'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      testTimeout: 60_000,
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'],
      testTimeout: 30_000,
    },
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
```

### 11.6 Mock Platform Server (E2E Testing)

```typescript
// test/mock-platforms/mock-linkedin.server.ts
@Injectable()
export class MockLinkedInServer {
  private server: http.Server;

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        if (req.url?.includes('/oauth/accessToken')) {
          res.writeHead(200);
          res.end(JSON.stringify({
            access_token: 'mock_access_token',
            expires_in: 3600,
            refresh_token: 'mock_refresh_token',
          }));
        } else if (req.url?.includes('/rest/posts')) {
          res.writeHead(201);
          res.end(JSON.stringify({ id: 'urn:li:share:abc123' }));
        }
      }).listen(0, () => resolve((this.server.address() as AddressInfo).port));
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
```

---

## Appendix: Key Dependencies

```json
{
  "@nestjs/core": "^11.0.0",
  "@nestjs/graphql": "^13.0.0",
  "@nestjs/passport": "^11.0.0",
  "@prisma/client": "^6.0.0",
  "bullmq": "^5.0.0",
  "ioredis": "^5.4.0",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.0",
  "speakeasy": "^2.0.0",
  "sharp": "^0.33.0",
  "fluent-ffmpeg": "^2.1.0",
  "pino": "^9.0.0",
  "@sentry/node": "^8.0.0",
  "bottleneck": "^2.19.0",
  "stripe": "^16.0.0",
  "zod": "^3.23.0"
}
```
