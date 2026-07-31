# AI Workflow Dashboard — Landing, Waitlist & Promo Pages

**Date:** 2026-07-31
**Status:** Approved (design sections 1–3 reviewed and signed off by user)

## 1. Goal

Ship three conversion-focused marketing pages for the **AI Workflow Dashboard**
product (the `ai-workflow-dashboard` monorepo): a landing page, a waitlist
capture page, and a promo/launch page. Primary conversion goal is **email
capture** on all three.

## 2. Deliverables & Location

Standalone static HTML in a new `landing-pages/` folder at repo root — no
build step, no dependencies, opens directly in a browser.

| File | Purpose |
|---|---|
| `landing-pages/index.html` | Full sales landing page |
| `landing-pages/waitlist.html` | Single-job email capture page |
| `landing-pages/promo.html` | Launch-announcement promo page |
| `landing-pages/assets/design-system.css` | Design tokens + shared components (single source of truth) |
| `landing-pages/assets/app.js` | Shared JS: nav scroll state, reveal animations, FAQ accordion, email form handler, countdown |

## 3. Page Content

### Landing (`index.html`)

1. Sticky nav — logo, links (Features, How it works, FAQ), "Join waitlist" CTA button
2. Hero — badge pill, headline, subhead, dual CTA (primary "Join the waitlist",
   secondary "See how it works"), CSS-sketched product mockup panel
3. Social proof strip — placeholder logos
4. Features grid — 6 cards: visual workflow builder (DAG), multi-model AI gateway
   (Ollama / OpenAI / Anthropic / Gemini), live execution monitoring, queue &
   retry handling, team workspaces, API + webhooks
5. How it works — 3 steps
6. Testimonials — 3 placeholder cards
7. Pricing teaser — 3 tiers ("coming soon")
8. FAQ — accordion, 5 questions
9. Final CTA + footer

### Waitlist (`waitlist.html`)

1. Minimal nav — logo, link back to home
2. Hero — "Get early access", 3 member-perk bullets, email capture form
   (email + optional name/role), inline validation, success state
3. Perks strip + mini FAQ
4. Footer

### Promo (`promo.html`)

1. Full-bleed hero — animated gradient, announcement headline, JS countdown,
   big email capture
2. Feature flash — 4 icon + one-liner rows
3. "What's inside v1" list
4. Big final CTA + share links
5. Footer

## 4. Visual Design System

- **Colors:** base `#0A0A0F`, panel `#111118`, border `rgba(255,255,255,0.08)`.
  Gradient accent `#7C5CFF → #22D3EE` (violet → cyan) for CTAs, glows, highlights.
  Text: white primary, `#9CA3AF` muted. Success green for form confirmation.
- **Typography:** system font stack for body; `ui-monospace` for code/badge accents.
- **Signature components:** glassmorphism cards, gradient glow behind hero
  headlines, gradient-button CTAs with hover lift, pill badges, grid-pattern
  background, monospace countdown numbers.
- **Layout:** max-width 1100px centered, 96–120px section padding; hero is
  text-left + visual-right on desktop, stacked on mobile.
- **Motion:** CSS-only; fade/slide-in on scroll via IntersectionObserver,
  respects `prefers-reduced-motion`. No external libraries.
- **Logo:** inline SVG node-graph glyph (3 connected nodes, gradient stroke) +
  "AI Workflow Dashboard" wordmark.

## 5. Technical Architecture

- **Shared CSS/JS:** one `design-system.css` and one `app.js` referenced by all
  three pages. Identical nav/footer markup across pages.
- **Email capture:** client-side only. Validates email format, shows inline
  errors, persists to `localStorage` under key `awd_waitlist`, then swaps the
  form for a success state. A clearly-marked comment in `app.js` documents
  where to wire a real endpoint (Formspree/Buttondown) later. One shared
  handler for all forms.
- **Countdown:** JS countdown to a date constant (default: 30 days from first
  load, stored in `localStorage` so it persists), rendered in monospace.

## 6. Verification

After implementation: open each page in a headless browser (Playwright),
verify rendering, take screenshots, and test the waitlist form success state.

## 7. Out of Scope

- Real backend email capture endpoint
- Analytics/tracking scripts
- Blog, docs, or additional pages
- Renaming the app/product (brand stays "AI Workflow Dashboard")
