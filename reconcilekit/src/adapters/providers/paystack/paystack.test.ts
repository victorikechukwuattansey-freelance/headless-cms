import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileRecords } from "../../../application/reconcile-records.ts";
import { DEFAULT_CONFIG, merchant } from "../../../domain/fixtures.ts";
import {
  mapPaystackResponse,
  mapPaystackResponses,
  PaystackAdapterError,
} from "./paystack.ts";
import type {
  PaystackAdapterOptions,
  PaystackResponse,
  PaystackTransactionData,
} from "./paystack.ts";

const OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: ["NGN", "USD"],
  timestampField: "paid_at",
};

function transaction(
  overrides: Partial<PaystackTransactionData> = {},
): PaystackTransactionData {
  return {
    id: 4123456789,
    reference: "REF-P1",
    amount: 20000,
    currency: "NGN",
    status: "success",
    created_at: "2023-11-14T22:13:20.000Z",
    paid_at: "2023-11-14T22:13:30.000Z",
    transaction_date: "2023-11-14T22:13:20.000Z",
    ...overrides,
  };
}

function response(overrides: Partial<PaystackResponse> = {}): PaystackResponse {
  return {
    status: true,
    message: "Verification successful",
    data: transaction(),
    ...overrides,
  };
}

test("1. valid Paystack transaction maps to the exact ProviderPayment shape with source attributes", () => {
  const mapped = mapPaystackResponse(response(), OPTIONS);
  assert.deepEqual(mapped, {
    payment: {
      reference: "REF-P1",
      amount: 20000,
      currency: "NGN",
      status: "SUCCESS",
      occurred_at: Date.parse("2023-11-14T22:13:30.000Z"),
      provider_id: "4123456789",
    },
    source_attributes: {
      original_status: "success",
      created_at: "2023-11-14T22:13:20.000Z",
      paid_at: "2023-11-14T22:13:30.000Z",
      transaction_date: "2023-11-14T22:13:20.000Z",
    },
  });
});

test("2. multiple transactions preserve source order", () => {
  const mapped = mapPaystackResponses(
    [
      response({ data: transaction({ reference: "REF-A" }) }),
      response({ data: transaction({ reference: "REF-B" }) }),
      response({ data: transaction({ reference: "REF-C" }) }),
    ],
    OPTIONS,
  );
  assert.deepEqual(
    mapped.map((entry) => entry.payment.reference),
    ["REF-A", "REF-B", "REF-C"],
  );
});

test("3. provider reference mapping preserves values verbatim", () => {
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ reference: "REF-P1" }) }),
      OPTIONS,
    ).payment.reference,
    "REF-P1",
  );
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ reference: "" }) }),
      OPTIONS,
    ).payment.reference,
    "",
  );
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ reference: null }) }),
      OPTIONS,
    ).payment.reference,
    null,
  );
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ reference: undefined }) }),
      OPTIONS,
    ).payment.reference,
    null,
  );
});

test("4. amount mapping preserves integer subunit amounts", () => {
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ amount: 20000 }) }),
      OPTIONS,
    ).payment.amount,
    20000,
  );
  assert.equal(
    mapPaystackResponse(response({ data: transaction({ amount: 0 }) }), OPTIONS)
      .payment.amount,
    0,
  );
  const large = Number.MAX_SAFE_INTEGER - 1;
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ amount: large }) }),
      OPTIONS,
    ).payment.amount,
    large,
  );
});

test("5. currency mapping passes the supported code through verbatim", () => {
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ currency: "NGN" }) }),
      OPTIONS,
    ).payment.currency,
    "NGN",
  );
  assert.equal(
    mapPaystackResponse(
      response({ data: transaction({ currency: "USD" }) }),
      OPTIONS,
    ).payment.currency,
    "USD",
  );
});

test("6. status mapping follows the evidence-backed Paystack vocabulary", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["success", "SUCCESS"],
    ["failed", "FAILED"],
    ["pending", "PENDING"],
    ["processing", "PENDING"],
    ["ongoing", "PENDING"],
    ["queued", "PENDING"],
    ["abandoned", "UNKNOWN"],
    ["reversed", "UNKNOWN"],
  ];
  for (const [paystackStatus, canonicalStatus] of cases) {
    assert.equal(
      mapPaystackResponse(
        response({ data: transaction({ status: paystackStatus }) }),
        OPTIONS,
      ).payment.status,
      canonicalStatus,
      `expected ${paystackStatus} -> ${canonicalStatus}`,
    );
  }
});

test("6b. abandoned and reversed never map to CANCELLED", () => {
  for (const status of ["abandoned", "reversed"]) {
    const mapped = mapPaystackResponse(
      response({ data: transaction({ status }) }),
      OPTIONS,
    );
    assert.notEqual(mapped.payment.status, "CANCELLED");
    assert.equal(mapped.payment.status, "UNKNOWN");
    assert.equal(mapped.source_attributes.original_status, status);
  }
});

test("7. timestamp mapping uses the explicitly selected timestamp field", () => {
  const paidAt = mapPaystackResponse(response(), OPTIONS).payment.occurred_at;
  assert.equal(paidAt, Date.parse("2023-11-14T22:13:30.000Z"));
  const createdAt = mapPaystackResponse(response(), {
    ...OPTIONS,
    timestampField: "created_at",
  }).payment.occurred_at;
  assert.equal(createdAt, Date.parse("2023-11-14T22:13:20.000Z"));
  const transactionDate = mapPaystackResponse(response(), {
    ...OPTIONS,
    timestampField: "transaction_date",
  }).payment.occurred_at;
  assert.equal(transactionDate, Date.parse("2023-11-14T22:13:20.000Z"));
  const absent = mapPaystackResponse(
    response({ data: transaction({ paid_at: null }) }),
    OPTIONS,
  ).payment.occurred_at;
  assert.equal(absent, null);
});

test("8. source attributes preserve original status and source timestamps", () => {
  const mapped = mapPaystackResponse(
    response({ data: transaction({ status: "reversed", paid_at: undefined }) }),
    OPTIONS,
  );
  assert.equal(mapped.source_attributes.original_status, "reversed");
  assert.equal(mapped.source_attributes.created_at, "2023-11-14T22:13:20.000Z");
  assert.equal(
    mapped.source_attributes.transaction_date,
    "2023-11-14T22:13:20.000Z",
  );
  assert.equal("paid_at" in mapped.source_attributes, false);
});

test("9. missing required provider fields produce deterministic input errors", () => {
  assert.throws(
    () =>
      mapPaystackResponse(
        response({ data: transaction({ amount: undefined }) }),
        OPTIONS,
      ),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_MISSING_FIELD",
  );
  assert.throws(
    () =>
      mapPaystackResponse(
        response({ data: transaction({ currency: null }) }),
        OPTIONS,
      ),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_MISSING_FIELD",
  );
});

test("10. malformed amounts produce adapter input errors, never coercion", () => {
  for (const amount of [
    "20000",
    20000.5,
    -1,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () =>
        mapPaystackResponse(
          response({ data: transaction({ amount: amount as number }) }),
          OPTIONS,
        ),
      (error: unknown) =>
        error instanceof PaystackAdapterError &&
        error.code === "PAYSTACK_INVALID_AMOUNT",
    );
  }
});

test("11. malformed timestamps produce adapter input errors", () => {
  for (const paidAt of [
    "2023-11-14T22:13:30",
    "not-a-date",
    1700000000000,
    {},
  ]) {
    assert.throws(
      () =>
        mapPaystackResponse(
          response({ data: transaction({ paid_at: paidAt as string }) }),
          OPTIONS,
        ),
      (error: unknown) =>
        error instanceof PaystackAdapterError &&
        error.code === "PAYSTACK_INVALID_TIMESTAMP",
    );
  }
});

test("12. unmapped provider statuses become canonical UNKNOWN with source preserved", () => {
  const mapped = mapPaystackResponse(
    response({ data: transaction({ status: "captured" }) }),
    OPTIONS,
  );
  assert.equal(mapped.payment.status, "UNKNOWN");
  assert.equal(mapped.source_attributes.original_status, "captured");
  const nonString = mapPaystackResponse(
    response({ data: transaction({ status: 123 as unknown as string }) }),
    OPTIONS,
  );
  assert.equal(nonString.payment.status, "UNKNOWN");
  assert.equal(nonString.source_attributes.original_status, "123");
});

test("13. optional provider fields may be absent", () => {
  const mapped = mapPaystackResponse(
    response({
      data: {
        amount: 20000,
        currency: "NGN",
      },
    }),
    OPTIONS,
  );
  assert.deepEqual(mapped.payment, {
    reference: null,
    amount: 20000,
    currency: "NGN",
    status: null,
    occurred_at: null,
    provider_id: null,
  });
  assert.deepEqual(mapped.source_attributes, {});
});

test("14. malformed provider response envelopes produce envelope errors", () => {
  for (const payload of [
    null,
    undefined,
    {},
    { data: null },
    { data: "not-an-object" },
  ]) {
    assert.throws(
      () => mapPaystackResponse(payload as PaystackResponse, OPTIONS),
      (error: unknown) =>
        error instanceof PaystackAdapterError &&
        error.code === "PAYSTACK_MALFORMED_RESPONSE",
    );
  }
});

test("15. multiple provider transactions map with predictable record attribution", () => {
  const mapped = mapPaystackResponses(
    [
      response({ data: transaction({ reference: "REF-A" }) }),
      response({ data: transaction({ amount: 500 }) }),
      response({ data: transaction({ reference: "REF-C" }) }),
    ],
    OPTIONS,
  );
  assert.equal(mapped.length, 3);
  assert.equal(mapped[1].payment.amount, 500);
  assert.throws(
    () =>
      mapPaystackResponses(
        [
          response({ data: transaction({ reference: "REF-A" }) }),
          response({ data: transaction({ amount: 20000.5 }) }),
        ],
        OPTIONS,
      ),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_INVALID_AMOUNT" &&
      error.record === 2,
  );
});

test("16. provider record identity is preserved", () => {
  const mapped = mapPaystackResponse(
    response({ data: transaction({ id: 999888777 }) }),
    OPTIONS,
  );
  assert.equal(mapped.payment.provider_id, "999888777");
  assert.equal(mapped.payment.reference, "REF-P1");
  assert.equal(mapped.payment.amount, 20000);
});

test("17. mapping is deterministic", () => {
  const first = mapPaystackResponse(response(), OPTIONS);
  const second = mapPaystackResponse(response(), OPTIONS);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("18. provider-specific fields do not leak into canonical fields", () => {
  const data = transaction({
    customer: { id: 123, email: "buyer@example.com" } as never,
    gateway_response: "Successful",
    channel: "card",
    authorization_code: "AUTH_X",
  } as Partial<PaystackTransactionData>);
  const mapped = mapPaystackResponse(response({ data }), OPTIONS);
  assert.deepEqual(Object.keys(mapped.payment).sort(), [
    "amount",
    "currency",
    "occurred_at",
    "provider_id",
    "reference",
    "status",
  ]);
  assert.deepEqual(Object.keys(mapped.source_attributes).sort(), [
    "created_at",
    "original_status",
    "paid_at",
    "transaction_date",
  ]);
});

test("18b. the outer envelope status is never used as the transaction status", () => {
  const mapped = mapPaystackResponse(
    response({ status: false, data: transaction({ status: "success" }) }),
    OPTIONS,
  );
  assert.equal(mapped.payment.status, "SUCCESS");
});

test("19. adapter errors remain adapter/input errors, never domain outcomes", () => {
  try {
    mapPaystackResponse(
      response({ data: transaction({ amount: -1 }) }),
      OPTIONS,
    );
    assert.fail("expected mapping to throw");
  } catch (error) {
    assert.ok(error instanceof PaystackAdapterError);
    assert.match(error.code, /^PAYSTACK_/);
  }
});

test("20. mapped provider records cross the existing Application boundary", () => {
  const mapped = mapPaystackResponse(
    response({ data: transaction({ reference: "REF-A", amount: 20000 }) }),
    OPTIONS,
  );
  const report = reconcileRecords({
    merchantPayments: [
      merchant({ merchant_reference: "REF-A", amount: 20000 }),
    ],
    providerPayments: [mapped.payment],
    config: DEFAULT_CONFIG,
  });
  assert.equal(report.summary.matched, 1);
  assert.equal(report.results[0].outcome, "MATCH");
});

test("unsupported provider currencies are rejected at the adapter boundary", () => {
  assert.throws(
    () =>
      mapPaystackResponse(
        response({ data: transaction({ currency: "USD" }) }),
        {
          ...OPTIONS,
          supportedCurrencies: ["NGN"],
        },
      ),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_UNSUPPORTED_CURRENCY",
  );
});

test("invalid adapter options are rejected", () => {
  assert.throws(
    () =>
      mapPaystackResponse(
        response(),
        null as unknown as PaystackAdapterOptions,
      ),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_INVALID_OPTION",
  );
  assert.throws(
    () =>
      mapPaystackResponse(response(), {
        ...OPTIONS,
        timestampField: "settled_at" as never,
      }),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_INVALID_OPTION",
  );
  assert.throws(
    () =>
      mapPaystackResponse(response(), {
        timestampField: "paid_at",
        supportedCurrencies: "NGN" as unknown as string[],
      }),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_INVALID_OPTION",
  );
});
