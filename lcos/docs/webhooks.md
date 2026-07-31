# Webhooks System Design

## Overview

LCOS provides a comprehensive webhook system that pushes real-time events to external endpoints. The system supports 50+ events across all platform modules with reliable delivery, retry logic, and security features.

---

## 1. Architecture

The webhook engine captures internal events, transforms them into standardized payloads, enqueues them for delivery, and dispatches them to configured external endpoints with retry logic.

### Delivery Pipeline

Event occurs -> Transform payload -> Enqueue -> Rate limit check -> HTTP POST -> Log result

### Components

| Component | Technology | Responsibility |
|---|---|---|
| Event Emitter | NestJS EventEmitter2 | Captures internal domain events |
| Webhook Engine | Custom service | Matches events to endpoints, transforms payloads |
| Delivery Queue | BullMQ (Redis) | Queues deliveries with retry scheduling |
| Rate Limiter | Redis-based token bucket | Enforces per-endpoint rate limits |
| HTTP Dispatcher | Axios with retry | Sends HTTP POST, handles responses |
| Dead Letter Queue | BullMQ (separate queue) | Stores failed deliveries after retry exhaustion |

---

## 2. Event Catalog

### Products (10 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| product.created | New product added | Full product object |
| product.updated | Product details changed | Product + diff of changes |
| product.deleted | Product removed | Product ID, name |
| product.published | Product made visible | Product with publish info |
| product.unpublished | Product hidden | Product ID |
| product.price_changed | Price modified | Old price, new price, currency |
| product.stock_changed | Stock level updated | SKU, old_qty, new_qty, reason |
| product.variant.created | New variant added | Variant details |
| product.variant.updated | Variant modified | Variant + diff |
| product.variant.deleted | Variant removed | Variant ID, SKU |

### Orders (12 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| order.created | New order placed | Full order object |
| order.updated | Order details changed | Order + diff |
| order.status_changed | Order status transition | From status, to status |
| order.payment_received | Payment confirmed | Amount, method, transaction ID |
| order.payment_failed | Payment declined | Error code, message, attempt count |
| order.shipped | Order dispatched | Tracking number, carrier, items |
| order.delivered | Order delivered | Confirmation, timestamp |
| order.cancelled | Order cancelled | Reason, cancelled_by |
| order.refunded | Refund processed | Amount, reason, refund_id |
| order.refund_partial | Partial refund | Amount, remaining, reason |
| order.note_added | Internal note added | Note content, author |
| order.hold_changed | Order hold status | Held, reason, released_by |

### CRM (10 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| contact.created | New contact added | Full contact object |
| contact.updated | Contact modified | Contact + diff |
| contact.deleted | Contact removed | Contact ID, name |
| contact.merged | Duplicates merged | Primary ID, merged IDs |
| deal.created | New deal created | Full deal object |
| deal.updated | Deal details changed | Deal + diff |
| deal.stage_changed | Deal moved between stages | From stage, to stage, pipeline |
| deal.won | Deal marked as won | Deal value, close date |
| deal.lost | Deal marked as lost | Reason, competitor (if any) |
| company.created | New company added | Full company object |

### Customers (6 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| customer.created | Customer registered | Customer profile |
| customer.updated | Profile updated | Customer + diff |
| customer.deleted | GDPR deletion | Customer ID (anonymized) |
| customer.segment_changed | Segment assignment | Old segments, new segments |
| customer.tier_changed | Loyalty tier change | Old tier, new tier |
| customer.opt_in_changed | Marketing consent | Channel, opted_in flag |

### Inventory (4 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| inventory.low_stock | Stock below threshold | SKU, current_qty, threshold |
| inventory.out_of_stock | Stock reached zero | SKU, last_updated |
| inventory.restocked | New stock received | SKU, quantity_added, new_total |
| inventory.transfer | Stock moved between locations | From, to, qty, reference |

### Automation (4 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| automation.workflow.activated | Workflow turned on | Workflow ID, name |
| automation.workflow.deactivated | Workflow turned off | Workflow ID, reason |
| automation.workflow.executed | Workflow ran | Workflow ID, trigger, result |
| automation.workflow.failed | Workflow execution error | Workflow ID, error, step |

### System (8 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| tenant.created | New tenant onboarded | Tenant ID, tier, domain |
| tenant.plan_changed | Subscription tier change | Old tier, new tier, effective date |
| tenant.billing_updated | Payment method changed | Method type, last4 |
| user.created | Team member added | User ID, email, role |
| user.updated | User profile changed | User + diff |
| user.deleted | User removed | User ID |
| user.login | User logged in | User ID, IP, timestamp |
| api_key.created | API key generated | Key ID, permissions (key itself not included) |

### Marketing (4 events)

| Event ID | Description | Payload Includes |
|---|---|---|
| campaign.sent | Campaign dispatched | Campaign ID, recipient count |
| campaign.opened | Email opened | Campaign ID, contact ID, timestamp |
| campaign.clicked | Link clicked | Campaign ID, contact ID, URL |
| campaign.bounced | Email bounced | Campaign ID, contact ID, reason |

---

## 3. Webhook Delivery Mechanism

### HTTP Request

All webhooks are delivered as HTTP POST requests with a JSON body. Every request includes standard headers for identification, security, and traceability.

**Request Headers:**
- Content-Type: application/json
- User-Agent: LCOS-Webhook/1.0
- X-LCOS-Signature: HMAC-SHA256 signature of the payload
- X-LCOS-Event-Id: Unique event identifier
- X-LCOS-Event-Type: The event type (e.g., order.created)
- X-LCOS-Delivery-Id: Unique delivery attempt identifier
- X-LCOS-Tenant-Id: Tenant identifier
- X-LCOS-Timestamp: ISO 8601 timestamp of event creation

### Delivery Queue

- Queue: BullMQ (Redis-backed)
- Concurrency: Configurable per endpoint (default: 5 concurrent)
- Ordering: Best-effort ordering per event type
- Batching: Optional batch delivery (up to 10 events in array)

---

## 4. Retry Policy

### Exponential Backoff

| Attempt | Delay | Cumulative |
|---|---|---|
| 1 | Immediate | 0s |
| 2 | 10 seconds | 10s |
| 3 | 30 seconds | 40s |
| 4 | 1 minute | 1m 40s |
| 5 | 5 minutes | 6m 40s |
| 6 | 15 minutes | 21m 40s |
| 7 | 30 minutes | 51m 40s |
| 8 | 1 hour | 1h 51m |
| 9 | 3 hours | 4h 51m |
| 10 | 6 hours | 10h 51m |

### Retry Configuration

```typescript
interface WebhookEndpoint {
  url: string;
  max_retries: number;
  retry_interval_seconds: number;
  timeout_ms: number;
  backoff_type: 'exponential' | 'linear' | 'fixed';
}
```

### Failure Handling

| HTTP Status | Action |
|---|---|
| 2xx | Success - mark delivered |
| 3xx | Follow redirect (max 3) |
| 4xx | Client error - disable webhook |
| 429 | Rate limited - retry with backoff |
| 5xx | Server error - retry with backoff |
| Timeout | Retry with backoff |

### Dead Letter Queue

After exhausting all retries, the webhook is moved to a dead letter queue:
- Event stored with full payload and error details
- Admin alerted via notification
- Manual replay available from webhook logs UI
- Auto-cleanup after 30 days

---

## 5. Security

### Payload Signing

```typescript
function signPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Signature Verification

```typescript
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-lcos-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.LCOS_WEBHOOK_SECRET;
  if (!verifySignature(payload, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  res.status(200).json({ received: true });
});
```

### Webhook Secrets

| Property | Specification |
|---|---|
| Generation | Auto-generated on endpoint creation |
| Format | 32-byte hex string |
| Storage | Hashed at rest (SHA-256) |
| Rotation | Manual or forced every 365 days |
| Exposure | Shown once at creation, then masked |

### IP Whitelisting

- Production: 203.0.113.0/24 (CIDR provided at onboarding)
- Staging: 198.51.100.0/24

### Security Rules

- HTTPS enforced for all webhook URLs
- Timeout: 10 seconds default (configurable to 30s)
- Payload size limit: 1 MB per event
- Replay protection with timestamp window (+/- 5 min)

---

## 6. Webhook Management UI

### Endpoint List

The webhook management page shows all configured endpoints with status indicators:
- Columns: Endpoint URL, Subscribed Events, Status, Last Delivery, Actions
- Inline actions: Edit, Test, Pause, Delete
- Search by URL or event type

### Endpoint Configuration

Configuration form includes:
- URL field with HTTPS validation
- Secret display with regenerate button
- Event subscription (all events or individual selection)
- Optional payload filters (condition-based)
- Retry configuration (max retries, timeout)

### Delivery Log

A searchable, filterable log table showing:
- Timestamp of each delivery attempt
- Event type
- HTTP status code returned
- Latency in milliseconds
- Retry attempt number
- Payload preview with expand/copy

---

## 7. Testing Webhooks

### CLI Test Tool

```bash
# Send a test event
lcos webhook test --url https://example.com/webhook --event order.created

# Test with custom secret
lcos webhook test --url https://example.com/webhook --event product.created --secret whsec_abc123

# List recent deliveries
lcos webhook logs --endpoint https://example.com/webhook --limit 10

# Replay dead letter queue events
lcos webhook replay --endpoint-id wh_abc123 --failed-only
```

### UI Test Button

1. Click "Test" on the endpoint detail page
2. Select an event type
3. Optional: customize the test payload
4. Click "Send Test"
5. Result shown inline (status, latency, response body)

### Testing Locally

```bash
# Use ngrok to expose local server
ngrok http 3000

# Configure webhook endpoint in LCOS with ngrok URL
# Receive real events on localhost
```

---

## 8. Rate Limits & Throttling

### Per-Endpoint Limits

| Tier | Max Events/min | Max Concurrent | Max Burst |
|---|---|---|---|
| Starter | 100 | 3 | 10 |
| Growth | 500 | 5 | 25 |
| Professional | 2,000 | 10 | 50 |
| Enterprise | Custom | Custom | Custom |

### Throttling Behavior

- Events exceeding the rate limit are queued (not dropped)
- Queue max size: 10,000 events per endpoint
- If queue is full, oldest events are dropped (FIFO)
- Throttled events are logged with status throttled

### Delivery Guarantees

- At-least-once delivery (may receive duplicates)
- Webhook receivers should be idempotent
- Use X-LCOS-Event-Id header for deduplication

---

## 9. Example Payloads

### order.created

```json
{
  "event_id": "evt_abc123def456",
  "event_type": "order.created",
  "tenant_id": "tnt_luxury_boutique",
  "created_at": "2026-07-21T12:34:56.789Z",
  "data": {
    "order": {
      "id": "ord_789",
      "number": "ORD-2026-0042",
      "status": "pending",
      "total": 2400.00,
      "currency": "USD",
      "subtotal": 2200.00,
      "tax": 150.00,
      "shipping": 50.00,
      "items": [
        {
          "product_id": "prd_123",
          "sku": "SEG-001",
          "name": "Silk Evening Gown",
          "qty": 1,
          "unit_price": 2200.00,
          "total": 2200.00
        }
      ],
      "customer": {
        "id": "cus_456",
        "email": "alex@example.com",
        "name": "Alex Johnson"
      },
      "shipping_address": {
        "line1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postal_code": "10001",
        "country": "US"
      },
      "payment": {
        "method": "credit_card",
        "status": "pending",
        "amount": 2400.00
      }
    }
  }
}
```

### deal.won

```json
{
  "event_id": "evt_def789ghi012",
  "event_type": "deal.won",
  "tenant_id": "tnt_luxury_boutique",
  "created_at": "2026-07-21T14:00:00.000Z",
  "data": {
    "deal": {
      "id": "deal_789",
      "name": "Spring Collection - Bergdorf Goodman",
      "value": 120000.00,
      "currency": "USD",
      "pipeline": "retail",
      "stage": "closed_won",
      "close_date": "2026-07-21",
      "owner": { "id": "usr_42", "name": "Sarah Connor" },
      "contact": { "id": "con_123", "name": "James Peterson", "email": "jp@bergdorf.com" },
      "products": [
        { "product_id": "prd_123", "name": "Silk Evening Gown", "qty": 50 },
        { "product_id": "prd_456", "name": "Cashmere Blazer", "qty": 30 }
      ]
    }
  }
}
```

### inventory.low_stock

```json
{
  "event_id": "evt_ghi345jkl678",
  "event_type": "inventory.low_stock",
  "tenant_id": "tnt_luxury_boutique",
  "created_at": "2026-07-21T08:15:30.000Z",
  "data": {
    "product_id": "prd_123",
    "sku": "SEG-001",
    "name": "Silk Evening Gown",
    "current_quantity": 3,
    "threshold": 5,
    "location": "warehouse_nyc",
    "last_restocked": "2026-07-10T00:00:00Z"
  }
}
```

---

## 10. Webhook Management via API

All webhook management operations are available via the REST API.

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/webhooks | List all endpoints |
| POST | /api/v1/webhooks | Create endpoint |
| GET | /api/v1/webhooks/:id | Get endpoint details |
| PUT | /api/v1/webhooks/:id | Update endpoint |
| DELETE | /api/v1/webhooks/:id | Delete endpoint |
| POST | /api/v1/webhooks/:id/test | Send test event |
| GET | /api/v1/webhooks/:id/logs | Get delivery logs |
| POST | /api/v1/webhooks/:id/replay | Replay failed events |

### Create Endpoint Example

```bash
curl -X POST https://api.lcos.app/v1/webhooks \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["order.created", "order.updated", "deal.won"],
    "filters": [
      { "field": "total", "operator": "gt", "value": "1000" }
    ],
    "max_retries": 10,
    "timeout_ms": 10000
  }'
```
