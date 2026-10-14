# Phase 3F — Durable Persistence Findings

**Project:** ReconcileKit (Core + Storefront)
**Type:** Evidence artifact (test-only harness; no production surface, no dependency)
**Date:** 2026-10-14
**Basis:** `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §10 (3F gate)
**Harness:** `storefront/test/marketplace/persistence-concurrency.test.ts`

---

## 1. What was tested

The append-only JSONL store (`storefront/src/store/jsonl-store.ts`) was
exercised under five failure modes a durable-persistence track would be
intended to address:

1. Two store instances writing concurrently to the same directory.
2. Two instances writing records with the same `id` (last-write-wins).
3. A truncated line (simulated mid-write crash).
4. A corrupt line preceding the latest record.
5. High-volume concurrent inserts from one instance.

No snapshot, lock, or migration was implemented. The harness observed the
current behaviour directly.

## 2. Results — 5/5 passed

| Test                                    | Concern                         | Result                                                                                         |
| --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Two instances, concurrent inserts       | Interleaving, lost writes       | **PASS** — all 100 records persisted, no duplicates, no byte-level corruption                  |
| Cross-instance same-id write            | Fabricated merge                | **PASS** — latest read returns a record from one of the two writers; writer identity preserved |
| Truncated line                          | Partial JSON record             | **PASS** — `readAll` returns only the complete records; the partial line is not surfaced       |
| Corrupt line before latest              | `readLatestById` mis-resolution | **PASS** — latest valid record wins; corrupt line skipped                                      |
| High-volume single-instance concurrency | Lost writes under load          | **PASS** — 200/200 persisted, no duplicates                                                    |

Every JSONL line produced during the tests parses cleanly at the byte level,
except where a corrupt line was deliberately injected.

## 3. Interpretation

Under the failure modes exercised:

- **Concurrent single-line appends do not interleave.** OS-level atomic
  append semantics for small writes are sufficient in this environment.
- **Truncation is tolerated as data loss, not corruption.** A partial line
  does not break `readAll` or `readLatestById`.
- **No fabricated merges.** When two writers race on the same id, the reader
  returns one of the two records, never a synthesized combination.
- **Per-line atomicity holds at the observed write volumes** (single-digit
  KB per record).

The failure modes the pilot produced did not include data-loss or concurrency
symptoms, and the harness confirms that the current store tolerates the
concurrency and crash scenarios most relevant to the pilot's single-operator
usage. The 3F track's entry condition ("only if pilot shows restart/concurrency
data loss or multi-operator necessity") is therefore **not met**.

## 4. Incidental observation (recorded, not a defect)

During harness development, `JsonlStore.filePath` was found to throw a raw
`TypeError [ERR_INVALID_ARG_TYPE]` from `node:path.join` when passed a kind
that is not in the store's `KINDS` map (`jsonl-store.ts:103`). Production
call sites cannot trigger this — the `StoreKind` union on `insert`/`readAll`
prevents unknown kinds at compile time — so this is not a reachable defect.

Recorded as an observation only:

- If a future runtime surface (an operator-configured kind name, a
  webhook-supplied kind, etc.) were ever able to reach `filePath` with an
  arbitrary string, the raw `TypeError` would be an unhelpful error to
  surface. A typed error would be preferable at that point.
- No change is proposed. The current design is correct; the observation is a
  note for any future work that adds a runtime-supplied kind.

## 5. 3F gate disposition

**3F remains DEFERRED — not triggered by evidence.**

The 3A pilot produced no restart or concurrency data-loss symptom. This
harness confirms the current append-only JSONL store tolerates the realistic
single-operator failure modes. A durable store would provide:

- Multi-operator write safety (not currently a stated need).
- Snapshot/rollback (not currently a stated need).
- Lossless migration from JSONL (only meaningful once a durable target exists).

None of these is justified by the evidence. If 3F is opened later, it should
be scoped against a concrete multi-operator or durability requirement, not
against the current single-process demo. Opening requires explicit owner
approval under the freeze's §14 procedure.

## 6. Constraints preserved

- No production surface added.
- No new runtime dependency.
- `reconcilekit/src/**` untouched.
- No change to `jsonl-store.ts`, matcher, wallet, truth, or identifier
  hierarchy.
- No new discrepancy codes.
