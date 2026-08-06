# Marketing Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add marketing-site integrations to the SaaS boilerplate — a contact form, newsletter email capture, wired analytics, and a DB-backed blog acting as a simple CMS/headless content source.

**Architecture:** Four subsystems, each implemented following the house patterns (zod validation via `@saas/api`, React Hook Form client forms, server-component admin pages, Prisma models in the canonical schema). All four share the schema push in Task 1, so they are built in one ordered plan rather than four separate plans: DB → email → analytics → endpoints → UI → admin → docs. No org tenancy; all public-marketing scoped.

**Tech Stack:** Next.js 15 App Router (params/searchParams are Promises), Prisma 6 (PostgreSQL), Zod, React Hook Form, Resend + React Email, PostHog (`posthog-js` client + HTTP capture API server-side, no new server SDK), Tailwind/shadcn (`@saas/ui`), Vitest, Playwright.

## Global Constraints

- Canonical Prisma schema is `packages/database/prisma/schema.prisma`. The root `prisma/schema.prisma` is a stale legacy duplicate — do NOT touch it.
- Do NOT add new third-party dependencies except the two justified additions: `@react-email/render` (in `packages/emails` — required to render the React Email templates that already exist but are never rendered today) and `posthog-js` (in `apps/web` — client provider).
- Server-side PostHog tracking uses plain `fetch` to the PostHog HTTP capture API — no new SDK.
- Follow house style: snake_case `@map`ed fields, `@@map("snake_case")` table names, `@db.VarChar(n)` / `@db.Text` types, explicit `@map("created_at")` on timestamp fields (see `Announcement` model).
- All response helpers come from `@saas/api` (`successResponse`, `errorResponse`, `validateBody`, `notFoundResponse`, `paginatedResponse`, `getPaginationParams`).
- Analytics must never break business flows — all `track` calls wrapped in try/catch, and no-ops when no PostHog key is configured.
- Emails are fire-and-forget and only sent when `RESEND_API_KEY` is present (`getEnv().RESEND_API_KEY`).
- New unit tests import their module RELATIVELY (e.g. `import { renderMarkdownToHtml } from "./markdown"`) — `@/` aliases are not configured for the apps/web vitest project.
- Verification commands run from the repo root: `pnpm typecheck`, `pnpm lint`, `pnpm db:validate`, `pnpm db:push`, `pnpm test:integration`, `pnpm --filter @saas/web test`, `pnpm --filter @saas/analytics test`, `pnpm --filter @saas/emails test`.
- Commit each task separately with a message matching repo style (`feat: ...`, `test: ...`, `docs: ...`). Run prettier (`pnpm format`) before committing — husky lint-staged will also format staged files.

---

### Task 1: Prisma schema — ContactMessage, NewsletterSubscriber, ContentPost

**Files:**

- Modify: `packages/database/prisma/schema.prisma` (append at end of file)

**Interfaces:**

- Produces: Prisma models `contactMessage`, `newsletterSubscriber`, `contentPost`; enums `NewsletterStatus` (SUBSCRIBED/UNSUBSCRIBED/BOUNCED), `PostStatus` (DRAFT/PUBLISHED). All later tasks consume these via `prisma.<model>` from `@saas/database`.

- [ ] **Step 1: Append the three models and two enums to the schema**

Append exactly this to the end of `packages/database/prisma/schema.prisma` (after the `NotificationUserPreference` model):

```prisma
enum NewsletterStatus {
  SUBSCRIBED
  UNSUBSCRIBED
  BOUNCED
}

enum PostStatus {
  DRAFT
  PUBLISHED
}

model ContactMessage {
  id        String   @id @default(cuid())
  name      String   @db.VarChar(100)
  email     String   @db.VarChar(255)
  subject   String   @db.VarChar(150)
  message   String   @db.Text
  source    String   @default("marketing-site") @db.VarChar(50)
  ip        String?  @db.VarChar(45)
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("contact_messages")
}

model NewsletterSubscriber {
  id               String           @id @default(cuid())
  email            String           @unique @db.VarChar(255)
  status           NewsletterStatus @default(SUBSCRIBED)
  source           String           @default("marketing-site") @db.VarChar(50)
  unsubscribeToken String           @unique @map("unsubscribe_token") @db.VarChar(64)
  createdAt        DateTime         @default(now()) @map("created_at")
  unsubscribedAt   DateTime?        @map("unsubscribed_at")

  @@index([status])
  @@map("newsletter_subscribers")
}

model ContentPost {
  id          String     @id @default(cuid())
  slug        String     @unique @db.VarChar(255)
  title       String     @db.VarChar(255)
  excerpt     String?    @db.VarChar(500)
  body        String     @db.Text
  coverImage  String?    @map("cover_image")
  status      PostStatus @default(DRAFT)
  publishedAt DateTime?  @map("published_at")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  @@index([status, publishedAt])
  @@map("content_posts")
}
```

- [ ] **Step 2: Regenerate the client and validate**

Run:

```bash
pnpm db:generate
pnpm db:validate
```

Expected: Prisma client regenerates; `[db:validate] schema is valid`.

- [ ] **Step 3: Push the schema to the local database**

Run:

```bash
pnpm db:push
```

Expected: `✔ Your database is now in sync with your Prisma schema`.

- [ ] **Step 4: Verify the models exist via the health integration test**

Run:

```bash
pnpm test:integration
```

Expected: PASS (existing `prisma.health.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat: add contact, newsletter, and content post models"
```

---

### Task 2: Email rendering — @react-email/render + two templates

**Files:**

- Modify: `packages/emails/package.json` (add dep)
- Create: `packages/emails/src/render.ts`
- Create: `packages/emails/src/templates/contact-notification.tsx`
- Create: `packages/emails/src/templates/newsletter-welcome.tsx`
- Modify: `packages/emails/src/index.ts`
- Test: `packages/emails/src/render.test.ts`

**Interfaces:**

- Consumes: existing `sendEmail` from `packages/emails/src/index.ts`.
- Produces: `renderEmail<P>(Component: ComponentType<P>, props: P): Promise<string>` (renders a React Email template to HTML string); exported templates `ContactNotificationEmail` (props `{ name, email, subject, message }`) and `NewsletterWelcomeEmail` (props `{ email }`). Tasks 5 and 6 use `renderEmail` + `sendEmail`.

- [ ] **Step 1: Add the render dependency**

In `packages/emails/package.json` add `"@react-email/render": "^1.0.0"` to `dependencies`, then run from the repo root:

```bash
pnpm install
```

Expected: lockfile updated. If pnpm prints a React 19 peer-dependency warning for `@react-email/render`, it is non-blocking — continue.

- [ ] **Step 2: Write the failing test**

Create `packages/emails/src/render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import React from "react";
import { renderEmail } from "./render";
import { NewsletterWelcomeEmail } from "./templates/newsletter-welcome";

describe("renderEmail", () => {
  it("renders a template to an HTML string", async () => {
    const html = await renderEmail(NewsletterWelcomeEmail, { email: "ada@example.com" });
    expect(html).toContain("ada@example.com");
    expect(html).toMatch(/^<!DOCTYPE/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @saas/emails test`
Expected: FAIL — `./render` cannot be resolved (module not found).

- [ ] **Step 4: Implement the render helper and templates**

Create `packages/emails/src/render.ts`:

```ts
import { render } from "@react-email/render";
import React, { type ComponentType } from "react";

export async function renderEmail<P extends object>(
  Component: ComponentType<P>,
  props: P,
): Promise<string> {
  return render(React.createElement(Component, props), { pretty: true });
}
```

Create `packages/emails/src/templates/contact-notification.tsx` (modeled on `welcome.tsx` — same `Html/Head/Preview/Body/Container/Section/Text` imports and style constants):

```tsx
import { Html, Head, Preview, Body, Container, Section, Text } from "@react-email/components";
import * as React from "react";

interface ContactNotificationEmailProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function ContactNotificationEmail({
  name,
  email,
  subject,
  message,
}: ContactNotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New contact form submission: {subject}</Preview>
      <Body
        style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f6f9fc", padding: "40px 0" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "40px",
            borderRadius: "8px",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <Section>
            <Text
              style={{ fontSize: "32px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 8px" }}
            >
              SaaS Boilerplate
            </Text>
            <Text
              style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 16px" }}
            >
              New contact form submission
            </Text>
            <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 4px" }}>
              From: {name} &lt;{email}&gt;
            </Text>
            <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 16px" }}>
              Subject: {subject}
            </Text>
            <Text style={{ color: "#1a1a2e", lineHeight: "1.6", margin: "0 0 24px" }}>
              {message}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

Create `packages/emails/src/templates/newsletter-welcome.tsx`:

```tsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
} from "@react-email/components";
import * as React from "react";

interface NewsletterWelcomeEmailProps {
  email: string;
}

export function NewsletterWelcomeEmail({ email }: NewsletterWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to the SaaS Boilerplate newsletter</Preview>
      <Body
        style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f6f9fc", padding: "40px 0" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "40px",
            borderRadius: "8px",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <Section>
            <Text
              style={{ fontSize: "32px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 8px" }}
            >
              SaaS Boilerplate
            </Text>
            <Text
              style={{ fontSize: "22px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 16px" }}
            >
              You&apos;re on the list
            </Text>
            <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 24px" }}>
              Thanks for subscribing with {email}. We&apos;ll send you product updates, guides, and
              early access to new features.
            </Text>
            <Button
              href="https://saas.com/blog"
              style={{
                backgroundColor: "#6366f1",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                display: "inline-block",
              }}
            >
              Read the Blog
            </Button>
          </Section>
          <Section
            style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e2e8f0" }}
          >
            <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0" }}>
              You received this because you subscribed on our website. If this wasn&apos;t you, you
              can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

Update `packages/emails/src/index.ts` — add exports after the `sendEmail` function and replace the template export block with:

```ts
export { renderEmail } from "./render";
export { WelcomeEmail } from "./templates/welcome";
export { VerificationEmail } from "./templates/verification";
export { PasswordResetEmail } from "./templates/password-reset";
export { MagicLinkEmail } from "./templates/magic-link";
export { InvitationEmail } from "./templates/invitation";
export { SubscriptionEmail } from "./templates/subscription";
export { InvoiceEmail } from "./templates/invoice";
export { ContactNotificationEmail } from "./templates/contact-notification";
export { NewsletterWelcomeEmail } from "./templates/newsletter-welcome";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @saas/emails test`
Expected: PASS. Then run `pnpm typecheck` — expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add packages/emails
git commit -m "feat: add email rendering helper and marketing templates"
```

---

### Task 3: Analytics — server-side PostHog capture in the adapter

**Files:**

- Modify: `packages/analytics/src/adapters/posthog.ts`
- Test: `packages/analytics/src/adapters/posthog.test.ts`
- Create: `apps/web/src/lib/analytics.ts` (server helper)

**Interfaces:**

- Consumes: `AnalyticsService` interface, `AnalyticsEvent`/`IdentifyPayload`/`PageViewPayload` types, `getClientEnv` (already in the adapter).
- Produces: exported `capturePostHogEvent(params): Promise<void>`; `PostHogAdapter` now works server-side (uses `fetch` when `typeof window === "undefined"`); `trackEvent(name, properties?): Promise<void>` from `@/lib/analytics` for API routes (Tasks 5, 6).

- [ ] **Step 1: Write the failing test**

Create `packages/analytics/src/adapters/posthog.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";

const fetchMock = vi.fn();

describe("PostHogAdapter server capture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("posts an event to the PostHog capture endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    const { PostHogAdapter } = await import("./posthog");
    const adapter = new PostHogAdapter();

    await adapter.track({
      name: "newsletter_subscribed",
      properties: { email: "ada@example.com" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.posthog.com/capture");
    const body = JSON.parse(init.body as string);
    expect(body.api_key).toBe("phc_test");
    expect(body.event).toBe("newsletter_subscribed");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @saas/analytics test`
Expected: FAIL — `vi.stubEnv`/fetch not exercised; the current adapter no-ops in Node (no window), so `fetchMock` is never called.

- [ ] **Step 3: Implement server mode in the adapter**

Replace the contents of `packages/analytics/src/adapters/posthog.ts` with:

```ts
import { getClientEnv } from "@saas/config";
import type { AnalyticsService } from "../service";
import type { AnalyticsEvent, IdentifyPayload, PageViewPayload } from "../types";
import { AnalyticsError } from "../types";

const DEFAULT_HOST = "https://app.posthog.com";

export interface CapturePostHogEventParams {
  apiKey: string;
  host: string;
  event: string;
  distinctId: string;
  properties?: Record<string, string | number | boolean | null>;
}

export async function capturePostHogEvent(params: CapturePostHogEventParams): Promise<void> {
  const host = (params.host || DEFAULT_HOST).replace(/\/$/, "");
  const res = await fetch(`${host}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: params.apiKey,
      event: params.event,
      distinct_id: params.distinctId,
      properties: { ...params.properties, $lib: "saas-boilerplate" },
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new AnalyticsError(
      "POSTHOG_CAPTURE_FAILED",
      `PostHog capture failed with status ${res.status}`,
    );
  }
}

export class PostHogAdapter implements AnalyticsService {
  private client: any = null;
  private env = getClientEnv();

  private getClient(): any {
    if (this.client) return this.client;
    if (typeof window !== "undefined" && this.env.NEXT_PUBLIC_POSTHOG_KEY) {
      const posthog = require("posthog-js");
      this.client = posthog.init(this.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: this.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
        loaded: (ph: any) => {
          if (process.env.NODE_ENV !== "production") ph.opt_out_capturing();
        },
      });
      return posthog;
    }
    return null;
  }

  private async serverCapture(
    event: string,
    properties?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const apiKey = this.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return;
    await capturePostHogEvent({
      apiKey,
      host: this.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
      event,
      distinctId: "anonymous",
      properties,
    });
  }

  async track(event: AnalyticsEvent): Promise<void> {
    if (typeof window === "undefined") {
      await this.serverCapture(event.name, event.properties);
      return;
    }
    const client = this.getClient();
    if (!client) return;
    client.capture(event.name, event.properties ?? {});
  }

  async identify(payload: IdentifyPayload): Promise<void> {
    if (typeof window === "undefined") {
      const apiKey = this.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (!apiKey) return;
      const host = (this.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST).replace(/\/$/, "");
      await fetch(`${host}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          distinct_id: payload.userId,
          properties: payload.traits ?? {},
        }),
      });
      return;
    }
    const client = this.getClient();
    if (!client) return;
    client.identify(payload.userId, payload.traits ?? {});
  }

  async pageView(payload: PageViewPayload): Promise<void> {
    if (typeof window === "undefined") {
      await this.serverCapture("$pageview", {
        $current_url: payload.page,
        $title: payload.title ?? null,
        ...payload.properties,
      });
      return;
    }
    const client = this.getClient();
    if (!client) return;
    client.capture("$pageview", {
      $current_url: payload.page,
      $title: payload.title,
      ...payload.properties,
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @saas/analytics test`
Expected: PASS (1 new test + existing factory tests). Note: `vi.stubEnv` + dynamic import ensures the config cache is not primed before the adapter reads it.

- [ ] **Step 5: Add the server tracking helper**

Create `apps/web/src/lib/analytics.ts`:

```ts
import { createAnalyticsService } from "@saas/analytics";

export async function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await createAnalyticsService().track({ name, properties });
  } catch {
    // Analytics must never break business flows.
  }
}
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add packages/analytics/src/adapters/posthog.ts packages/analytics/src/adapters/posthog.test.ts apps/web/src/lib/analytics.ts
git commit -m "feat: support server-side posthog capture in analytics adapter"
```

---

### Task 4: In-memory rate limiter

**Files:**

- Create: `apps/web/src/lib/rate-limit.ts`
- Test: `apps/web/src/lib/rate-limit.test.ts`

**Interfaces:**

- Produces: `checkRateLimit(key: string, options: { limit: number; windowMs: number }): boolean` and `resetRateLimits(): void`. Consumed by the contact route (Task 5) and newsletter routes (Task 6).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit", () => {
    expect(checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 })).toBe(true);
  });

  it("rejects requests beyond the limit", () => {
    checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 });
    checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 });
    expect(checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 })).toBe(false);
  });

  it("tracks keys independently", () => {
    checkRateLimit("ip:1", { limit: 1, windowMs: 60_000 });
    expect(checkRateLimit("ip:2", { limit: 1, windowMs: 60_000 })).toBe(true);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    checkRateLimit("ip:1", { limit: 1, windowMs: 1000 });
    expect(checkRateLimit("ip:1", { limit: 1, windowMs: 1000 })).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit("ip:1", { limit: 1, windowMs: 1000 })).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @saas/web exec vitest run src/lib/rate-limit.test.ts`
Expected: FAIL — `./rate-limit` cannot be resolved.

- [ ] **Step 3: Implement the limiter**

Create `apps/web/src/lib/rate-limit.ts`:

```ts
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, options: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return true;
  }

  if (bucket.count >= options.limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @saas/web exec vitest run src/lib/rate-limit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts apps/web/src/lib/rate-limit.test.ts
git commit -m "feat: add in-memory rate limiter"
```

---

### Task 5: Contact API route + admin notify email

**Files:**

- Modify: `packages/config/src/index.ts` (add `CONTACT_NOTIFY_EMAIL`)
- Modify: `.env.example` (add `CONTACT_NOTIFY_EMAIL`)
- Create: `apps/web/src/app/api/contact/route.ts`
- Test: `tests/integration/contact.test.ts`

**Interfaces:**

- Consumes: `validateBody`/`successResponse`/`errorResponse` from `@saas/api`; `prisma` from `@saas/database`; `renderEmail`/`sendEmail`/`ContactNotificationEmail` from `@saas/emails`; `getEnv` from `@saas/config`; `checkRateLimit` from `@/lib/rate-limit`; `trackEvent` from `@/lib/analytics`.
- Produces: `POST /api/contact` — 201 on success (`{ success: true, data: { id } }`), 400 validation, 429 rate limit.

- [ ] **Step 1: Add the recipient env var**

In `packages/config/src/index.ts`, add to `envSchema` after `RESEND_FROM_EMAIL`:

```ts
  CONTACT_NOTIFY_EMAIL: z.string().email().optional(),
```

In `.env.example`, under the `# Email` section:

```
CONTACT_NOTIFY_EMAIL=
```

- [ ] **Step 2: Write the failing integration test**

Create `tests/integration/contact.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@saas/database";
import { POST } from "../../apps/web/src/app/api/contact/route";

const testEmail = `contact-test-${Date.now()}@example.com`;

describe("POST /api/contact", () => {
  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { email: testEmail } });
  });

  it("creates a contact message and returns 201", async () => {
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: testEmail,
          subject: "Pricing question",
          message: "I would like to know more about the pro plan pricing details.",
        }),
      }),
    );
    expect(res.status).toBe(201);

    const message = await prisma.contactMessage.findFirst({ where: { email: testEmail } });
    expect(message).not.toBeNull();
    expect(message?.name).toBe("Ada Lovelace");
    expect(message?.subject).toBe("Pricing question");
  });

  it("rejects invalid payloads with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.2" },
        body: JSON.stringify({ name: "", email: "not-an-email", subject: "", message: "short" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test:integration`
Expected: FAIL — route module cannot be resolved.

- [ ] **Step 4: Implement the route**

Create `apps/web/src/app/api/contact/route.ts`:

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@saas/database";
import { errorResponse, successResponse, validateBody } from "@saas/api";
import { getEnv } from "@saas/config";
import { tryCatchAsync } from "@saas/utils";
import { ContactNotificationEmail, renderEmail, sendEmail } from "@saas/emails";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(10).max(5000),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  if (!checkRateLimit(`contact:${ip}`, { limit: 10, windowMs: 60_000 })) {
    return errorResponse("RATE_LIMIT", "Too many requests, please try again later", 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = validateBody(contactSchema, body);
  if (parsed.error) {
    return errorResponse(parsed.error.code, parsed.error.message, 400, parsed.error.details);
  }

  const { name, email, subject, message } = parsed.data!;

  const created = await prisma.contactMessage.create({
    data: { name, email, subject, message, ip },
  });

  const env = getEnv();
  if (env.RESEND_API_KEY) {
    const html = await renderEmail(ContactNotificationEmail, { name, email, subject, message });
    await tryCatchAsync(() =>
      sendEmail({
        to: env.CONTACT_NOTIFY_EMAIL ?? env.RESEND_FROM_EMAIL ?? "noreply@saas.com",
        subject: `New contact: ${subject}`,
        html,
        replyTo: email,
      }),
    );
  }

  await trackEvent("contact_form_submitted", { email, subject });

  return successResponse({ id: created.id }, 201);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration`
Expected: PASS (existing health test + 2 new contact tests).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add packages/config/src/index.ts .env.example apps/web/src/app/api/contact/route.ts tests/integration/contact.test.ts
git commit -m "feat: add contact form submission endpoint"
```

---

### Task 6: Newsletter subscribe + unsubscribe routes

**Files:**

- Create: `apps/web/src/app/api/newsletter/subscribe/route.ts`
- Create: `apps/web/src/app/api/newsletter/unsubscribe/route.ts`
- Test: `tests/integration/newsletter.test.ts`

**Interfaces:**

- Consumes: same helpers as Task 5 plus `generateToken` from `@saas/utils` and `NewsletterWelcomeEmail` from `@saas/emails`.
- Produces: `POST /api/newsletter/subscribe` (200, idempotent upsert) and `POST /api/newsletter/unsubscribe` (200, idempotent, no subscriber enumeration).

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/newsletter.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@saas/database";
import { POST as subscribe } from "../../apps/web/src/app/api/newsletter/subscribe/route";
import { POST as unsubscribe } from "../../apps/web/src/app/api/newsletter/unsubscribe/route";

const testEmail = `newsletter-test-${Date.now()}@example.com`;

describe("newsletter endpoints", () => {
  afterAll(async () => {
    await prisma.newsletterSubscriber.deleteMany({ where: { email: testEmail } });
  });

  it("subscribes an email and returns a subscriber id", async () => {
    const res = await subscribe(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.10" },
        body: JSON.stringify({ email: testEmail }),
      }),
    );
    expect(res.status).toBe(200);

    const sub = await prisma.newsletterSubscriber.findUnique({ where: { email: testEmail } });
    expect(sub).not.toBeNull();
    expect(sub?.status).toBe("SUBSCRIBED");
    expect(sub?.unsubscribeToken).toHaveLength(32);
  });

  it("is idempotent for repeat subscriptions", async () => {
    const first = await subscribe(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.11" },
        body: JSON.stringify({ email: testEmail }),
      }),
    );
    const second = await subscribe(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.12" },
        body: JSON.stringify({ email: testEmail }),
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const count = await prisma.newsletterSubscriber.count({ where: { email: testEmail } });
    expect(count).toBe(1);
  });

  it("unsubscribes via token", async () => {
    const sub = await prisma.newsletterSubscriber.findUniqueOrThrow({
      where: { email: testEmail },
    });

    const res = await unsubscribe(
      new Request("http://localhost/api/newsletter/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ token: sub.unsubscribeToken }),
      }),
    );
    expect(res.status).toBe(200);

    const updated = await prisma.newsletterSubscriber.findUniqueOrThrow({
      where: { email: testEmail },
    });
    expect(updated.status).toBe("UNSUBSCRIBED");
    expect(updated.unsubscribedAt).not.toBeNull();
  });

  it("re-subscribes after unsubscribing", async () => {
    await subscribe(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.13" },
        body: JSON.stringify({ email: testEmail }),
      }),
    );
    const sub = await prisma.newsletterSubscriber.findUniqueOrThrow({
      where: { email: testEmail },
    });
    expect(sub.status).toBe("SUBSCRIBED");
    expect(sub.unsubscribedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration`
Expected: FAIL — route modules cannot be resolved.

- [ ] **Step 3: Implement the subscribe route**

Create `apps/web/src/app/api/newsletter/subscribe/route.ts`:

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@saas/database";
import { errorResponse, successResponse, validateBody } from "@saas/api";
import { getEnv } from "@saas/config";
import { generateToken, tryCatchAsync } from "@saas/utils";
import { NewsletterWelcomeEmail, renderEmail, sendEmail } from "@saas/emails";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

const subscribeSchema = z.object({
  email: z.string().trim().email().max(255),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  if (!checkRateLimit(`newsletter:${ip}`, { limit: 20, windowMs: 60_000 })) {
    return errorResponse("RATE_LIMIT", "Too many requests, please try again later", 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = validateBody(subscribeSchema, body);
  if (parsed.error) {
    return errorResponse(parsed.error.code, parsed.error.message, 400, parsed.error.details);
  }

  const { email } = parsed.data!;
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

  let subscriber;
  if (existing && existing.status === "SUBSCRIBED") {
    subscriber = existing;
  } else if (existing) {
    subscriber = await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: { status: "SUBSCRIBED", unsubscribedAt: null },
    });
  } else {
    subscriber = await prisma.newsletterSubscriber.create({
      data: { email, unsubscribeToken: generateToken(32) },
    });
  }

  const env = getEnv();
  if (env.RESEND_API_KEY) {
    const html = await renderEmail(NewsletterWelcomeEmail, { email });
    await tryCatchAsync(() => sendEmail({ to: email, subject: "Welcome to the newsletter", html }));
  }

  await trackEvent("newsletter_subscribed", { email });

  return successResponse({ id: subscriber.id, status: subscriber.status });
}
```

- [ ] **Step 4: Implement the unsubscribe route**

Create `apps/web/src/app/api/newsletter/unsubscribe/route.ts`:

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@saas/database";
import { successResponse, validateBody, errorResponse } from "@saas/api";
import { trackEvent } from "@/lib/analytics";

const unsubscribeSchema = z.object({
  token: z.string().min(16).max(64),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = validateBody(unsubscribeSchema, body);
  if (parsed.error) {
    return errorResponse(parsed.error.code, parsed.error.message, 400, parsed.error.details);
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: parsed.data!.token },
  });
  if (!subscriber || subscriber.status === "UNSUBSCRIBED") {
    // Idempotent — never reveal whether a token exists.
    return successResponse({ ok: true });
  }

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });

  await trackEvent("newsletter_unsubscribed", { email: subscriber.email });

  return successResponse({ ok: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration`
Expected: PASS (4 newsletter tests).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add apps/web/src/app/api/newsletter tests/integration/newsletter.test.ts
git commit -m "feat: add newsletter subscribe and unsubscribe endpoints"
```

---

### Task 7: Content API — headless posts endpoint

**Files:**

- Create: `apps/web/src/app/api/content/posts/route.ts`
- Create: `apps/web/src/app/api/content/posts/[slug]/route.ts`
- Test: `tests/integration/content-api.test.ts`

**Interfaces:**

- Consumes: `paginatedResponse`/`getPaginationParams`/`notFoundResponse`/`successResponse` from `@saas/api`.
- Produces: `GET /api/content/posts` (published-only, paginated) and `GET /api/content/posts/[slug]` (single published post or 404).

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/content-api.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@saas/database";
import { GET as listPosts } from "../../apps/web/src/app/api/content/posts/route";
import { GET as getPost } from "../../apps/web/src/app/api/content/posts/[slug]/route";

const testSlug = `plan-test-post-${Date.now()}`;
const draftSlug = `${testSlug}-draft`;

describe("content API", () => {
  beforeAll(async () => {
    await prisma.contentPost.createMany({
      data: [
        {
          slug: testSlug,
          title: "Test published post",
          excerpt: "A post for tests",
          body: "# Hello\n\nWorld",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
        {
          slug: draftSlug,
          title: "Test draft post",
          body: "Not visible yet",
          status: "DRAFT",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.contentPost.deleteMany({
      where: { slug: { in: [testSlug, draftSlug] } },
    });
  });

  it("lists only published posts, newest first", async () => {
    const req = new NextRequest("http://localhost/api/content/posts?page=1&perPage=10");
    const res = await listPosts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.total).toBeGreaterThanOrEqual(1);

    const found = body.data.find((p: { slug: string }) => p.slug === testSlug);
    expect(found).toBeDefined();
    const drafts = body.data.filter((p: { slug: string }) => p.slug === draftSlug);
    expect(drafts).toHaveLength(0);
  });

  it("returns a published post by slug", async () => {
    const req = new Request(`http://localhost/api/content/posts/${testSlug}`);
    const res = await getPost(req as any, { params: Promise.resolve({ slug: testSlug }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Test published post");
    expect(body.data.body).toContain("# Hello");
  });

  it("returns 404 for a draft post", async () => {
    const req = new Request(`http://localhost/api/content/posts/${draftSlug}`);
    const res = await getPost(req as any, { params: Promise.resolve({ slug: draftSlug }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration`
Expected: FAIL — route modules cannot be resolved.

- [ ] **Step 3: Implement the list route**

Create `apps/web/src/app/api/content/posts/route.ts`:

```ts
import { NextRequest } from "next/server";
import { prisma } from "@saas/database";
import { getPaginationParams, paginatedResponse } from "@saas/api";

export async function GET(req: NextRequest) {
  const params = getPaginationParams(req.nextUrl.searchParams);
  const where = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };

  const [posts, total] = await Promise.all([
    prisma.contentPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: { id: true, slug: true, title: true, excerpt: true, publishedAt: true },
    }),
    prisma.contentPost.count({ where }),
  ]);

  return paginatedResponse(posts, total, params);
}
```

- [ ] **Step 4: Implement the single-post route**

Create `apps/web/src/app/api/content/posts/[slug]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { prisma } from "@saas/database";
import { notFoundResponse, successResponse } from "@saas/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.contentPost.findFirst({
    where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
  });

  if (!post) return notFoundResponse("Post");

  return successResponse(post);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration`
Expected: PASS (3 content API tests).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add apps/web/src/app/api/content tests/integration/content-api.test.ts
git commit -m "feat: add headless content API for published posts"
```

---

### Task 8: Markdown renderer

**Files:**

- Create: `apps/web/src/lib/markdown.ts`
- Test: `apps/web/src/lib/markdown.test.ts`

**Interfaces:**

- Produces: `renderMarkdownToHtml(markdown: string): string` — safe for admin-authored content; used by the blog post page (Task 9).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/markdown.test.ts`:

````ts
import { describe, it, expect } from "vitest";
import { renderMarkdownToHtml } from "./markdown";

describe("renderMarkdownToHtml", () => {
  it("renders headings and paragraphs", () => {
    const html = renderMarkdownToHtml("# Title\n\nSome paragraph.");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>Some paragraph.</p>");
  });

  it("renders inline bold, italic, links, and code", () => {
    const html = renderMarkdownToHtml("**bold** *italic* [link](https://saas.com) `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain(
      '<a href="https://saas.com" target="_blank" rel="noopener noreferrer">link</a>',
    );
    expect(html).toContain("<code>code</code>");
  });

  it("renders unordered lists", () => {
    const html = renderMarkdownToHtml("- one\n- two");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("renders blockquotes", () => {
    expect(renderMarkdownToHtml("> quoted")).toContain("<blockquote>quoted</blockquote>");
  });

  it("renders fenced code blocks with escaped content", () => {
    const html = renderMarkdownToHtml("```ts\nconst x = 1 < 2;\n```");
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain("const x = 1 &lt; 2;");
  });
});
````

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @saas/web exec vitest run src/lib/markdown.test.ts`
Expected: FAIL — `./markdown` cannot be resolved.

- [ ] **Step 3: Implement the renderer**

Create `apps/web/src/lib/markdown.ts`:

````ts
const inlinePatterns: Array<[RegExp, string]> = [
  [/`([^`]+)`/g, "<code>$1</code>"],
  [/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"],
  [/\*([^*]+)\*/g, "<em>$1</em>"],
  [
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  ],
];

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text: string): string {
  return inlinePatterns.reduce((acc, [re, html]) => acc.replace(re, html), text);
}

export function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  const codeLines: string[] = [];

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      closeList();
      if (inCode) {
        out.push(`</code></pre>`);
        inCode = false;
      } else {
        inCode = true;
        codeLines.length = 0;
        out.push(`<pre><code${fence[1] ? ` class="language-${fence[1]}"` : ""}>`);
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      out.push(`<blockquote>${renderInline(quote[1]!)}</blockquote>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${renderInline(listItem[1]!)}</li>`);
      continue;
    }

    if (line.trim() === "") {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return out.join("\n");
}
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @saas/web exec vitest run src/lib/markdown.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/markdown.ts apps/web/src/lib/markdown.test.ts
git commit -m "feat: add lightweight markdown renderer"
```

---

### Task 9: Public blog pages

**Files:**

- Create: `apps/web/src/app/(marketing)/blog/page.tsx`
- Create: `apps/web/src/app/(marketing)/blog/[slug]/page.tsx`
- Modify: `apps/web/src/components/layout/navbar.tsx` (add Blog link, desktop + mobile)

**Interfaces:**

- Consumes: `renderMarkdownToHtml` from `@/lib/markdown`, `prisma` from `@saas/database`, `formatDate` from `@saas/utils`.
- Produces: `/blog` listing and `/blog/[slug]` detail pages (published posts only).

- [ ] **Step 1: Create the blog listing page**

Create `apps/web/src/app/(marketing)/blog/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@saas/database";
import { formatDate } from "@saas/utils";

export const metadata = { title: "Blog" };

const PER_PAGE = 10;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const where = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };

  const [posts, total] = await Promise.all([
    prisma.contentPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { slug: true, title: true, excerpt: true, publishedAt: true },
    }),
    prisma.contentPost.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="container max-w-3xl py-16">
      <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
      <p className="text-muted-foreground mt-4 text-lg">
        Product updates, guides, and announcements.
      </p>

      <div className="mt-12 space-y-8">
        {posts.length === 0 && (
          <p className="text-muted-foreground">No posts yet — check back soon.</p>
        )}
        {posts.map((post) => (
          <article key={post.slug} className="border-b pb-8">
            <Link href={`/blog/${post.slug}`} className="block">
              <h2 className="text-2xl font-semibold hover:underline">{post.title}</h2>
            </Link>
            {post.excerpt && <p className="text-muted-foreground mt-2">{post.excerpt}</p>}
            <p className="text-muted-foreground mt-3 text-sm">
              {formatDate(post.publishedAt ?? new Date())}
            </p>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-between">
          {page > 1 ? (
            <Link href={`/blog?page=${page - 1}`} className="text-primary hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link href={`/blog?page=${page + 1}`} className="text-primary hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the blog post page**

Create `apps/web/src/app/(marketing)/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@saas/database";
import { formatDate } from "@saas/utils";
import { renderMarkdownToHtml } from "@/lib/markdown";

const PUBLISHED_WHERE = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };

export async function generateStaticParams() {
  const posts = await prisma.contentPost.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.contentPost.findFirst({
    where: { ...PUBLISHED_WHERE, slug },
    select: { title: true, excerpt: true },
  });
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.excerpt ?? undefined };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.contentPost.findFirst({ where: { ...PUBLISHED_WHERE, slug } });
  if (!post) notFound();

  return (
    <article className="container max-w-3xl py-16">
      <Link href="/blog" className="text-muted-foreground text-sm hover:underline">
        ← Back to blog
      </Link>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">{post.title}</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        {formatDate(post.publishedAt ?? new Date())}
      </p>
      {post.excerpt && <p className="text-muted-foreground mt-6 text-lg">{post.excerpt}</p>}
      <div
        className="prose prose-slate dark:prose-invert mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.body) }}
      />
    </article>
  );
}
```

Note: `dangerouslySetInnerHTML` is acceptable here because only admins author post bodies via the admin CMS (Task 12). The `prose` classes require `@tailwindcss/typography` — if the repo does not have it, verify in Step 4 and strip the `prose` classes if missing (plain `<div>` styling is fine).

- [ ] **Step 3: Add the Blog link to the navbar**

In `apps/web/src/components/layout/navbar.tsx`:

- Desktop nav (after the Pricing link, ~line 34): add

```tsx
<Link
  href="/blog"
  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
>
  Blog
</Link>
```

- Mobile nav (after the Pricing link, ~line 91): add

```tsx
<Link href="/blog" className="py-2 text-sm">
  Blog
</Link>
```

- [ ] **Step 4: Verify the build**

Run: `pnpm --filter @saas/web build`
Expected: build succeeds. If `prose` is not styled (no typography plugin), remove the `prose` classes from the post body div and rebuild.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(marketing)/blog" apps/web/src/components/layout/navbar.tsx
git commit -m "feat: add public blog pages"
```

---

### Task 10: Contact + newsletter UI on the marketing site

**Files:**

- Create: `apps/web/src/components/forms/contact-form.tsx`
- Create: `apps/web/src/components/forms/newsletter-form.tsx`
- Modify: `apps/web/src/app/(marketing)/page.tsx` (newsletter band + contact section)
- Modify: `apps/web/src/components/layout/footer.tsx` (newsletter column + fix Contact link)
- Modify: `tests/e2e/basic.spec.ts` (newsletter e2e test)

**Interfaces:**

- Consumes: `@saas/ui` (Button, Input, Textarea, Label, Card, useToast), react-hook-form + `zodResolver` (already deps of apps/web), `getClientEnv` from `@saas/config`.
- Produces: `<ContactForm />` and `<NewsletterForm />` client components. Contact form posts to `/api/contact`; newsletter form posts to `/api/newsletter/subscribe`.

- [ ] **Step 1: Write the failing e2e test**

In `tests/e2e/basic.spec.ts`, append a new describe block:

```ts
test.describe("Marketing integrations", () => {
  test("newsletter form shows success toast", async ({ page }) => {
    await page.goto("/");
    await page.fill('#newsletter-email input[type="email"]', "e2e-newsletter@example.com");
    await page.click("#newsletter-email button[type=submit]");
    await expect(page.getByText("Thanks for subscribing!")).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e`
Expected: FAIL — no `#newsletter-email` element on the page (and the form does not exist yet).

- [ ] **Step 3: Create the NewsletterForm component**

Create `apps/web/src/components/forms/newsletter-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, useToast } from "@saas/ui";

const newsletterSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

type NewsletterValues = z.infer<typeof newsletterSchema>;

export function NewsletterForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
  });

  async function onSubmit(values: NewsletterValues) {
    setLoading(true);
    const res = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);

    if (!res.ok) {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
      return;
    }

    reset();
    toast({ title: "Thanks for subscribing!" });
  }

  return (
    <form id="newsletter-email" onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
      <Input
        type="email"
        placeholder="you@example.com"
        aria-label="Email address"
        {...register("email")}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Subscribing..." : "Subscribe"}
      </Button>
      {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
    </form>
  );
}
```

Note: the e2e selector `#newsletter-email input[type="email"]` matches the form id on the input's parent form — keep the `id` attribute exactly.

- [ ] **Step 4: Create the ContactForm component**

Create `apps/web/src/components/forms/contact-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardContent, Input, Label, Textarea, useToast } from "@saas/ui";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  subject: z.string().trim().min(1, "Please enter a subject").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  async function onSubmit(values: ContactValues) {
    setLoading(true);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);

    if (!res.ok) {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
      return;
    }

    reset();
    toast({ title: "Message sent", description: "We'll get back to you soon." });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" placeholder="Jane Doe" {...register("name")} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="jane@example.com"
                {...register("email")}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-subject">Subject</Label>
            <Input id="contact-subject" placeholder="How can we help?" {...register("subject")} />
            {errors.subject && <p className="text-destructive text-sm">{errors.subject.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              rows={5}
              placeholder="Tell us more..."
              {...register("message")}
            />
            {errors.message && <p className="text-destructive text-sm">{errors.message.message}</p>}
          </div>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Wire the landing page sections**

In `apps/web/src/app/(marketing)/page.tsx`:

1. Import the two components at the top:

```tsx
import { ContactForm } from "@/components/forms/contact-form";
import { NewsletterForm } from "@/components/forms/newsletter-form";
```

2. In the "Ready to Launch?" section (the `bg-muted/50 py-24` section before the closing `</>`), add the newsletter form below the CTA button, inside the existing `<div className="mt-10">`:

```tsx
          <div className="mt-10">
            <Link href="/auth/register">
              <Button size="lg">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 border-t pt-8 text-left">
            <h3 className="mb-2 text-lg font-semibold">Subscribe for product updates</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              No spam. Unsubscribe anytime.
            </p>
            <div className="mx-auto max-w-sm">
              <NewsletterForm />
            </div>
          </div>
```

3. Append a new contact section after that section (still inside the fragment):

```tsx
<section id="contact" className="py-24">
  <div className="container grid gap-12 lg:grid-cols-2">
    <div>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Get in touch</h2>
      <p className="text-muted-foreground mt-4 text-lg">
        Questions about pricing, features, or partnerships? Send us a message and we&apos;ll get
        back to you within one business day.
      </p>
    </div>
    <ContactForm />
  </div>
</section>
```

- [ ] **Step 6: Update the footer**

In `apps/web/src/components/layout/footer.tsx`:

1. Add import: `import { NewsletterForm } from "@/components/forms/newsletter-form";`
2. Change the Support column's Contact link from `/contact` to `/#contact`.
3. Add a newsletter block above the bottom copyright bar, after the 4-column grid:

```tsx
<div className="mt-8 flex flex-col items-center gap-4 border-t pt-8 md:flex-row md:justify-between">
  <p className="text-muted-foreground text-sm">Subscribe for product updates and guides.</p>
  <div className="w-full max-w-sm">
    <NewsletterForm />
  </div>
</div>
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @saas/web build`
Expected: build succeeds.

Run (requires local Postgres + dev server on port 3000): `pnpm test:e2e`
Expected: the new newsletter test PASSES; existing landing/auth tests still PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/forms apps/web/src/app/"(marketing)"/page.tsx apps/web/src/components/layout/footer.tsx tests/e2e/basic.spec.ts
git commit -m "feat: add contact and newsletter forms to marketing site"
```

---

### Task 11: Admin — contact inbox + newsletter subscribers

**Files:**

- Modify: `apps/web/src/components/layout/admin-nav.tsx` (add Messages + Newsletter entries)
- Create: `apps/web/src/app/(admin)/admin/messages/actions.ts`
- Create: `apps/web/src/app/(admin)/admin/messages/page.tsx`
- Create: `apps/web/src/app/(admin)/admin/newsletter/actions.ts`
- Create: `apps/web/src/app/(admin)/admin/newsletter/page.tsx`

**Interfaces:**

- Consumes: `prisma` from `@saas/database`, `@saas/ui` components, existing admin layout guard.
- Produces: server actions `markMessageRead(id: string): Promise<void>` and `unsubscribeSubscriber(id: string): Promise<void>`; pages at `/admin/messages` and `/admin/newsletter`.

- [ ] **Step 1: Add the nav entries**

In `apps/web/src/components/layout/admin-nav.tsx`:

1. Extend the lucide import with `Inbox`, `Send`, `FileText` (add `Send` alongside the existing `Mail` icon).
2. Insert into `adminNav` (before `Email Broadcast`):

```tsx
  { href: "/admin/messages", label: "Messages", icon: Inbox },
  { href: "/admin/newsletter", label: "Newsletter", icon: Send },
  { href: "/admin/posts", label: "Posts", icon: FileText },
```

- [ ] **Step 2: Create the messages actions + page**

Create `apps/web/src/app/(admin)/admin/messages/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@saas/database";

export async function markMessageRead(id: string): Promise<void> {
  await prisma.contactMessage.update({
    where: { id },
    data: { readAt: new Date() },
  });
  revalidatePath("/admin/messages");
}
```

Create `apps/web/src/app/(admin)/admin/messages/page.tsx`:

```tsx
import { prisma } from "@saas/database";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui";
import { formatDate } from "@saas/utils";
import { markMessageRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Contact form submissions from the marketing site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>{messages.length} recent submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No messages yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-medium">{message.name}</TableCell>
                    <TableCell>{message.email}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{message.subject}</TableCell>
                    <TableCell>{formatDate(message.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={message.readAt ? "secondary" : "default"}>
                        {message.readAt ? "Read" : "New"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!message.readAt && (
                        <form action={markMessageRead.bind(null, message.id)}>
                          <Button type="submit" variant="outline" size="sm">
                            Mark read
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

Note: `Badge` variants — verify the `@saas/ui` Badge component supports `variant="secondary"` (standard shadcn badge does); if not, use the default variant for both states.

- [ ] **Step 3: Create the newsletter actions + page**

Create `apps/web/src/app/(admin)/admin/newsletter/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@saas/database";

export async function unsubscribeSubscriber(id: string): Promise<void> {
  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
  revalidatePath("/admin/newsletter");
}
```

Create `apps/web/src/app/(admin)/admin/newsletter/page.tsx`:

```tsx
import { prisma } from "@saas/database";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui";
import { formatDate } from "@saas/utils";
import { unsubscribeSubscriber } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Newsletter</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Email capture subscribers from the marketing site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
          <CardDescription>{subscribers.length} recent subscribers</CardDescription>
        </CardHeader>
        <CardContent>
          {subscribers.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No subscribers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell className="font-medium">{subscriber.email}</TableCell>
                    <TableCell>
                      <Badge variant={subscriber.status === "SUBSCRIBED" ? "default" : "secondary"}>
                        {subscriber.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{subscriber.source}</TableCell>
                    <TableCell>{formatDate(subscriber.createdAt)}</TableCell>
                    <TableCell>
                      {subscriber.status === "SUBSCRIBED" && (
                        <form action={unsubscribeSubscriber.bind(null, subscriber.id)}>
                          <Button type="submit" variant="outline" size="sm">
                            Unsubscribe
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add apps/web/src/components/layout/admin-nav.tsx "apps/web/src/app/(admin)/admin/messages" "apps/web/src/app/(admin)/admin/newsletter"
git commit -m "feat: add admin inbox and newsletter subscriber pages"
```

---

### Task 12: Admin — posts CMS (create/edit/list/delete)

**Files:**

- Create: `apps/web/src/app/(admin)/admin/posts/actions.ts`
- Create: `apps/web/src/components/admin/post-form.tsx`
- Create: `apps/web/src/app/(admin)/admin/posts/page.tsx`
- Create: `apps/web/src/app/(admin)/admin/posts/new/page.tsx`
- Create: `apps/web/src/app/(admin)/admin/posts/[id]/edit/page.tsx`

**Interfaces:**

- Consumes: `generateSlug` from `@saas/utils`, `prisma`, `@saas/ui`, React 19 `useActionState`.
- Produces: server actions `createPostAction(prev: PostFormState, formData: FormData): Promise<PostFormState>` and `updatePostAction(id: string, prev: PostFormState, formData: FormData): Promise<PostFormState>` (exported type `PostFormState = { ok: boolean; error?: string }`); pages `/admin/posts`, `/admin/posts/new`, `/admin/posts/[id]/edit`.

- [ ] **Step 1: Create the server actions**

Create `apps/web/src/app/(admin)/admin/posts/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@saas/database";
import { generateSlug } from "@saas/utils";

export type PostFormState = { ok: boolean; error?: string };

const postSchema = z.object({
  title: z.string().trim().min(1).max(255),
  excerpt: z.string().trim().max(500),
  body: z.string().trim().min(1),
  coverImage: z.string().trim().max(2000),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

async function uniqueSlug(base: string): Promise<string> {
  const clean = generateSlug(base) || "post";
  let candidate = clean;
  let i = 2;
  while (
    await prisma.contentPost.findUnique({ where: { slug: candidate }, select: { id: true } })
  ) {
    candidate = `${clean}-${i}`;
    i += 1;
  }
  return candidate;
}

function parseForm(formData: FormData) {
  const parsed = postSchema.safeParse({
    title: formData.get("title") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    body: formData.get("body") ?? "",
    coverImage: formData.get("coverImage") ?? "",
    status: formData.get("status") ?? "DRAFT",
  });
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    excerpt: parsed.data.excerpt || null,
    coverImage: parsed.data.coverImage || null,
  };
}

export async function createPostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const data = parseForm(formData);
  if (!data) return { ok: false, error: "Invalid input" };

  const slug = await uniqueSlug(data.title);
  await prisma.contentPost.create({
    data: {
      ...data,
      slug,
      publishedAt: data.status === "PUBLISHED" ? new Date() : null,
    },
  });

  revalidatePath("/admin/posts");
  revalidatePath("/blog");
  return { ok: true };
}

export async function updatePostAction(
  id: string,
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const existing = await prisma.contentPost.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Post not found" };

  const data = parseForm(formData);
  if (!data) return { ok: false, error: "Invalid input" };

  const wasDraft = existing.status === "DRAFT";
  const isNowPublished = data.status === "PUBLISHED";

  await prisma.contentPost.update({
    where: { id },
    data: {
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      coverImage: data.coverImage,
      status: data.status,
      publishedAt:
        isNowPublished && (wasDraft || !existing.publishedAt) ? new Date() : existing.publishedAt,
    },
  });

  revalidatePath("/admin/posts");
  revalidatePath("/blog");
  return { ok: true };
}
```

- [ ] **Step 2: Create the shared PostForm client component**

Create `apps/web/src/components/admin/post-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@saas/ui";
import type { PostFormState } from "@/app/(admin)/admin/posts/actions";

interface PostFormProps {
  action: (prevState: PostFormState, formData: FormData) => Promise<PostFormState>;
  defaults?: {
    title: string;
    excerpt: string;
    body: string;
    coverImage: string;
    status: "DRAFT" | "PUBLISHED";
  };
}

export function PostForm({ action, defaults }: PostFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="post-title">Title</Label>
        <Input
          id="post-title"
          name="title"
          defaultValue={defaults?.title}
          required
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-excerpt">Excerpt</Label>
        <Textarea
          id="post-excerpt"
          name="excerpt"
          defaultValue={defaults?.excerpt}
          maxLength={500}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-body">Body (Markdown)</Label>
        <Textarea id="post-body" name="body" defaultValue={defaults?.body} required rows={16} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-cover">Cover image URL</Label>
        <Input
          id="post-cover"
          name="coverImage"
          defaultValue={defaults?.coverImage}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select name="status" defaultValue={defaults?.status ?? "DRAFT"}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state.ok && <p className="text-primary text-sm">Saved successfully.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Post"}
      </Button>
    </form>
  );
}
```

Note: the shadcn `Select` component needs a hidden input to submit its value through a form action. Verify `@saas/ui`'s Select implementation — if the value is not submitted, add a hidden input synced with the select via `onValueChange` + `useState`, and keep the `name="status"` on that hidden input instead.

- [ ] **Step 3: Create the posts list page**

Create `apps/web/src/app/(admin)/admin/posts/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@saas/database";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui";
import { formatDate } from "@saas/utils";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const posts = await prisma.contentPost.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Blog content for the public site and content API.
          </p>
        </div>
        <Link href="/admin/posts/new">
          <Button>New Post</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>{posts.length} posts</CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No posts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{post.slug}</TableCell>
                    <TableCell>
                      <Badge variant={post.status === "PUBLISHED" ? "default" : "secondary"}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{post.publishedAt ? formatDate(post.publishedAt) : "—"}</TableCell>
                    <TableCell>
                      <Link href={`/admin/posts/${post.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create the new/edit pages**

Create `apps/web/src/app/(admin)/admin/posts/new/page.tsx`:

```tsx
import { PostForm } from "@/components/admin/post-form";
import { createPostAction } from "../actions";

export default function NewPostPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">New Post</h1>
      <PostForm action={createPostAction} />
    </div>
  );
}
```

Create `apps/web/src/app/(admin)/admin/posts/[id]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@saas/database";
import { PostForm } from "@/components/admin/post-form";
import { updatePostAction } from "../../actions";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Edit Post</h1>
      <PostForm
        action={updatePostAction.bind(null, post.id)}
        defaults={{
          title: post.title,
          excerpt: post.excerpt ?? "",
          body: post.body,
          coverImage: post.coverImage ?? "",
          status: post.status,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm typecheck` and `pnpm --filter @saas/web build`
Expected: both PASS.

```bash
git add "apps/web/src/app/(admin)/admin/posts" apps/web/src/components/admin/post-form.tsx
git commit -m "feat: add admin posts CMS with create and edit"
```

---

### Task 13: Client analytics provider + env docs

**Files:**

- Modify: `apps/web/package.json` (add `posthog-js`)
- Create: `apps/web/src/components/analytics/analytics-provider.tsx`
- Modify: `apps/web/src/providers/providers.tsx`
- Modify: `.env.example` (analytics section — add `ANALYTICS_PROVIDER`)

**Interfaces:**

- Consumes: `posthog-js`, `getClientEnv` from `@saas/config`, `useSession` from `next-auth/react`, `usePathname` from `next/navigation`.
- Produces: `<AnalyticsProvider>` mounted inside `Providers`; initializes PostHog client-side when `NEXT_PUBLIC_POSTHOG_KEY` is set, captures pageviews on route change, identifies logged-in users.

- [ ] **Step 1: Add the dependency**

In `apps/web/package.json` add `"posthog-js": "^1.150.0"` to `dependencies`, then run from the repo root:

```bash
pnpm install
```

Expected: lockfile updated; `posthog-js` resolves to the same version already in the workspace store.

- [ ] **Step 2: Create the provider component**

Create `apps/web/src/components/analytics/analytics-provider.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { getClientEnv } from "@saas/config";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const env = getClientEnv();

  useEffect(() => {
    if (
      !env.NEXT_PUBLIC_POSTHOG_KEY ||
      (typeof posthog.__loaded === "function" && posthog.__loaded())
    ) {
      return;
    }
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      person_profiles: "identified_only",
    });
  }, [env.NEXT_PUBLIC_POSTHOG_KEY, env.NEXT_PUBLIC_POSTHOG_HOST]);

  useEffect(() => {
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.capture("$pageview");
  }, [pathname, env.NEXT_PUBLIC_POSTHOG_KEY]);

  useEffect(() => {
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const user = session?.user;
    if (user?.id) {
      posthog.identify(user.id, { email: user.email ?? undefined });
    }
  }, [session?.user?.id, session?.user?.email, env.NEXT_PUBLIC_POSTHOG_KEY]);

  return <>{children}</>;
}
```

Note: if `posthog.__loaded` is not typed, cast: `(posthog as any).__loaded`. PostHog auto-captures pageviews by default once initialized, so the explicit `$pageview` capture in the pathname effect is a safe duplicate — keep it for route transitions.

- [ ] **Step 3: Mount it in Providers**

In `apps/web/src/providers/providers.tsx`, add the import and wrap children:

```tsx
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
```

```tsx
<SessionProvider>
  <AnalyticsProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  </AnalyticsProvider>
</SessionProvider>
```

- [ ] **Step 4: Update .env.example**

In `.env.example`, in the `# Analytics` section, add at the top:

```
ANALYTICS_PROVIDER=posthog
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm typecheck` and `pnpm --filter @saas/web build`
Expected: both PASS.

```bash
git add apps/web/package.json apps/web/src/components/analytics apps/web/src/providers/providers.tsx .env.example
git commit -m "feat: add client-side posthog analytics provider"
```

---

### Task 14: Seed content + docs

**Files:**

- Create: `prisma/seed/content.ts`
- Modify: `prisma/seed/index.ts`
- Modify: `prisma/seed.ts`
- Modify: `docs/api.md` (new endpoints section)

**Interfaces:**

- Consumes: existing modular seed layout (module file + re-export + invocation in `prisma/seed.ts`), `PrismaClient` from `@prisma/client`.
- Produces: 3 published sample posts + 1 draft on `pnpm db:seed`; API docs covering Tasks 5–7 endpoints.

- [ ] **Step 1: Create the seed module**

Create `prisma/seed/content.ts`:

````ts
import { PrismaClient } from "@prisma/client";

export async function seedContent(prisma: PrismaClient) {
  console.log("\n── Content ──");

  const count = await prisma.contentPost.count();
  if (count > 0) {
    console.log("  ↳ Posts already exist");
    return;
  }

  const now = Date.now();
  await prisma.contentPost.createMany({
    data: [
      {
        slug: "welcome-to-the-saas-boilerplate-blog",
        title: "Welcome to the SaaS Boilerplate Blog",
        excerpt: "What we're building and what to expect from this blog.",
        body: "# Welcome\n\nWe're building a production-ready SaaS starter kit.\n\n- Authentication\n- Payments\n- Teams\n\nStay tuned for deep dives.",
        status: "PUBLISHED",
        publishedAt: new Date(now - 14 * 24 * 60 * 60 * 1000),
      },
      {
        slug: "why-server-components-matter",
        title: "Why Server Components Matter",
        excerpt: "A quick primer on React Server Components in Next.js 15.",
        body: "Server Components let you render on the server and ship less JavaScript to the client.\n\n> Less JavaScript means faster pages.\n\n```tsx\nasync function Page() {\n  return <h1>Hello</h1>;\n}\n```",
        status: "PUBLISHED",
        publishedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      },
      {
        slug: "integrating-analytics-the-right-way",
        title: "Integrating Analytics the Right Way",
        excerpt: "Provider abstractions keep analytics swappable and testable.",
        body: "An analytics service interface with adapters for PostHog, Plausible, and Google Analytics keeps tracking code out of your business logic.",
        status: "PUBLISHED",
        publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
      {
        slug: "draft-roadmap-for-q3",
        title: "Draft: Roadmap for Q3",
        body: "This post is a draft and should never appear on the public site.",
        status: "DRAFT",
      },
    ],
  });

  console.log("  ✓ Created 4 posts (3 published, 1 draft)");
}
````

- [ ] **Step 2: Wire the module into the seed runner**

In `prisma/seed/index.ts`, add the re-export:

```ts
export { seedContent } from "./content";
```

In `prisma/seed.ts`, add `seedContent` to the import block and call it at the end of `main()` (after `seedFeatureFlags`):

```ts
await seedContent(prisma);
```

- [ ] **Step 3: Verify the seed runs**

Run: `pnpm db:seed`
Expected: seed completes; logs `✓ Created 4 posts (3 published, 1 draft)` (only if the posts table was empty).

- [ ] **Step 4: Update the API docs**

In `docs/api.md`, append a new section at the end:

```markdown
## Marketing (public)

Public endpoints for the marketing site. No authentication required (rate limited).

| Method | Route                         | Description                                      |
| ------ | ----------------------------- | ------------------------------------------------ |
| POST   | `/api/contact`                | Submit a contact form message (rate limited)     |
| POST   | `/api/newsletter/subscribe`   | Subscribe an email to the newsletter             |
| POST   | `/api/newsletter/unsubscribe` | Unsubscribe via the token from the subscribe row |
| GET    | `/api/content/posts`          | List published posts (paginated)                 |
| GET    | `/api/content/posts/[slug]`   | Get a single published post                      |

### Content API

`GET /api/content/posts` returns `{ data, meta }` with `page`, `perPage`, `total`,
`totalPages`, `hasNextPage`, `hasPreviousPage`. Posts are ordered by
`publishedAt` descending and only `PUBLISHED` posts with `publishedAt <= now` are returned.
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add prisma/seed/content.ts prisma/seed/index.ts prisma/seed.ts docs/api.md
git commit -m "feat: seed blog content and document marketing endpoints"
```

---

### Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full gate sweep**

Run from the repo root, in order:

```bash
pnpm db:validate
pnpm typecheck
pnpm lint
pnpm --filter @saas/web test
pnpm --filter @saas/analytics test
pnpm --filter @saas/emails test
pnpm test:integration
pnpm --filter @saas/web build
```

Expected: everything PASSES. The e2e suite (`pnpm test:e2e`, requires running dev server + Postgres) should also pass including the new newsletter test.

- [ ] **Step 2: Manual smoke check**

1. `pnpm dev` → landing page shows the newsletter band and `#contact` section.
2. Submit the contact form → success toast → row appears in `/admin/messages`.
3. Subscribe in the footer → success toast → row appears in `/admin/newsletter`.
4. Visit `/blog` → sample posts render with markdown; `/api/content/posts` returns them.
5. Create a post in `/admin/posts/new` with status Published → appears on `/blog`.

- [ ] **Step 3: Report**

Summarize for the user: endpoints added, admin pages added, env vars added (`ANALYTICS_PROVIDER`, `CONTACT_NOTIFY_EMAIL`, plus existing PostHog vars), any deviations from the spec.
