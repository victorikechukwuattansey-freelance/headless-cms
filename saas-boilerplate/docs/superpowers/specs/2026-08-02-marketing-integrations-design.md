# Marketing Integrations — Design Spec

**Date:** 2026-08-02
**Status:** Approved
**Scope:** Forms · Email Capture · Basic Analytics · Simple CMS (marketing-site level)

## Goal

Add four marketing-site integrations to the SaaS boilerplate: a contact form, newsletter
email capture, wired-up analytics, and a DB-backed blog acting as a simple CMS/headless
content source. No new third-party dependencies. No org tenancy — all public-marketing scoped.

## Context

- The repo already has: `@saas/analytics` (PostHog/Plausible/GA adapters + factory, unwired),
  `@saas/emails` (Resend + React Email templates), React Hook Form + Zod in `apps/web`,
  an admin area (route group `(admin)`, server-component CRUD pages), and `@saas/api`
  helpers (`validateBody`, zod, pagination, responses).
- No DB models exist for forms, submissions, subscribers, analytics events, or content.
- Schema is managed via `db:push` (no migrations directory yet).

## 1. Forms — Contact form on landing page

### Data model (`packages/database/prisma/schema.prisma`)

```prisma
model ContactMessage {
  id        String    @id @default(cuid())
  name      String
  email     String
  subject   String
  message   String
  source    String    @default("marketing-site")
  ip        String?
  createdAt DateTime  @default(now())
  readAt    DateTime?
}
```

### Endpoint

`POST /api/contact` (`apps/web/src/app/api/contact/route.ts`)

- Zod schema: name (1–100), email (valid), subject (1–150), message (10–5000).
- Uses `validateBody` + `rateLimitResponse` from `@saas/api` (per-IP, conservative limit).
- Stores the record. Sends a notification email via `@saas/emails` (`sendEmail` +
  a new `contact-notification` template) — fire-and-forget, no-op when `RESEND_API_KEY`
  is absent.
- Tracks `contact_form_submitted` via the analytics service (server-side).
- Response shape via `successResponse` / `errorResponse`.

### UI

- Contact section on the landing page (`apps/web/src/app/(marketing)/page.tsx`),
  implemented as a client component `ContactForm` (React Hook Form + Zod resolver,
  `@saas/ui` `Input`/`Textarea`/`Button`/`Form`, toast feedback).
- Admin inbox: `admin/messages/page.tsx` — server-component table (name, email,
  subject, preview, date), mark-as-read toggle, no delete.

## 2. Email capture — Newsletter

### Data model

```prisma
enum NewsletterStatus {
  SUBSCRIBED
  UNSUBSCRIBED
  BOUNCED
}

model NewsletterSubscriber {
  id             String           @id @default(cuid())
  email          String           @unique
  status         NewsletterStatus @default(SUBSCRIBED)
  source         String           @default("marketing-site")
  unsubscribeToken String         @unique
  createdAt      DateTime         @default(now())
  unsubscribedAt DateTime?
}
```

### Endpoints

- `POST /api/newsletter/subscribe` — zod email validation; upsert: existing
  SUBSCRIBED → 200 idempotent; UNSUBSCRIBED → re-subscribe; creates `unsubscribeToken`
  (`generateToken` from `@saas/utils`). Sends welcome email (new
  `newsletter-welcome` template) when Resend is configured. Tracks
  `newsletter_subscribed`.
- `POST /api/newsletter/unsubscribe` — body `{ token }`; marks UNSUBSCRIBED +
  `unsubscribedAt`. Tracks `newsletter_unsubscribed`.

### UI

- `NewsletterForm` client component (email input + button) used in the Footer
  (`components/layout/footer.tsx`) and a landing-page CTA band. Toast feedback.
- Admin: `admin/newsletter/page.tsx` — subscriber table (email, status, source, date)
  - unsubscribe action.

## 3. Basic analytics — wire existing `@saas/analytics`

- **Client:** `components/analytics/analytics-provider.tsx` — mounts PostHog via
  `posthog-js` when `NEXT_PUBLIC_ANALYTICS_PROVIDER=posthog` and
  `NEXT_PUBLIC_POSTHOG_KEY` are set; renders children; no-op otherwise. Mounted in
  root `app/layout.tsx` inside `Providers`. Page views fire automatically via
  PostHog's `pageview`; `identify` on session presence is left to a tiny effect in
  the provider (user id + email when available from `useSession`).
- **Server:** a small helper `trackAnalytics(event, properties)` in
  `apps/web/src/lib/analytics.ts` wrapping `createAnalyticsService(getEnv())` —
  used by the contact and newsletter routes.
- Plausible/GA adapters remain available via env (`ANALYTICS_PROVIDER`) — no change
  to the package.

## 4. Simple CMS — DB-backed blog

### Data model

```prisma
enum PostStatus {
  DRAFT
  PUBLISHED
}

model ContentPost {
  id          String     @id @default(cuid())
  slug        String     @unique
  title       String
  excerpt     String?
  body        String
  coverImage  String?
  status      PostStatus @default(DRAFT)
  publishedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

No tags (YAGNI). Markdown body stored as text; rendered with a small inline
renderer (no new dependency — headings, paragraphs, lists, bold/italic, links,
code blocks).

### Endpoints

- `GET /api/content/posts` — public: published only, paginated via
  `@saas/api` `paginatedResponse`/`getPaginationParams`, ordered by `publishedAt desc`.
- `GET /api/content/posts/[slug]` — public: single published post or 404. This is
  the "headless content source".

### UI

- Public: `(marketing)/blog/page.tsx` (list: title, excerpt, date) and
  `(marketing)/blog/[slug]/page.tsx` (full post, `generateStaticParams` + `generateMetadata`).
- Admin: `admin/posts/page.tsx` (list + create/edit form via server components,
  status toggle, slug auto-generated with `generateSlug`).

### Seed

New seed module `prisma/seed/content.ts` (matching existing modular seed layout at
root `prisma/seed/` — module + re-export in `prisma/seed/index.ts` + invoke from
root `prisma/seed.ts`): 2–3 published sample posts + 1 draft.

## Cross-cutting

- **Env:** `ANALYTICS_PROVIDER`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
  already exist in `@saas/config` — ensure they are present in `.env.example`.
- **Schema push:** `pnpm db:generate && pnpm db:push` after model changes
  (canonical schema: `packages/database/prisma/schema.prisma`).
- **Tests:**
  - Unit: contact/newsletter route validation schemas + unsubscribe token behavior.
  - Integration (`tests/integration/`): contact submit → record created + 201;
    newsletter subscribe upsert + unsubscribe; posts endpoint returns published only.
  - E2E: newsletter form on landing page shows success toast (extend `basic.spec.ts`).
- **Docs:** update `docs/api.md` with the three new endpoints; add
  `docs/marketing/01-integrations.md` note (or extend `docs/index.md`).

## Non-goals

- Org/multi-tenant scoping for any of these features.
- Rich text editor, post tags/categories, comments, RSS.
- Plausible/GA client wiring (adapters exist; only PostHog gets a client provider).
- Mailing-list provider integration (Mailchimp/Buttondown) — DB is the source of truth.
