import {
  buildInputsKey,
  buildMarketplaceSeed,
  buildTransactionId,
  buildTransactionReference,
} from "../ids.ts";
import type { MockProviderScenario } from "./types.ts";

/**
 * The 16 canonical demo-scenario names. Wallet funding failure is seeded
 * through the application-layer `fundWallet` path rather than a checkout; the
 * other 15 are realized as fully executed + reconciled marketplace
 * transactions. Names and their sorting are contract: the phase-2J demo test
 * asserts exactly these names.
 */
export const DEMO_SCENARIO_NAMES = [
  "successful_airtime",
  "failed_data",
  "pending_electricity",
  "provider_timeout",
  "duplicate_debit",
  "provider_mismatch",
  "successful_gift_card",
  "gift_card_fulfillment_failure",
  "cinema_ticket_success",
  "bus_ticket_refund",
  "airline_booking_pending",
  "wallet_funding_failure",
  "payment_success_service_failure",
  "payment_reversal",
  "refund_pending",
  "manual_review",
] as const;

export type DemoScenarioName = (typeof DEMO_SCENARIO_NAMES)[number];

export const WALLET_FUNDING_SCENARIO_NAME = "wallet_funding_failure" as const;

/** One deterministic orderable demo scenario. */
export interface DemoOrderScenario {
  readonly name: DemoScenarioName;
  readonly customerId: string;
  readonly serviceId: string;
  readonly scenario: MockProviderScenario;
  readonly inputs: Readonly<Record<string, string>>;
}

/**
 * The 15 orderable demo scenarios, each with a distinct (customer, service,
 * scenario, inputs) identity. Every input is valid against the demo catalog
 * schema so seeding exercises the same validate -> debit -> provider ->
 * reconcile path the UI uses.
 */
export const DEMO_ORDER_SCENARIOS: readonly DemoOrderScenario[] = [
  {
    name: "successful_airtime",
    customerId: "cus_demo_airtime",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
  },
  {
    name: "failed_data",
    customerId: "cus_demo_data",
    serviceId: "svc_data_mtn",
    scenario: "FAILED",
    inputs: { network: "MTN", recipient: "08030000001", plan: "1GB" },
  },
  {
    name: "pending_electricity",
    customerId: "cus_demo_electricity",
    serviceId: "svc_electricity_aedc",
    scenario: "PENDING",
    inputs: {
      provider: "AEDC",
      meterNumber: "12345678901",
      meterType: "prepaid",
      amount: "5000",
    },
  },
  {
    name: "provider_timeout",
    customerId: "cus_demo_cable_timeout",
    serviceId: "svc_cable_dstv",
    scenario: "TIMEOUT",
    inputs: {
      provider: "DStv",
      subscriberNumber: "7000123456",
      package: "Compact",
    },
  },
  {
    name: "duplicate_debit",
    customerId: "cus_demo_duplicate",
    serviceId: "svc_internet_spectranet",
    scenario: "DUPLICATE",
    inputs: {
      provider: "Spectranet",
      plan: "Monthly",
      accountNumber: "ACC1001",
    },
  },
  {
    name: "provider_mismatch",
    customerId: "cus_demo_mismatch",
    serviceId: "svc_education_jamb",
    scenario: "MISMATCH",
    inputs: {
      institution: "JAMB",
      applicationNumber: "JAMB4431",
      amount: "3500",
    },
  },
  {
    name: "successful_gift_card",
    customerId: "cus_demo_gift",
    serviceId: "svc_giftcard_amazon",
    scenario: "SUCCESS",
    inputs: {
      brand: "Amazon",
      region: "US",
      denomination: "$25",
      quantity: "1",
    },
  },
  {
    name: "gift_card_fulfillment_failure",
    customerId: "cus_demo_gift_failure",
    serviceId: "svc_giftcard_amazon",
    scenario: "FAILED",
    inputs: {
      brand: "Amazon",
      region: "US",
      denomination: "$25",
      quantity: "1",
    },
  },
  {
    name: "cinema_ticket_success",
    customerId: "cus_demo_cinema",
    serviceId: "svc_cinema_filmhouse",
    scenario: "SUCCESS",
    inputs: {
      venue: "Filmhouse IMAX",
      movie: "Oppenheimer",
      screening: "2026-02-01T19:00:00",
      seats: "A1",
    },
  },
  {
    name: "bus_ticket_refund",
    customerId: "cus_demo_bus",
    serviceId: "svc_bus_lagos_abuja",
    scenario: "REFUND_COMPLETED",
    inputs: {
      origin: "Lagos",
      destination: "Abuja",
      date: "2026-02-05",
      passenger: "Demo Passenger",
      seat: "A1",
    },
  },
  {
    name: "airline_booking_pending",
    customerId: "cus_demo_airline",
    serviceId: "svc_airline_los_abv",
    scenario: "PENDING",
    inputs: {
      origin: "LOS",
      destination: "ABV",
      date: "2026-02-10",
      passenger: "Demo Passenger",
      flight: "Economy",
    },
  },
  {
    name: "payment_success_service_failure",
    customerId: "cus_demo_voucher",
    serviceId: "svc_voucher_digital",
    scenario: "FAILED",
    inputs: {
      brand: "Amazon",
      region: "US",
      denomination: "$25",
      quantity: "1",
    },
  },
  {
    name: "payment_reversal",
    customerId: "cus_demo_reversal",
    serviceId: "svc_airtime_airtel",
    scenario: "REVERSED",
    inputs: { network: "Airtel", recipient: "08030000002", amount: "1000" },
  },
  {
    name: "refund_pending",
    customerId: "cus_demo_refund",
    serviceId: "svc_data_airtel",
    scenario: "REFUND_PENDING",
    inputs: { network: "Airtel", recipient: "08030000003", plan: "2GB" },
  },
  {
    name: "manual_review",
    customerId: "cus_demo_review",
    serviceId: "svc_cable_gotv",
    scenario: "UNKNOWN",
    inputs: {
      provider: "GOtv",
      subscriberNumber: "7000123457",
      package: "Yanga",
    },
  },
];

const ORDER_BY_NAME: Readonly<Record<string, DemoOrderScenario>> =
  Object.fromEntries(
    DEMO_ORDER_SCENARIOS.map((scenario) => [scenario.name, scenario]),
  );

/** Deterministic marketplace identity seed for an orderable demo scenario. */
export function demoMarketplaceSeed(scenario: DemoOrderScenario): string {
  return buildMarketplaceSeed({
    customerId: scenario.customerId,
    serviceId: scenario.serviceId,
    scenario: scenario.scenario,
    inputsKey: buildInputsKey(scenario.inputs),
  });
}

/** Canonical transaction id (`mk_txn_...`) for an orderable demo scenario. */
export function demoTransactionId(scenario: DemoOrderScenario): string {
  return buildTransactionId(demoMarketplaceSeed(scenario));
}

/** Canonical transaction reference (`txn_...`) for an orderable demo scenario. */
export function demoTransactionReference(scenario: DemoOrderScenario): string {
  return buildTransactionReference(demoMarketplaceSeed(scenario));
}

export interface ResolvedDemoAlias {
  readonly id: string;
  readonly reference: string;
}

/**
 * Friendly reference alias -> canonical transaction identity. An alias like
 * `txn_successful_airtime` resolves to the deterministic transaction id and
 * reference for that demo scenario (precedent: `txn_success_airtime`). The
 * mapping is pure and works before the seed has run; the subsequent lookup
 * simply finds nothing until the scenario is executed.
 */
export function resolveDemoAlias(identifier: string): ResolvedDemoAlias | null {
  if (!identifier.startsWith("txn_")) {
    return null;
  }
  const name = identifier.slice(4);
  const scenario = ORDER_BY_NAME[name];
  if (scenario === undefined) {
    return null;
  }
  return {
    id: demoTransactionId(scenario),
    reference: demoTransactionReference(scenario),
  };
}

/** The friendly reference alias for a demo scenario name. */
export function demoAliasFor(name: DemoScenarioName): string {
  return `txn_${name}`;
}
