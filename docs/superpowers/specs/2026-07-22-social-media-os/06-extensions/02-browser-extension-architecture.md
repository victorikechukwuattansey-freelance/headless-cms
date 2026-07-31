# Browser Extension Architecture — AI Social Media OS

> **Version:** 1.0
> **Date:** 2026-07-22
> **Audience:** Extension engineering team, platform architects
> **Status:** Draft for review

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Extension Capabilities](#2-extension-capabilities)
3. [Architecture Overview](#3-architecture-overview)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [Message Passing & Communication](#5-message-passing--communication)
6. [Permissions Model](#6-permissions-model)
7. [Security Architecture](#7-security-architecture)
8. [Cross-Browser Compatibility](#8-cross-browser-compatibility)
9. [Packaging & Distribution](#9-packaging--distribution)
10. [Analytics & Telemetry](#10-analytics--telemetry)

---

## 1. Tech Stack

### 1.1 Core Technologies

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Extension framework | **WXT** | 3.2+ | Vite-powered, HMR, first-class MV3 support, cross-browser manifests |
| Language | **TypeScript** | 5.6+ (strict) | Ubiquitous in social OS monorepo, type safety |
| UI framework | **React 19** | 19.0+ | Shared components with web app |
| Styling | **Tailwind CSS 4** | 4.0+ | Utility-first, tiny runtime |
| Build | **Vite 6** | 6.0+ | Fast HMR, tree-shaking |
| State | **Zustand** | 5.0+ | Works outside React (service worker) |
| Storage | **IndexedDB** (Dexie) + **chrome.storage** | — | Structured data + settings/tokens |
| Icons | **Lucide React** | 0.400+ | Tree-shakeable icon set |
| Testing | **Vitest** + **Playwright (extension mode)** | — | Unit + E2E |
### 1.2 WXT Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react', '@wxt-dev/module-tailwind'],
  srcDir: 'src',
  outDir: 'dist',
  manifest: {
    manifest_version: 3,
    name: 'SocialOS - AI Social Media Manager',
    version: '1.0.0',
    description: 'Schedule, capture, and publish content from anywhere on the web.',
    permissions: ['storage', 'alarms', 'contextMenus'],
    optional_permissions: ['tabs', 'activeTab', 'clipboardWrite', 'downloads'],
    host_permissions: ['https://api.socialos.com/*'],
    action: {
      default_popup: 'popup/index.html',
      default_icon: { 16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+S', mac: 'Mac+Shift+S' },
        description: 'Open SocialOS extension',
      },
      'quick-capture': {
        suggested_key: { default: 'Alt+Shift+C', mac: 'Mac+Shift+C' },
        description: 'Quick capture current page',
      },
    },
  },
});
```

### 1.3 Project Structure

```
src/
  entrypoints/
    background.ts           # Service worker
    popup/                  # Popup UI (React)
      index.html / main.tsx / App.tsx / components/ / hooks/
    content-scripts/        # Content scripts
      capture.ts / context-menu.ts / screenshot.ts / auto-detect.ts
    options/                # Options page
    sidepanel/              # Side panel (Chrome 114+)
  components/               # Shared extension components
  hooks/                    # Shared hooks
  lib/                      # Core library
    api/ / auth/ / storage/ / messaging/ / capture/ / ai/
  types/ / utils/ / icons/
public/                     # Static assets
  icons/ / sounds/
```

---

## 2. Extension Capabilities

### 2.1 Quick Post from Any Webpage

**Entry points:**
- Right-click context menu on page: "Share to SocialOS"
- Right-click context menu on link: "Share link to SocialOS"
- Right-click context menu on image: "Share image to SocialOS"
- Keyboard shortcut `Alt+Shift+S`: popup with pre-filled content
- Browser toolbar icon: popup composer

**Flow:**
```
User right-clicks on page
  -> Context menu item: "Share to SocialOS"
  -> Content script extracts: title, URL, meta description, OG image, selected text
  -> Message sent to background worker
  -> Open popup/sidepanel with link auto-pasted + preview card + AI suggestion
  -> User selects account, edits caption, sets schedule
  -> Post created via API (offline queue if needed)
```

### 2.2 Content Capture & Repurpose

| Capture Type | Source | Output |
|---|---|---|
| Full page text | document.body.innerText | Clean text (Readability) |
| Selected text | User highlight | Selection with citation |
| Article | Readability parser | Title, author, body, image |
| Table/data | document.querySelector('table') | Markdown table |
| Code snippet | pre code blocks | Formatted code with language |
| Quote | User selects + repurpose | Pull-quote formatted text |

### 2.3 Link Sharing with Auto-Generated Preview

Flow: User pastes URL -> Extension sends to POST /v1/links/preview -> Server parses OpenGraph -> Returns { title, description, image, siteName, url } -> Preview card renders in composer.

### 2.4 Screenshot Tool

Capabilities: Capture viewport, full page (scrolling composite), selected region (drag-to-select overlay), annotate (arrows, rectangles, text, blur), upload to SocialOS media library, OCR via API.

### 2.5 Schedule from Context Menu

Quick-schedule: right-click -> "Schedule to SocialOS" -> submenu: "Now" / "Best time (AI)" / "Pick time" -> auto-generate caption -> confirm -> post scheduled.

### 2.6 AI Quick Actions

| Action | Trigger | Description |
|---|---|---|
| Summarize page | Context menu / popup | 3-bullet summary |
| Generate post | Context menu / popup | Create post from page content |
| Repurpose | Context menu submenu | Rewrite for different platform |
| Extract quotes | Context menu on selection | Find quotable lines |
| Generate hashtags | Popup button | 5-10 relevant hashtags |
| Translate & post | Popup button | Translate to target language |
| Tone rewrite | Popup button | Rewrite in chosen tone |

---

## 3. Architecture Overview

### 3.1 Component Architecture

```
+-------------------------------------------------------------------+
|                      BROWSER (Chrome/Edge/Firefox/Brave)           |
|                                                                     |
|  +----------------------------------------------------------------+ |
|  |                 BACKGROUND SERVICE WORKER                       | |
|  |  +----------+ +----------+ +----------+ +------------+ +------+| |
|  |  | Auth     | | Message  | | Alarm    | | API Client | |CtxMen|| |
|  |  | Manager  | | Router   | | Scheduler| | + Queue    | |Mgr   || |
|  |  +----------+ +----------+ +----------+ +------------+ +------+| |
|  |  +------------------------------------------------------------+ | |
|  |  |              Zustand Store (Shared State)                   | | |
|  |  +------------------------------------------------------------+ | |
|  +----------------------------------------------------------------+ |
|                               |                                      |
|  +----------------------------+-----------------------------------+ |
|  |              MESSAGE PASSING (chrome.runtime.sendMessage)       | |
|  +----------------------------+-----------------------------------+ |
|                               |                                      |
|  +----------------------------+-----------------------------------+ |
|  |  +--------------+     +--------------+     +------------------+ | |
|  |  |   POPUP      |     |  SIDEPANEL   |     |  OPTIONS PAGE    | | |
|  |  |  (React)     |     |  (React)     |     |  (React)         | | |
|  |  |  Composer    |     |  Dashboard   |     |  Account Settings| | |
|  |  |  Capture     |     |  Calendar    |     |  Preferences     | | |
|  |  +--------------+     +--------------+     +------------------+ | |
|  +----------------------------------------------------------------+ |
|                               |                                      |
|  +----------------------------+-----------------------------------+ |
|  |                     CONTENT SCRIPTS                             | |
|  |  +--------------+ +--------------+ +-------------------------+  | |
|  |  |  capture.ts  | |screenshot.ts | |  auto-detect.ts        |  | |
|  +--------------+ +--------------+ +-------------------------+    | |
|  +----------------------------------------------------------------+ |
+-------------------------------------------------------------------+
```
### 3.2 Service Worker (Background)

```typescript
import { defineBackground } from 'wxt/background';

export default defineBackground(() => {
  migrateStorageIfNeeded();
  registerContextMenus();
  auth.initialize();

  scheduler.register({
    name: 'sync-queue', periodInMinutes: 5,
    handler: async () => {
      const queue = await getPendingQueueItems();
      for (const item of queue) await processQueueItem(item);
    },
  });

  scheduler.register({
    name: 'check-scheduled-posts', periodInMinutes: 1,
    handler: async () => {
      const due = await getDueScheduledPosts();
      for (const post of due) {
        await publishScheduledPost(post);
        await showNotification({ title: 'Post Published', message: `...` });
      }
    },
  });

  scheduler.register({
    name: 'refresh-token', periodInMinutes: 15,
    handler: async () => { await auth.refreshIfNeeded(); },
  });

  router.register(handleMessages);
});
```

### 3.3 Popup UI (400px x 600px)

Auth header -> Account dropdown -> Composer (caption area, character count) -> Media/Link/Voice buttons -> Schedule picker -> AI Actions panel -> Publish button -> Quick Stats footer.

### 3.4 Side Panel (Chrome 114+)

Persistent SocialOS panel alongside any webpage. Features: full composer, compact calendar, recent posts, drafts, AI assistant chat, content library.

### 3.5 Options Page

Full configuration: account management, notification prefs, permission group requests, theme selection, keyboard shortcuts, data export.

---

## 4. Authentication & Session Management

### 4.1 OAuth Flow (PKCE)

```
Extension -> Open auth page via chrome.identity.launchWebAuthFlow
  -> User logs in and consents
  -> Auth code returned to extension
  -> Extension exchanges code for tokens via POST /v1/auth/token
  -> Access token (15 min) + Refresh token (7 day) stored in chrome.storage.local
  -> Tokens encrypted with AES-256-GCM derived from device ID
```

### 4.2 Token Storage

| Storage | Data | Encryption |
|---|---|---|
| chrome.storage.local | Access token, refresh token, user info | AES-256-GCM |
| chrome.storage.session | PKCE verifier, state | None (session) |
| chrome.storage.sync | Settings, prefs | None |

### 4.3 Token Refresh

Automatic via alarm (every 15 min). If refresh fails, force re-auth. Concurrent refresh attempts are deduplicated via promise caching.

---

## 5. Message Passing & Communication

### 5.1 Message Types

Popup <-> Background: GET_CAPTURED_CONTENT, CREATE_POST, GET_AUTH_STATUS
Background <-> Content Script: CAPTURE_PAGE, CAPTURE_SELECTION, GET_PAGE_DIMENSIONS, SCROLL_TO
Content Script -> Background: PAGE_CAPTURED, SCREENSHOT_TAKEN
Side Panel -> Background: GET_DASHBOARD_DATA, GET_CALENDAR_DATA
Broadcasts: POST_PUBLISHED, AUTH_STATE_CHANGED, SYNC_COMPLETED

### 5.2 Message Router

Centralized handler registered via chrome.runtime.onMessage. Async responses via returning true (keep channel open). Wrapped in MessageRouter class with static helpers: sendToBackground, sendToTab, sendToActiveTab.

### 5.3 Port-Based Connections

For AI streaming and real-time updates: chrome.runtime.connect with named ports ('ai-stream', 'realtime-analytics'). Enables continuous bidirectional communication.

### 5.4 Native Messaging (Desktop Companion)

For file system access, screen recording, desktop notifications, local AI models. Requires native messaging host manifest (com.socialos.native.json).

---

## 6. Permissions Model

### 6.1 Minimal Default

```json
{
  "permissions": ["storage", "alarms", "contextMenus"],
  "host_permissions": ["https://api.socialos.com/*"]
}
```

### 6.2 Optional (on-demand)

activeTab, tabs, clipboardWrite, downloads, notifications, scripting, https://*/* http://*/*

### 6.3 Permission Groups

| Group | Permissions | Used For |
|---|---|---|
| page-capture | activeTab | Read page content |
| screenshots | activeTab, downloads, *://* | Full page capture |
| notifications | notifications | Desktop alerts |
| clipboard | clipboardWrite | Copy AI results |

All requested via chrome.permissions.request with clear UI explanations and "Learn why" links.

---

## 7. Security Architecture

### 7.1 CSP

```json
{
  "extension_pages": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.socialos.com data:; connect-src 'self' https://api.socialos.com https://cdn.socialos.com; frame-src 'none'; object-src 'none'"
}
```

### 7.2 XSS Prevention

- DOMPurify for all user-generated content display
- Strip all HTML tags from captions shown in extension
- Sanitize URLs to allow only https/http/mailto protocols
- Input validation with Zod schemas at every content script boundary

### 7.3 Content Script Isolation

MV3 default (ISOLATED world). MAIN world only for social platform integration scripts (Twitter/X). Input validated before crossing the isolation boundary.

---

## 8. Cross-Browser Compatibility

### 8.1 Differences

| Feature | Chrome | Edge | Firefox | Brave |
|---|---|---|---|---|
| Side panel | chrome.sidePanel (114+) | Same | sidebar_action | N/A |
| Identity | chrome.identity | Same | browser.identity | chrome.identity |
| Service worker | 30s timeout | Same | Event-driven | Same as Chrome |
| Store | CWS | Edge Add-ons | Firefox Add-ons | CWS |

### 8.2 Build Profiles (WXT)

Separate build per browser: wxt build --browser chrome/edge/firefox. Firefox uses MV2 fallback with background page instead of service worker. Side panel feature detection with graceful fallback.

---

## 9. Packaging & Distribution

### 9.1 Build

- Dev: wxt (HMR on port 3000)
- Production: wxt build --browser <name>
- Zip: wxt zip --browser <name>
- CI/CD: GitHub Actions matrix build for Chrome, Edge, Firefox

### 9.2 Store Listings

- Chrome Web Store: Permission justifications, screenshots (1280x800), promotional tile (440x280)
- Edge Add-ons: Same as CWS, additional Microsoft certification
- Firefox Add-ons: Source code submission, AMO manual review (1-3 weeks), addons-linter pass

### 9.3 Self-Hosted Updates (Enterprise)

Update manifest JSON served from cdn.socialos.com with CRX packages and SHA256 hashes. For managed enterprise deployments.

### 9.4 Version Lifecycle

1.0.0 (initial, manual review 2-5d) -> 1.0.1 (bugfix, auto-review) -> 1.1.0 (features, staged rollout) -> 2.0.0 (major redesign, staged)

---

## 10. Analytics & Telemetry

### 10.1 Privacy-Compliant

- Opt-in only, disabled by default
- No PII collected
- Events scrubbed of sensitive data (email, phone, address, token patterns)
- Session IDs are random UUIDs, not tied to user identity
- Batch-sent every 60s or on buffer full (20 events)
- Used for: feature adoption, error tracking, performance monitoring

### 10.2 Events Tracked

Session start/end, auth events, context menu shares (type), composer opens (source), posts created (platform count, media, AI used), screenshots (type), feature usage, errors (sanitized), performance metrics.

### 10.3 Error Reporting

Separate opt-in toggle from analytics. Stack traces filtered to extension code only (no user page stack frames). Sent via keepalive fetch for reliability during unload.

---

## Appendix A: Performance Budget

| Metric | Target |
|---|---|
| Popup load time | < 500ms |
| Content script injection | < 100ms |
| API response (p95) | < 800ms |
| Screenshot capture | < 2s (viewport) / < 5s (full) |
| Bundle (popup) | < 300KB gzipped |
| Bundle (SW) | < 200KB gzipped |
| Storage used | < 50MB |

## Appendix B: Browser Support

Chrome 110+, Edge 110+, Firefox 115+, Brave 1.60+, Opera 96+. Safari not supported (future).

---

*End of Document - Browser Extension Architecture*
