# Design System

> **Version:** 1.0.0  
> **Status:** Approved  
> **Framework:** React + Tailwind CSS  
> **Last Updated:** 2026-07-21  

---

## 1. Design Tokens

Design tokens are the atomic values of the design system. All visual properties derive from these tokens.

### Naming Convention

`{category}-{property}-{variant}-{state}`

Examples: `color-bg-primary`, `spacing-4`, `font-size-body`, `radius-sm`

### Token Format (CSS Custom Properties)

```css
:root {
  /* Colors */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F5F5F5;
  --color-bg-tertiary: #FAFAFA;
  --color-bg-elevated: #FFFFFF;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);

  --color-text-primary: #1A1A1A;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;
  --color-text-inverse: #FFFFFF;
  --color-text-disabled: #CCCCCC;

  --color-border-primary: #E5E5E5;
  --color-border-secondary: #F0F0F0;
  --color-border-focus: #1A1A1A;

  --color-accent-gold: #C9A84C;
  --color-accent-gold-light: #E8D5A3;
  --color-accent-gold-dark: #A8892E;

  --color-semantic-success: #2E7D32;
  --color-semantic-warning: #F57F17;
  --color-semantic-error: #D32F2F;
  --color-semantic-info: #1565C0;

  /* Typography */
  --font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-display: 'Playfair Display', Georgia, serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 1.875rem; /* 30px */
  --font-size-4xl: 2.25rem;  /* 36px */
  --font-size-5xl: 3rem;     /* 48px */
  --font-size-6xl: 3.75rem;  /* 60px */

  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.15;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  --letter-spacing-tight: -0.02em;
  --letter-spacing-normal: 0em;
  --letter-spacing-wide: 0.04em;
  --letter-spacing-wider: 0.08em;
  --letter-spacing-uppercase: 0.12em;

  /* Spacing (4px base unit) */
  --spacing-0: 0;
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-10: 2.5rem;   /* 40px */
  --spacing-12: 3rem;     /* 48px */
  --spacing-16: 4rem;     /* 64px */
  --spacing-20: 5rem;     /* 80px */
  --spacing-24: 6rem;     /* 96px */

  /* Border Radius */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.10);
  --shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.12);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;

  /* Z-index scale */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal-backdrop: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;
}
```

---

## 2. Color System

### Brand Palette

```
Primary Background  #FFFFFF  ────────────────────────────────────────────
Secondary Background #F5F5F5 ──────────────────────────────────────────
Tertiary Background  #FAFAFA ─────────────────────────────────────────
Elevated Surface    #FFFFFF  ────────────────────────────────────────────

Primary Text        #1A1A1A  ────────────────────────────────────────────
Secondary Text      #666666  ──────────────────────────────────────────
Tertiary Text       #999999  ──────────────────────────────────────────

Gold Accent         #C9A84C  ────────────────────────────────────────────
Gold Light          #E8D5A3  ──────────────────────────────────────────
Gold Dark           #A8892E  ──────────────────────────────────────────

Success             #2E7D32  ────────────────────────────────────────────
Warning             #F57F17  ──────────────────────────────────────────
Error               #D32F2F  ────────────────────────────────────────────
Info                #1565C0  ──────────────────────────────────────────
```

### Color Usage Guidelines

| Token | Usage |
|-------|-------|
| `color-bg-primary` | Page backgrounds |
| `color-bg-secondary` | Card surfaces, sidebar, dropdown menus |
| `color-bg-elevated` | Modals, dialogs, tooltips |
| `color-bg-overlay` | Modal backdrops |
| `color-text-primary` | Headings, body text |
| `color-text-secondary` | Labels, captions, metadata |
| `color-text-tertiary` | Placeholders, disabled text |
| `color-text-inverse` | Text on dark backgrounds |
| `color-accent-gold` | CTAs, active states, premium indicators |
| `color-border-primary` | Card borders, dividers, inputs |
| `color-border-focus` | Focus ring on interactive elements |

**Gold usage must be restrained.** Gold is reserved for:
- Primary CTA buttons
- Logo and brand marks
- Active/purchased state indicators
- Tier badges (VIP, Premium)
- Empty state illustrations (line art)

Do NOT use gold for: body text, backgrounds, borders of non-interactive elements.

---

## 3. Typography

### Font Stack

| Usage | Font | Fallback |
|-------|------|----------|
| UI text, body, labels | **Inter** | `-apple-system, BlinkMacSystemFont, sans-serif` |
| Headings, hero text | **Playfair Display** | `Georgia, serif` |
| Code, numbers | **JetBrains Mono** | `Fira Code, monospace` |

### Type Scale

```
── 6xl (60px) ─────────────────────────────────────────────────────
  Playfair Display, Bold, Leading 1.15, Tracking -0.02em
  Reserved for hero sections and marketing pages

── 5xl (48px) ────────────────────────────────────────────────────
  Playfair Display / Inter, Bold, Leading 1.15, Tracking -0.02em
  Page titles, section headers

── 4xl (36px) ────────────────────────────────────────────────────
  Playfair Display / Inter, Bold/Semibold, Leading 1.2, Tracking -0.02em
  
── 3xl (30px) ────────────────────────────────────────────────────
  Inter, Semibold, Leading 1.25

── 2xl (24px) ────────────────────────────────────────────────────
  Inter, Semibold, Leading 1.3

── xl (20px) ─────────────────────────────────────────────────────
  Inter, Medium, Leading 1.4

── lg (18px) ─────────────────────────────────────────────────────
  Inter, Medium, Leading 1.5
  Card titles, navigation

── base (16px) ───────────────────────────────────────────────────
  Inter, Regular, Leading 1.5
  Body text, paragraphs, table cells

── sm (14px) ─────────────────────────────────────────────────────
  Inter, Regular/Medium, Leading 1.5
  Labels, captions, secondary content

── xs (12px) ─────────────────────────────────────────────────────
  Inter, Regular, Leading 1.5, Tracking 0.04em
  Badges, timestamps, legal text
```

### Heading Hierarchy

```html
<h1 class="font-display text-5xl font-bold tracking-tight">
  <!-- Page title -->
</h1>

<h2 class="font-display text-4xl font-bold tracking-tight">
  <!-- Section title -->
</h2>

<h3 class="font-display text-2xl font-semibold">
  <!-- Card/panel heading -->
</h3>

<h4 class="font-primary text-xl font-medium">
  <!-- Sub-heading -->
</h4>

<h5 class="font-primary text-lg font-medium">
  <!-- Minor heading -->
</h5>

<h6 class="font-primary text-base font-semibold uppercase tracking-wider">
  <!-- Label heading -->
</h6>
```

---

## 4. Component Library Overview

### Primitives

| Component | Description |
|-----------|-------------|
| `Button` | Variants: `primary` (gold), `secondary` (outline), `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Supports `loading`, `disabled`, `icon` states |
| `Input` | Text input with label, error state, helper text, character count. Variants: `default`, `search`, `password` |
| `Select` | Native select styled to match design system. Supports `groups`, `searchable` |
| `Textarea` | Auto-resizing textarea with character limit |
| `Checkbox` | Custom-styled checkbox. Supports `indeterminate` state |
| `Radio` | Custom-styled radio button group |
| `Toggle` | Switch toggle for boolean settings |
| `Badge` | Variants: `default`, `success`, `warning`, `error`, `info`, `gold`. Sizes: `sm`, `md` |
| `Chip` | Removable tag/chip. Variants: `default`, `filter`, `input` |
| `Avatar` | User avatar with initials fallback. Sizes: `sm`, `md`, `lg`, `xl`. Supports `status` indicator |
| `Tooltip` | Hover tooltip. Positions: `top`, `bottom`, `left`, `right` |
| `Divider` | Horizontal rule with optional label |

### Feedback

| Component | Description |
|-----------|-------------|
| `Toast` | Notification toast. Variants: `success`, `error`, `warning`, `info`, `loading`. Auto-dismiss |
| `Alert` | Inline alert banner. Variants: same as Toast. Optional `dismiss` action |
| `Modal` | Dialog modal with `sm`, `md`, `lg`, `xl`, `fullscreen` sizes. Supports `footer` actions |
| `Drawer` | Slide-in panel. Positions: `right`, `left`. Sizes: `sm`, `md`, `lg` |
| `Progress` | Linear progress indicator. Variants: `indeterminate`, `determinate` |
| `Skeleton` | Loading skeleton placeholder. Variants: `text`, `circle`, `rect`, `card` |

### Navigation

| Component | Description |
|-----------|-------------|
| `Sidebar` | Main navigation sidebar with collapsible sections, active states, badge counts |
| `Breadcrumb` | Breadcrumb trail with auto-truncation |
| `Tabs` | Tab navigation. Variants: `underline`, `pills`, `segmented` |
| `Pagination` | Page navigation with page size selector, total count |
| `CommandPalette` | Cmd+K command palette for quick actions |

### Data Display

| Component | Description |
|-----------|-------------|
| `Table` | Data table with sortable columns, selection, sticky header, empty state |
| `DataGrid` | Advanced grid with inline editing, filtering, column resize, virtualization |
| `Card` | Content card with variants: `default`, `interactive`, `elevated` |
| `Accordion` | Collapsible sections. Supports single/multi expand |
| `Timeline` | Vertical timeline for order history, activity logs |
| `KanbanBoard` | Drag-and-drop Kanban board (pipeline view) |

### Form Layout

| Component | Description |
|-----------|-------------|
| `FormField` | Wrapper for label + input + error + helper |
| `FormSection` | Visual section grouping in long forms |
| `FormWizard` | Multi-step form with progress tracker |
| `FileUpload` | Drag-and-drop file upload with preview, progress, validation |

### Charts (Recharts)

| Component | Description |
|-----------|-------------|
| `LineChart` | Time series data |
| `BarChart` | Comparative data |
| `PieChart` | Distribution data |
| `AreaChart` | Cumulative/time series with fill |
| `MetricCard` | Single KPI with change indicator, sparkline |

---

## 5. Dark Mode

### Implementation

Dark mode uses CSS custom properties toggled via a `data-theme="dark"` attribute on `<html>`:

```css
[data-theme="dark"] {
  --color-bg-primary: #0A0A0A;
  --color-bg-secondary: #141414;
  --color-bg-tertiary: #1A1A1A;
  --color-bg-elevated: #1E1E1E;
  --color-bg-overlay: rgba(0, 0, 0, 0.8);

  --color-text-primary: #F5F5F5;
  --color-text-secondary: #A0A0A0;
  --color-text-tertiary: #666666;
  --color-text-inverse: #1A1A1A;
  --color-text-disabled: #444444;

  --color-border-primary: #2A2A2A;
  --color-border-secondary: #222222;
  --color-border-focus: #C9A84C;

  --color-accent-gold: #D4B85A;
  --color-accent-gold-light: #A8892E;
  --color-accent-gold-dark: #E8D5A3;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.6);
  --shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.7);
}
```

### Dark Mode Toggle

- Stored in `localStorage` (key: `lcos-theme`)
- Respects `prefers-color-scheme` system preference on first visit
- Toggle available in user settings and sidebar footer
- Smooth transition: `transition: background-color 250ms ease, color 250ms ease, border-color 250ms ease`

### Dark Mode Design Considerations

- **Reduce contrast** — text is `#F5F5F5` on `#0A0A0A` (not pure white on pure black)
- **Gold adjusts** — slightly brighter (`#D4B85A`) to maintain visibility on dark backgrounds
- **Shadows become depth** — elevated surfaces use lighter `#1E1E1E` to create hierarchy through lightness, not shadows
- **Images** — product images with transparent backgrounds may need a subtle border or backdrop

---

## 6. Spacing & Layout Grid

### Spacing Scale

The spacing scale follows a 4px base unit (Tailwind convention):

```
0    →  0px
1    →  4px
2    →  8px
3    →  12px
4    →  16px
5    →  20px
6    →  24px
8    →  32px
10   →  40px
12   →  48px
14   →  56px
16   →  64px
20   →  80px
24   →  96px
```

### Layout Grid

The application uses a **12-column grid**:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--spacing-6);
}
```

| Breakpoint | Width | Columns | Gutter | Margin |
|------------|-------|---------|--------|--------|
| `sm` | 640px | 4 | 16px | 16px |
| `md` | 768px | 8 | 24px | 24px |
| `lg` | 1024px | 12 | 24px | 32px |
| `xl` | 1280px | 12 | 32px | 40px |
| `2xl` | 1536px | 12 | 32px | 48px |

### Page Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  Header (64px)                                       │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Content Area                             │
│ (240px)  │                                          │
│          │  ┌─ Page Header ───────────────────────┐  │
│          │  │  Title              Actions          │  │
│          │  └──────────────────────────────────────┘  │
│          │                                            │
│          │  ┌─ Content ────────────────────────────┐  │
│          │  │                                       │  │
│          │  │                                       │  │
│          │  │                                       │  │
│          │  └──────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────┘
```

- **Content max-width:** 1440px (centered)
- **Sidebar collapsed width:** 64px (icons only)
- **Sidebar expanded width:** 240px (icons + labels)

---

## 7. Animation & Transitions

### Duration Tokens

| Token | Duration | Use |
|-------|----------|-----|
| `transition-fast` | 150ms | Hover states, active states, micro-interactions |
| `transition-base` | 250ms | Modal open/close, drawer, dropdown, page transitions |
| `transition-slow` | 400ms | Background color changes, theme switching |

### Easing Functions

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* Deceleration, natural feel */
--ease-in: cubic-bezier(0.4, 0, 1, 1);           /* Acceleration */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* Symmetric */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Overshoot (buttons, toggles) */
```

### Component Animations

| Component | Animation | Duration | Easing |
|-----------|-----------|----------|--------|
| Modal | fade + scale (0.95→1) | 250ms | ease-out |
| Drawer | slide from edge | 300ms | ease-out |
| Dropdown | fade + translateY(-4px→0) | 150ms | ease-out |
| Tooltip | fade | 150ms | ease-out |
| Toast | slide in from top-right | 250ms | ease-out |
| Button hover | background tint | 150ms | ease-in-out |
| Toggle | knob slide + bg | 200ms | ease-spring |
| Skeleton | pulse opacity | 1.5s | ease-in-out (infinite) |
| Page enter | fade + translateY(8px→0) | 300ms | ease-out |

### Motion Reduction

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Iconography

### Icon Library

**Lucide Icons** (open-source, consistent, tree-shakable).

- All icons use `strokeWidth={1.5}` by default
- Available sizes: 16px, 20px (default), 24px, 32px
- Color inherits from current text color

### Icon Sizing by Context

| Context | Size | strokeWidth |
|---------|------|-------------|
| Sidebar nav items | 20px | 1.5 |
| Button icons | 16px (sm), 20px (md), 24px (lg) | 1.5 |
| Input leading icons | 16px | 1.5 |
| Empty state | 64-96px | 1 |
| Status indicators | 12px (dot), 16px (badge) | 2 |
| Table sort / actions | 14px | 1.5 |
| Notification icons | 20px | 1.5 |

### Icon Usage Rules

1. **Always use the `Icon` component** wrapping Lucide icons for consistent sizing
2. **Do not mix icon libraries** — Lucide only
3. **Icons are always decorative** — never rely on icon alone for meaning (paired with text or `aria-label`)
4. **Custom icons** must match Lucide's `24px` viewBox and `1.5px` stroke style
5. **Animated icons** (loading spinners) use the `animate-spin` class

```tsx
// Usage
import { ShoppingBag, User, Settings } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

<Icon icon={ShoppingBag} size="md" className="text-gold" />
<Icon icon={User} size="sm" />
<Icon icon={Settings} size="lg" />
```

---

## 9. Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold:  { DEFAULT: '#C9A84C', light: '#E8D5A3', dark: '#A8892E' },
        },
        surface: {
          primary:   'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          elevated:  'var(--color-bg-elevated)',
        },
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary:  'var(--color-text-tertiary)',
        },
        border: {
          primary: 'var(--color-border-primary)',
          focus:   'var(--color-border-focus)',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
```

---

## 10. Accessibility

| Requirement | Standard |
|-------------|----------|
| Color contrast | WCAG 2.1 AA (4.5:1 text, 3:1 large text) |
| Focus indicators | 2px solid `--color-border-focus` with 2px offset |
| Touch targets | Minimum 44x44px |
| Keyboard navigation | Full tab order, arrow-key navigation for lists |
| Screen reader | `aria-label`, `aria-describedby`, `role` attributes |
| Reduced motion | `prefers-reduced-motion` media query |
| Font scaling | Uses `rem` units — respects browser font size |
| Form labels | All inputs have associated `<label>` elements |

---

## 11. File Structure

```
src/
  components/
    ui/
      button.tsx
      input.tsx
      modal.tsx
      ...
    layout/
      sidebar.tsx
      header.tsx
      page-container.tsx
    ...
  styles/
    globals.css       -- CSS custom properties, base styles
    tailwind.css      -- Tailwind directives (@tailwind base, components, utilities)
  lib/
    utils.ts          -- cn() classname utility (clsx + tailwind-merge)
  hooks/
    useTheme.ts       -- Dark mode toggle hook
```
