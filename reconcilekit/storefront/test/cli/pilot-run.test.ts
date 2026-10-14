import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { PaystackResponse } from "../../../src/adapters/providers/paystack/paystack.ts";
import { mapPaystackResponses } from "../../../src/adapters/providers/paystack/paystack.ts";
import {
  EXIT_INPUT_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE_ERROR,
  runPilotCli,
  type PilotRunIo,
} from "../../src/cli/pilot-run.ts";

const NOW_MS = 1_784_290_000_000;

const MERCHANT_CSV = [
  "reference,amount,currency,status,occurred_at,source_reference",
  "T545417640929901,1200000,NGN,SUCCESS,1787029755000,src_101",
  "T545417640929902,3500000,NGN,FAILED,1787030000000,src_102",
  "T545417640929903,4500000,NGN,PENDING,1787030255000,src_103",
].join("\n");

function verifyResponse(
  reference: string,
  id: number,
  amount: number,
  paidAt: string,
): PaystackResponse {
  return {
    status: true,
    message: "Verification successful",
    data: {
      id,
      reference,
      amount,
      currency: "NGN",
      status: reference.endsWith("902") ? "failed" : "success",
      created_at: paidAt,
      paid_at: paidAt,
      transaction_date: paidAt,
    },
  };
}

/** Two provider envelopes aligned with the merchant fixture for exact matches. */
const PROVIDER_JSON = JSON.stringify([
  verifyResponse(
    "T545417640929901",
    4123456789,
    1200000,
    "2026-08-18T05:09:15.000Z",
  ),
  verifyResponse(
    "T545417640929902",
    4123456790,
    3500000,
    "2026-08-18T05:13:20.000Z",
  ),
]);

const PROVIDER_CSV_CONTENT =
  "Reference,Amount Paid,Currency,Status\nT1,1200000,NGN,success\n";

/** Committed synthetic fixtures exercised by the phase 3A local provider path. */
const SYNTHETIC_MERCHANT_CSV = fileURLToPath(
  new URL("../fixtures/synthetic-reconcilekit.csv", import.meta.url),
);
const SYNTHETIC_PAYSTACK_VERIFY_JSON = fileURLToPath(
  new URL("../fixtures/synthetic-paystack-verify.json", import.meta.url),
);

const BASE_ARGS = [
  "--merchant",
  "merchant.csv",
  "--provider",
  "provider.json",
  "--timestamp-field",
  "paid_at",
  "--currencies",
  "NGN",
];

const LIVE_ARGS = [
  "--merchant",
  "merchant.csv",
  "--live-paystack",
  "--timestamp-field",
  "paid_at",
  "--currencies",
  "NGN",
];

const PACKAGE_JSON_PATH = fileURLToPath(
  new URL("../../package.json", import.meta.url),
);

function fakeIo(
  files: Record<string, string> = {},
  overrides: Partial<PilotRunIo> = {},
): { io: PilotRunIo; out: () => string; err: () => string } {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  return {
    io: {
      readFile: (filePath) => {
        if (!(filePath in files)) {
          throw new Error(
            `ENOENT: no such file or directory, open '${filePath}'`,
          );
        }
        return files[filePath];
      },
      writeOut: (text) => outChunks.push(text),
      writeErr: (text) => errChunks.push(text),
      now: () => NOW_MS,
      ...overrides,
    },
    out: () => outChunks.join(""),
    err: () => errChunks.join(""),
  };
}

function liveFetch(
  responses: PaystackResponse[],
  capture: { secret?: string },
): NonNullable<PilotRunIo["fetchPaystackTransactions"]> {
  return async (options) => {
    capture.secret = options.secretKey;
    return { responses, rateLimit: null };
  };
}

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "pilot-run-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/* ------------------------------------------------------------------ */
/* Help and usage.                                                    */
/* ------------------------------------------------------------------ */

test("help explains preview vs --run, the provider CSV rule, and exit codes", async () => {
  const { io, out } = fakeIo();
  assert.equal(await runPilotCli(["--help"], io), EXIT_SUCCESS);
  assert.ok(out().includes("Usage:"));
  assert.ok(out().includes("--run"));
  assert.ok(out().includes("--merchant"));
  assert.ok(out().includes("--live-paystack"));
  assert.ok(out().includes("Provider CSV is NOT supported"));
  assert.ok(out().includes("Exit codes"));
  assert.ok(out().includes("Phase 3B"));
});

test("missing required options produce usage errors", async () => {
  const { io, err } = fakeIo();
  assert.equal(
    await runPilotCli(["--merchant", "merchant.csv"], io),
    EXIT_USAGE_ERROR,
  );
  assert.ok(err().includes("missing required option --provider"));
});

test("--provider and --live-paystack are mutually exclusive", async () => {
  const { io, err } = fakeIo();
  assert.equal(
    await runPilotCli([...BASE_ARGS, "--live-paystack"], io),
    EXIT_USAGE_ERROR,
  );
  assert.ok(err().includes("mutually exclusive"));
});

test("invalid option values are usage errors", async () => {
  const cases: ReadonlyArray<readonly string[]> = [
    [...BASE_ARGS, "--output", "yaml"],
    [...BASE_ARGS, "--amount-unit", "fractional"],
    [...BASE_ARGS, "--timestamp-field", "settled_at"],
    [...BASE_ARGS, "--currencies", ",,"],
    [...BASE_ARGS, "--tolerance-ms", "abc"],
    [...BASE_ARGS, "--merchant", "merchant.csv", "--merchant", "again.csv"],
    [...BASE_ARGS, "stray-positional"],
  ];
  for (const args of cases) {
    const { io, err } = fakeIo();
    assert.equal(await runPilotCli(args, io), EXIT_USAGE_ERROR, args.join(" "));
    assert.ok(err().includes("error:"), args.join(" "));
  }
});

test("version prints the storefront package version", async () => {
  const { io, out } = fakeIo({ [PACKAGE_JSON_PATH]: '{"version":"0.1.0"}' });
  assert.equal(await runPilotCli(["--version"], io), EXIT_SUCCESS);
  assert.equal(out(), "0.1.0\n");
});

/* ------------------------------------------------------------------ */
/* Preview (default, non-mutating).                                   */
/* ------------------------------------------------------------------ */

test("preview shows the amount unit and the projected report without writing", async (t) => {
  const dataDir = tempDir(t);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": PROVIDER_JSON },
    {},
  );
  assert.equal(
    await runPilotCli([...BASE_ARGS, "--data-dir", dataDir], io),
    EXIT_SUCCESS,
  );
  assert.ok(out().includes("Phase: preview - no data was written"));
  assert.ok(out().includes("amount unit"));
  assert.ok(out().includes("minor - integer minor units"));
  assert.ok(out().includes("Merchant row interpretation"));
  assert.ok(
    out().includes("T545417640929901  NGN 1200000 (minor units)  SUCCESS"),
  );
  assert.ok(out().includes("Nothing was written to disk"));
  assert.ok(
    !existsSync(join(dataDir, "payment-events.jsonl")),
    "preview must not write the store",
  );
});

test("preview json carries phase, amount unit, rows, and the frozen-engine report", async (t) => {
  const dataDir = tempDir(t);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": PROVIDER_JSON },
    {},
  );
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--output", "json"],
      io,
    ),
    EXIT_SUCCESS,
  );
  const doc = JSON.parse(out());
  assert.equal(doc.phase, "preview");
  assert.equal(doc.import.amountUnit, "minor");
  assert.equal(doc.import.dataRows, 3);
  assert.equal(doc.import.acceptedRows, 3);
  assert.equal(doc.provider.count, 2);
  assert.equal(doc.recorded, null);
  assert.equal(doc.engine.summary.matched, 2);
  assert.equal(doc.engine.results[0].outcome, "MATCH");
});

test("preview is deterministic for identical inputs", async (t) => {
  const dataDir = tempDir(t);
  const runOnce = async () => {
    const io = fakeIo(
      { "merchant.csv": MERCHANT_CSV, "provider.json": PROVIDER_JSON },
      {},
    );
    await runPilotCli([...BASE_ARGS, "--data-dir", dataDir], io.io);
    return io.out();
  };
  const first = await runOnce();
  const second = await runOnce();
  assert.equal(first, second);
});

test("unreadable merchant input is an input failure with guidance", async () => {
  const { io, err } = fakeIo({ "provider.json": PROVIDER_JSON });
  assert.equal(await runPilotCli(BASE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("cannot read merchant input file"));
  assert.ok(err().includes("exists at that path"));
});

/* ------------------------------------------------------------------ */
/* Recorded run and exactly-once replay.                              */
/* ------------------------------------------------------------------ */

test("--run records the import exactly once and replays idempotently", async (t) => {
  const dataDir = tempDir(t);
  const files = {
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  };
  const first = fakeIo(files, {});
  assert.equal(
    await runPilotCli([...BASE_ARGS, "--data-dir", dataDir, "--run"], first.io),
    EXIT_SUCCESS,
  );
  assert.ok(first.out().includes("Phase: recorded"));
  assert.match(first.out(), /recorded\s+3/);
  assert.match(first.out(), /replayed \(exactly-once\)\s+0/);
  const storeFile = join(dataDir, "payment-events.jsonl");
  assert.ok(existsSync(storeFile), "run mode must persist the events");
  assert.equal(readFileSync(storeFile, "utf8").trim().split("\n").length, 3);

  const second = fakeIo(files, {});
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--run"],
      second.io,
    ),
    EXIT_SUCCESS,
  );
  assert.ok(second.out().includes("Phase: recorded"));
  assert.match(second.out(), /recorded\s+0/);
  assert.match(second.out(), /replayed \(exactly-once\)\s+3/);
  assert.equal(
    readFileSync(storeFile, "utf8").trim().split("\n").length,
    3,
    "replay must not duplicate store rows",
  );
});

test("recorded json reports the exact-once counts", async (t) => {
  const dataDir = tempDir(t);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": PROVIDER_JSON },
    {},
  );
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--run", "--output", "json"],
      io,
    ),
    EXIT_SUCCESS,
  );
  const doc = JSON.parse(out());
  assert.equal(doc.phase, "recorded");
  assert.deepEqual(doc.recorded, { recorded: 3, replayed: 0 });
  assert.equal(doc.engine.summary.matched, 2);
});

/* ------------------------------------------------------------------ */
/* Merchant-side behavior and identifiers.                            */
/* ------------------------------------------------------------------ */

test("raw intake never fabricates mk_txn_ anchors; identities stay source-owned", async (t) => {
  const dataDir = tempDir(t);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": PROVIDER_JSON },
    {},
  );
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--output", "json"],
      io,
    ),
    EXIT_SUCCESS,
  );
  const doc = JSON.parse(out());
  const serialized = JSON.stringify(doc);
  assert.ok(
    !serialized.includes("mk_txn_"),
    "no fabricated marketplace anchor",
  );
  assert.equal(doc.import.rows[0].merchant_reference, "T545417640929901");
  assert.equal(doc.import.rows[0].payment_source_reference, "src_101");
  assert.equal(doc.engine.results[0].merchant_record.merchant_record_id, null);
  assert.equal(
    doc.engine.results[0].provider_record.reference,
    "T545417640929901",
  );
});

test("amount-unit decimal converts deterministically and stays visible", async (t) => {
  const dataDir = tempDir(t);
  const decimalCsv = [
    "reference,amount,currency,status,occurred_at",
    "T1,1000,NGN,SUCCESS,1787029755000",
    "T2,9750.00,NGN,FAILED,1787030000000",
  ].join("\n");
  const files = { "merchant.csv": decimalCsv, "provider.json": "[]" };
  const text = fakeIo(files, {});
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--amount-unit", "decimal"],
      text.io,
    ),
    EXIT_SUCCESS,
  );
  assert.ok(
    text
      .out()
      .includes("decimal - decimal major amounts converted to minor units"),
  );
  assert.ok(
    text
      .out()
      .includes("T1  NGN 100000 (decimal major converted to minor units)"),
  );

  const json = fakeIo(files, {});
  assert.equal(
    await runPilotCli(
      [
        ...BASE_ARGS,
        "--data-dir",
        dataDir,
        "--amount-unit",
        "decimal",
        "--output",
        "json",
      ],
      json.io,
    ),
    EXIT_SUCCESS,
  );
  const doc = JSON.parse(json.out());
  assert.equal(doc.import.amountUnit, "decimal");
  assert.equal(doc.import.rows[0].amount, 100_000);
  assert.equal(doc.import.rows[1].amount, 975_000);
});

test("rows rejected at intake fail the run with diagnostics and write nothing", async (t) => {
  const dataDir = tempDir(t);
  const badCsv = [
    "reference,amount,currency,status,occurred_at",
    "T_OK,100,NGN,SUCCESS,1787029755000",
    "T_BAD,100,NGN,bogus,1787029755000",
  ].join("\n");
  const { io, err } = fakeIo(
    { "merchant.csv": badCsv, "provider.json": PROVIDER_JSON },
    {},
  );
  assert.equal(await runPilotCli(BASE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("rejected 1 of 2 data rows"));
  assert.ok(err().includes("row 2"));
  assert.ok(err().includes("[invalid_status]"));
  assert.ok(!existsSync(join(dataDir, "payment-events.jsonl")));
});

/* ------------------------------------------------------------------ */
/* Provider evidence: exact match, honest mismatch, CSV rejection.    */
/* ------------------------------------------------------------------ */

test("exact merchant/provider references reconcile through the unchanged engine", async (t) => {
  const dataDir = tempDir(t);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": PROVIDER_JSON },
    {},
  );
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--output", "json"],
      io,
    ),
    EXIT_SUCCESS,
  );
  const doc = JSON.parse(out());
  assert.equal(doc.engine.summary.totalRecords, 5);
  assert.equal(doc.engine.summary.matched, 2);
  assert.equal(doc.engine.summary.missingProviderRecords, 1);
  const outcomes = doc.engine.results.map(
    (r: { outcome: string }) => r.outcome,
  );
  assert.deepEqual(outcomes, ["MATCH", "MATCH", "MISSING_PROVIDER_RECORD"]);
});

test("a mismatched reference is reported by the engine, never repaired by correlation", async (t) => {
  const dataDir = tempDir(t);
  const divergentProvider = JSON.stringify(
    verifyResponse(
      "OTHER-REF-000000",
      4123456789,
      1200000,
      "2026-08-18T05:09:15.000Z",
    ),
  );
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": divergentProvider },
    {},
  );
  assert.equal(
    await runPilotCli(
      [...BASE_ARGS, "--data-dir", dataDir, "--output", "json"],
      io,
    ),
    EXIT_SUCCESS,
  );
  const doc = JSON.parse(out());
  const outcomes = doc.engine.results.map(
    (r: { outcome: string }) => r.outcome,
  );
  assert.ok(outcomes.includes("MISSING_PROVIDER_RECORD"));
  assert.ok(outcomes.includes("UNMATCHED_PROVIDER_RECORD"));
  assert.equal(doc.engine.summary.matched, 0);
  assert.equal(doc.engine.summary.discrepancies, 0);
});

test("provider CSV files are rejected explicitly, never treated as Verify JSON", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.csv": PROVIDER_CSV_CONTENT },
    {},
  );
  const args = [
    "--merchant",
    "merchant.csv",
    "--provider",
    "provider.csv",
    "--timestamp-field",
    "paid_at",
    "--currencies",
    "NGN",
  ];
  assert.equal(await runPilotCli(args, io), EXIT_INPUT_FAILURE);
  assert.ok(
    err().includes(
      "provider CSV files are not supported as reconciliation evidence",
    ),
  );
  assert.ok(!err().includes("not valid JSON"));
});

test("CSV-shaped provider content is caught even without a .csv extension", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.txt": PROVIDER_CSV_CONTENT },
    {},
  );
  const args = [
    "--merchant",
    "merchant.csv",
    "--provider",
    "provider.txt",
    "--timestamp-field",
    "paid_at",
    "--currencies",
    "NGN",
  ];
  assert.equal(await runPilotCli(args, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("provider CSV files are not supported"));
});

test("non-CSV invalid provider JSON keeps the generic malformed-JSON error", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV, "provider.json": "not-json{{{" },
    {},
  );
  assert.equal(await runPilotCli(BASE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("provider input is not valid JSON"));
  assert.ok(!err().includes("has a CSV structure"));
});

/* ------------------------------------------------------------------ */
/* Live mode: secret handling.                                        */
/* ------------------------------------------------------------------ */

test("live mode with a missing secret exits 1 with plain guidance", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    { readEnv: () => undefined },
  );
  assert.equal(await runPilotCli(LIVE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("RECONCILEKIT_PAYSTACK_SECRET_KEY"));
  assert.ok(err().includes("then run the command again"));
});

test("live mode maps responses and never leaks the secret", async (t) => {
  const dataDir = tempDir(t);
  const secret = "sk_test_SUPERSECRETTOPVALUE";
  const response: PaystackResponse = verifyResponse(
    "T545417640929901",
    4123456789,
    1200000,
    "2026-08-18T05:09:15.000Z",
  );
  const captured: { secret?: string } = {};
  const fetch = liveFetch([response], captured);
  const { io, out, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    { readEnv: () => secret, fetchPaystackTransactions: fetch },
  );
  assert.equal(
    await runPilotCli(
      [...LIVE_ARGS, "--data-dir", dataDir, "--output", "json"],
      io,
    ),
    EXIT_SUCCESS,
  );
  assert.equal(captured.secret, secret, "the raw secret reaches the transport");
  assert.ok(!out().includes("SUPERSECRETTOPVALUE"));
  assert.ok(!err().includes("SUPERSECRETTOPVALUE"));
  const doc = JSON.parse(out());
  assert.ok(!JSON.stringify(doc).includes("SUPERSECRETTOPVALUE"));
  assert.equal(doc.provider.count, 1);
  assert.equal(doc.engine.results[0].outcome, "MATCH");
});

test("live transport failures are input failures, not findings, with no report", async () => {
  const { io, out, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {
      readEnv: () => "sk_test_SECRET",
      fetchPaystackTransactions: async () => {
        throw new Error("PAYSTACK_TRANSPORT_HTTP_SERVER_ERROR: HTTP 500");
      },
    },
  );
  assert.equal(await runPilotCli(LIVE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("live Paystack request failed"));
  assert.ok(err().includes("not a reconciliation finding"));
  assert.equal(out(), "");
});

/* ------------------------------------------------------------------ */
/* Real entry point.                                                  */
/* ------------------------------------------------------------------ */

const PILOT_CLI_PATH = fileURLToPath(
  new URL("../../src/cli/pilot-run.ts", import.meta.url),
);

test("real entry point: preview → recorded → replay end to end", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-run-e2e-"));
  try {
    const merchantPath = join(dir, "merchant.csv");
    const providerPath = join(dir, "provider.json");
    const dataDir = join(dir, "data");
    writeFileSync(merchantPath, MERCHANT_CSV);
    writeFileSync(providerPath, PROVIDER_JSON);

    const previewOut = execFileSync(
      process.execPath,
      [
        PILOT_CLI_PATH,
        "--merchant",
        merchantPath,
        "--provider",
        providerPath,
        "--timestamp-field",
        "paid_at",
        "--currencies",
        "NGN",
        "--data-dir",
        dataDir,
        "--output",
        "json",
      ],
      { encoding: "utf8" },
    );
    const preview = JSON.parse(previewOut);
    assert.equal(preview.phase, "preview");
    assert.ok(!existsSync(join(dataDir, "payment-events.jsonl")));

    const runOut = execFileSync(
      process.execPath,
      [
        PILOT_CLI_PATH,
        "--merchant",
        merchantPath,
        "--provider",
        providerPath,
        "--timestamp-field",
        "paid_at",
        "--currencies",
        "NGN",
        "--data-dir",
        dataDir,
        "--output",
        "json",
        "--run",
      ],
      { encoding: "utf8" },
    );
    const recorded = JSON.parse(runOut);
    assert.equal(recorded.phase, "recorded");
    assert.deepEqual(recorded.recorded, { recorded: 3, replayed: 0 });
    assert.equal(recorded.engine.summary.matched, 2);
    assert.equal(
      readFileSync(join(dataDir, "payment-events.jsonl"), "utf8")
        .trim()
        .split("\n").length,
      3,
    );

    const replayOut = execFileSync(
      process.execPath,
      [
        PILOT_CLI_PATH,
        "--merchant",
        merchantPath,
        "--provider",
        providerPath,
        "--timestamp-field",
        "paid_at",
        "--currencies",
        "NGN",
        "--data-dir",
        dataDir,
        "--output",
        "json",
        "--run",
      ],
      { encoding: "utf8" },
    );
    const replay = JSON.parse(replayOut);
    assert.deepEqual(replay.recorded, { recorded: 0, replayed: 3 });
    assert.equal(
      readFileSync(join(dataDir, "payment-events.jsonl"), "utf8")
        .trim()
        .split("\n").length,
      3,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("real entry point: provider CSV rejection exits 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-run-reject-"));
  try {
    const merchantPath = join(dir, "merchant.csv");
    const providerPath = join(dir, "provider.csv");
    writeFileSync(merchantPath, MERCHANT_CSV);
    writeFileSync(providerPath, PROVIDER_CSV_CONTENT);
    try {
      execFileSync(
        process.execPath,
        [
          PILOT_CLI_PATH,
          "--merchant",
          merchantPath,
          "--provider",
          providerPath,
          "--timestamp-field",
          "paid_at",
          "--currencies",
          "NGN",
          "--data-dir",
          join(dir, "data"),
        ],
        { encoding: "utf8", stdio: "pipe" },
      );
      assert.fail("expected a non-zero exit");
    } catch (error) {
      assert.ok(error instanceof Error);
      const status = (error as { status?: number }).status;
      assert.equal(status, EXIT_INPUT_FAILURE);
      const stderr = String(error);
      assert.ok(stderr.includes("provider CSV files are not supported"));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/* Committed synthetic Paystack Verify fixture.                        */
/* ------------------------------------------------------------------ */

function outcomesByKey(doc: {
  engine: {
    results: ReadonlyArray<{
      outcome: string;
      merchant_record: { merchant_reference: string } | null;
      provider_record: { reference: string } | null;
    }>;
  };
}): Record<string, string> {
  const map: Record<string, string> = {};
  for (const result of doc.engine.results) {
    const key =
      result.merchant_record?.merchant_reference ??
      result.provider_record?.reference;
    if (key !== undefined) {
      map[key] = result.outcome;
    }
  }
  return map;
}

test("the synthetic Paystack Verify fixture is valid input to the provider adapter", () => {
  const fixture = JSON.parse(
    readFileSync(SYNTHETIC_PAYSTACK_VERIFY_JSON, "utf8"),
  ) as readonly PaystackResponse[];
  const mapped = mapPaystackResponses(fixture, {
    supportedCurrencies: ["NGN"],
    timestampField: "paid_at",
  });
  assert.equal(mapped.length, 3);
  assert.deepEqual(
    mapped.map((entry) => entry.payment.reference),
    ["T545417640929901", "T545417640929902", "T545417640929990"],
  );
  assert.deepEqual(
    mapped.map((entry) => entry.payment.amount),
    [1200000, 3000000, 1500000],
  );
  assert.deepEqual(
    mapped.map((entry) => entry.payment.status),
    ["SUCCESS", "FAILED", "SUCCESS"],
  );
  assert.deepEqual(
    mapped.map((entry) => entry.payment.provider_id),
    ["4123456789", "4123456790", "4123456791"],
  );
  assert.deepEqual(
    mapped.map((entry) => entry.payment.occurred_at),
    [
      Date.parse("2026-08-18T05:09:15.000Z"),
      Date.parse("2026-08-18T05:13:20.000Z"),
      Date.parse("2026-08-18T05:21:00.000Z"),
    ],
  );
});

test("real entry point: both fixture files flow through the CLI to deterministic findings", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-run-fixtures-"));
  try {
    const dataDir = join(dir, "data");
    const args = [
      PILOT_CLI_PATH,
      "--merchant",
      SYNTHETIC_MERCHANT_CSV,
      "--provider",
      SYNTHETIC_PAYSTACK_VERIFY_JSON,
      "--timestamp-field",
      "paid_at",
      "--currencies",
      "NGN",
      "--data-dir",
      dataDir,
      "--output",
      "json",
    ];

    const preview = JSON.parse(
      execFileSync(process.execPath, args, { encoding: "utf8" }),
    );
    assert.equal(preview.phase, "preview");
    assert.equal(preview.import.acceptedRows, 3);
    assert.equal(preview.provider.count, 3);
    assert.equal(preview.engine.summary.matched, 1);
    assert.equal(preview.engine.summary.discrepancies, 1);
    assert.equal(preview.engine.summary.missingProviderRecords, 1);
    assert.equal(preview.engine.summary.unmatchedProviderRecords, 1);
    const previewOutcomes = outcomesByKey(preview);
    assert.equal(previewOutcomes["T545417640929901"], "MATCH");
    assert.equal(previewOutcomes["T545417640929902"], "DISCREPANCY");
    assert.equal(
      previewOutcomes["T545417640929903"],
      "MISSING_PROVIDER_RECORD",
    );
    assert.equal(
      previewOutcomes["T545417640929990"],
      "UNMATCHED_PROVIDER_RECORD",
    );
    assert.ok(!existsSync(join(dataDir, "payment-events.jsonl")));

    const run = JSON.parse(
      execFileSync(process.execPath, [...args, "--run"], {
        encoding: "utf8",
      }),
    );
    assert.equal(run.phase, "recorded");
    assert.deepEqual(run.recorded, { recorded: 3, replayed: 0 });
    assert.equal(run.engine.summary.matched, 1);
    assert.equal(run.engine.summary.unmatchedProviderRecords, 1);
    const runOutcomes = outcomesByKey(run);
    assert.equal(runOutcomes["T545417640929901"], "MATCH");
    assert.equal(runOutcomes["T545417640929902"], "DISCREPANCY");
    assert.equal(runOutcomes["T545417640929903"], "MISSING_PROVIDER_RECORD");
    assert.equal(runOutcomes["T545417640929990"], "UNMATCHED_PROVIDER_RECORD");
    assert.equal(
      readFileSync(join(dataDir, "payment-events.jsonl"), "utf8")
        .trim()
        .split("\n").length,
      3,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the fixture drives the deterministic AMOUNT_MISMATCH discrepancy on record 902", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-run-fixture-disc-"));
  try {
    const preview = JSON.parse(
      execFileSync(
        process.execPath,
        [
          PILOT_CLI_PATH,
          "--merchant",
          SYNTHETIC_MERCHANT_CSV,
          "--provider",
          SYNTHETIC_PAYSTACK_VERIFY_JSON,
          "--timestamp-field",
          "paid_at",
          "--currencies",
          "NGN",
          "--data-dir",
          join(dir, "data"),
          "--output",
          "json",
        ],
        { encoding: "utf8" },
      ),
    );
    const discrepancy = preview.engine.results.find(
      (result: { outcome: string }) => result.outcome === "DISCREPANCY",
    );
    assert.ok(discrepancy, "the fixture must produce a DISCREPANCY result");
    assert.equal(
      discrepancy.merchant_record.merchant_reference,
      "T545417640929902",
    );
    assert.equal(discrepancy.merchant_record.amount, 3500000);
    assert.equal(discrepancy.provider_record.reference, "T545417640929902");
    assert.equal(discrepancy.provider_record.amount, 3000000);
    assert.deepEqual(discrepancy.discrepancy_codes, ["AMOUNT_MISMATCH"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
