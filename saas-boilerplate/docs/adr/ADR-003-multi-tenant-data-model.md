# ADR-003: Shared Database with Row-Level Tenant Isolation

**Date:** 2026-07-29
**Status:** Accepted

## Context

The platform must support multiple organizations (tenants) with strict data isolation. Options include separate databases per tenant, separate schemas, or shared database with row-level tenant identification.

## Decision

Use a **shared PostgreSQL database** with row-level tenant isolation via `organizationId` foreign key on every tenant-aware table. Tenant context is resolved once in middleware and enforced at the repository layer.

## Options Considered

- **Database-per-tenant** — Strongest isolation, but operationally complex. Schema migrations must run N times. Connection pooling is harder. Overkill for the majority of SaaS use cases.
- **Schema-per-tenant** — PostgreSQL schemas provide moderate isolation. Migration tooling (Prisma) doesn't support this well.
- **Shared database + `organizationId`** — Simplest operational model. Row-level security (RLS) can be added later at the database level for defense-in-depth.

## Consequences

- **Positive:** Simple operational model — single database, single migration chain
- **Positive:** Easy to query across tenants (admin features, analytics)
- **Positive:** Connection pooling is straightforward
- **Positive:** Can add PostgreSQL Row-Level Security later for database-level enforcement
- **Negative:** Risk of cross-tenant data leakage if `organizationId` filter is forgotten
- **Negative:** Noisy-neighbor problem — one tenant's heavy queries can affect others (mitigated by read replicas, connection pooling, rate limiting)
- **Negative:** Data deletion/export per tenant is more complex (cascading deletes across tables)

## Mitigations

- Repository-layer query methods always accept `orgId` parameter
- Code reviews check for missing `organizationId` filters
- Audit logging on all tenant-scoped data access
- Prisma middleware to warn on missing org filter (future enhancement)
