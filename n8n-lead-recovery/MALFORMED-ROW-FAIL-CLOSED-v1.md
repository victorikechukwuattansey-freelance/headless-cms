# MALFORMED-ROW-FAIL-CLOSED-v1

**Status: Draft**
**Date: 2026-09-21**
**Artifact lineage:** … → Outreach Execution & Delivery V1 → **Malformed-Row Fail-Closed (Phase 6/7)**
**Companion to `RESEND-REAL-EMAIL-DELIVERY-v1.md`; this doc lands first (see §Implementation order there).**

---

## 1. Problem

The execution engine's idempotency index drops malformed Outreach Log rows **silently**, and the enforcement half of the malformed-row rule is missing.

`buildSentIndex` (`src/execution.js:94-105`) indexes only rows where **both** `lead_id` and `sent_at` are present — anything missing either is discarded in the `if (!leadId || !sentAt) return;` at line 100:

```
function buildSentIndex(outreachRows) {
  const index = new Map();
  (outreachRows || []).forEach((obj) => {
    const row = obj || {};
    const leadId = normalize(row.lead_id);
    const sentAt = normalize(row.sent_at);
    if (!leadId || !sentAt) return;
    ...
  });
}
```

The **visibility** half already exists: `buildHistoryIndex` in the queue artifact (`src/queue.js:198-221`) collects malformed rows at lines 204-207 and raises them as `MALFORMED_OUTREACH` exceptions (`src/queue.js:318-327`, forwarded into the execution report via `exceptions`). So a malformed row is already *seen* — but the gate never *acts* on it. It is only dropped from consideration.

The consequence: a malformed row (`lead_id` present, `sent_at` empty) can never suppress a repeat attempt — and that is correct for the *unattributable* case, but it is **wrong** for the *identity-known* case. When a lead has an Outreach Log row that looks like an attempt but carries no confirmation, the conservative stance is to **hold** the lead, not to treat it as never-contacted and re-send into the same identity.

**Verdict: fail-closed.** Where the system can attribute a malformed row to a lead identity, it must refuse to execute that lead until the inconsistency is resolved — a failed lead, not a failed run.

---

## 2. The rule — two-case split

The rule is not "malformed ⇒ suppress or not." It splits on **attributability**:

| Case | Shape | Disposition |
|---|---|---|
| **Identity-known malformed** | `lead_id` present, `sent_at` empty | **Hold the lead.** Gate returns `ok: false`, status `EXECUTION_SKIPPED`, reason `LOG_INCONSISTENT`. The lead is not executed this run and is not marked as a confirmed send. |
| **Unattributable malformed** | `lead_id` missing (empty/normalized to `''`) | **Surface + count only.** No gate action, no suppression, no throw. The row has no identity to gate on, so it cannot block anything; it is already surfaced by the queue layer (`MALFORMED_OUTREACH`). |

The identity-known case is the only one that reaches the gate. The unattributable case remains entirely in the queue layer's existing surfacing — the gate never sees a meaningful key for it, so it must never hold or suppress on it.

Deliberately **not** included: throwing. A malformed row is data inconsistency, not a run-level failure. It degrades one lead, never the run (`src/execution.js:341-352` keeps `EXECUTION_INCOMPLETE` reserved for source read failures).

---

## 3. Blast radius

- **Failed lead, not failed run.** `LOG_INCONSISTENT` is a per-item gate result, produced inside the existing per-item loop (`src/execution.js:371-376`). The run still completes (`COMPLETED`), other leads still execute, and the report still carries normal metrics. No throw, no `EXECUTION_INCOMPLETE`, no cascade.
- **Bucket conservation preserved.** The hold uses `EXECUTION_STATUS.SKIPPED` — the same bucket that `BLOCKED` and `NOT_READY` already use (`src/execution.js:48-54`, `:231-235`). It does **not** increment `executed_failed` or `executed_rejected`, so run-level failure/rejection accounting is unchanged.
- **`sent_at` semantics untouched.** A held row means "this identity is inconsistent" — it does **not** mean "this identity was sent." Nothing anywhere marks a lead sent without provider confirmation (`src/execution.js:37-38`, `:410-412`).

---

## 4. Enum + gate changes

### 4.1 New reason

`REASON` (`src/execution.js:56-66`) gains:

```
LOG_INCONSISTENT: 'LOG_INCONSISTENT',
```

Status: reuse `EXECUTION_STATUS.SKIPPED` (no new status enum value — matches the `BLOCKED`/`NOT_READY` pattern).

### 4.2 Gate signature — third argument, defaulted

`gateExecution` (`src/execution.js:230-244`) gains a third argument defaulting to an empty Map so existing callers are unaffected:

```
function gateExecution(item, sent, ambiguous = new Map()) { ... }
```

The new branch sits beside the existing dedup gate (line 240). It fires only when the item's identity-key (`${lead_id}\u0000${channel}`, same key shape as line 240) is present in the ambiguous index:

```
if (ambiguous.has(`${item.lead_id}\u0000${item.available_channel}`)) {
  return { ok: false, status: EXECUTION_STATUS.SKIPPED, reason: REASON.LOG_INCONSISTENT,
           detail: 'outreach log row for lead_id+channel is inconsistent (missing sent_at); held until resolved' };
}
```

### 4.3 `buildSentScope(rows)` — three-bucket return

A new helper replaces the two-bucket worldview with a three-bucket scope:

```
buildSentScope(rows) → { confirmed, pending, ambiguous }
```

- `confirmed` — rows with `lead_id` + `sent_at` present (what `buildSentIndex` indexes today).
- `pending` — in-flight rows (`lead_id` present, `sent_at` empty, explicit `status === 'pending'`). **Always empty until Doc 1 (`RESEND-REAL-EMAIL-DELIVERY-v1.md`) lands** — Doc 1 introduces the pending/ack cycle and the `status` column; before that no row can be `pending`.
- `ambiguous` — identity-known malformed (`lead_id` present, `sent_at` empty, no explicit `pending` status) → the rows this doc's gate branch holds.

Doc 2 establishes the **shape** and the **ambiguous branch**. Doc 2 does **not** specify how `gateExecution` branches on `pending` — that is Doc 1's responsibility (`gateExecution` gains a *separate* `pending` branch when the pending/ack cycle exists). Here and now, `pending` is structurally present but always empty, so the ambiguous branch is the only new behavior.

---

## 5. Contracts that flip

Three existing contracts assert the fail-open stance ("malformed never suppresses"). Each flips to the fail-closed rule.

### 5.1 `src/execution.js:28-32` — header contract

**Before:**

```
 *   - Idempotency identity is (lead_id, channel): an existing Outreach Log row
 *     with a non-empty sent_at for the same identity suppresses a repeat attempt
 *     (DUPLICATE_SUPPRESSED). No reliance on random UUIDs.
```

**After:**

```
 *   - Idempotency identity is (lead_id, channel): an existing Outreach Log row
 *     with a non-empty sent_at for the same identity suppresses a repeat attempt
 *     (DUPLICATE_SUPPRESSED). A row with a known identity but no sent_at holds the
 *     lead (LOG_INCONSISTENT) until the outreach log is reconciled; a row with no
 *     identity is surfaced by the queue layer and never suppresses. No reliance
 *     on random UUIDs.
```

### 5.2 `src/execution.js:90-92` — `buildSentIndex` doc comment

**Before:**

```
 * A row suppresses only when it actually implies an attempt (lead_id + sent_at
 * present). Malformed rows never suppress.
```

**After:**

```
 * A row suppresses only when it actually implies an attempt (lead_id + sent_at
 * present). Identity-known malformed rows (lead_id present, sent_at empty) are
 * held LOG_INCONSISTENT by the gate, not dropped silently. Rows with no lead_id
 * are unattributable and surfaced by the queue layer, never suppressing.
```

### 5.3 `tests/execution-engine.test.js:422` — named test

**Before:**

```
test('gateExecution: empty sent_at can never suppress; suppressed leads block', () => {
```

The current assertions pin the fail-open stance: line 429 (`sent.size === 1`), and line 432 asserts `.ok === true` for a lead whose sent-row lacks `sent_at` ("uncommitted row cannot suppress").

**After:** the test is split/re-named to reflect the two-case rule:

```
test('gateExecution: identity-known malformed row holds LOG_INCONSISTENT; unattributable never suppresses; suppressed leads block', () => {
```

Assertions flip:
- identity-known row (`lead_id: 'TEST-EXEC-301'`, `sent_at: ''`) → `.ok === false`, `reason === LOG_INCONSISTENT` (was `.ok === true`),
- unattributable row (no `lead_id`) → `.ok === true`, **no** hold (unchanged — unattributable never suppresses),
- confirmed row (`sent_at` present) → still suppresses with `DUPLICATE` (unchanged),
- `BLOCKED` readiness behaviour (lines 433-436) unchanged.

### 5.4 `scripts/execution-dup-once.js:55` — comment

**Before:**

```
// The dedup trigger. REQUIRES both lead_id and sent_at — buildSentIndex drops
// any row missing either. channel must match the queue item's available_channel.
```

**After:**

```
// The dedup trigger. REQUIRES both lead_id and sent_at. This example provides a
// confirmed row, so it suppresses. (A row with a known lead_id but no sent_at
// would hold the lead LOG_INCONSISTENT instead; a row with no lead_id is surfaced
// by the queue layer and never suppresses.) channel must match the queue item.
```

---

## 6. Report count — `ambiguous_log_rows`

A new metric, **distinct from the queue layer's `malformed_outreach`**:

| Count | Layer | Counts |
|---|---|---|
| `malformed_outreach` (existing, `src/queue.js:356`) | queue | **all** rows missing `lead_id` **or** `sent_at` (both cases) |
| `ambiguous_log_rows` (**new**, execution report) | execution | **only** identity-known malformed rows held by the gate (`lead_id` present, `sent_at` empty) |

Rationale for the split: `malformed_outreach` is a queue-projection visibility count over the *log*, and it is shared with reconciliation's contract (see §7). `ambiguous_log_rows` is an execution-gate count over the *leads actually held*, and it must be attributable to real hold actions. Keeping them separate means later operators can compare "log says malformed n" vs "gate actually held m ≤ n".

Change surface: add `ambiguous_log_rows` to `REPORT_FIELDS` (`src/execution.js:70-82`) and to `computeMetrics` (`src/execution.js:265-279`), computed as the number of gate results with `reason === LOG_INCONSISTENT` (same counting style as `duplicate_suppressed`, line 275).

---

## 7. What does NOT change

- **`verify:frozen` is untouched.** The frozen-artifact manifest (`scripts/verify-frozen.js`, `frozen-artifacts.manifest.json`) does not include `src/execution.js`, `scripts/execution-dup-once.js`, or `tests/execution-engine.test.js`. The reconciliation contract is `fixtures/recon-fixtures.json:203` — *"A malformed record can never imply confirmed activity, so no status mismatch is surfaced here — the row is surfaced as an exception and the lead stays APPROVED_NO_OUTREACH."* That is an **orthogonal** contract (reconciliation: malformed ⇒ not confirmed ⇒ no status change). Fail-closed execution (malformed identity-known ⇒ hold before sending) does not contradict and does not alter it. The reconciliation engine (`src/reconcile.js`, `fixtures/recon-fixtures.json`) is untouched by this doc.
- **`buildSentIndex` stays backward-compatible.** Its confirmed-only Map contract is preserved for all existing callers (`src/execution.js:363`, and queue/global-tests) — it returns exactly what it returns today. The new behavior lives behind the new `buildSentScope` helper and the defaulted `gateExecution` third argument, so nothing that omits the new argument changes behaviour.
- **Queue artifact, response-capture, response-reconciliation:** unchanged. `MALFORMED_OUTREACH` surfacing stays as-is; this doc adds gate-side enforcement, not a second surfacing scheme.

---

## 8. Implementation order

1. **This doc (Doc 2) lands first** — it changes the dedup gate's contract (three-bucket `buildSentScope`, `LOG_INCONSISTENT` branch, flipped contracts in §5, `ambiguous_log_rows` metric).
2. **Doc 1 (`RESEND-REAL-EMAIL-DELIVERY-v1.md`) rebases onto it** — the Resend adapter, pending/ack cycle, and `updateRow` primitive build on the resulting three-bucket scope; Doc 1 adds the `pending` branch to `gateExecution` and fills the `pending` bucket.

Reversing the order means rebasing Doc 1's gate changes onto a moving target; this ordering freezes the gate contract Doc 1 consumes. Per `RESEND-REAL-EMAIL-DELIVERY-v1.md` §3 Interlock / §6: `buildSentScope(rows)` returns `{ confirmed, pending, ambiguous }`; the existing `buildSentIndex` (confirmed-only Map) is preserved for callers that don't opt into the new behavior.

---

## 9. Tests

- Unit (`tests/execution-engine.test.js`): the flipped test in §5.3, plus
  - `buildSentScope` returns the three-bucket shape with `pending` always empty pre-Doc-1;
  - a `LOG_INCONSISTENT` held lead increments `ambiguous_log_rows` only;
  - a multi-lead run with one held lead still completes the run (`COMPLETED`) and executes the others;
  - unattributable row → run completes, no hold, no new metric delta.
- Harness (`scripts/execution-once.js`, `scripts/execution-dup-once.js`): unaffected inputs still pass unchanged; the dup-once script demonstrates the confirmed-row suppress path with its verbatim comment section.

## 10. Risks / limitations

| Area | Status | Note |
|---|---|---|
| Operational claim (ambiguous = genuinely stuck) | assumption | a held lead needs manual reconciliation before re-execution; no auto-repair is specified here |
| `pending` bucket | dormant | empty and ungated until Doc 1 lands; must not be branched in this change |
| Live data exposure | not exercised here | held leads only occur when the real Outreach Log contains identity-known rows missing `sent_at` |
| Doc 1 filename binding | pending | Doc 1 currently refers to "Doc 2" by label; a follow-up commit may bind the filename reference once both docs exist |