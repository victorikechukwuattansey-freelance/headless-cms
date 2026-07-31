# MCP Marketplace & Ecosystem - AI Social Media OS

> **Version:** 1.0
> **Date:** 2026-07-22
> **Audience:** Platform engineering, developer relations, ecosystem partners
> **Status:** Draft for review

---

## Table of Contents

1. [Marketplace Overview](#1-marketplace-overview)
2. [MCP Server Packaging Format](#2-mcp-server-packaging-format)
3. [Discovery & Search](#3-discovery--search)
4. [Installation Flow](#4-installation-flow)
5. [Security Review Process](#5-security-review-process)
6. [Developer Portal](#6-developer-portal)
7. [Monetization](#7-monetization)
8. [Version Management](#8-version-management)
9. [Rating & Review System](#9-rating--review-system)
10. [Example MCP Servers](#10-example-mcp-servers)

---

## 1. Marketplace Overview

### 1.1 Purpose

The MCP (Model Context Protocol) Marketplace is the extension ecosystem for the AI Social Media OS. It allows third-party developers to build integrations that extend the platforms capabilities through standardized MCP servers. The marketplace bridges the gap between the core platform and the diverse tools, APIs, and data sources that social media managers use daily.

### 1.2 Target Audiences

| Audience | Needs | Value Proposition |
|---|---|---|
| **Individual creators** | Connect existing tools (CMS, analytics) | Browse-and-install simplicity, free tier |
| **Social media agencies** | Custom reporting, bulk ops, client workflows | Time savings, white-label, team billing |
| **E-commerce businesses** | Product sync, order notifications | Direct Shopify/WooCommerce integration |
| **Enterprise teams** | Compliance, SSO, custom analytics | Audit trails, SLA, private servers |
| **Developers** | Build and sell integrations | Revenue sharing, API access, dev tools |
| **Platform partners** | Official integrations | Co-marketing, featured placement |

### 1.3 Ecosystem Architecture

`
+------------------------------------------------------------------+
|                       SOCIAL OS PLATFORM                          |
|  +------------------+  +------------------+  +------------------+ |
|  |   Core Platform  |  |   MCP Client     |  |   Developer API  | |
|  |   (Scheduler,    |  |   (Built-in)     |  |   (Auth/Usage)   | |
|  |   Composer,      |  |   Discovers MCP  |  |   CRUD servers   | |
|  |   Analytics,     |  |   servers via    |  |   Manage keys    | |
|  |   Inbox, etc.)   |  |   one-click      |  |   View metrics   | |
|  +------------------+  +--------+---------+  +--------+---------+ |
+------------------------------------------------------------------+
                                  |                           |
                    +-------------+              +------------+
                    v                              v
+----------------------------------+  +---------------------------+
|         MCP MARKETPLACE          |  |    DEVELOPER PORTAL       |
|  Search / Browse / Install       |  |  Server Management        |
|  Reviews / Security / Version    |  |  API Keys / Analytics     |
+----------------------------------+  |  Payouts / Docs          |
                    |                 +---------------------------+
                    v
+------------------------------------------------------------------+
|                    MCP SERVER RUNTIME (Sandboxed)                 |
|  +------------------+  +------------------+  +------------------+ |
|  |  Blog-to-Post    |  |  Ecom Sync       |  |  Analytics       | |
|  |  Server          |  |  Server          |  |  Reporter        | |
|  +------------------+  +------------------+  +------------------+ |
+------------------------------------------------------------------+
`

### 1.4 MCP Protocol

Each MCP server exposes: **Tools** (executable actions), **Resources** (data sources), and **Prompts** (pre-built templates). Servers run in sandboxed environments with resource limits, network access controls, and data isolation.

---
## 2. MCP Server Packaging Format

### 2.1 Package Structure

```
socialos-mcp-server/
  manifest.json              # Required: server metadata
  server.js                  # Required: entry point
  package.json               # Required: dependencies
  config.schema.json         # Optional: JSON Schema for configuration UI
  README.md / CHANGELOG.md / LICENSE
  icon.png                   # Recommended: 256x256
  screenshots/               # Recommended: for marketplace listing
  examples/                  # Tool call examples
  i18n/                      # Optional: localized descriptions
```

### 2.2 manifest.json Specification

```json
{
  "manifest_version": "1.0.0",
  "id": "com.socialos.mcp.blog-to-post",
  "name": "Blog to Post",
  "version": "1.2.0",
  "description": "Fetch RSS/Atom feeds, summarize articles with AI, and create scheduled social posts.",
  "short_description": "Turn blog posts into social content automatically.",
  "categories": ["content-generation", "automation", "rss"],
  "tags": ["rss", "blog", "summarization", "repurposing", "wordpress"],
  "author": {
    "name": "SocialOS Inc.",
    "email": "ecosystem@socialos.com",
    "url": "https://socialos.com/ecosystem"
  },
  "entry": "server.js",
  "runtime": "nodejs",
  "runtime_version": ">=18.0.0",
  "permissions": [
    "network:outbound:rss-feeds",
    "network:outbound:socialos-api",
    "storage:server"
  ],
  "config_schema": "config.schema.json",
  "resources": {
    "cpu": "0.5", "memory": "256MB",
    "network": "outbound-only", "timeout_ms": 30000
  },
  "tools": [
    {
      "name": "fetch_blog_posts",
      "description": "Fetch recent posts from an RSS or Atom feed",
      "input_schema": {
        "type": "object",
        "properties": {
          "feed_url": { "type": "string", "format": "uri" },
          "max_posts": { "type": "integer", "default": 5, "minimum": 1, "maximum": 20 }
        },
        "required": ["feed_url"]
      }
    }
  ],
  "pricing": {
    "model": "freemium",
    "tiers": [
      { "name": "Free", "price": 0, "limits": { "max_feeds": 1, "posts_per_day": 5 } },
      { "name": "Pro", "price": 9.99, "interval": "month", "limits": { "max_feeds": 10, "posts_per_day": 50 } }
    ]
  }
}
```

### 2.3 config.schema.json

JSON Schema (draft-07) rendered by platform into dynamic UI components:
- string -> text input / URL input / dropdown (if enum)
- integer -> number stepper
- boolean -> toggle switch
- array of strings -> multi-select chips
- array of objects -> dynamic list editor
- object -> nested form section

### 2.4 Versioning (SemVer 2.0)

- MAJOR: Breaking changes (tool signatures, permissions, resource URIs)
- MINOR: Backward-compatible new features
- PATCH: Backward-compatible bug fixes

manifest_version must exact match. runtime_version uses semver range (e.g., >=18.0.0 <21.0.0).

---

## 3. Discovery & Search

### 3.1 Search Algorithm

```
Score = (0.35 x text_relevance)
      + (0.20 x install_count_normalized)
      + (0.15 x avg_rating_normalized)
      + (0.10 x recency_bonus)        // Updated within 30 days
      + (0.10 x featured_boost)
      + (0.05 x verified_publisher_bonus)
      + (0.05 x category_match_boost)
```

### 3.2 Category Taxonomy

content-generation/ (ai-writing, repurposing, rss-automation, scheduling)
analytics/ (social-analytics, custom-reports, competitor-analysis, sentiment)
commerce/ (shopify, woocommerce, etsy, amazon)
automation/ (webhooks, zapier, make, custom-workflows)
media/ (image-generation, video-processing, canva, stock-photos)
collaboration/ (approval-workflows, commenting, project-management)
ai/ (custom-llm, embeddings, translation)
data/ (csv-import, api-export, backup)

### 3.3 Featured & Trending

- Hero Banner (1 server, 7-day rotation)
- Featured Row (8 servers)
- New & Notable (6 recently launched)
- Trending (5 fastest-growing in 7 days)
- Editor Picks (1 per category)

---

## 4. Installation Flow

### 4.1 User Journey

Discover -> View Details (screenshots, description, reviews) -> Review Permissions -> Install -> Configure (dynamic form from config.schema.json) -> Connect & Use (tools appear in composer, calendar, automation)

### 4.2 Permission Review Screen

Shows categorized list of required permissions with plain-English explanations. Visual data flow diagram showing what data goes where. "Install & Configure" button only enabled after explicit consent.

### 4.3 Installation API

```typescript
class MCPInstaller {
  async install(request: InstallRequest): Promise<InstallResult> {
    // Validate manifest, verify signature, download package
    // Create sandbox, start server, health check
    // Register with platform, record analytics
  }
  async uninstall(installationId: string): Promise<void> {
    // Stop sandbox, delete data (with user confirmation), unregister
  }
}
```

### 4.4 Configuration UI

Auto-generated from config.schema.json. Platform provides rendering for each JSON Schema type. Supports dynamic list editors for array-of-object patterns (multi-feed, multi-account).

---

## 5. Security Review Process

### 5.1 Automated Scanning (Every Submission)

| Check | Tool | Fail Criteria |
|---|---|---|
| Static analysis | Semgrep (custom MCP rules) | Critical/High severity |
| Dependency audit | npm-audit, pip-audit, trivy | Critical vulns |
| Permission audit | Custom analyzer | Undisclosed network, file, or storage access |
| Entropy scan | Custom (min 4.5 entropy) | Hardcoded secrets, API keys |
| Malware scan | Signature-based | Known malware hashes |
| Package integrity | Sig verification | Signature mismatch |

### 5.2 Manual Review (Featured & Paid)

Code review checklist: no obfuscation, no eval(), no stack leaks, no PII in logs, declared network endpoints only, rate limiting, input validation, data minimization, encryption at rest, secure defaults, migration guide for breaking changes.

### 5.3 Sandbox Runtime Security

- Filesystem: Read-only for package files, writable only in data directory
- Network: Only declared outbound endpoints, block local network + cloud metadata
- Resources: CPU/memory limits, max file size (10MB), max open files (100), no child processes
- API restrictions: child_process, cluster, vm, ffi modules blocked
- DNS filtering to prevent rebinding attacks

### 5.4 Runtime Monitoring

Continuous monitoring for: error rate >5% (warning) / >25% (critical), memory near limit, undisclosed network access (block + alert), timeout >30s, behavioral anomaly detection for data exfiltration and scraping patterns.

---
## 6. Developer Portal

### 6.1 Dashboards

**My Servers**: List of servers with version, status (Draft/Published/Deprecated), install count, rating. Quick actions: Edit, Analytics, Manage Versions, Submit Update.

**Analytics**: Per-server metrics — total/active installs, uninstall rate, DAU/WAU/MAU, top tools by call count, latency percentiles (p50/p95/p99), error rate and breakdown, usage by hour/day/region.

**Revenue**: Total revenue, revenue by tier, free-to-paid conversion rate, churn rate, MRR/ARR.

**API Keys**: Create/manage scoped API keys (servers:read/write, analytics:read, revenue:read, reviews:read/reply).

### 6.2 Server Submission Flow

```
npx socialos-mcp init     -> creates scaffold
npx socialos-mcp test     -> runs local sandbox
npx socialos-mcp build    -> creates .mcp package
Upload to Portal          -> automated scan (~2 min)
  -> free: published immediately if pass
  -> paid/featured: manual review (1-3 days)
  -> Published to marketplace
```

### 6.3 Required Documentation

README.md with: description, prerequisites, quick start, config reference, tool examples, data handling, support info, license. CHANGELOG.md with semver sections (Added/Changed/Deprecated/Removed/Fixed/Security). examples/ directory with JSON tool call examples.

---

## 7. Monetization

### 7.1 Pricing Models

| Model | Revenue Split | Example |
|---|---|---|
| Free | N/A | Open-source utilities |
| Paid (one-time) | 80/20 (dev/platform) | Premium screenshot tool |
| Subscription | 80/20 | Analytics Reporter ($9.99/mo) |
| Freemium | 80/20 on paid tiers | Blog to Post |
| Usage-based | 75/25 | AI image generation |
| Enterprise | Negotiable | Custom analytics pipeline |

### 7.2 Revenue Split Details

Platform fee (20%) covers: marketplace hosting, security scanning, sandbox infrastructure, payment processing (Stripe), CDN distribution, developer portal, analytics.

Developer payout (80%): Paid monthly (net-30), minimum $50, methods Stripe/PayPal/bank transfer.

Volume bonuses: $50K-100K ARR -> 82/18, $100K-500K -> 85/15, $500K+ -> 88/12.

### 7.3 Refund Policy

10% refund reserve held for 90 days. Cancellation within 7 days: full refund (platform absorbs). Server broken: refund from developer earnings (pro-rated). Chargeback: $15 fee from developer.

---

## 8. Version Management

### 8.1 Version States

Draft -> Submitted -> Under Review -> Published -> Active -> Deprecated -> Archived

### 8.2 Update Flow

- MAJOR: Not auto-updated. User notified of breaking changes, must manually upgrade. 30-day grace period for old version.
- MINOR: Auto-updated (opt-in, default on). Gradual rollout: 1% -> 10% -> 50% -> 100% over 24h per stage. Rollback within 48h.
- PATCH: Auto-updated (no opt-in). Fast rollout: 10% -> 50% -> 100% over 2h per stage. Rollback within 72h.

### 8.3 Breaking Change Handling

```typescript
interface BreakingChange {
  version: string;
  changes: Array<{
    type: 'tool_removed' | 'tool_renamed' | 'parameter_removed' |
          'parameter_required' | 'parameter_type_changed' |
          'resource_uri_changed' | 'permission_added';
    description: string;
    migrationGuide: string;
    oldBehavior: string;
    newBehavior: string;
  }>;
  deprecationNotice: {
    noticePeriodDays: number;    // Minimum 30
    effectiveFrom: string;
    fallbackBehavior: string;    // return_error | warning | auto_migrate
  };
}
```

### 8.4 Rollback

Manual rollback to any previously installed version. Config compatibility check performed before rollback. Automatic rollback triggers: error rate >10% in 5 min, p99 latency >10s, server crash within 30 min, security vulnerability discovered post-deployment.

### 8.5 Update Notifications

In-app notification (on auto-update), weekly email digest, developer portal version history, API endpoint (GET /v1/mcp/updates), optional Slack/webhook.

---

## 9. Rating & Review System

### 9.1 Rating Calculation

Bayesian average to prevent manipulation: (total_ratings + prior_weight * prior_mean) / (count + prior_weight). Default prior mean: 4.0, prior weight: 5.

Display: average (1 decimal), total count, distribution (1-5 stars).

### 9.2 Verified Reviews

Criteria: installed for 24+ hours, at least one successful tool call. One review per user per server (updatable). Verified badge shown for qualifying reviews. Uninstalled users reviews marked "Previously installed".

### 9.3 Review Guidelines

Allowed: constructive feedback, bug reports, feature requests, respectful comparisons, performance observations, documentation suggestions.

Not allowed: harassment, spam, off-topic, fake/manipulated reviews, credential sharing, copyright infringement.

Moderation: user-flagging, auto-remove at 3 flags, 24h response time, appeal available.

### 9.4 Developer Replies

One reply per review (editable). Must reply within 30 days. Cannot request rating change or disclose private information.

### 9.5 Rating Impact

4.5-5.0: 1.5x search boost, featured eligible. 4.0-4.4: 1.2x boost. 3.0-3.9: neutral. 2.0-2.9: 0.5x penalty, review required. 1.0-1.9: suspended pending review.

---

## 10. Example MCP Servers

### 10.1 "Blog to Post" - Fetch RSS, AI Summarize, Schedule

**Overview**: Monitors RSS/Atom feeds, fetches articles, AI-summarizes for each platform, creates scheduled social posts.

**Target**: Content marketers, bloggers, social media managers.

**Tools**:
| Tool | Description | Input | Output |
|---|---|---|---|
| fetch_blog_posts | Fetch recent posts | feed_url, max_posts | [{ title, url, excerpt, content }] |
| summarize_for_social | AI summarize for platform | post_url, platform, tone | { summary, hashtags } |
| create_scheduled_posts | Auto-schedule from feed | feed_url, platforms, schedule | [{ id, platform, scheduled_at }] |
| get_feed_status | Check feed status | feed_id | { last_fetched, posts_this_week } |

**Workflow**: RSS Feed -> poll -> new article? -> fetch content -> AI summarize per platform -> create scheduled posts in SocialOS Calendar.

**Pricing**: Free (1 feed, 5 posts/day) / Pro $9.99/mo (10 feeds, 50 posts/day, custom schedules).

### 10.2 "E-commerce Sync" - Shopify Product to Social Posts

**Overview**: Syncs e-commerce product catalog with social calendar. Creates product showcase posts, sale alerts, new arrival announcements.

**Target**: E-commerce brands, Shopify/WooCommerce store owners.

**Tools**:
| Tool | Description |
|---|---|
| sync_products | Fetch latest products from Shopify/WooCommerce |
| create_product_posts | Create social posts for products with template (showcase/sale/new-arrival/featured) |
| create_sale_alert | Create posts for products on sale (configurable discount threshold) |
| get_product_catalog_status | Sync status of catalog |

**Webhooks**: Accepts products/update and product.created webhooks. On price change: updates scheduled posts + optionally creates "Price Drop" post.

**Workflow**: Store -> webhook -> validate -> cache -> apply template -> create scheduled post.

**Pricing**: Starter $4.99/mo (100 products, Shopify only) / Business $14.99/mo (5000 products, auto-post, sale alerts) / Enterprise $49.99/mo (unlimited, custom templates, priority support).

### 10.3 "Analytics Reporter" - Fetch Analytics, Generate PDF, Email

**Overview**: Automates generation and distribution of social media analytics reports. Fetches platform data, generates formatted PDF reports with charts, emails to stakeholders on schedule.

**Target**: Marketing managers, agencies, enterprise teams.

**Tools**:
| Tool | Description |
|---|---|
| generate_report | Generate report for accounts + period. Formats: pdf/csv/html. Templates: executive/detailed/minimal/agency. Optional AI insights. |
| schedule_report | Schedule recurring report with recipients, frequency (daily/weekly/monthly), template, AI insights toggle. |
| list_scheduled_reports | View all scheduled reports |
| delete_scheduled_report | Remove scheduled report |

**Report Templates**:
- **Executive**: High-level KPIs, trend graphs, AI summary (1 page)
- **Detailed**: Full breakdown by platform, post-level analytics, comparison period
- **Minimal**: Key numbers only, clean single page
- **Agency**: Client-ready with white-label, branding, comparative benchmarks

**Workflow**: Trigger (manual or cron) -> fetch analytics via SocialOS API -> generate charts (d3/Chart.js on server) -> compile PDF (WeasyPrint/Puppeteer) -> send email via SES/SendGrid.

**Pricing**: Free (1 report/week, 2 accounts) / Pro $14.99/mo (daily reports, 20 accounts, AI insights) / Agency $49.99/mo (unlimited, white-label, priority delivery).

---

*End of Document - MCP Marketplace & Ecosystem*
