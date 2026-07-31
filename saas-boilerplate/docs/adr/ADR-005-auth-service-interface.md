# ADR-005: Auth Service Interface with Provider Abstraction

**Date:** 2026-07-29
**Status:** Accepted
**Phase:** 3.5 — Authentication Architecture

## Context

The existing authentication system used NextAuth v5 directly throughout the application. While functional, this created tight coupling to NextAuth's SDK. The constitution requires that "application code must never call vendor SDKs directly" and authentication must support multiple providers (NextAuth, Supabase Auth, Clerk, Auth0) through a provider-agnostic adapter pattern.

## Decision

Wrap all authentication logic behind an `AuthService` interface defined in `packages/auth/src/service.ts`. Providers implement this interface as adapters. A factory selects the active adapter via `AUTH_PROVIDER` environment variable.

## Architecture

```
packages/auth/src/
  service.ts          AuthService interface (public contract)
  types.ts            Domain models + error classes
  factory.ts          createAuthService() — selects active adapter
  index.ts            Public API (re-exports adapter + service)
  adapters/
    nextauth/         NextAuthAdapter (existing providers)
    supabase/         SupabaseAuthAdapter (placeholder)
```

## Key Design Decisions

| Decision               | Choice                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service contract       | `AuthService` interface covering session, sign in/out, registration, passwords, organizations, permissions                                         |
| Adapter instantiation  | Factory pattern selected by `AUTH_PROVIDER` env var                                                                                                |
| Backward compatibility | `handlers`, `auth`, `signIn`, `signOut` re-exported from NextAuth adapter                                                                          |
| Error model            | Typed error classes: `AuthError`, `InvalidCredentialsError`, `SessionExpiredError`, `UnauthorizedError`, `ForbiddenError`, `EmailNotVerifiedError` |
| Domain models          | `AuthUser`, `AuthSession`, `Organization`, `Credentials`, `SignUpData` — provider-agnostic                                                         |

## Current Adapters

- **NextAuthAdapter** (default) — Full implementation wrapping existing NextAuth v5 config with GitHub, Google, Discord, Microsoft, Resend, Credentials providers
- **SupabaseAuthAdapter** — Skeleton, all methods throw "not yet implemented"

## Consequences

- **Positive:** Adding Clerk or Auth0 requires only a new adapter file — no application code changes
- **Positive:** Future provider SDK migrations are isolated to one adapter
- **Positive:** Testing can mock `AuthService` instead of mocking NextAuth internals
- **Positive:** All existing `import { auth } from "@saas/auth"` calls continue to work unchanged
- **Negative:** One extra indirection layer — debug traces go through adapter before reaching vendor SDK
- **Negative:** Interface must evolve as new auth capabilities are needed
