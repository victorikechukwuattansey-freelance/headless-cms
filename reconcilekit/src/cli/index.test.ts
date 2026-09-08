import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { PaystackResponse } from "../adapters/providers/paystack/paystack.ts";
import { PaystackTransportError } from "../adapters/providers/paystack/transport.ts";
import type { PaystackTransportOptions } from "../adapters/providers/paystack/transport.ts";
import {
  DEFAULT_IO,
  EXIT_INPUT_FAILURE,
  EXIT_SUCCESS,
  EXIT_UNEXPECTED_FAILURE,
  EXIT_USAGE_ERROR,
  runCli,
} from "./index.ts";
import type { CliIo } from "./index.ts";

const MERCHANT_CSV =
  "merchant_reference,amount,currency,status,occurred_at,merchant_record_id\nREF-A,20000,NGN,SUCCESS,1700000000000,M-1";

const PROVIDER_JSON = JSON.stringify({
  status: true,
  message: "Verification successful",
  data: {
    id: 4123456789,
    reference: "REF-A",
    amount: 20000,
    currency: "NGN",
    status: "success",
    created_at: "2023-11-14T22:13:20.000Z",
    paid_at: "2023-11-14T22:13:20.000Z",
    transaction_date: "2023-11-14T22:13:20.000Z",
  },
});

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

const LIVE_RESPONSES: readonly PaystackResponse[] = [
  {
    status: true,
    message: "Transactions retrieved",
    data: {
      id: 4123456789,
      reference: "REF-A",
      amount: 20000,
      currency: "NGN",
      status: "success",
      created_at: "2023-11-14T22:13:20.000Z",
      paid_at: "2023-11-14T22:13:20.000Z",
      transaction_date: "2023-11-14T22:13:20.000Z",
    },
  },
];

function fakeIo(
  files: Record<string, string> = {},
  readErrors: Record<string, Error> = {},
  overrides: Partial<CliIo> = {},
): { io: CliIo; out: () => string; err: () => string } {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  return {
    io: {
      readFile: (filePath) => {
        const failure = readErrors[filePath];
        if (failure !== undefined) {
          throw failure;
        }
        if (!(filePath in files)) {
          throw new Error(
            `ENOENT: no such file or directory, open '${filePath}'`,
          );
        }
        return files[filePath];
      },
      writeOut: (text) => outChunks.push(text),
      writeErr: (text) => errChunks.push(text),
      ...overrides,
    },
    out: () => outChunks.join(""),
    err: () => errChunks.join(""),
  };
}

function makeLiveFetch(
  responses: readonly PaystackResponse[] = [],
  fail?: Error,
): {
  fetch: NonNullable<CliIo["fetchPaystackTransactions"]>;
  calls: { secretKey: string }[];
} {
  const calls: { secretKey: string }[] = [];
  const fetch = async (options: PaystackTransportOptions) => {
    calls.push({ secretKey: options.secretKey });
    if (fail !== undefined) {
      throw fail;
    }
    return { responses, rateLimit: null };
  };
  return { fetch, calls };
}

test("1. --help succeeds without any inputs", async () => {
  const { io, out } = fakeIo();
  const exitCode = await runCli(["--help"], io);
  assert.equal(exitCode, EXIT_SUCCESS);
  assert.ok(out().includes("Usage:"));
  assert.ok(out().includes("--merchant"));
  assert.ok(out().includes("Exit codes"));
});

test("2. valid merchant + provider inputs produce a reconciliation report", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_SUCCESS);
  assert.ok(out().includes("ReconcileKit reconciliation report"));
  assert.ok(out().includes("Summary"));
});

test("3. exact match exits successfully with a deterministic report line", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_SUCCESS);
  assert.ok(
    out().includes(
      "1. MATCH - merchant REF-A (M-1) | provider REF-A (4123456789)",
    ),
  );
});

test("4. reconciliation discrepancies remain report data, not CLI errors", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": JSON.stringify({
      status: true,
      data: {
        id: 4123456789,
        reference: "REF-A",
        amount: 21000,
        currency: "NGN",
        status: "success",
        paid_at: "2023-11-14T22:13:20.000Z",
      },
    }),
  });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_SUCCESS);
  assert.ok(out().includes("AMOUNT_MISMATCH"));
  assert.ok(out().includes("DISCREPANCY"));
});

test("5. missing required arguments produce a usage error", async () => {
  const { io, err } = fakeIo();
  const exitCode = await runCli(["--merchant", "merchant.csv"], io);
  assert.equal(exitCode, EXIT_USAGE_ERROR);
  assert.ok(err().includes("missing required option --provider"));
});

test("6. unknown options fail deterministically", async () => {
  const { io, err } = fakeIo();
  const exitCode = await runCli(["--bogus"], io);
  assert.equal(exitCode, EXIT_USAGE_ERROR);
  assert.ok(err().includes("--bogus"));
});

test("7. nonexistent merchant input is reported as a CLI/input error", async () => {
  const { io, err } = fakeIo({ "provider.json": PROVIDER_JSON });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_INPUT_FAILURE);
  assert.ok(err().includes("cannot read merchant input file"));
});

test("8. malformed merchant CSV surfaces as an adapter/input error", async () => {
  const { io, err } = fakeIo({
    "merchant.csv": `${MERCHANT_CSV}\n"REF-B,25000,NGN,SUCCESS,1700000000000,M-2`,
    "provider.json": PROVIDER_JSON,
  });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_INPUT_FAILURE);
  assert.ok(err().includes("merchant input failed"));
  assert.ok(err().includes("merchant CSV parsing failed"));
});

test("9. malformed provider JSON is rejected deterministically", async () => {
  const { io, err } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": "not-json{",
  });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_INPUT_FAILURE);
  assert.ok(err().includes("provider input is not valid JSON"));
});

test("10. provider mapping errors remain adapter/input errors", async () => {
  const { io, err } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": JSON.stringify({
      status: true,
      data: { reference: "REF-A" },
    }),
  });
  const exitCode = await runCli(BASE_ARGS, io);
  assert.equal(exitCode, EXIT_INPUT_FAILURE);
  assert.ok(err().includes("provider input failed"));
  assert.ok(err().includes("data.amount is missing"));
});

test("11. explicit --timestamp-field reaches the Paystack adapter", async () => {
  const providerWithDifferentTimestamps = JSON.stringify({
    status: true,
    data: {
      id: 4123456789,
      reference: "REF-A",
      amount: 20000,
      currency: "NGN",
      status: "success",
      created_at: "2023-11-14T22:13:20.000Z",
      paid_at: "2023-11-14T22:13:30.000Z",
      transaction_date: "2023-11-14T22:13:20.000Z",
    },
  });
  const paidAtRun = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": providerWithDifferentTimestamps,
  });
  assert.equal(
    await runCli(
      [...BASE_ARGS, "--output", "json", "--timestamp-field", "paid_at"],
      paidAtRun.io,
    ),
    EXIT_SUCCESS,
  );
  const paidAtReport = JSON.parse(paidAtRun.out());
  assert.equal(
    paidAtReport.results[0].provider_record.occurred_at,
    Date.parse("2023-11-14T22:13:30.000Z"),
  );
  const createdAtRun = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": providerWithDifferentTimestamps,
  });
  assert.equal(
    await runCli(
      [...BASE_ARGS, "--output", "json", "--timestamp-field", "created_at"],
      createdAtRun.io,
    ),
    EXIT_SUCCESS,
  );
  const createdAtReport = JSON.parse(createdAtRun.out());
  assert.equal(
    createdAtReport.results[0].provider_record.occurred_at,
    Date.parse("2023-11-14T22:13:20.000Z"),
  );
});

test("12. explicit --currencies reaches the adapter and the domain", async () => {
  const usdProvider = JSON.stringify({
    status: true,
    data: {
      id: 4123456789,
      reference: "REF-A",
      amount: 20000,
      currency: "USD",
      status: "success",
      paid_at: "2023-11-14T22:13:20.000Z",
    },
  });
  const rejected = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": usdProvider,
  });
  assert.equal(
    await runCli([...BASE_ARGS, "--currencies", "NGN"], rejected.io),
    EXIT_INPUT_FAILURE,
  );
  assert.ok(
    rejected.err().includes("not supported by this adapter configuration"),
  );

  const domainMismatch = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": usdProvider,
  });
  assert.equal(
    await runCli(
      [...BASE_ARGS, "--output", "json", "--currencies", "NGN,USD"],
      domainMismatch.io,
    ),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(domainMismatch.out());
  assert.deepEqual(report.results[0].discrepancy_codes, ["CURRENCY_MISMATCH"]);
});

test("12b. explicit --tolerance-ms reaches the domain", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": JSON.stringify({
      status: true,
      data: {
        id: 4123456789,
        reference: "REF-A",
        amount: 20000,
        currency: "NGN",
        status: "success",
        paid_at: "2023-11-14T22:15:00.000Z",
      },
    }),
  });
  assert.equal(
    await runCli(
      [...BASE_ARGS, "--output", "json", "--tolerance-ms", "60000"],
      io,
    ),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.deepEqual(report.results[0].discrepancy_codes, ["TEMPORAL_ANOMALY"]);
});

test("13. output is deterministic", async () => {
  const files = {
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  };
  const first = fakeIo(files);
  const second = fakeIo(files);
  assert.equal(await runCli(BASE_ARGS, first.io), EXIT_SUCCESS);
  assert.equal(await runCli(BASE_ARGS, second.io), EXIT_SUCCESS);
  assert.equal(first.out(), second.out());
});

test("14. help output is deterministic", async () => {
  const first = fakeIo();
  const second = fakeIo();
  assert.equal(await runCli(["--help"], first.io), EXIT_SUCCESS);
  assert.equal(await runCli(["--help"], second.io), EXIT_SUCCESS);
  assert.equal(first.out(), second.out());
});

test("16. Application receives provider-neutral canonical records only", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(
    await runCli([...BASE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.deepEqual(Object.keys(report.results[0].merchant_record).sort(), [
    "amount",
    "currency",
    "merchant_record_id",
    "merchant_reference",
    "occurred_at",
    "status",
  ]);
  assert.deepEqual(Object.keys(report.results[0].provider_record).sort(), [
    "amount",
    "currency",
    "occurred_at",
    "provider_id",
    "reference",
    "status",
  ]);
});

test("17. domain outcomes are not converted into application errors", async () => {
  const { io, out, err } = fakeIo({
    "merchant.csv": MERCHANT_CSV.replace("20000", "21000"),
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(
    await runCli([...BASE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.equal(err(), "");
});

test("invalid option values produce usage errors", async () => {
  const cases: ReadonlyArray<readonly string[]> = [
    [...BASE_ARGS, "--output", "yaml"],
    [...BASE_ARGS, "--timestamp-field", "settled_at"],
    [...BASE_ARGS, "--currencies", ",,"],
    [...BASE_ARGS, "--tolerance-ms", "abc"],
    [...BASE_ARGS, "--tolerance-ms", "-5"],
  ];
  for (const args of cases) {
    const { io, err } = fakeIo();
    assert.equal(await runCli(args, io), EXIT_USAGE_ERROR, args.join(" "));
    assert.ok(err().includes("error:"), args.join(" "));
  }
});

test("positional arguments are rejected", async () => {
  const { io, err } = fakeIo();
  const exitCode = await runCli([...BASE_ARGS, "stray-positional"], io);
  assert.equal(exitCode, EXIT_USAGE_ERROR);
  assert.ok(err().includes("stray-positional"));
});

test("unexpected output failures take the reserved exit code without leaking details", async () => {
  const files: Record<string, string> = {
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  };
  const errChunks: string[] = [];
  const exitCode = await runCli(BASE_ARGS, {
    readFile: (filePath) => files[filePath],
    writeOut: () => {
      throw new Error("disk failure");
    },
    writeErr: (text) => errChunks.push(text),
  });
  assert.equal(exitCode, EXIT_UNEXPECTED_FAILURE);
  assert.ok(
    !errChunks.join("").includes("disk failure"),
    "internal failure details must not leak",
  );
  assert.ok(errChunks.join("").includes("writing the report output"));
});

test("A. existing file mode still reconciles unchanged", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(
    out().includes(
      "1. MATCH - merchant REF-A (M-1) | provider REF-A (4123456789)",
    ),
  );
});

test("B. --live-paystack requires --merchant", async () => {
  const { io, err } = fakeIo();
  const exitCode = await runCli(["--live-paystack"], io);
  assert.equal(exitCode, EXIT_USAGE_ERROR);
  assert.ok(err().includes("missing required option --merchant"));
});

test("C. --provider and --live-paystack are mutually exclusive", async () => {
  const { io, err } = fakeIo();
  const exitCode = await runCli(
    [
      "--merchant",
      "merchant.csv",
      "--provider",
      "provider.json",
      "--live-paystack",
      "--timestamp-field",
      "paid_at",
      "--currencies",
      "NGN",
    ],
    io,
  );
  assert.equal(exitCode, EXIT_USAGE_ERROR);
  assert.ok(err().includes("mutually exclusive"));
});

test("D. --live-paystack with missing secret exits 1", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    { readEnv: () => undefined },
  );
  const exitCode = await runCli(LIVE_ARGS, io);
  assert.equal(exitCode, EXIT_INPUT_FAILURE);
  assert.ok(err().includes("RECONCILEKIT_PAYSTACK_SECRET_KEY"));
});

test("E. --live-paystack with empty secret exits 1", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    { readEnv: () => "" },
  );
  const exitCode = await runCli(LIVE_ARGS, io);
  assert.equal(exitCode, EXIT_INPUT_FAILURE);
  assert.ok(err().includes("RECONCILEKIT_PAYSTACK_SECRET_KEY"));
});

test("F. missing-secret error is deterministic and exposes no secret value", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    { readEnv: () => undefined },
  );
  await runCli(LIVE_ARGS, io);
  assert.equal(
    err(),
    `error: live Paystack mode requires the RECONCILEKIT_PAYSTACK_SECRET_KEY environment variable\n` +
      `Set the RECONCILEKIT_PAYSTACK_SECRET_KEY environment variable to your Paystack ` +
      `secret key, then run the command again.\n`,
  );
});

test("G. live mode passes the environment-provided secret to the transport", async () => {
  const liveFetch = makeLiveFetch(LIVE_RESPONSES);
  const { io } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => "sk_test_SECRET123",
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(await runCli(LIVE_ARGS, io), EXIT_SUCCESS);
  assert.equal(liveFetch.calls.length, 1);
  assert.equal(liveFetch.calls[0].secretKey, "sk_test_SECRET123");
});

test("H. live mode invokes the existing transport", async () => {
  const liveFetch = makeLiveFetch(LIVE_RESPONSES);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => "sk_test_SECRET123",
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(await runCli(LIVE_ARGS, io), EXIT_SUCCESS);
  assert.equal(liveFetch.calls.length, 1);
  assert.ok(out().includes("ReconcileKit reconciliation report"));
});

test("I. raw transport responses pass through the Paystack adapter", async () => {
  const liveFetch = makeLiveFetch(LIVE_RESPONSES);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => "sk_test_SECRET123",
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(
    await runCli([...LIVE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.equal(report.results[0].outcome, "MATCH");
  assert.equal(report.results[0].provider_record.reference, "REF-A");
});

test("J. SourceAttributes survive into MatchResult", async () => {
  const liveFetch = makeLiveFetch(LIVE_RESPONSES);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => "sk_test_SECRET123",
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(
    await runCli([...LIVE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.equal(report.results[0].source_attributes.original_status, "success");
  assert.equal(
    report.results[0].source_attributes.paid_at,
    "2023-11-14T22:13:20.000Z",
  );
});

test("K. live mode reaches the existing Application/Domain reconciliation path", async () => {
  const liveFetch = makeLiveFetch([
    {
      status: true,
      message: "Transactions retrieved",
      data: {
        id: 4123456789,
        reference: "REF-A",
        amount: 21000,
        currency: "NGN",
        status: "success",
        paid_at: "2023-11-14T22:13:20.000Z",
      },
    },
  ]);
  const { io, out } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => "sk_test_SECRET123",
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(
    await runCli([...LIVE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0].discrepancy_codes, ["AMOUNT_MISMATCH"]);
});

test("L. transport failures surface without becoming domain outcomes", async () => {
  const liveFetch = makeLiveFetch(
    [],
    new PaystackTransportError(
      "PAYSTACK_TRANSPORT_HTTP_SERVER_ERROR",
      "Paystack request failed with HTTP 500",
      { statusCode: 500 },
    ),
  );
  const { io, out, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => "sk_test_SECRET123",
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(await runCli(LIVE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("live Paystack request failed"));
  assert.ok(err().includes("HTTP 500"));
  assert.equal(out(), "");
});

test("M. existing file mode does not invoke the transport", async () => {
  const liveFetch = makeLiveFetch([]);
  const { io } = fakeIo(
    {
      "merchant.csv": MERCHANT_CSV,
      "provider.json": PROVIDER_JSON,
    },
    {},
    { fetchPaystackTransactions: liveFetch.fetch },
  );
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.equal(liveFetch.calls.length, 0);
});

test("N. no silent network fallback occurs when --provider is absent", async () => {
  const liveFetch = makeLiveFetch([]);
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    { fetchPaystackTransactions: liveFetch.fetch },
  );
  const exitCode = await runCli(["--merchant", "merchant.csv"], io);
  assert.equal(exitCode, EXIT_USAGE_ERROR);
  assert.ok(err().includes("missing required option --provider"));
  assert.equal(liveFetch.calls.length, 0);
});

test("O. secret never appears in output, reports, or error text", async () => {
  const secret = "sk_test_SUPERSECRETTOPVALUE";
  const liveFetch = makeLiveFetch(LIVE_RESPONSES);
  const { io, out, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    {},
    {
      readEnv: () => secret,
      fetchPaystackTransactions: liveFetch.fetch,
    },
  );
  assert.equal(
    await runCli([...LIVE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  assert.ok(!out().includes("SUPERSECRETTOPVALUE"));
  assert.ok(!err().includes("SUPERSECRETTOPVALUE"));
  const report = JSON.parse(out());
  assert.ok(!JSON.stringify(report).includes("SUPERSECRETTOPVALUE"));
});

test("real entry point: node src/cli/index.ts reconciles matching fixtures", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "reconcilekit-cli-"));
  try {
    const merchantPath = path.join(dir, "merchant.csv");
    const providerPath = path.join(dir, "provider.json");
    writeFileSync(merchantPath, MERCHANT_CSV);
    writeFileSync(providerPath, PROVIDER_JSON);
    const cliPath = fileURLToPath(new URL("./index.ts", import.meta.url));
    const stdout = execFileSync(
      process.execPath,
      [
        cliPath,
        "--merchant",
        merchantPath,
        "--provider",
        providerPath,
        "--timestamp-field",
        "paid_at",
        "--currencies",
        "NGN",
        "--output",
        "json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.summary.matched, 1);
    assert.equal(report.results[0].outcome, "MATCH");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("real entry point: usage errors exit with code 2", () => {
  const cliPath = fileURLToPath(new URL("./index.ts", import.meta.url));
  try {
    execFileSync(process.execPath, [cliPath, "--definitely-not-an-option"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.fail("expected a non-zero exit");
  } catch (error) {
    assert.ok(error instanceof Error);
    const status = (error as { status?: number }).status;
    assert.equal(status, 2);
  }
});

test("real entry point: live mode with missing secret exits with code 1", () => {
  const cliPath = fileURLToPath(new URL("./index.ts", import.meta.url));
  const env = { ...process.env };
  delete env.RECONCILEKIT_PAYSTACK_SECRET_KEY;
  try {
    execFileSync(
      process.execPath,
      [
        cliPath,
        "--merchant",
        "merchant.csv",
        "--live-paystack",
        "--timestamp-field",
        "paid_at",
        "--currencies",
        "NGN",
      ],
      { encoding: "utf8", stdio: "pipe", env },
    );
    assert.fail("expected a non-zero exit");
  } catch (error) {
    assert.ok(error instanceof Error);
    const status = (error as { status?: number }).status;
    assert.equal(status, 1);
  }
});

test("DEFAULT_IO version resolution reads the real package metadata", async () => {
  const out: string[] = [];
  const io: CliIo = {
    ...DEFAULT_IO,
    writeOut: (text) => out.push(text),
    writeErr: () => {},
  };
  assert.equal(await runCli(["--version"], io), EXIT_SUCCESS);
  assert.equal(out.join(""), "0.1.0\n");
});
