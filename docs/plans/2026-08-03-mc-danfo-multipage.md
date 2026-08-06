# MC Danfo Multi-Page Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/about`, `/services` and `/contact` pages to the MC Danfo Next.js site and convert the homepage's About/Services sections into those pages.

**Architecture:** Three new static routes composed from existing primitives (`PageHero`, `Container`, `SectionHeading`, `FadeIn`/`Stagger`, `Button`, form primitives). New copy lives in the existing `/data` layer (`types.ts`, `site.ts`, `pages.ts`). The existing `About` and `Services` section components are reused on the new pages; the homepage drops them.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19, Tailwind v4, framer-motion, react-hook-form + zod + sonner, lucide-react. No test runner exists in this repo — verification is `next build`, `eslint`, and browser checks via Playwright (installed under `_open-canva/node_modules`, executable at `C:/Users/1040 G8/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`).

## Global Constraints

- Reuse existing components only — no new UI primitives, no new dependencies, no new image assets.
- All user-facing copy goes through `/data` (site.ts / pages.ts), never hard-coded in page files.
- Brand palette, motion (FadeIn/Stagger), responsive breakpoints and safe-area behavior must be preserved.
- `wa.me` links must NOT contain emoji (the redirect corrupts emoji to U+FFFD — established bug).
- No backend; contact/booking flows compose pre-filled WhatsApp messages via `waLink()`.
- Working dir for all commands: `C:\Users\1040 G8\Documents\jarvis-demo\mc-danfo`.

---

### Task 1: Data layer — types, site copy, page heroes, sitemap

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/site.ts`
- Modify: `src/data/pages.ts`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Produces (used by Tasks 2–5):
  - `interface StatItem { value: string; label: string }`
  - `interface ProcessStep { icon: string; title: string; description: string }`
  - `interface ProcessContent { eyebrow: string; title: string; description: string; steps: ProcessStep[] }`
  - `AboutContent.stats?: StatItem[]`
  - `SiteData.process: ProcessContent`
  - `pages.ts` exports: `aboutPageHero: PageHeroContent`, `servicesPageHero: PageHeroContent`, `contactPageHero: PageHeroContent`, `staticRoutes` (shape `{ path: string; label: string }[]`)
- Consumes: existing `NavLink`, `PageHeroContent`, `CampaignPage`, `waLink`, `booking`, `contact`, `siteData`

- [x] **Step 1: Extend `src/data/types.ts`**

Add after the `AboutContent` interface (line ~41):

```ts
export interface StatItem {
  value: string;
  label: string;
}
```

Add after `ServiceItem`:

```ts
export interface ProcessStep {
  icon: string;
  title: string;
  description: string;
}

export interface ProcessContent {
  eyebrow: string;
  title: string;
  description: string;
  steps: ProcessStep[];
}
```

In `AboutContent` (lines 32–41) add the optional stats field:

```ts
export interface AboutContent {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  highlights: string[];
  stats?: StatItem[];
  image: {
    src: string;
    alt: string;
  };
}
```

In `SiteData` (line ~177, after `services`) add:

```ts
  process: ProcessContent;
```

- [x] **Step 2: Update `src/data/site.ts` — nav, stats, process**

Replace the `nav` array (lines 45–54) with:

```ts
  nav: [
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
    { label: "Videos", href: "#videos" },
    { label: "Style", href: "#style" },
    { label: "Gallery", href: "#gallery" },
    { label: "Media Kit", href: "#media-kit" },
    { label: "FAQ", href: "#faq" },
  ],
```

In the `about` block (after `highlights`, before `image`) add:

```ts
    stats: [
      { value: "10+", label: "Years hosting" },
      { value: "500+", label: "Events MC'd" },
      { value: "6", label: "Cities worked" },
    ],
```

Add a new top-level `process` block right after the `services` block (after its closing `},` around line 241):

```ts
  /* ── How it works ──────────────────────────────────────────────────────── */
  process: {
    eyebrow: "How It Works",
    title: "From enquiry to showtime",
    description:
      "Booking MC Danfo takes three simple steps — tell us about the event, lock the date, and let the show take care of itself.",
    steps: [
      {
        icon: "megaphone",
        title: "Enquire & get availability",
        description:
          "Fill in the form or message on WhatsApp — you'll have availability within 24 hours.",
      },
      {
        icon: "mic",
        title: "Planning call",
        description:
          "We shape the set around your audience, venue and programme — every event is custom.",
      },
      {
        icon: "party",
        title: "Showtime",
        description:
          "On the day, MC Danfo delivers — music, comedy and crowd control handled end to end.",
      },
    ],
  },
```

- [x] **Step 3: Add page heroes to `src/data/pages.ts`**

Update the import at the top (line 12):

```ts
import type { CampaignPage, PageHeroContent } from "./types";
```

Append at the end of the file (after `campaignRoutes`):

```ts
/* ── /about, /services, /contact — static pages ─────────────────────────── */
export const aboutPageHero: PageHeroContent = {
  variant: "dark",
  badge: "About MC Danfo",
  title: "The original music-comedy",
  titleHighlight: "storyteller",
  subtitle:
    "From the streets of Lagos to stages across Nigeria — one man, one mic, and an audience that never stops laughing.",
  primaryCta: { label: "Watch Performances", href: "/#videos" },
  secondaryCta: { label: "Book MC Danfo", href: "/book" },
  chips: ["10+ years hosting", "500+ events", "6 cities"],
};

export const servicesPageHero: PageHeroContent = {
  variant: "green",
  badge: "Services & Booking Types",
  title: "Every event,",
  titleHighlight: "perfectly hosted",
  subtitle:
    "Corporate dinners, weddings, brand activations, campus events and private parties — each booking tailored to the room, the audience and the goal.",
  primaryCta: { label: "Check Availability", href: "/book#booking" },
  secondaryCta: { label: "Book on WhatsApp", href: whatsappHref },
  chips: [
    "Weddings",
    "Corporate",
    "Birthdays",
    "Comedy Shows",
    "Brand Activations",
    "Private Parties",
  ],
};

export const contactPageHero: PageHeroContent = {
  variant: "yellow",
  badge: "Contact MC Danfo",
  title: "Let's make your event",
  titleHighlight: "unforgettable",
  subtitle:
    "Reach the booking desk directly — WhatsApp, email or the form below. We reply within the hour, usually faster.",
  primaryCta: { label: "Message on WhatsApp", href: whatsappHref },
  secondaryCta: { label: "Email Us", href: `mailto:${contact.email}` },
};

export const staticRoutes = [
  { path: "/about", label: "About MC Danfo" },
  { path: "/services", label: "Services" },
  { path: "/contact", label: "Contact" },
] as const;
```

- [x] **Step 4: Extend the sitemap**

In `src/app/sitemap.ts`:

```ts
import { campaignRoutes, staticRoutes } from "@/data/pages";
```

and add after the `campaignRoutes` spread:

```ts
    ...staticRoutes.map((route) => ({
      url: `${site.url}${route.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
```

- [x] **Step 5: Verify**

Run: `npm run build`
Expected: compile + type-check pass; sitemap route list still shows the same static routes (sitemap content verified in Task 7).

---

### Task 2: ContactForm component

**Files:**
- Create: `src/components/sections/contact-form.tsx`

**Interfaces:**
- Consumes: `siteData.booking.eventTypes`, `siteData.booking.whatsappNumber`, `waLink`, `trackLead` (`@/lib/analytics`), `Button`, `Input`, `Textarea`, `Label`, `Select*` (all from `@/components/ui/`), `Container`-free (section wrapper lives in the Contact page)
- Produces: `<ContactForm />` — renders a self-contained validated form; on submit opens `wa.me` with a pre-filled message and shows a success state via `sonner` toast

- [x] **Step 1: Create the component**

`src/components/sections/contact-form.tsx` (mirror `booking-section.tsx`'s form pattern, lines 182–379):

```tsx
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { siteData, waLink } from "@/data/site";
import { trackLead } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email address"),
  eventType: z.string().min(1, "Select an event type"),
  date: z.string().min(1, "Choose an event date"),
  message: z.string().max(1000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

/**
 * Contact form — validates with Zod, then opens a pre-filled WhatsApp
 * message to the booking desk (no backend required). No emoji in the
 * composed message: wa.me redirects corrupt emoji to U+FFFD.
 */
export function ContactForm() {
  const { booking } = siteData;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", eventType: "", date: "", message: "" },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitting(true);
    const message = [
      "*NEW CONTACT ENQUIRY — MC DANFO*",
      "",
      `*Name:* ${values.name}`,
      `*Email:* ${values.email}`,
      `*Event type:* ${values.eventType}`,
      `*Event date:* ${values.date}`,
      values.message ? `*Message:* ${values.message}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Open synchronously inside the user gesture (popup-blocker safe).
    window.open(waLink(booking.whatsappNumber, message), "_blank", "noopener,noreferrer");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSubmitting(false);
    toast.success("Enquiry ready!", {
      description: "Hit send on the WhatsApp thread so the booking desk has your details.",
    });
    trackLead("contact_enquiry");
    reset();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/5 sm:p-8"
    >
      <h2 className="font-display text-2xl uppercase tracking-wide">Send an enquiry</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Fill this in and we&apos;ll get back to you on WhatsApp — usually within the hour.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Full name *</Label>
          <Input
            id="contact-name"
            placeholder="e.g. Ada Obi"
            autoComplete="name"
            required
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">Email *</Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-eventType">Event type *</Label>
          <Controller
            name="eventType"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contact-eventType" aria-invalid={!!errors.eventType}>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {booking.eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.eventType && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.eventType.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-date">Event date *</Label>
          <Input
            id="contact-date"
            type="date"
            required
            aria-invalid={!!errors.date}
            {...register("date")}
          />
          {errors.date && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.date.message}
            </p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            placeholder="Tell us about your event — audience, theme, anything we should know…"
            className="min-h-[120px]"
            maxLength={1000}
            {...register("message")}
          />
          {errors.message && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.message.message}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        variant="yellow"
        size="lg"
        className="mt-6 w-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send />
            Send Enquiry on WhatsApp
          </>
        )}
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        No spam, ever. Your details go straight to the booking desk.
      </p>
    </form>
  );
}
```

- [x] **Step 2: Verify**

Run: `npm run build`
Expected: compile + type-check pass.

---

### Task 3: About page

**Files:**
- Create: `src/components/sections/about-stats.tsx`
- Create: `src/app/about/page.tsx`

**Interfaces:**
- Consumes: `siteData.about.stats`, `aboutPageHero` (Task 1), `<About />` (existing), `<CTASection />` (existing, props `primaryHref`, `primaryLabel`)
- Produces: `<AboutStats />` (renders `null` when `about.stats` is empty); `/about` route

- [x] **Step 1: Create the stats strip**

`src/components/sections/about-stats.tsx`:

```tsx
"use client";

import { siteData } from "@/data/site";
import { Container } from "@/components/shared/container";
import { Stagger, StaggerItem } from "@/components/motion";

/**
 * Quick-facts strip for the About page — value/label pairs on a dark band.
 * Renders nothing when no stats are configured.
 */
export function AboutStats() {
  const { about } = siteData;
  if (!about.stats?.length) return null;

  return (
    <section aria-label="MC Danfo in numbers" className="bg-brand-black py-14 text-white">
      <Container>
        <Stagger className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
          {about.stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <p className="font-display text-5xl text-brand-yellow">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.15em] text-white/60">
                {stat.label}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
```

- [x] **Step 2: Create the route**

`src/app/about/page.tsx` (follow `src/app/book/page.tsx` metadata pattern):

```tsx
import type { Metadata } from "next";
import { siteData } from "@/data/site";
import { aboutPageHero } from "@/data/pages";
import { PageHero } from "@/components/shared/page-hero";
import { About } from "@/components/sections/about";
import { AboutStats } from "@/components/sections/about-stats";
import { CTASection } from "@/components/sections/cta-section";

export const metadata: Metadata = {
  title: "About MC Danfo — The Original Music-Comedy Storyteller",
  description:
    "The story of MC Danfo — Nigerian music-comedy entertainer: music, comedy and Nigerian storytelling from Lagos to stages across Nigeria and beyond.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About MC Danfo — Music-Comedy Entertainer",
    description:
      "10+ years hosting, 500+ events across Nigeria. The signature blend of music and comedy that fills rooms.",
    url: `${siteData.site.url}/about`,
  },
};

export default function AboutPage() {
  return (
    <>
      <PageHero content={aboutPageHero} />
      <About />
      <AboutStats />
      <CTASection primaryHref="/book#booking" primaryLabel="Book MC Danfo" />
    </>
  );
}
```

- [x] **Step 3: Verify**

Run: `npm run build`
Expected: compile + type-check pass; `/about` present in route table.

---

### Task 4: Services page

**Files:**
- Create: `src/components/sections/process-section.tsx`
- Create: `src/app/services/page.tsx`
- Modify: `src/components/sections/services.tsx` (fix "Book this" link — `#booking` is a dead anchor on `/services`)

**Interfaces:**
- Consumes: `siteData.process`, `servicesPageHero` (Task 1), `<Services />`, `<CTASection />`
- Produces: `<ProcessSection />`; `/services` route

- [x] **Step 1: Create the process section**

`src/components/sections/process-section.tsx`:

```tsx
"use client";

import { siteData } from "@/data/site";
import { resolveIcon } from "@/components/icons";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Stagger, StaggerItem } from "@/components/motion";

/**
 * How-it-works strip for the Services page — numbered steps with icons.
 */
export function ProcessSection() {
  const { process } = siteData;

  return (
    <section aria-label="How booking works" className="bg-muted/40 py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={process.eyebrow}
          title={process.title}
          description={process.description}
        />
        <Stagger className="grid gap-5 sm:grid-cols-3">
          {process.steps.map((step, index) => (
            <StaggerItem key={step.title} className="h-full">
              <article className="relative h-full rounded-2xl border border-border bg-card p-6">
                <span className="absolute right-5 top-5 font-display text-4xl text-brand-yellow">
                  {index + 1}
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-green/10 text-brand-green">
                  {resolveIcon(step.icon, "h-5 w-5")}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
```

- [x] **Step 2: Fix the "Book this" link in `services.tsx`**

Add `usePathname` import:

```tsx
import { usePathname } from "next/navigation";
```

Inside the component, before the return:

```tsx
  const pathname = usePathname();
  const isHome = pathname === "/";
```

Change the card link (line 35–41) so `#booking` only stays same-page on the homepage:

```tsx
                <a
                  href={isHome ? "#booking" : "/book#booking"}
                  className="mt-4 inline-flex w-fit items-center text-sm font-semibold text-brand-green underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
                  aria-label={`Book ${service.title} with MC Danfo`}
                >
                  Book this →
                </a>
```

- [x] **Step 3: Create the route**

`src/app/services/page.tsx`:

```tsx
import type { Metadata } from "next";
import { siteData } from "@/data/site";
import { servicesPageHero } from "@/data/pages";
import { PageHero } from "@/components/shared/page-hero";
import { Services } from "@/components/sections/services";
import { ProcessSection } from "@/components/sections/process-section";
import { CTASection } from "@/components/sections/cta-section";

export const metadata: Metadata = {
  title: "Services — Book MC Danfo for Corporate, Weddings, Shows & More",
  description:
    "MC Danfo services: corporate events, weddings, birthdays, comedy shows, full MC services, brand activations, campus events and private parties.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Services — MC Danfo Event MC & Comedian",
    description:
      "Weddings, corporate, birthdays, shows, brand activations and private parties — every event, perfectly hosted.",
    url: `${siteData.site.url}/services`,
  },
};

export default function ServicesPage() {
  return (
    <>
      <PageHero content={servicesPageHero} />
      <Services />
      <ProcessSection />
      <CTASection primaryHref="/book#booking" primaryLabel="Check Availability" />
    </>
  );
}
```

- [x] **Step 4: Verify**

Run: `npm run build`
Expected: compile + type-check pass; `/services` present in route table.

---

### Task 5: Contact page

**Files:**
- Create: `src/components/sections/contact-details.tsx`
- Create: `src/app/contact/page.tsx`

**Interfaces:**
- Consumes: `siteData.contact`, `siteData.social`, `contactPageHero` (Task 1), `<ContactForm />` (Task 2), `resolveSocialIcon` (`@/components/icons`)
- Produces: `<ContactDetails />`; `/contact` route

- [x] **Step 1: Create the contact details panel**

`src/components/sections/contact-details.tsx` (reuses the booking-section contact-row pattern and the footer social-icon pattern):

```tsx
"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { siteData } from "@/data/site";
import { resolveSocialIcon } from "@/components/icons";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/motion";

/**
 * Contact channels for the Contact page — email, phone, location, socials
 * and a response-time note. Copy lives in /data/site.ts.
 */
export function ContactDetails() {
  const { contact, social } = siteData;

  return (
    <div className="min-w-0">
      <SectionHeading
        eyebrow="Reach the desk"
        title="Talk to a human, fast"
        align="left"
      />
      <FadeIn delay={0.1} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/50 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email</p>
            <a
              href={`mailto:${contact.email}`}
              className="font-semibold text-foreground hover:text-brand-green break-all"
            >
              {contact.email}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/50 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green">
            <Phone className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phone / WhatsApp</p>
            <a
              href={`tel:${contact.phone.replace(/\D/g, "")}`}
              className="font-semibold text-foreground hover:text-brand-green"
            >
              {contact.phone}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/50 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Based in</p>
            <p className="font-semibold text-foreground">{contact.location}</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Follow MC Danfo</p>
        <ul className="mt-3 flex gap-3">
          {social.links.map((link) => (
            <li key={link.name}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow MC Danfo on ${link.name}`}
                className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground transition-all hover:border-brand-yellow hover:bg-brand-yellow hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
              >
                {resolveSocialIcon(link.icon, "h-4 w-4")}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-2xl border border-brand-yellow/50 bg-brand-yellow/10 p-5 text-sm leading-relaxed text-brand-black/80">
          <strong className="text-brand-black">Quick response:</strong> enquiries
          are answered within the hour, usually faster. Include your event date
          and venue to speed things up.
        </p>
      </FadeIn>
    </div>
  );
}
```

- [x] **Step 2: Create the route**

`src/app/contact/page.tsx`:

```tsx
import type { Metadata } from "next";
import { siteData } from "@/data/site";
import { contactPageHero } from "@/data/pages";
import { PageHero } from "@/components/shared/page-hero";
import { ContactForm } from "@/components/sections/contact-form";
import { ContactDetails } from "@/components/sections/contact-details";
import { Container } from "@/components/shared/container";
import { FadeIn } from "@/components/motion";

export const metadata: Metadata = {
  title: "Contact MC Danfo — Bookings, Enquiries & Press",
  description:
    "Reach MC Danfo's booking desk — WhatsApp, email or the enquiry form. Bookings for weddings, corporate events, shows and private parties across Nigeria.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact MC Danfo — Bookings & Enquiries",
    description: "WhatsApp, email or the enquiry form — replies within the hour.",
    url: `${siteData.site.url}/contact`,
  },
};

export default function ContactPage() {
  return (
    <>
      <PageHero content={contactPageHero} />
      <section className="bg-white py-20 lg:py-28">
        <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <FadeIn className="min-w-0">
            <ContactDetails />
          </FadeIn>
          <FadeIn delay={0.15} className="min-w-0">
            <ContactForm />
          </FadeIn>
        </Container>
      </section>
    </>
  );
}
```

- [x] **Step 3: Verify**

Run: `npm run build`
Expected: compile + type-check pass; `/contact` present in route table.

---

### Task 6: Homepage + footer conversion

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/sections/footer.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: homepage without About/Services sections; footer that only prefixes `#`-anchors with `/` on non-home routes

- [x] **Step 1: Remove the converted sections from the homepage**

In `src/app/page.tsx`, remove the imports and usages of `About` and `Services`:

```tsx
import type { Metadata } from "next";
import { siteData } from "@/data/site";
import { Hero } from "@/components/sections/hero";
import { VideoGallery } from "@/components/sections/video-gallery";
import { SignatureCards } from "@/components/sections/signature-cards";
import { Gallery } from "@/components/sections/gallery";
import { MediaKit } from "@/components/sections/media-kit";
import { BookingSection } from "@/components/sections/booking-section";
import { SocialMedia } from "@/components/sections/social-media";
import { FAQ } from "@/components/sections/faq";
import { CTASection } from "@/components/sections/cta-section";

export const metadata: Metadata = {
  title: `${siteData.site.name} — ${siteData.site.position} | Bookings Open`,
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <VideoGallery />
      <SignatureCards />
      <Gallery />
      <MediaKit />
      {/* FAQ clears booking objections (travel, corporate, family-friendly)
          immediately before the conversion point. */}
      <FAQ />
      <BookingSection />
      <SocialMedia />
      <CTASection />
    </>
  );
}
```

- [x] **Step 2: Fix the footer anchor-prefixing logic**

In `src/components/sections/footer.tsx` (line 19), replace:

```tsx
  const sectionHref = (href: string) => (isHome ? href : `/${href}`);
```

with:

```tsx
  // Page links (/about, /services…) are absolute; only homepage section
  // anchors (#videos…) need the "/" prefix on non-home routes.
  const sectionHref = (href: string) =>
    href.startsWith("#") ? (isHome ? href : `/${href}`) : href;
```

- [x] **Step 3: Verify**

Run: `npm run build`
Expected: compile + type-check pass.

---

### Task 7: Full verification

**Files:**
- No source changes. Temporary check script: `C:\Users\1040 G8\AppData\Local\Temp\opencode\pages-verify.mjs`

**Interfaces:**
- Consumes: production server on port 3193, Playwright chromium (path below)

- [x] **Step 1: Build, lint, restart the server**

```powershell
npm run build; if ($?) { npm run lint }
$p = Get-NetTCPConnection -LocalPort 3193 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($p) { Stop-Process -Id $p -Force }
Start-Sleep -Seconds 2
Start-Process npm.cmd -ArgumentList 'run','start','--','-p','3193' -WindowStyle Hidden
Start-Sleep -Seconds 8
(Invoke-WebRequest -Uri 'http://localhost:3193/' -UseBasicParsing).StatusCode
```

Expected: build + lint clean, HTTP 200.

- [x] **Step 2: Browser verification script**

Create `C:\Users\1040 G8\AppData\Local\Temp\opencode\pages-verify.mjs`:

```js
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/1040 G8/Documents/jarvis-demo/_open-canva/');
const { chromium } = require('playwright');

const base = 'http://localhost:3193';
const routes = ['/', '/about', '/services', '/contact', '/book', '/waitlist', '/promo'];
const widths = [320, 375, 768, 1440];

const browser = await chromium.launch({ executablePath: 'C:/Users/1040 G8/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' });

for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => {
      const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      return { sw, over: sw > innerWidth + 1, h1: document.querySelector('h1')?.textContent.trim() ?? null };
    });
    console.log(`${m.over ? 'OVERFLOW' : 'ok      '} ${String(w).padStart(4)}px ${r} h1="${m.h1}"`);
  }
  await page.close();
}

// Nav + footer links resolve (no dead anchors)
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const r of ['/', '/about', '/services', '/contact']) {
  await page.goto(base + r, { waitUntil: 'networkidle' });
  const links = await page.evaluate(() => {
    const dead = [];
    for (const a of document.querySelectorAll('a[href^="#"]')) {
      const id = a.getAttribute('href').slice(1);
      if (!document.getElementById(id)) dead.push(a.getAttribute('href'));
    }
    return { dead, nav: [...document.querySelectorAll('header nav a')].map((a) => a.textContent.trim()).filter(Boolean).length };
  });
  console.log(`${r}: dead-anchors=${links.dead.length}${links.dead.length ? ' ' + links.dead.join(',') : ''} navItems=${links.nav}`);
}

// Homepage: no #about/#services sections, no "Book this" dead links
await page.goto(base + '/', { waitUntil: 'networkidle' });
const home = await page.evaluate(() => ({
  hasAboutSection: !!document.getElementById('about'),
  hasServicesSection: !!document.getElementById('services'),
}));
console.log('home has #about section:', home.hasAboutSection, '| #services section:', home.hasServicesSection);

// Contact form → wa.me popup contains the fields
await page.goto(base + '/contact', { waitUntil: 'networkidle' });
const popupPromise = page.waitForEvent('popup');
await page.fill('#contact-name', 'Test Client');
await page.fill('#contact-email', 'test@example.com');
await page.click('#contact-eventType');
await page.click('[role="option"]:has-text("Wedding")');
await page.fill('#contact-date', '2026-12-12');
await page.click('button:has-text("Send Enquiry on WhatsApp")');
const popup = await popupPromise;
const waUrl = popup.url();
const ok = waUrl.includes('wa.me') && waUrl.includes('Test%20Client') && waUrl.includes('test%40example.com') && waUrl.includes('Wedding') && waUrl.includes('2026-12-12');
console.log('contact form wa.me:', ok ? 'PASS' : 'FAIL', waUrl.slice(0, 110));
await popup.close();

// sitemap includes new routes
const sm = await (await fetch(base + '/sitemap.xml')).text();
console.log('sitemap has /about:', sm.includes('/about'), '| /services:', sm.includes('/services'), '| /contact:', sm.includes('/contact'));

await browser.close();
process.exit(0);
```

Run: `& node 'C:\Users\1040 G8\AppData\Local\Temp\opencode\pages-verify.mjs'`

Expected (all green):
- No `OVERFLOW` lines across 7 routes × 4 widths
- Each route shows a non-null `h1`
- `dead-anchors=0` on all four checked routes; nav shows 8 items on desktop
- Home shows `hasAboutSection: false` and `hasServicesSection: false`
- Contact form: `PASS` (popup URL contains name, email, Wedding, date)
- Sitemap contains all three new paths

---

## Self-Review Notes

- **Spec coverage:** sitemap/nav (Task 1), About page (Task 3), Services page (Task 4), Contact page (Tasks 2+5), homepage conversion (Task 6), data model (Task 1), success criteria (Task 7). All spec sections mapped.
- **Dead-anchor risk** (`#booking` on /services, `#about`/`#services` after conversion) covered in Tasks 4 & 6 and verified in Task 7.
- **Type consistency:** `StatItem`, `ProcessStep`, `ProcessContent`, `AboutContent.stats`, `SiteData.process`, `aboutPageHero`/`servicesPageHero`/`contactPageHero`/`staticRoutes` are defined in Task 1 and consumed with identical names in Tasks 2–5. Icon keys used (`megaphone`, `mic`, `party`) all exist in `iconMap` (`src/components/icons.tsx:110-129`).
