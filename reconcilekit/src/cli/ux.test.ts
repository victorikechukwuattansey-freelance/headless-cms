import assert from "node:assert/strict";
import { test } from "node:test";
import type { PaystackResponse } from "../adapters/providers/paystack/paystack.ts";
import { PaystackTransportError } from "../adapters/providers/paystack/transport.ts";
import type { PaystackTransportOptions } from "../adapters/providers/paystack/transport.ts";
import { EXIT_INPUT_FAILURE, EXIT_SUCCESS, runCli } from "./index.ts";
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

const LIVE_RESPONSE: PaystackResponse = {
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
};

function fakeIo(
  files: Record<string, string> = {},
  overrides: Partial<CliIo> = {},
): { io: CliIo; out: () => string; err: () => string } {
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
      ...overrides,
    },
    out: () => outChunks.join(""),
    err: () => errChunks.join(""),
  };
}

function liveFetch(responses: readonly PaystackResponse[], fail?: Error) {
  const fetch = async (
    options: PaystackTransportOptions,
  ): Promise<{ responses: readonly PaystackResponse[]; rateLimit: null }> => {
    if (fail !== undefined) {
      throw fail;
    }
    return { responses, rateLimit: null };
  };
  const io = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    { readEnv: () => "sk_test_SECRET123", fetchPaystackTransactions: fetch },
  );
  return io;
}

test("help text explains the tool in plain language while keeping the usage anchors", async () => {
  const { io, out } = fakeIo();
  assert.equal(await runCli(["--help"], io), EXIT_SUCCESS);
  assert.ok(out().includes("Usage:"));
  assert.ok(out().includes("--merchant"));
  assert.ok(out().includes("Exit codes"));
  assert.ok(out().includes("What this does"));
  assert.ok(
    out().includes("compares the payments listed in your merchant CSV file"),
  );
});

test("text report states what the tool did against the supplied provider file", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(
    out().includes(
      "This report compares your merchant records against the provider file you supplied.",
    ),
  );
  assert.ok(out().includes("Records processed"));
  assert.ok(out().includes("Matched"));
});

test("all-matching run omits the What-needs-attention section", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(!out().includes("What needs attention"));
  assert.ok(out().includes("Results"));
});

test("discrepancies produce a plain-language attention line and keep canonical codes", async () => {
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
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(out().includes("What needs attention"));
  assert.ok(out().includes("details differ from your records"));
  assert.ok(out().includes("Review each Discrepancy result below"));
  assert.ok(out().includes("AMOUNT_MISMATCH"));
  assert.ok(out().includes("DISCREPANCY"));
});

test("merchant records missing from the provider produce an attention line", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": JSON.stringify({
      status: true,
      data: {
        id: 4123456789,
        reference: "REF-B",
        amount: 20000,
        currency: "NGN",
        status: "success",
        paid_at: "2023-11-14T22:13:20.000Z",
      },
    }),
  });
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(out().includes("What needs attention"));
  assert.ok(out().includes("have no matching provider payment"));
  assert.ok(out().includes("MISSING_PROVIDER_RECORD"));
  assert.ok(
    out().includes("no matching record in your merchant file"),
    "the extra provider payment must also be called out",
  );
});

test("invalid merchant records produce an attention line explaining how to fix them", async () => {
  const { io, out } = fakeIo({
    "merchant.csv":
      "merchant_reference,amount,currency,status,occurred_at,merchant_record_id\nREF-A,20000,,SUCCESS,1700000000000,M-1",
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(out().includes("What needs attention"));
  assert.ok(out().includes("invalid input data and could not be compared"));
  assert.ok(out().includes("Fix them in the file and run the command again"));
  assert.ok(out().includes("INPUT_ERROR"));
});

test("duplicate merchant records produce the held-for-review attention line", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": `${MERCHANT_CSV}\nREF-A,20000,NGN,SUCCESS,1700000000000,M-1b`,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, io), EXIT_SUCCESS);
  assert.ok(out().includes("What needs attention"));
  assert.ok(out().includes("duplicate entries prevented a safe match"));
  assert.ok(out().includes("HELD_AMBIGUOUS"));
  assert.ok(out().includes("DUPLICATE_MERCHANT_RECORD"));
});

test("unresolved-status and missing-reference records produce their attention lines", async () => {
  const unresolved = fakeIo({
    "merchant.csv":
      "merchant_reference,amount,currency,status,occurred_at,merchant_record_id\nREF-A,20000,NGN,AWAITING,1700000000000,M-1",
    "provider.json": JSON.stringify({
      status: true,
      data: {
        id: 4123456789,
        reference: "REF-A",
        amount: 20000,
        currency: "NGN",
        status: "abandoned",
        paid_at: "2023-11-14T22:13:20.000Z",
      },
    }),
  });
  assert.equal(await runCli(BASE_ARGS, unresolved.io), EXIT_SUCCESS);
  assert.ok(unresolved.out().includes("could not be fully confirmed"));
  assert.ok(unresolved.out().includes("STATUS_UNRESOLVED"));

  const missingReference = fakeIo({
    "merchant.csv":
      "merchant_reference,amount,currency,status,occurred_at,merchant_record_id\n,20000,NGN,SUCCESS,1700000000000,M-1",
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, missingReference.io), EXIT_SUCCESS);
  assert.ok(missingReference.out().includes("have no usable reference"));
  assert.ok(missingReference.out().includes("MISSING_REFERENCE"));
});

test("live mode states that Paystack transactions were fetched live", async () => {
  const { io, out } = liveFetch([LIVE_RESPONSE]);
  assert.equal(await runCli(LIVE_ARGS, io), EXIT_SUCCESS);
  assert.ok(
    out().includes(
      "compares your merchant records against Paystack transactions fetched live",
    ),
  );
});

test("live transport failures are labeled a connection problem, not a finding, and write no report", async () => {
  const { io, out, err } = liveFetch(
    [],
    new PaystackTransportError(
      "PAYSTACK_TRANSPORT_HTTP_SERVER_ERROR",
      "Paystack request failed with HTTP 500",
      { statusCode: 500 },
    ),
  );
  assert.equal(await runCli(LIVE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("live Paystack request failed"));
  assert.ok(err().includes("HTTP 500"));
  assert.ok(err().includes("Paystack connection or access problem"));
  assert.ok(err().includes("not a reconciliation finding"));
  assert.ok(err().includes("no records were matched"));
  assert.ok(!err().includes("sk_test_SECRET123"));
  assert.equal(out(), "");
});

test("missing live secret carries plain guidance and never a value", async () => {
  const { io, err } = fakeIo(
    { "merchant.csv": MERCHANT_CSV },
    { readEnv: () => undefined },
  );
  assert.equal(await runCli(LIVE_ARGS, io), EXIT_INPUT_FAILURE);
  assert.ok(err().includes("RECONCILEKIT_PAYSTACK_SECRET_KEY"));
  assert.ok(err().includes("Set the RECONCILEKIT_PAYSTACK_SECRET_KEY"));
  assert.ok(err().includes("then run the command again"));
});

test("input failures explain the cause and how to fix it", async () => {
  const unreadable = fakeIo();
  assert.equal(await runCli(BASE_ARGS, unreadable.io), EXIT_INPUT_FAILURE);
  assert.ok(unreadable.err().includes("cannot read merchant input file"));
  assert.ok(
    unreadable.err().includes("Check that the file exists at that path"),
  );

  const malformedCsv = fakeIo({
    "merchant.csv": `${MERCHANT_CSV}\n"REF-B,25000,NGN,SUCCESS,1700000000000,M-2`,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(await runCli(BASE_ARGS, malformedCsv.io), EXIT_INPUT_FAILURE);
  assert.ok(malformedCsv.err().includes("merchant input failed"));
  assert.ok(malformedCsv.err().includes("merchant CSV parsing failed"));
  assert.ok(malformedCsv.err().includes("Fix the invalid record(s)"));

  const badJson = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": "not-json{",
  });
  assert.equal(await runCli(BASE_ARGS, badJson.io), EXIT_INPUT_FAILURE);
  assert.ok(badJson.err().includes("provider input is not valid JSON"));
  assert.ok(badJson.err().includes("must contain valid JSON"));

  const unmappable = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": JSON.stringify({
      status: true,
      data: { reference: "REF-A" },
    }),
  });
  assert.equal(await runCli(BASE_ARGS, unmappable.io), EXIT_INPUT_FAILURE);
  assert.ok(unmappable.err().includes("provider input failed"));
  assert.ok(unmappable.err().includes("data.amount is missing"));
  assert.ok(unmappable.err().includes("could not be mapped to a recognizable"));
});

test("usage errors keep the help hint", async () => {
  const { io, err } = fakeIo();
  assert.equal(await runCli(["--merchant", "merchant.csv"], io), 2);
  assert.ok(err().includes("missing required option --provider"));
  assert.ok(err().includes('Run "reconcilekit --help"'));
});

test("json mode stays machine-readable and carries none of the text-only additions", async () => {
  const { io, out } = fakeIo({
    "merchant.csv": MERCHANT_CSV,
    "provider.json": PROVIDER_JSON,
  });
  assert.equal(
    await runCli([...BASE_ARGS, "--output", "json"], io),
    EXIT_SUCCESS,
  );
  const report = JSON.parse(out());
  assert.deepEqual(Object.keys(report.summary).sort(), [
    "countsByDiscrepancyCode",
    "discrepancies",
    "heldAmbiguous",
    "inputErrors",
    "matched",
    "missingProviderRecords",
    "missingReference",
    "totalRecords",
    "unmatchedProviderRecords",
    "unresolved",
  ]);
  assert.deepEqual(report.results[0].discrepancy_codes, []);
  assert.ok(!out().includes("What needs attention"));
  assert.ok(!out().includes("This report compares"));
});
