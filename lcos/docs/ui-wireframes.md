# LCOS UI Wireframes

## Overview

The LCOS interface follows a **sidebar + header + content area** layout pattern. All screens share a consistent chrome with role-based navigation. The design prioritizes density for power users while remaining approachable for new operators.

---

## 1. Dashboard Layout

### Structure

```
+----------------------------------------------------------+
| [Logo]  [Search]                    [Notifs] [Avatar]     |  ← Header (64px)
+----------+-----------------------------------------------+
|          |                                                 |
| Home     |  +-------------------------------------------+ |
| Products |  | Welcome back, Alex                         | |
| Inventory|  |                                            | |
| CRM      |  | [Revenue Card] [Orders Card] [Visitors]    | |
| Orders   |  | [Realtime Pipeline Mini]                    | |
| Marketing|  | [Recent Activity Feed]                      | |
| Analytics|  | [Quick Actions: +Product +Order +Campaign]  | |
| Settings |  |                                            | |
|          |  +-------------------------------------------+ |
| [Upgrade]|                                                 |
+----------+-----------------------------------------------+
```

### Sidebar Specifications

| Property | Value |
|---|---|
| Width | 240px (collapsible to 64px) |
| Background | Gray-50 (`#F9FAFB`) |
| Items | Icons + labels, 48px height |
| Active state | Left border accent (indigo-600) |
| Collapsed | Hover reveals tooltip labels |
| Bottom area | Upgrade CTA, user menu |

### Header Specifications

| Property | Value |
|---|---|
| Height | 64px |
| Background | White |
| Elements | Global search (CMD+K), notification bell with badge, avatar dropdown |
| Sticky | Yes, `position: sticky; top: 0; z-index: 40` |

### Responsive Behavior

| Breakpoint | Layout Change |
|---|---|
| ≥ 1280px | Full sidebar + content |
| 1024px – 1279px | Collapsed sidebar (icon-only) |
| 768px – 1023px | Sidebar hidden, hamburger toggle |
| < 768px | Bottom nav bar, full-width content |

---

## 2. Product List View

### Layout

```
+----------------------------------------------------------+
| Products                      [+ New Product] [Filter]    |
| [Bulk Actions ▾] [Sort: Newest ▾]     Showing 24 of 142  |
+----------------------------------------------------------+
|                                                           |
| [Grid View Toggle / Table View Toggle]                    |
|                                                           |
| +-------+-------------------+----------+--------+------+  |
| | Image | Name / SKU        | Category | Price  | Stock|  |
| +-------+-------------------+----------+--------+------+  |
| | [img] | Silk Evening Gown | Dresses  | $2,400 | 12   |  |
| |       | SKU: SEG-001      |          |        |      |  |
| +-------+-------------------+----------+--------+------+  |
| | [img] | Cashmere Blazer   | Outerwear| $1,800 | 8    |  |
| |       | SKU: CB-042       |          |        |      |  |
| +-------+-------------------+----------+--------+------+  |
|                                                           |
|                    [<] 1 2 3 ... 6 [>]                    |
+----------------------------------------------------------+
```

### Key UI Elements

| Element | Specification |
|---|---|
| View toggle | Grid (card) / Table (list) — persisted to user preferences |
| Bulk actions | Checkbox column; actions: Delete, Update Category, Export |
| Quick edit | Inline price/stock editing on double-click |
| Empty state | Illustration + "Import your first product" CTA |
| Loading state | Skeleton cards (CSS shimmer animation) |
| Error state | Alert banner + Retry button |

### Filter Panel (Slide-out)

| Filter Type | Control |
|---|---|
| Category | Multi-select dropdown (hierarchical) |
| Price range | Range slider (min/max) |
| Stock status | Toggle chips: In Stock / Low Stock / Out of Stock |
| Tags | Autocomplete input with tag chips |
| Date added | Date range picker |

---

## 3. Product Detail View

### Layout

```
+----------------------------------------------------------+
| [← Back to Products]    Product ID: PRD-0042              |
| [Edit] [Duplicate] [Delete] [More ▾]                     |
+----------------------------------------------------------+
| +----------+ +------------------------------------------+ |
| |          | | Silk Evening Gown                         | |
| | [Main    | | SKU: SEG-001   Category: Dresses          | |
| |  Image]  | |                                           | |
| |          | | $2,400.00    | Stock: 12    | Backorders  | |
| | [img2]   | | [Status: Active]                          | |
| | [img3]   | |                                           | |
| | [img4]   | | [Size:  S ▾] [Color: Black ▾] [Qty: 1]    | |
| +----------+ | [Pricing Table] [Variant Matrix]           | |
|              +------------------------------------------+ |
+----------------------------------------------------------+
| Variants | Description | SEO | Media | History             |
| +------------------------------------------------------+ |
| | Size | Color | SKU      | Price  | Stock | Actions    | |
| | S    | Black | SEG-001B | $2,400 | 4     | [Edit]    | |
| | M    | Black | SEG-002B | $2,400 | 5     | [Edit]    | |
| | L    | Black | SEG-003B | $2,400 | 3     | [Edit]    | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

### Tab Specifications

| Tab | Content |
|---|---|
| Variants | Variant matrix (size/color/price/stock) with bulk editor |
| Description | Rich text editor (TipTap/Quill) with character count |
| SEO | Meta title, description, slug preview, social share preview |
| Media | Image gallery manager with drag-drop reorder |
| History | Audit log of all changes to this product |

---

## 4. CRM / Kanban Pipeline View

### Layout

```
+----------------------------------------------------------+
| CRM Pipeline              [+ Add Deal] [▾ View Options]   |
| [Board View] [List View] [Table View]                     |
+----------------------------------------------------------+
|                                                           |
| Lead      | Qualified  | Proposal  | Negotiation | Closed |
| (12)      | (8)        | (5)       | (3)         | Won/Lost|
|-----------+------------+-----------+-------------+--------|
| +-------+ | +-------+  | +-------+ | +-------+   |        |
| | Alex  | | | Sarah |  | | James | | | Emma |   |        |
| | $12K  | | | $45K  |  | | $89K  | | | $120K|   |        |
| | 2d ago| | | 5d ago|  | | 1d ago| | | 3d ago|   |        |
| +-------+ | +-------+  | +-------+ | +-------+   |        |
| +-------+ | +-------+  | +-------+ |             |        |
| | Brian | | | Tom   |  | | Lisa  | |             |        |
| | $8K   | | | $22K  |  | | $34K  | |             |        |
| | 1d ago| | | 3d ago|  | | 2d ago| |             |        |
| +-------+ | +-------+  | +-------+ |             |        |
|                                                           |
+----------------------------------------------------------+
```

### Card Specifications

| Property | Value |
|---|---|
| Width | 280px per column |
| Card padding | 12px |
| Card shadow | `0 1px 3px rgba(0,0,0,0.08)` |
| Hover state | `0 4px 12px rgba(0,0,0,0.12)` |
| Max cards before scroll | 8 (then "Show more" link) |
| Drag handle | 6-dot icon top-right on hover |

### Additional Features

- **Won/Lost column**: Split column with visual divider
- **Deal preview slide-out**: Click card → right panel shows full deal details
- **Pipeline summary bar**: Above board shows total value, weighted forecast, conversion rate
- **Kanban WIP limits**: Optional column limits with visual warning when exceeded

---

## 5. AI Studio Chat Interface

### Layout

```
+----------------------------------------------------------+
| AI Studio                                    [History ▾]  |
+----------------------------------------------------------+
| +------------------------------------------------+       |
| |                                                |       |
| |  AI Assistant • LCOS GPT v2.1                  |       |
| |                                                |       |
| |  ┌─────────────────────────────────────────┐   |       |
| |  │ Welcome to AI Studio. I can help you    │   |       |
| |  │ analyze sales, draft campaigns, or      │   |       |
| |  │ answer questions about your data.       │   |       |
| |  │                                         │   |       |
| |  │ [Suggested: "Show top products this     │   |       |
| |  │  month"] ["Draft email to VIP clients"] │   |       |
| |  └─────────────────────────────────────────┘   |       |
| |                                                |       |
| |  ┌─────────────────────────────────────────┐   |       |
| |  │ User: Show top products this month      │   |       |
| |  └─────────────────────────────────────────┘   |       |
| |                                                |       |
| |  ┌─────────────────────────────────────────┐   |       |
| |  │ AI: Here are your top 5 products by     │   |       |
| |  │ revenue this month:                     │   |       |
| |  │                                         │   |       |
| |  │ 1. Silk Evening Gown - $28,800         │   |       |
| |  │ 2. Cashmere Blazer - $14,400           │   |       |
| |  │ 3. Leather Oxfords - $9,600            │   |       |
| |  │                                         │   |       |
| |  │ [Export Report] [Create Campaign]       │   |       |
| |  └─────────────────────────────────────────┘   |       |
| |                                                |       |
| +------------------------------------------------+       |
|                                                           |
| [Attach] [@ Mention data] [Message input] [Send ▸]       |
| +----------------------------------------------------------+
```

### Layout Specifications

| Element | Specification |
|---|---|
| Chat panel | 75% width, centered on desktop |
| Message max width | 720px |
| AI avatar | LCOS logo monogram, 32px circle |
| User avatar | User initial, 32px circle, brand color |
| Code blocks | Syntax-highlighted, copy button |
| Timestamps | Relative (2m ago, 1h ago) |

### Features

- **@ mentions**: `@products`, `@orders`, `@customers` to narrow AI context
- **Suggested prompts**: Context-aware quick actions below welcome message
- **Action buttons**: AI response can include actionable buttons (Export, Create, Schedule)
- **Conversation history**: Left sidebar toggle showing past sessions with search
- **Streaming responses**: Server-sent events for real-time token display

---

## 6. Automation Workflow Builder

### Layout

```
+----------------------------------------------------------+
| Automation Builder              [Save] [Publish] [Test]   |
| Workflow: "VIP Reorder Reminder"                          |
+----------------------------------------------------------+
|                                                           |
| +--------------------------------------------------------+|
| | Canvas Area (Infinite pan/zoom)                        ||
| |                                                        ||
| |  [Order Placed] ──→ [Check Customer] ──→ [Condition]  ||
| |                         Segment: VIP        │          ||
| |                                              ├── [Yes]  ||
| |                                              │   → [Send │
| |                                              │    SMS]   |
| |                                              │          ||
| |                                              ├── [No]   ||
| |                                              │   → [End] ||
| |                                                        ||
| +--------------------------------------------------------+
|                                                           |
| +----------+  +----------+  +-----------+  +-----------+  |
| | Trigger  |  | Condition|  | Action    |  | Delay     |  |
| | (click   |  | (click   |  | (click    |  | (click    |  |
| | to drag) |  | to drag) |  | to drag)  |  | to drag)  |  |
| +----------+  +----------+  +-----------+  +-----------+  |
+----------------------------------------------------------+
```

### Canvas Specifications

| Property | Value |
|---|---|
| Canvas background | Dotted grid (20px spacing) |
| Zoom range | 50% – 200% |
| Snap to grid | Yes (20px increments) |
| Node width | 240px |
| Connection line | Bezier curve, 2px, indigo-500 |
| Node types | Trigger (green), Condition (diamond, amber), Action (blue), Delay (gray) |

### Component Palette (Bottom Panel)

| Category | Nodes |
|---|---|
| Triggers | Order Placed, Customer Created, Inventory Low, Date Reached, Webhook Received |
| Conditions | Customer Segment, Product Category, Order Value, Stock Level |
| Actions | Send Email, Send SMS, Update Tags, Create Task, HTTP Request, Slack Message |
| Flow Control | Delay, Loop, Split, End |

### Node Configuration (Slide-out Panel)

When a node is clicked, a right panel (320px) opens with configuration fields:

- **Trigger**: Select event type, optional filters
- **Condition**: Field, operator, value
- **Action**: Service selection, template/body, recipients
- **Delay**: Duration (minutes/hours/days) or time expression (cron)

---

## 7. Mobile Responsive Layout Notes

### Breakpoint System

```
Mobile:    < 768px    (Base)
Tablet:    768 – 1023px
Desktop:   1024 – 1279px
Wide:      ≥ 1280px
```

### Mobile Navigation

- **Bottom navigation bar** with 5 tabs: Home, Products, CRM, AI, More
- **More tab** opens a drawer with all remaining nav items
- **Sidebar** becomes a full-screen overlay drawer when toggled via hamburger

### Mobile Adaptations

| Component | Desktop | Mobile |
|---|---|---|
| Table | Full table with columns | Card list with key fields, "View more" expands |
| Kanban board | Horizontal scroll columns | Single column stack with swipe to move |
| AI Studio | Side-by-side chat + history | Full-screen chat, history in bottom sheet |
| Workflow builder | Canvas with drag-drop | Step-by-step wizard (simplified) |
| Filters | Persistent sidebar | Bottom sheet overlay |
| Date picker | Inline calendar | Native input `type="date"` |
| Multi-select | Dropdown with search | Modal list with checkboxes |

### Touch Interactions

| Action | Gesture |
|---|---|
| Move Kanban card | Long press → drag |
| Swipe to next tab | Horizontal swipe (on tabs) |
| Pull to refresh | Vertical pull on list pages |
| Context menu | Long press on item → action sheet |
| Modal dismiss | Swipe down on modal |

---

## 8. Navigation & Information Architecture

### Navigation Hierarchy

```
Dashboard
├── Overview
├── Real-time Pipeline
└── Quick Actions

Products
├── All Products
├── Categories
├── Inventory Management
├── Pricing Rules
└── Imports / Exports

CRM
├── Pipeline (Kanban)
├── Contacts
├── Companies
├── Deals
└── Activities

Orders
├── All Orders
├── Drafts / Quotes
├── Returns & Refunds
└── Shipping

Marketing
├── Campaigns
├── Email Templates
├── Segments
└── Social Posts

Analytics
├── Sales Reports
├── Customer Reports
├── Product Performance
└── Custom Reports

AI Studio
├── Chat
├── Campaign Generator
├── Report Generator
└── Playbook Suggestions

Settings
├── General
├── Team & Roles
├── Integrations
├── Billing
├── Automation (Workflows)
├── Webhooks
├── API Keys
└── Branding
```

### Breadcrumb Pattern

`Home > Products > Silk Evening Gown`

Each breadcrumb segment is clickable. On mobile, the breadcrumb collapses to show only the current page with a back arrow to the parent.

### Global Search (CMD+K)

| Feature | Specification |
|---|---|
| Trigger | CMD+K (Mac) / CTRL+K (Windows) |
| Scope | Products, Orders, Contacts, Deals, Settings |
| Results | 10 maximum per category |
| Actions | Navigate, quick edit, copy ID |
| Keyboard nav | Arrow keys, Enter to select, Esc to dismiss |

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `CMD+K` | Global search |
| `CMD+N` | New record (context-aware) |
| `CMD+B` | Toggle sidebar |
| `CMD+S` | Save current form |
| `CMD+/` | Show keyboard shortcuts help |
| `Escape` | Close panel / dismiss modal |
| `?` | Open help center |
