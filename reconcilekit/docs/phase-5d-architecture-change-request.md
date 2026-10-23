# Phase 5D — Real-Provider Enablement: Architecture Change Request

**Status:** Approved — 2026-10-22
**Authority:** §14 of `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md`
**Approved by:** Owner
**Scope:** Unblock a real VTPass fulfillment integration for the
marketplace storefront by resolving four P0 blockers that currently
prevent honest persistence of non-simulated transactions.

This request follows the 8-step §14 procedure. Each step has a
corresponding section below.

---

## Step 1 — STOP implementation

Implementation of the VTPass adapter is halted until this request is
approved and its changes land. The two source reports
(`docs/vtpass-due-diligence.md`, `docs/vtpass-scoping.md`) are the
investigation artefacts; they will be committed when saved to files.

---

## Step 2 — Document the conflict

Four P0 blockers surfaced during the 5D scoping investigation
(`docs/vtpass-scoping.md`, pending commit). Each is a point where the
current codebase contradicts a real-provider integration requirement:

### P0-1 — Provider idempotency key drops purchase inputs

`storefront/src/marketplace/transactions.ts:2001` rebuilds the
identity seed with `inputsKey: ""`. The provider idempotency key is
therefore derived from `customerId + serviceId + scenario` only,
not from the actual purchase inputs. Two distinct purchases by the
same customer for the same service (e.g. two airtime top-ups to
different recipients) share the same provider idempotency key.

Consequence: any provider that honours idempotency (VTPass does —
response code 014 "request ID already exists") will collapse the
second purchase into the first.

### P0-2 — Persistence types force `simulated: true`

Four transaction-truth types hardcode `simulated: true` as a literal
in their type definitions:

- `storefront/src/marketplace/types.ts:335` — `MarketplacePaymentRecord`
- `storefront/src/marketplace/types.ts:352` — `MarketplaceTransaction`
- `storefront/src/marketplace/types.ts:373` — `ProviderAttempt`
- `storefront/src/marketplace/types.ts:386` — `TransactionEvent`

`recordProviderAttempt()` at `transactions.ts:1966` also hardcodes
`simulated: true` when writing the attempt.

Consequence: a real-provider transaction cannot be honestly
persisted. The database would record real-money attempts as
simulated — a lie in the audit trail.

### P0-3 — No `queryStatus()` on ProviderAdapter

`storefront/src/marketplace/providers/contracts.ts:80-91` exposes
only `execute()`. No method exists to query a previously-submitted
transaction's status.

Consequence: VTPass's `/api/requery` endpoint — the primary mechanism
for pending/timeout recovery — has no contract path. A timeout
produces an unqueryable attempt.

### P0-4 — No callback-to-anchor resolution

`storefront/src/db/repositories/marketplace-provider-attempts.ts`
has `insert`, `listByTransaction`, `list` — no
`findByProviderRequestId`. The outbound request ID is persisted as
`requestReference` (`transactions.ts:854`, `types.ts:364`), but no
lookup by that field exists.

Consequence: VTPass callbacks arrive carrying only VTPass's own
request_id. With no lookup, the callback cannot update the correct
attempt row.

---

## Step 3 — Identify affected invariants

The following invariants must NOT change. Each is currently held by
tests or by frozen-file convention:

1. **`mk_txn_` is the sole reconcile join key.** Provider
   references remain evidence-only. Established at
   `reconcile-bridge.ts:26-37` and asserted by existing wallet and
   reconcile tests.

2. **Provider reference is evidence, never join key.** Same source
   as (1).

3. **Payment, ledger, and fulfillment truths remain separate.**
   `payment_events` is payment-source evidence; the ledger is
   money-movement evidence; fulfillment is provider-result evidence.

4. **`payment_events` is payment-source evidence only.**
   `to-reconcilekit.ts:30` projects each event to a provider
   payment row. Routing VTPass bill-fulfillment callbacks into this
   table would mislabel the payment source.

5. **`WALLET_FIXED_TIMESTAMP` semantics unchanged.** Demo
   determinism depends on it.

6. **Frozen files stay untouched unless explicitly changed here.**
   `reconcilekit/src/**`, `storefront/src/ids.ts`,
   `storefront/src/marketplace/wallet.ts`,
   `storefront/src/marketplace/demo-scenarios.ts`.

---

## Step 4 — Why the existing architecture is insufficient

The ProviderAdapter contract's shape can structurally carry a single
outbound VTPass call: `execute()` takes a context and returns a
`ProviderResult` with provider reference, status, amount, currency,
timestamps, and source attributes. Rich enough for one attempt.

The insufficiency is in three areas the contract does not cover:

- **Lifecycle.** A single `execute()` call cannot represent
  "pending, then query for status, then final." Real providers
  have asynchronous state transitions.
- **Honesty.** The persistence layer's `simulated: true` literal
  was correct when every provider was a mock. It is now a
  constraint that prevents recording real-money activity.
- **Traceability.** A callback arriving from VTPass cannot be
  routed back to the correct transaction without a lookup from
  VTPass's request_id to our attempt row.

None of these require changing the reconcile engine. They require
minimal additions to the ProviderAdapter contract, the persistence
types, and the attempt repository — each independently testable.

---

## Step 5 — Propose the smallest architectural change

Six changes. Each is minimal, additive or refinable, and testable
independently.

### Change 1 — Idempotency key derivation fix

**File:** `storefront/src/marketplace/transactions.ts` (via
`buildServiceContext`); `storefront/src/marketplace/ticketing.ts`
(caller updates)

**The bug (two layers):**

Layer 1 — `buildServiceContext` rebuilt the transaction-identity
seed with `inputsKey: ""` (transactions.ts:2001 originally), so the
provider idempotency key was derived from
`customerId + serviceId + scenario` only, not the purchase inputs.

Layer 2 — even after threading inputs through, the `idem_` key
derivation used `buildStableSuffix(transactionRef)`. That helper
truncates to 24 characters, which cuts off the input-dependent
digest at the tail of `transactionRef`. Two distinct purchases by
the same customer for the same service produced identical
`idem_` keys even after Layer 1 was fixed.

**The fix (shipped at 4931aa9):**

1. Thread `inputs` through `buildServiceContext`; derive `inputsKey`
   from them (7 callers updated: 5 in transactions.ts, 2 in
   ticketing.ts).
2. Use full `transactionRef` in the idempotency key, not
   `buildStableSuffix(transactionRef)`:
   `idem_${transactionRef}_${attemptNumber}`.

**Rationale:** The provider idempotency key must be unique per
logical purchase. Including purchase inputs in the derivation makes
it so. This is a **bug fix**, not an architectural change: it
restores the invariant that each transaction has a unique identity,
which the current code violates.

**Test boundary:** The test observes `context.idempotencyKey` at the
provider boundary. Do NOT assert against `ProviderAttempt.
requestReference` — that field stores the outbound `requestId`, not
the idempotency key. The distinction matters for §Step 5 Change 5
below, where callback routing uses `requestReference` (VTPass's
request_id), not the idempotency key.

**Status per owner ruling 1.a:** Bug fix, lands alongside §14
changes but does not itself require §14 approval.

### Change 2 — Unseal `simulated` on four types

**File:** `storefront/src/marketplace/types.ts:335, 352, 373, 386`

**Before:** `readonly simulated: true;`
**After:** `readonly simulated: boolean;`

**Also:** `transactions.ts:1966` currently writes `simulated: true`
literally. Change to pass the provider result's actual `simulated`
value through (already `boolean` at `contracts.ts:77`).

**Rationale:** Mock mode continues to write `true`; real mode writes
`false`. The type is sealed correctly for the mock era; the phase
where real providers exist requires it to be a boolean.

**Status per owner ruling 1.b:** Unseal. No parallel-type
alternative.

### Change 3 — Unseal `scenario` on provider contract

**File:** `storefront/src/marketplace/providers/contracts.ts:38, 58`

**Before:** `scenario: MockProviderScenario` in both
`ProviderRequestContext` and `ProviderResult`
**After:** `scenario?: MockProviderScenario`

**Rationale:** Mock providers require a scenario to determine their
behaviour. Real providers have no such concept — their behaviour is
determined by their actual upstream state. Making `scenario` optional
lets mock mode continue supplying it while real mode omits it.

### Change 4 — Add `queryStatus()` to ProviderAdapter

**File:** `storefront/src/marketplace/providers/contracts.ts:80-91`

**Add method:**

```ts
queryStatus(
  context: ProviderRequestContext,
): Promise<ProviderResult>;
```

**Rationale:** The primary mechanism for pending/timeout recovery.
The context carries `requestId`, which is what VTPass's
`/api/requery` expects. The result shape is identical to `execute()`
— a status query produces the same terminal state an `execute()`
would have produced had it not timed out.

**Mock providers:** Implement `queryStatus()` returning a
deterministic state derived from the original `scenario`.
**Real providers:** Implement `queryStatus()` calling the provider's
requery endpoint.

### Change 5 — Callback-to-anchor resolution

**File:** `storefront/src/db/repositories/marketplace-provider-attempts.ts`

**Add method:**

```ts
findByProviderRequestId(
  requestId: string,
): Promise<ProviderAttempt | null>;
```

Backed by a Prisma `findFirst({ where: { requestReference: requestId } })`.

**Routing decision per owner ruling 1.c:** VTPass callbacks for
wallet-paid fulfillment do **not** route through `payment_events`.
That table is payment-source evidence; wallet is the payment source
for these transactions. Instead:

1. VTPass callback arrives at `/webhook/vtpass` (new route).
2. Handler verifies whatever signature VTPass supports (spec
   pending — see §7).
3. Handler calls `findByProviderRequestId(vtpass_request_id)`.
4. If no attempt is found → 200 (VTPass may retry); log for
   investigation.
5. If an attempt is found → update its status → re-run
   `reconcileMarketplaceTransaction` for the recovered
   `mk_txn_` anchor.

`payment_events` continues to hold Paystack payment evidence only.

### Change 6 — Registry mode switch

**File:** `storefront/src/marketplace/providers/registry.ts`

**Before:** `createMockProviderRegistry(): ProviderRegistry` (hard-wired)
**After:** `createProviderRegistry(mode: "MOCK" | "REAL", config): ProviderRegistry`

`mode` comes from new `config.providerMode` (default `"MOCK"`).

**Call sites to update:**

- `storefront/src/marketplace/providers/registry.ts`
- `storefront/src/main.ts:44`
- `storefront/src/marketplace/catalog.ts:93`
- `storefront/src/marketplace/seed.ts:309`

**Rationale:** The registry is hard-wired to mock implementations at
four entry points, not one. Real mode needs to select real
implementations. Mock mode remains the default so existing tests and
demos are unaffected.

---

## Step 6 — Identify affected tests and contracts

New tests required per change:

| Change | Test                                                                                       | File                                                    |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 1      | Two purchases, different inputs → different `idem_` keys                                   | `transactions.test.ts` (new case)                       |
| 2      | Mock-mode attempt persists `simulated: true`; real-mode persists `simulated: false`        | `transactions.test.ts` (new case)                       |
| 3      | Real-mode result omits `scenario`; mock-mode includes it                                   | `providers/registry.test.ts` (new case)                 |
| 4      | Mock provider `queryStatus()` returns terminal state; real provider calls requery endpoint | `providers/*.test.ts`                                   |
| 5      | `findByProviderRequestId` returns the correct attempt                                      | `db/repositories/marketplace-provider-attempts.test.ts` |
| 5      | Callback handler routes to attempt → status update → reconcile (mock VTPass callback)      | `server-webhook-vtpass.test.ts` (new)                   |
| 6      | Mode switch loads correct implementations; `"MOCK"` is default                             | `providers/registry.test.ts`                            |

Existing tests that must remain green:

- All 634 storefront tests
- All 213 core tests
- Wallet, reconcile, resolution, evidence suites untouched

Contract changes that ripple to every `ProviderAdapter` implementation:

- Mock providers must implement `queryStatus()` — one method each
  for the 12 mock provider slots. Mechanical addition.
- Any test that constructs a `ProviderResult` with `scenario`
  required must handle the now-optional field.

---

## Step 7 — Approval gate

**Approved by owner on 2026-10-22.**

Recorded rulings:

- **1.a** — idempotency key fix is a bug fix, not a §14 change.
- **1.b** — unseal `simulated` on the four transaction-truth types.
  No parallel-type alternative.
- **1.c** — VTPass callbacks for wallet-paid fulfillment bypass
  `payment_events`. That table is payment-source evidence.

**Delta at implementation (5D.1, 4931aa9):** Change 1's fix was
larger than the original text described. Both `inputsKey: ""` and
`buildStableSuffix(transactionRef)` had to be fixed. The
`buildStableSuffix` truncation (24 chars) cut off the input-dependent
digest, so threading inputs alone wasn't sufficient. The approved
intent (restore idempotency uniqueness) is unchanged; the
implementation added the second fix in service of that intent. The
test boundary also shifted from `requestReference` to
`context.idempotencyKey` for correctness. No re-approval required —
this addendum documents the delta.

Additional approval notes:

- **ids.ts frozen status (OpenCode blocker 2 resolution).** The
  change request's "Frozen files untouched" list treats `ids.ts`
  as frozen — consistent with the last ~20 increments in this
  project, where it has been listed as frozen and correctly left
  untouched. The freeze document (`PHASE_2_ACCEPTANCE_AND_
ARCHITECTURE_FREEZE.md`) does not list it in its §9 protected
  boundaries table; that is a documentation gap. See §9 Addendum
  below.

- **Deferred to later increments (do NOT require §14 approval
  now):**
  - VTPass auth implementation (sandbox credentials needed)
  - VTPass product-code mapping (docs + sandbox needed)
  - VTPass callback signature verification (spec needed)
  - Full VTPass adapter (`providers/vtpass/*`)
  - Cinema, bus, flight, gift-card adapters (separate tracks)

---

## §9 Addendum — Freeze doc gap

The freeze document's §9 protected-boundary table lists:

- `storefront/src/marketplace/types.ts`
- `storefront/src/marketplace/wallet.ts`
- `storefront/src/marketplace/catalog.ts, seed.ts, demo-scenarios.ts`

It does not list `storefront/src/ids.ts`. In practice, every increment
in the 5B/5C/5D series has treated `ids.ts` as frozen by convention,
and it has been correctly left untouched.

Recommended corrective action (separate small doc fix, not in scope
of this change request):

- Add a row to §9's table: `Identifier generation |
storefront/src/ids.ts | canonical ID formats frozen at Phase 2 |
...` with reasoning.

Until that doc fix lands, this change request treats `ids.ts` as
frozen by convention (documented here so future readers understand
the ruling).

---

## Rollback plan

All six changes are additive or refinable. If rolled back:

- Mode defaults to `"MOCK"` → mock provider registry loads
- Real-mode attempts cannot be created (blockers remain)
- Existing mock-mode tests and demos unaffected
- No production data loss (there is no production data yet)

Individual rollback:

- Change 1 (idempotency fix) can be reverted independently; mock
  providers ignore the idempotency key
- Change 2 (unseal `simulated`) can be reverted to `true` literal
  if real-provider work is abandoned
- Changes 3–6 are additive; reverting them leaves mock behavior
  untouched

---

## Sequencing after this request

1. Land the six changes from Step 5 (source + tests)
2. Obtain VTPass sandbox credentials (owner action)
3. Implement `providers/vtpass/*` against the frozen-but-extended
   contract
4. Sandbox end-to-end test (owner + tests)
5. Contact VTPass support for commercial terms (owner action)
6. Production VTPass integration (post-support-confirmation)

---

## References

- `reconcilekit/docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md`
  §14 (change procedure), §9 (protected boundaries)
- `reconcilekit/docs/vtpass-due-diligence.md` (external research —
  pending commit)
- `reconcilekit/docs/vtpass-scoping.md` (repository inspection —
  pending commit)
- `reconcilekit/docs/product-docs-audit.md` (surrounding MVP
  context)
