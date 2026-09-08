import assert from "node:assert/strict";
import { test } from "node:test";
import { CsvError } from "csv-parse";
import type { MerchantPayment } from "../../domain/model.ts";
import { reconcileRecords } from "../../application/reconcile-records.ts";
import { DEFAULT_CONFIG, provider } from "../../domain/fixtures.ts";
import { MerchantCsvError, parseMerchantCsv } from "./csv.ts";

const HEADER =
  "merchant_reference,amount,currency,status,occurred_at,merchant_record_id";

function csv(lines: readonly string[]): string {
  return lines.join("\n");
}

test("1. valid CSV with headers maps into the exact canonical MerchantPayment shape", () => {
  const input = csv([HEADER, "REF-A,20000,NGN,SUCCESS,1700000000000,M-1", ""]);
  const payments = parseMerchantCsv(input);
  assert.deepEqual(payments, [
    {
      merchant_reference: "REF-A",
      amount: 20000,
      currency: "NGN",
      status: "SUCCESS",
      occurred_at: 1_700_000_000_000,
      merchant_record_id: "M-1",
    },
  ]);
});

test("2. multiple merchant records are returned in source order", () => {
  const payments = parseMerchantCsv(
    csv([
      HEADER,
      "REF-A,10000,NGN,SUCCESS,1700000000000,M-1",
      "REF-B,25000,NGN,FAILED,1700000001000,M-2",
      "REF-C,30000,USD,SUCCESS,1700000002000,M-3",
    ]),
  );
  assert.equal(payments.length, 3);
  assert.deepEqual(
    payments.map((payment) => payment.merchant_record_id),
    ["M-1", "M-2", "M-3"],
  );
});

test("3. quoted fields are preserved", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, '"REF-A,with-comma",20000,NGN,SUCCESS,1700000000000,"M-1"']),
  );
  assert.equal(payments[0].merchant_reference, "REF-A,with-comma");
  assert.equal(payments[0].merchant_record_id, "M-1");
});

test("4. escaped quotes are preserved", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, '"REF-""A""",20000,NGN,SUCCESS,1700000000000,M-1']),
  );
  assert.equal(payments[0].merchant_reference, 'REF-"A"');
});

test("5. configurable delimiter is honored", () => {
  const input =
    "merchant_reference;amount;currency;status;occurred_at;merchant_record_id\nREF-A;20000;NGN;SUCCESS;1700000000000;M-1";
  const payments = parseMerchantCsv(input, { delimiter: ";" });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount, 20000);
  assert.equal(payments[0].merchant_record_id, "M-1");
});

test("6. empty fields survive parsing", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, "REF-A,20000,,SUCCESS,1700000000000,"]),
  );
  assert.equal(payments[0].currency, "");
  assert.equal(payments[0].merchant_record_id, "");
});

test("7. CRLF input is supported", () => {
  const input = [
    HEADER,
    "REF-A,20000,NGN,SUCCESS,1700000000000,M-1",
    "REF-B,25000,NGN,SUCCESS,1700000001000,M-2",
  ].join("\r\n");
  const payments = parseMerchantCsv(input);
  assert.equal(payments.length, 2);
  assert.equal(payments[1].merchant_record_id, "M-2");
});

test("8. LF input is supported", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, "REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  assert.equal(payments.length, 1);
});

test("9. embedded newline inside a quoted field is preserved", () => {
  const input = csv([
    HEADER,
    '"REF-A\nmulti-line",20000,NGN,SUCCESS,1700000000000,M-1',
  ]);
  const payments = parseMerchantCsv(input);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].merchant_reference, "REF-A\nmulti-line");
});

test("10. empty reference is preserved", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, ",20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  assert.equal(payments[0].merchant_reference, "");
});

test("11. whitespace-only reference is preserved", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, "   ,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  assert.equal(payments[0].merchant_reference, "   ");
});

test("12. missing reference column maps to null", () => {
  const input =
    "amount,currency,status,occurred_at,merchant_record_id\n20000,NGN,SUCCESS,1700000000000,M-1";
  const payments = parseMerchantCsv(input);
  assert.equal(payments[0].merchant_reference, null);
});

test("13. valid integer amounts are converted to numbers", () => {
  const payments = parseMerchantCsv(
    csv([HEADER, "REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  assert.equal(typeof payments[0].amount, "number");
  assert.equal(payments[0].amount, 20000);
  assert.ok(Number.isSafeInteger(payments[0].amount));
});

test("14. malformed amounts produce adapter mapping errors, never coercion", () => {
  for (const amount of ["abc", "12.5", "-500", "20000.00", "2e3"]) {
    assert.throws(
      () =>
        parseMerchantCsv(
          csv([HEADER, `REF-A,${amount},NGN,SUCCESS,1700000000000,M-1`]),
        ),
      (error: unknown) =>
        error instanceof MerchantCsvError &&
        error.code === "MERCHANT_CSV_MAPPING_ERROR" &&
        error.record === 1,
    );
  }
});

test("15. status mapping follows the canonical tokens with UNKNOWN fallback", () => {
  const input = csv([
    "merchant_reference,amount,currency,status,occurred_at,merchant_record_id",
    "REF-A,10000,NGN,SUCCESS,1700000000000,M-1",
    "REF-B,10000,NGN,completed,1700000000000,M-2",
    "REF-C,10000,NGN,,1700000000000,M-3",
  ]);
  const payments = parseMerchantCsv(input);
  assert.deepEqual(
    payments.map((payment) => payment.status),
    ["SUCCESS", "UNKNOWN", null],
  );
});

test("16. currency passes through verbatim without adapter reinterpretation", () => {
  const payments = parseMerchantCsv(
    csv([
      HEADER,
      "REF-A,10000,NGN,SUCCESS,1700000000000,M-1",
      "REF-B,10000,,SUCCESS,1700000000000,M-2",
    ]),
  );
  assert.equal(payments[0].currency, "NGN");
  assert.equal(payments[1].currency, "");
});

test("17. timestamp mapping accepts epoch millis and explicit-timezone ISO-8601", () => {
  const payments = parseMerchantCsv(
    csv([
      HEADER,
      "REF-A,10000,NGN,SUCCESS,1700000000000,M-1",
      "REF-B,10000,NGN,SUCCESS,2023-11-14T22:13:20Z,M-2",
      "REF-C,10000,NGN,SUCCESS,2023-11-14T23:13:20+01:00,M-3",
      "REF-D,10000,NGN,SUCCESS,2023-11-14,M-4",
      "REF-E,10000,NGN,SUCCESS,,M-5",
    ]),
  );
  assert.deepEqual(
    payments.map((payment) => payment.occurred_at),
    [
      1_700_000_000_000,
      Date.parse("2023-11-14T22:13:20Z"),
      Date.parse("2023-11-14T23:13:20+01:00"),
      Date.parse("2023-11-14"),
      null,
    ],
  );
});

test("17b. naive date-time timestamps without timezone are rejected deterministically", () => {
  assert.throws(
    () =>
      parseMerchantCsv(
        csv([HEADER, "REF-A,10000,NGN,SUCCESS,2023-11-14T22:13:20,M-1"]),
      ),
    (error: unknown) =>
      error instanceof MerchantCsvError &&
      error.code === "MERCHANT_CSV_MAPPING_ERROR" &&
      error.message.includes("explicit timezone"),
  );
});

test("18. malformed CSV with an unclosed quote surfaces a parse error", () => {
  assert.throws(
    () =>
      parseMerchantCsv(
        csv([HEADER, '"REF-A,20000,NGN,SUCCESS,1700000000000,M-1']),
      ),
    (error: unknown) =>
      error instanceof MerchantCsvError &&
      error.code === "MERCHANT_CSV_PARSE_ERROR" &&
      error.cause instanceof CsvError &&
      error.cause.code === "CSV_QUOTE_NOT_CLOSED",
  );
});

test("19. inconsistent column counts are rejected by strict parsing", () => {
  assert.throws(
    () =>
      parseMerchantCsv(
        csv([
          HEADER,
          "REF-B,25000,NGN,SUCCESS",
          "REF-C,30000,NGN,SUCCESS,1700000000000,M-3",
        ]),
      ),
    (error: unknown) =>
      error instanceof MerchantCsvError &&
      error.code === "MERCHANT_CSV_PARSE_ERROR" &&
      error.cause instanceof CsvError &&
      error.cause.code === "CSV_RECORD_INCONSISTENT_FIELDS_LENGTH",
  );
});

test("20. parser errors are surfaced predictably with codes and causes", () => {
  try {
    parseMerchantCsv(
      csv([HEADER, '"REF-A,20000,NGN,SUCCESS,1700000000000,M-1']),
    );
    assert.fail("expected parse to throw");
  } catch (error) {
    assert.ok(error instanceof MerchantCsvError);
    assert.equal(error.code, "MERCHANT_CSV_PARSE_ERROR");
    assert.match(error.message, /merchant CSV parsing failed/);
    assert.ok(error.cause instanceof CsvError);
    assert.equal(error.record, null);
  }
});

test("extra columns beyond the canonical contract are tolerated", () => {
  const payments = parseMerchantCsv(
    csv([
      "merchant_reference,amount,currency,status,occurred_at,merchant_record_id,note",
      "REF-A,20000,NGN,SUCCESS,1700000000000,M-1,hello",
    ]),
  );
  assert.equal(payments.length, 1);
  assert.equal(payments[0].merchant_reference, "REF-A");
});

test("missing required columns produce a deterministic contract error", () => {
  assert.throws(
    () => parseMerchantCsv("merchant_reference,currency\nREF-A,NGN"),
    (error: unknown) =>
      error instanceof MerchantCsvError &&
      error.code === "MERCHANT_CSV_MISSING_COLUMN" &&
      error.message.includes('"amount"'),
  );
});

test("invalid delimiter options are rejected", () => {
  assert.throws(
    () => parseMerchantCsv("a,b\n", { delimiter: "ab" }),
    (error: unknown) =>
      error instanceof MerchantCsvError &&
      error.code === "MERCHANT_CSV_INVALID_OPTION",
  );
});

test("empty and header-only inputs produce no records", () => {
  assert.deepEqual(parseMerchantCsv(""), []);
  assert.deepEqual(parseMerchantCsv(HEADER), []);
});

test("blank lines are skipped without dropping meaningful records", () => {
  const payments = parseMerchantCsv(
    csv([
      HEADER,
      "",
      "REF-A,20000,NGN,SUCCESS,1700000000000,M-1",
      "",
      "REF-B,25000,NGN,SUCCESS,1700000001000,M-2",
    ]),
  );
  assert.deepEqual(
    payments.map((payment) => payment.merchant_record_id),
    ["M-1", "M-2"],
  );
});

test("adapter output feeds the existing Application boundary unchanged", () => {
  const payments: MerchantPayment[] = parseMerchantCsv(
    csv([
      HEADER,
      "REF-A,20000,NGN,SUCCESS,1700000000000,M-1",
      "REF-B,21000,USD,SUCCESS,1700000001000,M-2",
    ]),
  );
  const report = reconcileRecords({
    merchantPayments: payments,
    providerPayments: [
      provider({ reference: "REF-A", amount: 20000, provider_id: "P-1" }),
    ],
    config: DEFAULT_CONFIG,
  });
  assert.equal(report.summary.totalRecords, 3);
  assert.equal(report.summary.matched, 1);
  const outcomes = report.results.map((result) => result.outcome);
  assert.deepEqual(outcomes, ["MATCH", "MISSING_PROVIDER_RECORD"]);
});
