# ADR-004: Next.js 15 App Router as Full-Stack Framework

**Date:** 2026-07-29
**Status:** Accepted

## Context

The boilerplate needs both a marketing website (SSR, SEO, static pages) and an authenticated dashboard (dynamic, real-time, server actions). Previous generation frameworks required separate frontend and backend projects.

## Decision

Use Next.js 15 App Router as the sole framework, with Server Components by default and Client Components only when interactivity requires it. Route Handlers serve as the API layer alongside Server Actions for mutations.

## Options Considered

- **Remix** — Similar capabilities, but smaller ecosystem. Fewer UI libraries and community resources.
- **Express + React SPA** — More flexible backend, but requires separate API project, CORS configuration, no SSR/SEO without extra tooling.
- **T3 Stack (tRPC)** — Great DX, but couples clients tightly to server. Route Handlers provide similar type safety without the coupling.
- **Pure pages router** — Legacy approach. No streaming, no server components, no parallel routes.

## Consequences

- **Positive:** Single framework for frontend, API, and SSR — no cross-project concerns
- **positive:** Server Components reduce client-side JavaScript by default
- **Positive:** Streaming enables progressive rendering for data-heavy pages
- **Positive:** Route Handlers + Server Actions eliminate the need for a separate API project
- **Positive:** Vercel deployment is optimized for Next.js (edge functions, ISR, automatic optimization)
- **Negative:** Business logic can accidentally leak into presentation layer if discipline isn't maintained
- **Negative:** Server Actions are still evolving — API may change
- **Negative:** Vercel lock-in for optimal deployment (can self-host, but lose edge optimization)
