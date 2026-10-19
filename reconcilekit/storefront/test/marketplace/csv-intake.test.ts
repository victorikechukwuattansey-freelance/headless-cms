import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import {
  CsvImportErrorCode,
  importCsv,
  parseAmountMinor,
  recordCsvImport,
  buildImportId,
  type CsvImportResult,
} from "../../src/marketplace/payment-sources/csv-intake.ts";
import { listPaymentEvents } from "../../src/marketplace/payment-sources/ingest.ts";
import { reconcilePaymentEvents } from "../../src/marketplace/payment-sources/to-reconcilekit.ts";
import type {
  ReconciliationConfig,
  ReconciliationReport,
} from "../../../src/domain/model.ts";

const FIXTURES = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "fixtures",
);

const prisma = getPrismaClient();

const NOW_MS = 1_784_290_000_000;

const TEST_CONFIG: ReconciliationConfig = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD", "GBP"],
};

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-csv-intake-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

const RECONCILEKIT_CSV = readFixture("synthetic-reconcilekit.csv");
const PAYSTACK_CSV = readFixture("synthetic-paystack-export.csv");

/* ------------------------------------------------------------------ */
/* Happy path: reconciliation-style columns.                          */
/* ------------------------------------------------------------------ */

test("importCsv normalizes reconcilekit-style rows into ingest-ready drafts", () => {
  const result = importCsv(RECONCILEKIT_CSV, { importId: "csv_abc" });
  assert.equal(result.acceptedRows, 3);
  assert.equal(result.rejectedRows, 0);
  assert.equal(result.dataRows, 3);
  assert.equal(result.importId, "csv_abc");
  assert.equal(result.source, "MANUAL_CSV");
  assert.equal(result.normalizedEvents.length, 3);

  const [a, b, c] = result.normalizedEvents;
  assert.equal(a.merchant_reference, "T545417640929901");
  assert.equal(a.amount, 1_200_000);
  assert.equal(a.currency, "NGN");
  assert.equal(a.status, "SUCCESS");
  assert.equal(a.occurred_at, 1_787_029_755_000);
  assert.equal(a.payment_source_reference, "src_101");
  assert.equal(a.transaction_id, null);
  assert.equal(a.source_confidence, "IMPORTED");
  assert.equal(a.source_event_id, "csv_abc_1");
  assert.equal(b.status, "FAILED");
  assert.equal(c.status, "PENDING");
});

/* ------------------------------------------------------------------ */
/* Happy path: Paystack-dashboard-style columns.                      */
/* ------------------------------------------------------------------ */

test("importCsv maps Paystack-style columns and preserves source reference as evidence", () => {
  const result = importCsv(PAYSTACK_CSV, { importId: "csv_ps" });
  assert.equal(result.acceptedRows, 3);
  assert.equal(result.rejectedRows, 0);

  const [a, b, c] = result.normalizedEvents;
  // Source Identifier is evidence, never an anchor.
  assert.equal(a.payment_source_reference, "sr_alpha_01");
  assert.equal(b.payment_source_reference, "sr_beta_02");
  assert.equal(c.payment_source_reference, "sr_gamma_03");
  // merchant reference is the file Reference column (matching key).
  assert.equal(a.merchant_reference, "T545417640929891");
  // Raw intake carries no marketplace anchor; CSV data never fabricates mk_txn_.
  assert.equal(a.transaction_id, null);
  assert.ok(!String(a).includes("mk_txn_"));
  // NS status maps to canonical status.
  assert.equal(a.status, "SUCCESS");
  assert.equal(b.status, "FAILED");
  // Occurred_at from ISO instant.
  assert.equal(a.occurred_at, Date.parse("2026-08-18T06:09:15Z"));
  // Amount in minor units (kobo), default amountUnit=minor.
  assert.equal(a.amount, 100_000);
  // Non-key columns land in source_attributes (customer email).
  assert.equal(a.source_attributes.customer_email, "customer-a@example.com");
});

/* ------------------------------------------------------------------ */
/* Amount units: deterministic minor vs decimal.                      */
/* ------------------------------------------------------------------ */

test("amountUnit controls minor vs decimal interpretation without guessing", () => {
  assert.equal(parseAmountMinor("100000", "minor"), 100_000);
  assert.equal(parseAmountMinor("1000", "decimal"), 100_000);
  assert.equal(parseAmountMinor("9750.00", "decimal"), 975_000);
  assert.equal(parseAmountMinor("250.5", "decimal"), 25_050);
  // Unit mismatch is rejected, not silently reinterpreted.
  assert.equal(parseAmountMinor("9750.00", "minor"), null);
  assert.equal(parseAmountMinor("12.5", "minor"), null);
  assert.equal(parseAmountMinor("", "minor"), null);

  const csv = [
    "merchant_reference,amount,currency,status,occurred_at",
    "T1,1000,NGN,SUCCESS,1787029755000",
  ].join("\n");
  const asMinor = importCsv(csv, { importId: "csv_u", amountUnit: "minor" });
  assert.equal(asMinor.normalizedEvents[0].amount, 1000);
  const asDecimal = importCsv(csv, {
    importId: "csv_u",
    amountUnit: "decimal",
  });
  assert.equal(asDecimal.normalizedEvents[0].amount, 100_000);
});

/* ------------------------------------------------------------------ */
/* Column mapping and validation errors.                              */
/* ------------------------------------------------------------------ */

test("importCsv rejects a missing required column with a typed error", () => {
  const result = importCsv(
    "merchant_reference,currency,status\nT1,NGN,SUCCESS\n",
    {
      importId: "csv_col",
    },
  );
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.rejectedRows, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(
    result.errors[0].code,
    CsvImportErrorCode.MISSING_REQUIRED_COLUMN,
  );
  assert.match(result.errors[0].message, /amount/);
});

test("importCsv rejects a conflicting (ambiguous) header", () => {
  const csv = "reference,amount,amount,currency\nT1,1,2,NGN\n";
  const result = importCsv(csv, { importId: "csv_conf" });
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.errors[0].code, CsvImportErrorCode.CONFLICTING_FIELDS);
});

test("importCsv rejects a row missing its reference", () => {
  const csv = "merchant_reference,amount,currency,status\n,100,NGN,SUCCESS\n";
  const result = importCsv(csv, { importId: "csv_ref" });
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.errors[0].code, CsvImportErrorCode.MISSING_REFERENCE);
});

test("importCsv rejects invalid amount", () => {
  const csv =
    "merchant_reference,amount,currency,status\nT1,not-a-number,NGN,SUCCESS\n";
  const result = importCsv(csv, { importId: "csv_amt" });
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.errors[0].code, CsvImportErrorCode.INVALID_AMOUNT);
});

test("importCsv rejects missing and unsupported currency", () => {
  const noCurrency =
    "merchant_reference,amount,currency,status\nT1,100,,SUCCESS\n";
  assert.equal(
    importCsv(noCurrency, { importId: "csv_cur1" }).errors[0].code,
    CsvImportErrorCode.MISSING_CURRENCY,
  );

  const badCurrency =
    "merchant_reference,amount,currency,status\nT1,100,ZAR,SUCCESS\n";
  assert.equal(
    importCsv(badCurrency, { importId: "csv_cur2" }).errors[0].code,
    CsvImportErrorCode.INVALID_CURRENCY,
  );
});

test("importCsv rejects unknown status without coercing it", () => {
  const csv =
    "merchant_reference,amount,currency,status\nT1,100,NGN,charged-back\n";
  const result = importCsv(csv, { importId: "csv_st" });
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.errors[0].code, CsvImportErrorCode.INVALID_STATUS);
});

test("importCsv rejects invalid timestamp", () => {
  const csv =
    "merchant_reference,amount,currency,status,occurred_at\nT1,100,NGN,SUCCESS,not-a-date\n";
  const result = importCsv(csv, { importId: "csv_ts" });
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.errors[0].code, CsvImportErrorCode.INVALID_TIMESTAMP);
});

test("importCsv produces row diagnostics for mixed valid/invalid imports", () => {
  const csv = [
    "merchant_reference,amount,currency,status,occurred_at",
    "T_OK_1,100,NGN,SUCCESS,1787029755000",
    "T_BAD_1,100,NGN,bogus,1787029755000",
    "T_OK_2,200,NGN,FAILED,1787030000000",
  ].join("\n");
  const result = importCsv(csv, { importId: "csv_mix" });
  assert.equal(result.acceptedRows, 2);
  assert.equal(result.rejectedRows, 1);
  assert.equal(result.rowDiagnostics.length, 3);
  const bad = result.rowDiagnostics.find((d) => d.error !== undefined);
  assert.ok(bad);
  assert.equal(bad.status, "rejected");
  assert.equal(bad.error?.code, CsvImportErrorCode.INVALID_STATUS);
  assert.equal(bad.rowIndex, 2);
});

/* ------------------------------------------------------------------ */
/* Idempotency and determinism.                                       */
/* ------------------------------------------------------------------ */

test("recordCsvImport is exactly-once: replay records nothing and resolves to the same event", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const first = await recordCsvImport(
      repos,
      importCsv(RECONCILEKIT_CSV, { importId: "csv_idem" }),
      {
        now: NOW_MS,
      },
    );
    assert.equal(first.recorded, 3);
    assert.equal(first.replayed, 0);

    const events = await listPaymentEvents(repos);
    assert.equal(events.length, 3);

    const second = await recordCsvImport(
      repos,
      importCsv(RECONCILEKIT_CSV, { importId: "csv_idem" }),
      {
        now: NOW_MS,
      },
    );
    assert.equal(second.recorded, 0);
    assert.equal(second.replayed, 3);

    const after = await listPaymentEvents(repos);
    assert.equal(
      after.length,
      3,
      "replay must not create duplicate store rows",
    );
    // Deterministic event identity: fresh import of same source + row → same id.
    assert.equal(second.events[0].event_id, first.events[0].event_id);
    assert.equal(
      second.events[0].idempotency_key,
      first.events[0].idempotency_key,
    );
  });
});

test("same import text yields a stable import id (replay-safe, non-random)", () => {
  const idA = buildImportId(PAYSTACK_CSV);
  const idB = buildImportId(PAYSTACK_CSV);
  assert.equal(idA, idB);
  assert.match(idA, /^csv_/);
});

/* ------------------------------------------------------------------ */
/* Provenance.                                                        */
/* ------------------------------------------------------------------ */

test("import result carries provenance: importId, row identity, and source reference", () => {
  const result = importCsv(PAYSTACK_CSV, { importId: "csv_prov" });
  assert.equal(result.importId, "csv_prov");
  const [row] = result.normalizedEvents;
  assert.equal(row.source_event_id, "csv_prov_1");
  assert.equal(row.payment_source_reference, "sr_alpha_01");
  // Source identity is never an mk_txn_ anchor.
  assert.ok(!row.payment_source_reference.startsWith("mk_txn_"));
  assert.equal(row.transaction_id, null);
});

/* ------------------------------------------------------------------ */
/* Architectural protection + rejection boundary.                     */
/* ------------------------------------------------------------------ */

test("CSV source references never become mk_txn_ anchors; raw intake has null transaction_id", () => {
  const result = importCsv(PAYSTACK_CSV, { importId: "csv_arch" });
  for (const event of result.normalizedEvents) {
    assert.equal(event.transaction_id, null);
    assert.notEqual(event.payment_source_reference, null);
    assert.ok(!(event.payment_source_reference ?? "").startsWith("mk_txn_"));
    assert.ok(!String(event.merchant_reference ?? "").startsWith("mk_txn_"));
  }
});

test("end-to-end: recorded CSV evidence flows through the unchanged engine boundary", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const result = importCsv(RECONCILEKIT_CSV, { importId: "csv_e2e" });
    await recordCsvImport(repos, result, { now: NOW_MS });
    const events = await listPaymentEvents(repos);
    assert.equal(events.length, 3);

    // The bridge delegates to the frozen reconcileRecords() engine; raw intake
    // (no marketplace anchor) contributes merchant-side evidence only.
    const report: ReconciliationReport = reconcilePaymentEvents(
      events,
      TEST_CONFIG,
    );
    assert.ok(report);
    assert.equal(report.summary.totalRecords, 3);
    assert.equal(report.results.length, 3);
  });
});

test("rejected rows produce no normalized events and no persisted records", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const csv =
      "merchant_reference,amount,currency,status\nT_BAD,100,NGN,bogus\n";
    const result = importCsv(csv, { importId: "csv_rej" });
    assert.equal(result.normalizedEvents.length, 0);
    const recorded = await recordCsvImport(repos, result, { now: NOW_MS });
    assert.equal(recorded.recorded, 0);
    assert.equal((await listPaymentEvents(repos)).length, 0);
  });
});
