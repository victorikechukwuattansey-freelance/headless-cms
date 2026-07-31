# Business OS Suite — Design Spec

**Date:** 2026-07-21
**Status:** Approved design
**Architecture:** Approach A — Shared core library (`os-core.js`) loaded by each niche HTML file

---

## Architecture

```
os-core.js            ← shared: storage engine, UI components, navigation, schemas
agency.html           ← imports core + team mgmt, full pipeline, P&L
freelancer.html       ← imports core + time tracking, simplified invoicing
coach.html            ← imports core + sessions, packages, progress tracking
realestate.html       ← imports core + properties, dual pipeline, commissions
creator.html          ← imports core + content calendar, brand deals, revenue streams
```

All files are single-file HTML/JS with localStorage persistence. Serve via `npx serve .` or Python `http.server`.

---

## Shared Core (`os-core.js`)

### Data Engine

- localStorage-backed CRUD with auto-save on every mutation
- Schema registry with per-schema defaults, validation rules, and indexing
- Filtering, sorting, and search across any schema
- CSV/JSON export and import
- Data versioning for future migration support

### Core Schemas

| Schema | Fields | Used By |
|---|---|---|
| `contacts` | id, name, email, phone, company, tags, notes, createdAt, updatedAt | All |
| `deals` | id, contactId, title, value, stage, probability, expectedClose, notes | Agency, Freelancer, RE |
| `projects` | id, name, status, tasks[], deadline, budget, notes | All |
| `tasks` | id, projectId, title, assignee, due, status, priority | All |
| `invoices` | id, contactId, items[], total, status, dueDate, paidDate | Agency, Freelancer |
| `sessions` | id, contactId, type, date, duration, notes, status | Coach |
| `properties` | id, address, type, price, status, ownerId, images[] | RE Agent |
| `content` | id, title, platform, status, dueDate, publishedDate, notes | Creator |

### UI Components (pure functions, no framework dependency)

| Component | Signature | Description |
|---|---|---|
| `renderTable` | (data, columns, actions) | Sortable, filterable table with action buttons per row |
| `renderForm` | (schema, data, onSubmit) | Auto-generates labeled inputs from schema definition |
| `showModal` | (title, content) | Overlay dialog with close button |
| `renderKanban` | (dealsByStage, stageConfig) | Drag to move deals between pipeline stages |
| `renderCards` | (items, template) | Dashboard card grid with metric display |
| `showToast` | (message, type) | Status notifications (success, error, info) |
| `renderCalendar` | (items, dateField) | Monthly calendar grid with event dots |
| `searchBar` | (onSearch) | Global search across current schema |

### Layout

```
+---------------------------------------------------+
|  App Name        [Search]    [Export]    [⚙]      |
+----------+----------------------------------------+
| NAV      |                                        |
| SIDEBAR  |   Active screen content                |
|          |   (rendered by screen router)           |
| [📊]     |                                        |
|  Dash    |                                        |
| [👤]     |                                        |
|  Clients |                                        |
| [💼]     |                                        |
|  Deals   |                                        |
| ...      |                                        |
+----------+----------------------------------------+
```

### Navigation Configuration

Each app passes a nav config: `[{ icon, label, screen, badge }]`. Core renders the sidebar and routes clicks to screen renderers.

---

## Agency OS (`agency.html`)

### Screens

| Navigation | Screen | Description |
|---|---|---|
| Dashboard | `dashboard` | Revenue MTD, active deals, pipeline velocity, team workload |
| Pipeline | `pipeline` | Kanban: Lead → Qualified → Proposal → Negotiation → Closed Won/Lost. Drag deals. Quick-edit modals |
| Clients | `clients` | Contact table with deal count, total value, last contact |
| Team | `team` | Team members table. Add/edit/remove members. Assign to deals |
| Projects | `projects` | Full project list with task breakdown per project |
| Finances | `finances` | P&L view: revenue vs expenses by month/client/project |
| Invoices | `invoices` | Create from deals, track status, overdue alerts |
| Reports | `reports` | Win rate, avg deal size, pipeline velocity, forecast |

### Niche Schemas

- `team`: id, name, role, email, capacity, assignedDeals[]
- `expenses`: id, projectId, category, amount, date, vendor
- Deals extended with: assignedTo, source, dealType

### Pipeline Stages

Lead → Qualified → Proposal → Negotiation → Closed Won / Closed Lost

---

## Freelancer OS (`freelancer.html`)

### Screens

| Navigation | Screen | Description |
|---|---|---|
| Dashboard | `dashboard` | Earnings MTD, active projects, upcoming deadlines, unpaid invoices |
| Clients | `clients` | Client list (simplified — no lead pipeline) |
| Projects | `projects` | Project tracker with per-task time logging |
| Time Log | `time` | Weekly timesheet: date, project, hours, description |
| Invoices | `invoices` | Create from projects or timesheets. Mark paid. Due date alerts |
| Expenses | `expenses` | Expense entries with tax category. Export for taxes |

### Key Differences from Agency

- No team management or deal pipeline kanban
- Time tracking as a first-class feature
- Expenses include tax categorization
- Invoices support hourly (from timesheet) or fixed-price

---

## Coach OS (`coach.html`)

### Screens

| Navigation | Screen | Description |
|---|---|---|
| Dashboard | `dashboard` | Sessions this week, active clients, revenue MTD, upcoming schedule |
| Clients | `clients` | Client list with coaching-specific fields: goals, package, session count, status |
| Sessions | `sessions` | Schedule view + session log. Notes per session, duration, status |
| Progress | `progress` | Per-client milestones, goal check-ins, progress indicators |
| Packages | `packages` | Define packages: sessions included, price, duration, add-ons |
| Invoices | `invoices` | Track package purchases, payment plans, installment reminders |
| Resources | `resources` | Shareable client resources: links, docs, worksheets |

### Niche Schemas

- `packages`: id, name, sessionsCount, price, durationMonths, addOns[]
- Sessions extended with: packageId, clientFeedback
- `milestones`: id, clientId, title, dueDate, completedDate, status

---

## Real Estate OS (`realestate.html`)

### Screens

| Navigation | Screen | Description |
|---|---|---|
| Dashboard | `dashboard` | Active listings, upcoming showings, deals in pipeline, commission forecast |
| Pipeline | `pipeline` | Dual kanban: Buyers (Searching → Tours → Offer → Closed) | Sellers (Listing → Showings → Offer → Closed) |
| Properties | `properties` | Listing database: address, price, type, status, features, images |
| Clients | `clients` | Buyer (criteria, budget) / Seller (property) split |
| Showings | `showings` | Schedule + feedback log per showing |
| Commissions | `commissions` | Commission amounts, split with brokerage, 1099-ready reports |
| Market | `market` | Manual comps tracker: recent sales, avg days on market, price trends |

### Niche Schemas

- `properties`: id, address, type, price, status, bedrooms, bathrooms, sqft, lotSize, yearBuilt, features[], ownerId, images[]
- `showings`: id, propertyId, clientId, date, feedback, status
- Deal extended with: propertyId, commission%, brokerSplit, side (buy/sell)

### Pipeline Stages

- **Buyer:** Searching → Tours → Making Offer → Under Contract → Closed
- **Seller:** Listing Prep → Listed → Showings → Offer → Under Contract → Closed

---

## Creator OS (`creator.html`)

### Screens

| Navigation | Screen | Description |
|---|---|---|
| Dashboard | `dashboard` | Content due this week, published this month, revenue by platform, upcoming brand deals |
| Content | `content` | Table + calendar: title, platform, format, status, publish date, metrics |
| Calendar | `calendar` | Monthly grid view of content by platform with status colors |
| Brand Deals | `deals` | Deal lifecycle: pitch → negotiated → signed → delivered → paid |
| Revenue | `revenue` | Income by platform, by brand, by month. Sponsor breakdown |
| Tasks | `tasks` | Production pipeline: Ideate → Script → Film → Edit → Publish → Promote |
| Collaborators | `collaborators` | Contact list: collaborators, brands, agencies, featured guests |

### Niche Schemas

- Content extended with: format (video/article/short/podcast), platform, metrics (views, likes, comments)
- `brandDeals`: id, brand, platform, payment, deliverables[], status, deadline, paidDate
- `revenueEntries`: id, source, platform, amount, date, brand, type (sponsor/ad/merch/affiliate)

---

## Implementation Plan

### Phase 1: Core Library
1. `os-core.js` — data engine + storage layer
2. `os-core.js` — UI components (table, form, modal, kanban, cards, toast, calendar)
3. `os-core.js` — navigation + screen routing + layout
4. Test with a minimal test app

### Phase 2: Agency OS
1. `agency.html` — scaffold with nav config, import core
2. Dashboard, Pipeline (kanban), Clients screens
3. Team management, Projects, Finances, Invoices
4. Reports screen with charts

### Phase 3: Freelancer OS
1. `freelancer.html` — scaffold, import core
2. Dashboard, Clients, Projects with time tracking
3. Time Log, Invoices, Expenses screens

### Phase 4: Coach OS
1. `coach.html` — scaffold, import core
2. Dashboard, Clients, Sessions
3. Progress, Packages, Invoices, Resources

### Phase 5: Real Estate OS
1. `realestate.html` — scaffold, import core
2. Dashboard, dual Pipeline (buyer/seller)
3. Properties, Clients, Showings
4. Commissions, Market tracker

### Phase 6: Creator OS
1. `creator.html` — scaffold, import core
2. Dashboard, Content, Calendar
3. Brand Deals, Revenue, Tasks, Collaborators
