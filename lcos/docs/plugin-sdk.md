# Plugin / Extension SDK

## Overview

LCOS Plugin SDK enables third-party developers to extend and customize the platform. Plugins run in a **sandboxed environment** with controlled access to LCOS APIs, data, and UI surfaces.

---

## 1. Plugin Architecture

### Runtime Model

```
┌──────────────────────────────────────────────────────┐
│                   LCOS Platform                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Core App │  │ Plugin   │  │ Plugin             │  │
│  │ (NestJS) │  │ Runtime  │  │ Registry & Store   │  │
│  └────┬─────┘  └────┬─────┘  └────────────────────┘  │
│       │              │                                 │
│  ┌────▼──────────────▼──────┐                         │
│  │   Plugin Sandbox (isolated VM)                    │  │
│  │  ┌──────────┐ ┌──────────┐                        │  │
│  │  │ Plugin A │ │ Plugin B │                        │  │
│  │  └──────────┘ └──────────┘                        │  │
│  └───────────────────────────┘                         │
└──────────────────────────────────────────────────────┘
```

### Plugin Package Structure

```
my-plugin/
├── manifest.json          # Plugin metadata
├── index.js               # Entry point
├── hooks/                 # Hook handlers
│   ├── before-product-create.js
│   └── after-order-create.js
├── ui/                    # UI extensions
│   ├── dashboard-widget.js
│   └── product-tab.js
├── assets/                # Static assets
│   └── icon.svg
└── README.md
```

### manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Description of what the plugin does",
  "author": {
    "name": "Developer Name",
    "email": "dev@example.com",
    "website": "https://example.com"
  },
  "permissions": [
    "product:read",
    "product:write",
    "order:read"
  ],
  "hooks": [
    "before:product:create",
    "after:order:create",
    "before:product:delete"
  ],
  "ui": {
    "dashboard_widgets": ["revenue-chart"],
    "product_tabs": ["custom-pricing"],
    "settings_pages": ["my-plugin-config"]
  },
  "lifecycle": {
    "on_install": "hooks/on-install.js",
    "on_uninstall": "hooks/on-uninstall.js",
    "on_activate": "hooks/on-activate.js",
    "on_deactivate": "hooks/on-deactivate.js"
  },
  "min_lcos_version": "1.2.0"
}
```

---

## 2. Plugin Lifecycle

### States

```
Installed → Activated → Deactivated → Uninstalled
               │
               ▼
           Updated
```

| State | Description |
|---|---|
| **Discovered** | Listed in marketplace, not installed |
| **Installed** | Downloaded, manifest validated, permissions reviewed |
| **Activated** | Hooks registered, UI extensions loaded, logic running |
| **Deactivated** | Disabled by admin, code not executed |
| **Updated** | New version pulled from marketplace |
| **Uninstalled** | Removed, cleanup hooks called |

### Lifecycle Hooks

```typescript
// on-install.js
export async function onInstall(context: PluginContext) {
  // Create plugin-specific database tables
  await context.db.exec(`
    CREATE TABLE IF NOT EXISTS my_plugin_data (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      custom_field TEXT
    )
  `);
  // Set default configuration
  await context.settings.set('api_key', '');
  await context.settings.set('enabled', true);
}

// on-uninstall.js
export async function onUninstall(context: PluginContext) {
  // Clean up plugin data
  await context.db.exec(`DROP TABLE IF EXISTS my_plugin_data`);
  await context.settings.clear();
}
```

---

## 3. Hook System

### Hook Types

| Type | Description | Example |
|---|---|---|
| `before` | Runs before action. Can modify input or abort. | `before:product:create` |
| `after` | Runs after action. Can read result. | `after:order:create` |
| `on` | Reacts to state changes (no modification). | `on:deal:stage_changed` |
| `filter` | Transforms data before display. | `filter:product:list_response` |

### Event Catalog

#### Products

| Hook | Trigger | Payload |
|---|---|---|
| `before:product:create` | Before product creation | `{ data: CreateProductInput }` |
| `after:product:create` | After product creation | `{ product: Product }` |
| `before:product:update` | Before product update | `{ id: string, data: UpdateProductInput }` |
| `after:product:update` | After product update | `{ product: Product, changes: Diff }` |
| `before:product:delete` | Before product deletion | `{ id: string }` |
| `after:product:delete` | After product deletion | `{ id: string }` |
| `filter:product:list_response` | Before response sent | `{ products: Product[] }` |
| `on:product:price_changed` | Price change detected | `{ product_id, old_price, new_price }` |

#### Orders

| Hook | Trigger | Payload |
|---|---|---|
| `before:order:create` | Before order creation | `{ data: CreateOrderInput }` |
| `after:order:create` | After order creation | `{ order: Order }` |
| `before:order:update` | Before order update | `{ id: string, data: UpdateOrderInput }` |
| `after:order:update` | After order update | `{ order: Order }` |
| `on:order:status_changed` | Order status transition | `{ order_id, from, to }` |
| `on:order:payment_received` | Payment confirmed | `{ order_id, amount, method }` |
| `on:order:cancelled` | Order cancelled | `{ order_id, reason }` |
| `on:order:refunded` | Order refunded | `{ order_id, amount }` |

#### CRM

| Hook | Trigger | Payload |
|---|---|---|
| `before:deal:create` | Before deal creation | `{ data: CreateDealInput }` |
| `after:deal:create` | After deal creation | `{ deal: Deal }` |
| `on:deal:stage_changed` | Stage transition | `{ deal_id, from_stage, to_stage }` |
| `on:deal:won` | Deal marked won | `{ deal_id, value }` |
| `on:deal:lost` | Deal marked lost | `{ deal_id, reason }` |
| `before:contact:create` | Before contact creation | `{ data: CreateContactInput }` |
| `after:contact:create` | After contact creation | `{ contact: Contact }` |

#### System

| Hook | Trigger | Payload |
|---|---|---|
| `on:tenant:created` | New tenant onboards | `{ tenant_id, tier }` |
| `on:tenant:upgraded` | Tenant upgrades tier | `{ tenant_id, from, to }` |
| `on:user:created` | User invited/registered | `{ user_id, role }` |
| `on:user:deleted` | User removed | `{ user_id }` |
| `on:webhook:sent` | Webhook delivered | `{ event, status }` |

### Hook Handler Interface

```typescript
import { HookContext } from '@lcos/plugin-sdk';

export async function handler(context: HookContext, payload: any) {
  // context.api    → Authenticated LCOS API client
  // context.db     → Plugin-scoped database access
  // context.cache  → Shared cache (TTL-based)
  // context.log    → Plugin logger
  // context.settings → Plugin settings store
  // context.tenant → Current tenant info

  const { product } = payload;

  if (product.price > 10000) {
    // Flag high-value products
    await context.api.products.addTag(product.id, 'high-value');
  }

  // Return value modifies behavior for 'before' hooks:
  // - Return payload to continue unchanged
  // - Return modified payload to change input
  // - Throw error to abort the action
  return payload;
}
```

---

## 4. Custom Field & Entity Extensions

### Custom Fields

```typescript
// Plugin registers custom fields at activation
export async function onActivate(context: PluginContext) {
  // Add custom fields to products
  await context.api.registerCustomFields('product', [
    {
      key: 'custom_material',
      label: 'Material',
      type: 'string',
      required: false,
      section: 'Custom Plugin Fields',
    },
    {
      key: 'production_time',
      label: 'Production Time (days)',
      type: 'number',
      min: 1,
      max: 365,
      defaultValue: 14,
    },
    {
      key: 'is_vegan',
      label: 'Vegan-friendly',
      type: 'boolean',
      defaultValue: false,
    },
  ]);
}
```

### Custom Entities

Plugins can create new entity types stored in plugin-scoped tables:

```typescript
export async function onActivate(context: PluginContext) {
  // Register a custom entity type
  await context.api.registerEntity('sourcing_partner', {
    fields: [
      { key: 'name', type: 'string', required: true },
      { key: 'country', type: 'string' },
      { key: 'certifications', type: 'string[]' },
      { key: 'lead_time_days', type: 'number' },
      { key: 'minimum_order', type: 'number' },
    ],
    ui: {
      listView: true,
      detailView: true,
      searchable: true,
      parentEntity: 'product', // Attach to product detail
    },
  });

  // Query custom entities via context.db
  await context.db.query(
    `SELECT * FROM custom_sourcing_partner WHERE country = $1`,
    ['Italy']
  );
}
```

---

## 5. UI Extension Points

### Extension Locations

| Location | Component Type | Description |
|---|---|---|
| `dashboard:widget` | React component | Dashboard widget in grid |
| `product:tab` | React component | Tab in product detail |
| `contact:tab` | React component | Tab in contact detail |
| `order:sidebar` | React component | Sidebar panel in order view |
| `deal:sidebar` | React component | Sidebar panel in deal view |
| `settings:page` | React component | Full settings page |
| `header:action` | Button | Action button in header |
| `top:nav` | Link | Navigation link in sidebar |
| `list:action` | Button | Action in list view toolbar |
| `report:block` | React component | Block in report builder |

### UI Extension API

```typescript
// ui/dashboard-widget.jsx
import { useLCOS, Card, Chart } from '@lcos/ui-sdk';

export default function MyWidget() {
  const { api, tenant } = useLCOS();
  const [data, setData] = React.useState([]);

  React.useEffect(() => {
    api.get('/analytics/my-plugin-metrics')
      .then(setData);
  }, []);

  return (
    <Card title="My Plugin Widget" size="medium">
      <Chart type="bar" data={data} />
    </Card>
  );
}
```

### UI SDK Components

| Component | Description |
|---|---|
| `Card` | Container with title, actions |
| `Table` | Data table with sorting, filtering |
| `Chart` | Bar, line, pie, area charts |
| `Form` | Form builder with validation |
| `Button` | Styled button matching platform |
| `Modal` | Modal dialog |
| `Badge` | Status badge |
| `Tabs` | Tab container |
| `Select` | Searchable select |
| `DatePicker` | Date/time picker |

### Styling Contract

- UI extensions use CSS-in-JS (styled-components or CSS modules)
- CSS custom properties for theme integration:
  - `var(--color-primary)`, `var(--color-bg)`, `var(--spacing-unit)`, etc.
- Max widget height: 400px (scroll if overflow)
- Bundle size limit: 500 KB per plugin

---

## 6. Plugin Permissions & Security

### Permission Model

```json
{
  "permissions": [
    "product:read",
    "product:write",
    "order:read",
    "customer:read",
    "webhook:send"
  ]
}
```

### Permission Categories

| Scope | Permissions |
|---|---|
| `product:*` | read, write, delete |
| `order:*` | read, write, delete |
| `customer:*` | read, write |
| `deal:*` | read, write |
| `analytic:*` | read |
| `webhook:*` | send |
| `settings:*` | read, write (plugin scope) |
| `user:*` | read (limited) |

### Security Constraints

| Constraint | Implementation |
|---|---|
| Sandboxed execution | Isolated V8 context (isolated-vm) |
| CPU limits | 100ms per hook execution |
| Memory limits | 64 MB heap per plugin |
| Network access | Allowlisted domains only |
| File system | Read-only access to plugin's own assets |
| Database | Plugin-scoped tables only (no core tables) |
| API rate limit | 100 requests/minute per plugin |
| Timeout | All hooks timeout at 30 seconds |

### Permission Review Flow

1. Plugin declares required permissions in `manifest.json`
2. On install, admin sees permission list and approves/rejects
3. Permissions can be revoked at any time from Settings
4. Plugin receives `permissions_changed` event if modified post-install

---

## 7. Plugin Marketplace

### Marketplace Architecture

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│          │   │          │   │          │
│ Developer├──►│ LCOS     ├──►│ Tenant   │
│ Portal   │   │ Registry │   │ Dashboard│
│          │   │          │   │          │
└──────────┘   └──────────┘   └──────────┘
```

### Developer Portal

- **Submission**: Upload plugin package (ZIP, max 10 MB)
- **Validation**: Automated manifest check + security scan
- **Review**: Manual review for first submission
- **Versioning**: Semver, changelog required
- **Revenue Share**: 70% developer, 30% LCOS

### Listing Page

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "tagline": "Short description (100 chars)",
  "description": "Full description (markdown, up to 5000 chars)",
  "icon": "https://assets.lcos.app/plugins/my-plugin/icon.svg",
  "screenshots": ["url1", "url2"],
  "category": "analytics",
  "pricing": {
    "model": "free",      // "free" | "paid" | "freemium"
    "price": 0,
    "trial_days": 0
  },
  "rating": 4.5,
  "downloads": 1240,
  "version": "1.2.0",
  "updated_at": "2026-07-21T00:00:00Z"
}
```

### Installation Flow

1. Browse marketplace → click plugin
2. View details, screenshots, reviews
3. Click "Install"
4. Review permissions dialog
5. Approve permissions
6. Plugin installed and activated
7. Configuration page (if needed) shown

---

## 8. Example Plugin Walkthrough

### Plugin: "Luxury Certification Badge"

Attaches sustainability/certification badges to products based on custom fields.

#### manifest.json

```json
{
  "id": "luxury-cert-badge",
  "name": "Luxury Certification Badge",
  "version": "1.0.0",
  "description": "Display certification badges (GOTS, Fair Trade, etc.) on product cards",
  "permissions": ["product:read", "product:write"],
  "hooks": ["filter:product:list_response"],
  "ui": {
    "product_tabs": ["certifications"],
    "dashboard_widgets": ["cert-summary"]
  }
}
```

#### Hook: Add badge data to product list response

```typescript
// hooks/filter-product-list.js
export async function handler(context, { products }) {
  // For each product, check custom certification fields
  for (const product of products) {
    const certs = await context.db.query(
      `SELECT certification, verified FROM custom_certifications WHERE product_id = $1`,
      [product.id]
    );
    product.badges = certs.map(c => ({
      type: c.certification,
      verified: c.verified,
      icon: `/plugins/luxury-cert-badge/assets/${c.certification}.svg`,
    }));
  }
  return { products };
}
```

#### UI: Product tab showing certifications

```typescript
// ui/product-tab.jsx
import { useLCOS, Card, Badge } from '@lcos/ui-sdk';

export default function CertificationsTab({ productId }) {
  const { api } = useLCOS();
  const [certs, setCerts] = React.useState([]);

  React.useEffect(() => {
    api.get(`/plugins/luxury-cert-badge/${productId}/certs`).then(setCerts);
  }, [productId]);

  return (
    <Card title="Certifications">
      {certs.length === 0 && <p>No certifications assigned.</p>}
      {certs.map(cert => (
        <Badge
          key={cert.id}
          variant={cert.verified ? 'success' : 'warning'}
          icon={cert.icon}
        >
          {cert.name} ({cert.issuer})
        </Badge>
      ))}
      <Button onClick={() => /* open add dialog */}>
        Add Certification
      </Button>
    </Card>
  );
}
```

#### UI: Dashboard widget

```typescript
// ui/dashboard-widget.jsx
import { useLCOS, Card, Chart } from '@lcos/ui-sdk';

export default function CertSummary() {
  const { api } = useLCOS();
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    api.get('/plugins/luxury-cert-badge/stats').then(setStats);
  }, []);

  if (!stats) return <Card title="Certifications" loading />;

  return (
    <Card title="Certification Overview" size="small">
      <Chart type="donut" data={[
        { label: 'Certified', value: stats.certified },
        { label: 'Pending', value: stats.pending },
        { label: 'None', value: stats.none },
      ]} />
    </Card>
  );
}
```

#### Lifecycle: Create custom table on install

```typescript
// hooks/on-install.js
export async function onInstall(context) {
  await context.db.exec(`
    CREATE TABLE custom_certifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id TEXT NOT NULL,
      certification TEXT NOT NULL,
      issuer TEXT,
      verified BOOLEAN DEFAULT false,
      verified_date TIMESTAMP,
      expiry_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// hooks/on-uninstall.js
export async function onUninstall(context) {
  await context.db.exec(`DROP TABLE IF EXISTS custom_certifications`);
}
```

### Marketplace Listing

- **Category**: Product Enhancement
- **Pricing Model**: Free
- **Downloads**: 850+
- **Rating**: 4.7/5.0 (23 reviews)
