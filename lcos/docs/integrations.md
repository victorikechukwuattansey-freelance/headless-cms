# Integrations Architecture

> **Version:** 1.0.0  
> **Status:** Approved  
> **Last Updated:** 2026-07-21  

---

## 1. Overview

LCOS integrates with external third-party services to enable multi-channel commerce, payments, shipping, communications, and marketing. All integrations are managed through a unified integration framework that handles authentication, rate limiting, webhooks, and health monitoring.

### Guiding Principles

- **Provider abstraction** -- business logic never depends on a specific provider directly; all interactions go through a provider interface
- **Resilience** -- each integration is isolated; a failure in one provider does not affect others
- **Credential security** -- secrets are encrypted at rest and never exposed in logs or responses
- **Graceful degradation** -- if an integration is down, the platform continues to function with degraded capabilities
- **Tenant-isolated credentials** -- each tenant has their own set of integration credentials

---

## 2. Integration Provider Pattern

### Provider Interface

```typescript
interface IntegrationProvider {
  readonly providerId: string;
  readonly displayName: string;
  connect(credentials: Record<string, string>): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  sync(options: SyncOptions): Promise<SyncResult>;
  handleWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult>;
  healthCheck(): Promise<HealthStatus>;
  getRateLimitStatus(): Promise<RateLimitStatus>;
}
```

### Provider Registry

```typescript
export const providerRegistry = {
  stripe: StripeProvider,
  shopify: ShopifyProvider,
  whatsapp: WhatsAppBusinessProvider,
  instagram: InstagramGraphProvider,
  dhl: DHLProvider,
  sendgrid: SendGridProvider,
  google: GoogleOAuthProvider,
  apple: AppleSignInProvider,
  facebook: FacebookGraphProvider,
} as const;
```

---

## 3. OAuth Flow for Social Platforms

### Generic Flow

1. Client initiates OAuth via POST /integrations/{provider}/connect
2. LCOS redirects user to provider authorization URL
3. User logs in and grants permissions
4. Provider redirects back with authorization code
5. LCOS exchanges code for access + refresh tokens
6. Tokens encrypted (AES-256-GCM) stored in database
7. Integration marked as connected

### Token Storage

```typescript
interface IntegrationCredential {
  id: string;
  tenantId: string;
  provider: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenMetadata: {
    expiresAt: string | null;
    scopes: string[];
    providerAccountId: string;
    providerAccountName: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Token Refresh

Background job runs every 6 hours, finds tokens expiring within 7 days, and refreshes them. Failed refreshes generate alerts and mark the integration as disconnected.

---

## 4. Webhook Receiving & Processing

### Architecture

```
POST /webhooks/{provider}
  1. Signature verification
  2. Tenant resolution from provider-specific identifiers
  3. Deduplication via Redis (24h TTL on webhook ID)
  4. Event transformation to LCOS internal event
  5. Publish to event bus
  6. Respond 200 OK (within 3 seconds)
```

### Signature Verification

| Provider | Header | Algorithm |
|----------|--------|-----------|
| Stripe | stripe-signature | HMAC-SHA256 |
| Shopify | x-shopify-hmac-sha256 | HMAC-SHA256 |
| WhatsApp | x-hub-signature-256 | HMAC-SHA256 |
| Instagram | x-hub-signature-256 | HMAC-SHA256 |
| DHL | x-dhl-signature | HMAC-SHA256 |

### Webhook Event Catalog

| Provider | Event | LCOS Event | Action |
|----------|-------|------------|--------|
| Stripe | payment_intent.succeeded | sales.payment.received | Update order payment |
| Stripe | charge.refunded | sales.payment.refunded | Update refund |
| Shopify | orders/create | sales.order.created | Import order |
| Shopify | products/update | product.updated | Sync product |
| WhatsApp | message.received | crm.interaction.logged | Log message |
| Instagram | comments.create | crm.interaction.logged | Log engagement |
| DHL | shipment.delivered | sales.order.delivered | Mark delivered |

### Retry Buffer

```sql
CREATE TABLE webhook_retry_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL,
  raw_payload JSONB NOT NULL,
  raw_headers JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
);
```

---

## 5. API Rate Limiting Strategy

### Multi-Layer Approach

- Provider rate limits tracked per provider (Stripe: 100/s, Shopify: 40/s, Instagram: 200/h)
- Adaptive backoff on 429 responses with exponential delay
- Token Bucket algorithm per provider per tenant
- Burst allowance: 2x sustained rate for 10 seconds
- Excess requests queued (not dropped)

### Adaptive Rate Limiting

On 429: parse Retry-After, record in Redis, reduce capacity 20%, recover over 5 minutes.

---

## 6. Integration Health Monitoring

### Health Check Schedule

| Provider | Frequency | Method |
|----------|-----------|--------|
| Stripe | 5 min | GET /v1/balance |
| Shopify | 5 min | GET /admin/api/shop.json |
| WhatsApp | 1 min | GET /v20.0/me/message_templates |
| Instagram | 15 min | GET /me?fields=id |
| DHL | 15 min | GET /health |

### Alert Thresholds

| Condition | Severity |
|-----------|----------|
| 3 consecutive health check failures | Critical |
| Rate limit exceeded | Warning |
| Token expires in < 7 days | Warning |
| 10 consecutive sync failures | Critical |
| Webhook signature invalid | Critical |

---

## 7. Specific Integrations

### 7.1 WhatsApp Business API

**Capabilities:** Send template messages, receive messages, send media, delivery receipts, template management

**Rate Limits:** 1,000 business-initiated conversations/day, 80 msg/s throughput

**Connection:**
```
POST /integrations/whatsapp/connect
{
  "accessToken": "EAAx...",
  "businessAccountId": "123456789",
  "phoneNumberId": "987654321",
  "webhookVerifyToken": "my_verify_token"
}
```

**Template Management:**
```
POST /integrations/whatsapp/templates/create
{
  "name": "order_confirmation",
  "language": "en_US",
  "category": "transactional",
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "Order Confirmed" },
    { "type": "BODY", "text": "Hi {{1}}, your order {{2}} has been confirmed." },
    { "type": "FOOTER", "text": "Thank you" }
  ]
}
```

### 7.2 Instagram

**Capabilities:** Fetch/reply to comments, receive/send DMs, media insights, product tags

**Required Permissions:** instagram_business_basic, instagram_business_content_publish, instagram_business_content_message, pages_messaging

**Connection:**
```
POST /integrations/instagram/connect
{
  "facebookPageId": "123456789",
  "instagramBusinessAccountId": "987654321",
  "accessToken": "EAAx...",
  "webhookVerifyToken": "verify_token"
}
```

### 7.3 Stripe

**Capabilities:** Payment processing, subscriptions, invoicing, refunds, chargebacks, Stripe Connect

**Payment Methods:** Card, Apple Pay, Google Pay, SEPA Direct Debit, Wire Transfer, Klarna, Bancontact, iDEAL

**Connection:**
```
POST /integrations/stripe/connect
{
  "apiKey": "sk_live_...",
  "webhookSecret": "whsec_...",
  "config": {
    "mode": "live",
    "supportedCurrencies": ["USD", "EUR", "GBP", "CHF"],
    "captureMethod": "automatic"
  }
}
```

### 7.4 Shopify

**Capabilities:** Product/variant sync, order import, fulfillment sync, webhook subscriptions

**Sync Schedule:** Shopify -> LCOS every 15 min, LCOS -> Shopify every 30 min

**Connection:**
```
POST /integrations/shopify/connect
{
  "shopDomain": "maison-dupont.myshopify.com",
  "accessToken": "shpat_...",
  "apiVersion": "2024-07",
  "webhookSecret": "shp_ss_..."
}
```

### 7.5 DHL

**Capabilities:** Shipment creation, label generation, pickup scheduling, real-time tracking, customs docs

**Connection:**
```
POST /integrations/dhl/connect
{
  "apiKey": "...",
  "accountNumber": "1234567890",
  "mode": "live",
  "labelFormat": "PDF_4x6"
}
```

---

## 8. Sync Engine

### Sync Strategies

| Strategy | Description | Used By |
|----------|-------------|---------|
| Full sync | Replace all data | Initial connection |
| Incremental | Sync since last cursor | Nightly reconciliation |
| Event-driven | Real-time via webhooks | Live operations |
| On-demand | Manual trigger | Admin UI |

### State Machine

IDLE -> CONNECTING -> FETCHING -> TRANSFORMING -> PERSISTING -> COMPLETED

Any state can transition to ERROR -> RETRYING (3 attempts) -> FAILED

---

## 9. Circuit Breaker

Each integration has a circuit breaker: CLOSED -> OPEN (5 failures in 60s) -> HALF_OPEN (30s timeout) -> CLOSED on success, OPEN on failure.

```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeoutMs = 30000;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half_open';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }
    try {
      const result = await fn();
      if (this.state === 'half_open') this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}
```

---

## 10. Environment Variables

```
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
WHATSAPP_ACCESS_TOKEN=EAAx...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_PHONE_NUMBER_ID=...
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
DHL_API_KEY=...
DHL_ACCOUNT_NUMBER=...
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SENDGRID_API_KEY=SG....
INTEGRATION_ENCRYPTION_KEY=...
```
