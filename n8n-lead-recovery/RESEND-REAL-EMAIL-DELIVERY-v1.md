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
| `status` | column U (after `notes`) | string | `pending` (in-flight attempt) \| `sent` (provider confirmed) \| blank (pre-Phase-6/7 rows, unknown) |
| `provider_message_id` | column V (after `status`) | string | Resend's acked message id, recorded **only** on `sent`; blank/empty otherwise |

The code-side column list is the single source of truth: `src/reconcile.js` → `OUTREACH_COLUMNS` is extended from 20 to 22 columns (appending `status` at U and `provider_message_id` at V). All read-side projections (`buildSentIndex` / sent-scope, reconciliation, response capture join) read through the same column list, so row → object mapping stays positional and consistent.

Header extension landed in `8a6e84b`. Sheet columns U/V (`status`, `provider_message_id`) present; `OUTREACH_COLUMNS` extended to 22; script fetch ranges updated to `A2:V`; `buildLogRow` emits canonical-empty for both until pending/ack writes land.

---

> **Interlock with the malformed-row rule (Doc 2 — `MALFORMED-ROW-FAIL-CLOSED-v1.md`).** The `status` column is what distinguishes a legitimate in-flight pending row from a malformed row. The gate sees two rows that look identical on `lead_id` + `sent_at` alone:
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
> **Implementation order:** Doc 2 (`MALFORMED-ROW-FAIL-CLOSED-v1.md`, malformed-row fix) lands first, because it changes the dedup gate's contract. Doc 1 (Resend adapter + pending/ack + `updateRow` primitive) builds on the resulting three-bucket `buildSentScope`. Reversing the order means rebasing Doc 1's gate changes onto a moving target.

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
- builds the Resend Send request from the resolver output concatenated with the routing payload (`resolveMessage({ lead, variant })` → `{ from, subject, text, html }` + `buildPayload` routing fields; nothing fabricated),
- sets `Idempotency-Key: EX-<lead_id>-<channel>`,
- returns `{ success, provider_status, provider_message_id, error_code, error_message }` per the existing boundary contract.
- `src/message-body.js` — new module:
  `resolveMessage({ lead, variant }) → { from, to, subject, text, html }`;
  template lookup from `templates/<variant>.json`

Call-channel delivery is **out of scope** for this adapter (stays `NOT_CONFIGURED` / no provider).

---

### Message body resolution

A new module — `src/message-body.js` — owns turning a queue item
into the full email body Resend requires. It sits between
`buildPayload` and the adapter: `buildPayload` produces the
routing payload (`to`, `outreach_id`, `lead_id`, `channel`,
`message_variant`); `resolveMessage` produces the content payload
(`from`, `subject`, `text`, `html`). The adapter concatenates both.

**Interface:**

```js
// src/message-body.js
function resolveMessage({ lead, variant }) {
  // Returns: { from, to, subject, text, html }
  // - variant:   defaults to 'cold-outreach-v1' when lead.message_variant is ''
  // - from:      process.env.RESEND_FROM_EMAIL (adapter fails closed if empty on REAL send)
  // - to:        lead.email
  // - subject/text/html: rendered from templates/<variant>.json
}
```

**Template layout:** `templates/<variant>.json` containing
`{ subject, text, html }`, each a string with `{{lead.field}}`
placeholders. Rendering is `String.replace(/\{\{([\w.]+)\}\}/g, ...)`
— no template engine. Missing placeholders render empty
(template-authoring error, not a send-blocking one). Missing
template file throws (misconfiguration, blocks the run).

**Variant sourcing (decision, 2026-09-21):** the resolver defaults
to `cold-outreach-v1` when `lead.message_variant` is empty. No
upstream change to the queue or approval stages. Multi-variant
support and A/B routing are deferred; the resolver interface
already accepts a variant name, so the switch can be flipped later
without re-architecting.

**DRY_RUN behavior:** `resolveMessage` runs in DRY_RUN (it makes
no network calls). `from` is populated from env if present, left
empty if not. The adapter is the only place that fails on an empty
`from`, and only on REAL send. This keeps the DRY_RUN verification
path free of env-config requirements.

**Deliberately deferred:**

- Multi-variant message-body selection and A/B routing
  (interface accepts a variant; only `cold-outreach-v1` populated)

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
| Sheet header migration | landed | Header extension landed in `8a6e84b`; sheet columns U/V (`status`, `provider_message_id`) present; `OUTREACH_COLUMNS` at 22; `buildLogRow` emits canonical-empty until pending/ack writes land (§3) |
| Live Resend validation | NOT RUN in this environment | no `RESEND_API_KEY` / live spreadsheet creds; adapter + harness validated offline |
| Call channel / other providers | unchanged | stays on V1 boundary |