# Mobile App Architecture — AI Social Media OS

> **Version:** 1.0  
> **Date:** 2026-07-22  
> **Audience:** Mobile engineering team, platform architects  
> **Status:** Draft for review

---

## Table of Contents

1. [Tech Stack Recommendation](#1-tech-stack-recommendation)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Screens & Navigation](#3-core-screens--navigation)
4. [Offline-First Data Layer](#4-offline-first-data-layer)
5. [Push Notifications](#5-push-notifications)
6. [Deep Linking](#6-deep-linking)
7. [Mobile-Specific Features](#7-mobile-specific-features)
8. [API Layer & Network](#8-api-layer--network)
9. [Performance Strategy](#9-performance-strategy)
10. [CI/CD & Release Pipeline](#10-cicd--release-pipeline)
11. [App Store Strategy](#11-app-store-strategy)

---

## 1. Tech Stack Recommendation

### Recommendation: React Native (Expo SDK 56+)

**Decision rationale against Flutter:**

| Criterion | React Native (Expo) | Flutter |
|---|---|---|
| **Code sharing with web** | TypeScript + React — shared types, hooks, API layer with web app and browser extension | Dart — no code sharing with existing TS ecosystem |
| **Existing ecosystem** | The platform already uses React/TypeScript for web and extension; RN reuses this talent pool | Requires dedicated Dart/Flutter team |
| **OTA updates** | EAS Update (mature, production-proven) | Shorebird (nascent, fewer integrations) |
| **Third-party integrations** | Vast React Native ecosystem for social, media, analytics | Growing but smaller ecosystem |
| **LLM SDKs** | LangChain, Vercel AI SDK, OpenAI SDK all have first-class JS/TS support | Ports needed |
| **Community & hiring** | Largest mobile cross-platform community | Smaller but growing |
| **Performance ceiling** | JSI / Hermes narrows gap; 95% of social apps don't need native rendering | Slightly better for complex animations |

**Core stack:**

| Layer | Technology |
|---|---|
| Framework | React Native 0.80+ via Expo SDK 56 |
| Language | TypeScript 5.6+ (strict mode) |
| Navigation | expo-router (file-based routing) |
| State management | Zustand + TanStack Query (server state) |
| Local storage | expo-sqlite (SQLite via native driver) |
| Sync engine | Custom sync queue (see §4) |
| Media | expo-image (caching), expo-video, expo-file-system |
| Animations | Reanimated 4 + Gesture Handler |
| Maps | Mapbox GL (post-2024 pricing) or MapLibre (OSS) |
| Auth | expo-auth-session + Supabase Auth or Clerk |
| Push | expo-notifications + Firebase Cloud Messaging / APNs |
| OTA | EAS Update (CodePush-compatible) |
| CI/CD | EAS Build + Fastlane |
| Testing | Jest + React Native Testing Library + Maestro (E2E) |

---

## 2. Architecture Overview

### 2.1 Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │  Screens │ │Components│ │  Hooks   │ │ Navigation (expo-│ │
│  │          │ │          │ │          │ │    router)       │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                    SHARED LOGIC LAYER                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │  Zustand │ │  TanStack│ │  Auth    │ │ Feature Flags   │ │
│  │  Stores  │ │  Query   │ │  Context │ │ (Unleash/Launch)│ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  ./packages/shared/ (symlinked via local monorepo)        ││
│  │  - types (Account, Post, Analytics, Calendar)             ││
│  │  - validators (zod schemas)                               ││
│  │  - API client (fetch wrapper + offline queue)             ││
│  │  - date utils (date-fns)                                  ││
│  │  - AI prompt templates                                    ││
│  └───────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│                    DATA LAYER                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │  SQLite  │ │  Sync    │ │ Image    │ │ Secure Store    │ │
│  │  (local) │ │  Engine  │ │ Cache    │ │ (tokens/keys)   │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Monorepo Structure

```
apps/
  mobile/                    # React Native (Expo) app
    app/                     # expo-router file-based pages
    components/              # Presentational components
    features/                # Screen-specific logic
    hooks/                   # Custom hooks
    providers/               # Context providers (Auth, Theme, Sync)
  web/                       # React web app
  extension/                 # Browser extension
packages/
  shared/                    # Types, validators, API client
  ai/                        # AI prompt templates, LLM client
  analytics/                 # Analytics utilities
  ui/                        # Shared component library (Dripsy/RN)
```

### 2.3 Key Architectural Decisions

**Decision 1: Shared logic via monorepo, not micro-frontends.**
The `packages/shared` directory is symlinked into the mobile app. It contains zero UI code — only types, validation schemas, API client, and utility functions. This ensures the mobile app can be developed independently while sharing business logic.

**Decision 2: Zustand over Redux for client state.**
Zustand is simpler, has first-class TypeScript support, works outside React (useful for background tasks), and has a smaller bundle footprint. Server state (API data) is owned by TanStack Query.

**Decision 3: SQLite as the local database.**
`expo-sqlite` with the native SQLite driver (not WebSQL shim) provides 5-10x faster reads than AsyncStorage for structured data. SQLite enables complex queries for the Calendar and Analytics screens without loading everything into memory.

**Decision 4: Optimistic updates everywhere.**
Every mutation (create post, schedule, archive) updates the local SQLite store immediately, then syncs. The UI never waits for the network unless the user explicitly requires fresh data.

---

## 3. Core Screens & Navigation

### 3.1 Navigation Structure (expo-router)

```
app/
  (auth)/
    login.tsx
    register.tsx
    forgot-password.tsx
  (tabs)/
    _layout.tsx             # Bottom tab navigator
    dashboard.tsx           # Tab 1: Dashboard
    calendar.tsx            # Tab 2: Calendar
    compose.tsx             # Tab 3: Composer (modal + tab)
    analytics.tsx           # Tab 4: Analytics
    inbox.tsx               # Tab 5: Engagement Inbox
  settings/
    _layout.tsx             # Stack navigator
    index.tsx               # Settings root
    accounts.tsx            # Connected accounts
    billing.tsx             # Subscription & plan
    notifications.tsx       # Notification preferences
    team.tsx                # Team management
    api-keys.tsx             # API key management
  post/
    [id].tsx                # Post detail view
    [id]/edit.tsx           # Edit post
    [id]/analytics.tsx      # Post-level analytics
  profile/
    [handle].tsx            # Public profile view
```

### 3.2 Screen Specifications

#### 3.2.1 Dashboard

```
┌──────────────────────────────────────┐
│ 🔔 🔍              ┌────┐  ┌────┐  │
│                     │Week│  │Month│  │
├──────────────────────────────────────┤
│  Good morning, Alex                  │
│  📊 12 posts scheduled this week     │
│  📈 +23% engagement vs last week     │
├──────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │Posts │ │Inbox │ │Queue │ │Drafts││
│  │  24  │ │   7  │ │   3  │ │   5  ││
│  └──────┘ └──────┘ └──────┘ └──────┘│
├──────────────────────────────────────┤
│  ⏰ Upcoming Posts (next 24h)        │
│  ・ 2:00 PM  ─ Instagram ─ Product  │
│  ・ 4:30 PM  ─ LinkedIn  ─ Article  │
│  ・ 6:00 PM  ─ Twitter/X  ─ Thread  │
├──────────────────────────────────────┤
│  📈 Quick Analytics                  │
│  [Impressions chart: last 7 days]    │
│  [Engagement rate sparkline]         │
├──────────────────────────────────────┤
│  🤖 AI Suggestions (2)              │
│  ・ Repurpose top post for LinkedIn  │
│  ・ Generate thread from blog post   │
└──────────────────────────────────────┘
```

**Data requirements:**
- `SELECT COUNT(*) FROM scheduled_posts WHERE date = today`
- `SELECT * FROM scheduled_posts ORDER BY scheduled_at LIMIT 5`
- Aggregated analytics from local cache (refreshed every 15 min)
- AI suggestions from local cache (regenerated daily)

#### 3.2.2 Calendar

```
┌──────────────────────────────────────┐
│  < July 2026 >                   📅  │
│  Su Mo Tu We Th Fr Sa                │
│        1  2  3  4  5  6              │
│   7  8  9 10 11 12 13               │
│  14 15 16 17 18 19 20               │
│  21 22 23 24 25 26 27               │
│  28 29 30 31                         │
├──────────────────────────────────────┤
│  Wed, Jul 22                         │
│  ┌──────────────────────────────────┐│
│  │ 09:00  ● Twitter   "New blog..." ││
│  │ 12:00  ● Insta     [product shot]││
│  │ 15:00  ● LinkedIn  "Excited..."  ││
│  │ 18:00  ● TikTok    [BTS video]   ││
│  └──────────────────────────────────┘│
├──────────────────────────────────────┤
│  [  + Schedule Post  ]  [  AI Fill  ] │
└──────────────────────────────────────┘
```

**Implementation:**
- `expo-router` nested layout for month/week/day views
- Calendar grid uses `react-native-calendars` or custom with `react-native-gesture-handler` for drag-and-drop rescheduling
- Posts are fetched from local SQLite with a date-range query: `SELECT * FROM scheduled_posts WHERE scheduled_at BETWEEN ? AND ? ORDER BY scheduled_at`
- Drag-and-drop rescheduling triggers optimistic update + sync queue

#### 3.2.3 Composer

```
┌──────────────────────────────────────┐
│  ✕ New Post                  [Post]  │
├──────────────────────────────────────┤
│  ┌──────────┐  ┌──────────────────┐  │
│  │ LinkedIn │  │ Twitter/X  Instagram│ │
│  │ Facebook │  │ TikTok   Threads  │  │
│  └──────────┘  └──────────────────┘  │
├──────────────────────────────────────┤
│  [Account selector: @company]        │
├──────────────────────────────────────┤
│  📝 Caption...                       │
│  ┌──────────────────────────────────┐│
│  │                                  ││
│  │  (editable text area)            ││
│  │                                  ││
│  │                 0/280 characters ││
│  └──────────────────────────────────┘│
├──────────────────────────────────────┤
│  🖼 🎥 🎵  [Media attachments]       │
│  (0 files attached)                  │
├──────────────────────────────────────┤
│  🔗 https://example.com/blog-post    │
│  [Preview card loads automatically]  │
├──────────────────────────────────────┤
│  🤖 [AI Assistants]                  │
│  ✨ Repurpose  ✨ Summarize  ✨ Hashtag│
├──────────────────────────────────────┤
│  📅 Schedule                        │
│  ○ Post now  ● Schedule             │
│  │ Jul 22, 2026 ── 2:00 PM │        │
│  [   Timezone: America/New_York   ]  │
├──────────────────────────────────────┤
│  🌐 Best Time (AI-powered)           │
│  Suggested: 2:00 PM (+32% eng.)      │
└──────────────────────────────────────┘
```

**Implementation notes:**
- Drafts auto-saved to SQLite every 5 seconds via debounced hook
- Media picker uses `expo-image-picker` with `expo-file-system` for upload
- Link preview fetched via API (server-side OpenGraph parsing)
- AI assistants call the shared AI package via API (or on-device model for basic tasks)
- Character count is per-platform aware (Twitter 280, Insta caption 2200, LinkedIn 3000)

#### 3.2.4 Analytics

```
┌──────────────────────────────────────┐
│  < Analytics         Jul 15 - Jul 22 │
├──────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │Posts │ │Reach │ │Engage│ │Clicks││
│  │  24  │ │ 12.5K│ │ 2.3K │ │  892 ││
│  └──────┘ └──────┘ └──────┘ └──────┘│
├──────────────────────────────────────┤
│  [Engagement chart: line chart]      │
├──────────────────────────────────────┤
│  Top Posts (by engagement)           │
│  1. "New feature launch!" ─ 892 eng │
│  2. "Customer story"   ─ 654 eng   │
│  3. "Industry take"    ─ 432 eng   │
├──────────────────────────────────────┤
│  Accounts                            │
│  ● @company (Twitter)  +12%         │
│  ● @company (LinkedIn)  +8%         │
│  ● @company (Insta)     +23%        │
├──────────────────────────────────────┤
│  🤖 AI Insight: TikTok engagement   │
│  is up 45% this week. Consider      │
│  increasing posting cadence.        │
└──────────────────────────────────────┘
```

**Data strategy:**
- Analytics data is fetched from the API in aggregated form (never raw events)
- Cached locally with TTL: 5 min for current period, 1 hour for historical
- Charts use `react-native-svg` + `victory-native` or `d3` for rendering
- AI insights are generated server-side by the analytics pipeline, not on-device

#### 3.2.5 Engagement Inbox

```
┌──────────────────────────────────────┐
│  Inbox                     🔄 3 new  │
├──────────────────────────────────────┤
│  [All] [Mentions] [Comments] [DMs]   │
├──────────────────────────────────────┤
│  🔵 @user1: "Love this product!"    │
│     Instagram ─ 2m ago ─ [Reply]    │
├──────────────────────────────────────┤
│  🟡 @user2: "How do I sign up?"     │
│     Twitter ─ 15m ago ─ [Reply]     │
├──────────────────────────────────────┤
│  🔴 @user3 mentioned you            │
│     LinkedIn ─ 1h ago ─ [View]      │
├──────────────────────────────────────┤
│  🤖 AI Draft Reply                   │
│  "Thanks for your interest! You can │
│   sign up at..." [Use] [Edit]        │
└──────────────────────────────────────┘
```

**Implementation:**
- Real-time updates via WebSocket connection (background service)
- AI-suggested replies generated on-device via small model (or API for complex)
- Multi-platform inbox unified via the API's engagement aggregation service
- Swipe gestures for: reply, archive, mark as done

#### 3.2.6 Settings

Settings screens follow the standard iOS/Android settings pattern with grouped table sections:

- **Accounts** — Connect/disconnect social accounts, re-auth flows
- **Workspace** — Team members, roles, permissions
- **Notifications** — Per-channel push preferences
- **Appearance** — Dark mode, accent color, dense mode
- **Data & Sync** — Sync status, force refresh, cache size, export data
- **Security** — Biometric lock, session management, 2FA
- **Billing** — Plan, usage, invoices
- **About** — Version, licenses, support

---

## 4. Offline-First Data Layer

### 4.1 SQLite Schema

```sql
-- Core entities
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,         -- 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'threads' | 'facebook'
  handle TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  access_token TEXT,              -- encrypted via expo-secure-store
  refresh_token TEXT,             -- encrypted via expo-secure-store
  token_expires_at INTEGER,
  connected_at INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'scheduled' | 'published' | 'failed'
  caption TEXT,
  media_json TEXT,                -- JSON array of media attachments
  link_url TEXT,
  link_preview_json TEXT,          -- cached OpenGraph data
  scheduled_at INTEGER,            -- epoch milliseconds
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  platform_post_id TEXT,           -- set after successful publish
  platform_url TEXT,
  error_message TEXT,
  sync_status TEXT DEFAULT 'synced' -- 'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'conflict'
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES posts(id),
  local_uri TEXT,                  -- local file path
  remote_url TEXT,                 -- CDN URL after upload
  mime_type TEXT NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  upload_status TEXT DEFAULT 'pending',  -- 'pending' | 'uploading' | 'uploaded' | 'failed'
  sync_status TEXT DEFAULT 'synced'
);

CREATE TABLE analytics_cache (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,       -- 'impressions' | 'engagement' | 'followers' | 'clicks'
  period TEXT NOT NULL,            -- 'day' | 'week' | 'month'
  date_start INTEGER NOT NULL,
  date_end INTEGER NOT NULL,
  data_json TEXT NOT NULL,         -- cached aggregated data
  fetched_at INTEGER NOT NULL,
  ttl INTEGER NOT NULL
);

CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,       -- 'post' | 'media' | 'account'
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,            -- 'create' | 'update' | 'delete'
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  last_error TEXT,
  status TEXT DEFAULT 'pending'    -- 'pending' | 'in_progress' | 'failed' | 'completed'
);

-- Performance indexes
CREATE INDEX idx_posts_account_status ON posts(account_id, status);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);
CREATE INDEX idx_analytics_cache_lookup ON analytics_cache(account_id, metric_type, period, date_start);
```

### 4.2 Sync Engine Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYNC ENGINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Mutation     │───>│  Optimistic  │───>│  SQLite Write    │   │
│  │  (user act.)  │    │  Update      │    │                  │   │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘   │
│                                                    │             │
│  ┌─────────────────────────────────────────────────▼──────────┐ │
│  │                 SYNC QUEUE PROCESSOR                        │ │
│  │                                                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │ │
│  │  │Dedupe    │  │Batch     │  │Retry     │  │Conflict    │ │ │
│  │  │Check     │  │Grouping  │  │(exp.     │  │Resolution  │ │ │
│  │  │          │  │          │  │ backoff) │  │            │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              NETWORK CLIENT (see §8)                         ││
│  └──────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Conflict Resolution                             ││
│  │                                                              ││
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  ││
│  │  │Server Wins  │  │Last Write    │  │Manual (UI prompt)  │  ││
│  │  │(default for │  │Wins (drafts, │  │(account config,    │  ││
│  │  │analytics)   │  │notes)        │  │scheduled posts)    │  ││
│  │  └─────────────┘  └──────────────┘  └────────────────────┘  ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Sync Queue Processor

```typescript
// /packages/sync/src/queue-processor.ts

interface SyncConfig {
  maxRetries: number;
  baseBackoffMs: number;        // 1000
  maxBackoffMs: number;         // 30000
  batchSize: number;             // 10
  concurrency: number;           // 3
  networkTimeoutMs: number;      // 15000
}

class SyncQueueProcessor {
  private config: SyncConfig;
  private isProcessing = false;
  private db: SQLiteDatabase;

  async start(): Promise<void> {
    // Called on app foreground and after successful mutations
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processLoop();
    } finally {
      this.isProcessing = false;
    }
  }

  private async processLoop(): Promise<void> {
    const items = await this.fetchNextBatch();

    if (items.length === 0) return;

    const results = await Promise.allSettled(
      items.map(item => this.processItem(item))
    );

    // Handle failures: retry or dead-letter
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = items[i];

      if (result.status === 'rejected') {
        await this.handleFailure(item, result.reason);
      } else {
        await this.markCompleted(item);
      }
    }

    // Process next batch (recursive, but bounded by requestIdleCallback)
    if (items.length === this.config.batchSize) {
      requestIdleCallback(() => this.processLoop());
    }
  }

  private async handleFailure(
    item: SyncQueueItem,
    error: Error
  ): Promise<void> {
    const newRetryCount = item.retry_count + 1;

    if (newRetryCount >= this.config.maxRetries) {
      // Dead-letter: mark post as failed, notify user
      await this.db.runAsync(
        `UPDATE sync_queue SET status = 'failed', last_error = ? WHERE id = ?`,
        [error.message, item.id]
      );
      await this.notifyUser(item.entityType, item.entityId, error.message);
    } else {
      // Exponential backoff
      const delay = Math.min(
        this.config.baseBackoffMs * Math.pow(2, item.retry_count),
        this.config.maxBackoffMs
      );
      await this.db.runAsync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ?, status = 'pending' WHERE id = ?`,
        [newRetryCount, error.message, item.id]
      );
      // Schedule retry via AlarmManager / BackgroundTask
      this.scheduleRetry(item.id, delay);
    }
  }
}
```

### 4.4 Conflict Resolution Strategy

| Scenario | Strategy | UX |
|---|---|---|
| Post edited on two devices | LWW (last-write-wins) by `updated_at` | Silent merge |
| Post deleted on one device, edited on another | Deletion wins; preserve edit in version history | Silent |
| Schedule time changed on two devices | Prompt user on second device sync | Notification with diff |
| Analytics data conflict | Server wins (source of truth) | Silent |
| Account credential conflict | Server wins; force re-auth if token invalid | Auth screen |
| Draft conflict | LWW with merge of text content + latest media | Silent |

### 4.5 Background Sync

```typescript
// Background sync registration (expo-task-manager)

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const SYNC_TASK = 'BACKGROUND_SYNC';

TaskManager.defineTask(SYNC_TASK, async () => {
  const processor = getSyncQueueProcessor();
  await processor.start();

  // Check for upcoming scheduled posts and schedule local notifications
  const upcomingPosts = await getUpcomingPosts(15); // next 15 min
  for (const post of upcomingPosts) {
    await scheduleLocalNotification(post);
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

// Register in app entry
export async function registerBackgroundSync() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
    await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}
```

---

## 5. Push Notifications

### 5.1 Notification Types

| Type | Trigger | Delivery | Priority |
|---|---|---|---|
| Post published | Server event after publish success | Immediate | High |
| Post failed | Server event after publish failure | Immediate | High |
| Scheduled post reminder | Local notification at (scheduled_time - N min) | Local | Medium |
| Engagement alert | Server event (new comment, mention, DM) | Immediate | Medium |
| Team member action | Server event (colleague scheduled/edited) | Immediate | Low |
| Sync conflict | Detected by sync engine | Local | Low |
| Weekly digest | Cron job (Monday 9 AM) | Server push | Low |
| Feature announcement | Campaign push | Server push | Low |

### 5.2 Push Architecture

```
┌──────────┐    ┌──────────────┐    ┌─────────────────────┐
│  Mobile   │    │  FCM / APNs  │    │  Platform Server    │
│  Device   │    │  Gateway     │    │                     │
└────┬─────┘    └──────┬───────┘    └──────────┬──────────┘
     │                 │                       │
     │  1. Register    │                       │
     │  push token ───>│  2. Forward token ───>│  Store token
     │                 │                       │
     │                 │         3. Event      │
     │                 │    <─── (post pub.)   │
     │                 │                       │
     │  4. Push msg    │                       │
     │  <──────────────│                       │
     │                 │                       │
     │  5. Handle in   │                       │
     │  notification   │                       │
     │  response       │                       │
```

### 5.3 Notification Handling

```typescript
// /apps/mobile/src/providers/NotificationsProvider.tsx

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
  }),
});

// Deep link mapping based on notification data
function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;

  switch (data.type) {
    case 'post_published':
    case 'post_failed':
      router.push(`/post/${data.postId}`);
      break;
    case 'engagement':
      router.push(`/inbox?conversation=${data.conversationId}`);
      break;
    case 'scheduled_reminder':
      router.push('/calendar');
      break;
    case 'team_action':
      router.push(`/post/${data.postId}`);
      break;
    case 'weekly_digest':
      router.push('/analytics');
      break;
  }
}

// Register listener in app entry
export function useNotifications() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    return () => sub.remove();
  }, []);
}
```

### 5.4 Local Notification Scheduling

```typescript
// /apps/mobile/src/features/scheduler/reminders.ts

async function schedulePostReminder(post: Post, minutesBefore: number = 15) {
  const triggerDate = new Date(post.scheduledAt.getTime() - minutesBefore * 60 * 1000);

  // Cancel previous reminder if rescheduled
  await Notifications.cancelScheduledNotificationAsync(
    `reminder-${post.id}`
  );

  await Notifications.scheduleNotificationAsync({
    identifier: `reminder-${post.id}`,
    content: {
      title: 'Post scheduled soon',
      body: `"${post.caption.slice(0, 60)}..." goes out in ${minutesBefore} min`,
      data: { type: 'scheduled_reminder', postId: post.id },
      categoryIdentifier: 'post_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

// Notification categories (for actionable notifications)
await Notifications.setNotificationCategoryAsync('post_reminder', [
  {
    identifier: 'EDIT',
    buttonTitle: 'Edit Post',
    options: { opensAppToForeground: true },
  },
  {
    identifier: 'SKIP',
    buttonTitle: 'Skip This Post',
    options: { opensAppToForeground: false, isDestructive: true },
  },
]);
```

---

## 6. Deep Linking

### 6.1 Link Configuration

```typescript
// app.json
{
  "expo": {
    "scheme": "socialos",
    "plugins": [
      [
        "expo-linking",
        {
          "universalLinks": [
            "app.socialos.com"
          ]
        }
      ]
    ]
  }
}
```

### 6.2 Universal Link Patterns

| URL Pattern | Screen | Example |
|---|---|---|
| `https://app.socialos.com/post/{id}` | Post detail | `/post/abc123` |
| `https://app.socialos.com/post/{id}/analytics` | Post analytics | `/post/abc123/analytics` |
| `https://app.socialos.com/calendar?date=2026-07-22` | Calendar with date | `/calendar?date=2026-07-22` |
| `https://app.socialos.com/inbox` | Engagement inbox | `/inbox` |
| `https://app.socialos.com/inbox/{convId}` | Specific conversation | `/inbox/conv_456` |
| `https://app.socialos.com/analytics/{accountId}` | Account analytics | `/analytics/acct_789` |
| `https://app.socialos.com/compose` | New post (with prefill) | `/compose?text=...&accountId=...` |
| `https://app.socialos.com/settings/accounts` | Account settings | `/settings/accounts` |
| `https://app.socialos.com/settings/team/invite/{code}` | Accept team invite | `/settings/team/invite/xyz` |
| `socialos://post/{id}` | App scheme fallback | Same as universal |
| `socialos://compose` | New post | Same as universal |

### 6.3 Route Handler

```typescript
// /apps/mobile/src/providers/LinkingProvider.tsx

import { useLinking } from 'expo-router';

const PREFIXES = [
  'socialos://',
  'https://app.socialos.com',
  'https://www.socialos.com',
];

export function useDeepLinkHandler() {
  useEffect(() => {
    // Handle links that opened the app
    const handleLink = (url: string | null) => {
      if (!url) return;

      const parsed = parseDeepLink(url);
      if (parsed) {
        router.navigate(parsed);
      }
    };

    // Get the initial URL (app opened from cold start via link)
    Linking.getInitialURL().then(handleLink);

    // Handle links while app is running
    const sub = Linking.addEventListener('url', (event) => {
      handleLink(event.url);
    });

    return () => sub.remove();
  }, []);
}

function parseDeepLink(url: string): string | null {
  const uri = new URL(url);

  // Handle /post/:id
  const postMatch = uri.pathname.match(/^\/post\/([a-zA-Z0-9_-]+)(\/edit|\/analytics)?$/);
  if (postMatch) {
    const suffix = postMatch[2] || '';
    return `/post/${postMatch[1]}${suffix}`;
  }

  // Handle /calendar
  if (uri.pathname === '/calendar') {
    const date = uri.searchParams.get('date');
    return date ? `/calendar?date=${date}` : '/calendar';
  }

  // Handle /compose with prefill
  if (uri.pathname === '/compose') {
    const text = uri.searchParams.get('text');
    const accountId = uri.searchParams.get('accountId');
    const params = new URLSearchParams();
    if (text) params.set('text', text);
    if (accountId) params.set('accountId', accountId);
    return `/compose?${params.toString()}`;
  }

  // Handle /inbox
  if (uri.pathname.startsWith('/inbox')) {
    return uri.pathname + uri.search;
  }

  // Handle /analytics
  if (uri.pathname.startsWith('/analytics')) {
    return uri.pathname + uri.search;
  }

  // Handle /settings
  if (uri.pathname.startsWith('/settings')) {
    return uri.pathname + uri.search;
  }

  return null;
}
```

### 6.4 Associated Domains (iOS) & Asset Links (Android)

**iOS (apple-app-site-association):**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.socialos.app",
        "paths": [
          "/post/*",
          "/calendar",
          "/inbox/*",
          "/analytics/*",
          "/compose",
          "/settings/*"
        ]
      }
    ]
  }
}
```

**Android (assetlinks.json):**
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.socialos.app",
    "sha256_cert_fingerprints": ["SHA256_FINGERPRINT"]
  }
}]
```

---

## 7. Mobile-Specific Features

### 7.1 Camera & Gallery Upload

```typescript
// /apps/mobile/src/features/composer/useMediaPicker.ts

import * as ImagePicker from 'expo-image-picker';
import * as VideoPicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface MediaPickerOptions {
  allowsMultipleSelection: boolean;
  maxCount: number;         // platform-dependent (Insta: 10, Twitter: 4)
  includeVideo: boolean;
  quality: number;          // 0.0 - 1.0
}

async function pickFromGallery(options: MediaPickerOptions) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: options.includeVideo
      ? ImagePicker.MediaTypeOptions.All
      : ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: options.allowsMultipleSelection,
    quality: options.quality,
    exif: false, // strip EXIF for privacy
  });

  return result.assets?.map(asset => ({
    localUri: asset.uri,
    mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
  })) ?? [];
}

async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    exif: false,
  });

  return result.assets?.map(asset => ({
    localUri: asset.uri,
    mimeType: 'image/jpeg',
  })) ?? [];
}

async function pickFromFiles() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'video/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });

  return result.assets?.map(asset => ({
    localUri: asset.uri,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    fileSize: asset.size,
  })) ?? [];
}
```

### 7.2 Voice-to-Text for Captions

```typescript
// /apps/mobile/src/features/composer/useVoiceToText.ts

import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface VoiceToTextResult {
  text: string;
  isFinal: boolean;
  confidence: number;
}

export function useVoiceToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  };

  const stopRecording = async (): Promise<string> => {
    if (!recordingRef.current) return '';

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI()!;

    // Send to speech-to-text API
    const formData = new FormData();
    formData.append('audio', {
      uri,
      type: 'audio/wav',
      name: 'caption.wav',
    } as any);

    const response = await fetch('https://api.socialos.com/stt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });

    const { text } = await response.json();

    // Clean up recording file
    await FileSystem.deleteAsync(uri, { idempotent: true });

    setIsRecording(false);
    recordingRef.current = null;

    return text;
  };

  return { isRecording, startRecording, stopRecording, interimText };
}
```

**Alternative: On-device STT for offline mode:**
- iOS: `expo-speech-recognition` (wraps SFSpeechRecognizer)
- Android: `expo-speech-recognition` (wraps SpeechRecognizer)
- Fallback: Whisper.cpp mobile via React Native native module for fully offline operation

### 7.3 Location Tagging

```typescript
// /apps/mobile/src/features/composer/useLocationTag.ts

import * as Location from 'expo-location';
import { useState } from 'react';

interface LocationTag {
  name: string;           // "Cafe Milano"
  address: string;        // "123 Main St, NYC"
  latitude: number;
  longitude: number;
  placeId?: string;       // Google/Foursquare ID
}

export function useLocationTag() {
  const [location, setLocation] = useState<LocationTag | null>(null);

  const tagCurrentLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // Reverse geocode
    const geocode = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });

    if (geocode.length > 0) {
      const place = geocode[0];
      const tag: LocationTag = {
        name: [place.name, place.street, place.city]
          .filter(Boolean)
          .join(', '),
        address: [
          place.street, place.city,
          place.region, place.postalCode, place.country
        ].filter(Boolean).join(', '),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      // Optionally enrich with Foursquare/Google Places API
      setLocation(tag);
      return tag;
    }
    return null;
  };

  const searchLocation = async (query: string): Promise<LocationTag[]> => {
    // Debounced search via Places API
    const response = await fetch(
      `https://api.socialos.com/places/search?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    const results = await response.json();
    return results;
  };

  const clearLocation = () => setLocation(null);

  return { location, tagCurrentLocation, searchLocation, clearLocation };
}
```

### 7.4 Biometric Authentication

```typescript
// /apps/mobile/src/features/auth/useBiometricAuth.ts

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

interface BiometricConfig {
  requireBiometricForPosts: boolean;    // Require Face ID to publish
  requireBiometricForSensitiveActions: boolean;  // Delete account, export data
  lockAppOnBackground: boolean;         // Auto-lock on app background
  lockTimeoutMs: number;                // 300000 (5 min)
}

export async function setupBiometricAuth(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    // Redirect to OS settings
    await LocalAuthentication.enrollAsync();
    return false;
  }

  return true;
}

export async function authenticateForAction(
  reason: string = 'Authenticate to continue'
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use passcode',
  });

  return result.success;
}

// App-level background lock
export function useAppLock() {
  const [isLocked, setIsLocked] = useState(true);
  const lastActiveRef = useRef(Date.now());

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && lastActiveRef.current) {
        const elapsed = Date.now() - lastActiveRef.current;
        if (elapsed > BIOMETRIC_CONFIG.lockTimeoutMs) {
          const authenticated = await authenticateForAction(
            'Unlock SocialOS'
          );
          setIsLocked(!authenticated);
        }
      }
      if (state === 'background') {
        lastActiveRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);
}
```

---

## 8. API Layer & Network

### 8.1 Shared API Client

```typescript
// /packages/shared/src/api/client.ts

interface APIClientConfig {
  baseURL: string;
  tokenStorage: TokenStorage;
  timeout: number;
  retryConfig: RetryConfig;
  enableOfflineQueue: boolean;
}

interface RetryConfig {
  maxRetries: number;       // 3
  baseDelay: number;        // 1000
  maxDelay: number;         // 10000
  retryOnStatus: number[];  // [408, 429, 500, 502, 503, 504]
}

class APIClient {
  private config: APIClientConfig;
  private pendingRequests = new Map<string, Promise<any>>();
  private queue: SyncQueueProcessor;

  constructor(config: APIClientConfig) {
    this.config = config;
  }

  // Deduplication: if the same request is in-flight, reuse it
  private async deduplicatedFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = fetcher().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const dedupKey = options.deduplicate
      ? `${method}:${path}:${JSON.stringify(options.body ?? {})}`
      : crypto.randomUUID();

    return this.deduplicatedFetch(dedupKey, () =>
      this.executeWithRetry(method, path, options)
    );
  }

  private async executeWithRetry<T>(
    method: string,
    path: string,
    options: RequestOptions,
    attempt: number = 0
  ): Promise<T> {
    try {
      const token = await this.config.tokenStorage.getToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      const response = await fetch(`${this.config.baseURL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Client-Version': APP_VERSION,
          'X-Request-ID': crypto.randomUUID(),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new APIError(
          response.status,
          await response.json().catch(() => ({})),
          attempt
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof APIError && this.shouldRetry(error, attempt)) {
        const delay = this.getBackoffDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(method, path, options, attempt + 1);
      }

      if (options.offlineSupport && this.config.enableOfflineQueue) {
        // Enqueue for later sync
        await this.queue.enqueue({
          entityType: options.entityType!,
          entityId: options.entityId,
          action: methodToAction(method),
          payload: options.body,
        });
        // Return optimistic data if available
        return options.optimisticResponse as T;
      }

      throw error;
    }
  }

  private shouldRetry(error: APIError, attempt: number): boolean {
    if (attempt >= this.config.retryConfig.maxRetries) return false;
    return this.config.retryConfig.retryOnStatus.includes(error.status);
  }

  private getBackoffDelay(attempt: number): number {
    const delay = this.config.retryConfig.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(delay + jitter, this.config.retryConfig.maxDelay);
  }
}
```

### 8.2 API Endpoint Reference

| Method | Path | Description | Offline Support |
|---|---|---|---|
| GET | `/v1/posts` | List posts (paginated) | SQLite cache |
| GET | `/v1/posts/:id` | Get single post | SQLite cache |
| POST | `/v1/posts` | Create post | Sync queue |
| PATCH | `/v1/posts/:id` | Update post | Sync queue |
| DELETE | `/v1/posts/:id` | Delete post | Sync queue |
| POST | `/v1/posts/:id/publish` | Publish post now | Sync queue |
| POST | `/v1/posts/:id/schedule` | Schedule post | Sync queue |
| GET | `/v1/analytics/overview` | Dashboard analytics | Cache with TTL |
| GET | `/v1/analytics/posts/:id` | Post-level analytics | Cache with TTL |
| GET | `/v1/analytics/accounts/:id` | Account analytics | Cache with TTL |
| GET | `/v1/inbox` | Unified inbox | SQLite cache |
| GET | `/v1/inbox/:id` | Conversation detail | SQLite cache |
| POST | `/v1/inbox/:id/reply` | Reply to conversation | Sync queue |
| POST | `/v1/media/upload` | Upload media | Sync queue (chunked) |
| GET | `/v1/accounts` | Connected accounts | SQLite cache |
| POST | `/v1/accounts/connect` | OAuth connect flow | Online only |
| GET | `/v1/calendar` | Calendar data (date range) | SQLite cache |
| GET | `/v1/ai/suggestions` | AI content suggestions | Cache (regenerated) |
| POST | `/v1/ai/generate` | Generate content | Online only |

### 8.3 Offline Queue for Mutations

When a mutation is performed offline:

1. **Optimistic write**: Write to SQLite immediately with `sync_status = 'pending_create'`
2. **Queue entry**: Insert into `sync_queue` with full payload
3. **UI update**: Show with "pending" indicator (clock icon, subtle badge)
4. **Network monitor**: Listen for connectivity changes via `@react-native-community/netinfo`
5. **Sync on reconnect**: When network becomes available, process queue FIFO
6. **Conflict detection**: On sync response, check `updated_at` against local version
7. **Resolution**: Auto-resolve (LWW) or prompt user

```typescript
// Network connectivity monitor
import NetInfo from '@react-native-community/netinfo';

export function useNetworkMonitor() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online ?? false);

      // Trigger sync queue when coming back online
      if (online) {
        getSyncQueueProcessor().start();
      }
    });

    return () => sub();
  }, []);
}
```

### 8.4 Request Deduplication

The deduplication layer prevents the same API call from firing multiple times when:

- Multiple components mount and request the same data simultaneously
- User rapidly navigates between tabs that fetch the same resource
- Retry logic overlaps with a fresh user-triggered request

**Implementation**: In-flight request map keyed by `method:path:bodyHash`. Subsequent calls with the same key await the existing promise instead of creating a new fetch.

### 8.5 Retry Logic Details

| Attempt | Delay (base=1s) | Jitter |
|---|---|---|
| 0 (first) | 0ms | 0 |
| 1 | ~1,000ms | ±500ms |
| 2 | ~2,000ms | ±500ms |
| 3 | ~4,000ms | ±1,000ms |
| 4 (max) | ~8,000ms | ±1,000ms |

Retry is skipped for:
- 4xx errors except 408 (Request Timeout) and 429 (Rate Limited)
- Network errors that are clearly client-side (invalid URL, cert errors after 1 retry)
- Errors where `Retry-After` header is absent for 429s (moves to queue instead)

---

## 9. Performance Strategy

### 9.1 Image Caching

```typescript
// /apps/mobile/src/components/optimized/CachedImage.tsx

import { Image } from 'expo-image';
// expo-image provides:
// - Disk caching (configurable size: default 200MB)
// - Memory caching
// - Blurhash placeholders
// - Progressive loading
// - Cache control (TTL per image type)

// Usage in media grid:
<Image
  source={{ uri: item.remoteUrl }}
  placeholder={{ blurhash: item.blurhash }}
  cachePolicy="memory-disk"
  contentFit="cover"
  transition={300}
  style={{ width: '100%', aspectRatio: 1 }}
  // Priority loading for visible items
  priority={index < 4 ? 'high' : 'normal'}
/>
```

**Cache strategy:**

| Media Type | Disk Cache | Memory Cache | TTL |
|---|---|---|---|
| Profile avatars | 100MB limit | 50 items | 24h |
| Post images | 500MB limit | 100 items | 7d |
| Stories/videos | 1GB limit (LRU) | 20 items | 48h |
| Link previews | 50MB limit | 30 items | 1h |

### 9.2 List Virtualization

```typescript
// /apps/mobile/src/components/optimized/VirtualPostList.tsx

import { FlashList } from '@shopify/flash-list';

// Always use FlashList (not FlatList) for any list with > 10 items
<FlashList
  data={posts}
  renderItem={PostCard}
  estimatedItemSize={200}      // Must be set for FlashList
  keyExtractor={item => item.id}
  // Performance props
  removeClippedSubviews={true}
  windowSize={5}               // Render 5 screens worth
  maxToRenderPerBatch={10}
  initialNumToRender={7}
  // Recycling
  recyclingKey={item => item.platform}
  // Empty state
  ListEmptyComponent={<EmptyState />}
  // Pull to refresh
  onRefresh={handleRefresh}
  refreshing={isRefreshing}
  // Infinite scroll
  onEndReached={handleLoadMore}
  onEndReachedThreshold={0.5}
/>
```

### 9.3 Bundle Size Optimization

```typescript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Tree-shaking
  config.transformer.minifierConfig = {
    compress: {
      drop_console: true,             // Remove console.* in production
      drop_debugger: true,
      pure_funcs: ['console.log'],
    },
  };

  // Exclude unnecessary modules
  config.resolver.blacklistRE = [
    /node_modules\/.*\/react-native\/Libraries\/Animated\/.*/,
  ];

  return config;
})();
```

**Bundle reduction targets:**

| Strategy | Reduction | Technique |
|---|---|---|
| Hermes engine | ~20% | Use Hermes bytecode (default in Expo SDK 56) |
| Tree-shaking | ~15% | Remove unused imports, use `pure_funcs` |
| Lazy routes | ~30% | `expo-router` lazy loads pages by default |
| Image optimization | ~40% (images) | WebP/AVIF at build time, serve from CDN |
| Font subsetting | ~50% (fonts) | Subset fonts to used characters |
| Remove moment.js | ~250KB | Use `date-fns` instead (already in stack) |
| CodePush splitting | ~20% | Split analytics-heavy code into deferrable chunk |

### 9.4 Lazy Loading Strategy

| Screen | Load Strategy | Rationale |
|---|---|---|
| Dashboard | Eager (tab 1) | First screen user sees |
| Calendar | Lazy (on tab focus) | Heavy data query |
| Composer | Preloaded (tab next to active) | User expects instant open |
| Analytics | Lazy (on tab focus) | Heavy charts + data |
| Inbox | Preloaded (after auth) | Real-time connection setup |
| Settings | Lazy (on navigate) | Rarely accessed |
| Post detail | Lazy (on navigate) | Opened via deep link or calendar |

### 9.5 Startup Performance

```typescript
// /apps/mobile/app/_layout.tsx

// Critical path initialization
export default function RootLayout() {
  // 1. Mount providers (synchronous)
  return (
    <Providers>
      <SplashScreen />
    </Providers>
  );
}

// Inside Providers:
function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>        {/* Check stored session */}
        <SyncProvider>       {/* Start sync engine */}
          <NetworkProvider>  {/* Monitor connectivity */}
            <NotificationProvider> {/* Register push */}
              <DeepLinkProvider>
                {children}
              </DeepLinkProvider>
            </NotificationProvider>
          </NetworkProvider>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Startup timeline:
// 0ms     → App cold start
// 50ms    → Hermes init + require
// 100ms   → Auth token check (SecureStore sync read)
// 150ms   → SQLite init (schema migration)
// 200ms   → Render splash screen
// 250ms   → Auth state resolved → dashboard or login
// 300ms   → Dashboard data fetch (SQLite read)
// 400ms   → Render dashboard from cache
// 800ms   → API data refresh completes → re-render
// 1200ms  → Post analytics fetch
// 1500ms  → AI suggestions fetch (low priority)
```

---

## 10. CI/CD & Release Pipeline

### 10.1 Build Pipeline (EAS Build + Fastlane)

```yaml
# .github/workflows/mobile-release.yml
name: Mobile Release

on:
  push:
    tags:
      - 'mobile-v*.*.*'
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        default: staging

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Type check
        run: yarn workspace @socialos/mobile typecheck

      - name: Run tests
        run: yarn workspace @socialos/mobile test

      - name: Build Android (EAS)
        run: |
          npx eas build --platform android \
            --profile ${{ github.event.inputs.environment }} \
            --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}

      - name: Build iOS (EAS)
        run: |
          npx eas build --platform ios \
            --profile ${{ github.event.inputs.environment }} \
            --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Submit to Play Console (Android)
        run: |
          npx eas submit --platform android \
            --profile ${{ github.event.inputs.environment }}

      - name: Submit to TestFlight (iOS)
        run: |
          npx eas submit --platform ios \
            --profile ${{ github.event.inputs.environment }}
```

### 10.2 EAS Build Profiles

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development",
        "API_URL": "https://api.dev.socialos.com"
      }
    },
    "staging": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "ios": {
        "simulator": false
      },
      "env": {
        "APP_ENV": "staging",
        "API_URL": "https://api.staging.socialos.com"
      }
    },
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "enterpriseProvisioning": false
      },
      "env": {
        "APP_ENV": "production",
        "API_URL": "https://api.socialos.com"
      },
      "autoIncrement": true
    }
  },
  "submit": {
    "staging": {
      "android": {
        "track": "internal"
      },
      "ios": {
        "appleId": "apps@socialos.com",
        "ascAppId": "1234567890"
      }
    },
    "production": {
      "android": {
        "track": "production"
      },
      "ios": {
        "appleId": "apps@socialos.com",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

### 10.3 Fastlane Configuration

```ruby
# apps/mobile/fastlane/Fastfile

platform :ios do
  desc "Build and sign iOS app"
  lane :build do |options|
    increment_build_number(
      build_number: options[:build_number] || current_time
    )

    match(
      type: options[:type] || "appstore",
      readonly: true
    )

    gym(
      scheme: "SocialOS",
      configuration: options[:config] || "Release",
      export_method: options[:export_method] || "app-store",
      include_bitcode: true,
      include_on_demand_resources: true
    )
  end

  desc "Upload to TestFlight"
  lane :upload_testflight do
    pilot(
      apple_id: "com.socialos.app",
      distribute_only: false,
      notify_external_testers: false,
      groups: ["Internal Testers"]
    )
  end

  desc "Full release pipeline"
  lane :release do |options|
    match(type: "appstore")
    build(config: "Release", export_method: "app-store")
    upload_testflight
    upload_to_app_store(skip_metadata: true, skip_screenshots: true)
  end
end

platform :android do
  desc "Build Android app bundle"
  lane :build do
    gradle(
      task: "bundle",
      build_type: "Release",
      properties: {
        "android.injected.signing.store.file" => ENV["KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["KEY_ALIAS"],
        "android.injected.signing.key.password" => ENV["KEY_PASSWORD"]
      }
    )
  end

  desc "Upload to Play Console"
  lane :upload_play_console do
    upload_to_play_store(
      track: "production",
      release_status: "completed",
      skip_upload_apk: true,
      skip_upload_aab: false,
      skip_upload_metadata: true,
      skip_upload_images: true,
      skip_upload_screenshots: true
    )
  end
end
```

### 10.4 OTA Updates (EAS Update)

```json
// eas.json (update config)
{
  "cli": {
    "version": ">= 3.0"
  },
  "submit": {},
  "build": {},
  "update": {
    "staging": {
      "channel": "staging",
      "distribution": "internal"
    },
    "production": {
      "channel": "production",
      "distribution": "store"
    }
  }
}
```

**Update policy:**

- **Critical hotfix** (crash, security): Push to 100% immediately, force update
- **Minor update** (UI tweaks, non-critical): Rollout 1% → 10% → 50% → 100% over 48h
- **Major update** (new features): Bundle via EAS Build + App Store review; OTA for non-native changes only
- **Rollback**: EAS Update supports instant rollback via dashboard

```bash
# Publish OTA update
npx eas update --branch production --message "fix: crash on calendar drag"

# Rollback
nks eas update:rollback --branch production --to-timestamp <timestamp>
```

### 10.5 Version Matrix

| Version | Native Changes | OTA Changes | App Store | Method |
|---|---|---|---|---|
| 1.0.0 | Initial release | — | Yes | EAS Build |
| 1.0.1 | None | Bug fixes | No | EAS Update |
| 1.1.0 | New permissions | New screens | Yes | EAS Build + Update |
| 1.2.0 | SDK upgrade | Features | Yes | EAS Build + Update |
| 2.0.0 | Major redesign | Everything | Yes | EAS Build |

---

## 11. App Store Strategy

### 11.1 App Store Optimization (ASO)

**App Name:**
- Primary: SocialOS — AI Social Media Manager
- Subtitle (iOS): Schedule, publish, analyze
- Short (Android): AI Social Media OS

**Keyword Strategy:**

| Category | Keywords (iOS 100-char limit) |
|---|---|
| Core | social media manager, scheduler, content calendar, AI |
| Competitive | buffer alternative, hootsuite alternative, later alternative |
| Feature | schedule posts, analytics, engagement, team collaboration |
| Platform | Instagram, TikTok, LinkedIn, Twitter, Threads, Facebook |
| Long-tail | ai caption generator, best time to post, social media analytics |

**Target keyword groups:**
```
Primary:   social media scheduler, content calendar app
Secondary: ai social media manager, post scheduler, instagram scheduler
Tertiary:  buffer alternative, hootsuite alternative, later alternative
Long-tail: best time to post on social media, ai caption writer
```

### 11.2 Screenshot Templates

**iOS Screenshots (6.7"):**

| # | Template | Copy | Elements |
|---|---|---|---|
| 1 | Hero | "Schedule Posts in Seconds" | Dashboard overview, metrics cards |
| 2 | Calendar | "Visual Content Calendar" | Month view with post dots, day detail |
| 3 | AI Composer | "Write Captions with AI" | Composer with AI assistant panel open |
| 4 | Analytics | "Track What Works" | Charts, engagement metrics, top posts |
| 5 | Inbox | "Manage Engagement" | Unified inbox with AI reply suggestions |
| 6 | Cross-Platform | "Schedule to Every Platform" | Platform selector with logos |

**Android screenshots follow same structure but adapted to 16:9 ratio.**

**A/B Test variables:**
- Screenshot 1: Dashboard vs Calendar as hero
- Copy tone: "Schedule smarter" vs "AI-powered scheduling"
- Color scheme: Dark mode vs light mode

### 11.3 Description Templates

```
[Short Description - Android only, 80 chars]
AI social media scheduler. Schedule, analyze, and engage across all platforms.

[Promotional Text - iOS, 170 chars]
The AI-powered social media OS. Schedule posts, analyze performance, manage engagement, and collaborate with your team — all in one place.

[Description - iOS / Full Description - Android]

TITLE: SocialOS — AI Social Media Manager

Managing social media across multiple platforms is chaotic. SocialOS brings order.

WHY SOCIALOS?

• AI-POWERED SCHEDULING — Our AI analyzes your audience and suggests the best times to post for maximum engagement. Auto-schedule your entire month in minutes.

• VISUAL CONTENT CALENDAR — Drag, drop, and plan your content strategy with a beautiful calendar view. See your entire month at a glance.

• UNIFIED ANALYTICS — Track impressions, engagement, follower growth, and clicks across all platforms. AI-generated insights tell you exactly what's working.

• SMART COMPOSER — Write once, publish everywhere. AI caption generator, hashtag suggestions, and platform-specific formatting built in.

• ENGAGEMENT INBOX — All your comments, mentions, and DMs in one place. AI-drafted replies save you hours each week.

• TEAM COLLABORATION — Invite team members, assign roles, review posts, and approve before publishing.

• OFFLINE-FIRST — Write and schedule posts even without internet. Everything syncs when you're back online.

PLATFORMS SUPPORTED:
Instagram • TikTok • LinkedIn • Twitter/X • Facebook • Threads • YouTube

SUBSCRIBE TO UNLOCK:
• Unlimited scheduled posts
• Advanced analytics
• AI content generation
• Team collaboration (5+ seats)
• Priority support

SocialOS offers auto-renewing subscriptions:
- Monthly: $19/month
- Yearly: $190/year (save 20%)
- Team: $49/month (up to 5 seats)

Privacy Policy: https://socialos.com/privacy
Terms of Service: https://socialos.com/terms
```

### 11.4 Review Management

**Review Response Templates:**

```typescript
const REVIEW_TEMPLATES = {
  positive: (name: string) => ({
    title: `Thanks ${name}!`,
    body: `We're glad SocialOS is helping you manage your social media. If there's anything specific you'd love to see, feel free to reach out at feedback@socialos.com. We read every review!`,
    action: 'Ask for feature request privately'
  }),

  negative_bug: (name: string, summary: string) => ({
    title: `Sorry about that, ${name}`,
    body: `We'd love to fix this. Could you reach out to support@socialos.com with details about "${summary}"? We'll prioritize a fix and let you know when it's resolved.`,
    action: 'Escalate to engineering, tag in issue tracker'
  }),

  negative_feature_request: (name: string, feature: string) => ({
    title: `Great suggestion, ${name}!`,
    body: `${feature} is on our roadmap! We'd love to hear more about your use case. Drop us a line at feedback@socialos.com and we'll keep you updated on our progress.`,
    action: 'Add to feature voting board, notify when shipped'
  }),

  neutral: (name: string) => ({
    title: `Hi ${name}!`,
    body: `Thanks for your feedback. We're constantly improving SocialOS. If there's something specific we can help with, please reach out to support@socialos.com.`,
    action: 'No follow-up needed'
  }),
};
```

**Response SLA:**

| Rating | Response Time | Owner |
|---|---|---|
| 1 star | < 4 hours | Support lead |
| 2 star | < 8 hours | Support engineer |
| 3 star | < 24 hours | Support engineer |
| 4 star | < 48 hours | Automated (template) |
| 5 star | < 72 hours | Automated (template) |

### 11.5 Phased App Store Rollout

| Phase | Stores | Timeline | Criteria to Advance |
|---|---|---|---|
| Alpha | TestFlight (internal) | Week 1-2 | Crash rate < 1%, all critical bugs fixed |
| Beta | TestFlight (external) + Play Console (internal) | Week 3-4 | NPS > 30, crash rate < 0.5% |
| Soft launch | US + Canada (iOS), US (Android) | Week 5-6 | Day 7 retention > 25%, rating > 4.0 |
| Regional | EU + UK + ANZ | Week 7-8 | Conversion rate > 3%, support volume stable |
| Global | All stores | Week 9+ | Everything above |

---

*End of Document — Mobile App Architecture*
