# Changelog

## Phase 10 — Testing (2026-07-30)

- Set up per-package vitest infrastructure: `vitest.workspace.ts`, 9 per-package `vitest.config.ts` files, `test` scripts added to 10 packages
- Installed vitest as root devDependency
- **@saas/config** — 12 tests: plans structure, pricing, limits, fallback logic, pagination defaults
- **@saas/utils** — 23 tests: cn, formatCurrency, formatDate, formatRelativeTime, generateSlug, generateToken, generateApiKey, truncate, maskEmail, sleep, tryCatch, tryCatchAsync, parseSearchParams, buildQueryString
- **@saas/auth** — 6 tests: all error classes (AuthError, InvalidCredentials, SessionExpired, Unauthorized, Forbidden, EmailNotVerified)
- **@saas/payments** — 4 tests: all billing error classes (BillingError, PaymentFailed, NoActiveSubscription, CustomerNotFound)
- **@saas/storage** — 3 tests: all storage error classes (StorageError, UploadFailed, FileNotFound)
- **@saas/analytics** — 1 test: AnalyticsError class
- **@saas/notifications** — 4 tests: NotificationError, payload type validation, email type, record structure
- **@saas/api** — 11 tests: getPaginationParams (defaults, parsing, clamping), validateBody (valid, invalid), errorResponse, notFoundResponse, unauthorizedResponse, rateLimitResponse
- **@saas/feature-flags** — 1 test: module export verification
- **@saas/web** — 1 test: basic load check

## Phase 9 — Documentation (2026-07-30)

- Root README.md rewritten with full architecture, package map, tech stack, commands
- API reference updated with all auth, billing, checkout, admin, and page routes
- Environment variables documented including provider selection vars
- CHANGELOG.md created

## Phase 8 — Marketing Pages

- Added `loading.tsx`, `error.tsx`, `not-found.tsx` to marketing, dashboard, and admin route groups
- Built `/admin/email-broadcast` page

## Phase 7 — Admin Pages

- Built `/admin/payments` (BillingHistory component from @saas/payments)
- Built `/admin/coupons` page
- Built `/admin/announcements` page

## Phase 6 — Dashboard Pages

- Built `/dashboard/analytics` (consumes @saas/analytics)
- Built `/team/invite` page
- Created `global.d.ts` for window.plausible/gtag types

## Phase 5 — Billing

- `BillingService` interface with `createCheckoutSession`, `getSubscription`, `handleWebhook`
- `StripeBillingAdapter` — full Stripe integration
- `LemonSqueezyBillingAdapter` — complete Lemon Squeezy integration
- Factory with `BILLING_PROVIDER` env var selection
- Typed error classes

## Phase 4 — Auth Implementation

- `/auth/error` page with error code mapping
- `/auth/verify-request` page for magic link confirmation
- Password reset flow: forgot-password API, reset-password API, reset-password/[token] page
- NextAuthAdapter fixes: `switchOrganization()`, `hasPermission()`, `getPermissions()`, `currentOrgId` in JWT/session
- `AuthSession` type updated with `currentOrgId`
- 14/14 packages typecheck clean

## Phase 3.5 — Auth Interface

- `AuthService` interface — `signUp`, `signIn`, `signOut`, `getSession`, `getCurrentUser`, `getCurrentOrganization`, `switchOrganization`, `hasPermission`, `getPermissions`
- `NextAuthAdapter` — NextAuth v5 implementation with JWT callbacks, middleware, all auth pages
- `SupabaseAuthAdapter` — skeleton for future Supabase integration
- Factory with `AUTH_PROVIDER` env var selection
- Backward-compatible export aliases

## Phase 3 — Database

- 4 new models: `Coupon`, `Announcement`, `PasswordResetToken`, `NotificationUserPreference`
- 2 new enums: `NotificationDeliveryType`, `AnnouncementChannel`
- Back-relations on `User` and `Organization`
- 12-file modular seed system in `prisma/seed/` with idempotent helpers
- Domain seeds: users, organizations, memberships, billing plans, feature flags, coupons, announcements, notification prefs

## Phase 2 — Infrastructure

- `Dockerfile` with Prisma generation, standalone output, multi-stage build
- `.dockerignore` excluding unnecessary files
- `docker-compose.yml` for local PostgreSQL
- GitHub Actions CI with pnpm store caching, format/lint/typecheck/test
- `Makefile` with common commands
- Husky + lint-staged pre-commit hooks
- `format` task added to turbo.json
- `next.config.ts` updated with `output: "standalone"`

## Phase 1 — Architecture

- 10 architecture docs in `docs/architecture/`
- 6 ADRs in `docs/adr/`
- Monorepo structure with Turborepo + pnpm workspaces
- Provider abstraction adapter pattern specification
