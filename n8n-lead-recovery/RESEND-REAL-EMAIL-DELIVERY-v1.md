# Resend REAL Email Delivery (Phase 6/7) — Design

**Version: Draft — 2026-09-21**
**Workflow:** `Resend-Real-Email-Delivery V1.json` (planned)
**Artifact lineage:** … → Outreach Queue & Planning V1 → **Outreach Execution & Delivery V1** → **Resend REAL Email Delivery (Phase 6/7)**

**Scope locked (email-first, provider locked).** This design extends the conservative execution boundary for **one** channel — `email` — through **one** real provider adapter — Resend. The `call` channel and every other provider stay on the existing V1 boundary (`DRY_RUN` default, `NOT_CONFIGURED` provider, typed adapter seam). Nothing in this design re-opens channel selection, provider abstraction, or the queue projection; it adds a real email delivery path with explicit in-flight accounting.

---

## 1. Purpose

Answer "how does an approved, queue-`READY` email lead actually get delivered by Resend, and what does the Outreach Log record before, during, and after the send" — with the property that a crash at any point never fabricates a confirmed send and never double-sends a confirmed one.

1. Consume the queue-`READY`, `email`-channel items exactly as Outreach Execution & Delivery V1 does.
2. Before calling Resend, **append a log row first** (`status: 'pending'`, `sent_at` empty) so the attempt is visible even if the run dies before the provider ack.
3. After Resend acknowledges, **update that same row** to `status: 'sent'`, `sent_at: runAt`, `provider_message_id`.
4. Re-attempt on the next run **only** rows without a confirmed send, relying on Resend's `Idempotency-Key` to make a retried call at-most-once.

---

## 2. Pending-row-first delivery pattern

For each gated, READY, `email`-channel item in `REAL` mode:

1. **Stage the pending row.** Append `{ lead_id, channel: 'email', status: 'pending', sent_at: '' }` to the Outreach Log before the provider call. `outreach_id = 'EX-' + lead_id + '-' + channel` stays deterministic.
2. **Call Resend** with a stable `Idempotency-Key` derived from the lead's `outreach_id` (same key on every retry of the same attempt).
3. **Ack.** On provider success, use the new `updateRow(lead_id, channel, { status: 'sent', sent_at: runAt, provider_message_id })` primitive to patch the pending row in place. On provider failure, the pending row stays pending → surfaced as in-flight / attempted, and retried on a later run under the same Idempotency-Key.

`DRY_RUN` mode unchanged: no pending row, no provider call, no write.

The dedup gate's next-run semantics follow from this: "next run re-attempts only rows without a confirmed send." A `pending` row is eligible for re-attempt; a `sent` row suppresses.

---

## 3. Outreach Log change

The Outreach Log gains **two columns** to make in-flight state explicit and confirmations auditable:

| Column | Placement | Type | Semantics |
|---|---|---|---|
| `status` | after `message_variant` | string | `pending` (in-flight attempt) \| `sent` (provider confirmed) \| blank (pre-Phase-6/7 rows, unknown) |
| `provider_message_id` | after `sent_at` | string | Resend's acked message id, recorded **only** on `sent`; blank/empty otherwise |

The code-side column list is the single source of truth: `src/reconcile.js` → `OUTREACH_COLUMNS` is extended from 20 to 22 columns (inserting `status` after `message_variant` and `provider_message_id` after `sent_at`). All read-side projections (`buildSentIndex` / sent-scope, reconciliation, response capture join) read through the same column list, so row → object mapping stays positional and consistent. This requires the Outreach Log sheet's header row to be extended with `status` and `provider_message_id` before the first REAL run — the code-side column list in `src/reconcile.js` and the sheet header must match, or read-side column indexing will be off.

---

> **Interlock with the malformed-row rule (Doc 2).** The `status` column is what distinguishes a legitimate in-flight pending row from a malformed row. The gate sees two rows that look identical on `lead_id` + `sent_at` alone:
>
> | Row state | `lead_id` | `sent_at` | `status` | Gate action |
> |---|---|---|---|---|
> | Confirmed sent | ✓ | ✓ | `sent` | suppress (dedup) |
> | Pending, in-flight | ✓ | — | `pending` | re-attempt (Idempotency-Key protects) |
> | Malformed, unknown | ✓ | — | *(blank)* | hold → `LOG_INCONSISTENT` |
> | Unattributable | — | any | any | surface + count only |
>
> `buildSentScope(rows)` therefore returns **`{ confirmed, pending, ambiguous }`** — three buckets, not two. `gateExecution(item, sent, ambiguous)` gains a branch for `pending` distinct from both dedup suppression and the malformed hold. The existing `buildSentIndex` contract (confirmed-only Map) is preserved for callers that don't opt into the new behavior.
>
> **Explicit choice on pending-retry:** re-attempting a pending row trusts Resend's `Idempotency-Key` for at-most-once delivery. This is a deliberate reliance on a provider guarantee, not an accident. The alternative — holding pending rows as `LOG_INCONSISTENT` too — is stricter but converts every crash mid-run into a manual reconciliation. The design accepts the provider dependency because idempotency keys exist precisely for this case.
>
> **Implementation order:** Doc 2 (malformed-row fix) lands first, because it changes the dedup gate's contract. Doc 1 (Resend adapter + pending/ack + `updateRow` primitive) builds on the resulting three-bucket `buildSentScope`. Reversing the order means rebasing Doc 1's gate changes onto a moving target.

---

## 4. Error handling / rate limits

- **Rate limits (429):** Resend rate-limit responses are handled with retry-and-backoff up to a bounded number of attempts for the run; a persistently rate-limited batch is reported as `EXECUTION_FAILED` with the rate-limit code surfaced, and the pending rows remain eligible for a later run.
- **Transient errors (5xx, network):** retried within the run with backoff. On exhaustion, the attempt ends `EXECUTION_FAILED`; the pending row is **not** marked sent.
- **Permanent errors (4xx other than 429, e.g. invalid `from`/`to`):** the item is rejected with the provider's error code; the pending row is marked with the failure and **not** re-attempted automatically.
- **Crash safety:** because the pending row is appended before the provider call, a crash mid-run leaves an in-flight `pending` row that is visually distinguishable from a confirmed `sent` row and from a malformed/unattributable row. Nothing except a confirmed Resend ack produces `status: 'sent'`.
- **Idempotency-Key:** a retried attempt that actually completed on the first call returns the original provider result under the same key — at-most-once delivery even when the run restarts.

---

## 5. Provider adapter (Resend)

A `ResendAdapter` implements the existing typed provider seam (`src/provider.js`): `{ isConfigured(), execute(channel, payload) }` where `channel === 'email'`. It:

- requires `RESEND_API_KEY` to be set, else reports `NOT_CONFIGURED` (safe default — nothing sends),
- builds the Resend Send request from the queue/approved-merged payload (email address + explicit `message_variant` as body; nothing fabricated),
- sets `Idempotency-Key: EX-<lead_id>-<channel>`,
- returns `{ success, provider_status, provider_message_id, error_code, error_message }` per the existing boundary contract.

Call-channel delivery is **out of scope** for this adapter (stays `NOT_CONFIGURED` / no provider).

---

## 6. Gate & sent-scope changes

`src/execution.js`:

- `buildSentIndex` stays as-is (confirmed-only Map) for callers that do not opt into the new in-flight semantics.
- A new sent-scope helper distinguishes `confirmed`, `pending`, and `ambiguous` rows; `gateExecution` branches on all three. The three-bucket shape and the `pending`/malformed branch contract are fixed by the Interlock block in §3.
- `updateRow` is a new write primitive on the Outreach Log (in-place patch of a pending row). It is the **only** in-place update; appends still go through the single append surface.

---

## 7. Manual gateway / tests

- Unit: pending-row-first ordering (pending appended before provider call), ack → in-place update, failure → pending preserved, Idempotency-Key stability across retries, three-way gate on `{ confirmed, pending, ambiguous }`.
- Harness: extend the existing execution harness MockSheets path with a Seeded pending row → verify no double-send under the key.
- Safety: `DRY_RUN` produces zero pending rows, zero provider calls, zero updates. `NOT_CONFIGURED` refuses before any row exists.

---

## 8. Risks / limitations

| Area | Status | Note |
|---|---|---|
| Provider dependency (Idempotency-Key) | accepted | deliberate, per §3 Interlock |
| Sheet header migration | required | `status` + `provider_message_id` must be added to the sheet header before the first REAL run (§3) |
| Live Resend validation | NOT RUN in this environment | no `RESEND_API_KEY` / live spreadsheet creds; adapter + harness validated offline |
| Call channel / other providers | unchanged | stays on V1 boundary |