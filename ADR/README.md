# Architecture Decision Records (ADR)

Repo-wide registry of immutable architecture decisions. ADR files live in the project that owns them; this index registers them all in one place.

## Rules

- ADRs are **immutable** once accepted. Superseded decisions get a new ADR referencing the old one.
- Every significant engineering decision requires an ADR. If in doubt, write one.
- Use `ADR/template.md` for new records.

## Registered ADRs

### SaaS Boilerplate (home: `saas-boilerplate/docs/adr/`)

| # | Title | Status | Date |
|---|---|---|---|
| [ADR-001](./../saas-boilerplate/docs/adr/ADR-001-monorepo-structure.md) | Monorepo with Turborepo + pnpm | Accepted | 2026-07-29 |
| [ADR-002](./../saas-boilerplate/docs/adr/ADR-002-provider-abstraction-pattern.md) | Provider Abstraction via Adapter Pattern | Accepted | 2026-07-29 |
| [ADR-003](./../saas-boilerplate/docs/adr/ADR-003-multi-tenant-data-model.md) | Shared Database with Row-Level Tenant Isolation | Accepted | 2026-07-29 |
| [ADR-004](./../saas-boilerplate/docs/adr/ADR-004-nextjs-app-router.md) | Next.js 15 App Router as Full-Stack Framework | Accepted | 2026-07-29 |
| [ADR-005](./../saas-boilerplate/docs/adr/ADR-005-auth-service-interface.md) | Auth Service Interface with Provider Abstraction | Accepted | 2026-07-29 |
| [ADR-006](./../saas-boilerplate/docs/adr/ADR-006-billing-service-interface.md) | Billing Service Interface with Provider Abstraction | Accepted | 2026-07-29 |

## Registering a new ADR

1. Copy `template.md` to the owning project's `docs/adr/` (or `ADR/` if repo-level).
2. Fill it in, get it accepted, then add a row to this index.
