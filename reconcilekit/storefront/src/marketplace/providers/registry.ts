import type { MarketplaceServiceKind } from "../types.ts";
import type {
  AirtimeProvider,
  AirtimeProviderRequest,
  AirlineProvider,
  BusProvider,
  CableProvider,
  CableProviderRequest,
  CinemaProvider,
  DataProvider,
  DataProviderRequest,
  EducationProvider,
  EducationProviderRequest,
  ElectricityProvider,
  ElectricityProviderRequest,
  EventProvider,
  GiftCardProvider,
  InternetProvider,
  InternetProviderRequest,
  ProviderMode,
  PaymentProvider,
} from "./contracts.ts";
import {
  createMockServiceProvider,
  MockGiftCardProvider,
  MockPaymentProvider,
  MockTicketingProvider,
} from "./mock-provider.ts";

export interface MarketplaceProviderRegistry {
  readonly airtime: AirtimeProvider;
  readonly data: DataProvider;
  readonly electricity: ElectricityProvider;
  readonly cable: CableProvider;
  readonly internet: InternetProvider;
  readonly education: EducationProvider;
  readonly giftCards: GiftCardProvider;
  readonly cinema: CinemaProvider;
  readonly events: EventProvider;
  readonly bus: BusProvider;
  readonly airline: AirlineProvider;
  readonly payment: PaymentProvider;
  providerForServiceKind(kind: MarketplaceServiceKind): RegisteredProvider;
}

export type RegisteredProvider =
  | AirtimeProvider
  | DataProvider
  | ElectricityProvider
  | CableProvider
  | InternetProvider
  | EducationProvider
  | GiftCardProvider
  | CinemaProvider
  | EventProvider
  | BusProvider
  | AirlineProvider
  | PaymentProvider;

export function createMockProviderRegistry(): MarketplaceProviderRegistry {
  const airtime: AirtimeProvider =
    createMockServiceProvider<AirtimeProviderRequest>({
      id: "mock_airtime_adapter",
      providerId: "mock_vtu_provider",
      providerName: "Mock VTU Provider",
      serviceKinds: ["AIRTIME"],
      referencePrefix: "air",
    });
  const data: DataProvider = createMockServiceProvider<DataProviderRequest>({
    id: "mock_data_adapter",
    providerId: "mock_vtu_provider",
    providerName: "Mock VTU Provider",
    serviceKinds: ["DATA"],
    referencePrefix: "dat",
  });
  const electricity: ElectricityProvider =
    createMockServiceProvider<ElectricityProviderRequest>({
      id: "mock_electricity_adapter",
      providerId: "mock_bill_provider",
      providerName: "Mock Bill Provider",
      serviceKinds: ["ELECTRICITY"],
      referencePrefix: "ele",
    });
  const cable: CableProvider = createMockServiceProvider<CableProviderRequest>({
    id: "mock_cable_adapter",
    providerId: "mock_bill_provider",
    providerName: "Mock Bill Provider",
    serviceKinds: ["CABLE_TV"],
    referencePrefix: "cab",
  });
  const internet: InternetProvider =
    createMockServiceProvider<InternetProviderRequest>({
      id: "mock_internet_adapter",
      providerId: "mock_bill_provider",
      providerName: "Mock Bill Provider",
      serviceKinds: ["INTERNET"],
      referencePrefix: "net",
    });
  const education: EducationProvider =
    createMockServiceProvider<EducationProviderRequest>({
      id: "mock_education_adapter",
      providerId: "mock_education_provider",
      providerName: "Mock Education Provider",
      serviceKinds: ["EDUCATION"],
      referencePrefix: "edu",
    });
  const giftCards = new MockGiftCardProvider();
  const cinema = new MockTicketingProvider({
    id: "mock_cinema_adapter",
    providerId: "mock_ticket_provider",
    providerName: "Mock Ticket Provider",
    serviceKinds: ["CINEMA_TICKET"],
    referencePrefix: "cin",
    ticketKind: "CINEMA",
  });
  const events = new MockTicketingProvider({
    id: "mock_event_adapter",
    providerId: "mock_ticket_provider",
    providerName: "Mock Ticket Provider",
    serviceKinds: ["EVENT_TICKET"],
    referencePrefix: "evt",
    ticketKind: "EVENT",
  });
  const bus = new MockTicketingProvider({
    id: "mock_bus_adapter",
    providerId: "mock_ticket_provider",
    providerName: "Mock Ticket Provider",
    serviceKinds: ["BUS_TICKET"],
    referencePrefix: "bus",
    ticketKind: "BUS",
  });
  const airline = new MockTicketingProvider({
    id: "mock_airline_adapter",
    providerId: "mock_ticket_provider",
    providerName: "Mock Ticket Provider",
    serviceKinds: ["AIRLINE_TICKET"],
    referencePrefix: "airline",
    ticketKind: "AIRLINE",
  });
  const payment = new MockPaymentProvider();

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
    providerForServiceKind(kind) {
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

export function createProviderRegistry(
  mode: ProviderMode,
): MarketplaceProviderRegistry {
  switch (mode) {
    case "MOCK":
      return createMockProviderRegistry();
    case "REAL":
      throw new Error(
        "REAL provider mode not yet implemented; VTPass adapter lands in 5D.5",
      );
    default: {
      const exhaustive: never = mode;
      throw new Error(
        `unreachable: unknown provider mode ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
