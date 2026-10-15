# Phase 5A — Authentication + Tenancy — Scope

**Project:** ReconcileKit (Core + Storefront)
**Type:** Track scoping document (planning deliverable — no implementation from this document alone)
**Date:** 2026-10-15
**Baseline authority:** `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` (frozen)
**Parent:** `PHASE_5_OPENING.md` §3 (5A definition)
**Goal sentence:** _make ReconcileKit usable by more than one merchant, with
their data separated and their sessions authenticated._

---

## 1. Scope

5A introduces identity, sessions, and tenancy to the storefront. It is
storefront-only. It does not touch `reconcilekit/src/**`.

Three increments:

| Increment                     | Deliverable                                                                                      | Working state after                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **5A.1** — Identity + session | User store kind, password hashing, session store kind, cookie handling, login/logout routes.     | Identity exists and works. **Every route is still public.** |
| **5A.2** — Tenancy dimension  | `org_id` on `marketplace_customers`, seeded demo org + user, org-aware lookups.                  | Customer data is scoped. **Every route is still public.**   |
| **5A.3** — Route protection   | Session middleware, protected customer and admin routes, redirect to login when unauthenticated. | The goal sentence is satisfied.                             |

5A.1 without 5A.3 is a building block, not a deliverable. 5A.2 without 5A.3
proves the tenancy model works but does not enforce it. Only 5A.3 makes the
track closeable.

## 2. §14 procedure (written out)

### 2.1 Which freeze sections

- **§10** — "Authentication / CSRF" listed as non-goal.
- **§10** — "Tenant/org isolation" listed as non-goal.
- **§5** — Identifier hierarchy (`mk_txn_…` join anchor; external refs evidence-only).
- **§4.5, §7** — Wallet ledger authority and append-only semantics.

### 2.2 Which invariants are touched

The freeze's §5 invariant states that the identifier hierarchy is a fixed set:
`mk_txn_…` for the join anchor, `txn_…` for display, `wld_…` / `ps_…` /
provider refs as evidence. Adding an `org_id` field to `marketplace_customers`
introduces a new identifier dimension. It does not change the meaning of any
existing identifier, but it must be documented as an addition.

The freeze's §4.5 / §7 invariant states that the wallet ledger is
append-only and ledger-authoritative. Adding tenancy must not change this
invariant. §3.2 below explains how it stays intact.

### 2.3 Why the current state is insufficient

The storefront is currently single-tenant with a hard-coded demo identity
(`cus_demo`). Every customer-facing route serves the same customer's data.
Every admin route is unauthenticated. The demo pilot (Phase 3A) explicitly
used this single-tenant surface, and the audit (§22) recorded "no auth, no
tenant isolation" as a known limitation of the pilot, not a defect.

The Phase 5 goal sentence names multi-merchant operation as a requirement for
the first time. The current state cannot satisfy it.

### 2.4 Smallest change

- **One new field** (`org_id`) added to one existing store kind
  (`marketplace_customers`).
- **Four new store kinds** (`users`, `sessions`, `organizations`,
  `memberships`).
- **New auth module** under `storefront/src/auth/` with no external
  dependencies (Node `node:crypto` only).
- **Route protection** added to the existing `routeMarketplace()` handler
  before existing branches.
- **No change** to `reconcilekit/src/**`.
- **No change** to any wallet, ledger, transaction, evidence, or
  reconciliation code path.
  **Runtime dependencies.** 5A.1 introduces the storefront's first runtime
  dependencies: `@node-rs/argon2` (password hashing) and `cookie` (cookie
  parsing). Both are devDependencies-of-nothing and runtime-deps-of-storefront.
  The core package (`reconcilekit/`) remains at one runtime dependency
  (`csv-parse`).

### 2.5 Affected tests and contracts

Tests that will be **updated** (not deleted):

- `storefront/test/marketplace/seed.test.ts` — the seed function must create
  the demo org, user, and customer within one org. Assertions about scenario
  count and idempotency are preserved.
- `storefront/test/marketplace/demo-scenarios.test.ts` — the demo scenarios
  continue to use `cus_demo`, which now belongs to the seeded demo org. All
  16 scenarios remain asserted.
- `storefront/test/marketplace/frontend-walkthrough.test.ts` — every seeded
  HTTP walkthrough now requires a session cookie. Test helpers updated to
  log in first.
- Any test that constructs a `MarketplaceCustomer` directly — a small set,
  updated to include `org_id`.

Tests that will be **added**:

- Login with correct credentials succeeds; wrong password fails.
- Session cookie attributes (`HttpOnly`, `SameSite`, `Path`).
- Protected routes redirect unauthenticated requests to `/login`.
- Protected routes serve content when the session is valid.
- A user in org A cannot read org B's customer, wallet, transactions, or
  findings.

Tests that must remain **unchanged and green**:

- All `reconcilekit/src/**` tests (665 core).
- `storefront/test/marketplace/wallet-lifecycle.test.ts` — specifically
  includes the assertion _"no tenant/org dimension is fabricated on wallet
  evidence."_ §3.2 explains why this stays green.

## 3. Design decisions

### 3.1 Identity

**Store kind: `users`.**

```ts
interface UserRecord {
  readonly id: string; // usr_<token>
  readonly email: string; // normalized lowercase
  readonly password_hash: string; // PHC-like string, see §3.3
  readonly display_name: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly simulated: true;
}
```

Password hashing: **`@node-rs/argon2`** (Argon2id). The `@node-rs` build ships
prebuilt binaries for `linux-x64-gnu` and `win32-x64-msvc`; `npm ci` does not
compile anything. This is the storefront's first runtime dependency.

Parameters (OWASP 2024 minimum for Argon2id):
`m=19456` (19 MiB), `t=2`, `p=1`, 16-byte salt, 32-byte output.
Encoded as a standard PHC string: `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`.

`display_name` is a human label only, never used for authorization.

### 3.2 Tenancy

**New store kinds: `organizations`, `memberships`.**

```ts
interface OrganizationRecord {
  readonly id: string; // org_<token>
  readonly name: string;
  readonly created_at: string;
  readonly simulated: true;
}

interface MembershipRecord {
  readonly id: string; // mem_<token>
  readonly user_id: string;
  readonly org_id: string;
  readonly role: "OWNER" | "OPERATOR" | "VIEWER";
  readonly created_at: string;
  readonly simulated: true;
}
```

**One existing kind changes: `marketplace_customers` gains `org_id: string`.**

This is the only schema change to an existing kind. The rationale for
choosing this over "add `org_id` to every kind":

- The `MarketplaceCustomer` is the entry point for every customer-scoped
  operation in the storefront. Wallet, orders, transactions, ledger entries,
  and evidence all reference a customer.
- Scoping at the customer level means every existing kind is scoped
  _transitively_: to reach any record, you go through a customer whose
  `org_id` you already validated.
- The alternative — adding `org_id` to `wallet_ledger`, `payments`, etc. —
  would break the _"no tenant/org dimension is fabricated on wallet
  evidence"_ test. That test asserts an invariant the freeze cares about:
  wallet evidence does not invent a tenant dimension. Keeping tenancy at the
  customer level preserves this invariant exactly.

**Why this does not violate §5:** the identifier hierarchy still holds. No
existing identifier's meaning changes. `org_id` is a new dimension attached
to one kind, not a change to the join anchor or the evidence rules.

**Why this does not violate §4.5 / §7:** the wallet ledger is unchanged. Its
authority, append-only semantics, and row shape are identical. The tenancy
dimension is accessible only through the customer lookup that precedes any
wallet access, not baked into ledger rows.

### 3.3 Sessions

**Store kind: `sessions`.**

```ts
interface SessionRecord {
  readonly id: string; // sess_<token>
  readonly user_id: string;
  readonly active_org_id: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly simulated: true;
}
```

**Mechanism: opaque random session ID, server-side lookup.**

Session ID is 32 random bytes encoded as base64url. It is **not** a JWT,
**not** signed, and **not** self-describing. It is a random pointer into the
` sessions` store.

Rationale: signed-token approaches add a cryptographic dependency and a
revocation problem. The storefront already has a store; using it for sessions
is the smallest change and provides revocation for free (delete the record).

**Cookie: `rk_session`.** Attributes:

- `HttpOnly` — always.
- `SameSite=Lax` — sufficient for the current same-origin form POSTs.
- `Path=/` — the whole surface.
- `Secure` — configurable, see §3.6.
- `Max-Age` — matches session TTL.

No CSRF token is introduced in 5A. The combination of `SameSite=Lax` and
form-encoded POSTs covers the current attack surface. Adding CSRF tokens is a
5A.4 increment if the admin surface expands.

### 3.4 Active org on the session

A user may belong to multiple orgs. A session carries one `active_org_id`. A
future "org switcher" would just update this field. For 5A, the seed creates
exactly one org per user; the switcher is not implemented.

### 3.5 Demo identity replacement

The current `DEMO_CUSTOMER_ID = "cus_demo"` and the `demo@example.com` login
page are preserved:

- The seed function creates one demo org (`org_demo`), one demo user
  (`usr_demo`, email `demo@example.com`, password `demo-password`), and one
  membership (role `OWNER`).
- The existing `cus_demo` customer is created **within** `org_demo`.
- Every existing demo scenario continues to reference `cus_demo` unchanged.
- The login page shows the demo credentials as defaults, same as today.

This means the 16 demo scenarios and the seeded HTTP walkthrough keep working
with minimal test changes: the walkthrough test's helper logs in as
`demo@example.com` before fetching any protected route.

Demo credentials are test fixtures, not production secrets. They are
recorded in the seed and in the test suite. `PHASE_5A_AUTH_TENANCY_SCOPE.md`
does not authorize shipping these credentials in a production build; see §6.

### 3.6 Configuration additions

Three new env variables, all with defaults:

| Variable                         | Default      | Purpose                                                    |
| -------------------------------- | ------------ | ---------------------------------------------------------- |
| `STOREFRONT_SESSION_COOKIE_NAME` | `rk_session` | Cookie name                                                |
| `STOREFRONT_SESSION_TTL_HOURS`   | `72`         | Session lifetime in hours                                  |
| `STOREFRONT_COOKIE_SECURE`       | unset (off)  | `1` / `true` / `yes` forces `Secure` on the session cookie |

The `Secure` default is off because the local demo runs on `http://`. A
production deployment sets `STOREFRONT_COOKIE_SECURE=1`. This follows the
existing pattern of `STOREFRONT_SEED_DEMO`.

### 3.7 Cookie parsing

The storefront's `node:http` server does not currently parse cookies. 5A.1
adds `storefront/src/auth/cookies.ts` — a thin wrapper around the **`cookie`**
npm package (1.5 kB, zero deps). Handles RFC 6265 quoted values and encoding.
Malformed cookie headers are swallowed, not rejected.

### 3.8 New auth module

New directory: `storefront/src/auth/`.

| File            | Responsibility                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `passwords.ts`  | `hashPassword`, `verifyPassword`. Uses `node:crypto.scrypt`.                                                                 |
| `sessions.ts`   | `createSession`, `lookupSession`, `revokeSession`. Uses `sessions` store kind.                                               |
| `cookies.ts`    | Cookie parsing and formatting. Pure functions.                                                                               |
| `identity.ts`   | `loginUser`, `registerUser`, `getUserByEmail`, `listMembershipsForUser`.                                                     |
| `middleware.ts` | `requireSession(req, store)` — parses cookie, looks up session, validates TTL, returns `{ session, user, orgId }` or `null`. |

No dependency on `storefront/src/marketplace/`. The auth module is a peer of
the marketplace, not a child. This preserves the existing storefront layering.

### 3.9 Route protection

Three categories of routes:

- **Public:** `/login`, `/assets/*`, `/health`.
- **Session-required (customer):** everything else under `/` that serves a
  customer-facing page.
- **Session-required (admin):** everything under `/admin/*`. In 5A.3, any
  authenticated session reaches admin routes; role-based gating is a 5A.4
  increment.

Protection is added at the top of `routeMarketplace()`: if the path is not
public and `requireSession()` returns null, redirect to `/login`. If the
path is `/admin/*`, require a membership in the current org with role
`OWNER` or `OPERATOR`. Role gating is stubbed as "any membership" in 5A.3
and refined in 5A.4.

Logout is `POST /logout`, revokes the session record, clears the cookie,
redirects to `/login`.

### 3.10 Route additions

New routes in `routeMarketplace()`:

| Method | Path      | Purpose                                                   |
| ------ | --------- | --------------------------------------------------------- |
| `GET`  | `/login`  | Login form (replaces the current placeholder).            |
| `POST` | `/login`  | Verify credentials, create session, set cookie, redirect. |
| `POST` | `/logout` | Revoke session, clear cookie, redirect.                   |

The current `/login` route already exists and returns a placeholder page. It
is replaced by a real form in 5A.1.

## 4. Increment plan

### 5A.1 — Identity + session (bounded)

**Deliverable:** a user can log in, a session is created and stored, a cookie
is set, logout revokes the session. **No route is protected yet.**

Files added:

- `storefront/src/auth/{passwords,sessions,cookies,identity,middleware}.ts`
- `storefront/test/auth/{passwords,sessions,cookies}.test.ts`

Files modified:

- `storefront/src/marketplace/types.ts` — add `UserRecord`, `SessionRecord`.
- `storefront/src/config.ts` — add three env variables.
- `storefront/src/server.ts` — login/logout routes; cookie parsing in the
  request pipeline.
- `storefront/src/ui/customer-pages.ts` — login form.
- `storefront/src/store/jsonl-store.ts` — register new kinds.

**Gate:** login flow works end to end; sessions persist across restarts;
logout revokes; all 677+existing tests still pass.

### 5A.2 — Tenancy dimension (bounded)

**Deliverable:** customers belong to orgs. **No route is protected yet.**

Files added:

- `storefront/test/marketplace/tenancy.test.ts`

Files modified:

- `storefront/src/marketplace/types.ts` — add `org_id` to
  `MarketplaceCustomer`, add `OrganizationRecord`, `MembershipRecord`.
- `storefront/src/marketplace/seed.ts` — create demo org, demo user, demo
  membership; place `cus_demo` inside `org_demo`.
- `storefront/src/ui/client.ts` — every lookup for a customer validates
  `org_id` against a supplied org context.
- `storefront/src/server.ts` — pass the session's `active_org_id` to the
  view-model layer.
- Existing tests that construct `MarketplaceCustomer` — add `org_id`.

**Gate:** all existing tests pass; the _"wallet lifecycle: no tenant/org
dimension is fabricated on wallet evidence"_ test remains green;
cross-org access is refused at the view-model layer (proven by a new test).

### 5A.3 — Route protection (bounded)

**Deliverable:** the goal sentence is satisfied.

Files modified:

- `storefront/src/server.ts` — protection at the top of `routeMarketplace()`.
- `storefront/src/ui/layout.ts` — a "signed in as" indicator; a logout link.
- Test helpers that fetch seeded HTTP routes — log in first.
- `storefront/test/marketplace/frontend-walkthrough.test.ts` — helper
  updated; assertions unchanged.

Files added:

- `storefront/test/auth/route-protection.test.ts`

**Gate:** all four standing guards green; the goal sentence's three
requirements (more than one merchant, data separated, sessions authenticated)
are each proven by a test; the seeded 16-scenario suite continues to pass
with the demo credentials.

## 5. Standing guard

After every 5A increment:

- Root tests: no regressions from **677/677**.
- Storefront tests: no regressions from **464/464**.
- Both typechecks: PASS.
- ESLint: PASS.
- Prettier `format:check`: PASS.
- CI: green on `ubuntu-latest`.
- Consumer smoke test: PASS (5A does not touch the core, but the smoke test
  is cheap and its failure would indicate an unintended change).

## 6. What 5A does not authorize

- **Real password recovery.** Password reset, email delivery, and account
  recovery are out of scope.
- **OAuth / social login.** Out of scope.
- **Role-based gating beyond the three roles' existence.** In 5A.3, any
  membership reaches admin routes; role semantics are a 5A.4 follow-up.
- **CSRF tokens.** Covered by `SameSite=Lax` for the current surface; a
  dedicated token scheme is a 5A.4 follow-up.
- **Rate limiting.** Not scoped.
- **Real production credentials.** The demo user's credentials are test
  fixtures. A production deployment must not ship them; that is a deployment
  concern, not a code concern, and it is out of scope for 5A.
- **Any change to `reconcilekit/src/**`.**
- **Any change to the wallet ledger, the matcher, the identifier hierarchy,
  or the reconciliation engine.**
- **3F (durable persistence).** 5B opens after 5A lands; 5A works against
  the existing `JsonlStore`.

## 7. Status

**PHASE 5A SCOPED — three increments defined (identity, tenancy, route
protection). §14 procedure written. Design decisions recorded: scrypt hashing
with zero new dependencies, opaque server-side sessions, tenancy attached at
the customer boundary to preserve the wallet evidence invariant. Next
artifact: the 5A.1 implementation.**

Implementation begins only after this scope is agreed. Each increment lands
as its own commit with its own guard verification. No increment crosses a
frozen boundary that the scope has not already documented.
