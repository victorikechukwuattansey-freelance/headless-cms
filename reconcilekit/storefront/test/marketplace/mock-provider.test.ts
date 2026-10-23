import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  AirtimeProvider,
  CableProvider,
  DataProvider,
  EducationProvider,
  ElectricityProvider,
  GiftCardProvider,
  InternetProvider,
  PaymentProvider,
  ProviderAdapter,
  ProviderRequestContext,
  TicketingProvider,
} from "../../src/marketplace/providers/contracts.ts";
import {
  MockGiftCardProvider,
  MockPaymentProvider,
  MockServiceProvider,
  MockTicketingProvider,
} from "../../src/marketplace/providers/mock-provider.ts";
import type { MockProviderScenario } from "../../src/marketplace/types.ts";

function context(
  scenario: MockProviderScenario,
  overrides: Partial<ProviderRequestContext> = {},
): ProviderRequestContext {
  return {
    transactionId: "txn_demo_001",
    customerId: "cus_demo",
    serviceId: "svc_airtime",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    requestId: "req_demo_001",
    correlationId: "corr_demo_001",
    attemptNumber: 1,
    customerReference: "cust_ref_001",
    idempotencyKey: "idem_demo_001",
    requestedAt: "2026-01-01T12:00:00.000Z",
    scenario,
    amountMinor: 1_000_00,
    currency: "NGN",
    metadata: { channel: "test" },
    ...overrides,
  };
}

test("airtime provider succeeds through the provider interface", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const result = await provider.execute(context("SUCCESS"), {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  });

  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.canonicalPaymentStatus, "SUCCESS");
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.match(result.providerReference ?? "", /^air_/);
  assert.equal(
    result.reconciliationFacts?.providerReference,
    result.providerReference,
  );
  assert.equal(result.sourceAttributes.scenario, "SUCCESS");
});

test("mock providers reject a missing scenario", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });
  const missingScenario = { ...context("SUCCESS"), scenario: undefined };

  await assert.rejects(
    () =>
      provider.execute(missingScenario, {
        recipient: "08030000000",
        network: "MTN",
        productCode: "AIRTIME_1000",
        amountMinor: 1_000_00,
        currency: "NGN",
      }),
    /requires context\.scenario/,
  );
});

test("mock service queryStatus replays the original scenario", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const result = await provider.queryStatus(context("SUCCESS"));

  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.canonicalPaymentStatus, "SUCCESS");
  assert.equal(result.scenario, "SUCCESS");
  assert.equal(result.requestId, "req_demo_001");
});

test("mock gift card queryStatus replays the original scenario", async () => {
  const provider: GiftCardProvider = new MockGiftCardProvider();

  const result = await provider.queryStatus(context("SUCCESS"));

  assert.equal(result.serviceKind, "GIFT_CARD");
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.scenario, "SUCCESS");
});

test("mock payment queryStatus replays the original scenario", async () => {
  const provider: PaymentProvider = new MockPaymentProvider();

  const result = await provider.queryStatus(context("SUCCESS"));

  assert.equal(result.serviceKind, "WALLET_FUNDING");
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.scenario, "SUCCESS");
});

test("data provider failure keeps provider, marketplace, and canonical statuses distinct", async () => {
  const provider: DataProvider = new MockServiceProvider({
    id: "mock_data_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["DATA"],
    referencePrefix: "dat",
  });

  const result = await provider.execute(context("FAILED"), {
    recipient: "08030000000",
    network: "Airtel",
    bundleId: "DATA_2GB",
    amountMinor: 2_000_00,
    currency: "NGN",
  });

  assert.equal(result.providerStatus, "PROVIDER_FAILED");
  assert.equal(result.attemptStatus, "FAILED");
  assert.equal(result.canonicalPaymentStatus, "FAILED");
  assert.equal(result.providerStatusCode, "MOCK_FAILED");
});

test("electricity pending response preserves provider facts for later reconciliation", async () => {
  const provider: ElectricityProvider = new MockServiceProvider({
    id: "mock_electricity_adapter",
    providerId: "mock_bill_provider",
    providerName: "Mock Bill Provider",
    serviceKinds: ["ELECTRICITY"],
    referencePrefix: "ele",
  });

  const result = await provider.execute(
    context("PENDING", {
      providerId: "mock_bill_provider",
      providerName: "Mock Bill Provider",
      serviceId: "svc_electricity",
    }),
    {
      meterNumber: "01234567890",
      disco: "IKEDC",
      customerName: "Demo Customer",
      tokenRequired: true,
      amountMinor: 5_000_00,
      currency: "NGN",
    },
  );

  assert.equal(result.attemptStatus, "PENDING");
  assert.equal(result.canonicalPaymentStatus, "PENDING");
  assert.equal(result.reconciliationFacts?.canonicalStatus, "PENDING");
  assert.equal(result.sourceAttributes.meterNumber, "01234567890");
});

test("timeout response is deterministic and does not invent provider facts", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });
  const request = {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  };

  const first = await provider.execute(context("TIMEOUT"), request);
  const second = await provider.execute(context("TIMEOUT"), request);

  assert.deepEqual(second, first);
  assert.equal(first.attemptStatus, "TIMEOUT");
  assert.equal(first.providerReference, null);
  assert.equal(first.responseTimestamp, null);
  assert.equal(first.reconciliationFacts, null);
});

test("duplicate scenario returns duplicate provider facts with the same reference", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const result = await provider.execute(context("DUPLICATE"), {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  });

  assert.equal(result.attemptStatus, "DUPLICATE");
  assert.equal(result.duplicateResults.length, 1);
  assert.equal(
    result.duplicateResults[0]?.providerReference,
    result.providerReference,
  );
});

test("mismatch scenario changes provider facts without changing request context", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const result = await provider.execute(context("MISMATCH"), {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  });

  assert.equal(result.attemptStatus, "MISMATCH");
  assert.match(result.providerReference ?? "", /^air_mismatch_/);
  assert.equal(result.amountMinor, 1_001_00);
  assert.equal(result.reconciliationFacts?.amountMinor, 1_001_00);
});

test("reversal and refund scenarios expose provider lifecycle states", async () => {
  const provider: PaymentProvider = new MockPaymentProvider();
  const request = {
    paymentIntentId: "pi_demo_001",
    paymentReference: "pay_ref_001",
    authorizationState: "REQUESTED" as const,
    settlementState: "PENDING" as const,
    amountMinor: 1_000_00,
    currency: "NGN",
  };

  const reversed = await provider.execute(context("REVERSED"), request);
  const refundPending = await provider.execute(
    context("REFUND_PENDING"),
    request,
  );
  const refundCompleted = await provider.execute(
    context("REFUND_COMPLETED"),
    request,
  );

  assert.equal(reversed.providerStatus, "PROVIDER_REVERSED");
  assert.equal(reversed.canonicalPaymentStatus, "CANCELLED");
  assert.equal(refundPending.providerStatus, "PROVIDER_REFUND_PENDING");
  assert.equal(refundPending.authorizationState, "PENDING");
  assert.equal(refundCompleted.providerStatus, "PROVIDER_REFUND_COMPLETED");
  assert.equal(refundCompleted.authorizationState, "AUTHORIZED");
});

test("gift card provider masks code evidence and does not expose raw codes", async () => {
  const provider: GiftCardProvider = new MockGiftCardProvider();

  const result = await provider.execute(
    context("SUCCESS", {
      providerId: "mock_gift_card_provider",
      providerName: "Mock Gift Card Provider",
      serviceId: "svc_gift_card",
    }),
    {
      brand: "DemoPlay",
      region: "NG",
      denominationMinor: 5_000_00,
      quantity: 2,
      currency: "NGN",
      recipientEmail: "demo@example.test",
    },
  );

  assert.equal(result.deliveryStatus, "DELIVERED");
  assert.match(result.maskedCodePreview ?? "", /^GC-/);
  assert.match(result.maskedCodePreview ?? "", /\*\*\*\*$/);
  assert.equal(result.safeMetadata.recipient_email_present, "true");
  assert.equal("raw_code" in result.safeMetadata, false);
});

test("ticketing provider separates search, reservation, and issuance", async () => {
  const provider: TicketingProvider = new MockTicketingProvider({
    id: "mock_bus_adapter",
    providerId: "mock_ticket_provider",
    providerName: "Mock Ticket Provider",
    serviceKinds: ["BUS_TICKET"],
    referencePrefix: "bus",
    ticketKind: "BUS",
  });
  const ticketContext = context("SUCCESS", {
    providerId: "mock_ticket_provider",
    providerName: "Mock Ticket Provider",
    serviceId: "svc_bus",
  });

  const availability = await provider.searchAvailability(ticketContext, {
    ticketKind: "BUS",
    originOrVenue: "Lagos",
    destination: "Ibadan",
    date: "2026-01-02",
    passengers: 1,
  });
  const reservation = await provider.reserve(ticketContext, {
    ticketKind: "BUS",
    availabilityId: availability[0]?.id ?? "missing",
    passengerOrAttendeeName: "Demo Passenger",
    seat: "A1",
    amountMinor: availability[0]?.amountMinor ?? 0,
    currency: "NGN",
  });
  const issued = await provider.issue(ticketContext, {
    ticketKind: "BUS",
    reservationReference: reservation.reservationReference ?? "missing",
    passengerOrAttendeeName: "Demo Passenger",
  });

  assert.equal(availability.length, 2);
  assert.match(reservation.reservationReference ?? "", /^res_bus_/);
  assert.match(issued.issueReference ?? "", /^iss_bus_/);
  assert.match(issued.maskedTicketCode ?? "", /^TKT-/);
});

test("partial success returns half the requested amount with SUCCESS canonical status", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const result = await provider.execute(context("PARTIAL_SUCCESS"), {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  });

  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.providerStatus, "PROVIDER_PARTIAL_SUCCESS");
  assert.equal(result.canonicalPaymentStatus, "SUCCESS");
  assert.equal(result.amountMinor, 500_00);
  assert.match(result.providerReference ?? "", /^air_/);
});

test("unknown scenario returns unmapped provider status with no safe resolution", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const result = await provider.execute(context("UNKNOWN"), {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  });

  assert.equal(result.attemptStatus, "UNKNOWN");
  assert.equal(result.providerStatus, "PROVIDER_UNKNOWN");
  assert.equal(result.canonicalPaymentStatus, "UNKNOWN");
  assert.equal(result.providerStatusCode, "MOCK_UNKNOWN");
  assert.match(result.providerReference ?? "", /^air_/);
});

test("cable provider executes through the provider interface", async () => {
  const provider: CableProvider = new MockServiceProvider({
    id: "mock_cable_adapter",
    providerId: "mock_bill_provider",
    providerName: "Mock Bill Provider",
    serviceKinds: ["CABLE_TV"],
    referencePrefix: "cab",
  });

  const result = await provider.execute(
    context("SUCCESS", {
      providerId: "mock_bill_provider",
      providerName: "Mock Bill Provider",
      serviceId: "svc_cable",
    }),
    {
      subscriberId: "SC-12345",
      packageCode: "DSTV_PREMIUM",
      provider: "DSTV",
      amountMinor: 3_500_00,
      currency: "NGN",
    },
  );

  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.match(result.providerReference ?? "", /^cab_/);
  assert.equal(result.reconciliationFacts?.canonicalStatus, "SUCCESS");
  assert.equal(result.sourceAttributes.subscriberId, "SC-12345");
});

test("internet provider executes through the provider interface", async () => {
  const provider: InternetProvider = new MockServiceProvider({
    id: "mock_internet_adapter",
    providerId: "mock_bill_provider",
    providerName: "Mock Bill Provider",
    serviceKinds: ["INTERNET"],
    referencePrefix: "net",
  });

  const result = await provider.execute(
    context("SUCCESS", {
      providerId: "mock_bill_provider",
      providerName: "Mock Bill Provider",
      serviceId: "svc_internet",
    }),
    {
      accountId: "ACC-9876",
      planId: "FIBER_50MBPS",
      provider: "FiberOne",
      amountMinor: 1_500_00,
      currency: "NGN",
    },
  );

  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.match(result.providerReference ?? "", /^net_/);
  assert.equal(result.reconciliationFacts?.canonicalStatus, "SUCCESS");
  assert.equal(result.sourceAttributes.accountId, "ACC-9876");
});

test("education provider executes through the provider interface", async () => {
  const provider: EducationProvider = new MockServiceProvider({
    id: "mock_education_adapter",
    providerId: "mock_education_provider",
    providerName: "Mock Education Provider",
    serviceKinds: ["EDUCATION"],
    referencePrefix: "edu",
  });

  const result = await provider.execute(
    context("SUCCESS", {
      providerId: "mock_education_provider",
      providerName: "Mock Education Provider",
      serviceId: "svc_education",
    }),
    {
      examBody: "WAEC",
      productCode: "WAEC_PIN",
      candidateName: "Demo Candidate",
      deliveryTarget: "demo@example.test",
      amountMinor: 1_200_00,
      currency: "NGN",
    },
  );

  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.match(result.providerReference ?? "", /^edu_/);
  assert.equal(result.reconciliationFacts?.canonicalStatus, "SUCCESS");
});

test("provider adapter boundary: marketplace code depends on ProviderAdapter interface, not concrete classes", () => {
  const provider: ProviderAdapter<{ readonly amountMinor: number }> =
    new MockServiceProvider({
      id: "mock_airtime_adapter",
      providerId: "mock_vtu_provider",
      providerName: "Mock VTU Provider",
      serviceKinds: ["AIRTIME"],
      referencePrefix: "air",
    });

  assert.equal(provider.id, "mock_airtime_adapter");
  assert.equal(provider.providerId, "mock_vtu_provider");
  assert.equal(provider.serviceKinds.includes("AIRTIME"), true);
  assert.equal(typeof provider.execute, "function");
});

test("deterministic mock: same context and scenario always produce the same result", async () => {
  const provider: AirtimeProvider = new MockServiceProvider({
    id: "mock_airtime_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["AIRTIME"],
    referencePrefix: "air",
  });

  const ctx = context("SUCCESS");
  const request = {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  };

  const first = await provider.execute(ctx, request);
  const second = await provider.execute(ctx, request);

  assert.deepEqual(second, first);
});
