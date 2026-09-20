# Prospect Finder — pairedItem lineage fix (R9)

**Date:** 2026-09-19
**Artifact:** `Lead Recovery Engine — Prospect Finder & Validation V1.json`
**Live error (operator report):** evaluating `={{ $('Set Status Running').item.json.input_id }}` on the
`Update Status Completed` Google Sheets node threw
`Paired item data for item from node 'Dedup & Prepare Verified' is unavailable.` (n8n 2.37.10 Cloud).

---

## 1. Root cause

n8n resolves `$('<node>').item` by walking the input item's **paired-item thread** — the metadata chain
that links each item to the input item(s) it was produced from. When a node does not control linking,
n8n guesses (docs, *How items link through workflows*):

* single input / single output → output links to the input;
* single input / multiple outputs → all outputs link to that input;
* multiple inputs & outputs → auto-links only when it can keep the input items (reorder / drop some) or
  when the input and output counts are equal (link in order); otherwise it cannot link;
* **a Code node that adds/returns new items must set `pairedItem`** (docs, *Preserving linking in the
  Code node*) — and that obligation only applies when it has more than one incoming item.

`Dedup & Prepare Verified` is a Code node that receives **multiple** items (the row stream from
`Write Raw Leads` for the current loop iteration) and returns **new** objects with an **unequal count**:
it drops rows with no `dedupe_key`, drops rows whose key already exists in `Verified Leads`, de-dupes
keys seen earlier in the same run, and (when nothing survives) returns a single `_noNewVerified`
sentinel. Because the output is new + unequal, n8n cannot auto-link it, and the node never set
`pairedItem` — so the thread terminated there. `Update Status Completed` is a fan-in (it also receives
the verified path via `Write Verified Leads`), and its `input_id` expression needs to resolve back to the
`Set Status Running` item; with the thread cut at Dedup, n8n reported the break at Dedup.

Every other node on both paths to `Update Status Completed` auto-links, so Dedup was the **only** break
(analysis in §7).

## 2. Exact node / function where lineage is lost

* **Node:** `Dedup & Prepare Verified` (`id: 212ae7c6-fc5a-4c34-ac26-e67bb76fb35b`, type
  `n8n-nodes-base.code`), body in `src/prospect-finder-embedded-code.js`.
* **Emission sites that lacked `pairedItem`:**
  * the `verified.push({ json: { … } })` loop (the projected Verified Leads rows), and
  * the `return [{ json: { _noNewVerified: true, _message: '…' } }]` sentinel.
* **Consumer that surfaced the error:** `Update Status Completed`
  (`id: 87786833-9812-424f-9173-92a4b64d5518`, `n8n-nodes-base.googleSheets`),
  parameter `columns.value.input_id = ={{ $('Set Status Running').item.json.input_id }}`
  (artifact line ~985; contract `src/prospect-finder-workflow-contract.js:1040`).

## 3. Exact fix

In the canonical body (`src/prospect-finder-embedded-code.js`, `Dedup & Prepare Verified`), keep the
dedupe business logic and field projection byte-identical, change only how the loop is iterated and what
metadata each emitted item carries:

* iterate with an index — `for (let index = 0; index < items.length; index++)`;
* each surviving row is emitted with `pairedItem: { item: index }` — it links to the **exact** input item
  that produced it (dropped/skipped inputs do not shift the mapping);
* the `_noNewVerified` sentinel is emitted with `pairedItem: { item: 0 }` **when at least one input item
  exists** — every input of a single loop iteration traces to the same `Set Status Running` item, so
  index 0 is a correct, deterministic representative.

The artifact was regenerated with the repository's builder (never hand-edited):

```
node scripts/build-prospect-finder-workflow.js
```

This preserves engine ↔ Code-node parity: the byte-identity block in
`tests/prospect-finder-engine.test.js` (C-A §5) and the builder pin in
`tests/prospect-finder-builder.test.js` still hold. The builder-test hash anchor and byte length were
updated to the new, legitimately regenerated fingerprint:

| | before | after |
| --- | --- | --- |
| SHA-256 | `7e335f38b50d1742fbacf502f8b73458f0bdea13c12b9df884df5f097e407511` | `30a5020506850b079eea48f3932c41bf4fc20c32e224f81c059ee6a9162f2308` |
| bytes | 88,253 | 88,855 |

Diff scope (verified against `HEAD`): **only** `Dedup & Prepare Verified`'s `parameters` changed.
`connections`, `meta`, `name`/`id`/`versionId`/`active`, and the node count (33) are byte-identical —
i.e. the artifact diff is the single Dedup `jsCode` line.

## 4. Tests

New regression tests in `tests/prospect-finder-engine.test.js` (describe block
`Dedup & Prepare Verified (aggregation)`) pin the lineage output contract:

1. a multi-input batch with a keyless row and a within-run duplicate emits
   `[{ item: 0 }, { item: 3 }]` — each verified row links to its own source index;
2. the `TEST-PF-DEDUP-001` cross-provider duplicate links to its **first** occurrence (FSQ wins);
3. the `_noNewVerified` sentinel links to `{ item: 0 }` when inputs exist;
4. the sentinel omits `pairedItem` only in the degenerate zero-input `alwaysOutputData` case.

| gate | before | after |
| --- | --- | --- |
| `npm test` | 1257 pass / 0 fail | **1261 pass / 0 fail** |
| Prospect Finder suites (`builder`, `engine`, `error-paths`) | 137 pass | **141 pass / 0 fail** |
| `npm run verify:frozen` | 25 / 25 PASS | **25 / 25 PASS** |
| `npm run enrichment:security` | exit 0 | **exit 0 (GREEN)** |

## 5. Frozen manifest

**No manifest change was required.** The Prospect Finder artifact, its contract, and its embedded-code
module are **not** entries in `frozen-artifacts.manifest.json`, so the legitimate regeneration did not
touch any frozen hash. `npm run verify:frozen` remains **25 / 25 PASS** and no entry was added,
regenerated, or suppressed. The artifact's own hash anchor lives in the builder test (§3) and was
updated there per the repository's established procedure.

## 6. Topology

**Unchanged.** No node was added, removed, renamed, re-typed, moved, or rewired; no Merge/IF/Sheets/Merge
parameter was touched. Only the Dedup Code-node body changed. `connections` and `meta` are byte-identical
to `HEAD` (§3).

## 7. Other downstream expressions — none affected

There is exactly **one** lineage-dependent expression in the whole workflow:
`$('Set Status Running').item` in `Update Status Completed` (the failing one). All other cross-node
references live inside Code-node `jsCode` and use `.first()` / `.all()` (which do not require a thread):
`$('Cache Dedup Keys').all()` (Dedup), `$('Build FSQ|OSM|GPL API Query')` in the Process nodes, and
`$('Build OSM API Query').first()` in `Handle API Error`. None is affected by this change.

Why the other Code nodes on the path were intentionally left unchanged:

* `Process FSQ` / `Process OSM` / `Process GPL`, `FSQ`/`OSM`/`GPL Error Envelope`, `Handle API Error` —
  each runs on a **single** incoming item, so n8n handles linking automatically ("n8n automatically
  handles item linking for single items").
* `Filter Empty Envelopes` — returns a filtered **subset of the same item references**, which the docs
  cover as an auto-linkable case.
* `Prepare Verified Sheet Row` — maps `$input.all()` to new objects with an **equal** count, so n8n links
  them in order.
* `Write Raw Leads` / `Write Verified Leads` / Merge / IF — declarative nodes that preserve the thread.

The live error naming Dedup (not `Process FSQ`, `Filter Empty Envelopes`, or `Prepare Verified Sheet Row`)
is consistent with this: Dedup was the only thread-terminating node.

## 8. Residual / edge case (documented, not regressed)

When all providers return empty, the A.11 `_noResults` sentinels keep Merge non-empty, so in practice
Dedup receives at least one item and the sentinel links to index 0. In the purely theoretical case where
Dedup executes via `alwaysOutputData` with **zero** input items, there is no upstream item to link to, so
the sentinel is emitted without `pairedItem` (test 4). This is unchanged behaviour for an input-less
execution and cannot be resolved by an index — it is not the observed failure and is left as-is.

## 9. Files changed

* `src/prospect-finder-embedded-code.js` — Dedup body gains `pairedItem`; module header gains an R9
  revision note (no other body touched).
* `Lead Recovery Engine — Prospect Finder & Validation V1.json` — regenerated by the builder
  (Dedup `jsCode` only).
* `tests/prospect-finder-builder.test.js` — hash anchor + byte length updated; comment notes R9.
* `tests/prospect-finder-engine.test.js` — four lineage regression tests added.
* `reports/PROSPECT-FINDER-PAIRED-ITEM-LINEAGE-FIX-REPORT.md` — this report.

No `.item` was replaced with `.first()`/`.all()[index]`, no hardcoded IDs, no dedupe business-logic,
field, schema, provider, or topology change; Response Interpretation and enrichment workstreams were not
touched.
