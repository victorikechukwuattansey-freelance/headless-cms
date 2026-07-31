# Domain Boundaries

## Domain Map

```text
┌─────────────────────────────────────────────────────────────┐
│                        Domain Map                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Identity   │  │   Billing    │  │  Workspace   │      │
│  │  ───────────  │  │  ───────────  │  │  ───────────  │      │
│  │  • User       │  │  • Subscription│ │  • Org        │      │
│  │  • Session    │  │  • Invoice    │  │  • Team       │      │
│  │  • Auth       │  │  • Payment    │  │  • Invitation │      │
│  │  • Permissions│  │  • Plan       │  │  • Member     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           │                                │
│                    ┌──────▼───────┐                        │
│                    │   Platform   │                        │
│                    │  ───────────  │                        │
│                    │  • API       │                        │
│                    │  • Webhooks  │                        │
│                    │  • Audit Log │                        │
│                    │  • Feature   │                        │
│                    │    Flags     │                        │
│                    └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Identity Domain

**Owner:** `packages/auth`

| Entity     | Description                                 |
| ---------- | ------------------------------------------- |
| User       | Core user account (email, name, avatar)     |
| Session    | Authenticated session with token management |
| Identity   | OAuth provider identity link                |
| Credential | Password/hash for email auth                |
| Permission | Granular permission definition              |
| Role       | Named role with permission set              |

## Billing Domain

**Owner:** `packages/billing`

| Entity       | Description                        |
| ------------ | ---------------------------------- |
| Subscription | Active plan with status and period |
| Invoice      | Billing document with line items   |
| Payment      | Payment transaction record         |
| Plan         | Product definition with features   |
| Coupon       | Discount code configuration        |
| Customer     | Billing profile per organization   |

## Workspace Domain

**Owner:** `apps/web` + `packages/database`

| Entity       | Description                     |
| ------------ | ------------------------------- |
| Organization | Tenant — top-level grouping     |
| Team         | Sub-group within organization   |
| Membership   | User-Org join with role         |
| Invitation   | Pending invite to join org/team |

## Platform Domain

**Owner:** Cross-cutting

| Entity       | Description                    |
| ------------ | ------------------------------ |
| ApiKey       | Programmatic access credential |
| AuditLog     | Immutable event record         |
| WebhookEvent | Outbound event delivery        |
| FeatureFlag  | Toggle for gradual rollout     |
| Notification | User notification record       |

## Bounded Context Rules

1. Identity never references Billing entities directly
2. Billing references Identity only through `userId`/`orgId`
3. Workspace is the tenant boundary for all domains
4. Platform domain has cross-domain awareness but no ownership of domain entities
5. Cross-domain communication occurs through domain events
