import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../src/store/jsonl-store.ts";

interface StubRecord {
  readonly id: string;
  readonly value: number;
}

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("insert then readAll round-trips records", async (t) => {
  const store = tempStore(t);
  const record: StubRecord = { id: "a-1", value: 42 };
  await store.insert("businesses", record);

  const records = await store.readAll<StubRecord>("businesses");
  assert.deepEqual(records, [record]);
});

test("readAll returns empty for a missing kind file", async (t) => {
  const store = tempStore(t);
  const records = await store.readAll<StubRecord>("businesses");
  assert.deepEqual(records, []);
});

test("readLatestById returns the newest line for a duplicated id", async (t) => {
  const store = tempStore(t);
  await store.insert("orders", { id: "o-1", value: 1 } satisfies StubRecord);
  await store.insert("orders", { id: "o-1", value: 2 } satisfies StubRecord);
  await store.insert("orders", { id: "o-2", value: 3 } satisfies StubRecord);

  const latest = await store.readLatestById<StubRecord>("orders", "o-1");
  assert.deepEqual(latest, { id: "o-1", value: 2 });
});

test("readLatestById returns null for an unknown id", async (t) => {
  const store = tempStore(t);
  await store.insert("orders", { id: "o-1", value: 1 } satisfies StubRecord);
  const latest = await store.readLatestById<StubRecord>("orders", "nope");
  assert.equal(latest, null);
});

test("corrupt lines are skipped, not fatal", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "storefront-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, "businesses.jsonl"),
    '{"id":"a-1","value":1}\nnot-json\n{"id":"a-2","value":2}\n',
    "utf8",
  );

  const store = new JsonlStore(dir);
  const records = await store.readAll<StubRecord>("businesses");
  assert.deepEqual(records, [
    { id: "a-1", value: 1 },
    { id: "a-2", value: 2 },
  ]);
});

test("records with unicode round-trip intact", async (t) => {
  const store = tempStore(t);
  const record = { id: "u-1", value: 1, name: "Accra Coffee Co — Café ☕" };
  await store.insert("businesses", record as StubRecord);
  const records = await store.readAll("businesses");
  assert.deepEqual(records, [record]);
});

test("concurrent inserts are all persisted", async (t) => {
  const store = tempStore(t);
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      store.insert("products", { id: `p-${i}`, value: i } satisfies StubRecord),
    ),
  );
  const records = await store.readAll<StubRecord>("products");
  assert.equal(records.length, 25);
});
