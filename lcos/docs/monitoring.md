# Monitoring & Observability Strategy

## Overview

LCOS employs a **three-pillar observability** strategy — metrics, logs, and traces — across all environments. The stack uses **OpenTelemetry** for instrumentation, **DataDog** for production observability, and **Grafana + Prometheus** for self-hosted/cost-sensitive deployments.

---

## Architecture

```
                    ┌─────────────────────────┐
                    │ Application (Next.js +   │
                    │ NestJS + Workers)        │
                    │ OpenTelemetry SDK        │
                    └────┬──────┬──────┬──────┘
                         │      │      │
              ┌──────────┘      │      └──────────┐
              ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ Metrics  │     │  Logs    │     │ Traces   │
        │ (OTLP)   │     │ (JSON)   │     │ (OTLP)   │
        └────┬─────┘     └────┬─────┘     └────┬─────┘
             │                │                │
             ▼                ▼                ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │Prometheus│    │ Loki /   │    │  Tempo / │
       │ / DD     │    │ DataDog  │    │  DataDog │
       └────┬─────┘    └────┬─────┘    └────┬─────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                    ┌──────────────┐
                    │   Grafana    │
                    │  / Datadog   │
                    │  Dashboards  │
                    └──────────────┘
```

---

## 1. Application Metrics

### Instrumentation

All metrics exported via OpenTelemetry with the following naming convention:

```
lcos.{service}.{metric_name}.{unit}
```

### Core Metrics

| Metric | Type | Unit | Description |
|---|---|---|---|
| `lcos.api.request.duration` | Histogram | ms | API response time (p50, p95, p99) |
| `lcos.api.request.count` | Counter | count | Total requests by endpoint, method, status |
| `lcos.api.error.count` | Counter | count | Errors by type (4xx, 5xx) |
| `lcos.api.active_connections` | Gauge | count | Active WebSocket/SSE connections |
| `lcos.db.query.duration` | Histogram | ms | Database query latency |
| `lcos.db.pool.used` | Gauge | count | Active connections in pool |
| `lcos.db.pool.waiting` | Gauge | count | Queries waiting for connection |
| `lcos.cache.hit_ratio` | Gauge | ratio | Redis cache hit rate |
| `lcos.cache.memory.used` | Gauge | bytes | Redis memory usage |
| `lcos.queue.job.duration` | Histogram | ms | Job processing time (Bull/BullMQ) |
| `lcos.queue.job.count` | Counter | count | Jobs processed by status (completed, failed) |
| `lcos.queue.job.wait_time` | Histogram | ms | How long jobs wait in queue |
| `lcos.http.client.duration` | Histogram | ms | Outbound HTTP call latency |
| `lcos.ai.inference.duration` | Histogram | ms | LLM inference time |
| `lcos.ai.token.count` | Histogram | count | Tokens used per request |

### Service-Level Objectives (SLOs)

| SLO | Target | Measurement Window |
|---|---|---|
| API availability | 99.9% | 30-day rolling |
| API response time (p95) | < 300ms | 7-day rolling |
| API error rate | < 0.1% | 7-day rolling |
| Database query time (p95) | < 50ms | 7-day rolling |
| Page load time (p95) | < 2s | 7-day rolling |

---

## 2. Business Metrics

### Dashboard: Executive Overview

| Metric | Source | Update Frequency |
|---|---|---|
| Monthly Recurring Revenue (MRR) | Stripe subscriptions | Real-time |
| Annual Run Rate (ARR) | MRR × 12 | Real-time |
| Total active orders | Orders table | 1 min |
| Order conversion rate | Analytics event | 5 min |
| Average order value (AOV) | Orders table | 1 hour |
| Customer acquisition cost (CAC) | Stripe + Ads API | Daily |
| Lifetime value (LTV) | Customer aggregate | Daily |
| Net revenue retention (NRR) | Cohort analysis | Weekly |
| Active tenants (last 7d) | Auth events | Real-time |
| Churn rate | Subscription cancellations | Monthly |

### Dashboard: Product Metrics

| Metric | Source | Update Frequency |
|---|---|---|
| Total products | Products table | Real-time |
| Low stock alerts | Inventory check | Real-time |
| Top 10 products by revenue | Orders aggregate | 1 hour |
| Inventory turnover rate | Stock movements | Daily |
| Category distribution | Products table | Daily |

### Dashboard: CRM Metrics

| Metric | Source | Update Frequency |
|---|---|---|
| Deal pipeline value (total) | Deals table | Real-time |
| Win rate | Deals (won/lost) | 1 hour |
| Average deal cycle time | Deals table | Weekly |
| Leads by source | Lead tracking events | Real-time |
| Contact growth rate | Contacts table | Daily |

---

## 3. Log Aggregation

### Structured JSON Logging

Every application log is emitted as a structured JSON object with a consistent schema.

```json
{
  "timestamp": "2026-07-21T12:34:56.789Z",
  "level": "info",
  "service": "lcos-api",
  "environment": "production",
  "trace_id": "abc123def456",
  "span_id": "ghi789jkl012",
  "tenant_id": "tnt_luxury_boutique",
  "user_id": "usr_42",
  "message": "Order created successfully",
  "metadata": {
    "order_id": "ord_789",
    "total": 2400.00,
    "currency": "USD",
    "items_count": 3
  },
  "error": null
}
```

### Log Levels

| Level | Usage | Example |
|---|---|---|
| `debug` | Development diagnostics | SQL queries, request headers |
| `info` | Normal operations | User signup, order placed |
| `warn` | Unexpected but handled | Rate limit exceeded, retry |
| `error` | Application errors | DB connection failure, 5xx |
| `fatal` | Unrecoverable | Process crash, out of memory |

### Log Retention

| Environment | Retention | Storage |
|---|---|---|
| Development | 7 days | Loki (local) |
| Staging | 30 days | Loki / DataDog |
| Production | 90 days (hot), 1 year (cold archive) | DataDog / S3 Glacier |

### Log Pipeline

```
Application → stdout (JSON) → FluentD/Vector → DataDog / Loki → Grafana
                                                        ↓
                                                   Archive (S3)
```

---

## 4. Alerting Rules & Thresholds

### PagerDuty Severity Levels

| Level | Label | Response Time | Example |
|---|---|---|---|
| P1 | Critical | 15 min | Service down, data loss |
| P2 | High | 30 min | P95 latency > 1s, error rate > 5% |
| P3 | Medium | 2 hours | P95 latency > 500ms, cache hit ratio < 80% |
| P4 | Low | Next business day | Disk > 80%, cert expires in 7 days |

### Alert Rules (DataDog/Monitor)

#### Availability & Performance

```yaml
- name: API Error Rate > 1%
  query: "avg:lcos.api.error.count{*} / avg:lcos.api.request.count{*} * 100 > 1"
  evaluation: "last_5m"
  severity: P2
  message: "API error rate is {{value}}% — investigate immediately"

- name: P95 Response Time > 500ms
  query: "p95:lcos.api.request.duration{*} > 500"
  evaluation: "last_5m"
  severity: P2

- name: Database Connection Pool Exhausted
  query: "avg:lcos.db.pool.waiting{*} > 5"
  evaluation: "last_2m"
  severity: P1
```

#### Business Alerts

```yaml
- name: Order Failure Rate Spike
  query: "avg:lcos.business.order.failed{*} / avg:lcos.business.order.total{*} * 100 > 5"
  evaluation: "last_10m"
  severity: P2

- name: Payment Provider Degraded
  query: "avg:lcos.http.client.duration{service:stripe} > 2000"
  evaluation: "last_5m"
  severity: P1

- name: Active Users Drop
  query: "avg:lcos.business.active_users{*} / avg:lcos.business.active_users{*}.rollup(7d) < 0.5"
  evaluation: "last_1h"
  severity: P3
```

#### Infrastructure

```yaml
- name: CPU > 80%
  query: "avg:system.cpu.user{*} > 80"
  evaluation: "last_10m"
  severity: P3

- name: Disk Space > 85%
  query: "avg:system.disk.pct_free{*} < 15"
  evaluation: "last_5m"
  severity: P3

- name: SSL Certificate Expiring
  query: "ssl.days_remaining{*} < 14"
  evaluation: "last_1h"
  severity: P3
```

---

## 5. Uptime Monitoring

### Synthetic Checks

| Check | Frequency | Endpoints |
|---|---|---|
| Homepage | 1 min | `GET /` |
| API health | 30s | `GET /api/health` |
| Auth flow | 5 min | `POST /api/auth/login` (test credentials) |
| Critical flow | 15 min | Complete checkout (sandbox) |
| AI Studio | 5 min | `POST /api/ai/chat` (test prompt) |

### Monitoring Provider

- **Primary**: DataDog Synthetics / Checkly
- **Secondary**: Better Uptime (public status page)
- **Status Page**: `status.lcos.app` (Better Uptime)

### Status Page Contents

- Current service status (green/yellow/red)
- Incident timeline
- Scheduled maintenance calendar
- Uptime SLA: 99.9% (30-day rolling)
- RSS feed for subscribers

---

## 6. Cost Monitoring (Per Tenant)

### Tracking Dimensions

| Dimension | Source | Granularity |
|---|---|---|
| Compute hours | Cloud provider API | Hourly |
| Database IOPS | RDS metrics | Hourly |
| Storage used | Object storage metrics | Daily |
| API calls (external) | Stripe, SendGrid, OpenAI | Per-request |
| AI token usage | OpenTelemetry | Per-request |
| File storage | S3/CDN bills | Daily |

### Cost Attribution

Each tenant's API requests carry a `tenant_id` tag that flows through all telemetry:

```
Request → Middleware extracts tenant → Tags all spans/metrics/logs
```

### Cost Dashboard (Grafana)

| Panel | Query |
|---|---|
| Total cost per tenant (MTD) | `sum(cost) by (tenant_id)` |
| Cost breakdown | `sum(cost) by (tenant_id, service)` |
| Cost trend | `rate(cost[30d]) by (tenant_id)` |
| Anomaly detection | `mad(cost) > 3 * stddev` → alert |

### Budget Alerts

| Threshold | Action |
|---|---|
| 80% of monthly budget | Email notification |
| 100% of monthly budget | Slack alert, throttle non-critical features |
| 120% of monthly budget | PagerDuty notification |
| Forecast > 100% | Proactive notification to tenant admin |

---

## 7. Tool Configuration

### DataDog

```yaml
# datadog-agent.yaml
api_key: ${DD_API_KEY}
site: datadoghq.com
tags:
  - env:production
  - service:lcos
logs_enabled: true
process_config:
  enabled: true
apm_config:
  enabled: true
  env: production
```

### Sentry (Error Tracking)

```typescript
// sentry.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
  integrations: [new Sentry.Integrations.Prisma({ client: prisma })],
  beforeSend(event) {
    // Strip sensitive PII from error reports
    delete event.user?.email;
    delete event.user?.ip_address;
    return event;
  },
});
```

### Grafana Dashboard

```json
// grafana/dashboards/lcos-overview.json
{
  "title": "LCOS Production Overview",
  "panels": [
    { "title": "API Latency (p50/p95/p99)", "type": "timeseries" },
    { "title": "Error Rate by Endpoint", "type": "barchart" },
    { "title": "Active Users (realtime)", "type": "stat" },
    { "title": "MRR & ARR", "type": "stat" },
    { "title": "Top 5 Tenants by Cost", "type": "table" },
    { "title": "Queue Backlog", "type": "timeseries" },
    { "title": "Database Performance", "type": "timeseries" },
    { "title": "Cache Hit Ratio", "type": "timeseries" }
  ]
}
```

### Health Check Endpoint

```typescript
// GET /api/health
// Response:
{
  "status": "ok",                    // "ok" | "degraded" | "down"
  "version": "1.2.3",
  "uptime": 1234567,
  "checks": {
    "database": { "status": "ok", "latency_ms": 2 },
    "redis": { "status": "ok", "latency_ms": 1 },
    "queue": { "status": "ok", "backlog": 0 },
    "ai_service": { "status": "ok", "latency_ms": 450 },
    "storage": { "status": "ok", "reachable": true }
  }
}
```

---

## 8. On-Call & Incident Management

### Rotation

| Role | Tool | Coverage |
|---|---|---|
| Primary on-call | PagerDuty | 24/7 |
| Secondary on-call | PagerDuty | Business hours escalation |
| Engineering lead | PagerDuty | P1 escalation |

### Incident Response Flow

1. **Detect**: Alert triggers in DataDog/PagerDuty
2. **Acknowledge**: Within SLO (15 min for P1)
3. **Investigate**: Link to runbook, check dashboards, query logs
4. **Mitigate**: Rollback, scale, feature flag toggle
5. **Resolve**: Confirm health, update status page
6. **Learn**: Post-mortem within 24 hours (blameless)

### Post-Mortem Template

```yaml
title: "Incident: Brief description"
date: "2026-07-21"
severity: P1
duration: "00:45:00"
summary: "What happened and impact"
root_cause: "Why it happened"
detection: "How we found out"
resolution: "How we fixed it"
action_items:
  - description: "Add monitoring for X"
    owner: "@eng-team"
    due: "2026-07-28"
```
