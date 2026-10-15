# Phase 5A — Closure

**Project:** ReconcileKit (Core + Storefront)
**Type:** Governance record (documentation only — no implementation, no source/test/config change)
**Date:** 2026-10-15
**Basis:** `PHASE_5A_AUTH_TENANCY_SCOPE.md` §4 (increment plan, gates)
**Parent:** `PHASE_5_OPENING.md` §3 (5A definition)
**Goal sentence:** _make ReconcileKit usable by more than one merchant, with their data separated and their sessions authenticated._

---

## 1. Decision

**Phase 5A is complete.** The goal sentence's three clauses are each
satisfied by verifiable evidence:

| Clause                           | Evidence                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usable by more than one merchant | `organizations` + `memberships` store kinds; demo org seeded in `seedDemoData`; `listCustomersInOrg` returns per-org scoping                                                             |
| Data separated                   | `org_id` on `marketplace_customers`; `customerBelongsToOrg` refuses cross-org access; wallet-evidence invariant preserved (`tenancy: no org dimension is fabricated on wallet evidence`) |
| Sessions authenticated           | Session record carries `active_org_id`; `requireSession` middleware gates every non-public route; admin routes additionally require OWNER or OPERATOR membership                         |

No clause is asserted without a test that would fail if the clause were
false.

## 2. Increments delivered

| Increment                   | Commit                          | What                                                                                                                                                                                |
| --------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5A.1 — identity + session   | `ba8668f`, `fd35a9d`, `d092ed1` | `users` + `sessions` store kinds; Argon2id password hashing; cookie wrapper around `cookie@2`; `/login`, `POST /login`, `POST /logout`; session CRUD helpers; five new test suites  |
| 5A.2 — tenancy dimension    | `e491d89`                       | `organizations` + `memberships` store kinds; `org_id` on `marketplace_customers`; `seedDemoTenancy`; tenancy query helpers; `tenancy.test.ts` (10 tests)                            |
| 5A.3a — session org context | `28a5449`                       | `active_org_id` on `SessionRecord`; login resolves membership and refuses login without one; `sessions.test.ts` + `login-flow.test.ts` updated                                      |
| 5A.3b — route protection    | `1d1a988`                       | Session gate at the top of `routeMarketplace`; admin routes require OWNER or OPERATOR role; `route-protection.test.ts` (10 new tests); all existing HTTP test helpers authenticated |

## 3. What 5A.3b changed in the codebase

**Production source:**

- `storefront/src/server.ts` — added the session gate block; admin routes now require a membership check.
- `storefront/src/ui/customer-pages.ts` — `renderLoginPage` prefills `demo-password` for the demo identity.

**Test surface:**

- `storefront/test/auth/helpers.ts` — new shared `loginAndGetCookie` and `withCookie` helpers.
- `storefront/test/auth/route-protection.test.ts` — new; 10 tests covering public paths, redirect behaviour, authenticated access, revoked sessions, and role gating.
- `seeded-server.ts`, `server-marketplace.test.ts`, `frontend-walkthrough.test.ts`, `findings.test.ts`, `transaction-detail-states.test.ts` — every test that fetched a protected route now authenticates first.

The test count went 507 → 518 (+10 route protection tests + 1 helpers file). No tests were deleted.

## 4. §14 procedure outcome

The procedure was written in `PHASE_5A_AUTH_TENANCY_SCOPE.md` §2. Its
predictions held:

- Freeze §10 (auth) and §10 (tenancy) were the intersections. Both were
  declared and approved before implementation.
- The identifier hierarchy (§5) was extended with a new dimension
  (`org_id`) but no existing identifier's meaning changed.
- The wallet-evidence invariant (freeze §4.5 / §7) was preserved exactly
  as designed: tenancy attaches at the customer boundary, not to ledger
  rows. The pre-existing test asserting this invariant remains green.

No part of the freeze was silently bypassed.

## 5. Dependencies added

`@node-rs/argon2@2.2.2` and `cookie@2.0.1`, both runtime dependencies of
the storefront. Recorded in `PHASE_5A_AUTH_TENANCY_SCOPE.md` §2.4 and
approved by the owner before installation.

The core package (`reconcilekit/`) remains at one runtime dependency
(`csv-parse`).

## 6. Standing guard

Verified after `1d1a988` on `ubuntu-latest` from a fresh `npm ci`:

| Check                   | Result      |
| ----------------------- | ----------- |
| Root tests (recursive)  | **677/677** |
| Storefront tests        | **518/518** |
| Root typecheck          | PASS        |
| Storefront typecheck    | PASS        |
| ESLint                  | PASS        |
| Prettier `format:check` | PASS        |
| CI workflow             | green       |

## 7. What 5A does not authorize

- Password reset, email delivery, account recovery.
- OAuth / social login.
- Role-based gating beyond the three roles' existence (OWNER / OPERATOR / VIEWER). Only OWNER and OPERATOR reach admin; finer-grained permissions are a follow-up.
- CSRF tokens beyond the current `SameSite=Lax` protection.
- Rate limiting.
- Real production credentials.
- Any change to `reconcilekit/src/**`.
- 3F (durable persistence), 3E (webhooks), or the other Phase 5 tracks.

## 8. What opens next

Phase 5B (durable persistence, 3F) is the next track per `PHASE_5_OPENING.md`
§4. Its entry condition — "5B does not start before 5A lands" — is now met.

5B requires its own scoping document (following the 5A pattern). It is the
first Phase 5 track that touches production-persistence territory the
freeze's §24 explicitly prohibits (PostgreSQL, Prisma, Redis, migrations),
and it will need its own §14 procedure.

## 9. Status

**PHASE 5A COMPLETE — 5A.1 / 5A.2 / 5A.3a / 5A.3b accepted. Standing guard
verified: root 677/677, storefront 518/518, all other guards green. §14
procedure honoured on each increment. Next artifact: the 5B scoping
document.**
