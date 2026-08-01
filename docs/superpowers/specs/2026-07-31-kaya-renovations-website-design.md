# Kaya Home Renovations — Website Design Spec

**Date:** 2026-07-31
**Status:** Approved by user
**Client:** Fictional — Kaya Home Renovations

## 1. Client Profile

- **Business:** Family-run home renovation contractor
- **Location:** 14 Adeola Odeku Street, Ikeja, Lagos
- **Services:** Kitchen & bathroom renovation, roofing & waterproofing, tiling & flooring, interior painting, home extensions
- **Audience:** Homeowners aged 30–55 in Lagos
- **Trust signals:** 10+ years experience, licensed & insured, 2-year workmanship warranty, 300+ projects completed
- **Contact:** Phone +234 800 123 4567, WhatsApp (wa.me link), hello@kayarenovations.ng, Mon–Sat 8:00–18:00

## 2. Information Architecture (7 pages)

| Page | Purpose | Key sections |
|---|---|---|
| `index.html` | Convert visitors into quote requests | Hero, value props, 3 featured services, process teaser, 3 testimonials, CTA |
| `about.html` | Build trust in the team | Story, values (4 cards), team (3 members), certifications |
| `services.html` | Explain what we sell | 5 services: scope of work + starting price each |
| `gallery.html` | Prove quality | 6 projects, before/after pairs, SVG placeholder imagery |
| `process.html` | De-risk hiring us | 5-step timeline: consult → quote → plan → build → handover |
| `tips.html` | SEO + authority | 3 short articles with anchor navigation |
| `contact.html` | Convert interest into leads | Form (mailto fallback), WhatsApp CTA, contact details, hours, FAQ (6 items) |

## 3. Tech Stack

- **Tailwind CSS v4** via `@tailwindcss/cli` (compiled, minified, no CDN dependency)
- **Static HTML** with a tiny Node build script (`build.mjs`) that stitches shared partials
- **No frameworks, no external fonts, no backend** — `dist/` opens directly in a browser

### Build pipeline

```
kaya-renovations/
  src/
    pages/       # 7 HTML pages, use {{header}} {{footer}} tokens + {{active-<page>}} for nav state
    partials/    # header.html, footer.html (single source of truth for nav)
    assets/      # SVG placeholder imagery (gallery before/after art)
    input.css    # Tailwind v4 @theme tokens
  scripts/build.mjs
  dist/          # built site (generated)
```

`build.mjs`:
1. Reads `src/pages/*.html`
2. Replaces `{{header}}` / `{{footer}}` with partial contents
3. Sets `aria-current="page"` on the active nav link (per-page active map)
4. Copies `src/assets/*` → `dist/assets/`
5. Invokes `@tailwindcss/cli -i src/input.css -o dist/assets/styles.css --minify`

## 4. Design System (Warm Craftsman)

| Token | Value | Usage |
|---|---|---|
| `cream` | `#FAF6EE` | Page background |
| `sand` | `#F1E8D8` | Alternating section background |
| `wood` | `#8B5E3C` | Accent — borders, eyebrows, icons |
| `wood-dark` | `#6E4829` | Hover states |
| `moss` | `#5F7161` | Primary CTA buttons |
| `moss-dark` | `#4A5A4C` | CTA hover |
| `ink` | `#33291E` | Headings / body text |
| `ink-soft` | `#6B5F4F` | Secondary text |

- **Display type:** Georgia / serif stack (headings)
- **Body type:** system-ui sans stack
- **Radius:** rounded-lg/xl cards, rounded-full buttons

## 5. Key Behaviors

- Contact form submits via `mailto:` with a success message shown client-side (no backend)
- WhatsApp button opens `https://wa.me/2348001234567` with a prefilled message
- Nav has `aria-current="page"` on the active page; mobile hamburger menu
- All pages share header (brand + nav + "Get a quote" button) and footer (contact summary, quick links, services list, hours)
- Semantic HTML5 landmarks (header/nav/main/footer), alt text on images, skip-to-content link

## 6. Out of Scope

- CMS, blog backend, analytics, SEO metadata beyond titles/descriptions, real photography, hosting/deployment
