import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import { executeMarketplaceTransaction } from "../../src/marketplace/transactions.ts";
import { reconcileMarketplaceTransaction } from "../../src/marketplace/reconcile.ts";
import type { ExecuteTransactionInput } from "../../src/marketplace/transactions.ts";
import { createVtpassWebhookHandler } from "../../src/application/vtpass-webhook.ts";
import { listTransactionEvents } from "../../src/marketplace/timeline.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import { demoDeps } from "./demo-deps.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import { truncateCommittedState } from "../db/isolation.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

beforeEach(async () => {
  await truncateCommittedState(prisma);
  await seedDemoCustomer(prisma);
});

after(async () => {
  await truncateCommittedState(prisma);
});

const NOW = WALLET_FIXED_TIMESTAMP;

function input(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "PENDING",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
    ...overrides,
  };
}

interface Captured {
  statusCode: number;
  body: string;
}

function makeReq(body: string, contentType: string | null): IncomingMessage {
  const req = Readable.from([
    Buffer.from(body, "utf8"),
  ]) as unknown as IncomingMessage & {
    headers: Record<string, string | string[] | undefined>;
    method: string;
    url: string;
  };
  req.headers = contentType === null ? {} : { "content-type": contentType };
  req.method = "POST";
  req.url = "/webhook/vtpass";
  return req as IncomingMessage;
}

function makeRes(): { res: ServerResponse; captured: Captured } {
  const captured: Captured = { statusCode: 0, body: "" };
  const res = {
    get statusCode() {
      return captured.statusCode;
    },
    set statusCode(v: number) {
      captured.statusCode = v;
    },
    setHeader(_name: string, _value: string) {
      /* no-op */
    },
    end(body?: string | Buffer) {
      captured.body =
        typeof body === "string" ? body : (body?.toString() ?? "");
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

function makeHandler() {
  const deps = demoDeps(repos);
  return createVtpassWebhookHandler({
    repos,
    catalog: deps.catalog,
  });
}

async function seedPendingAttempt(): Promise<{
  transactionId: string;
  requestReference: string;
}> {
  const executed = await executeMarketplaceTransaction(
    demoDeps(repos),
    input(),
  );
  const attempts = await repos.marketplaceProviderAttempts.listByTransaction(
    executed.transaction.id,
  );
  const attempt = attempts[0];
  assert.ok(attempt !== undefined, "attempt must exist after execute");
  return {
    transactionId: executed.transaction.id,
    requestReference: attempt.requestReference,
  };
}

function callbackBody(
  requestId: string,
  code: string,
  innerStatus: string | null,
): string {
  const payload = {
    type: "transaction-update",
    data: {
      code,
      requestId,
      content:
        innerStatus === null
          ? null
          : {
              transactions: {
                status: innerStatus,
                transactionId: "vt_tx_test_1",
              },
            },
    },
  };
  return JSON.stringify(payload);
}

test("vtpass webhook: malformed content-type → 400", async () => {
  const handler = makeHandler();
  const { res, captured } = makeRes();
  await handler(makeReq("{}", "text/plain"), res);
  assert.equal(captured.statusCode, 400);
});

test("vtpass webhook: malformed JSON body → 400", async () => {
  const handler = makeHandler();
  const { res, captured } = makeRes();
  await handler(makeReq("not-json", "application/json"), res);
  assert.equal(captured.statusCode, 400);
});

test("vtpass webhook: missing data.requestId → 400", async () => {
  const handler = makeHandler();
  const { res, captured } = makeRes();
  const body = JSON.stringify({
    type: "transaction-update",
    data: { code: "000" },
  });
  await handler(makeReq(body, "application/json"), res);
  assert.equal(captured.statusCode, 400);
});

test("vtpass webhook: unknown requestId → 200 no-op", async () => {
  const { transactionId } = await seedPendingAttempt();
  const before =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  const handler = makeHandler();
  const { res, captured } = makeRes();
  await handler(
    makeReq(
      callbackBody("req_does_not_exist", "000", "delivered"),
      "application/json",
    ),
    res,
  );
  assert.equal(captured.statusCode, 200);
  assert.deepEqual(JSON.parse(captured.body), { response: "success" });
  const after =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  assert.deepEqual(before, after);
});

test("vtpass webhook: delivered → attempt SUCCESS, fulfillment FULFILLED, event appended", async () => {
  const { transactionId, requestReference } = await seedPendingAttempt();
  const handler = makeHandler();
  const { res, captured } = makeRes();
  await handler(
    makeReq(
      callbackBody(requestReference, "000", "delivered"),
      "application/json",
    ),
    res,
  );
  assert.equal(captured.statusCode, 200);

  const attempts =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  assert.equal(attempts[0]?.status, "SUCCESS");
  assert.equal(attempts[0]?.canonicalStatus, "SUCCESS");

  const tx = await repos.marketplaceTransactions.readLatestById(transactionId);
  assert.ok(tx !== null);
  assert.equal(tx.fulfillmentStatus, "FULFILLED");

  const events = await listTransactionEvents(repos, transactionId);
  const callbackEvents = events.filter(
    (e) => e.label === "VTPass callback received",
  );
  assert.equal(callbackEvents.length, 1);
});

test("vtpass webhook: 016 failed → attempt FAILED, fulfillment FAILED", async () => {
  const { transactionId, requestReference } = await seedPendingAttempt();
  const handler = makeHandler();
  const { res, captured } = makeRes();
  await handler(
    makeReq(callbackBody(requestReference, "016", null), "application/json"),
    res,
  );
  assert.equal(captured.statusCode, 200);

  const attempts =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  assert.equal(attempts[0]?.status, "FAILED");
  assert.equal(attempts[0]?.canonicalStatus, "FAILED");

  const tx = await repos.marketplaceTransactions.readLatestById(transactionId);
  assert.ok(tx !== null);
  assert.equal(tx.fulfillmentStatus, "FAILED");
});

test("vtpass webhook: 040 reversed → attempt FAILED, fulfillment FAILED", async () => {
  const { transactionId, requestReference } = await seedPendingAttempt();
  const handler = makeHandler();
  const { res, captured } = makeRes();
  await handler(
    makeReq(callbackBody(requestReference, "040", null), "application/json"),
    res,
  );
  assert.equal(captured.statusCode, 200);

  const attempts =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  assert.equal(attempts[0]?.status, "FAILED");
  assert.equal(attempts[0]?.canonicalStatus, "FAILED");

  const tx = await repos.marketplaceTransactions.readLatestById(transactionId);
  assert.ok(tx !== null);
  assert.equal(tx.fulfillmentStatus, "FAILED");
});

test("vtpass webhook: duplicate callback is idempotent (no extra events)", async () => {
  const { transactionId, requestReference } = await seedPendingAttempt();
  const handler = makeHandler();
  const body = callbackBody(requestReference, "000", "delivered");

  const res1 = makeRes();
  await handler(makeReq(body, "application/json"), res1.res);
  assert.equal(res1.captured.statusCode, 200);

  const attemptsAfter1 =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  const txAfter1 =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  const eventsAfter1 = await listTransactionEvents(repos, transactionId);

  const res2 = makeRes();
  await handler(makeReq(body, "application/json"), res2.res);
  assert.equal(res2.captured.statusCode, 200);

  const attemptsAfter2 =
    await repos.marketplaceProviderAttempts.listByTransaction(transactionId);
  const txAfter2 =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  const eventsAfter2 = await listTransactionEvents(repos, transactionId);

  assert.deepEqual(attemptsAfter1, attemptsAfter2);
  assert.deepEqual(txAfter1, txAfter2);
  assert.equal(eventsAfter2.length, eventsAfter1.length);
});
