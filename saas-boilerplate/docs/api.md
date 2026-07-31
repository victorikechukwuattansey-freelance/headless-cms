# API Reference

All API routes (except auth pages and webhooks) require authentication via session cookie or API key (`x-api-key` header / `Authorization: Bearer <key>`).

## Authentication

| Method | Route                       | Description                                          |
| ------ | --------------------------- | ---------------------------------------------------- |
| POST   | `/api/auth/register`        | Register a new user                                  |
| POST   | `/api/auth/login`           | Sign in with email/password                          |
| GET    | `/api/auth/session`         | Get current session                                  |
| POST   | `/api/auth/signout`         | Sign out                                             |
| POST   | `/api/auth/forgot-password` | Request password reset (sends email if email exists) |
| POST   | `/api/auth/reset-password`  | Reset password with token + new password             |

### Password Reset Flow

1. User submits email to `POST /api/auth/forgot-password` (always returns 200)
2. If email exists, a `PasswordResetToken` is created (1-hour expiry) and emailed via Resend
3. User clicks link → `/auth/reset-password/[token]` page
4. User submits new password to `POST /api/auth/reset-password`
5. Token is validated (exists, not expired, not used), password is bcrypt-hashed and saved

## User

| Method | Route               | Description                                        |
| ------ | ------------------- | -------------------------------------------------- |
| PATCH  | `/api/user/profile` | Update user profile (authenticated)                |
| POST   | `/api/user/delete`  | Delete user account (authenticated + confirmation) |

## Organizations

| Method | Route                | Description               |
| ------ | -------------------- | ------------------------- |
| GET    | `/api/organizations` | List user's organizations |
| POST   | `/api/organizations` | Create organization       |

## Team

| Method | Route              | Description                             |
| ------ | ------------------ | --------------------------------------- |
| POST   | `/api/team/invite` | Invite team member (ADMIN/OWNER in org) |

## Billing / Checkout

| Method | Route                         | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/api/checkout`               | Create Stripe checkout session |
| POST   | `/api/webhooks/stripe`        | Stripe webhook handler         |
| POST   | `/api/webhooks/lemon-squeezy` | Lemon Squeezy webhook handler  |

## Admin

| Method   | Route                        | Description                   |
| -------- | ---------------------------- | ----------------------------- |
| GET/POST | `/api/admin/coupons`         | Coupon management             |
| GET/POST | `/api/admin/announcements`   | Announcement management       |
| POST     | `/api/admin/email-broadcast` | Send email broadcast to users |
| GET      | `/api/admin/payments`        | List billing history          |

## Page Routes

| Route                          | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `/auth/login`                  | Sign in (email/password + OAuth providers)     |
| `/auth/register`               | Create account                                 |
| `/auth/forgot-password`        | Request password reset                         |
| `/auth/reset-password/[token]` | Set new password                               |
| `/auth/error`                  | Auth error display (error code → user message) |
| `/auth/verify-request`         | Post-magic-link confirmation                   |
| `/dashboard`                   | Main dashboard                                 |
| `/dashboard/analytics`         | Analytics dashboard                            |
| `/dashboard/settings`          | User settings                                  |
| `/team/invite`                 | Invite team members                            |
| `/admin`                       | Admin overview                                 |
| `/admin/users`                 | User management                                |
| `/admin/payments`              | Payment history                                |
| `/admin/coupons`               | Coupon management                              |
| `/admin/announcements`         | Announcement management                        |
| `/admin/email-broadcast`       | Email broadcast                                |
| `/admin/audit-log`             | Audit log viewer                               |
| `/admin/feature-flags`         | Feature flag management                        |
