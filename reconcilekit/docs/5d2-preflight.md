# 5D.2 Pre-Flight — Contract and Persistence Readiness

**Project:** ReconcileKit
**Baseline:** `229db84` (`main`)
**Date:** 2026-10-23
**Scope:** Read-only pre-flight for approved Changes 2–4
**Authority:** Owner-approved change request (2026-10-22) and the 5D.2 task

**Verdict:** **STOP for Change 2.** The approved type change does not
make `simulated` persist. Changes 3 and 4 are preparable together, with
the corrections recorded below.

---

## Step 0 — Evidence

No source, test, schema, migration, or configuration file was changed
to produce this document.

### Check 1 — Environment gate and repository state

```text
DATABASE_URL: <unset>
DIRECT_URL: <unset>
POSTGRES_URL: <unset>
PRISMA_DATABASE_URL: <unset>
```

```text
git status --short -- reconcilekit/
(no output)
git rev-parse HEAD
229db84b595a868520ae5b5d193af34a753b54bb
```

No database-backed tests can be run in this environment. Static
evidence is sufficient to establish the persistence finding because the
repository mappers and Prisma schema are explicit.

### Check 2 — 5D.1b is closed

`229db84` is the 5D.1b close commit. The `buildStableSuffix` fix is
already shipped. This pre-flight does not reopen it and neither
Change 2, 3, nor 4 touches `buildStableSuffix`.

### Check 3 — Current provider contract

`reconcilekit/storefront/src/marketplace/providers/contracts.ts:26-42`:

```ts
export interface ProviderRequestContext {
  readonly transactionId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attemptNumber: number;
  readonly customerReference: string;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
  readonly scenario: MockProviderScenario;
  readonly amountMinor: number;
  readonly currency: string;
  readonly metadata: SourceAttributes;
}
```

`contracts.ts:54-91`:

```ts
export interface ProviderResult {
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKind: MarketplaceServiceKind;
  readonly scenario: MockProviderScenario;
  readonly providerReference: string | null;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attemptNumber: number;
  readonly requestTimestamp: string;
  readonly responseTimestamp: string | null;
  readonly providerStatus: ProviderStatus;
  readonly providerStatusCode: string;
  readonly providerMessage: string;
  readonly attemptStatus: ProviderAttemptStatus;
  readonly canonicalPaymentStatus: CanonicalPaymentStatus;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly latencyMs: number;
  readonly sourceAttributes: SourceAttributes;
  readonly reconciliationFacts: ProviderReconciliationFacts | null;
  readonly safeMetadata: SourceAttributes;
  readonly duplicateResults: readonly ProviderReconciliationFacts[];
  readonly simulated: boolean;
}

export interface ProviderAdapter<Request> {
  readonly mode: ProviderMode;
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly serviceKinds: readonly MarketplaceServiceKind[];

  execute(
    context: ProviderRequestContext,
    request: Request,
  ): Promise<ProviderResult>;
}
```

`contracts.ts:239-260` shows that ticketing is a separate contract, not
a `ProviderAdapter`:

```ts
export interface TicketingProvider {
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly mode: ProviderMode;
  readonly serviceKinds: readonly MarketplaceServiceKind[];
  searchAvailability(...): Promise<readonly TicketAvailability[]>;
  reserve(...): Promise<TicketProviderResult>;
  issue(...): Promise<TicketProviderResult>;
  cancel(...): Promise<TicketProviderResult>;
}
```

### Check 4 — Four `simulated: true` target types

`reconcilekit/storefront/src/marketplace/types.ts:335`:

```ts
export interface MarketplacePaymentRecord {
  ...
  readonly recordedAt: string;
  readonly simulated: true;
}
```

`types.ts:352`:

```ts
export interface MarketplaceTransaction {
  ...
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
  readonly simulated: true;
}
```

`types.ts:373`:

```ts
export interface ProviderAttempt {
  ...
  readonly sourceAttributes: SourceAttributes;
  readonly attemptedAt: string;
  readonly simulated: true;
}
```

`types.ts:386`:

```ts
export interface TransactionEvent {
  ...
  readonly source: TransactionEventSource;
  readonly metadata: SourceAttributes;
  readonly simulated: true;
}
```

### Check 5 — `recordProviderAttempt` and other construction sites

`reconcilekit/storefront/src/marketplace/transactions.ts:1946-1975`:

```ts
async function recordProviderAttempt(
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly providerId: string;
    readonly serviceId: string;
    readonly scenario: MockProviderScenario;
    readonly requestReference: string;
    readonly result: ProviderResult;
  },
): Promise<ProviderAttempt> {
  const attempt: ProviderAttempt = {
    id: buildProviderAttemptId(input.transactionId, input.result.attemptNumber),
    transactionId: input.transactionId,
    providerId: input.providerId,
    serviceId: input.serviceId,
    scenario: input.scenario,
    requestReference: input.requestReference,
    providerReference: input.result.providerReference,
    status: input.result.attemptStatus,
    canonicalStatus: input.result.canonicalPaymentStatus,
    amountMinor: input.result.amountMinor,
    currency: input.result.currency,
    latencyMs: input.result.latencyMs,
    sourceAttributes: input.result.sourceAttributes,
    attemptedAt: input.result.requestTimestamp,
    simulated: true, // line 1972
  };
  await repos.marketplaceProviderAttempts.insert(attempt);
  return attempt;
}
```

The line number in the approved change request is stale (`1966`); the
live literal is at `transactions.ts:1972`.

`recordProviderAttempt` is only one of several construction points that
hardcode `simulated: true`:

```text
marketplace/transactions.ts:124    TransactionReconciliationFacts.simulated: true
marketplace/transactions.ts:1840   MarketplaceTransaction.simulated: true
marketplace/transactions.ts:1914   MarketplaceOrder.simulated: true
marketplace/transactions.ts:2340   TransactionReconciliationFacts.simulated: true
marketplace/transactions.ts:2428   TransactionReconciliationFacts.simulated: true
marketplace/timeline.ts:86         TransactionEvent.simulated: true
marketplace/wallet.ts:271          WalletPaymentEvidence.simulated: true
marketplace/wallet.ts:1337         MarketplacePaymentRecord.simulated: true
```

### Check 6 — Registry slots and concrete mock classes

`reconcilekit/storefront/src/marketplace/providers/registry.ts` has 12
`MarketplaceServiceKind` entries:

```text
AIRTIME, DATA, ELECTRICITY, CABLE_TV, INTERNET, EDUCATION
GIFT_CARD
WALLET_FUNDING
CINEMA, EVENT, BUS, AIRLINE
```

Concrete implementations:

```text
MockServiceProvider   covers 6 registry slots (the six service kinds)
MockGiftCardProvider  covers 1 registry slot
MockPaymentProvider   covers 1 registry slot
MockTicketingProvider covers 4 registry slots (CINEMA, EVENT, BUS, AIRLINE)
```

`MockServiceProvider` is used at registry lines `60, 68, 75, 83, 90, 98`.
`MockGiftCardProvider` is used at line `148`.
`MockPaymentProvider` is used at line `153`.

`MockTicketingProvider` implements `CinemaProvider`, `EventProvider`,
`BusProvider`, and `AirlineProvider` (`mock-provider.ts:194-195`), all of
which use `TicketingProvider`, not `ProviderAdapter`.

Therefore:

- Adding `queryStatus()` to `ProviderAdapter` requires **3 methods**, not
  one per registry slot.
- The 3 concrete classes cover **8 of 12** registry slots.
- The 4 ticketing slots are outside the contract and are unaffected.

### Check 7 — Test and persistence inventory

Test files containing `scenario:`:

```text
Count: 105 across the storefront test tree
```

Test files containing `simulated`:

```text
Count: 79
```

Test files containing `queryStatus`, `statusQuery`, `requery`, or
`getStatus`:

```text
Count: 0
```

Existing fake provider object that must add `queryStatus()`:
`test/marketplace/payment-provider.test.ts:219`.

The Prisma models do **not** have a `simulated` column:

```prisma
model MarketplaceTransaction {
  id                String   @id
  orderId           String   @map("order_id")
  customerId        String   @map("customer_id")
  reference         String   @unique
  serviceId   String @map("service_id")
  providerId  String @map("provider_id")
  scenario          String
  paymentStatus     String   @map("payment_status")
  fulfillmentStatus String   @map("fulfillment_status")
  reconcileOutcome  String?  @map("reconcile_outcome")
  resolutionStatus  String   @map("resolution_status")
  customerStatus    String   @map("customer_status")
  adminStatus       String   @map("admin_status")
  demoScenarioName  String?  @map("demo_scenario_name")
  createdAt         DateTime @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime @map("updated_at") @db.Timestamptz(6)
}

model MarketplaceProviderAttempt {
  id                String   @id
  transactionId     String   @map("transaction_id")
  providerId        String   @map("provider_id")
  serviceId         String   @map("service_id")
  scenario          String
  requestReference  String   @map("request_reference")
  providerReference String?  @map("provider_reference")
  status            String
  canonicalStatus   String?  @map("canonical_status")
  amountMinor       Int?     @map("amount_minor")
  currency          String?
  latencyMs         Int      @map("latency_ms")
  sourceAttributes  Json     @map("source_attributes")
  attemptedAt       DateTime @map("attempted_at") @db.Timestamptz(6)
}

model MarketplacePayment {
  id                  String    @id
  transactionId       String    @map("transaction_id")
  orderId             String    @map("order_id")
  customerId          String    @map("customer_id")
  walletReference     String    @map("wallet_reference")
  providerReference   String?   @map("provider_reference")
  expectedAmountMinor Int       @map("expected_amount_minor")
  actualAmountMinor   Int?      @map("actual_amount_minor")
  currency            String
  status              String
  paidAt              DateTime? @map("paid_at") @db.Timestamptz(6)
  metadata            Json
  recordedAt          DateTime  @map("recorded_at") @db.Timestamptz(6)
}

model TransactionEvent {
  id            String   @id
  transactionId String   @map("transaction_id")
  type          String
  label         String
  description   String
  occurredAt    DateTime @map("occurred_at") @db.Timestamptz(6)
  actor         String
  source        String
  metadata      Json
}
```

Repository reads hardcode `simulated: true` after mapping:

```text
src/db/repositories/marketplace-transactions.ts:118
src/db/repositories/marketplace-payments.ts:127
src/db/repositories/marketplace-provider-attempts.ts:118
src/db/repositories/transaction-events.ts:93
```

The corresponding write mappers (`toPrisma...`) do not contain a
`simulated` field at all. A `false` value supplied by application code is
silently discarded.

---

## Summary and Recommendation

| Change                  | Verdict                                          | Reason                                                                                                                                                   |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 — unseal `simulated`  | **STOP**                                         | Types widen, but no schema column and no repository mapping. `false` is lost on write/read. Three of the four target constructors still hardcode `true`. |
| 3 — optional `scenario` | Ready with a mock guard                          | Two-line contract change; 12 compile errors in `mock-provider.ts` require a local narrowing guard. No runtime test breaks.                               |
| 4 — `queryStatus()`     | Ready with 3 mock methods and 1 test fake update | Actual impact is 3 concrete `ProviderAdapter` classes / 8 registry slots, not 12 slots. Ticketing is a separate contract. No existing caller.            |

**Recommended increment:** hold Change 2; ship Changes 3 and 4 together.
This is a corrected version of option C: Change 2 is not ready for
implementation, while Changes 3 and 4 share the same contract and mock
surface and should not be split.

Change 2 should not be implemented as written. It would create a false
audit signal: the insert returns `simulated: false` in memory, but the
database has no column to store it and every subsequent read returns
`true`. A test that asserts on the returned object would pass while the
persisted row remains dishonest.

---

## Part 1 — Current Behavior

### 1.1 The contract is provider-only

`ProviderAdapter` is implemented by the six service providers, gift
cards, and payment. Ticketing (`CinemaProvider`, `EventProvider`,
`BusProvider`, `AirlineProvider`) is a separate lifecycle contract with
`searchAvailability`, `reserve`, `issue`, and `cancel`. It has no
`ProviderAdapter` inheritance and no status-query method.

### 1.2 The four target types are not the four write sites

The approved change request names four persistence types:

- `MarketplacePaymentRecord`
- `MarketplaceTransaction`
- `ProviderAttempt`
- `TransactionEvent`

But the minimum write-site change in the approved text covers only
`ProviderAttempt`:

```text
MarketplacePaymentRecord  <- wallet.ts:1337 hardcodes true
MarketplaceTransaction    <- transactions.ts:1840 hardcodes true
ProviderAttempt           <- transactions.ts:1972 hardcodes true (target)
TransactionEvent          <- timeline.ts:86 hardcodes true
```

Unsealing all four types while changing only one write site means three
types are still always constructed as `true`. The type change alone
does not change behavior.

### 1.3 The database cannot represent `false`

There is no `simulated` field on any of the four Prisma models. There is
also no `simulated` field in the migrations. The only route from
application code to the database is the repository mapper, and that
mapper omits the field.

The current path for a provider attempt is:

```text
recordProviderAttempt()
  -> ProviderAttempt.simulated = true
  -> marketplaceProviderAttempts.insert()
  -> toPrismaProviderAttempt() omits simulated
  -> INSERT has no simulated column
  -> read maps simulated: true
```

Changing the literal at `transactions.ts:1972` to
`input.result.simulated` changes only the first step. The last step still
returns `true`.

### 1.4 `simulated` is not one truth across the four rows

The four values describe different sources:

- `MarketplacePaymentRecord` is created from wallet payment evidence
  (`wallet.ts:1337`). The wallet is a demo wallet and its evidence is
  simulated.
- `ProviderAttempt` describes the provider call and can become real.
- `MarketplaceTransaction` spans both the payment and the provider call.
- `TransactionEvent` can describe either the wallet side or the provider
  side.

A real provider funded by the demo wallet would naturally have
`ProviderAttempt.simulated = false` but
`MarketplacePaymentRecord.simulated = true`. A single transaction-level
boolean cannot express both. This is a semantic decision that must be
settled before any persistence change.

### 1.5 Other truthful surfaces still hardcode `true`

Even if the four target types and all four write sites were changed,
these still report simulated unconditionally:

- `TransactionReconciliationFacts.simulated` at `transactions.ts:124`,
  plus its constructed values at `transactions.ts:2340` and `2428`.
- `MarketplaceOrder.simulated` at `transactions.ts:1914`.
- `WalletPaymentEvidence.simulated` at `wallet.ts:271`.

`TransactionReconciliationFacts` is part of the transaction result API.
If a real provider attempt is written as `false` but reconciliation facts
still say `true`, the API would contradict itself. Change 2 does not
mention this type.

---

## Part 2 — Change 2: Unseal `simulated`

### 2.1 Approved intent

The owner approved ruling **1.b**: unseal `simulated` on the four
transaction-truth types, with no parallel-type alternative. The stated
goal in P0-2 is that a real-provider transaction can be honestly
persisted rather than recorded as simulated.

### 2.2 What the literal change does

The literal Change 2 is:

1. `types.ts:335,352,373,386` — `readonly simulated: true` becomes
   `readonly simulated: boolean`.
2. `transactions.ts:1972` — `simulated: true` becomes
   `simulated: input.result.simulated`.

This compiles cleanly. A scratch-copy typecheck of exactly these edits
reported zero errors. That is precisely the hazard: the type checker
accepts the change, but the persistence layer still silently converts
every value back to `true`.

### 2.3 What an honest Change 2 requires

At minimum:

```text
prisma/schema.prisma
prisma/migrations/<new>/migration.sql
src/db/repositories/marketplace-transactions.ts
src/db/repositories/marketplace-payments.ts
src/db/repositories/marketplace-provider-attempts.ts
src/db/repositories/transaction-events.ts
src/marketplace/types.ts
src/marketplace/transactions.ts
src/marketplace/timeline.ts
src/marketplace/wallet.ts
```

That is 10 production/schema files before tests. It also requires a
decision on `MarketplaceOrder.simulated`,
`WalletPaymentEvidence.simulated`, and
`TransactionReconciliationFacts.simulated`, because those are adjacent
truth surfaces and at least the last one is returned by the transaction
API.

This exceeds the pre-flight's ≤10-file threshold once tests are added,
and it is a schema migration, not merely an "unseal." It also touches
`wallet.ts`, which the approved change request lists as frozen; an
explicit freeze exception would be required in addition to the schema
approval.

### 2.4 Options

**Option 2A — Literal Change 2 (not recommended).**

Two files, zero compile errors, zero existing test failures. It also
leaves the persisted row as `simulated: true` and makes only the
in-memory return value false. This is worse than no change because it
invites false tests.

**Option 2B — Honest persistence change (requires approval).**

Add a `simulated` column to all four models, add a migration, persist
and read it in four repositories, and update every construction site to
use the right source truth. This is 10+ files and requires a ruling on
the mixed wallet/provider semantics.

**Option 2C — Defer Change 2 (recommended for 5D.2).**

Leave the four types sealed and leave `recordProviderAttempt` as `true`.
No honest real-provider persistence is possible yet, but no lying test
is introduced. The existing behavior is already honest about being
simulated. Revisit with a dedicated persistence increment.

### 2.5 Recommended ruling

Do not implement Change 2 in 5D.2. If the owner wants real-provider
persistence next, approve Option 2B explicitly, including the schema
migration and the mixed-source semantics. The current 1.b approval covers
only the type unsealing and is narrower than P0-2's stated consequence.

---

## Part 3 — Change 3: Optional `scenario`

### 3.1 Change surface

`contracts.ts:38` and `contracts.ts:58`:

```diff
- readonly scenario: MockProviderScenario;
+ readonly scenario?: MockProviderScenario;
```

This is the smallest contract change in the set. `ProviderResult` is
usually constructed by the mock builder, which always has a scenario;
real providers can now omit it. `ProviderRequestContext` is still
populated with a scenario by the orchestration layer, so existing mock
execution is unaffected.

### 3.2 Actual compile impact

A scratch-copy typecheck with only Change 3 applied produced 12 errors,
all in `mock-provider.ts`:

```text
182  giftCardDeliveryStatus(context.scenario)
186  giftCardCodeStatus(context.scenario)
375  authorizationState(context.scenario)
401  SCENARIO_LATENCY_MS[input.context.scenario]
411  SCENARIO_CANONICAL_STATUS[input.context.scenario]
423  SCENARIO_STATUS[input.context.scenario]
424  providerStatusCode(input.context.scenario)
425  providerMessage(input.context.scenario)
455  SCENARIO_STATUS[input.context.scenario]
456  providerStatusCode(input.context.scenario)
457  providerMessage(input.context.scenario)
458  SCENARIO_ATTEMPT_STATUS[input.context.scenario]
```

The six service-provider comparisons (`=== "TIMEOUT"` etc.) do not fail
because `undefined === "TIMEOUT"` is valid TypeScript. Only index access
and helper arguments fail.

No test file failed under Change 3 alone. The test suite has no
`queryStatus` references and no test constructs a `ProviderResult`
through a path that requires the field to remain mandatory.

### 3.3 Required guard

A mock cannot derive an outcome without a scenario. Do not default to
`SUCCESS`; that would let a missing scenario silently execute a
successful mock transaction. Add one local narrowing guard, for example:

```ts
function requireScenario(
  context: ProviderRequestContext,
): MockProviderScenario {
  if (context.scenario === undefined) {
    throw new Error("Mock provider requires a scenario");
  }
  return context.scenario;
}
```

Then bind `const scenario = requireScenario(context)` at the top of each
mock method that needs it. This converts the 12 errors into one
well-defined runtime failure and keeps the contract honest. A test should
assert that a mock `execute()` or `queryStatus()` without a scenario
throws.

### 3.4 Remaining real-mode scenario requirement

Making the contract optional does not make the whole real path optional:

- `ExecuteTransactionInput.scenario` remains required.
- `buildServiceContext` still derives a scenario.
- `MarketplaceTransaction.scenario` and `ProviderAttempt.scenario` remain
  required domain/persistence fields.
- The database `scenario` columns remain `String` (non-null).

So a real provider can omit `scenario` from its result, but the
orchestration and persistence layers still require one for every
transaction. If the intent is "real mode has no scenario at all," this is
not end-to-end and needs a separate persistence/domain change. If the
intent is only "a real provider's result need not carry a mock scenario,"
Change 3 is sufficient.

---

## Part 4 — Change 4: `queryStatus()`

### 4.1 Change surface

Add to `ProviderAdapter` (`contracts.ts:80-91`):

```ts
queryStatus(context: ProviderRequestContext): Promise<ProviderResult>;
```

`GiftCardProvider` and `PaymentProvider` extend `ProviderAdapter`, so
they inherit the requirement. The six service-provider interfaces also
extend it. Ticketing does not.

### 4.2 Actual implementation count

The approved text says "one method each for the 12 mock provider slots."
That is not the code shape:

```text
MockServiceProvider    1 method  -> 6 registry slots
MockGiftCardProvider   1 method  -> 1 registry slot
MockPaymentProvider    1 method  -> 1 registry slot
MockTicketingProvider  not a ProviderAdapter -> 4 ticket slots, unaffected
```

So the mechanical work is **3 methods**, covering 8 registry slots. The
remaining 4 slots use `TicketingProvider`, which has no `queryStatus` in
this change. If ticketing needs status recovery, that is a separate
contract change.

### 4.3 Compile impact before implementation

Adding the method to `ProviderAdapter` without adding class methods
produces:

- `MockGiftCardProvider` “incorrectly implements `GiftCardProvider`”.
- `MockPaymentProvider` “incorrectly implements `PaymentProvider`”.
- Registry assignments for the six `MockServiceProvider` slots fail.
- Registry assignments for gift card and payment fail.
- Multiple `MockServiceProvider` assignments in
  `test/marketplace/mock-provider.test.ts` fail.
- `MockPaymentProvider` assignments in
  `test/marketplace/payment-provider.test.ts` fail.

After the three classes implement the method, the only remaining
typecheck failure is the standalone fake provider object at
`test/marketplace/payment-provider.test.ts:219`. That object must add a
`queryStatus` stub. No other test source change is required by the
contract itself.

### 4.4 Runtime test impact

No existing caller invokes `queryStatus`. Adding the method does not
change `execute`, so existing runtime cases should remain green. The
expected impact is:

```text
Existing runtime failures: 0
Existing typecheck failures after class methods: 1 test file, 1 object
New behavior tests required: at least 3 (one per concrete class)
```

### 4.5 What `queryStatus` should return

The method receives only `ProviderRequestContext`. It does not receive
the original service-specific request. That is enough for the base
`ProviderResult` fields, but not for specialized fields:

- `GiftCardProviderResult` includes delivery/code status built from the
  gift-card request.
- `PaymentProviderResult` includes authorization and settlement state
  built from the payment request.
- The service providers use only amount/currency, which are available in
  context.

The contract returns `ProviderResult`, so a base reconstruction is
sufficient for the interface. If callers need specialized fields, the
mock needs a per-request state map or a richer context. This is a design
decision, not a mechanical addition.

### 4.6 Terminal-state ambiguity

The change request says the mock `queryStatus()` returns a
"deterministic state derived from the original `scenario`" and the test
says "returns terminal state." Those are not the same for all scenarios:

- `SUCCESS` and `FAILED` are already terminal.
- `TIMEOUT` in `buildProviderResult` yields
  `attemptStatus: "TIMEOUT"` and `responseTimestamp: null`; re-deriving
  from the same scenario returns the same timeout, not a new terminal
  state.
- `PENDING` similarly remains pending unless the mock defines a
  transition.

A pure function can map `TIMEOUT` to `FAILED` or `PENDING` to `SUCCESS`,
but that is an invented state transition, not a reconstruction of the
original result. The owner must choose:

1. **Reconstruction only** — `queryStatus` returns the same canonical
   state as `execute`; tests assert consistency, not progression.
2. **Deterministic transition** — define a scenario-to-terminal map
   (for example `TIMEOUT -> FAILED`, `PENDING -> SUCCESS`) and test that
   explicitly.
3. **Stateful mock** — retain the last result by `requestId` and return
   it; this is deterministic only within one process and needs cleanup.

Option 1 is the smallest and most honest for a contract-only increment.
Option 2 is needed if the test's phrase "terminal state" is literal.

### 4.7 Registry-wide availability

`RegisteredProvider` is a union of the eight provider interfaces plus
`MockTicketingProvider`. Adding `queryStatus` to `ProviderAdapter` does
not make `RegisteredProvider` uniformly queryable, because the union
still includes a ticketing type without the method. Callers must narrow
by service kind or the registry needs a separate status capability.
Change 4 does not provide "query any provider slot" by itself.

### 4.8 No persistence or callback work

`queryStatus` returns a result. It does not write a new attempt, update a
transaction, or resolve a callback. This is acceptable for Change 4's
contract scope, but it does not deliver timeout recovery by itself.
Changes 5 and 6 remain necessary for the full lifecycle.

---

## Part 5 — Test and File Impact

### 5.1 Impact table

| Scope                | Production/schema files | Existing test files edited | Existing runtime failures |                                New tests |
| -------------------- | ----------------------: | -------------------------: | ------------------------: | ---------------------------------------: |
| Change 2 literal     |                       2 |                          0 |                         0 | 1 (would pass in memory, fail on reload) |
| Change 2 honest      |                     10+ |         4 repository tests |                         0 |           4+ round-trip and mixed-source |
| Change 3 alone       |                       2 |                          0 |                         0 |                             1 guard test |
| Change 4 alone       |                       2 |                          1 |                         0 |                            3 class tests |
| Changes 3 + 4        |                       2 |                          2 |                         0 |                                        4 |
| Change 2 + 3 + 4 (A) |                     12+ |                         2+ |                         0 |                                       8+ |
| Change 2 + 3 (B)     |                     12+ |                         2+ |                         0 |                                       5+ |
| Change 2 / 3 / 4 (C) |                     12+ |                         3+ |                         0 |                                       8+ |

“Existing test files edited” counts files that must change to compile;
new test cases can be added to existing test files without adding another
file.

### 5.2 Exact typecheck break inventory

```text
Change 2 literal:
  tsc: 0 errors
  tests: 0 typecheck errors

Change 3 only:
  tsc: 12 errors, all mock-provider.ts
  tests: 0 typecheck errors

Change 4 only, contract first:
  tsc: class/registry errors + test errors
  after 3 class methods: 1 test object error
    test/marketplace/payment-provider.test.ts:219
  after that stub: 0

Changes 3 + 4:
  same as Change 4, plus the 12 scenario errors until the guard lands
```

No existing test case fails at runtime in any of these scenarios,
assuming the mocks implement the new method and the scenario guard is
added. The baseline suite is **637/637** storefront tests, not the 634
stated in the change request. Core remains **213/213** and is unaffected.

### 5.3 Test coverage that must be added

Change 2 (if approved honestly):

- provider attempt writes `false` and reads `false` after a repository
  round-trip;
- mock attempt still writes `true`;
- transaction/event/payment rows preserve their own source truth;
- mixed wallet-mock + real-provider transaction has the expected
  per-row values.

Change 3:

- real-style result omits `scenario` and compiles/works;
- mock `execute` without scenario throws the defined error;
- mock `queryStatus` without scenario throws the defined error.

Change 4:

- each concrete mock class returns a result with the correct provider /
  request identifiers;
- `SUCCESS`, `FAILED`, `TIMEOUT`, and `PENDING` behavior matches the
  chosen reconstruction/transition policy;
- existing `execute` results are unchanged;
- the registry still resolves all 12 slots, with the 4 ticketing slots
  explicitly out of scope.

---

## Part 6 — Recommendation and Owner Rulings

### 6.1 Recommended decomposition

**Recommended: hold Change 2; implement Changes 3 + 4 as one increment.**

This is not exactly A, B, or C. It is closest to C, with 3 and 4 merged:

- Change 3 alone changes the contract and forces a mock guard, but does
  not add any new capability; its only user is the future real adapter.
- Change 4 alone adds a method with no caller and no status behavior.
- Together they form one coherent “provider contract readiness” change:
  optional scenario plus status query, 3 mock methods, 1 test fake
  update, 3–4 files.
- Change 2 is a persistence/migration change disguised as a type change.
  It should not ride with the contract increment.

**Expected size for 3 + 4:** 2 production files (`contracts.ts` and
`mock-provider.ts`), plus test cases in `mock-provider.test.ts` and the
existing fake provider in `payment-provider.test.ts`; about 4 files
touched, 3 mock methods, 1 test object stub, 0 runtime regressions.

**If the owner insists on A:** Change 2 must first be amended to include
the schema/migration/repository work. A literal A would violate the
honesty goal and should be rejected.

**If the owner chooses B:** It inherits Change 2's blocker and adds no
synergy with Change 3. It is the second-best option only if schema work
is approved immediately.

**If the owner chooses C:** Do not implement Change 2 first. Sequence it
as 3 + 4, then a separate honest persistence increment for 2.

### 6.2 Rulings needed before implementation

1. **Change 2 persistence.** Approve Option 2B (schema migration + four
   repository mappings + all construction sites), or approve Option 2C
   (defer Change 2). Do not approve the literal two-file version as an
   honest persistence fix.

2. **`simulated` semantics.** Are the four flags independent per row, or
   is there one transaction-level truth? Specifically, in a real-provider
   transaction funded by the demo wallet, should
   `MarketplacePaymentRecord.simulated` remain `true` while
   `ProviderAttempt.simulated` becomes `false`?

3. **Adjacent truth surfaces.** If Change 2 proceeds, should
   `TransactionReconciliationFacts.simulated`,
   `MarketplaceOrder.simulated`, and `WalletPaymentEvidence.simulated` remain
   sealed `true` or be included? The current change request leaves them
   out, but reconciliation facts are returned by the transaction API.

4. **Mock `queryStatus` behavior.** Choose reconstruction-only or a
   deterministic terminal transition. The current "derived from
   scenario" and "returns terminal state" statements conflict for
   `TIMEOUT` and `PENDING`.

5. **Ticketing status.** `TicketingProvider` is outside
   `ProviderAdapter`. Should ticket recovery remain out of scope, or does
   5D.2 need a parallel ticketing status method?

6. **Scenario guard.** Confirm that mock providers should throw when
   `scenario` is omitted, rather than defaulting to `SUCCESS`. Throwing
   preserves the mock's determinism requirement and prevents a silent
   successful execution.

7. **Real-mode scenario persistence.** The contract can omit `scenario`,
   but `ExecuteTransactionInput`, `MarketplaceTransaction`, and
   `ProviderAttempt` still require it. Confirm that this is acceptable
   for 5D.2 and that a real-mode persistence change is deferred.

### 6.3 What not to do

- Do not unseal `simulated` and change only
  `recordProviderAttempt`. The database will still return `true`.
- Do not add `queryStatus` to `ProviderAdapter` without implementing the
  three concrete mock methods in the same increment; the registry and
  tests will not typecheck.
- Do not call `execute` with a synthetic empty request from
  `queryStatus`; use the existing pure `buildProviderResult` path with a
  real context and the correct service kind.
- Do not add a fourth “parallel” simulated type; ruling 1.b rejects it.
- Do not change the frozen `wallet.ts`, `demo-scenarios.ts`, `ids.ts`, or
  `reconcilekit/src/**` files without explicit approval. The proposed
  honest Change 2 would require touching `wallet.ts` because
  `toWalletPaymentRecord` is there; that is a separate approval
  consequence.

---

## Verification

- Only `reconcilekit/docs/5d2-preflight.md` was created in the
  workspace.
- `git status --short -- reconcilekit/` was clean before writing this
  file.
- Baseline typecheck was clean.
- Baseline storefront tests were **637/637**; core tests were
  **213/213**. These were not rerun here because the environment has no
  database URL.
- Scratch-copy typechecks were run outside the workspace and were
  deleted afterward:
  - Change 2 literal: 0 errors.
  - Change 3 only: 12 errors in `mock-provider.ts`.
  - Change 3 + 4 with class method stubs: the class/registry errors
    clear, leaving the single
    `test/marketplace/payment-provider.test.ts:219` fake-object error and
    the 12 scenario errors until the mock guard is added.
- No source, test, schema, migration, or configuration file was changed.
