# MC Danfo — Multi-Page Site Expansion (About / Services / Contact)

**Date:** 2026-08-03
**Status:** Approved design — awaiting implementation plan
**Scope:** `mc-danfo/` Next.js site (App Router, Tailwind v4, React 19)

## Context & Goals

The MC Danfo site currently ships Home, Book, Waitlist and Promo. The client
brief requires a standard small-business information architecture: dedicated
**About**, **Services** and **Contact** pages.

Goals:

1. Add `/about`, `/services`, `/contact` as real routes.
2. Convert the homepage's About and Services *sections* into the pages
   (full conversion — the sections are removed from the homepage).
3. Reuse the existing client-approved copy, components, animations and brand
   styling. No new assets, no new data layer, no backend.
4. Contact page uses the WhatsApp-first pattern already proven on the site
   (form composes a `wa.me` message; no server required).

## Sitemap & Navigation

```
/          Home    — hero, marquee, videos, style, gallery, media kit, FAQ, booking, CTA
/about     About   — story, highlights, quick facts, photo, CTA
/services  Services— service cards, how-it-works, CTA
/contact   Contact — WhatsApp-first form, contact cards, socials, response note
/book | /waitlist | /promo — unchanged
```

Navigation changes:

- Top nav: `About` → `/about`, `Services` → `/services`, new `Contact` → `/contact`.
  Homepage anchor links (Videos, Style, Gallery, Media Kit, FAQ) stay as-is.
- Footer nav mirrors the page links; the existing "prefix `/` for non-home
  sections" logic only still applies to remaining homepage anchors.
- All `#about` / `#services` references across components/data are repointed
  to the new pages (or removed).

## Page Designs

All pages share the same DNA: `PageHero` (data-driven per-page copy from
`/data/pages.ts`), `Container`, `SectionHeading`, `FadeIn`/`Stagger` motion,
`Button`, and the site-wide navbar/footer.

### `/about`
- PageHero (eyebrow "About MC Danfo")
- Story: existing `about.paragraphs` copy
- Highlights checklist (existing `about.highlights`)
- Portrait image (existing `/images/hero-stage.jpg`)
- Quick-facts strip — exactly three stats: **10+** (Years hosting),
  **500+** (Events MC'd), **6** (Cities worked), shown as value/label pairs
- Closing CTA band (existing CTA copy)

### `/services`
- PageHero
- Service cards — the existing 4-card grid, reused as-is (`services.tsx`)
- "How it works" — 3-step process (enquire → planning call → showtime), each
  step linking to `/book` or the WhatsApp link
- Closing CTA band

### `/contact`
- PageHero
- WhatsApp-first contact form (name, event type, date, message — same
  composition pattern as the booking form; on submit opens `wa.me` with a
  pre-filled message)
- Contact cards: email / phone / location (existing `contact` data)
- Social links row (existing `social` data)
- "Typically replies within the hour" note

## Data Model Changes

Staying in the existing `/data` files (no new layer):

- `types.ts`
  - `AboutContent`: add optional `stats: { label: string; value: string }[]`
  - `SiteData`: add `process: { eyebrow; title; description; steps: { title; description }[] }`
- `site.ts` — populate `about.stats` and `process` with brand-consistent copy;
  nav/footer links updated to `/about`, `/services`, `/contact`
- `pages.ts` — add `about`, `services`, `contact` entries for the PageHero copy

## Homepage Changes

- Remove `<About />` and `<Services />` sections from the home page route
  (components stay in the repo — the pages reuse them)
- Home keeps: hero, marquee, videos, style, gallery, media kit, FAQ, booking, CTA
- Homepage hero/secondary CTAs that pointed at `#about` / `#services` repointed
  or removed

## Design Constraints

- Reuse existing primitives: PageHero, Container, SectionHeading, motion
  wrappers, Button, Input/Textarea, Dialog, Badge, CTA section
- Preserve animations (FadeIn/Stagger), responsive behavior, brand palette
- No new image/asset files; no external dependencies; no backend
- Mobile-first, matches existing breakpoint behavior

## Out of Scope

- Redesigning the homepage or existing pages
- New content sections beyond the three pages (no blog, no portfolio page)
- Backend form handling (WhatsApp-first keeps this backend-free)
- Content not already present in `/data` (copy for stats/process is drafted
  at build from existing brand voice)

## Success Criteria

1. `/about`, `/services`, `/contact` render with correct PageHero + content
2. Homepage no longer contains About/Services sections; no dead `#about` /
   `#services` anchors anywhere
3. Nav + footer link all pages correctly from every route
4. Contact form opens a correctly pre-filled WhatsApp message
5. Build + lint clean; no horizontal overflow at 320/375/768/1440 on the
   three new pages; 0 console errors

## Risks

- Removing homepage sections changes homepage scroll length — verify no
  regressions in remaining sections/anchors (`#videos`, `#gallery`, etc.)
- Nav item count grows to 9 + CTA — verify desktop nav fits at 1024px
