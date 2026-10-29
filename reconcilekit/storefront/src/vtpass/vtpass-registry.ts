import type { MarketplaceServiceKind } from "../marketplace/types.ts";
import type {
  MarketplaceProviderRegistry,
  RegisteredProvider,
} from "../marketplace/providers/registry.ts";
import type {
  AirlineProvider,
  AirtimeProvider,
  BusProvider,
  CableProvider,
  CinemaProvider,
  DataProvider,
  EducationProvider,
  ElectricityProvider,
  EventProvider,
  GiftCardProvider,
  ProviderRequestContext,
} from "../marketplace/providers/contracts.ts";
import type { VtpassClient } from "./client.ts";
import { VtpassUnsupportedServiceError } from "./errors.ts";
import { VtpassServiceAdapter } from "./adapter.ts";
import { MockPaymentProvider } from "../marketplace/providers/mock-provider.ts";

function unsupported<Req>(
  id: string,
  kind: MarketplaceServiceKind,
  serviceKinds: readonly MarketplaceServiceKind[],
) {
  const thrower = async (
    context: ProviderRequestContext,
    _req: Req,
  ): Promise<never> => {
    throw new VtpassUnsupportedServiceError(kind, context.serviceId);
  };
  return {
    id,
    providerId: "vtpass",
    providerName: "VTPass",
    mode: "REAL" as const,
    serviceKinds,
    execute: thrower,
    queryStatus: thrower,
  };
}

export function createVtpassProviderRegistry(
  client: VtpassClient,
): MarketplaceProviderRegistry {
  const airtime: AirtimeProvider = new VtpassServiceAdapter(client, {
    kind: "AIRTIME" as const,
    extractBillersCode: (r) => r.recipient,
    extractPhone: (r) => r.recipient,
  });
  const data: DataProvider = new VtpassServiceAdapter(client, {
    kind: "DATA" as const,
    extractBillersCode: (r) => r.recipient,
    extractVariationCode: (r) => r.bundleId,
    extractPhone: (r) => r.recipient,
  });
  const electricity: ElectricityProvider = new VtpassServiceAdapter(client, {
    kind: "ELECTRICITY" as const,
    extractBillersCode: (r) => r.meterNumber,
  });
  const cable: CableProvider = new VtpassServiceAdapter(client, {
    kind: "CABLE_TV" as const,
    extractBillersCode: (r) => r.subscriberId,
    extractVariationCode: (r) => r.packageCode,
  });
  const education: EducationProvider = new VtpassServiceAdapter(client, {
    kind: "EDUCATION" as const,
    extractBillersCode: (r) => r.productCode,
  });
  const giftCards = unsupported<unknown>(
    "vtpass_giftcard_unsupported",
    "GIFT_CARD",
    ["GIFT_CARD", "DIGITAL_VOUCHER"],
  ) as unknown as GiftCardProvider;
  const cinema = unsupported<unknown>(
    "vtpass_cinema_unsupported",
    "CINEMA_TICKET",
    ["CINEMA_TICKET"],
  ) as unknown as CinemaProvider;
  const events = unsupported<unknown>(
    "vtpass_event_unsupported",
    "EVENT_TICKET",
    ["EVENT_TICKET"],
  ) as unknown as EventProvider;
  const bus = unsupported<unknown>("vtpass_bus_unsupported", "BUS_TICKET", [
    "BUS_TICKET",
  ]) as unknown as BusProvider;
  const airline = unsupported<unknown>(
    "vtpass_airline_unsupported",
    "AIRLINE_TICKET",
    ["AIRLINE_TICKET"],
  ) as unknown as AirlineProvider;
  const payment = new MockPaymentProvider();
  const internet = unsupported<unknown>(
    "vtpass_internet_unsupported",
    "INTERNET",
    ["INTERNET"],
  ) as unknown as import("../marketplace/providers/contracts.ts").InternetProvider;

  return {
    airtime,
    data,
    electricity,
    cable,
    internet,
    education,
    giftCards,
    cinema,
    events,
    bus,
    airline,
    payment,
    providerForServiceKind(kind): RegisteredProvider {
      switch (kind) {
        case "AIRTIME":
          return airtime;
        case "DATA":
          return data;
        case "ELECTRICITY":
          return electricity;
        case "CABLE_TV":
          return cable;
        case "INTERNET":
          return internet;
        case "EDUCATION":
          return education;
        case "GIFT_CARD":
        case "DIGITAL_VOUCHER":
          return giftCards;
        case "CINEMA_TICKET":
          return cinema;
        case "EVENT_TICKET":
          return events;
        case "BUS_TICKET":
          return bus;
        case "AIRLINE_TICKET":
          return airline;
        case "WALLET_FUNDING":
          return payment;
        case "BETTING":
          throw new Error("betting provider is compliance-gated in mock MVP");
      }
    },
  };
}
