import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fetchPaystackTransactions,
  PaystackTransportError,
  type PaystackTransportOptions,
} from "./transport.ts";
import {
  mapPaystackResponses,
  type PaystackAdapterOptions,
} from "./paystack.ts";

const PAYSTACK_OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: ["NGN"],
  timestampField: "created_at",
};

const SECRET = "sk_test_0123456789abcdef";

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

function stubFetch(
  responder: (call: FetchCall) => Response | Promise<Response>,
): { readonly fetchImpl: typeof fetch; readonly calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call: FetchCall = {
      url: String(input),
      init: init ?? {},
    };
    calls.push(call);
    return responder(call);
  };
  return { fetchImpl, calls };
}

async function captureRejection(
  promise: Promise<unknown>,
): Promise<PaystackTransportError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof PaystackTransportError);
    return error;
  }
  assert.fail("expected the promise to reject");
}

function transaction(
  reference: string,
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    reference,
    amount: 100_000,
    currency: "NGN",
    status: "success",
    created_at: "2023-11-14T22:15:00.000Z",
    paid_at: "2023-11-14T22:15:00.000Z",
    transaction_date: "2023-11-14T22:15:00.000Z",
    ...overrides,
  };
}

function listBody(
  data: readonly Record<string, unknown>[],
  meta: unknown,
): string {
  return JSON.stringify({ status: true, message: "ok", data, meta });
}

function listResponse(
  data: readonly Record<string, unknown>[],
  meta: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(listBody(data, meta), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function transportOptions(
  overrides: Partial<PaystackTransportOptions> = {},
): PaystackTransportOptions {
  return { secretKey: SECRET, ...overrides };
}

function authorizationOf(call: FetchCall): string | null {
  const headers = call.init.headers as Record<string, string> | undefined;
  return headers?.Authorization ?? null;
}

test("1. single-page fetch returns the raw transactions", async () => {
  const raw = transaction("REF-1", 1);
  const { fetchImpl, calls } = stubFetch(() =>
    listResponse([raw], { pagination: { page: 1, pageCount: 1 } }),
  );

  const result = await fetchPaystackTransactions(
    transportOptions({ fetchImpl }),
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.paystack.co/transaction?page=1&perPage=50",
  );
  assert.equal(result.responses.length, 1);
  assert.deepEqual(result.responses[0].data, raw);
  assert.equal(result.responses[0].status, true);
  assert.equal(result.responses[0].message, "ok");
});

test("2. multiple-page fetch requests every page", async () => {
  const pageOne = [transaction("REF-1", 1), transaction("REF-2", 2)];
  const pageTwo = [transaction("REF-3", 3)];
  const { fetchImpl, calls } = stubFetch((call) => {
    if (call.url.includes("page=1")) {
      return listResponse(pageOne, {
        pagination: { page: 1, pageCount: 2 },
      });
    }
    return listResponse(pageTwo, {
      pagination: { page: 2, pageCount: 2 },
    });
  });

  const result = await fetchPaystackTransactions(
    transportOptions({ fetchImpl }),
  );

  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes("page=1"));
  assert.ok(calls[1].url.includes("page=2"));
  assert.equal(result.responses.length, 3);
});

test("3. page ordering is preserved", async () => {
  const a = transaction("REF-A", 1);
  const b = transaction("REF-B", 2);
  const c = transaction("REF-C", 3);
  const { fetchImpl } = stubFetch((call) => {
    if (call.url.includes("page=1")) {
      return listResponse([a, b], {
        pagination: { page: 1, pageCount: 2 },
      });
    }
    return listResponse([c], {
      pagination: { page: 2, pageCount: 2 },
    });
  });

  const result = await fetchPaystackTransactions(
    transportOptions({ fetchImpl }),
  );

  assert.deepEqual(
    result.responses.map((r) => r.data),
    [a, b, c],
  );
  assert.deepEqual(result.responses[2].data, c);
});

test("4. Authorization header is sent correctly", async () => {
  const { fetchImpl, calls } = stubFetch(() =>
    listResponse([], { pagination: { page: 1, pageCount: 1 } }),
  );

  await fetchPaystackTransactions(transportOptions({ fetchImpl }));

  assert.equal(authorizationOf(calls[0]), `Bearer ${SECRET}`);
});

test("5. secret never appears in thrown error messages", async () => {
  const { fetchImpl } = stubFetch(() => new Response("{}", { status: 401 }));

  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
    (error: unknown) => {
      assert.ok(error instanceof PaystackTransportError);
      assert.ok(!error.message.includes(SECRET));
      return true;
    },
  );

  const failingFetch = stubFetch(() => {
    throw new Error("connection refused");
  });
  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ fetchImpl: failingFetch.fetchImpl }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof PaystackTransportError);
      assert.ok(!error.message.includes(SECRET));
      return true;
    },
  );
});

test("6. explicit request parameters are encoded correctly", async () => {
  const { fetchImpl, calls } = stubFetch(() =>
    listResponse([], { pagination: { page: 1, pageCount: 1 } }),
  );

  await fetchPaystackTransactions(transportOptions({ fetchImpl, perPage: 10 }));

  assert.equal(
    calls[0].url,
    "https://api.paystack.co/transaction?page=1&perPage=10",
  );
});

test("7. HTTP 400 surfaces as a transport error", async () => {
  const { fetchImpl } = stubFetch(() => new Response("{}", { status: 400 }));
  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_HTTP_BAD_REQUEST" &&
      error.statusCode === 400,
  );
});

test("8. HTTP 401 surfaces as a transport error", async () => {
  const { fetchImpl } = stubFetch(() => new Response("{}", { status: 401 }));
  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_HTTP_UNAUTHORIZED" &&
      error.statusCode === 401,
  );
});

test("9. HTTP 404 surfaces as a transport error", async () => {
  const { fetchImpl } = stubFetch(() => new Response("{}", { status: 404 }));
  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_HTTP_NOT_FOUND" &&
      error.statusCode === 404,
  );
});

test("10. HTTP 429 surfaces without automatic retrying", async () => {
  const { fetchImpl, calls } = stubFetch(
    () =>
      new Response("{}", {
        status: 429,
        headers: { "x-ratelimit-limit": "100" },
      }),
  );

  const error = await captureRejection(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
  );
  assert.equal(error.code, "PAYSTACK_TRANSPORT_HTTP_RATE_LIMITED");
  assert.equal(error.statusCode, 429);
  assert.equal(calls.length, 1);
});

test("11. HTTP 5xx surfaces as a transport error", async () => {
  const { fetchImpl } = stubFetch(() => new Response("{}", { status: 503 }));
  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_HTTP_SERVER_ERROR" &&
      error.statusCode === 503,
  );
});

test("12. network failure surfaces as a transport error", async () => {
  const { fetchImpl } = stubFetch(() => {
    throw new Error("connection refused");
  });
  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_NETWORK_FAILURE",
  );
});

test("13. AbortSignal cancellation surfaces as an abort error", async () => {
  const controller = new AbortController();
  controller.abort();
  const { fetchImpl } = stubFetch(() => {
    throw new DOMException("The operation was aborted.", "AbortError");
  });

  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ fetchImpl, signal: controller.signal }),
    ),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_ABORTED",
  );
});

test("14. malformed successful JSON/response shape surfaces as malformed", async () => {
  const invalidJson = stubFetch(
    () => new Response("<html>not json</html>", { status: 200 }),
  );
  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ fetchImpl: invalidJson.fetchImpl }),
    ),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_MALFORMED_RESPONSE",
  );

  const wrongShape = stubFetch(
    () =>
      new Response(
        JSON.stringify({ status: true, message: "ok", data: { id: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ fetchImpl: wrongShape.fetchImpl }),
    ),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_MALFORMED_RESPONSE",
  );
});

test("15. missing/invalid pagination metadata treats the page as the last", async () => {
  const withMissingMeta = stubFetch(() =>
    listResponse([transaction("REF-1", 1)], {}),
  );
  const missingResult = await fetchPaystackTransactions(
    transportOptions({ fetchImpl: withMissingMeta.fetchImpl }),
  );
  assert.equal(withMissingMeta.calls.length, 1);
  assert.equal(missingResult.responses.length, 1);

  const withInvalidMeta = stubFetch((call) => {
    if (call.url.includes("page=1")) {
      return listResponse([transaction("REF-1", 1)], {
        pagination: { page: 1, pageCount: "nope" },
      });
    }
    return listResponse([transaction("REF-2", 2)], {
      pagination: { page: 2, pageCount: 1 },
    });
  });
  const invalidResult = await fetchPaystackTransactions(
    transportOptions({ fetchImpl: withInvalidMeta.fetchImpl }),
  );
  assert.equal(withInvalidMeta.calls.length, 1);
  assert.equal(invalidResult.responses.length, 1);
});

test("16. no automatic retries occur", async () => {
  const failing = stubFetch(() => {
    throw new Error("connection refused");
  });
  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ fetchImpl: failing.fetchImpl }),
    ),
  );
  assert.equal(failing.calls.length, 1);

  const failingServer = stubFetch(() => new Response("{}", { status: 500 }));
  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ fetchImpl: failingServer.fetchImpl }),
    ),
  );
  assert.equal(failingServer.calls.length, 1);
});

test("17. rate-limit metadata is preserved", async () => {
  const { fetchImpl } = stubFetch(() =>
    listResponse(
      [],
      {
        pagination: { page: 1, pageCount: 1 },
      },
      {
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "99",
        "x-ratelimit-reset": "1700000000",
      },
    ),
  );

  const result = await fetchPaystackTransactions(
    transportOptions({ fetchImpl }),
  );

  assert.deepEqual(result.rateLimit, {
    limit: "100",
    remaining: "99",
    reset: "1700000000",
  });
});

test("17b. rate-limit metadata is preserved on HTTP 429 errors", async () => {
  const { fetchImpl } = stubFetch(
    () =>
      new Response("{}", {
        status: 429,
        headers: {
          "x-ratelimit-limit": "100",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1700000100",
        },
      }),
  );

  const error = await captureRejection(
    fetchPaystackTransactions(transportOptions({ fetchImpl })),
  );
  assert.deepEqual(error.rateLimit, {
    limit: "100",
    remaining: "0",
    reset: "1700000100",
  });
});

test("18. raw Paystack response reaches the existing adapter unchanged", async () => {
  const raw = transaction("REF-1", 1, {
    status: "reversed",
    amount: 45_000,
  });
  const envelope = { status: true, message: "ok", data: raw };
  const { fetchImpl } = stubFetch(() =>
    listResponse([raw], { pagination: { page: 1, pageCount: 1 } }),
  );

  const result = await fetchPaystackTransactions(
    transportOptions({ fetchImpl }),
  );

  const direct = mapPaystackResponses([envelope], PAYSTACK_OPTIONS);
  const viaTransport = mapPaystackResponses(result.responses, PAYSTACK_OPTIONS);
  assert.deepEqual(viaTransport, direct);
  assert.equal(viaTransport[0].payment.reference, "REF-1");
  assert.equal(viaTransport[0].payment.amount, 45_000);
  assert.equal(viaTransport[0].payment.status, "UNKNOWN");
  assert.deepEqual(viaTransport[0].source_attributes, {
    original_status: "reversed",
    created_at: "2023-11-14T22:15:00.000Z",
    paid_at: "2023-11-14T22:15:00.000Z",
    transaction_date: "2023-11-14T22:15:00.000Z",
  });
});

test("19. invalid options are rejected before any request", async () => {
  const { fetchImpl, calls } = stubFetch(() =>
    listResponse([], { pagination: { page: 1, pageCount: 1 } }),
  );

  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ secretKey: "" })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_INVALID_OPTION",
  );
  await assert.rejects(
    fetchPaystackTransactions(transportOptions({ perPage: 0, fetchImpl })),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_INVALID_OPTION",
  );
  await assert.rejects(
    fetchPaystackTransactions(
      transportOptions({ baseUrl: "http://insecure.example", fetchImpl }),
    ),
    (error: unknown) =>
      error instanceof PaystackTransportError &&
      error.code === "PAYSTACK_TRANSPORT_INVALID_OPTION",
  );
  assert.equal(calls.length, 0);
});
