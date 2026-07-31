# Universal Social Media Design System — Guide

## Overview

A comprehensive, modular design system for producing high-quality social media content at scale. Built with reusable components, industry-specific themes, and platform-native templates.

---

## Design Philosophy

- **Component-driven** — Every asset is built from reusable building blocks
- **Consistent by default** — Design tokens enforce visual harmony across all outputs
- **Industry-flexible** — Theme variants adapt the system to any brand without redesign
- **Speed-first** — Templates reduce production time by 70%+

---

## Grid System

All templates use a 1080×1080 base canvas (Instagram square) with 40px outer margins. Internal spacing follows an 8px grid increment.

- Column grid: 12 columns, 60px each, 20px gutters
- Margins: 40px (outer), 20px (between elements)
- Vertical rhythm: 8px base unit

---

## Color Token System

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--ox-bg` | #FFFFFF | #0F1419 | Canvas background |
| `--ox-fg` | #0F1419 | #E7E9EA | Primary text |
| `--ox-muted` | #536471 | #71767B | Secondary text |
| `--ox-accent` | #1D9BF0 | #1D9BF0 | Primary accent |
| `--ox-accent2` | #FF6B35 | #FF6B35 | Secondary accent |
| `--ox-surface` | #F7F9F9 | #1A1F24 | Card backgrounds |

Industry variants override these tokens while preserving the same structural system.

---

## Typography Scale

| Style | Size | Weight | Letter-Spacing | Font |
|---|---|---|---|---|
| Hero | 72–96px | 700 | -2 to -3px | Display |
| H1 | 48–64px | 700 | -1.5 to -2px | Display |
| H2 | 36–42px | 600–700 | -1 to -1.5px | Display |
| H3 | 24–32px | 600 | -0.5px | Display |
| Subheading | 14–18px | 600 | +0.02 to +0.04em | Body |
| Body | 14–18px | 300–400 | Normal | Body |
| Caption | 10–12px | 500–600 | +0.02 to +0.03em | Body |
| Button | 13–15px | 600–700 | +0.01 to +0.03em | Body |

---

## Component Library

### Buttons
- **Primary** — Solid accent fill, 24px/28px radius
- **Secondary** — Surface fill with accent border
- **Outline** — Transparent with muted border
- **Ghost** — Text-only with hover state
- **CTA** — Accent2 fill, larger sizing for emphasis

### Cards
- **Basic** — Surface fill, 16px radius, 1px border
- **Feature** — Accent fill with white text
- **Stat** — Centered number with label
- **Testimonial** — Quote mark, body text, attribution

### Badges
- Pill-shaped, 14px radius
- Variants: accent fill, accent2 fill, outline, green (success), red (limited)

### Dividers
- Thin (1px), medium (2px), thick (3px), accent (4px with 50%+ opacity)

---

## Template Library

### Instagram Posts (1080×1080)
1. **Quote Post** — Large pull quote with attribution
2. **Tip/Educational** — Numbered tip with headline and body
3. **Product Showcase** — Image left, product details right
4. **Before & After** — Side-by-side comparison with stat
5. **Announcement** — Two-tone layout with headline and details
6. **Testimonial** — Dark background with quote and rating

### Instagram Stories (1080×1920)
1. **Question Story** — Q&A format with branded background
2. **Flash Sale** — Percentage offer with countdown timer
3. **Product Spotlight** — Full image with bottom info sheet
4. **Reel Cover** — Dark background with play button

### LinkedIn (1080×1080)
1. **Thought Leadership** — Author avatar + article preview
2. **Company Update** — Milestone announcement with stat
3. **Stat/Insight** — Data visualization with source

### Facebook
All Instagram square templates are compatible. Additional Facebook-specific templates available.

---

## Industry Packs

Each pack includes: Instagram Post, Story, Promotion, and Product Highlight.

1. **Restaurant** — Warm cream/terracotta/gold palette. Playfair Display headings.
2. **Fashion** — Ivory/burgundy/gold luxury palette. Cormorant Garamond headings.
3. **Real Estate** — Navy/gold professional palette.
4. **Fitness** — Dark/red-orange high-energy palette.
5. **Beauty** — Blush/mauve elegant palette.
6. **Tech** — White/blue/cyan modern palette.
7. **Finance** — Green/blue trusted palette.

---

## Customization Workflow

1. Select the industry theme matching your brand
2. Replace placeholder images with your own
3. Update text content
4. Adjust colors via theme tokens (no manual color picking)
5. Export at 1080×1080px at 72dpi

---

## Export Standards

| Platform | Format | Size | Resolution |
|---|---|---|---|
| Instagram Feed | PNG | 1080×1080 | 72dpi |
| Instagram Story | PNG | 1080×1920 | 72dpi |
| LinkedIn | PNG | 1080×1080 | 72dpi |
| Facebook | PNG | 1080×1080 | 72dpi |
| All | SVG / PDF | Vector | 300dpi (print) |

---

## Accessibility Guidelines

- Maintain minimum 4.5:1 contrast ratio for body text
- Use 3:1 minimum for large text (18px+ bold or 24px+ regular)
- Don't convey information through color alone
- Ensure interactive elements have visible focus states
- Test all templates in grayscale to verify contrast
