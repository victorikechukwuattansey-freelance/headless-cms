# Multi-Tenant Architecture

## Tenant Model

Uses **organization-scoped row-level isolation** (shared database, row-level filtering via organization ID).

```text
Organizations ──► Teams ──► Members (Users)
     │                           │
     │                     ┌─────┴─────┐
     │                     │           │
     ▼                     ▼           ▼
  Subscription          Role       Permission
```

## Data Isolation

Every tenant-aware table includes an `organizationId` column. Cross-tenant access is enforced by:

1. **Middleware** — Resolves org context from session and attaches to request
2. **Repository layer** — All queries filter by `organizationId`
3. **Prisma middleware** — Global filter (future enhancement)

```typescript
// Org context resolved once per request in middleware
interface RequestContext {
  orgId: string;
  userId: string;
  role: Role;
  permissions: string[];
}

// Every query implicitly scoped
async function getProjects(ctx: RequestContext) {
  return prisma.project.findMany({
    where: { organizationId: ctx.orgId },
  });
}
```

## Organization Switching

```text
User switches org
       │
       ▼
Update session org context
       │
       ▼
Clear in-memory caches (org-scoped)
       │
       ▼
Redirect to dashboard
       │
       ▼
All subsequent queries use new orgId
```

## Models with Tenant Context

| Model        | Tenant-aware | Description                      |
| ------------ | ------------ | -------------------------------- |
| User         | No (global)  | User identity exists across orgs |
| Organization | Self         | The tenant root                  |
| Team         | Yes          | Teams scoped to org              |
| Membership   | Yes          | User-org join                    |
| Subscription | Yes          | Org's billing                    |
| Invoice      | Yes          | Org's invoices                   |
| Project      | Yes          | Org-scoped resource              |
| ApiKey       | Yes          | Org-scoped keys                  |

## Cross-Tenant Safety

| Risk                   | Mitigation                                              |
| ---------------------- | ------------------------------------------------------- |
| Missing orgId filter   | TypeScript strict mode, repository pattern, code review |
| URL manipulation       | Server-side authorization on every request              |
| Sharing sensitive data | Audit logging for all data access                       |
| Orphaned data          | Cascade deletes, cleanup jobs                           |
