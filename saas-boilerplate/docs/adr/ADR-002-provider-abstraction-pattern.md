# ADR-002: Provider Abstraction via Adapter Pattern

**Date:** 2026-07-29
**Status:** Accepted

## Context

The boilerplate must support multiple auth providers (NextAuth, Supabase Auth, Clerk), payment providers (Stripe, Lemon Squeezy), storage providers (UploadThing, S3), and more. Direct vendor SDK coupling would make providers difficult to swap and create vendor lock-in.

## Decision

Every external service uses an **Adapter + Factory** pattern. A stable TypeScript interface defines the service contract. Each provider implements the interface. A factory selects the active adapter via environment configuration.

## Options Considered

- **Direct SDK usage** — Fastest initial implementation. Impossible to swap providers later without refactoring all consumers.
- **Abstract base class** — Similar to interfaces, but inheritance creates tighter coupling than interface contracts.
- **Dependency injection container** — More flexible, but adds complexity with marginal benefit for this scope.

## Consequences

- **Positive:** Adding a new provider requires only a new adapter file — zero changes to application code
- **Positive:** Service interfaces serve as clear documentation of capabilities
- **Positive:** Testing is easier — can mock the interface instead of mocking vendor SDKs
- **Positive:** Vendor SDK upgrades or breaking changes are isolated to one adapter file
- **Negative:** Slightly more boilerplate per provider (interface + adapter + factory wiring)
- **Negative:** Interface must be designed well upfront to avoid churn
