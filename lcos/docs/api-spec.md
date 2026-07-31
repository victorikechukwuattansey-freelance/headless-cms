# LCOS API Specification

> **Version:** 1.0.0  
> **Base URL:** `https://api.lcos.io/v1`  
> **Protocol:** HTTPS only  
> **Content-Type:** `application/json`  

---

## Authentication

All authenticated endpoints require one of:

- **Bearer Token** (`Authorization: Bearer <jwt>`) — for user sessions
- **API Key** (`X-API-Key: <key>`) — for machine-to-machine

Every request MUST include a valid `X-Tenant-ID` header. Requests missing it return `400 Bad Request`.

### Error Response Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      { "field": "email", "issue": "must be a valid email address" }
    ],
    "requestId": "req_abc123"
  }
}
```

### Success Pagination Shape

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "perPage": 25,
    "total": 142,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Standard query parameters: `?page=1&perPage=25&sort=createdAt:desc&filter[key]=value`

---

## Auth Module

Base path: `/auth`

### POST /auth/register

Create a new tenant admin account.

**Request:**
```json
{
  "tenantName": "Maison Dupont",
  "tenantSlug": "maison-dupont",
  "email": "admin@maisondupont.com",
  "password": "P@ssw0rd!",
  "fullName": "Jean Dupont",
  "locale": "fr-FR"
}
```

**Response `201`:**
```json
{
  "user": { "id": "usr_001", "email": "admin@maisondupont.com", "fullName": "Jean Dupont", "role": "tenant_admin" },
  "tenant": { "id": "tnt_001", "name": "Maison Dupont", "slug": "maison-dupont", "plan": "starter" },
  "session": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 3600 }
}
```

### POST /auth/login

Authenticate with email + password.

**Request:**
```json
{
  "email": "admin@maisondupont.com",
  "password": "P@ssw0rd!"
}
```

**Response `200`:**
```json
{
  "user": { "id": "usr_001", "email": "admin@maisondupont.com", "fullName": "Jean Dupont", "role": "tenant_admin" },
  "session": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 3600 },
  "mfaRequired": false
}
```

### POST /auth/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600
}
```

### POST /auth/logout

Invalidate the current session.

**Headers:** `Authorization: Bearer <token>`

**Response `204`:** No content.

### POST /auth/mfa/setup

Initialize MFA enrollment (returns QR secret).

**Response `200`:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "otpauth://totp/LCOS:admin@maisondupont.com?secret=...&issuer=LCOS",
  "recoveryCodes": ["a1b2-c3d4", "e5f6-g7h8", "i9j0-k1l2"]
}
```

### POST /auth/mfa/verify

Confirm MFA enrollment and activate.

```json
{
  "token": "123456"
}
```

**Response `200`:** `{ "verified": true }`

### POST /auth/mfa/challenge

Submit MFA code during login when `mfaRequired: true`.

```json
{
  "mfaToken": "temp_token_from_login", 
  "code": "123456"
}
```

**Response `200`:** Session object.

### POST /auth/password/reset

Request a password reset email.

```json
{ "email": "admin@maisondupont.com" }
```

**Response `200`:** `{ "message": "If the email exists, a reset link has been sent." }`

### POST /auth/password/confirm

Complete password reset with token.

```json
{
  "token": "reset_token",
  "newPassword": "NewP@ss123!"
}
```

**Response `200`:** Session object.

### POST /auth/oauth/{provider}

Initiate OAuth flow for a social provider (`google`, `apple`, `instagram`, `facebook`).

**Response `200`:** `{ "authorizationUrl": "https://..." }`

### POST /auth/oauth/{provider}/callback

Complete OAuth after the provider redirect.

```json
{
  "code": "oauth_code_from_provider",
  "redirectUri": "https://app.lcos.io/auth/callback"
}
```

**Response `200`:** Session object (or `201` if new user created).

---

## Products Module

Base path: `/products`

### POST /products

Create a new product.

**Required role:** `inventory_manager`, `admin`

**Request:**
```json
{
  "name": "Diamond Eternity Ring",
  "sku": "RNG-DIA-001",
  "description": "18k white gold ring with 3ct VS1 diamond",
  "categoryId": "cat_012",
  "brandId": "brd_004",
  "price": { "amount": 12500, "currency": "USD" },
  "compareAtPrice": { "amount": 15000, "currency": "USD" },
  "costPrice": { "amount": 7500, "currency": "USD" },
  "attributes": {
    "material": "18k White Gold",
    "gemstone": "Diamond",
    "weight": "5.2g",
    "size": "7"
  },
  "seo": {
    "title": "Diamond Eternity Ring | Maison Dupont",
    "description": "Elegant 18k white gold eternity ring featuring a 3-carat VS1 diamond.",
    "slug": "diamond-eternity-ring"
  },
  "tags": ["rings", "diamond", "bridal"],
  "status": "draft"
}
```

**Response `201`:**
```json
{
  "id": "prd_001",
  "name": "Diamond Eternity Ring",
  "sku": "RNG-DIA-001",
  "createdAt": "2026-07-21T10:30:00Z",
  "updatedAt": "2026-07-21T10:30:00Z"
}
```

### GET /products

List products with filtering and search.

**Query parameters:**
- `search` — full-text search on name/sku
- `categoryId` — filter by category
- `brandId` — filter by brand
- `status` — `draft|active|archived|discontinued`
- `minPrice`, `maxPrice` — price range
- `tags` — comma-separated tag filter
- `sort` — `createdAt:desc|asc`, `price:desc|asc`, `name:asc|desc`

**Response `200`:** Paginated list of product summaries.

### GET /products/:id

Get a single product with full details.

**Response `200`:**
```json
{
  "id": "prd_001",
  "name": "Diamond Eternity Ring",
  "sku": "RNG-DIA-001",
  "description": "18k white gold ring with 3ct VS1 diamond",
  "category": { "id": "cat_012", "name": "Rings" },
  "brand": { "id": "brd_004", "name": "Maison Dupont" },
  "price": { "amount": 12500, "currency": "USD" },
  "compareAtPrice": { "amount": 15000, "currency": "USD" },
  "costPrice": { "amount": 7500, "currency": "USD" },
  "attributes": { "material": "18k White Gold", "gemstone": "Diamond" },
  "media": [
    { "id": "med_001", "url": "https://cdn.lcos.io/products/prd_001/main.jpg", "type": "image", "position": 1 },
    { "id": "med_002", "url": "https://cdn.lcos.io/products/prd_001/360.mp4", "type": "video_360", "position": 2 }
  ],
  "variants": [
    { "id": "var_001", "sku": "RNG-DIA-001-SZ6", "size": "6", "price": { "amount": 12000, "currency": "USD" }, "inventory": 2 },
    { "id": "var_002", "sku": "RNG-DIA-001-SZ7", "size": "7", "price": { "amount": 12500, "currency": "USD" }, "inventory": 5 }
  ],
  "seo": { "title": "Diamond Eternity Ring | Maison Dupont", "description": "...", "slug": "diamond-eternity-ring" },
  "status": "active",
  "createdAt": "2026-07-21T10:30:00Z",
  "updatedAt": "2026-07-21T14:00:00Z"
}
```

### PATCH /products/:id

Update a product (partial update).

**Response `200`:** Updated product object.

### DELETE /products/:id

Soft-delete a product (sets status to `archived`).

**Response `204`.**

### POST /products/:id/media

Attach media to a product.

```json
{
  "url": "https://cdn.lcos.io/products/prd_001/new.jpg",
  "type": "image",
  "position": 3,
  "alt": "Diamond ring side view"
}
```

**Response `201`.**

### GET /products/:id/inventory

Get inventory movements for a product.

**Response `200`:** Paginated list of inventory transactions.

---

### Categories

Base path: `/categories`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | List all categories (tree structure) |
| POST | `/categories` | Create category |
| GET | `/categories/:id` | Get category with children |
| PATCH | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category (reassign children) |

### Brands

Base path: `/brands`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/brands` | List brands |
| POST | `/brands` | Create brand |
| GET | `/brands/:id` | Get brand with product count |
| PATCH | `/brands/:id` | Update brand |
| DELETE | `/brands/:id` | Delete brand |

---

## Inventory Module

Base path: `/inventory`

### GET /inventory/summary

Aggregate inventory across all warehouses.

**Response `200`:**
```json
{
  "totalSKUs": 1240,
  "totalValue": { "amount": 4850000, "currency": "USD" },
  "lowStockCount": 23,
  "outOfStockCount": 8,
  "warehouses": [
    { "id": "wh_001", "name": "Paris Flagship", "skuCount": 620, "value": { "amount": 2400000, "currency": "USD" } }
  ]
}
```

### GET /inventory/stock

Get stock levels with filters.

**Query params:** `warehouseId`, `productId`, `status` (`in_stock|low_stock|out_of_stock`), `search`

**Response `200`:** Paginated list of stock records.

### POST /inventory/adjust

Record a manual inventory adjustment.

```json
{
  "productId": "prd_001",
  "variantId": "var_001",
  "warehouseId": "wh_001",
  "quantity": -1,
  "reason": "customer_return",
  "reference": "ORD-20260721-0042",
  "notes": "Item returned in mint condition"
}
```

**Response `201`.**

### POST /inventory/transfer

Transfer stock between warehouses.

```json
{
  "productId": "prd_001",
  "variantId": "var_001",
  "fromWarehouseId": "wh_001",
  "toWarehouseId": "wh_002",
  "quantity": 3
}
```

**Response `201`.**

### POST /inventory/cycle-count

Initiate a cycle count for a warehouse.

```json
{
  "warehouseId": "wh_001",
  "zone": "A12",
  "scheduledDate": "2026-07-22"
}
```

**Response `201`:** `{ "countId": "cnt_001", "status": "pending" }`

### GET /inventory/warehouses

List warehouses.

### POST /inventory/warehouses

Create warehouse.

```json
{
  "name": "Paris Flagship",
  "code": "PARIS-FS",
  "address": { "line1": "24 Rue de la Paix", "city": "Paris", "postalCode": "75002", "country": "FR" },
  "isPrimary": true
}
```

### GET /inventory/transactions

View inventory transaction log (audit trail).

**Query params:** `productId`, `type` (`sale|purchase|adjustment|transfer|return`), `dateFrom`, `dateTo`

**Response `200`:** Paginated list of transactions.

---

## CRM Module

Base path: `/crm`

### Customers

Base path: `/crm/customers`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/customers` | List customers with search, tags, tier filters |
| POST | `/crm/customers` | Create customer |
| GET | `/crm/customers/:id` | Get customer with full profile |
| PATCH | `/crm/customers/:id` | Update customer |
| DELETE | `/crm/customers/:id` | Soft-delete customer |

**Customer response includes:**
```json
{
  "id": "cst_001",
  "email": "client@example.com",
  "fullName": "Marie Laurent",
  "phone": "+33612345678",
  "tier": "vip",
  "tags": ["high-spender", "bridal"],
  "totalSpent": { "amount": 85000, "currency": "EUR" },
  "orderCount": 12,
  "lastPurchaseAt": "2026-07-15T16:30:00Z",
  "lifetimeValue": { "amount": 85000, "currency": "EUR" },
  "predictedLTV": { "amount": 120000, "currency": "EUR" },
  "preferences": { "contactMethod": "whatsapp", "newsletter": true, "language": "fr" },
  "addresses": [
    { "type": "shipping", "line1": "10 Avenue Montaigne", "city": "Paris", "country": "FR", "isDefault": true }
  ],
  "notes": "Prefers evening contact. Interested in 2026 collection.",
  "createdAt": "2025-03-10T09:00:00Z"
}
```

### Segments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/segments` | List dynamic segments |
| POST | `/crm/segments` | Create segment with rules |
| GET | `/crm/segments/:id` | Get segment with member count |
| PATCH | `/crm/segments/:id` | Update segment rules |
| DELETE | `/crm/segments/:id` | Delete segment |

**Segment rules example:**
```json
{
  "name": "VIP Bridal",
  "rules": {
    "operator": "and",
    "conditions": [
      { "field": "tier", "operator": "equals", "value": "vip" },
      { "field": "tags", "operator": "contains", "value": "bridal" },
      { "field": "totalSpent", "operator": "gte", "value": 50000 }
    ]
  }
}
```

### Interactions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/customers/:id/interactions` | Timeline of all interactions |
| POST | `/crm/customers/:id/interactions` | Log an interaction |

```json
{
  "type": "call",
  "channel": "phone",
  "summary": "Discussed custom order timeline",
  "outcome": "positive",
  "assignedTo": "usr_012",
  "followUpAt": "2026-07-28T10:00:00Z"
}
```

### Tickets

Base path: `/crm/tickets`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/tickets` | List support tickets |
| POST | `/crm/tickets` | Open new ticket |
| GET | `/crm/tickets/:id` | Get ticket with messages |
| PATCH | `/crm/tickets/:id` | Update ticket status/priority/assignee |
| POST | `/crm/tickets/:id/messages` | Add message to ticket |

---

## Sales Module

Base path: `/sales`

### Orders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales/orders` | List orders with filters |
| POST | `/sales/orders` | Create manual order |
| GET | `/sales/orders/:id` | Get order with line items, payments, fulfillment |
| PATCH | `/sales/orders/:id` | Update order |
| POST | `/sales/orders/:id/cancel` | Cancel order |

**Order response:**
```json
{
  "id": "ORD-20260721-0042",
  "customer": { "id": "cst_001", "fullName": "Marie Laurent" },
  "status": "confirmed",
  "items": [
    {
      "productId": "prd_001",
      "variantId": "var_001",
      "sku": "RNG-DIA-001-SZ7",
      "name": "Diamond Eternity Ring (Size 7)",
      "quantity": 1,
      "unitPrice": { "amount": 12500, "currency": "USD" },
      "totalPrice": { "amount": 12500, "currency": "USD" }
    }
  ],
  "subtotal": { "amount": 12500, "currency": "USD" },
  "shipping": { "amount": 0, "currency": "USD", "method": "white-glove" },
  "tax": { "amount": 2500, "currency": "USD" },
  "discount": { "amount": 0, "currency": "USD" },
  "total": { "amount": 15000, "currency": "USD" },
  "payments": [
    { "id": "pay_001", "method": "wire_transfer", "status": "captured", "amount": { "amount": 15000, "currency": "USD" }, "paidAt": "2026-07-21T12:00:00Z" }
  ],
  "fulfillments": [
    { "id": "ful_001", "status": "pending", "method": "white-glove", "scheduledDate": "2026-07-25" }
  ],
  "timeline": [
    { "status": "pending", "timestamp": "2026-07-21T10:00:00Z" },
    { "status": "confirmed", "timestamp": "2026-07-21T10:05:00Z", "actor": "system" }
  ],
  "notes": "Gift wrapping requested — black box with gold ribbon.",
  "createdAt": "2026-07-21T10:00:00Z"
}
```

### Payments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales/payments` | List payments |
| GET | `/sales/payments/:id` | Get payment details |
| POST | `/sales/payments/:id/refund` | Issue partial/full refund |
| POST | `/sales/payments/:id/capture` | Capture previously authorized payment |

```json
// POST /sales/payments/:id/refund
{
  "amount": { "amount": 15000, "currency": "USD" },
  "reason": "customer_cancellation",
  "note": "Full refund per customer request"
}
```

### Quotes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales/quotes` | List quotes |
| POST | `/sales/quotes` | Create quote |
| GET | `/sales/quotes/:id` | Get quote |
| PATCH | `/sales/quotes/:id` | Update quote |
| POST | `/sales/quotes/:id/convert` | Convert quote to order |
| POST | `/sales/quotes/:id/expire` | Manually expire |

### Fulfillment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales/fulfillments` | List fulfillments |
| POST | `/sales/fulfillments` | Create fulfillment |
| PATCH | `/sales/fulfillments/:id` | Update status |
| POST | `/sales/fulfillments/:id/ship` | Mark as shipped with tracking |
| GET | `/sales/fulfillments/:id/tracking` | Get live tracking info |

---

## AI Studio Module

Base path: `/ai-studio`

### POST /ai-studio/completions

Generate AI-powered content (product descriptions, marketing copy, etc.).

```json
{
  "prompt": "Write a luxurious product description for a diamond eternity ring",
  "context": { "productId": "prd_001", "tone": "elegant", "length": "medium" },
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 500
}
```

**Response `200`:**
```json
{
  "id": "gen_001",
  "output": "Embrace timeless elegance with our Diamond Eternity Ring...",
  "model": "gpt-4o",
  "usage": { "promptTokens": 120, "completionTokens": 180, "totalTokens": 300 }
}
```

### POST /ai-studio/personalize

Generate personalized product recommendations for a customer.

```json
{
  "customerId": "cst_001",
  "context": { "page": "product_detail", "currentProductId": "prd_001" },
  "limit": 4
}
```

**Response `200`:**
```json
{
  "customerId": "cst_001",
  "recommendations": [
    { "productId": "prd_002", "score": 0.95, "reason": "Previous purchase from same collection" },
    { "productId": "prd_008", "score": 0.88, "reason": "Complements diamond jewelry preference" }
  ],
  "model": "recommendation-engine-v2",
  "latencyMs": 245
}
```

### POST /ai-studio/classify

Classify or tag content using AI.

```json
{
  "input": "18k rose gold necklace with sapphire pendant",
  "task": "product_categorization",
  "labels": ["necklaces", "rings", "bracelets", "earrings"]
}
```

**Response `200`:**
```json
{
  "label": "necklaces",
  "confidence": 0.97,
  "tags": ["rose-gold", "sapphire", "pendant"]
}
```

### POST /ai-studio/analyze/sentiment

Analyze sentiment of customer messages.

```json
{ "text": "I'm extremely disappointed with the delay in delivery." }
```

**Response `200`:**
```json
{
  "sentiment": "negative",
  "score": 0.89,
  "aspects": [
    { "aspect": "delivery", "sentiment": "negative", "score": 0.95 }
  ]
}
```

### GET /ai-studio/models

List available AI models and their status.

**Response `200`:**
```json
{
  "models": [
    { "id": "gpt-4o", "provider": "openai", "capabilities": ["text", "vision"], "status": "available" },
    { "id": "claude-3-opus", "provider": "anthropic", "capabilities": ["text"], "status": "available" },
    { "id": "recommendation-engine-v2", "provider": "lcos", "capabilities": ["recommendations"], "status": "available" }
  ]
}
```

### GET /ai-studio/usage

Get AI usage metrics for the tenant.

**Query params:** `dateFrom`, `dateTo`, `granularity` (`day|hour`)

**Response `200`:**
```json
{
  "totalTokens": 1250000,
  "totalCost": { "amount": 12.5, "currency": "USD" },
  "breakdown": [
    { "date": "2026-07-21", "model": "gpt-4o", "tokens": 450000, "cost": { "amount": 4.5, "currency": "USD" } }
  ]
}
```

---

## Automation Module

Base path: `/automation`

### POST /automation/workflows

Create a new automation workflow.

```json
{
  "name": "VIP Abandoned Cart",
  "description": "Send personalized WhatsApp message to VIP customers who abandon cart",
  "trigger": {
    "event": "cart.abandoned",
    "filters": [
      { "field": "customer.tier", "operator": "equals", "value": "vip" }
    ],
    "delay": { "value": 30, "unit": "minutes" }
  },
  "actions": [
    {
      "type": "send_message",
      "config": {
        "channel": "whatsapp",
        "templateId": "tpl_abandoned_cart_vip",
        "variables": { "customerName": "{{customer.fullName}}", "cartItems": "{{cart.itemCount}}" }
      }
    },
    {
      "type": "create_task",
      "config": {
        "assignee": "{{customer.assignedSalesAssociate}}",
        "title": "Follow up on abandoned cart — {{customer.fullName}}",
        "priority": "high",
        "dueIn": { "value": 2, "unit": "hours" }
      }
    }
  ],
  "enabled": true
}
```

**Response `201`:**
```json
{
  "id": "wf_001",
  "name": "VIP Abandoned Cart",
  "status": "active",
  "trigger": { "event": "cart.abandoned" },
  "actionCount": 2,
  "createdAt": "2026-07-21T10:30:00Z"
}
```

### GET /automation/workflows

List workflows with status filter.

### GET /automation/workflows/:id

Get workflow details including execution history.

### PATCH /automation/workflows/:id

Update workflow configuration.

### DELETE /automation/workflows/:id

Delete workflow (soft-delete).

### PATCH /automation/workflows/:id/toggle

Enable or disable a workflow.

```json
{ "enabled": false }
```

### GET /automation/workflows/:id/executions

Get execution history for a specific workflow.

### GET /automation/executions

List all workflow executions with status filter.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "exe_001",
      "workflowId": "wf_001",
      "workflowName": "VIP Abandoned Cart",
      "triggeredBy": "event:cart.abandoned",
      "status": "completed",
      "actionsCompleted": 2,
      "actionsFailed": 0,
      "startedAt": "2026-07-21T11:00:00Z",
      "completedAt": "2026-07-21T11:00:05Z"
    }
  ],
  "pagination": { "page": 1, "perPage": 25, "total": 89 }
}
```

### POST /automation/workflows/:id/test

Test a workflow with mock event data (dry run).

```json
{
  "mockEvent": {
    "type": "cart.abandoned",
    "data": { "customerId": "cst_001", "cartId": "cart_005", "itemCount": 3, "total": { "amount": 45000, "currency": "EUR" } }
  }
}
```

**Response `200`:**
```json
{
  "executionId": "exe_test_001",
  "triggerMatched": true,
  "actionsPreview": [
    { "type": "send_message", "simulated": true, "channel": "whatsapp", "recipientId": "cst_001" }
  ],
  "errors": []
}
```

### GET /automation/templates

List workflow templates (pre-built automation recipes).

### POST /automation/templates/:id/install

Install a template as a new workflow.

---

## Suppliers Module

Base path: `/suppliers`

### GET /suppliers

List suppliers.

**Query params:** `search`, `status` (`active|inactive|pending`), `sort`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "sup_001",
      "name": "Antwerp Diamond House",
      "code": "ADH-001",
      "contact": { "fullName": "Pieter van den Berg", "email": "pieter@antwerpdiamonds.be", "phone": "+3231234567" },
      "address": { "line1": "Hoveniersstraat 2", "city": "Antwerp", "country": "BE" },
      "productCategories": ["diamonds", "loose-gemstones"],
      "leadTime": { "min": 5, "max": 14, "unit": "days" },
      "paymentTerms": "net_30",
      "status": "active",
      "rating": 4.8
    }
  ],
  "pagination": {}
}
```

### POST /suppliers

Create supplier record.

### GET /suppliers/:id

Get full supplier profile with performance metrics.

```json
{
  "id": "sup_001",
  "name": "Antwerp Diamond House",
  "status": "active",
  "metrics": {
    "totalOrders": 45,
    "totalSpend": { "amount": 1250000, "currency": "EUR" },
    "onTimeDelivery": 0.96,
    "avgLeadTime": 8.3,
    "defectRate": 0.002
  }
}
```

### PATCH /suppliers/:id

Update supplier.

### POST /suppliers/:id/products

Link supplier to products they supply.

```json
{
  "productIds": ["prd_001", "prd_015", "prd_032"],
  "unitCost": { "amount": 5200, "currency": "EUR" },
  "moq": 1,
  "leadTime": { "min": 5, "max": 10, "unit": "days" }
}
```

### GET /suppliers/:id/performance

Detailed performance report.

**Query params:** `dateFrom`, `dateTo`

### GET /suppliers/:id/purchase-orders

List POs placed with this supplier.

### POST /suppliers/purchase-orders

Create a purchase order.

```json
{
  "supplierId": "sup_001",
  "warehouseId": "wh_001",
  "items": [
    { "productId": "prd_001", "variantId": "var_001", "quantity": 10, "unitCost": { "amount": 5200, "currency": "EUR" } }
  ],
  "expectedDelivery": "2026-08-15",
  "notes": "Request certificate of authenticity for each stone"
}
```

### PATCH /suppliers/purchase-orders/:id

Update PO status (receive items, etc.).

```json
{
  "status": "received",
  "receivedItems": [
    { "productId": "prd_001", "variantId": "var_001", "quantityReceived": 10, "quantityAccepted": 10 }
  ],
  "receivedAt": "2026-08-12T14:00:00Z"
}
```

---

## Integrations Module

Base path: `/integrations`

### GET /integrations

List all integrations with their connection status.

**Response `200`:**
```json
{
  "data": [
    { "id": "int_001", "provider": "stripe", "displayName": "Stripe Payments", "status": "connected", "enabled": true, "lastSyncAt": "2026-07-21T10:00:00Z" },
    { "id": "int_002", "provider": "shopify", "displayName": "Shopify Store", "status": "connected", "enabled": true },
    { "id": "int_003", "provider": "instagram", "displayName": "Instagram Shopping", "status": "error", "enabled": false, "errorMessage": "Token expired" },
    { "id": "int_004", "provider": "whatsapp", "displayName": "WhatsApp Business", "status": "connected", "enabled": true }
  ]
}
```

### POST /integrations/:provider/connect

Initiate OAuth or API key connection.

```json
// For API-key-based providers
{
  "apiKey": "sk_live_...",
  "webhookUrl": "https://api.lcos.io/webhooks/stripe",
  "config": { "mode": "live", "currency": "EUR" }
}
```

```json
// For OAuth providers — returns redirect URL
// Response:
{ "authorizationUrl": "https://...", "state": "state_token" }
```

### POST /integrations/:provider/oauth/callback

Complete OAuth flow.

### DELETE /integrations/:id

Disconnect integration.

### POST /integrations/:id/sync

Trigger manual sync.

### GET /integrations/:id/logs

View integration activity log.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "log_001",
      "event": "order.created",
      "direction": "outgoing",
      "status": "success",
      "requestBody": { /* truncated */ },
      "responseStatus": 200,
      "durationMs": 340,
      "createdAt": "2026-07-21T10:30:00Z"
    }
  ]
}
```

---

## Webhook Endpoints

Base path: `/webhooks`

These are endpoints called BY external providers (not by the client).

| Path | Provider | Description |
|------|----------|-------------|
| `POST /webhooks/stripe` | Stripe | Payment events, subscription changes |
| `POST /webhooks/shopify` | Shopify | Product sync, order creation |
| `POST /webhooks/whatsapp` | WhatsApp | Incoming messages, delivery receipts |
| `POST /webhooks/instagram` | Instagram | Comment events, DM events |
| `POST /webhooks/dhl` | DHL | Shipment status updates |
| `POST /webhooks/sendgrid` | SendGrid | Email delivery events |

---

## Common Schemas

### Address

```json
{
  "type": "shipping|billing|warehouse",
  "line1": "10 Avenue Montaigne",
  "line2": "Suite 4",
  "city": "Paris",
  "state": "Île-de-France",
  "postalCode": "75008",
  "country": "FR",
  "isDefault": true
}
```

### Money

```json
{
  "amount": 12500,
  "currency": "USD"
}
```

### Pagination

```json
{
  "page": 1,
  "perPage": 25,
  "total": 142,
  "totalPages": 6,
  "hasNext": true,
  "hasPrev": false
}
```

### API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `UNAUTHORIZED` | 401 | Missing or invalid auth |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `TENANT_MISMATCH` | 403 | Cross-tenant access attempt |
| `INTEGRATION_ERROR` | 502 | Downstream provider failed |
| `PLAN_LIMIT_EXCEEDED` | 402 | Feature not available on current plan |

---

## Rate Limiting

- **Authenticated:** 1,000 req/min per tenant
- **Unauthenticated:** 30 req/min per IP
- **AI Studio endpoints:** 100 req/min per tenant
- **Webhooks:** 10 req/sec per provider endpoint

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
