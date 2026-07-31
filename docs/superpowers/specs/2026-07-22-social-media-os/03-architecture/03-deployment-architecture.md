# Deployment Architecture — AI Social Media OS

**Status:** Draft v1.0  
**Last Updated:** 2026-07-22  
**Owner:** Staff Engineer  

---

## 1. Infrastructure Overview

### 1.1 Multi-Cloud Strategy

| Provider | Role | Services Used | Monthly Est. Cost |
|---|---|---|---|
| AWS (primary) | Compute, data, queues | EKS, RDS PostgreSQL, ElastiCache Redis, S3, SQS, CloudFront | $8,000–$15,000 |
| Cloudflare | Edge, DNS, CDN, DDoS | DNS, CDN, Workers, Images, DDoS protection, WAF | $500–$2,000 |
| GCP (DR) | Disaster recovery | GKE, Cloud SQL, Cloud Storage | $2,000 (standby) |
| Vercel (optional) | Frontend preview deploys | Preview deployments for staging branches | $0–$200 |

**Design Principle:** AWS is the primary compute provider. Cloudflare sits in front for edge caching, DDoS protection, and DNS. GCP serves as a warm standby for disaster recovery. The system is Kubernetes-portable (EKS ↔ GKE) with no provider lock-in at the container layer.

### 1.2 Network Topology

```
                          +-------------------+
                          |   Cloudflare      |
                          |   DNS / CDN /     |
                          |   WAF / DDoS      |
                          +--------+----------+
                                   |
                    +--------------+--------------+
                    |                             |
              +-----+------+           +----------+-------+
              |  Public    |           |  Public          |
              |  ALB       |           |  ALB             |
              |  (API)     |           |  (Frontend)      |
              +-----+------+           +----------+-------+
                    |                             |
              +-----+------+           +----------+-------+
              |  EKS       |           |  Vercel /        |
              |  Cluster   |           |  CloudFront      |
              |  (NestJS)  |           |  (Next.js)       |
              +-----+------+           +------------------+
                    |
         +----------+----------+-------+
         |          |          |
    +----+---+ +---+----+ +---+----+
    | RDS    | | Redis  | | S3     |
    | PG     | | Cluster| | Media  |
    +--------+ +--------+ +--------+
```

---

## 2. Container Architecture

### 2.1 Docker Images

| Service | Base Image | Build Context | Approx Size |
|---|---|---|---|
| `api-gateway` | `node:22-alpine` | `apps/api/` | 250 MB |
| `post-worker` | `node:22-alpine` | `apps/workers/post-worker/` | 200 MB |
| `analytics-worker` | `node:22-alpine` | `apps/workers/analytics-worker/` | 200 MB |
| `media-worker` | `node:22-alpine` + `ffmpeg`, `sharp` | `apps/workers/media-worker/` | 350 MB |
| `ai-worker` | `node:22-alpine` | `apps/workers/ai-worker/` | 200 MB |
| `notification-worker` | `node:22-alpine` | `apps/workers/notification-worker/` | 200 MB |
| `web-frontend` | `node:22-alpine` (build), `nginx:alpine` (serve) | `apps/web/` | 100 MB |

### 2.2 Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes

  api:
    build:
      context: ./apps/api
      target: development
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    volumes: [./apps/api/src:/app/src]

  worker-publish:
    build: ./apps/workers/post-worker
    depends_on: [postgres, redis]

  worker-analytics:
    build: ./apps/workers/analytics-worker
    depends_on: [postgres, redis]

  web:
    build:
      context: ./apps/web
      target: development
    ports: ["3001:3000"]
    depends_on: [api]
    volumes: [./apps/web/src:/app/src]

volumes:
  pgdata:
```

### 2.3 Multi-Stage Dockerfile (Production)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## 3. Kubernetes Cluster Design

### 3.1 Cluster Topology

```
+-------------------------------------------------------------------+
|                      EKS Cluster (us-east-1)                        |
|                                                                     |
|  +----------------+  +----------------+  +----------------+         |
|  |  System        |  |  Services      |  |  Workers       |         |
|  |  Namespace     |  |  Namespace     |  |  Namespace     |         |
|  |                |  |                |  |                |         |
|  | - cert-man.    |  | - api-gw      |  | - post-wk      |         |
|  | - ingress      |  | - web         |  | - analytics    |         |
|  | - ext-secr     |  | - graphql     |  | - media-wk     |         |
|  | - istio        |  | - websocket   |  | - ai-wk        |         |
|  | - prometheus   |  |               |  | - notif-wk     |         |
|  | - grafana      |  |               |  |                |         |
|  +----------------+  +----------------+  +----------------+         |
|                                                                     |
|  +----------------+  +----------------+  +----------------+         |
|  |  Data          |  |  Cache         |  |  Storage       |         |
|  |  Namespace     |  |  Namespace     |  |  Namespace     |         |
|  |                |  |                |  |                |         |
|  | - pg-primary   |  | - redis-cl     |  | - s3-csi       |         |
|  | - pg-replica   |  | - redis-sent   |  | - efs-csi      |         |
|  | - pg-pooler    |  |                |  |                |         |
|  +----------------+  +----------------+  +----------------+         |
+-------------------------------------------------------------------+
```

### 3.2 Node Pools

| Pool | Instance Type | Min | Max | Taints | Use Case |
|---|---|---|---|---|---|
| `services` | `m7g.large` (ARM, Graviton) | 3 | 20 | None | API, web, WebSocket |
| `workers` | `m7g.xlarge` (ARM, Graviton) | 2 | 15 | `worker=true:NoSchedule` | BullMQ workers |
| `data` | `r7g.xlarge` (ARM, high memory) | 2 | 6 | `database=true:NoSchedule` | PostgreSQL, Redis |
| `spot-services` | `m7g.large` (spot) | 0 | 30 | `spot=true:PreferNoSchedule` | Overflow, cost saving |
| `gpu-workers` | `g6.xlarge` (NVIDIA) | 0 | 4 | `gpu=true:NoSchedule` | AI inference (future) |

### 3.3 Resource Requests & Limits

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: services
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
  template:
    spec:
      containers:
      - name: api
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "1Gi"
        livenessProbe:
          httpGet: { path: /health, port: 3000 }
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:
          httpGet: { path: /ready, port: 3000 }
          periodSeconds: 5
```

### 3.4 Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: services
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 4
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 2
        periodSeconds: 120
```

### 3.5 Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-gateway-pdb
  namespace: services
spec:
  minAvailable: 3
  selector:
    matchLabels:
      app: api-gateway
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: redis-cluster-pdb
  namespace: cache
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: redis-cluster
```

---

## 4. Service Mesh

### 4.1 Istio Configuration

```yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: istio-control-plane
spec:
  profile: default
  components:
    ingressGateways:
    - name: istio-ingressgateway
      enabled: true
      k8s:
        hpaSpec:
          minReplicas: 3
          maxReplicas: 10
  meshConfig:
    accessLogFile: /dev/stdout
    enableTracing: true
    defaultConfig:
      proxyMetadata:
        ISTIO_META_DNS_CAPTURE: "true"
    outboundTrafficPolicy:
      mode: REGISTRY_ONLY
```

### 4.2 mTLS Policy

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: services
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: permissive-workers
  namespace: workers
spec:
  mtls:
    mode: PERMISSIVE
```

### 4.3 Traffic Management

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-gateway-vs
  namespace: services
spec:
  hosts:
  - api.socialos.io
  gateways:
  - istio-ingressgateway
  http:
  - match:
    - uri:
        prefix: /graphql
    route:
    - destination:
        host: api-gateway
        port: { number: 3000 }
      weight: 90
    - destination:
        host: api-gateway-canary
        port: { number: 3000 }
      weight: 10
    timeout: 30s
    retries:
      attempts: 2
      perTryTimeout: 10s
  - match:
    - uri:
        prefix: /ws
    route:
    - destination:
        host: websocket-gateway
        port: { number: 3001 }
    timeout: 0s
```

### 4.4 Observability with Istio

| Metric | Source | Destination |
|---|---|---|
| Request volume | Prometheus (Istio proxy) | Grafana dashboard |
| Request latency (p50, p95, p99) | Prometheus | Grafana + alerting |
| Error rate (4xx, 5xx) | Prometheus + Sentry | PagerDuty |
| Service graph | Kiali | Kiali UI |
| Trace spans | Tempo (via Istio tracing) | Grafana Explore |

---

## 5. Database Deployment

### 5.1 PostgreSQL High Availability (Patroni on RDS)

```
+------------------------------------------------------------------+
|              RDS Custom for PostgreSQL                             |
|                                                                    |
|  +----------------+    +----------------+                          |
|  |  Primary       |    |  Replica 1     |                          |
|  |  (us-east-1a)  |<---|  (us-east-1b)  |                          |
|  |                |    |  Read-only     |                          |
|  +-------+--------+    +-------+--------+                          |
|          |                    |                                    |
|  +-------+--------+    +-------+--------+                          |
|  |  Replica 2     |    |  Replica 3     |                          |
|  |  (us-east-1c)  |    |  (us-west-2)   |                          |
|  |  Read-only     |    |  DR standby    |                          |
|  +----------------+    +----------------+                          |
|                                                                    |
|  +----------------------------------------------------------+      |
|  |  PgBouncer (2 per AZ, transaction mode, pool: 100)        |      |
|  +----------------------------------------------------------+      |
+------------------------------------------------------------------+
```

### 5.2 Automated Backups

| Backup Type | Schedule | Retention | Storage |
|---|---|---|---|
| Full (RDS snapshot) | Daily (1 AM UTC) | 30 days | S3 (RDS managed) |
| WAL archival | Every 5 min | 7 days | S3 (WAL-G) |
| Logical (pg_dump) | Weekly (Sun 3 AM) | 90 days | S3 (separate bucket) |
| Cross-region copy | Daily | 30 days | S3 us-west-2 |

### 5.3 Read Replica Routing

```typescript
@Injectable()
export class PrismaService {
  public primary: PrismaClient;
  public replica: PrismaClient;

  constructor() {
    this.primary = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_PRIMARY } },
    });
    this.replica = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_REPLICA } },
    });
  }

  get client(): PrismaClient {
    return this.isWriteOperation() ? this.primary : this.replica;
  }

  private isWriteOperation(): boolean {
    const stack = new Error().stack;
    return /(create|update|delete|publish|transaction)/i.test(stack || "");
  }
}
```

---

## 6. Redis Deployment

### 6.1 Redis Cluster (Production)

```
+---------------------------------------------------+
|              ElastiCache for Redis                  |
|              Cluster Mode Enabled                  |
|                                                    |
|  +----------+  +----------+  +----------+          |
|  | Shard 1   |  | Shard 2   |  | Shard 3   |      |
|  | 1 primary |  | 1 primary |  | 1 primary |      |
|  | 2 replicas|  | 2 replicas|  | 2 replicas|      |
|  +----------+  +----------+  +----------+          |
|                                                    |
|  Node: cache.r7g.large, Shards: 3 (scale to 15+)   |
|  Replicas/shard: 2, Total nodes: 9                 |
+---------------------------------------------------+
```

### 6.2 Redis Use Case Separation

| Instance | Purpose | Persistence | Eviction Policy |
|---|---|---|---|
| Cluster (3 shards) | Cache, sessions, rate limiting | AOF (every sec) | `allkeys-lru` |
| Cluster (dedicated) | BullMQ queues | AOF (always) | `noeviction` |
| Standby | Distributed locks, counters | None | `volatile-ttl` |

---

## 7. CDN Strategy

### 7.1 Cloudflare Configuration

```
+----------+     +-----------+     +----------+
|  Origin  |---->| Cloudflare|---->|  Users   |
|  (EKS)   |     |  CDN      |     |  (Edge)  |
+----------+     +-----------+     +----------+
                    |
          +---------+---------+
          |                   |
    +-----+-----+       +-----+-----+
    | Cache      |       | Workers   |
    | Rules      |       | (edge     |
    |            |       |  compute) |
    +------------+       +-----------+
```

### 7.2 Cache Rules

| Path | Cache TTL | Edge TTL | Cache Key | Query String |
|---|---|---|---|---|
| `/static/*` | 365 days | 365 days | `{scheme}_{host}_{path}` | Exclude all |
| `/_next/static/*` | 1 year | 1 year | `{scheme}_{host}_{path}_{query}` | Include `v` |
| `/api/graphql` | No cache | No cache | - | - |
| `/media/images/*` | 30 days | 7 days | `{scheme}_{host}_{path}_{w}_{f}` | Include `w`, `f` |
| `/media/videos/*` | 30 days | 1 day | `{scheme}_{host}_{path}` | Exclude all |
| `/analytics/exports/*` | 1 hour | 5 min | `{scheme}_{host}_{path}` | Include `orgId` |

### 7.3 Image Optimization at Edge

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/media/images/")) {
      return fetch(request);
    }
    const width = url.searchParams.get("w") || "800";
    const format = url.searchParams.get("f") || "webp";
    const quality = url.searchParams.get("q") || "80";
    const response = await fetch(request);
    const optimized = await fetch(
      "https://" + url.hostname + "/cdn-cgi/image/width=" + width +
      ",format=" + format + ",quality=" + quality + ",onerror=redirect" +
      url.pathname
    );
    return new Response(optimized.body, {
      headers: {
        "Content-Type": "image/" + format,
        "Cache-Control": "public, max-age=2592000, immutable",
        "CDN-Cache-Control": "public, max-age=604800",
      },
    });
  },
};
```

---

## 8. DNS & SSL

### 8.1 DNS Records

| Record | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `api.socialos.io` | ALB (api-gateway) | Cloudflare |
| CNAME | `app.socialos.io` | ALB (frontend) / Vercel | Cloudflare |
| CNAME | `ws.socialos.io` | ALB (websocket) | Cloudflare |
| CNAME | `admin.socialos.io` | ALB (admin) | Cloudflare |
| CNAME | `webhooks.socialos.io` | ALB (api-gateway) | Cloudflare |

### 8.2 SSL Certificate Management (cert-manager)

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: infra@socialos.io
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - dns01:
        cloudflare:
          email: infra@socialos.io
          apiTokenSecretRef:
            name: cloudflare-api-token
            key: token
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: socialos-tls
  namespace: istio-system
spec:
  secretName: socialos-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - "*.socialos.io"
  - "socialos.io"
```

---

## 9. Environment Strategy

### 9.1 Environment Definitions

| Environment | Purpose | Infrastructure | Deploy Trigger | Access |
|---|---|---|---|---|
| `dev` | Feature development | Shared EKS, small instances | PR branch push | Engineering |
| `staging` | Pre-production, QA | Full EKS, prod-like | Merge to `main` | Eng, QA, PM |
| `production` | Live traffic | Full EKS, HA, auto-scale | Release tag (`v*.*.*`) | Users |
| `preview` | Per-branch frontend | Vercel preview | PR opened | PR author, reviewers |

### 9.2 Environment Configuration

```yaml
server:
  port: 3000
  cors:
    origins:
      - https://app.socialos.io
      - https://admin.socialos.io

database:
  pool:
    min: 10
    max: 50
  replicaPool:
    min: 20
    max: 100

redis:
  cluster:
    nodes:
      - redis-cluster-0001-001.socialos.ng.0001.use1.cache.amazonaws.com:6379
      - redis-cluster-0002-001.socialos.ng.0001.use1.cache.amazonaws.com:6379
      - redis-cluster-0003-001.socialos.ng.0001.use1.cache.amazonaws.com:6379

queue:
  concurrency:
    publish: 10
    aiGenerate: 5
    analytics: 3
    notification: 15
    webhook: 20

analytics:
  materializedViewRefresh: "0 2 * * *"
  dataRetentionDays: 90

features:
  aiGeneration: true
  workflowAutomation: true
  brandVoice: true
  campaignManagement: true
  mcpTools: true
```

---

## 10. Database Migrations

### 10.1 Prisma Migrations in CI/CD

```yaml
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - run: pnpm install --frozen-lockfile
    - name: Generate Prisma Client
      run: pnpm prisma generate
    - name: Run Migrations (staging)
      if: github.ref == 'refs/heads/main'
      run: pnpm prisma migrate deploy
      env:
        DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
    - name: Run Migrations (production)
      if: startsWith(github.ref, 'refs/tags/v')
      run: pnpm prisma migrate deploy
      env:
        DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

### 10.2 Rollback Strategy

| Scenario | Action | RTO | Data Loss |
|---|---|---|---|
| Failed forward migration | `prisma migrate resolve --rolled-back` | 5 min | None |
| Schema corruption | Restore from WAL-G point-in-time | 15 min | < 5 min |
| Accidental table drop | Restore from logical backup | 30 min | Up to 1 day |
| Full disaster | Cross-region failover + restore | 1 hour | Up to 1 day |

---

## 11. Secrets Management

### 11.1 External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: services
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
  namespace: services
spec:
  refreshInterval: "1h"
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: api-secrets
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_URL_PRIMARY
    remoteRef:
      key: socialos/production/database
      property: primaryUrl
  - secretKey: DATABASE_URL_REPLICA
    remoteRef:
      key: socialos/production/database
      property: replicaUrl
  - secretKey: REDIS_URL
    remoteRef:
      key: socialos/production/redis
      property: clusterUrl
  - secretKey: JWT_SECRET
    remoteRef:
      key: socialos/production/jwt
      property: secret
  - secretKey: STRIPE_SECRET_KEY
    remoteRef:
      key: socialos/production/stripe
      property: secretKey
  - secretKey: SENTRY_DSN
    remoteRef:
      key: socialos/production/sentry
      property: dsn
```

### 11.2 Secrets Inventory

| Secret | Location | Rotation |
|---|---|---|
| Database URLs | `socialos/{env}/database` | On credential rotation |
| JWT signing keys | `socialos/{env}/jwt` | Every 90 days |
| Social OAuth tokens | `socialos/{env}/social-oauth` | Per-platform |
| Stripe secret key | `socialos/{env}/stripe` | Every 180 days |
| Email API key | `socialos/{env}/email` | Every 180 days |
| Cloudflare API token | `socialos/{env}/cloudflare` | Every 90 days |
| Encryption keys | `socialos/{env}/encryption` | Every 365 days |

---

## 12. Backup & Disaster Recovery

### 12.1 RPO/RTO Targets

| Tier | RPO | RTO |
|---|---|---|
| Critical (DB, user data) | 5 minutes | 1 hour |
| High (queues, cache) | 1 hour | 2 hours |
| Medium (analytics, logs) | 24 hours | 4 hours |
| Low (static assets, CDN) | 7 days | 24 hours |

### 12.2 Disaster Recovery Plan

| Scenario | Detection | Response | Recovery Time |
|---|---|---|---|
| Single AZ failure | CloudWatch AZ health | K8s reschedules pods | < 2 min |
| Single region failure | Route53 health check + PagerDuty | Route53 failover to us-west-2 | < 15 min |
| Database corruption | Anomaly detection | Restore from WAL-G PITR | < 30 min |
| Accidental deletion | Audit log + user report | Restore from logical backup | < 1 hour |
| Cloud provider outage | Status page | GCP warm standby | < 2 hours |

### 12.3 Cross-Region Failover Steps

```
1. DETECT: Route53 health check fails (3 consecutive)
2. NOTIFY: PagerDuty incident triggered
3. ASSESS: CloudWatch dashboards, AWS Health Dashboard
4. DECIDE: If us-east-1 downtime > 15 min, initiate failover
5. PROMOTE: us-west-2 RDS replica to primary
6. UPDATE: EKS kubeconfig to us-west-2 cluster
7. DEPLOY: ArgoCD syncs DR manifests
8. SWITCH: Route53 DNS to us-west-2 ALB
9. VERIFY: Health checks, smoke tests
10. MONITOR: Watch for 30 min, declare resolved
```

---

## 13. Monitoring Stack

### 13.1 Stack Components

| Component | Tool | Purpose | Retention |
|---|---|---|---|
| Metrics | Prometheus + Grafana | CPU, memory, request rate, latency | 30d hot, 1y cold |
| Logs | Loki + Promtail | Structured app + audit logs | 30d hot, 1y cold |
| Traces | Tempo | Distributed tracing | 14 days |
| Errors | Sentry | Error tracking, performance | 90 days |
| Uptime | Checkly | External monitoring | 30 days |
| Alerts | Alertmanager + PagerDuty | On-call | - |

### 13.2 Key Alerts

| Alert | Metric | Threshold | Severity |
|---|---|---|---|
| API high latency | p99 duration | > 2000ms for 5 min | Critical |
| API error rate | 5xx ratio | > 1% for 5 min | Critical |
| Queue backlog | waiting jobs | > 1000 for 10 min | Warning |
| DB connections | pool usage | > 80% for 5 min | Warning |
| Replication lag | lag seconds | > 30 sec | Critical |
| Redis memory | usage | > 80% of max | Warning |
| SSL expiry | days remaining | < 30 days | Warning |

### 13.3 Grafana Dashboards

| Dashboard | Audience | Key Panels |
|---|---|---|
| Executive Overview | CTO, VP Eng | Uptime, MAU, API success rate, cost |
| Service Health | SRE, On-call | Per-service latency, error rate, CPU |
| Queue Dashboard | Backend team | Queue depth, completion rate, DLQ |
| Database Dashboard | Backend team | Connections, lag, cache hit ratio |
| Business Metrics | Product | Posts published, accounts, engagement |

---

## 14. Cost Optimization

### 14.1 Monthly Cost Estimates

| Service | Dev | Staging | Production | Total |
|---|---|---|---|---|
| EKS (compute) | $500 | $1,500 | $5,000 | $7,000 |
| RDS PostgreSQL | $200 | $500 | $2,000 | $2,700 |
| ElastiCache Redis | $100 | $300 | $1,200 | $1,600 |
| S3 + CloudFront | $50 | $100 | $500 | $650 |
| Cloudflare | $0 | $0 | $500 | $500 |
| Sentry | $0 | $0 | $200 | $200 |
| Monitoring | $0 | $0 | $500 | $500 |
| Vercel (preview) | $0 | $200 | $0 | $200 |
| **Total** | **$850** | **$2,600** | **$9,900** | **$13,350** |

### 14.2 Cost Reduction Strategies

| Strategy | Target | Est. Savings | Implementation |
|---|---|---|---|
| Spot instances | Stateless workers | 60% off | Spot node pool with `PreferNoSchedule` |
| Reserved instances (1yr) | Steady-state compute | 30% off | 1-year RIs for base nodes |
| Reserved instances (3yr) | RDS, ElastiCache | 50% off | 3-year RIs for DB, Redis |
| ARM (Graviton) | All services | 20% off x86 | `m7g` instead of `m7i` |
| Auto-scaling | Workers | Variable | HPA with aggressive scale-down |
| S3 lifecycle | Logs, backups | 50% storage | Glacier after 30 days |
| Non-prod off-hours | Dev/Staging | 40% off | k8s cronjob shutdown on weekends |

### 14.3 Reserved Instance Plan

| Resource | Type | Term | Quantity | Upfront | Monthly |
|---|---|---|---|---|---|
| EKS base | `m7g.large` | 1 year | 6 | $3,000 | $350 |
| RDS primary | `db.r7g.large` | 3 years | 2 | $4,000 | $150 |
| RDS replicas | `db.r7g.large` | 3 years | 4 | $8,000 | $300 |
| ElastiCache | `cache.r7g.large` | 3 years | 6 | $5,000 | $200 |

### 14.4 Worker Auto-Scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: publish-worker-hpa
  namespace: workers
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: publish-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: bullmq_queue_waiting
        selector:
          matchLabels:
            queue: publish
      target:
        type: AverageValue
        averageValue: 50
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 120
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60
```

---

## Appendix: Infrastructure as Code Layout

```
infra/
├── terraform/
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── modules/
│       ├── eks/
│       ├── rds/
│       ├── redis/
│       ├── s3/
│       ├── cloudflare/
│       └── iam/
├── kubernetes/
│   ├── namespaces/
│   ├── services/
│   │   ├── api-gateway/
│   │   ├── web-frontend/
│   │   ├── websocket-gateway/
│   │   └── workers/
│   ├── monitoring/
│   │   ├── prometheus/
│   │   ├── grafana/
│   │   ├── loki/
│   │   └── tempo/
│   └── istio/
├── scripts/
│   ├── wal-g-backup.sh
│   ├── dr-failover.sh
│   └── migrate.sh
└── README.md
```
