# UI/UX Wireframes — AI Social Media OS

**Document:** UI/UX Wireframes & User Flows  
**Platform:** AI Social Media OS (Buffer-competitive)  
**Tech Stack:** Next.js 14 + Tailwind CSS + shadcn/ui  
**Date:** 2026-07-22  
**Author:** Lead Product Designer

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [AI Content Studio](#2-ai-content-studio)
3. [Repurposing Engine](#3-repurposing-engine)
4. [Smart Scheduler](#4-smart-scheduler)
5. [Analytics Dashboard](#5-analytics-dashboard)
6. [Engagement Inbox](#6-engagement-inbox)
7. [Content Library](#7-content-library)
8. [Brand Voice Settings](#8-brand-voice-settings)
9. [Workflow Automation Builder](#9-workflow-automation-builder)
10. [Campaign Builder](#10-campaign-builder)
11. [MCP Marketplace](#11-mcp-marketplace)
12. [Settings & Billing](#12-settings--billing)
13. [Onboarding Flow](#13-onboarding-flow)
14. [User Flow Diagrams](#14-user-flow-diagrams)

---

## 1. Dashboard

### Layout Description

Three-column responsive layout: left sidebar (accounts + quick actions), center (calendar + posts), right panel (AI suggestions). On tablet, right panel collapses to a slide-over. On mobile, each section becomes a stack.

### Key UI Components

- **AppShell** with collapsible sidebar
- **CalendarView** (month/week/day toggle)
- **StatCard** row (posts published, engagement rate, followers growth, AI credits used)
- **AISuggestionCard** feed in right panel
- **PostCard** for recent/upcoming posts
- **PlatformBadge** on each post
- **AccountCard** list in sidebar

### Information Hierarchy

1. Top bar: workspace switcher, search, notifications, user menu
2. Stats bar: 4 KPI cards
3. Left sidebar (260px): connected accounts with status indicators, quick-create button
4. Center: CalendarView as primary content, below it recent posts feed
5. Right panel (340px): "AI Suggestions" heading, 4-6 suggestion cards, "Upcoming Queue" mini-list

### Primary User Actions

- Click "+" to create new post → opens AI Content Studio
- Click date on calendar → filter posts by date
- Click post card → edit/schedule
- Drag post on calendar → reschedule
- Accept AI suggestion → pre-fill composer
- View analytics → navigate to Analytics

### Textual Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [WS] Workspace ▼  [🔍 Search]                    [🔔] [👤]         │
├──────────┬──────────────────────────────────────────┬───────────────┤
│ Accounts │  📅 Month ▼    ◀ July 2026 ▶    +New     │ 💡 AI Ideas  │
│──────────│──────────────────────────────────────────│───────────────│
│ ● @brand │  Mon  Tue  Wed  Thu  Fri  Sat  Sun       │ ✨ Write a    │
│ ○ @ceo   │      1    2    3    4    5    6           │   thread      │
│ ○ @corp  │    ┌──┐ ┌──┐      ┌──┐                   │               │
│──────────│    │  │ │  │      │  │                   │ "5 tips for   │
│ +Connect │    └──┘ └──┘      └──┘                   │  social..."   │
│──────────│                                          │  [Use] [Edit] │
│ 📊 Stats │      7    8    9   10   11   12  13       │───────────────│
│ 23 posts │    ┌──┐ ┌──┐ ┌──┐ ┌──┐                   │ 🎯 Repurpose  │
│ this week │    │  │ │  │ │  │ │  │                   │ "Turn blog    │
│──────────│    └──┘ └──┘ └──┘ └──┘                   │  post into..."│
│ ⚡ Quick  │                                          │  [Use] [Edit] │
│  [📝 Post]│    14   15   16   17   18   19   20      │───────────────│
│  [📅 All] │         ┌──┐    ┌─────┐                 │ 🗓️ Upcoming  │
│  [📊 Report]│       │  │    │     │                 │ • 2pm - Insta │
└──────────┴──────────────────────────────────────────┴───────────────┘
```

---

## 2. AI Content Studio

### Layout Description

Split-panel layout: composer on left (60%), AI tools on right (40%). The composer has a platform selector bar at top, then the post editor, then live previews below. The right panel has AI action tabs and output.

### Key UI Components

- **SplitPane** with resizable divider
- **PlatformSelector** (multi-select checkboxes)
- **RichTextEditor** with formatting toolbar
- **AIPromptInput** with context-aware suggestions
- **AIGenerationPanel** for results
- **BrandVoiceIndicator** showing active voice profile
- **Live preview cards** per selected platform

### Information Hierarchy

1. Top bar: "Content Studio" title, Save Draft, Schedule buttons
2. Left panel: Platform selector chips, editor toolbar, editor textarea, media attachment strip, platform previews
3. Right panel: Tab bar (Generate | Repurpose | Improve | Translate), prompt input, results area, "Apply" button

### Primary User Actions

- Select platforms → live previews update
- Type/paste content → character counts per platform
- Click "Generate" → enter prompt, select tone, generate
- Click "Apply" on AI output → content replaces/inserts
- Click "Improve" → select aspect (tone, length, clarity)
- Click "Schedule" → opens Smart Scheduler

### Textual Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Content Studio                     [💾 Save] [📅 Schedule] [X]     │
├───────────────────────────────────┬──────────────────────────────────┤
│ ┌──────────────────────────┐      │ 🔮 AI Tools                     │
│ │ Platform: [●] 𝕏 [●] LI   │      │ ─────────────────────────        │
│ │         [●] IG [○] FB    │      │ [Generate] [Repurpose] [Improve] │
│ │         [●] TT [○] YT    │      │ [Translate]                      │
│ └──────────────────────────┘      │                                  │
│ ┌──────────────────────────┐      │ ┌─────────────────────────┐      │
│ │ B I U H1 H2 ··· [🎨]     │      │ │ ✏️ What do you want to   │      │
│ │──────────────────────────│      │ │   generate?              │      │
│ │                          │      │ │                           │      │
│ │ [Editor area]            │      │ │ [Write a thread about...] │      │
│ │                          │      │ │                           │      │
│ │                          │      │ └─────────────────────────┘      │
│ │                          │      │                                  │
│ │                          │      │ 🎯 Tone: [Professional ▼]        │
│ └──────────────────────────┘      │ 📏 Length: [Medium ▼]            │
│                                   │ 🏷️ Brand Voice: [CEO Voice ●●●] │
│ 📎 [Media] [Emoji] [Link]         │                                  │
│                                   │ [✨ Generate]                     │
│ ┌─ Preview ──────────────────┐    │ ── Results ───────────────────── │
│ │ 𝕏 280/280 chars  ●●●       │    │ Option 1:                        │
│ │ "Excited to announce our   │    │ "Excited to announce..."         │
│ │  new AI-powered platform!" │    │ [Apply] [Edit] [Regenerate]      │
│ │                            │    │                                  │
│ │ LI: 1,200/3,000 chars      │    │ Option 2:                        │
│ │ "We've been working on     │    │ "Big news coming..."             │
│ │  something revolutionary." │    │ [Apply] [Edit] [Regenerate]      │
│ └────────────────────────────┘    └──────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Repurposing Engine

### Layout Description

Two-panel layout: source content input on the left, per-platform preview/edit grid on the right. Top bar has platform selectors and bulk actions.

### Key UI Components

- **FileUpload** or paste area for source content
- **PlatformIcon** chips for target selection
- **ContentScoreBadge** on each generated variant
- **AIGenerationPanel** showing repurposed results
- **Editable preview cards** per platform
- **Bulk schedule/add to queue** action bar

### Information Hierarchy

1. Top: "Repurpose Content" header, source format indicator
2. Left panel: Source input (paste text, upload video, submit URL), "Repurpose" button, source preview
3. Right panel: Grid of platform cards (2 cols desktop, 1 col mobile), each with editable preview, character count, platform icon, score badge
4. Bottom bar: "Add All to Queue", "Schedule All", per-card action buttons

### Primary User Actions

- Paste source content or upload file
- Select target platforms (auto-detected from source)
- Click "Repurpose" → AI generates per-platform variants
- Edit each variant inline
- Click "Add to Queue" or "Schedule" per card or bulk

### Textual Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔄 Repurposing Engine                    ⚡ Bulk Actions ▼ [Queue]  │
├──────────────────────┬───────────────────────────────────────────────┤
│ 📥 Source Content    │ 🎯 Target Platforms                          │
│ ──────────────────── │ ─────────────────────────────                 │
│                      │ [●] 𝕏  [●] LI  [●] IG  [●] TT               │
│ [📝 Paste text]      │ [●] FB  [●] YT  [○] Pin  [●] TK             │
│ [📎 Upload file]     │                                              │
│ [🔗 Submit URL]      │ ┌──────────────┐ ┌──────────────┐            │
│                      │ │ 𝕏 Thread     │ │ LI Article   │            │
│ ┌──────────────────┐ │ │ "5 ways AI   │ │ "In 2026,   │            │
│ │ Source: Blog Post│ │ │  is changing  │ │ social media │            │
│ │ Word count: 1200 │ │ │  social..."   │ │ is being..." │            │
│ │                  │ │ │ 275/280 chars│ │ 950/3000     │            │
│ │ [Source preview] │ │ │ [Edit] [Queue]│ │ [Edit] [Queue]│            │
│ │                  │ │ └──────────────┘ └──────────────┘            │
│ └──────────────────┘ │ ┌──────────────┐ ┌──────────────┐            │
│                      │ │ IG Carousel  │ │ TT Script    │            │
│ [✨ Repurpose]       │ │ "Slide 1/5   │ │ "🎬 Talking  │            │
│                      │ │  AI Changed  │ │  head: Did   │            │
│                      │ │  Everything" │ │  you know..." │            │
│                      │ │ [Edit] [Queue]│ │ [Edit] [Queue]│            │
│                      │ └──────────────┘ └──────────────┘            │
└──────────────────────┴───────────────────────────────────────────────┘
```

---

## 4. Smart Scheduler

### Layout Description

Full-width calendar layout with a collapsible queue panel on the right. Top row has view toggles, timezone selector, and "Optimal Times" button.

### Key UI Components

- **CalendarView** with month/week/day modes
- **DragHandle** on posts for rescheduling
- **TimeSlot** grid for day view
- **OptimalTimeRecommendation** overlay/tooltip
- **BulkUpload** dropzone
- **QueuePanel** with sortable post list
- **TimezoneSelector** with search

### Information Hierarchy

1. Top bar: View toggle (Month/Week/Day), date navigator, timezone selector, "Suggest Optimal Times" button
2. Main area: CalendarView with posts as colored blocks per platform
3. Right panel: Queue list (collapsible), showing scheduled + draft posts sorted by time
4. Bottom (optional): Bulk upload area for CSV/batch scheduling

### Primary User Actions

- Click empty slot → create post at that time
- Drag post to new time → reschedule
- Click post → edit details
- Click "Optimal Times" → AI highlights best time slots
- Bulk drag multiple posts
- Toggle between calendar and queue view

### Textual Wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│ 📅 Smart Scheduler    [Month] [Week] [Day]   🌐 [UTC-5 ▼] [✨ Best] │
├────────────────────────────────────────────┬──────────────────────────┤
│     July 2026                              │ 📋 Queue                 │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun         │ ────────                 │
│           1    2    3    4    5             │ 📅 Today, Jul 22        │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐      ┌──┐             │                         │
│ │  │ │  │ │  │ │  │      │  │             │ ● 9:00 𝕏  "Morning     │
│ └──┘ └──┘ └──┘ └──┘      └──┘             │     thread..." [Edit]   │
│   6    7    8    9   10   11   12           │ ● 12:00 IG "Product    │
│ ┌──┐    ┌──┐    ┌──┐ ┌──┐                 │     launch"  [Edit]     │
│ │  │    │  │    │  │ │  │                  │ ● 15:00 LI "Industry   │
│ └──┘    └──┘    └──┘ └──┘                 │     insights" [Edit]    │
│  13   14   15   16   17   18   19          │──────────────────────────│
│ ┌─────┐    ┌──┐    ┌──┐ ┌──┐             │ 📅 Tomorrow              │
│ │     │    │  │    │  │ │  │             │ ● 10:00 TT "TikTok      │
│ └─────┘    └──┘    └──┘ └──┘             │     teaser"   [Edit]    │
│  20   21  ●22  23   24   25   26          │ ● 14:00 FB "Weekly      │
│ ┌──┐ ┌──┐ ██  ┌──┐ ┌──────┐ ┌──┐        │     update"  [Edit]    │
│ │  │ │  │ ██  │  │ │      │ │  │        │──────────────────────────│
│ └──┘ └──┘ ██  └──┘ └──────┘ └──┘        │ 📝 Drafts (3)            │
│  27   28   29   30   31                   │ • "Q3 recap..."         │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐                     │ • "New feature..."      │
│ │  │ │  │ │  │ │  │                      │ • "Customer story"      │
│ └──┘ └──┘ └──┘ └──┘                     │                         │
│                                          │ [📤 Bulk Upload]         │
└──────────────────────────────────────────┴──────────────────────────┘
```

---

## 5. Analytics Dashboard

### Layout Description

Top-down scrollable dashboard. Top row: 6 KPI stat cards. Below: per-platform chart cards in a responsive grid. Bottom: AI insights panel and content score breakdown.

### Key UI Components

- **StatCard** with trend indicator
- **ChartContainer** wrapping Recharts/visx charts
- **TimeRangeSelector** (7d, 30d, 90d, Custom)
- **PlatformSelector** filter chips
- **ContentScoreBadge** with breakdown
- **InsightCard** with AI-generated observations
- **ExportControls** (PDF, CSV, PNG)

### Information Hierarchy

1. Top bar: "Analytics" title, TimeRangeSelector, Export button
2. Stats row: Posts Published, Total Engagement, Followers Gained, Engagement Rate, Best Platform, AI Credits
3. Charts grid: Engagement Over Time (line), Platform Breakdown (bar), Best Times (heatmap), Content Type Performance (pie)
4. Content Score section: score distribution, top-performing posts, improvement suggestions
5. AI Insights panel: natural-language summaries, anomaly detection, recommendations

### Primary User Actions

- Change time range → all charts update
- Click chart legend → toggle data series
- Click data point → drill down to post
- Click "Export" → download report
- Click AI insight → jump to recommended action

### Textual Wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│ 📊 Analytics    [7d] [30d] [90d] [Custom]     [📥 Export] [⚙️]       │
├───────────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │Posts │ │Engage│ │Follow│ │Eng % │ │Best  │ │Cred- │               │
│ │  142 │ │12.4K │ │ +892 │ │ 3.2% │ │ IG   │ │its   │               │
│ │ ▲12% │ │ ▲8%  │ │ ▲5%  │ │ ▲0.3%│ │      │ │ 340  │               │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                                      │
│ ┌─────────────────────┐ ┌─────────────────────┐                      │
│ │ Engagement Over Time│ │ Platform Breakdown  │                      │
│ │  📈 [line chart]    │ │  📊 [bar chart]     │                      │
│ │                     │ │                     │                      │
│ │                     │ │  IG ████████ 42%    │                      │
│ │                     │ │  𝕏  ██████  31%    │                      │
│ └─────────────────────┘ └─────────────────────┘                      │
│ ┌─────────────────────┐ ┌─────────────────────┐                      │
│ │ Best Times to Post  │ │ Content Performance │                      │
│ │  🗺️ [heatmap]       │ │  📊 [pie: Video vs] │                      │
│ │  Mon ██▁▁███▁▁██    │ │  Image vs Text]     │                      │
│ │  Tue ██▁▁███▁▁██    │ │                     │                      │
│ └─────────────────────┘ └─────────────────────┘                      │
│                                                                      │
│ 🏆 Content Score               🤖 AI Insights                       │
│ ┌────────────────────────┐    ┌────────────────────────────────┐    │
│ │ Score: 87/100 ●●●●○   │    │ 💡 Your IG engagement is 42%   │    │
│ │                        │    │    higher on posts with        │    │
│ │ Top: "Our new feature" │    │    carousel format. Try        │    │
│ │  Score: 94             │    │    converting more content.   │    │
│ │                        │    │                                │    │
│ │ Improve: "Q3 update"   │    │ ⚠️ Best posting time shifted   │    │
│ │  Score: 62             │    │    from 9am to 11am on 𝕏.     │    │
│ └────────────────────────┘    └────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 6. Engagement Inbox

### Layout Description

Three-panel layout: left = unified feed list, center = conversation detail, right = AI reply suggestions panel. Each feed item shows platform icon, user avatar, sentiment color, and excerpt.

### Key UI Components

- **InfiniteScroll** feed list
- **SentimentIndicator** (positive/neutral/negative/urgent)
- **PlatformBadge** on each item
- **AISuggestionCard** in reply panel
- **RichTextEditor** for composing replies
- **PriorityQueue** section at top
- **Filter bar** (platform, sentiment, date, read/unread)

### Information Hierarchy

1. Top bar: "Engagement" title, filter bar, search, "Mark All Read"
2. Left feed: Priority (flagged/high engagement) section, then chronological feed with infinite scroll
3. Center: Selected conversation thread showing original post, replies, compose area
4. Right panel: AI reply suggestions (3 options), sentiment analysis, "Quick Reply" buttons

### Primary User Actions

- Click feed item → open conversation
- Filter by platform or sentiment
- Click AI suggestion → populate reply
- Edit and send reply
- Flag/unflag for follow-up
- Mark conversation resolved

### Textual Wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│ 💬 Engagement Inbox          [🔍]   [All ▼] [Unread ▼] [🔖 Flagged] │
├──────────────┬────────────────────────────┬──────────────────────────┤
│ 📬 Feed      │ 💬 Conversation            │ 🤖 AI Reply Assist       │
│──────────────│────────────────────────────│──────────────────────────│
│ ★ Priority   │                            │ Suggested Replies:       │
│──────────────│ From @johndoe              │ ───────────────────────  │
│ 🔴 IG 2m ago│ via Instagram               │                          │
│  "This is    │ ──────────                 │ Option 1 (Professional): │
│   amazing!   │                            │ "Thank you so much,      │
│   How do I…" │ Hey! This is amazing! How  │  John! We're thrilled    │
│              │ do I sign up for early     │  you like it. Sign up    │
│ 🟡 𝕏  15m    │ access?                    │  at [link]. 🚀"          │
│  "When will  │                            │ [Use] [Edit]             │
│   this ship?"│                            │ ──────────────────────── │
│              │ ── You ──────────────────  │                          │
│ 🟢 LI 1h    │ Thanks John! We're excited │ Option 2 (Friendly):     │
│  "Great     │ you like it. Early access   │ "Hey John! So glad you   │
│   product!"  │ opens next week.           │ love it! You can sign    │
│              │                            │  up here → [link]"       │
│ 🟢 TT 2h    │ ──────────────────────────  │ [Use] [Edit]             │
│  "Love this  │                            │ ──────────────────────── │
│   feature!"  │ ✏️ Reply as @brand:        │                          │
│              │ ┌──────────────────────┐   │ Option 3 (Short):        │
│ 🔴 FB 3h    │ │                      │   │ "Appreciate it, John!    │
│  "This is    │ │                      │   │  Link here → [link]"     │
│   broken…"   │ └──────────────────────┘   │ [Use] [Edit]             │
│              │ [📎] [📷] [GIF] [📤 Send]  │                          │
│              │                            │ 😊 Sentiment: Positive   │
│              │                            │ 📊 Priority: High        │
└──────────────┴────────────────────────────┴──────────────────────────┘
```

---

## 7. Content Library

### Layout Description

Three-panel layout: left = folder tree, center = content grid/list with search/filter bar, right = selected item preview/details. AI Prompt Library is a sub-tab alongside the main content view.

### Key UI Components

- **FolderTree** with expand/collapse, drag-to-organize
- **SearchBar** with advanced filters
- **Grid/List toggle**
- **MediaPreview** (image, video, carousel)
- **ContentCard** with thumbnail, stats, status badge
- **AIPromptLibrary** tab showing saved prompts
- **TagInput** for content tagging

### Information Hierarchy

1. Top bar: "Content Library" + "AI Prompts" tabs, search bar, filter chips (type, platform, status, date)
2. Left sidebar: folder tree with "All Content", "Drafts", "Published", custom folders, "Trash"
3. Center: content grid (3-4 columns desktop) with selectable cards, sort dropdown, bulk action bar
4. Right panel (opens on select): full preview, metadata, stats, tags, edit/delete actions

### Primary User Actions

- Browse/search content
- Click card → view details in right panel
- Drag to folder → organize
- Select multiple → bulk actions (add to queue, tag, delete)
- Switch to "AI Prompts" tab → browse saved prompts
- Click prompt → apply in Content Studio

### Textual Wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│ 🗂️ Content Library    [Library] [AI Prompts]    [🔍 Search...] [⚙️] │
├──────────┬─────────────────────────────────────┬──────────────────────┤
│ Folders  │ All Content (342)   [Grid] [List]   │ 📄 Preview           │
│──────────│ ─────────────────────────────────── │──────────────────────│
│ 📁 All   │ Type: All ▼  Platform: All ▼  Sort  │                      │
│ 📁 Drafts│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│ ┌─────────────────┐ │
│ 📁 Pub.  │ │📷    │ │🎬    │ │📝    │ │📷    ││ │ [Media Preview]  │ │
│ 📁 Images│ │Post  │ │Video │ │Thread│ │Post  ││ │                  │ │
│   📁 Q3  │ │23 Jul│ │22 Jul│ │22 Jul│ │21 Jul││ │                  │ │
│   📁 Q2  │ │ IG   │ │ TT   │ │ 𝕏    │ │ IG   ││ └─────────────────┘ │
│ 📁 Videos│ └──────┘ └──────┘ └──────┘ └──────┘│                      │
│ 📁 Promos│ ┌──────┐ ┌──────┐ ┌──────┐          │ Title: "New Feature  │
│ 📁 Trash │ │📝    │ │📷    │ │🎬    │          │  Launch"            │
│          │ │Thread│ │Post  │ │Reel  │          │ Platform: Instagram │
│──────────│ │21 Jul│ │20 Jul│ │20 Jul│          │ Status: ● Published │
│ 📂 + New │ │ 𝕏    │ │ FB   │ │ IG   │          │ Date: Jul 22, 2026  │
│  Folder  │ └──────┘ └──────┘ └──────┘          │ Stats: ❤️ 234 💬 12 │
│          │                                      │ Tags: #launch #ai   │
│          │                                      │                      │
│          │                                      │ [✏️ Edit] [🗑️ Del]  │
└──────────┴─────────────────────────────────────┴──────────────────────┘
```

---

## 8. Brand Voice Settings

### Layout Description

Single-page scrollable settings layout with tabbed sections: Voice Personality, Tone Rules, Vocabulary, Brand Assets. Left nav for jumping between sections.

### Key UI Components

- **ToneSelector** with preset options (Professional, Casual, Humorous, Authoritative, Empathetic)
- **Personality sliders** (Formal ↔ Casual, Serious ↔ Playful, Reserved ↔ Enthusiastic, Direct ↔ Storytelling)
- **TagInput** for forbidden words / approved terms
- **FileUpload** for brand assets
- **ColorPicker** for brand colors
- **RichTextEditor** for voice description / brand story
- **AIVoiceTest** panel — type a prompt, see how AI would write it in this voice

### Information Hierarchy

1. Header: "Brand Voice" title, active voice profile name, "+ New Voice" button
2. Left sidebar: voice profile list, "Add Profile" button
3. Main content tabs: Personality | Tone & Style | Vocabulary | Assets
4. Personality tab: voice name/description, 4 paired sliders, tone preset selector
5. Tone & Style tab: formality level, humor level, emoji usage (Never ↔ Always), sentence length
6. Vocabulary tab: forbidden words (TagInput), approved terms (TagInput), brand keywords
7. Assets tab: logo upload, color palette (ColorPicker), font selections, media templates
8. Right panel: AI Preview — test how content sounds with current settings

### Primary User Actions

- Adjust any slider → AI Preview updates in real-time
- Add/remove forbidden words
- Upload brand assets
- Click "Test Voice" → enter sample text → see AI rewrite
- Save profile → available in Content Studio

### Textual Wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│ 🎯 Brand Voice Settings                        [💾 Save] [Test Voice]│
├──────────┬────────────────────────────────────────┬──────────────────┤
│ Profiles │ [Personality] [Tone] [Vocabulary] [Assets]│ 🤖 AI Preview │
│──────────│─────────────────────────────────────────│──────────────────│
│ ● CEO   │ Voice Name: [CEO Voice             ]   │ ┌──────────────┐│
│ ○ Brand │ Description: [Executive, visionary,   ]│ │ Input:       ││
│ ○ Casual│              confident tone for CEO   ]│ │ "Tell them   ││
│ ○ Fun   │              communications          ]│ │  about our   ││
│          │                                        │ │  new feature"││
│ [+ Add] │ Tone Preset: [Custom ▼]                │ │──────────────││
│          │ ─────────────────────────────────────  │ │ Output:      ││
│          │ Personality Sliders:                   │ │ "I'm excited ││
│          │ Formal     ●──────○────── Casual       │ │  to announce ││
│          │ Serious    ○──────●────── Playful      │ │  that we've  ││
│          │ Reserved   ○──────●────── Enthusiastic │ │  been build- ││
│          │ Direct     ●──────○────── Storytelling │ │  ing..."     ││
│          │                                        │ └──────────────┘│
│          │ Emoji Usage: [○] [●] [○] [○] [○]     │                  │
│          │               Never    Always          │                  │
│          │                                        │                  │
│          │ Sentence Length: [●] [○] [○]           │                  │
│          │               Short    Long            │                  │
└──────────┴────────────────────────────────────────┴──────────────────┘
```

---

## 9. Workflow Automation Builder

### Layout Description

Full-screen visual canvas with a node library panel on the left. Canvas is a pannable/zoomable workspace where users connect nodes (trigger → actions → conditions → actions).

### Key UI Components

- **WorkflowCanvas** with pan/zoom
- **NodeBlock** with icon, label, input/output ports
- **ConnectionLine** with animated flow
- **TriggerNode** (distinctive style — green border)
- **ActionNode** (blue border)
- **ConditionNode** (diamond shape, orange)
- **NodePalette** (draggable node types)
- **ExecutionLog** panel at bottom
- **PropertyPanel** (opens on node select)

### Information Hierarchy

1. Top bar: workflow name, status indicator, Save, Enable/Disable toggle, Run Test
2. Left panel: Node Palette with categories (Triggers, Content, AI, Publishing, Analytics, Webhooks)
3. Center: Infinite canvas with grid background, node graph
4. Right panel (contextual): Node properties when a node is selected; shows inputs, outputs, configuration
5. Bottom panel: Execution Log (expandable) showing run history, timestamps, success/failure

### Primary User Actions

- Drag node from palette → drop on canvas
- Click port on node → drag to another port → create connection
- Click node → edit properties in right panel
- Double-click node → enter configuration
- Click "Run Test" → execute workflow with test data
- Click "Enable" → activate workflow
- Pan canvas (drag empty space) / zoom (scroll wheel)
- Delete connection (click connection line → press Delete)

### Textual Wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│ ⚡ New Workflow              [💾 Save] [▶ Run Test] [● Enabled ▼]     │
├──────────┬───────────────────────────────────────────┬────────────────┤
│ 🔧 Nodes │           Canvas                          │ 📋 Properties │
│──────────│ ┌──────────────────────────────────────┐   │────────────────│
│ Triggers │ │                                      │   │ Trigger:       │
│  [📅]    │ │  ┌──────────┐                        │   │────────────── │
│   Sched. │ │  │ 📅 New   │                        │   │ Schedule:     │
│  [💬]    │ │  │   Post   │                        │   │ [Every day  │
│   Webhook│ │  │ Scheduled│────┐                   │   │  at 9am]     │
│──────────│ │  └──────────┘    │                   │   │              │
│ Content  │ │                   ▼                   │   │ Platforms:   │
│  [✏️ Gen] │ │             ┌──────────┐             │   │ [● IG] [● 𝕏] │
│  [🎨 Rep]│ │             │ ✨ AI    │             │   │              │
│  [📝 Edit]│ │             │ Generate │             │   │ [Apply]      │
│──────────│ │             │ Post     │────┐        │   │              │
│ AI       │ │             └──────────┘    │        │   │              │
│  [🤖 GPT]│ │                             ▼        │   │              │
│  [🖼️ DALL]│ │                     ┌──────────┐    │   │              │
│  [🔍 Anly]│ │                     │ 🔀 AI    │    │   │              │
│──────────│ │                     │ Review?  │    │   │              │
│ Publish  │ │                     │ ┌Yes┐ ┌No┐│    │   │              │
│  [📤 Pub]│ │                     │ └───┘ └───┘    │   │              │
│  [⏰ Sched]│ │                     │   │           │   │              │
│  [📊 Anly]│ │          ┌──────────┘   └──────────┐│   │              │
│──────────│ │          ▼                         ▼│   │              │
│ Condition│ │  ┌──────────┐               ┌──────────┐│              │
│  [🔀 If] │ │  │ 📤      │               │ 🤖      ││              │
│  [🔁 Loop]│ │  │ Publish  │               │ Rewrite  ││              │
│──────────│ │  │ to IG   │               │ & Retry ││              │
│          │ │  └──────────┘               └──────────┘│              │
│          │ │                                      │   │              │
│          │ └──────────────────────────────────────┘   │              │
│          │     ┌──────────────────────────┐            │              │
└──────────┴─────┤ 📋 Execution Log         ├────────────┘              │
                 │ ✓ Jul 22 09:00 — Published to IG   │                │
                 │ ✓ Jul 22 09:01 — Published to 𝕏    │                │
                 │ ✗ Jul 22 09:05 — Rewrite failed    │                │
                 └──────────────────────────────────────┘               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 10. Campaign Builder

### Layout Description

Wizard-style layout with steps across the top, main content area for current step, and a persistent preview/summary sidebar on the right. The last step shows the AI-generated calendar preview.

### Key UI Components

- **Stepper** (5 steps: Type → Content → Platforms → Schedule → Review)
- **Campaign type cards** (Launch, Evergreen, Promo, Event, Awareness)
- **DurationSelector** with date range picker
- **PlatformSelector** with frequency controls
- **CalendarView** showing AI-generated campaign schedule
- **ContentCard** grid for campaign posts
- **StatCard** showing projected reach/engagement

### Information Hierarchy

1. Top bar: "Campaign Builder" title, Stepper (1-5)
2. Main area (changes per step):
   - Step 1: Campaign type selection cards, name input
   - Step 2: Goal description, key message, call to action
   - Step 3: Platform selector with per-platform frequency sliders
   - Step 4: Date range picker, posting cadence (accelerated, steady, spaced)
   - Step 5: AI-generated calendar preview, per-post editing, projected metrics
3. Right sidebar (persistent): Campaign summary card, projected reach/engagement, budget/complexity estimate

### Primary User Actions

- Select campaign type
- Fill in campaign details per step
- Click "Generate Schedule" (Step 5) → AI populates calendar
- Drag posts on calendar to reposition
- Click "Launch Campaign" → all posts queued/scheduled
- Save as draft

### Textual Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🚀 Campaign Builder: "Summer Launch"                                 │
│ [1. Type] → [2. Content] → [3. Platforms] → [4. Schedule] → [5. Rev]│
├──────────────────────────────────────────┬───────────────────────────┤
│ Step 5: Review & Launch                  │ 📋 Campaign Summary       │
│ ───────────────────────────────          │ ───────────────────────    │
│ Your AI-generated campaign:              │                           │
│                                         │ Type: Product Launch      │
│ 📅 July 27 — August 10 (14 days)        │ Duration: Jul 27 - Aug 10 │
│                                         │ Platforms: IG, 𝕏, LI, TT  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │ Posts: 12                 │
│ │ Jul27│ │ Jul28│ │ Jul29│ │ Jul30│   │ ───────────────────────     │
│ │ 🚀   │ │ 💡   │ │ 🎬   │ │ 🗞️   │   │ 📊 Projected              │
│ │ Teaser│ │ Tip   │ │ Demo │ │ News │   │ Reach: 45K-62K           │
│ │ IG    │ │ 𝕏    │ │ TT   │ │ LI   │   │ Engage: 3.2K-5.1K        │
│ └──────┘ └──────┘ └──────┘ └──────┘   │ CTR: 2.1-3.4%            │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │ ───────────────────────     │
│ │ Jul31│ │ Aug1 │ │ Aug2 │ │ Aug3 │   │ 💰 AI Credits: 24         │
│ │ 👥   │ │ 📊   │ │ 🎥   │ │ ✨   │   │                           │
│ │ Comm.│ │ Stats│ │ Live │ │ Feat │   │ [📝 Save Draft]            │
│ │ IG   │ │ 𝕏    │ │ 𝕏/TT │ │ LI   │   │ [🚀 Launch Campaign]       │
│ └──────┘ └──────┘ └──────┘ └──────┘   │                           │
│                                         │                           │
│ [← Back]                     [🚀 Launch]│                           │
└─────────────────────────────────────────┴───────────────────────────┘
```

---

## 11. MCP Marketplace

### Layout Description

Searchable grid layout with category filters. Server detail opens in a Sheet/modal from the right. Filterable by category, pricing, popularity.

### Key UI Components

- **SearchBar**
- **CategoryChips** (Analytics, Publishing, AI, Data, CRM, Custom)
- **ServerCard** with icon, name, short description, install status, rating
- **InstallButton** with status (Install, Installing, Installed, Update Available)
- **PermissionBadge** showing required scopes
- **Sheet/Modal** for server detail

### Information Hierarchy

1. Top bar: "MCP Marketplace" title, search bar, category filter chips
2. Main content: Grid of ServerCards (3 cols desktop, 2 tablet, 1 mobile)
3. Each card: icon (or platform logo), name, one-line description, installs count, rating stars, install button, permission badges
4. Sheet opens on card click: full description, screenshots, permissions list, version history, configuration guide

### Primary User Actions

- Search/filter servers
- Click "Install" → one-click install
- Click card → view details in sheet
- Click "Configure" (after install) → open settings
- Click "Update" if new version available
- Toggle enable/disable on installed servers

### Textual Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🧩 MCP Marketplace            [🔍 Search servers...]                 │
├──────────────────────────────────────────────────────────────────────┤
│ [All] [Analytics] [Publishing] [AI] [Data] [CRM] [Custom]           │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│ │ 🟦 Google    │ │ 🟪 Meta     │ │ ⬛ OpenAI    │                  │
│ │ Analytics    │ │ Conversions  │ │ GPT-4o      │                  │
│ │ Connect GA4  │ │ Track FB     │ │ AI content   │                  │
│ │ data         │ │ conversions  │ │ generation    │                  │
│ │ ★★★★☆ 2.3k  │ │ ★★★★☆ 1.8k  │ │ ★★★★★ 4.1k  │                  │
│ │ [✓ Installed]│ │ [+ Install] │ │ [+ Install]  │                  │
│ │ 🔒 read_only │ │ 🔒 read/wr  │ │ 🔒 full      │                  │
│ └──────────────┘ └──────────────┘ └──────────────┘                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│ │ 📊 Buffer    │ │ 🎨 Canva     │ │ 📈 ChartIQ  │                  │
│ │ Native Pub. │ │ Design API   │ │ Data Viz     │                  │
│ │ Publish to  │ │ Generate     │ │ Create       │                  │
│ │ all platforms│ │ visuals      │ │ charts       │                  │
│ │ ★★★★☆ 3.7k  │ │ ★★★★☆ 2.9k  │ │ ★★★☆☆ 0.9k  │                  │
│ │ [✓ Installed]│ │ [+ Install] │ │ [+ Install]  │                  │
│ │ 🔒 publish   │ │ 🔒 full     │ │ 🔒 read_only │                  │
│ └──────────────┘ └──────────────┘ └──────────────┘                  │
│                                                                      │
│                    [← Prev] Page 1 of 12 [Next →]                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 12. Settings & Billing

### Layout Description

Settings sidebar layout with grouped sections. Main content area shows the selected section's form. Billing has its own sub-navigation.

### Key UI Components

- **SidebarNav** with sections
- **FormField** with validation
- **TeamMemberList** with role badges
- **PlanComparisonTable** (3-4 columns)
- **UsageMeter** (circular or bar)
- **ColorPicker**
- **FileUpload**
- **Toggle/Switch** for preferences
- **InvoiceTable**

### Information Hierarchy

1. Left sidebar: Workspace → Profile → Team → Billing → API → Integrations → Notifications
2. Workspace: name, logo, timezone, default posting hours
3. Profile: name, email, avatar, password
4. Team: member list with roles (Admin, Editor, Viewer), invite input
5. Billing: current plan card, usage meters, plan comparison table, payment method, invoices
6. API: API keys (create/revoke), webhooks
7. Integrations: connected accounts list, re-auth buttons
8. Notifications: email/push preferences, digests

### Primary User Actions

- Edit workspace settings
- Invite team member → sends email
- Change role dropdown
- Upgrade/downgrade plan
- Add payment method
- Generate API key
- Connect/disconnect social accounts

### Textual Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚙️ Settings & Billing                                                │
├──────────┬───────────────────────────────────────────────────────────┤
│ Settings │ Billing & Plan                                            │
│──────────│ ────────────────────────────────────────────               │
│ ● Worksp.│ Current Plan: Pro ($29/mo)                                │
│ ○ Profile│ ┌─────────────────────────────────────────┐               │
│ ○ Team   │ │ 📊 Usage                    ▓▓▓▓▓░░░ 68% │               │
│ ○ Billing│ │   Posts: 680/1,000                    │               │
│ ○ API    │ │   AI Credits: 340/500                 │               │
│ ○ Integr.│ │   Team Members: 3/5                   │               │
│ ○ Notif. │ └─────────────────────────────────────────┘               │
│──────────│                                                        │
│          │ ┌─ Plan Comparison ─────────────────────────────────┐    │
│          │ │              Free    Pro      Business   Enterprise│    │
│          │ │ Posts/mo     100     1,000    5,000      Custom   │    │
│          │ │ AI Credits   50      500      2,500      Custom   │    │
│          │ │ Team seats   1       5        25         Unlimited│    │
│          │ │ Analytics    7d      30d      90d       Custom   │    │
│          │ │ Workflows    —       3        ∞         ∞        │    │
│          │ │              [Current] [Upgrade] [Contact]        │    │
│          │ └───────────────────────────────────────────────────┘    │
│          │                                                        │
│          │ Payment Method: Visa •••• 4242 [Edit] [Remove]          │
│          │ [Add Payment Method]                                    │
│          │                                                        │
│          │ ── Invoices ────────────────────────────────────────    │
│          │ Jun 2026  $29.00  [PDF] [View]                         │
│          │ May 2026  $29.00  [PDF] [View]                         │
└──────────┴────────────────────────────────────────────────────────┘
```

---

## 13. Onboarding Flow

### Layout Description

Full-screen modal/overlay with a progress indicator, illustration area (left/center), and content area (right/bottom). Background is dimmed. Each step has a clear primary action.

### Key UI Components

- **Stepper** with step indicators
- **ProgressBar**
- **Illustration** or mockup per step
- **PlatformConnector** (OAuth buttons for each platform)
- **AIDemo** mini-interaction
- **InviteInput** for team members
- **PlanComparisonTable** (simplified)

### Step-by-Step Flow

**Step 1: Connect First Account**
- Illustration of connected platforms
- Big OAuth buttons for top platforms (𝕏, IG, LI, TT, FB, YT)
- "Skip for now" link at bottom
- Primary CTA: "Connect"

**Step 2: Create First Post (AI-assisted)**
- Simplified AI Content Studio
- "Generate with AI" prompt
- User edits, clicks "Looks good!"
- Primary CTA: "Generate Post" → "Looks Good!"

**Step 3: Explore AI Features**
- Carousel of 3 AI feature cards: Content Repurposing, Smart Scheduling, AI Analytics
- Each card has a "Try It" mini demo
- Primary CTA: "Continue"

**Step 4: Invite Team**
- Invite input (email input with Add button)
- Role selector per invite
- "Skip for now" option
- Primary CTA: "Send Invites" or "Skip"

**Step 5: Choose Plan**
- Simplified plan cards (Free vs Pro vs Business)
- Feature comparison
- "Start Free Trial" CTA on paid plans
- Primary CTA: "Start with [Free/Pro/Business]"

### Textual Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                           ● ● ○ ○ ○ │
│ ┌───────────────────────────┐ ┌──────────────────────────┐          │
│ │                           │ │ Welcome to Social OS!    │          │
│ │    [Illustration:        │ │                          │          │
│ │     Connected World]     │ │ Let's connect your first │          │
│ │                           │ │ social account to get   │          │
│ │                           │ │ started.                │          │
│ │                           │ │                          │          │
│ │                           │ │ [🟦 Connect Twitter/X]  │          │
│ │                           │ │ [🟪 Connect Instagram]  │          │
│ │                           │ │ [🟦 Connect LinkedIn]   │          │
│ │                           │ │ [⬛ Connect TikTok]     │          │
│ │                           │ │ [🟦 Connect Facebook]   │          │
│ │                           │ │ [🔴 Connect YouTube]    │          │
│ │                           │ │                          │          │
│ │                           │ │                          │          │
│ │                           │ │ ──────────────────────── │          │
│ │                           │ │   🔗 Skip for now        │          │
│ └───────────────────────────┘ └──────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 14. User Flow Diagrams

### Flow 1: First-Time Onboarding

```
[Sign Up]
    │
    ▼
[Email/Google Auth]
    │
    ▼
[Step 1: Connect First Account]
    │
    ├── [Skip] ──────────────► [Step 2]
    │
    └── [Select Platform] ──► [OAuth] ──► [Authorize] ──► [Account Connected] ──► [Step 2]
                                                                                       │
                                                                                       ▼
                                                                           [Step 2: Create First Post]
                                                                                       │
                                                                              ┌── [Generate with AI]
                                                                              │       │
                                                                              │   [Enter Prompt]
                                                                              │       │
                                                                              │   [AI Generates Post]
                                                                              │       │
                                                                              └── [Edit Post]
                                                                                       │
                                                                              [Looks Good!]
                                                                                       │
                                                                                       ▼
                                                                           [Step 3: Explore AI Features]
                                                                                       │
                                                                              ┌── [Try Repurposing]
                                                                              │   [Try Scheduling]
                                                                              │   [Try Analytics]
                                                                              │
                                                                              └── [Continue]
                                                                                       │
                                                                                       ▼
                                                                           [Step 4: Invite Team]
                                                                                       │
                                                                              ┌── [Add Email + Role]
                                                                              │   [Send Invites]
                                                                              │
                                                                              └── [Skip]
                                                                                       │
                                                                                       ▼
                                                                           [Step 5: Choose Plan]
                                                                                       │
                                                                              ┌── [Free Plan]
                                                                              │   [Pro Plan → 14-day trial]
                                                                              │   [Business → Contact sales]
                                                                              │
                                                                              └── [Start with Plan]
                                                                                       │
                                                                                       ▼
                                                                           [🎉 Dashboard — First Session]
```

### Flow 2: Creating + Scheduling a Post

```
[Dashboard]
    │
    ├── [Click "+" FAB] ──────────► [AI Content Studio]
    │                                   │
    │                              [Select Platforms]
    │                                   │
    │                         ┌── [Type manually]
    │                         │       │
    │                         │   [Editor: write content]
    │                         │       │
    │                         │   [Add media, links, emoji]
    │                         │       │
    │                         └── [Use AI Generate]
    │                                   │
    │                              [Enter prompt]
    │                                   │
    │                              [Select tone/voice]
    │                                   │
    │                              [Generate]
    │                                   │
    │                         ┌── [Apply] ──► [Content appears in editor]
    │                         │       │
    │                         │   [Edit/adjust]
    │                         │       │
    │                         └── [Regenerate]
    │                                   │
    │                         [Live preview shows per-platform]
    │                                   │
    │                              [Click "Schedule"]
    │                                   │
    │                              ┌──────┴──────┐
    │                              ▼             ▼
    │                         [Smart         [Set custom
    │                          Scheduler]     date/time]
    │                              │             │
    │                         [Drag to           │
    │                          time slot]        │
    │                              │             │
    │                              └──────┬──────┘
    │                                     │
    │                              [Review in queue]
    │                                     │
    │                              [Confirm Schedule]
    │                                     │
    │                                     ▼
    │                              [Post Queued]
    │                              [Dashboard updates]
    │
    └── [Click date on calendar] ──► [Smart Scheduler]
                                        │
                                   [Click empty slot]
                                        │
                                   [New Post at that time]
                                        │
                                   [→ AI Content Studio (with time pre-set)]
```

### Flow 3: Setting Up a Workflow Automation

```
[Dashboard → Workflows in sidebar]
    │
    ▼
[Workflow List (empty state)]
    │
    [Click "New Workflow"]
    │
    ▼
[Workflow Builder — Empty Canvas]
    │
    [Drag Trigger node from palette]
    │
    ├── [Schedule Trigger]
    │       │
    │   [Set: "Every day at 9am"]
    │       │
    │   [Port appears on node]
    │
    └── [Webhook Trigger]
            │
        [Configure webhook URL]
    
    [Drag from trigger port → canvas]
    │
    ▼
[Action node appears]
    │
    [Select: "AI Generate Post"]
    │
    [Configure: prompt template, platform, brand voice]
    │
    ▼
[Add Condition Node]
    │
    [Connect from AI Generate output]
    │
    [Configure: "If AI Score > 80 → Publish, else → Rewrite"]
    │
    ▼
[Connect Yes port → Publish Action Node]
    │
    [Configure: publish to selected platforms]
    │
    [Connect No port → Rewrite Action Node]
    │
    [Configure: rewrite with feedback loop]
    │
    ▼
[Connect Rewrite output → back to condition (loop)]
    │
    ▼
[Click "Save"]
    │
    ▼
[Name workflow: "Morning Post Automation"]
    │
    ▼
[Click "Enable"]
    │
    ▼
[Workflow Active — shown in Workflow List]
    │
    ▼
[Next trigger time: Tomorrow 9:00 AM]
[Click "Run Test" → executes with test data → shows Execution Log]
```

---

*End of UI/UX Wireframes document.*
