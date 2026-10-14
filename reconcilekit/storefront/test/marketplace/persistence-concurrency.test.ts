import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";

/**
 * Phase 3F evidence harness — test-only.
 *
 * Does NOT implement durable persistence. Demonstrates whether the current
 * append-only JSONL store tolerates cross-instance concurrency and truncation,
 * so the 3F gate has concrete evidence either way.
 *
 * The store rejects unknown kinds at runtime (jsonl-store.ts filePath lookup
 * returns undefined and join() throws). The harness therefore uses a real
 * store kind (`payment_events`) and writes arbitrary test shapes into it via
 * a loose handle. The store is schemaless on disk — kind only selects the
 * filename — so this is safe and lets us exercise file-level behaviour
 * without inventing production kinds.
 */

const TEST_KIND = "payment_events";

interface LooseStore {
  insert(kind: string, record: unknown): Promise<unknown>;
  readAll<T>(kind: string): Promise<readonly T[]>;
  readLatestById<T>(kind: string, id: string): Promise<T | null>;
}

function newLooseStore(dir: string): LooseStore {
  return new JsonlStore(dir) as unknown as LooseStore;
}

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "storefront-3f-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function everyJsonlLineParses(dir: string): void {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    const raw = readFileSync(join(dir, file), "utf8");
    for (const line of raw.split("\n")) {
      if (line.length === 0) continue;
      assert.doesNotThrow(
        () => JSON.parse(line),
        `corrupt line in ${file}: ${line.slice(0, 80)}`,
      );
    }
  }
}

test("3F: two store instances on the same dir persist all concurrent inserts", async (t) => {
  const dir = tempDir(t);
  const storeA = newLooseStore(dir);
  const storeB = newLooseStore(dir);

  const N = 50;
  const tasks: Promise<unknown>[] = [];
  for (let i = 0; i < N; i++) {
    tasks.push(storeA.insert(TEST_KIND, { id: `a_${i}`, from: "A", i }));
    tasks.push(storeB.insert(TEST_KIND, { id: `b_${i}`, from: "B", i }));
  }
  await Promise.all(tasks);

  const all = await storeA.readAll<{ id: string; from: string; i: number }>(
    TEST_KIND,
  );
  assert.equal(all.length, 2 * N, "all records persisted across instances");

  const ids = new Set(all.map((r) => r.id));
  assert.equal(ids.size, 2 * N, "no duplicate ids, no lost ids");

  everyJsonlLineParses(dir);
});

test("3F: cross-instance writes for the same id keep last-write-wins semantics", async (t) => {
  const dir = tempDir(t);
  const storeA = newLooseStore(dir);
  const storeB = newLooseStore(dir);

  await Promise.all([
    storeA.insert(TEST_KIND, { id: "shared", from: "A", v: 1 }),
    storeB.insert(TEST_KIND, { id: "shared", from: "B", v: 2 }),
  ]);

  const latest = await storeA.readLatestById<{
    id: string;
    from: string;
    v: number;
  }>(TEST_KIND, "shared");

  assert.ok(latest !== null, "latest record found");
  assert.equal(latest.id, "shared");
  assert.ok(
    latest.from === "A" || latest.from === "B",
    "no fabricated merge; writer identity preserved",
  );

  everyJsonlLineParses(dir);
});

test("3F: a truncated line is tolerated by readAll — data loss, not corruption", async (t) => {
  const dir = tempDir(t);
  const store = newLooseStore(dir);

  await store.insert(TEST_KIND, { id: "good_1", data: "ok" });
  await store.insert(TEST_KIND, { id: "good_2", data: "ok" });

  appendFileSync(join(dir, `${TEST_KIND}.jsonl`), '{"id":"partial","data":"o');

  const all = await store.readAll<{ id: string; data: string }>(TEST_KIND);
  assert.equal(all.length, 2, "only complete records returned");
  assert.ok(
    all.every((r) => r.id.startsWith("good_")),
    "no partial record leaked",
  );
});

test("3F: readLatestById still resolves correctly when a corrupt line precedes the latest", async (t) => {
  const dir = tempDir(t);
  const store = newLooseStore(dir);

  await store.insert(TEST_KIND, { id: "r1", v: 1 });
  appendFileSync(join(dir, `${TEST_KIND}.jsonl`), "garbage not json\n");
  await store.insert(TEST_KIND, { id: "r1", v: 2 });

  const latest = await store.readLatestById<{ id: string; v: number }>(
    TEST_KIND,
    "r1",
  );
  assert.ok(latest !== null);
  assert.equal(latest.v, 2, "latest valid record wins; corrupt line skipped");
});

test("3F: concurrent inserts from one instance are all persisted with no corruption", async (t) => {
  const dir = tempDir(t);
  const store = newLooseStore(dir);

  const N = 200;
  const tasks: Promise<unknown>[] = [];
  for (let i = 0; i < N; i++) {
    tasks.push(store.insert(TEST_KIND, { id: `row_${i}`, i }));
  }
  await Promise.all(tasks);

  const all = await store.readAll<{ id: string; i: number }>(TEST_KIND);
  assert.equal(all.length, N, "all inserts persisted");
  assert.equal(new Set(all.map((r) => r.id)).size, N, "no duplicates");

  everyJsonlLineParses(dir);
});
