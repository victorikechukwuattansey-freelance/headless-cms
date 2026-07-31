# Event Bus & Event-Driven Architecture

> **Version:** 1.0.0  
> **Status:** Approved  
> **Technology:** Redis Pub/Sub + PostgreSQL (event sourcing)  
> **Last Updated:** 2026-07-21  

---

## 1. Architecture Overview

LCOS uses an event-driven architecture to decouple core business logic from side effects. Events are first-class citizens — every significant domain action publishes an event that can trigger automation workflows, integration syncs, audit logs, and notifications.

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Service A  │────>│   Event Bus   │────>│   Service B      │
│  (Publisher) │     │  (Redis Pub)  │     │  (Subscriber)    │
└──────────────┘     └───────┬───────┘     └──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Event Store    │
                    │  (PostgreSQL)   │
                    │  Event Sourcing │
                    │  + Audit Trail  │
                    └─────────────────┘
```

### Core Principles

- **Eventual consistency** — subscribers process events asynchronously
- **At-least-once delivery** — events are persisted before publishing; subscribers are idempotent
- **Ordering per aggregate** — events for the same entity (e.g., a specific order) are processed in sequence
- **Schema evolution** — events are versioned to allow backward-compatible changes
- **No cross-tenant events** — events never cross tenant boundaries

---

## 2. Event Bus Implementation

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Message Broker | **Redis** (standalone stream mode) | High-throughput pub/sub, consumer groups |
| Event Store | **PostgreSQL** (`event_store` table) | Durable persistence, audit trail, replay |
| Producer SDK | `@lcos/event-bus` (TypeScript) | Typed event publishing |
| Consumer SDK | `@lcos/event-bus` (TypeScript) | Typed event subscription with auto-retry |
| Dead Letter Queue | **PostgreSQL** (`dead_letter_events` table) | Failed event storage for manual replay |

### Redis Streams vs Pub/Sub

LCOS uses **Redis Streams** (not Pub/Sub) as the primary message bus:

| Feature | Redis Pub/Sub | Redis Streams |
|---------|---------------|---------------|
| Message persistence | No (lost on disconnect) | Yes (persistent) |
| Consumer groups | No | Yes |
| Acknowledgment | Fire-and-forget | Manual ACK |
| Replay | Not possible | Possible (from stream) |
| Backpressure handling | No | Yes (pending entries list) |

### Consumer Group Architecture

Each service subscribes as a **consumer group**:

```
Stream: orders
  └─ Consumer Group: "notifications"
       ├─ consumer-1 (instance 1)
       ├─ consumer-2 (instance 2)
       └─ consumer-3 (instance 3)
```

- Each event is delivered to exactly one consumer in the group (round-robin)
- Consumers must ACK after processing (prevents data loss on crash)
- Unprocessed events appear in the Pending Entries List (PEL) and are re-delivered after a timeout

---

## 3. Event Types Catalog

### Domain Events

#### Auth Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `auth.user.registered` | New user signs up | `{ userId, tenantId, email, role }` |
| `auth.user.logged_in` | Successful login | `{ userId, tenantId, ip, userAgent }` |
| `auth.user.logged_out` | Logout | `{ userId, sessionId }` |
| `auth.user.password_changed` | Password reset | `{ userId, initiatedBy }` |
| `auth.user.mfa_enrolled` | MFA setup | `{ userId, method }` |
| `auth.user.role_changed` | Role update | `{ userId, previousRole, newRole, changedBy }` |

#### Products Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `product.created` | New product added | `{ productId, tenantId, sku, categoryId }` |
| `product.updated` | Product details changed | `{ productId, changedFields[] }` |
| `product.archived` | Product soft-deleted | `{ productId, reason? }` |
| `product.status_changed` | Status transition | `{ productId, from, to }` |
| `product.media.added` | Image/video attached | `{ productId, mediaId, mediaType }` |

#### Inventory Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `inventory.stock_adjusted` | Manual stock change | `{ productId, variantId, warehouseId, delta, reason, reference }` |
| `inventory.stock_transferred` | Warehouse transfer | `{ productId, variantId, fromWarehouse, toWarehouse, quantity }` |
| `inventory.stock_low` | Low stock threshold crossed | `{ productId, variantId, currentStock, threshold }` |
| `inventory.stock_out` | Stock reaches zero | `{ productId, variantId }` |
| `inventory.cycle_count_started` | Count initiated | `{ countId, warehouseId, zone }` |
| `inventory.cycle_count_completed` | Count finished | `{ countId, discrepancies[] }` |

#### CRM Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `crm.customer.created` | New customer record | `{ customerId, tenantId, email, tier }` |
| `crm.customer.updated` | Customer info changed | `{ customerId, changedFields[] }` |
| `crm.customer.tier_changed` | Loyalty tier change | `{ customerId, previousTier, newTier, reason }` |
| `crm.customer.tagged` | Tag added | `{ customerId, tag }` |
| `crm.interaction.logged` | Interaction recorded | `{ customerId, type, channel, outcome }` |
| `crm.ticket.created` | Support ticket opened | `{ ticketId, customerId, priority, category }` |
| `crm.ticket.resolved` | Ticket closed | `{ ticketId, resolution }` |

#### Sales Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `sales.order.created` | New order placed | `{ orderId, customerId, total, currency, itemCount }` |
| `sales.order.confirmed` | Order confirmed | `{ orderId }` |
| `sales.order.shipped` | Order fulfilled | `{ orderId, fulfillmentId, trackingNumber }` |
| `sales.order.delivered` | Customer received | `{ orderId, signedBy? }` |
| `sales.order.cancelled` | Order canceled | `{ orderId, reason, refundAmount? }` |
| `sales.order.return_requested` | RMA initiated | `{ orderId, reason, items[] }` |
| `sales.payment.received` | Payment captured | `{ paymentId, orderId, amount, method }` |
| `sales.payment.failed` | Payment declined | `{ paymentId, orderId, reason, gatewayResponse }` |
| `sales.payment.refunded` | Refund issued | `{ paymentId, amount, reason }` |
| `sales.quote.created` | New quote | `{ quoteId, customerId, total, validUntil }` |
| `sales.quote.converted` | Quote → Order | `{ quoteId, orderId }` |
| `sales.fulfillment.scheduled` | Delivery scheduled | `{ fulfillmentId, orderId, scheduledDate, method }` |

#### Marketing Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `marketing.campaign.started` | Campaign launched | `{ campaignId, name, channel, segments[] }` |
| `marketing.campaign.completed` | Campaign ended | `{ campaignId, metrics }` |
| `marketing.email.sent` | Email dispatched | `{ campaignId?, customerId, templateId }` |
| `marketing.email.opened` | Email opened | `{ trackingId, customerId, campaignId? }` |
| `marketing.email.clicked` | Link clicked | `{ trackingId, url }` |
| `marketing.whatsapp.sent` | WhatsApp sent | `{ customerId, templateId }` |
| `marketing.whatsapp.delivered` | WhatsApp delivered | `{ messageId, status }` |

#### Automation Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `automation.workflow.triggered` | Workflow started | `{ workflowId, executionId, triggerEvent }` |
| `automation.workflow.completed` | Workflow finished | `{ executionId, actionsCompleted, actionsFailed }` |
| `automation.workflow.failed` | Workflow error | `{ executionId, errorMessage }` |
| `automation.action.executed` | Single action done | `{ executionId, actionType, status, duration }` |

#### Suppliers Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `supplier.purchase_order.created` | PO issued | `{ poId, supplierId, total, expectedDelivery }` |
| `supplier.purchase_order.received` | PO received | `{ poId, itemsAccepted, itemsRejected }` |
| `supplier.performance.updated` | Metrics recalculated | `{ supplierId, newMetrics }` |

#### AI Studio Domain

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `ai.generation.completed` | AI content generated | `{ generationId, model, tokensUsed, cost }` |
| `ai.recommendations.served` | Recommendations shown | `{ customerId, products[], context }` |
| `ai.credit_threshold_reached` | Plan AI credit warning | `{ tenantId, used, limit, threshold }` |

#### System Events

| Event | Trigger | Payload Summary |
|-------|---------|-----------------|
| `tenant.plan.changed` | Plan upgrade/downgrade | `{ tenantId, previousPlan, newPlan }` |
| `tenant.status.changed` | Suspended/active | `{ tenantId, status }` |
| `integration.status.changed` | Integration connected/disconnected | `{ integrationId, provider, status }` |
| `integration.sync.failed` | Data sync error | `{ integrationId, provider, errorCode, retryCount }` |
| `system.health.threshold` | System metric alert | `{ metric, value, threshold }` |

---

## 4. Event Payload Schemas

### Envelope Format

Every event follows a consistent envelope:

```typescript
interface EventEnvelope {
  /** Unique event ID (ULID for global sortability) */
  id: string;

  /** Event type in {domain}.{entity}.{action} format */
  type: string;

  /** Schema version for backward compatibility */
  version: number;

  /** Source service that published the event */
  source: string;

  /** Tenant context (never null — system events use a sentinel) */
  tenantId: string;

  /** Aggregate identifier for ordering guarantees */
  aggregateId: string;

  /** Correlation ID for tracing across services */
  correlationId: string;

  /** Causation ID — the parent event that caused this one */
  causationId: string | null;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Event-specific payload */
  data: Record<string, unknown>;

  /** Metadata for routing, debugging */
  metadata: {
    /** Publisher instance ID */
    publisherId: string;
    /** Encoding of the data field */
    encoding: 'json' | 'compressed-json';
    /** Number of delivery attempts */
    deliveryAttempt: number;
  };
}
```

### Example Event

```json
{
  "id": "01J7XYZ123456789ABCDEFGHIJK",
  "type": "sales.order.created",
  "version": 1,
  "source": "orders-service",
  "tenantId": "tnt_001",
  "aggregateId": "ORD-20260721-0042",
  "correlationId": "corr_abc123",
  "causationId": null,
  "timestamp": "2026-07-21T10:00:00.000Z",
  "data": {
    "orderId": "ORD-20260721-0042",
    "customerId": "cst_001",
    "status": "pending",
    "items": [
      { "productId": "prd_001", "variantId": "var_001", "quantity": 1, "unitPrice": 12500 }
    ],
    "total": { "amount": 15000, "currency": "USD" },
    "paymentMethod": "wire_transfer"
  },
  "metadata": {
    "publisherId": "orders-service-pod-3",
    "encoding": "json",
    "deliveryAttempt": 1
  }
}
```

---

## 5. Pub/Sub Implementation

### Publishing an Event

```typescript
// Service layer publishes after successful business logic
async function createOrder(input: CreateOrderInput): Promise<Order> {
  const order = await db.transaction(async (tx) => {
    // 1. Business logic
    const order = await orderRepository.create(tx, input);

    // 2. Deduct inventory
    await inventoryRepository.deduct(tx, order.items);

    // 3. Persist event to event_store (same transaction!)
    await eventStore.persist(tx, {
      type: 'sales.order.created',
      aggregateId: order.id,
      tenantId: order.tenantId,
      data: serializeOrderEvent(order),
    });

    return order;
  });

  // 4. Publish to Redis stream (after transaction commits)
  await eventBus.publish({
    type: 'sales.order.created',
    aggregateId: order.id,
    tenantId: order.tenantId,
    data: serializeOrderEvent(order),
  });

  return order;
}
```

### Subscribing to Events

```typescript
// notifications-service/index.ts
import { createConsumer } from '@lcos/event-bus';

const consumer = createConsumer({
  stream: 'orders',
  group: 'notifications',
  consumer: `notifications-${process.env.POD_NAME}`,
});

consumer.on('sales.order.created', async (event) => {
  await sendOrderConfirmationEmail(event.data.customerId, event.data.orderId);
});

consumer.on('sales.fulfillment.scheduled', async (event) => {
  await sendShippingNotification(event.data.customerId, event.data);
});

consumer.start();
```

### Consumer Implementation Details

```typescript
class RedisStreamConsumer {
  private pendingRetry: Map<string, number> = new Map();

  async process(): Promise<void> {
    while (true) {
      // Read new messages from the stream
      const messages = await this.redis.xreadgroup(
        'GROUP', this.group, this.consumer,
        'BLOCK', 2000,    // Block for 2 seconds
        'COUNT', 10,      // Max 10 messages at a time
        'STREAMS', this.stream, '>'
      );

      if (!messages) continue;

      for (const message of messages) {
        const event = this.deserialize(message);

        try {
          await this.handler(event);
          await this.redis.xack(this.stream, this.group, message.id);
          this.pendingRetry.delete(message.id);
        } catch (error) {
          await this.handleFailure(event, message, error);
        }
      }
    }
  }

  private async handleFailure(event, message, error): Promise<void> {
    const attempts = (this.pendingRetry.get(message.id) || 0) + 1;

    if (attempts <= 3) {
      // Re-deliver: don't ACK, message stays in PEL
      // Redis will re-deliver after CLAIM timeout (5 min)
      this.pendingRetry.set(message.id, attempts);
      logger.warn(`Event ${event.id} failed, will retry (${attempts}/3)`, error);
    } else {
      // Move to dead letter queue
      await deadLetterQueue.send(event, error.message);
      await this.redis.xack(this.stream, this.group, message.id);
      this.pendingRetry.delete(message.id);
    }
  }
}
```

---

## 6. Integration with Automation Engine

The automation engine subscribes to domain events and evaluates workflow triggers:

```typescript
// automation-engine/index.ts
const workflowEngine = new WorkflowEngine();

// Subscribe to ALL domain events
eventBus.onAny(async (event) => {
  const workflows = await workflowRepository.findByTrigger(event.type);

  for (const workflow of workflows) {
    // 1. Check workflow is enabled
    if (!workflow.enabled) continue;

    // 2. Evaluate filters
    const context = await buildEventContext(event);
    if (!evaluateFilters(workflow.trigger.filters, context)) continue;

    // 3. Apply delay if configured
    if (workflow.trigger.delay) {
      await delayedExecutionQueue.enqueue({
        workflow,
        event,
        executeAt: Date.now() + workflow.trigger.delay.value * ms(workflow.trigger.delay.unit),
      });
      continue;
    }

    // 4. Execute immediately
    await workflowEngine.execute(workflow, event, context);
  }
});
```

This enables workflows like:

- **"Order placed → Send WhatsApp to customer"** (subscribes to `sales.order.created`)
- **"Low stock → Create purchase order"** (subscribes to `inventory.stock_low`)
- **"VIP customer abandoned cart → Notify sales associate"** (subscribes to `cart.abandoned`)

---

## 7. Event Sourcing for Audit

### Event Store Table

```sql
CREATE TABLE event_store (
  id            TEXT PRIMARY KEY,             -- ULID
  type          VARCHAR(150) NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  source        VARCHAR(100) NOT NULL,
  tenant_id     UUID NOT NULL,
  aggregate_id  VARCHAR(100) NOT NULL,
  correlation_id VARCHAR(100),
  causation_id  TEXT,                         -- references event_store.id
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data          JSONB NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',

  -- Indexes for query performance
  CONSTRAINT fk_causation FOREIGN KEY (causation_id) REFERENCES event_store(id)
);

CREATE INDEX idx_events_tenant_time ON event_store(tenant_id, timestamp DESC);
CREATE INDEX idx_events_aggregate ON event_store(tenant_id, aggregate_id, timestamp);
CREATE INDEX idx_events_type_time ON event_store(type, timestamp DESC);
CREATE INDEX idx_events_correlation ON event_store(correlation_id);
```

### Audit Trail Queries

```sql
-- Full timeline for a specific order
SELECT * FROM event_store
WHERE tenant_id = 'tnt_001'
  AND aggregate_id = 'ORD-20260721-0042'
ORDER BY timestamp ASC;

-- All events of a specific type in a time range
SELECT * FROM event_store
WHERE type = 'inventory.stock_low'
  AND tenant_id = 'tnt_001'
  AND timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

-- Traverse causality chain
WITH RECURSIVE chain AS (
  SELECT * FROM event_store WHERE id = 'event_xyz'
  UNION ALL
  SELECT es.* FROM event_store es
  JOIN chain ON es.id = chain.causation_id
)
SELECT * FROM chain ORDER BY timestamp ASC;
```

### Retention Policy

| Tier | Retention | Archival |
|------|-----------|----------|
| Online | 90 days | Hot storage (PostgreSQL) |
| Warm | 1 year | Compressed JSON in S3 (Parquet) |
| Cold | 7 years | Encrypted backup archive |

---

## 8. Dead Letter Queue Strategy

### Dead Letter Table

```sql
CREATE TABLE dead_letter_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id TEXT NOT NULL,
  event_type      VARCHAR(150) NOT NULL,
  tenant_id       UUID NOT NULL,
  payload         JSONB NOT NULL,
  error_message   TEXT NOT NULL,
  error_stack     TEXT,
  failed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count     INTEGER NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'unresolved',
    -- 'unresolved', 'resolved', 'replayed', 'ignored'
  resolved_at     TIMESTAMPTZ,
  resolved_by     VARCHAR(100)
);
```

### DLQ Processing

1. **Alerting** — When an event enters the DLQ, a notification is sent to the engineering channel
2. **Manual resolution** — Operations team investigates via admin dashboard
3. **Replay** — After fixing the issue, an admin can replay the event: the DLQ re-publishes it to the original stream
4. **Auto-retry escalation** — After 3 failed attempts, the system increments `retry_count` and sends to DLQ automatically
5. **TTL** — Unresolved events older than 30 days are auto-archived

### Admin DLQ Dashboard

```http
GET /admin/dead-letter-events
?status=unresolved
&eventType=sales.order.created
&fromDate=2026-07-01
```

```http
POST /admin/dead-letter-events/:id/replay
{ "publishTo": "orders" }
```

---

## 9. Event Ordering Guarantees

| Scope | Ordering Guarantee | Mechanism |
|-------|--------------------|-----------|
| Same aggregate | Strict FIFO | Events published to same Redis stream shard by `aggregateId` |
| Different aggregates | No ordering | Published to different stream shards |
| Cross-domain | No ordering | Different streams per domain |

Stream sharding:

```
Stream: orders
  ├─ Shard 0: aggregateId hash ends in 0-3
  ├─ Shard 1: aggregateId hash ends in 4-7
  └─ Shard 2: aggregateId hash ends in 8-9 + letters
```

---

## 10. Event Bus Configuration

```typescript
// event-bus.config.ts
export const eventBusConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
  },
  streams: {
    auth:         { maxLen: 100_000, consumerGroups: ['notifications', 'audit', 'automation'] },
    products:     { maxLen: 500_000, consumerGroups: ['search-index', 'cache', 'automation'] },
    inventory:    { maxLen: 200_000, consumerGroups: ['notifications', 'automation'] },
    crm:          { maxLen: 500_000, consumerGroups: ['notifications', 'analytics', 'automation'] },
    sales:        { maxLen: 500_000, consumerGroups: ['notifications', 'analytics', 'inventory', 'automation'] },
    marketing:    { maxLen: 200_000, consumerGroups: ['analytics', 'automation'] },
    automation:   { maxLen: 100_000, consumerGroups: ['audit'] },
    suppliers:    { maxLen: 100_000, consumerGroups: ['notifications', 'automation'] },
    ai:           { maxLen: 100_000, consumerGroups: ['billing', 'analytics'] },
    system:       { maxLen: 50_000,  consumerGroups: ['monitoring', 'audit'] },
  },
  deadLetter: {
    maxRetries: 3,
    retryDelayMs: 5_000,      // initial delay (exponential backoff: *2 each attempt)
    claimTimeoutMs: 300_000,  // 5 min — PEL auto-claim timeout
  },
};
```

---

## 11. Monitoring & Observability

| Metric | Description | Tool |
|--------|-------------|------|
| Events published/min | Publishing rate per stream | Prometheus counter |
| Events consumed/min | Processing rate per consumer group | Prometheus counter |
| Consumer lag | Unprocessed event count per group | Redis `xlen - xpending` |
| Processing latency | Time from publish to ACK | Prometheus histogram |
| DLQ size | Unresolved dead letter count | Custom metric |
| Retry rate | Percentage of events requiring retry | Prometheus counter |
| Error rate | Percentage of events going to DLQ | Prometheus counter |

### Tracing

- Every event carries `correlationId` and `causationId`
- OpenTelemetry spans are created for publish → consume → process
- Traces visible in Jaeger / Grafana Tempo
