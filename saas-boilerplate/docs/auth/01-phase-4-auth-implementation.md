# Phase 4 — Auth Implementation

## Objective

Plug remaining gaps in the auth system: missing pages, password reset flow, adapter stubs, and admin API guards.

## Missing Pages

### `/auth/error`

Reads `error` query param, maps error codes to user-friendly messages. Handles: `OAuthAccountNotLinked`, `OAuthSignin`, `OAuthCallback`, `CredentialsSignin`, `AccessDenied`, `Verification`, `Default`. Uses same `Card` layout as login/register.

### `/auth/verify-request`

Shown after magic link / resend email is sent. Message: "Check your email — a sign-in link has been sent." Links back to login.

## Password Reset Flow

### API: `POST /api/auth/forgot-password`

Accepts `{ email }`. Validates with Zod. Finds user by email. Creates `PasswordResetToken` with crypto random token, 1-hour expiry. Sends email via Resend (or logs in dev). Always returns 200 (don't reveal whether email exists).

### Page: `/auth/reset-password/[token]`

Two states:

- **Token valid**: Shows new password form (password + confirm). Submits to `POST /api/auth/reset-password`.
- **Token invalid/expired**: Shows error message with link to request new reset.

### API: `POST /api/auth/reset-password`

Accepts `{ token, password }`. Validates with Zod (min 8 chars). Finds token, checks expiry and `usedAt`. Updates `user.passwordHash` with bcrypt. Marks token as used. Returns 200.

### Updated: `/auth/forgot-password`

Replace `signIn("resend")` with `fetch("/api/auth/forgot-password")`. Same UI otherwise.

## Adapter Fixes

### `switchOrganization(orgId)`

- Add `currentOrgId` to JWT token via `jwt` callback (update `next-auth.d.ts`)
- Add `currentOrgId` to session via `session` callback
- `getCurrentOrganization()` reads `session.currentOrgId` and queries org
- `switchOrganization(orgId)` updates the JWT token via `update()` (NextAuth v5 session update)

### `hasPermission(permission)`

Define permission map:

```
SUPER_ADMIN → all
ADMIN → users:read, users:write, billing:read, billing:write, settings:read, settings:write
USER → settings:read
```

Check via `session.user.role` lookup.

### `getPermissions()`

Return array from permission map based on current role.

## Admin API Guards

Add `auth()` check + role validation to existing API routes:

| Route                     | Operation      | Guard                              |
| ------------------------- | -------------- | ---------------------------------- |
| `POST /api/organizations` | Create org     | Any authenticated user             |
| `POST /api/team/invite`   | Invite member  | Authenticated + ADMIN/OWNER in org |
| `POST /api/user/profile`  | Update profile | Authenticated user                 |
| `POST /api/user/delete`   | Delete account | Authenticated user + confirmation  |

## Files Changed

| File                                                    | Action                                             |
| ------------------------------------------------------- | -------------------------------------------------- |
| `apps/web/src/app/auth/error/page.tsx`                  | Create                                             |
| `apps/web/src/app/auth/verify-request/page.tsx`         | Create                                             |
| `apps/web/src/app/auth/reset-password/[token]/page.tsx` | Create                                             |
| `apps/web/src/app/api/auth/forgot-password/route.ts`    | Create                                             |
| `apps/web/src/app/api/auth/reset-password/route.ts`     | Create                                             |
| `apps/web/src/app/auth/forgot-password/page.tsx`        | Edit — wire real API call                          |
| `packages/auth/src/adapters/nextauth/index.ts`          | Edit — switchOrganization, permissions, JWT update |
| `packages/auth/src/next-auth.d.ts`                      | Edit — add currentOrgId to JWT/Session             |
| `apps/web/src/app/api/organizations/route.ts`           | Edit — add role guard                              |
| `apps/web/src/app/api/team/invite/route.ts`             | Edit — add membership role check                   |
| `apps/web/src/app/api/user/profile/route.ts`            | Edit — add auth guard                              |
| `apps/web/src/app/api/user/delete/route.ts`             | Edit — add auth guard                              |
