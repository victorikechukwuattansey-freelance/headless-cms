# Phase 5 — Opening

**Project:** ReconcileKit (Core + Storefront)
**Type:** Phase scoping document (planning deliverable — no implementation from this document alone)
**Date:** 2026-10-14
**Baseline authority:** `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` (frozen)
**Predecessor:** `PHASE_4_CLOSURE.md`
**Decision:** Phase 5 opens four tracks — 5A (auth + tenancy), 5B (durable
persistence / 3F), 5C (webhooks / 3E), 5D (second PSP adapter). Billing and
FX remain deferred and are not scoped by this document.

---

## 1. Goal

Phase 5 answers three questions Phase 3 and Phase 4 deliberately deferred:

1. **Multi-merchant operation.** Can ReconcileKit be used by more than one
   merchant, with data separated per tenant and sessions authenticated?
2. **Production operator.** Can a production operator run the storefront
   against real Paystack events — durable across restarts, driven by webhook
   delivery, without manual polling?
3. **Adapter boundary proven.** Can a second payment provider be added to the
   core without changing the domain, the matcher, or the identifier hierarchy?

Phase 5 is the first phase that opens a majority of the freeze's §10
deferred list. Every track below intersects the freeze and follows the §14
architecture-change procedure.

## 2. Why these, why now

Phase 3 proved the reconciliation engine works in real operator hands. Phase 4
proved the core is distributable. Phase 5 is the first phase to make the
_storefront_ fit for production — the surface Phase 3 and Phase 4 both left as
a demonstration pilot.

The two deferrals this phase keeps (billing, FX) are held for the same reason
they were deferred in Phase 3: no named customer, no named price, no named
currency pair, no evidence of demand. They may become Phase 6 candidates when
those facts exist. They are not speculative.

## 3. Track definitions

### 5A — Authentication + tenancy

**Goal sentence:** make ReconcileKit usable by more than one merchant, with
their data separated and their sessions authenticated.

**Scope:**

- Identity: `users` store kind with credential verification.
- Session: `sessions` store kind, cookie-based, logout, expiry.
- Tenancy: `organizations` and `memberships` store kinds; every existing
  application-level store kind gains an `org_id` or equivalent scope.
- Route protection: every customer and admin route requires an authenticated
  session scoped to a tenant.
- Replacement of the current `cus_demo` identity with a real seeded tenant
  plus a real user for test setup.

**Out of scope for 5A:**

- Password reset flows (a 5A.2 follow-up if needed).
- OAuth / social login.
- Email delivery (the notification store kind is not an email transport).
- Admin super-user roles.
- Rate limiting.

**Size:** Large. Multiple increments (5A.1 identity + session, 5A.2 tenancy
dimension on existing kinds, 5A.3 route protection).

**Freeze intersections:** §10 (auth non-goal), §10 (tenant/org non-goal). §14
procedure required.

### 5B — Durable persistence (3F)

**Goal sentence:** (part of) let a production operator run the storefront
against real Paystack events.

**Scope:**

- Replace `JsonlStore` with an embedded durable store behind the existing
  interface. The current interface (`insert`, `readAll`, `readLatestById`)
  must be preserved so call sites do not change.
- Choose the store. **SQLite** is the working recommendation — it is
  embedded, has no separate process, and is not PostgreSQL, Prisma, or Redis.
  Note the freeze's §24 language: _do not introduce PostgreSQL / Prisma /
  Redis / migrations._ A single-schema SQLite store with no migration
  framework is the closest fit to that constraint.
- Provide a one-time migration path from JSONL for existing data.
- Document backup, restore, and rollback.
- Rerun the Phase 3F concurrency and crash tests against the new store as
  acceptance evidence.

**Out of scope for 5B:**

- Migration framework (Alembic, Prisma Migrate, or equivalent).
- Multi-process coordination beyond what the new store gives for free.
- Replication, sharding, or cluster operation.

**Size:** Large.

**Freeze intersections:** §10 (production persistence gated), §24 (explicit
technology prohibitions). §14 procedure required.

### 5C — Webhooks (3E)

**Goal sentence:** (part of) let a production operator run the storefront
against real Paystack events.

**Scope:**

- `POST /webhooks/paystack` route in the storefront.
- HMAC signature verification using `x-paystack-signature`.
- Feed verified events through the existing `payment-sources/ingest.ts`
  boundary. The Phase 3E findings document established that this boundary
  already handles every webhook-class delivery correctly — retry, reorder,
  unknown reference, missing identity. No new ingest logic is required.
- Keep the polling path (`pilot-run --live-paystack`) as a fallback.
- Persist raw webhook deliveries for audit.

**Out of scope for 5C:**

- Webhooks from any provider other than Paystack.
- Webhook delivery to third parties (ReconcileKit does not forward events).
- Admin UI for webhook status.

**Size:** Medium.

**Freeze intersections:** §10 (webhooks gated). §14 procedure required.

**Note:** Phase 3E's own findings document recorded that the pilot did _not_
surface a webhook-triggering correctness gap. 5C opens on a
production-readiness rationale (goal #2), not on a correctness rationale.
This is a different decision than the one the freeze gated; it should be
recorded as such in 5C's scope document.

### 5D — Second PSP adapter

**Goal sentence:** prove the provider-adapter boundary by shipping a second
adapter.

**Scope:**

- One new provider under `reconcilekit/src/adapters/providers/{name}/`. The
  adapter shape is designed to be extended without core changes.
- This is the first **core** change since Phase 2.
- Provider choice to be confirmed in 5D's own scope document. Candidates:
  Flutterwave (closest Paystack sibling), or any other PSP with a documented
  Verify-like endpoint and HMAC-signed webhooks.

**Out of scope for 5D:**

- Storefront UI for the new provider's webhooks (that is 5C's pattern
  applied per-provider; a follow-up if needed).
- Real money movement with the new provider.
- Additional providers beyond the one selected.

**Size:** Medium–Large, mostly bounded by the provider's API surface.

**Freeze intersections:** §10 (no additional providers beyond Paystack). §14
procedure required. The domain's provider-neutral boundary (§4.1) is
deliberately preserved and is the reason this track exists.

## 4. Sequencing and dependencies

```text
Phase 5 opens
   │
   ▼
5A  Auth + tenancy             (foundation; storefront-only)
   │
   ▼
5B  Durable persistence (3F)   (5A's tenant dimension justifies it; JSONL
   │                             is insufficient once multiple users write)
   ▼
5C  Webhooks (3E)              (needs 5B's durable store for the raw delivery
   │                             log; otherwise uses the existing ingest)
   ▼
5D  Second PSP adapter         (independent; can run in parallel with 5B)
```

Hard rules:

- 5B does not start before 5A lands. The 3F deferral rationale ("no
  multi-operator necessity") no longer holds after 5A, and 5B is what makes
  the multi-tenant store survive restarts.
- 5C does not start before 5B lands. A webhook receiver without durable
  storage would replicate the JSONL concurrency question 5B resolves.
- 5D can be interleaved with 5B if a second adapter is the higher-value
  demonstration at any point. It does not depend on 5A, 5B, or 5C.
- No track opens without its own scoping document (following the Phase 4
  pattern).

## 5. §14 posture

Every track touches the freeze. The freeze's §14 procedure is applied
per-track, and each track's scoping document must state:

- Which freeze § the track intersects.
- Which invariant is touched.
- Why the current state is insufficient for the track's goal.
- What the smallest change is.
- Which tests and contracts are affected.
- Confirmation that explicit owner approval is sought before implementation.

Owner approval has been given in principle for all four tracks (this
document's authority). Per-increment approval is still required before each
increment lands, per the freeze's discipline.

## 6. Explicit deferrals

The following items remain deferred and are **not** scoped by Phase 5:

- **Billing.** No named customer, no named price, no demand evidence.
  Reopen when those exist.
- **FX / currency conversion.** The engine's stance is "integer minor units +
  explicit currency; no float money." Cross-currency reconciliation is a
  different domain model. Reopen when a named currency pair and a named use
  case exist.
- **Multi-region deployment.** No requirement named.
- **Observability stack.** Minimal logging remains; a stack choice is a
  Phase 6 or later decision.
- **Rate limiting.** May become a 5A.4 increment if the auth surface proves
  it is needed. Not scoped now.

None of these may be silently pulled into Phase 5 by an increment.

## 7. Standing guard

After every Phase 5 increment:

- Root tests: **no regressions from 677/677** (the number rises with new
  tests; the count is no longer a fixed target).
- Storefront tests: **no regressions from 464/464**.
- Both typechecks: PASS.
- ESLint: PASS.
- Prettier `format:check`: PASS.
- CI: green on `ubuntu-latest`.
- Consumer smoke test (`node scripts/smoke.mjs`): PASS — 5D in particular
  must not break the published tarball.

The absolute counts are not the target; the invariant is "no test that
passed before Phase 5 fails after any Phase 5 increment."

### 7.1 Amendment — 5B.1 closure

The original guard above remains the Phase 5 invariant. This amendment
records the re-baseline queued per scope §3.6 and the delivered surface for
5B.1.

| Item                              | Scope §3.6 projection      | Delivered                            |
| --------------------------------- | -------------------------- | ------------------------------------ |
| Core job                          | core tests only; ~213      | 213 / 213                            |
| Storefront job                    | storefront tests only; 518 | 606 / 606                            |
| JSONL layer                       | removed                    | zero references in `src/` or `test/` |
| Production filesystem persistence | removed                    | zero                                 |

Delivered deviations from the opening projection:

- 5B.1i (catalog) closed with no work. The three catalog repositories had
  zero production callers and were deleted at 5B.1e.2.
- 5B.1f split into f.1–f.4 plus f.2b. T5.1 (ESLint TS) is deferred pending
  TypeScript 7 toolchain verification; f.2b's pre-flight is committed at f.3.
- 5B.1d executed on a smaller surface than projected. Most fixtures migrated
  inline during 1a–1k, leaving only two stale `wallet_ledger` reads and two
  dead `store` parameters.

Final state: storefront **606/606**, core **213/213**, zero JSONL, zero
filesystem persistence in production.

## 8. Closure criteria

Phase 5 closes when:

- 5A / 5B / 5C / 5D each pass their own gates.
- The three goal sentences in §1 are each satisfied by verifiable evidence.
- The standing guard remains green and the current baseline is recorded.
- Every deferral in §6 is either still deferred with reasons, or has been
  separately authorized.
- The freeze's §14 procedure was applied on each track that touched the
  freeze, and no track silently bypassed it.

## 9. What this opening does and does not authorize

**Does:** open Phase 5; define the four tracks; commit to the sequencing;
record the §14 posture; anchor the phase on three goal sentences.

**Does not:** authorize any implementation increment; authorize the deferred
items in §6; authorize a change to any frozen decision without a per-track
§14 procedure; authorize `npm publish` (that is a separate action, per
`PUBLISHING.md`); authorize Phase 6.

Implementation begins only after each track's own scoping document is agreed
and the specific §14 procedure for that track is documented.

## 10. Status

**PHASE 5 OPENED — four tracks defined (5A auth + tenancy, 5B durable
persistence 3F, 5C webhooks 3E, 5D second PSP adapter). Sequencing agreed.
§14 posture accepted. Billing and FX explicitly deferred. Next artifact: the
5A scoping document.**
