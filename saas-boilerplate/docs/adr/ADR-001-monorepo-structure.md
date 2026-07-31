# ADR-001: Monorepo with Turborepo + pnpm

**Date:** 2026-07-29
**Status:** Accepted

## Context

The SaaS boilerplate needs to share TypeScript types, validation schemas, UI components, and configuration across multiple packages (auth, billing, database, email, storage, analytics). A monorepo enables shared tooling, atomic commits across packages, and consistent dependency management.

## Decision

Use Turborepo for task orchestration with pnpm as the package manager.

## Options Considered

- **Nx** — More powerful, but heavier configuration and steeper learning curve. Overkill for this scope.
- **npm workspaces** — Slower installs, no built-in caching or task orchestration.
- **yarn workspaces** — Similar to pnpm but pnpm has better disk efficiency and stricter dependency isolation.

## Consequences

- **Positive:** Faster installs (pnpm), cached builds (Turborepo), shared config, workspace boundaries
- **Positive:** pnpm's strict dependency isolation prevents phantom dependencies
- **Positive:** Turborepo's parallel execution speeds up CI
- **Negative:** Slightly more complex initial setup than a single-package app
- **Negative:** Team must learn workspace conventions
