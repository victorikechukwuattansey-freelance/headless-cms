# Design System — AI Social Media OS

**Document:** Design System & Visual Language  
**Platform:** AI Social Media OS (Buffer-competitive)  
**Tech Stack:** Next.js 14 + Tailwind CSS + shadcn/ui  
**Date:** 2026-07-22  
**Author:** Lead Product Designer

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Dark Mode](#2-dark-mode)
3. [Typography](#3-typography)
4. [Iconography](#4-iconography)
5. [Motion & Animation](#5-motion--animation)
6. [Accessibility](#6-accessibility)
7. [Responsive Breakpoints](#7-responsive-breakpoints)
8. [Layout System](#8-layout-system)

---

## 1. Design Tokens

### Color Palette

All colors defined as CSS custom properties on `:root` and `.dark`. Tokens follow the format `--color-{role}-{shade}`.

#### Primary (Brand)

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--color-primary-50` | `#F0F5FF` | `#0D1B3E` | Background tint |
| `--color-primary-100` | `#D6E4FF` | `#1A2D5E` | Hover background |
| `--color-primary-200` | `#AEC8FF` | `#2A407C` | Active background |
| `--color-primary-300` | `#7AA5FF` | `#3C569C` | Border, decorative |
| `--color-primary-400` | `#4D82FF` | `#506EBC` | Hover border, icon |
| `--color-primary-500` | `#2563EB` | `#6381D6` | **Default** — buttons, links, active states |
| `--color-primary-600` | `#1D4ED8` | `#7B96E8` | Hover state |
| `--color-primary-700` | `#1A3FA8` | `#95ABF0` | Active/pressed state |
| `--color-primary-800` | `#17308A` | `#B0C2F5` | Contrast text on dark |
| `--color-primary-900` | `#12236E` | `#CDD8FA` | High-contrast backgrounds |

#### Secondary (Purple — for AI features)

| Token | Light | Dark |
|---|---|---|
| `--color-secondary-50` | `#FAF5FF` | `#1F0D33` |
| `--color-secondary-100` | `#F0E6FF` | `#2E1A4A` |
| `--color-secondary-200` | `#E0CCFF` | `#402866` |
| `--color-secondary-300` | `#C9A8FF` | `#533880` |
| `--color-secondary-400` | `#AD7BFF` | `#684A9C` |
| `--color-secondary-500` | `#8B5CF6` | `#7E5FC2` |
| `--color-secondary-600` | `#7339EF` | `#9676D8` |
| `--color-secondary-700` | `#5B21B6` | `#AE8FE8` |
| `--color-secondary-800` | `#4C1D95` | `#C8AAF2` |
| `--color-secondary-900` | `#3B1280` | `#E2C6F8` |

#### Neutral (Gray)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-neutral-50` | `#F8FAFC` | `#0A0A0B` | Page background |
| `--color-neutral-100` | `#F1F5F9` | `#141416` | Card/surface background |
| `--color-neutral-150` | `#EAEEF4` | `#1C1C20` | Elevated surfaces |
| `--color-neutral-200` | `#E2E8F0` | `#242428` | Border, divider |
| `--color-neutral-300` | `#CBD5E1` | `#2E2E34` | Disabled border |
| `--color-neutral-400` | `#94A3B8` | `#3E3E46` | Disabled text, placeholder |
| `--color-neutral-500` | `#64748B` | `#5A5A64` | Secondary text |
| `--color-neutral-600` | `#475569` | `#7A7A86` | Body text (dark mode) |
| `--color-neutral-700` | `#334155` | `#9C9CA8` | Body text (light mode) |
| `--color-neutral-800` | `#1E293B` | `#C0C0CC` | Heading text (dark mode) |
| `--color-neutral-900` | `#0F172A` | `#E4E4EC` | Heading text (light mode) |

#### Semantic Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-success-500` | `#10B981` | `#34D399` | Success states, positive sentiment |
| `--color-success-600` | `#059669` | `#6EE7B7` | Success hover |
| `--color-warning-500` | `#F59E0B` | `#FBBF24` | Warning states, medium priority |
| `--color-warning-600` | `#D97706` | `#FCD34D` | Warning hover |
| `--color-error-500` | `#EF4444` | `#F87171` | Error states, negative sentiment |
| `--color-error-600` | `#DC2626` | `#FCA5A5` | Error hover |
| `--color-info-500` | `#3B82F6` | `#60A5FA` | Info states, notifications |
| `--color-info-600` | `#2563EB` | `#93C5FD` | Info hover |

#### Platform Colors (brand colors for connected services)

| Platform | Token | Value |
|---|---|---|
| 𝕏 (Twitter/X) | `--platform-x` | `#000000` |
| Instagram | `--platform-instagram` | `#E4405F` |
| LinkedIn | `--platform-linkedin` | `#0A66C2` |
| TikTok | `--platform-tiktok` | `#000000` |
| Facebook | `--platform-facebook` | `#1877F2` |
| YouTube | `--platform-youtube` | `#FF0000` |
| Pinterest | `--platform-pinterest` | `#BD081C` |
| Threads | `--platform-threads` | `#000000` |
| Bluesky | `--platform-bluesky` | `#0285FF` |
| Mastodon | `--platform-mastodon` | `#6364FF` |

### Spacing Scale

Based on a 4px grid. Token format: `--space-{size}`.

| Token | px | rem | Usage |
|---|---|---|---|
| `--space-0` | 0px | 0rem | None |
| `--space-0\.5` | 2px | 0.125rem | Inner padding, tight icons |
| `--space-1` | 4px | 0.25rem | Tiny gaps, icon padding |
| `--space-1\.5` | 6px | 0.375rem | Small label padding |
| `--space-2` | 8px | 0.5rem | Button padding, small gaps |
| `--space-2\.5` | 10px | 0.625rem | Input padding |
| `--space-3` | 12px | 0.75rem | Card padding, form spacing |
| `--space-3\.5` | 14px | 0.875rem | Section spacing |
| `--space-4` | 16px | 1rem | Standard padding, gap |
| `--space-5` | 20px | 1.25rem | Panel padding |
| `--space-6` | 24px | 1.5rem | Section margins |
| `--space-8` | 32px | 2rem | Large margins |
| `--space-10` | 40px | 2.5rem | Page section spacing |
| `--space-12` | 48px | 3rem | Page margins |
| `--space-16` | 64px | 4rem | Wide layouts |
| `--space-20` | 80px | 5rem | Hero spacing |
| `--space-24` | 96px | 6rem | Large page sections |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-none` | `0px` | Data tables, full-width elements |
| `--radius-sm` | `4px` | Inputs, small components |
| `--radius-md` | `6px` | Cards, buttons, dropdowns |
| `--radius-lg` | `8px` | Modals, panels, sheets |
| `--radius-xl` | `12px` | Large cards, dialogs |
| `--radius-2xl` | `16px` | Extra-large surfaces |
| `--radius-full` | `9999px` | Badges, pills, avatars |

### Shadows

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle separation |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.4)` | Cards, dropdowns |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)` | `0 4px 6px rgba(0,0,0,0.4)` | Elevated cards, popovers |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)` | `0 10px 15px rgba(0,0,0,0.5)` | Modals, sheets |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.10), 0 8px 10px rgba(0,0,0,0.04)` | `0 20px 25px rgba(0,0,0,0.6)` | Large dialogs, toast stacks |
| `--shadow-2xl` | `0 25px 50px rgba(0,0,0,0.15)` | `0 25px 50px rgba(0,0,0,0.7)` | Onboarding overlay |

### Z-Index Layers

| Token | Value | Usage |
|---|---|---|
| `--z-base` | `0` | Page content |
| `--z-sticky` | `10` | Sticky headers, sidebar |
| `--z-dropdown` | `20` | Dropdown menus, select options |
| `--z-popover` | `30` | Popovers, tooltips |
| `--z-header` | `40` | Top navigation bar |
| `--z-overlay` | `50` | Modal backdrops |
| `--z-modal` | `60` | Modal dialogs, sheets |
| `--z-toast` | `70` | Toast notifications |
| `--z-tooltip` | `80` | Tooltips (above everything) |

---

## 2. Dark Mode

### Approach

Dark mode uses CSS custom variables exclusively. The `.dark` class on `<html>` swaps all `--color-*`, `--shadow-*`, and `--border-*` tokens. No runtime JS color manipulation. Tailwind's `dark:` prefix maps to `.dark` selector.

### Toggle Behavior

- **Default**: Respect `prefers-color-scheme` media query on first visit
- **Override**: User toggle in Settings → Appearance and Top Bar user menu
- **Persistence**: Stored in `localStorage`, synced across tabs via `storage` event
- **System sync**: "System" option in toggle that re-enables `prefers-color-scheme`

### Color Mapping (Light → Dark)

| Light Token | Dark Token | Rationale |
|---|---|---|
| `neutral-50` → | `neutral-900` | Page background inverts |
| `neutral-100` → | `neutral-800` | Card background |
| `neutral-200` → | `neutral-700` | Borders invert |
| `neutral-700` → | `neutral-300` | Body text |
| `neutral-900` → | `neutral-100` | Heading text |
| `primary-500` → | `primary-400` | Slightly brighter on dark for contrast |

### Dark Mode Specific Tokens

```css
.dark {
  --color-bg-page: var(--color-neutral-950);
  --color-bg-card: var(--color-neutral-900);
  --color-bg-elevated: var(--color-neutral-800);
  --color-border: var(--color-neutral-700);
  --color-text-primary: var(--color-neutral-100);
  --color-text-secondary: var(--color-neutral-400);
  --color-text-disabled: var(--color-neutral-500);
  --color-overlay: rgba(0, 0, 0, 0.6);
}
```

### Implementation Pattern

```css
/* tailwind.config.ts */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          /* ... */
        },
      },
    },
  },
};
```

---

## 3. Typography

### Font Family Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
             Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas,
             'Liberation Mono', Menlo, monospace;
```

- **Inter**: Primary UI font, loaded via `next/font` with variable weight support
- **JetBrains Mono**: Code blocks, API responses, JSON display, content scores

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `--text-xs` | 0.75rem (12px) | 400/500 | 1.5 | 0.01em | Caption, helper, badge text |
| `--text-sm` | 0.875rem (14px) | 400/500 | 1.5 | 0.005em | Body small, metadata, tab labels |
| `--text-base` | 1rem (16px) | 400 | 1.6 | 0 | Body text, paragraph content |
| `--text-lg` | 1.125rem (18px) | 500 | 1.5 | 0 | Large body, card titles |
| `--text-xl` | 1.25rem (20px) | 600 | 1.4 | -0.01em | Section headings, dialog titles |
| `--text-2xl` | 1.5rem (24px) | 600 | 1.3 | -0.01em | Page headings (H2) |
| `--text-3xl` | 1.875rem (30px) | 700 | 1.2 | -0.02em | Major page titles (H1) |
| `--text-4xl` | 2.25rem (36px) | 700 | 1.1 | -0.02em | Dashboard hero numbers |
| `--text-5xl` | 3rem (48px) | 800 | 1.1 | -0.03em | Marketing pages, empty states |
| `--text-6xl` | 3.75rem (60px) | 800 | 1.05 | -0.03em | Onboarding welcome |

### Font Weights

| Token | Numeric | Usage |
|---|---|---|
| `--weight-normal` | 400 | Body text, paragraphs |
| `--weight-medium` | 500 | Buttons, labels, table headers |
| `--weight-semibold` | 600 | Subheadings, active nav items |
| `--weight-bold` | 700 | Page titles, card headings |
| `--weight-extrabold` | 800 | Large display numbers, hero text |

### Responsive Scale

The type scale shrinks by 1 step on mobile for headings (e.g., `text-3xl` → `text-2xl` on screens < 768px). Body text remains `text-base` at all sizes.

### Usage Guidelines

- **Maximum line length**: 80 characters for body text (content editor, post preview)
- **Minimum font size**: 12px (`text-xs`) — never smaller
- **Heading hierarchy**: Every page has exactly one H1, proper H2/H3 nesting for screen readers
- **Truncation**: Single-line truncation with ellipsis for table cells, card titles, sidebar items. Multi-line clamping (2-3 lines) for feed cards, suggestion cards using `line-clamp-2`/`line-clamp-3`

---

## 4. Iconography

### Approach

**Lucide Icons** (via `lucide-react`) as the sole icon library. Icons are stroke-based, 24×24 viewport, 2px stroke width (default). All icons use currentColor, inheriting text color from their parent.

### Icon Sizes

| Token | Pixel Size | Usage |
|---|---|---|
| `--icon-xs` | 12×12 | Inline with text, badge icons |
| `--icon-sm` | 14×14 | Small buttons, table cells |
| `--icon-md` | 16×16 | Standard icon size for buttons, list items |
| `--icon-lg` | 20×20 | Icon + label pairs, menu items |
| `--icon-xl` | 24×24 | Standalone icon buttons, empty states |
| `--icon-2xl` | 32×32 | Feature cards, section headers |
| `--icon-3xl` | 48×48 | Empty state hero, onboarding |

### Platform Icons

Platform icons use a custom SVG sprite (not Lucide) for brand-accurate logos. Each is wrapped in a `<PlatformIcon>` component that handles color, size, and accessibility.

```tsx
// PlatformIcon uses the brand's color as fill/stroke
// Size: always square, standard icon sizes apply
// Fallback: generic social media icon if platform not found
```

### Usage Guidelines

- **Decorative icons**: `aria-hidden="true"` always
- **Interactive icons**: Icon buttons must have `aria-label`
- **Icon + text**: Left-aligned icon, 8px gap (`gap-2`)
- **Standalone icons**: Minimum touch target 44×44px on mobile
- **Color**: Never hardcode icon color — use `currentColor` except for platform badges which use their brand palette

---

## 5. Motion & Animation

### Timing Curves

| Token | Cubic Bezier | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements exiting, disappear — quick deceleration |
| `--ease-in` | `cubic-bezier(0.4, 0, 0.68, 0.06)` | Elements entering — gentle acceleration |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Transitions, toggles — symmetrical |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Micro-interactions, checkmarks — overshoot effect |

### Durations

| Token | Time | Usage |
|---|---|---|
| `--duration-instant` | 0ms | Theme toggle (instant paint) |
| `--duration-fast` | 100ms | Hover states, press feedback |
| `--duration-normal` | 200ms | Dropdowns, tooltips, simple transitions |
| `--duration-slow` | 300ms | Sheet/modal open, panel slide |
| `--duration-slide` | 400ms | Page transitions, onboarding steps |

### Page Transitions

- **Route changes**: Content area fades out (100ms) + new content fades in (200ms), with 50ms gap
- **Sidebar navigation**: No animation between pages within a section; full-page fade for section changes
- **Modals**: Scale (0.95 → 1) + fade in over 250ms on open; reverse on close
- **Sheets**: Slide from right edge over 300ms with `--ease-out`
- **Mobile navigation**: Slide from left over 300ms with backdrop fade

### Micro-interactions

| Element | Action | Animation |
|---|---|---|
| Button | Click | Scale 1→0.97 (80ms) → revert (120ms) |
| Toggle/Switch | Toggle | Knob slides 24px, background color transition (200ms) |
| Checkbox | Check | Checkmark draw (150ms), subtle scale pop (200ms, `--ease-spring`) |
| Post card | Hover | Elevate shadow, subtle translateY(-2px) over 200ms |
| Drag handle | Start drag | Scale up 1.05, shadow elevation increase (150ms) |
| Dropdown | Open | Fade + translateY(-4px→0) over 200ms |
| Tooltip | Show | Fade in over 150ms, delay 300ms |
| Skeleton | Loading | Pulse opacity 1↔0.4 over 1.5s, infinite |
| Badge | Count change | Scale bounce (spring) if count appears |
| Notification | Toast | Slide from top, scale, fade — all 300ms |
| AI generation | Processing | Skeleton shimmer until complete |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations must be non‑critical and gracefully degrade to instant state changes.

---

## 6. Accessibility

### Target: WCAG 2.1 Level AA

| Criterion | Requirement | Implementation |
|---|---|---|
| 1.4.3 Contrast (Normal Text) | 4.5:1 minimum | All text/background combos verified |
| 1.4.3 Contrast (Large Text) | 3:1 minimum | 18px+ bold or 24px+ regular |
| 1.4.11 Non-text Contrast | 3:1 minimum | Icons, borders, input boundaries |
| 2.1.1 Keyboard | Full keyboard operation | All interactive elements focusable |
| 2.1.2 No Keyboard Trap | Focus never trapped | Modals trap → ESC exits |
| 2.4.3 Focus Order | Logical DOM order | Tab flows left→right, top→bottom |
| 2.4.7 Focus Visible | Visible focus indicator | 2px ring + 4px offset on all interactive |
| 2.5.3 Label in Name | Accessible name matches visible label | Buttons, links |
| 2.5.5 Target Size | 24×24px minimum on mobile | Icon buttons, touch targets |
| 4.1.2 Name, Role, Value | ARIA attributes correct | All custom components |

### Focus Indicators

```css
/* Default focus ring — applied globally */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Remove for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Keyboard Navigation

| Key | Action |
|---|---|
| `Tab` | Move focus forward |
| `Shift+Tab` | Move focus backward |
| `Enter` / `Space` | Activate button, toggle, select |
| `Escape` | Close modal, dropdown, popover, sheet |
| `Arrow Down` | Open dropdown, next list item |
| `Arrow Up` | Previous list item |
| `Arrow Left/Right` | Calendar day navigation, tab switch |
| `Cmd+K` | Open Command Palette (anywhere) |
| `?` | Show keyboard shortcuts modal |

### Screen Reader Support

- **Landmarks**: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` with `aria-label` on repeated instances
- **Headings**: Consistent hierarchy (H1 per page, no skipped levels)
- **Live regions**: Toast notifications use `role="status"` with `aria-live="polite"`
- **Loading**: `aria-busy="true"` on containers during async updates
- **Dynamic content**: `role="alert"` for validation messages; `aria-describedby` linking inputs to errors
- **Drag and drop**: Instructions announced via `aria-roledescription`, keyboard reorder via arrow keys
- **DataTable**: `role="grid"`, sortable headers with `aria-sort`
- **All icons**: `aria-hidden="true"` unless they are the only content of an interactive element

### Color and Perception

- No information conveyed solely by color
- Sentiment indicators use icon shape + color: `🟢` positive, `🟡` neutral, `🔴` negative, `⚠️` urgent
- Platform badges use icon + text label, never just brand color
- Chart patterns include texture/pattern fills as secondary encoding

---

## 7. Responsive Breakpoints

| Name | Min Width | Target | Layout Changes |
|---|---|---|---|
| `xs` | 0px | Mobile phones | Single column, stacked panels, bottom nav |
| `sm` | 640px | Large phones | Wider margins, two-column cards |
| `md` | 768px | Tablets | Sidebar collapses to icons, two-column grid |
| `lg` | 1024px | Desktop (small) | Sidebar visible, three-column dashboard |
| `xl` | 1280px | Desktop (standard) | Full layout, right panel visible |
| `2xl` | 1536px | Wide/ultrawide | Max content width 1440px, centered |

### Adaptive Behaviors

| Component | Mobile (<md) | Tablet (md-lg) | Desktop (xl+) |
|---|---|---|---|
| **Sidebar** | Bottom nav (5 icons) | Collapsed icons | Full sidebar (260px) |
| **Right Panel** | Hidden, FAB opens bottom sheet | Slide-over from right | Fixed panel (340px) |
| **Calendar** | Day view only | Week view default | Month view default |
| **Content Grid** | 1 column | 2 columns | 3-4 columns |
| **AI Studio** | Stacked panels | Vertical split | Horizontal split |
| **DataTable** | Card list (horizontal scroll table) | Reduced columns | Full table |
| **Modals** | Full-screen sheet | Centered modal (90% width) | Centered modal (640px) |
| **Analytics Charts** | Single column, stacked | 2-column grid | 2-3 column grid |
| **Top Bar** | Minimal (logo + user) | Search collapsible | Full top bar |

### Breakpoint Implementation

```css
/* Tailwind defaults — extended with container queries where needed */
/* Used via: lg:grid-cols-3, max-md:hidden, etc. */

/* Container queries for panel-level responsiveness */
@container (max-width: 400px) {
  .stat-card { flex-direction: column; }
}
```

---

## 8. Layout System

### AppShell Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  TopBar (h-14) — fixed, z-header                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Logo | Breadcrumb | Search | Global Actions | User Menu         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
├──────┬───────────────────────────────────────────────────────────────┤
│      │                                                               │
│      │                                                               │
│ Side │  Content Area                                                 │
│ bar  │  (overflow-y-auto, flex-1)                                    │
│ (w-  │                                                               │
│ 260) │                                                               │
│      │                                                               │
│      │                                                               │
│      │                                                               │
├──────┴───────────────────────────────────────────────────────────────┤
│  StatusBar (h-8) — optional, shows connection status, version        │
└──────────────────────────────────────────────────────────────────────┘
```

### Sidebar

| Property | Default | Collapsed |
|---|---|---|
| Width | 260px | 64px |
| Visibility | Always visible (desktop) | Icons only |
| Background | `neutral-50` (light), `neutral-900` (dark) | Same |
| Border | Right border `neutral-200` | Same |
| Transition | Width 300ms `--ease-out` | Same |

Sidebar sections:
1. **Workspace switcher** — dropdown at top
2. **Primary navigation** — Dashboard, Content Studio, Repurpose, Scheduler, Analytics, Engagement, Library, Campaigns
3. **Secondary navigation** — Workflows, MCP Marketplace
4. **Settings** — Settings, Billing (bottom, separated by divider)

### TopBar

| Property | Value |
|---|---|
| Height | 56px (14) |
| Background | `white` / `neutral-900` |
| Border | Bottom border `neutral-200` |
| Z-index | `--z-header` |

Sections (left → right):
1. Mobile menu hamburger (hidden on desktop)
2. Page breadcrumb / title
3. Global search (`Cmd+K`)
4. AI credit balance indicator
5. Notification bell with count
6. User avatar dropdown

### Content Area

- **Padding**: `--space-6` (24px) on desktop, `--space-4` (16px) on tablet, `--space-3` (12px) on mobile
- **Max width**: 1440px, centered with `mx-auto`
- **Background**: `neutral-50` (light) / `neutral-950` (dark)
- **Scroll**: `overflow-y-auto` on the content area, sidebar scrolls independently

### Panels

- **Right Panel**: 340px fixed width, separated by left border, vertical scroll
- **Slide-over panels**: 400px on desktop, full-width on mobile; slides from right edge
- **Bottom panels**: Execution log, terminal, activity feed — resizable with drag handle

### Modals

| Type | Width (desktop) | Width (mobile) | Animation |
|---|---|---|---|
| Alert/Confirm | 400px | Full screen (with padding) | Scale + fade |
| Dialog | 500px | Full screen | Scale + fade |
| Sheet (right) | 500px | 100vw | Slide from right |
| Sheet (bottom) | 100% × 60vh | 100% × 85vh | Slide from bottom |
| Onboarding | 800px | Full screen | Fade + scale |

### Grid System

- **Base**: CSS Grid (`grid-template-columns`), not a framework grid
- **Responsive**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- **Gap**: `gap-4` (16px) standard, `gap-6` (24px) for page sections
- **Card grids**: Auto-fill with `minmax(280px, 1fr)` for content that varies in count

### SplitPane Layout (AI Content Studio, Repurposing Engine)

- Two resizable panels with a `<ResizeHandle>` between them
- Default ratio: 60/40 (left/right)
- Minimum panel width: 320px each
- Collapse: Double-click handle collapses right panel; drag handle to <100px collapses
- State persisted in URL params for sharing

---

*End of Design System document.*
