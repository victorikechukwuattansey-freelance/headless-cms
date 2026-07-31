# Phase 3 — Database Schema & Seed

## Objective

Add missing Prisma models needed by admin pages and auth flow, then expand the seed system into a modular, idempotent directory structure.

## New Models

### Coupon

```prisma
model Coupon {
  id                String   @id @default(cuid())
  code              String   @unique @db.VarChar(50)
  description       String?
  discountPercent   Float?
  discountAmount    Int?     @map("discount_amount_cents")
  currency          String   @default("usd") @db.VarChar(3)
  maxRedemptions    Int?     @map("max_redemptions")
  usedCount         Int      @default(0) @map("used_count")
  maxRedemptionsPerUser Int? @default(1) @map("max_redemptions_per_user")
  minAmount         Int?     @map("min_amount_cents")
  startsAt          DateTime? @map("starts_at")
  expiresAt         DateTime? @map("expires_at")
  isActive          Boolean  @default(true) @map("is_active")
  organizationId    String?  @map("organization_id")
  deletedAt         DateTime? @map("deleted_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([code])
  @@index([organizationId])
  @@index([isActive])
  @@map("coupons")
}
```

### Announcement

```prisma
enum AnnouncementChannel {
  IN_APP
  EMAIL
  BOTH
}

model Announcement {
  id          String             @id @default(cuid())
  title       String             @db.VarChar(255)
  body        String             @db.Text
  channel     AnnouncementChannel @default(IN_APP)
  targetRole  UserRole?
  publishedAt DateTime?          @map("published_at")
  scheduledAt DateTime?          @map("scheduled_at")
  createdById String             @map("created_by_id")
  deletedAt   DateTime?          @map("deleted_at")
  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")

  createdBy User @relation(fields: [createdById], references: [id])

  @@index([publishedAt])
  @@index([channel])
  @@map("announcements")
}
```

### PasswordResetToken

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  email     String    @db.VarChar(255)
  token     String    @unique @db.VarChar(255)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([email])
  @@index([token])
  @@map("password_reset_tokens")
}
```

### NotificationUserPreference

```prisma
enum NotificationDeliveryType {
  IN_APP
  EMAIL
  WEBHOOK
}

model NotificationUserPreference {
  id        String                     @id @default(cuid())
  userId    String                     @map("user_id")
  channel   NotificationChannel
  types     NotificationDeliveryType[]
  enabled   Boolean                    @default(true)
  createdAt DateTime                   @default(now()) @map("created_at")
  updatedAt DateTime                   @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, channel])
  @@map("notification_user_preferences")
}
```

Note: `NotificationDeliveryType` enum in `@saas/notifications` currently uses `"in_app" | "email" | "webhook"` — the database enum uses `IN_APP | EMAIL | WEBHOOK` per Prisma convention.

## Seed System

### Directory Structure

```
prisma/
├── seed.ts              # Orchestrator
└── seed/
    ├── index.ts         # Re-exports all seed functions
    ├── helpers.ts       # Shared utilities (idempotent create)
    ├── users.ts         # 4 users (admin, test, jane, bob)
    ├── organizations.ts # 2 orgs with memberships
    ├── subscriptions.ts # 2 subscriptions (Pro, Free)
    ├── invoices.ts      # 5 invoices across orgs
    ├── notifications.ts # 3 notifications
    ├── api-keys.ts      # 2 API keys
    ├── audit-logs.ts    # 6 audit log entries
    ├── feature-flags.ts # 5 feature flags (moved from seed.ts)
    └── billing-history.ts # 5 billing history entries
```

### Data

| Entity                | Records | Details                                                                                        |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Users                 | 4       | admin@saas.com (SUPER_ADMIN), user@saas.com (USER), jane@saas.com (ADMIN), bob@saas.com (USER) |
| Orgs                  | 2       | Acme Corp (Pro, owned by admin), Beta Testers Inc (Free, owned by Jane)                        |
| Memberships           | 4       | admin→Acme OWNER, user→Acme MEMBER, jane→Beta OWNER, bob→Beta MEMBER                           |
| Subscriptions         | 2       | Acme→Stripe Pro monthly, Beta→(none — Free tier)                                               |
| Invoices              | 5       | Acme: 3 paid, 1 pending; Beta: 1 overdue                                                       |
| Notifications         | 3       | user@saas.com: billing, system, product channels                                               |
| API Keys              | 2       | user@saas.com: Production, Development                                                         |
| Audit Logs            | 6       | user created, org created, user invited, settings updated, payment processed, API key created  |
| Feature Flags         | 5       | ai-features, advanced-analytics, team-collaboration, api-access, white-label                   |
| Billing History       | 5       | Various payment/refund events across orgs                                                      |
| Coupons               | 2       | LAUNCH20 (20% off, no org), TEAM50 (50% off, org-scoped)                                       |
| Announcements         | 2       | One published, one scheduled                                                                   |
| Password Reset Tokens | 0       | (created only when users request reset)                                                        |

## Changes to package.json

The `prisma.seed` path in `packages/database/package.json` currently points to `../../prisma/seed.ts`. This stays the same — the entry point file path doesn't change, only the internals become modular.

## Acceptance Criteria

- `pnpm db:generate` produces updated Prisma client with new models
- `pnpm db:seed` runs all seed modules idempotently (safe to re-run)
- `pnpm typecheck` passes across all 14 packages
- New models are queryable from any package via `@saas/database` (`prisma.coupon`, `prisma.announcement`, etc.)
