import type {
  AvailabilityStatus,
  CatalogGroup,
  CatalogProduct,
  ComplianceStatus,
  FulfillmentType,
  MarketAvailabilityResult,
  MarketplaceCatalog,
  MarketplaceCategory,
  MarketplaceProvider,
  MarketplaceService,
  MarketplaceServiceKind,
  ProductPricing,
  ServiceInputDescriptor,
} from "./types.ts";
import {
  createMockProviderRegistry,
  type MarketplaceProviderRegistry,
} from "./providers/registry.ts";

export const CATALOG_VERSION = "1.0.0";
export const CATALOG_CREATED_AT = "2026-01-01T12:00:00.000Z";

export const DEFAULT_SCENARIOS: readonly string[] = [
  "SUCCESS",
  "FAILED",
  "PENDING",
  "DUPLICATE",
  "MISMATCH",
  "REVERSED",
  "REFUND_PENDING",
];

/**
 * Category id constants, shared between the seeded catalog and lookups.
 * A category maps 1:1 to a CatalogGroup and a MarketplaceServiceKind family,
 * so UI never hard-codes "Electricity = provider X".
 */
export const CatalogCategoryId = {
  Airtime: "cat_airtime",
  Data: "cat_data",
  Electricity: "cat_electricity",
  Cable: "cat_cable",
  Internet: "cat_internet",
  Education: "cat_education",
  GiftCards: "cat_gift_cards",
  Cinema: "cat_cinema",
  Events: "cat_events",
  Bus: "cat_bus",
  Airline: "cat_airline",
  Betting: "cat_betting",
} as const;

export type CatalogCategoryId =
  (typeof CatalogCategoryId)[keyof typeof CatalogCategoryId];

/** Maps a category to the fulfillment type that its services/products share. */
export function fulfillmentTypeForCategory(
  categoryId: string,
): FulfillmentType {
  switch (categoryId) {
    case CatalogCategoryId.Airtime:
      return "INSTANT_DIGITAL";
    case CatalogCategoryId.Data:
      return "INSTANT_DIGITAL";
    case CatalogCategoryId.Electricity:
      return "UTILITY";
    case CatalogCategoryId.Cable:
      return "UTILITY";
    case CatalogCategoryId.Internet:
      return "SUBSCRIPTION";
    case CatalogCategoryId.Education:
      return "UTILITY";
    case CatalogCategoryId.GiftCards:
      return "DIGITAL_GOOD";
    case CatalogCategoryId.Cinema:
      return "TICKET";
    case CatalogCategoryId.Events:
      return "TICKET";
    case CatalogCategoryId.Bus:
      return "TICKET";
    case CatalogCategoryId.Airline:
      return "TICKET";
    case CatalogCategoryId.Betting:
      return "FUTURE_COMPLIANCE_GATED";
    default:
      return "INSTANT_DIGITAL";
  }
}

/** Maps a service kind to its guaranteed provider id from the registry. */
export function providerIdForServiceKind(kind: MarketplaceServiceKind): string {
  const registry = createMockProviderRegistry();
  try {
    return registry.providerForServiceKind(kind).providerId;
  } catch {
    // Betting is not registered; there is no provider for it yet.
    return "no_provider";
  }
}

export interface ServiceDefinition {
  readonly id: string;
  readonly categoryId: string;
  readonly kind: MarketplaceServiceKind;
  readonly name: string;
  readonly description: string;
  readonly currency: string;
  readonly baseAmountMinor: number;
  readonly complianceStatus: ComplianceStatus;
  readonly availability: AvailabilityStatus;
  readonly inputSchema: readonly ServiceInputDescriptor[];
}

export interface ProductDefinition {
  readonly id: string;
  readonly serviceId: string;
  readonly name: string;
  readonly description: string;
  readonly pricing: ProductPricing;
  readonly availability: AvailabilityStatus;
  readonly attributes: Readonly<Record<string, string>>;
}

interface CatalogSeed {
  readonly categories: readonly MarketplaceCategory[];
  readonly services: readonly MarketplaceService[];
  readonly products: readonly CatalogProduct[];
}

const SCHEMA_AIRTIME: readonly ServiceInputDescriptor[] = [
  {
    name: "network",
    label: "Network",
    type: "SELECT",
    required: true,
    options: ["MTN", "Airtel", "Glo", "9mobile"],
  },
  {
    name: "recipient",
    label: "Recipient phone",
    type: "PHONE",
    required: true,
  },
  { name: "amount", label: "Amount (NGN)", type: "NUMBER", required: true },
];

const SCHEMA_DATA: readonly ServiceInputDescriptor[] = [
  {
    name: "network",
    label: "Network",
    type: "SELECT",
    required: true,
    options: ["MTN", "Airtel", "Glo", "9mobile"],
  },
  {
    name: "recipient",
    label: "Recipient phone",
    type: "PHONE",
    required: true,
  },
  {
    name: "plan",
    label: "Data plan",
    type: "SELECT",
    required: true,
    options: ["1GB", "2GB", "5GB", "10GB"],
  },
];

const SCHEMA_ELECTRICITY: readonly ServiceInputDescriptor[] = [
  {
    name: "provider",
    label: "Utility provider",
    type: "SELECT",
    required: true,
    options: ["AEDC", "IKEDC", "EEDC", "PHEDC"],
  },
  { name: "meterNumber", label: "Meter number", type: "TEXT", required: true },
  {
    name: "meterType",
    label: "Meter type",
    type: "SELECT",
    required: true,
    options: ["prepaid", "postpaid"],
  },
  { name: "amount", label: "Amount (NGN)", type: "NUMBER", required: true },
];

const SCHEMA_CABLE: readonly ServiceInputDescriptor[] = [
  {
    name: "provider",
    label: "Cable provider",
    type: "SELECT",
    required: true,
    options: ["DStv", "GOtv", "StarTimes"],
  },
  {
    name: "subscriberNumber",
    label: "Subscriber number",
    type: "TEXT",
    required: true,
  },
  {
    name: "package",
    label: "Package",
    type: "SELECT",
    required: true,
    options: ["Compact", "Premium", "Yanga"],
  },
];

const SCHEMA_INTERNET: readonly ServiceInputDescriptor[] = [
  {
    name: "provider",
    label: "ISP",
    type: "SELECT",
    required: true,
    options: ["Spectranet", "Smile", "ipNX"],
  },
  {
    name: "plan",
    label: "Internet plan",
    type: "SELECT",
    required: true,
    options: ["Monthly", "Quarterly"],
  },
  {
    name: "accountNumber",
    label: "Account number",
    type: "TEXT",
    required: true,
  },
];

const SCHEMA_EDUCATION: readonly ServiceInputDescriptor[] = [
  {
    name: "institution",
    label: "Institution",
    type: "SELECT",
    required: true,
    options: ["JAMB", "WAEC", "LASU"],
  },
  {
    name: "applicationNumber",
    label: "Application number",
    type: "TEXT",
    required: true,
  },
  { name: "amount", label: "Amount (NGN)", type: "NUMBER", required: true },
];

const SCHEMA_GIFT_CARD: readonly ServiceInputDescriptor[] = [
  {
    name: "brand",
    label: "Card brand",
    type: "SELECT",
    required: true,
    options: ["Amazon", "Steam", "iTunes", "Google Play"],
  },
  {
    name: "region",
    label: "Region",
    type: "SELECT",
    required: true,
    options: ["US", "UK", "Global"],
  },
  {
    name: "denomination",
    label: "Denomination",
    type: "SELECT",
    required: true,
    options: ["$10", "$25", "$50", "$100"],
  },
  { name: "quantity", label: "Quantity", type: "NUMBER", required: true },
];

const SCHEMA_CINEMA: readonly ServiceInputDescriptor[] = [
  {
    name: "venue",
    label: "Cinema",
    type: "SELECT",
    required: true,
    options: ["Filmhouse IMAX", "Silverbird", "Genesis"],
  },
  {
    name: "movie",
    label: "Movie",
    type: "SELECT",
    required: true,
    options: ["Guardians", "Oppenheimer", "Avatar 3"],
  },
  { name: "screening", label: "Screening time", type: "DATE", required: true },
  { name: "seats", label: "Seats", type: "TEXT", required: true },
];

const SCHEMA_EVENT: readonly ServiceInputDescriptor[] = [
  {
    name: "eventName",
    label: "Event",
    type: "SELECT",
    required: true,
    options: ["Lagos Tech Fest", "Afrobeats Live", "Career Fair"],
  },
  { name: "date", label: "Event date", type: "DATE", required: true },
  {
    name: "ticketType",
    label: "Ticket type",
    type: "SELECT",
    required: true,
    options: ["Standard", "VIP", "VVIP"],
  },
  { name: "quantity", label: "Quantity", type: "NUMBER", required: true },
];

const SCHEMA_BUS: readonly ServiceInputDescriptor[] = [
  {
    name: "origin",
    label: "Origin",
    type: "SELECT",
    required: true,
    options: ["Lagos", "Abuja", "Port Harcourt"],
  },
  {
    name: "destination",
    label: "Destination",
    type: "SELECT",
    required: true,
    options: ["Abuja", "Lagos", "Ibadan"],
  },
  { name: "date", label: "Travel date", type: "DATE", required: true },
  { name: "passenger", label: "Passenger name", type: "TEXT", required: true },
  { name: "seat", label: "Seat", type: "TEXT", required: true },
];

const SCHEMA_AIRLINE: readonly ServiceInputDescriptor[] = [
  {
    name: "origin",
    label: "Origin",
    type: "SELECT",
    required: true,
    options: ["LOS", "ABV", "PHC"],
  },
  {
    name: "destination",
    label: "Destination",
    type: "SELECT",
    required: true,
    options: ["ABV", "LOS", "LON"],
  },
  { name: "date", label: "Travel date", type: "DATE", required: true },
  { name: "passenger", label: "Passenger name", type: "TEXT", required: true },
  {
    name: "flight",
    label: "Flight / fare",
    type: "SELECT",
    required: true,
    options: ["Economy", "Business"],
  },
];

const SCHEMA_BETTING: readonly ServiceInputDescriptor[] = [
  {
    name: "operator",
    label: "Betting operator",
    type: "SELECT",
    required: true,
    options: ["ExampleBet"],
  },
];

function defineService(s: ServiceDefinition): MarketplaceService {
  return {
    id: s.id,
    categoryId: s.categoryId,
    providerId: providerIdForServiceKind(s.kind),
    kind: s.kind,
    name: s.name,
    description: s.description,
    currency: s.currency,
    baseAmountMinor: s.baseAmountMinor,
    complianceStatus: s.complianceStatus,
    fulfillmentType: fulfillmentTypeForCategory(s.categoryId),
    availability: s.availability,
    inputSchema: s.inputSchema,
    simulated: true,
  };
}

function defineProduct(
  p: ProductDefinition,
  services: readonly MarketplaceService[],
): CatalogProduct {
  const service = services.find((svc) => svc.id === p.serviceId);
  if (!service) {
    throw new Error(`product references unknown service ${p.serviceId}`);
  }
  return {
    id: p.id,
    serviceId: p.serviceId,
    categoryId: service.categoryId,
    providerId: service.providerId,
    name: p.name,
    description: p.description,
    kind: service.kind,
    fulfillmentType: service.fulfillmentType,
    pricing: p.pricing,
    availability: p.availability,
    attributes: p.attributes,
    simulated: true,
  };
}

function buildCategories(): readonly MarketplaceCategory[] {
  return [
    {
      id: CatalogCategoryId.Airtime,
      group: "CORE_VTU_BILL_PAYMENT",
      name: "Airtime",
      description: "Mobile airtime top-up across networks.",
      complianceStatus: "AVAILABLE",
      displayOrder: 1,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Data,
      group: "CORE_VTU_BILL_PAYMENT",
      name: "Data",
      description: "Mobile data bundles and plans.",
      complianceStatus: "AVAILABLE",
      displayOrder: 2,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Electricity,
      group: "CORE_VTU_BILL_PAYMENT",
      name: "Electricity",
      description: "Prepaid and postpaid electricity tokens.",
      complianceStatus: "AVAILABLE",
      displayOrder: 3,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Cable,
      group: "CORE_VTU_BILL_PAYMENT",
      name: "Cable / Pay TV",
      description: "Cable and satellite TV subscriptions.",
      complianceStatus: "AVAILABLE",
      displayOrder: 4,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Internet,
      group: "CORE_VTU_BILL_PAYMENT",
      name: "Internet",
      description: "Home and fixed-wireless internet plans.",
      complianceStatus: "AVAILABLE",
      displayOrder: 5,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Education,
      group: "CORE_VTU_BILL_PAYMENT",
      name: "Education",
      description: "Exam, tuition, and application payments.",
      complianceStatus: "AVAILABLE",
      displayOrder: 6,
      simulated: true,
    },
    {
      id: CatalogCategoryId.GiftCards,
      group: "DIGITAL_GOODS",
      name: "Gift Cards",
      description: "Digital gift cards and vouchers.",
      complianceStatus: "AVAILABLE",
      displayOrder: 7,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Cinema,
      group: "TICKETING",
      name: "Cinema",
      description: "Cinema tickets and screenings.",
      complianceStatus: "AVAILABLE",
      displayOrder: 8,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Events,
      group: "TICKETING",
      name: "Events",
      description: "Live events and shows.",
      complianceStatus: "AVAILABLE",
      displayOrder: 9,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Bus,
      group: "TICKETING",
      name: "Bus",
      description: "Intercity bus tickets.",
      complianceStatus: "AVAILABLE",
      displayOrder: 10,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Airline,
      group: "TICKETING",
      name: "Airline",
      description: "Airline tickets and fares.",
      complianceStatus: "AVAILABLE",
      displayOrder: 11,
      simulated: true,
    },
    {
      id: CatalogCategoryId.Betting,
      group: "FUTURE_COMPLIANCE_GATED",
      name: "Betting/Gaming",
      description: "Compliance-gated placeholder; no functionality.",
      complianceStatus: "COMPLIANCE_GATED",
      displayOrder: 12,
      simulated: true,
    },
  ];
}

function buildServices(): readonly MarketplaceService[] {
  const defs: readonly ServiceDefinition[] = [
    {
      id: "svc_airtime_mtn",
      categoryId: CatalogCategoryId.Airtime,
      kind: "AIRTIME",
      name: "MTN Airtime",
      description: "MTN airtime top-up.",
      currency: "NGN",
      baseAmountMinor: 1000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_AIRTIME,
    },
    {
      id: "svc_airtime_airtel",
      categoryId: CatalogCategoryId.Airtime,
      kind: "AIRTIME",
      name: "Airtel Airtime",
      description: "Airtel airtime top-up.",
      currency: "NGN",
      baseAmountMinor: 1000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_AIRTIME,
    },
    {
      id: "svc_data_mtn",
      categoryId: CatalogCategoryId.Data,
      kind: "DATA",
      name: "MTN Data",
      description: "MTN data bundles.",
      currency: "NGN",
      baseAmountMinor: 5000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_DATA,
    },
    {
      id: "svc_data_airtel",
      categoryId: CatalogCategoryId.Data,
      kind: "DATA",
      name: "Airtel Data",
      description: "Airtel data bundles.",
      currency: "NGN",
      baseAmountMinor: 4500,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_DATA,
    },
    {
      id: "svc_electricity_aedc",
      categoryId: CatalogCategoryId.Electricity,
      kind: "ELECTRICITY",
      name: "AEDC Prepaid",
      description: "Abuja Electricity prepaid token.",
      currency: "NGN",
      baseAmountMinor: 10000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_ELECTRICITY,
    },
    {
      id: "svc_electricity_ikedc",
      categoryId: CatalogCategoryId.Electricity,
      kind: "ELECTRICITY",
      name: "IKEDC Prepaid",
      description: "Ikeja Electricity prepaid token.",
      currency: "NGN",
      baseAmountMinor: 10000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_ELECTRICITY,
    },
    {
      id: "svc_cable_dstv",
      categoryId: CatalogCategoryId.Cable,
      kind: "CABLE_TV",
      name: "DStv",
      description: "DStv packages.",
      currency: "NGN",
      baseAmountMinor: 8000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_CABLE,
    },
    {
      id: "svc_cable_gotv",
      categoryId: CatalogCategoryId.Cable,
      kind: "CABLE_TV",
      name: "GOtv",
      description: "GOtv packages.",
      currency: "NGN",
      baseAmountMinor: 3500,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_CABLE,
    },
    {
      id: "svc_internet_spectranet",
      categoryId: CatalogCategoryId.Internet,
      kind: "INTERNET",
      name: "Spectranet",
      description: "Spectranet home internet.",
      currency: "NGN",
      baseAmountMinor: 20000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_INTERNET,
    },
    {
      id: "svc_internet_ipnx",
      categoryId: CatalogCategoryId.Internet,
      kind: "INTERNET",
      name: "ipNX",
      description: "ipNX home internet.",
      currency: "NGN",
      baseAmountMinor: 25000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_INTERNET,
    },
    {
      id: "svc_education_jamb",
      categoryId: CatalogCategoryId.Education,
      kind: "EDUCATION",
      name: "JAMB Registration",
      description: "JAMB exam registration fee.",
      currency: "NGN",
      baseAmountMinor: 4700,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_EDUCATION,
    },
    {
      id: "svc_education_waec",
      categoryId: CatalogCategoryId.Education,
      kind: "EDUCATION",
      name: "WAEC Payment",
      description: "WAEC exam payment.",
      currency: "NGN",
      baseAmountMinor: 18000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_EDUCATION,
    },
    {
      id: "svc_giftcard_amazon",
      categoryId: CatalogCategoryId.GiftCards,
      kind: "GIFT_CARD",
      name: "Amazon Gift Card",
      description: "Amazon e-gift cards (USD).",
      currency: "USD",
      baseAmountMinor: 1000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_GIFT_CARD,
    },
    {
      id: "svc_giftcard_steam",
      categoryId: CatalogCategoryId.GiftCards,
      kind: "GIFT_CARD",
      name: "Steam Wallet",
      description: "Steam wallet codes (USD).",
      currency: "USD",
      baseAmountMinor: 500,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_GIFT_CARD,
    },
    {
      id: "svc_voucher_digital",
      categoryId: CatalogCategoryId.GiftCards,
      kind: "DIGITAL_VOUCHER",
      name: "Digital Voucher",
      description: "Generic digital voucher (USD).",
      currency: "USD",
      baseAmountMinor: 2000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_GIFT_CARD,
    },
    {
      id: "svc_cinema_filmhouse",
      categoryId: CatalogCategoryId.Cinema,
      kind: "CINEMA_TICKET",
      name: "Filmhouse IMAX",
      description: "Filmhouse cinema tickets.",
      currency: "NGN",
      baseAmountMinor: 7500,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_CINEMA,
    },
    {
      id: "svc_cinema_silverbird",
      categoryId: CatalogCategoryId.Cinema,
      kind: "CINEMA_TICKET",
      name: "Silverbird",
      description: "Silverbird cinema tickets.",
      currency: "NGN",
      baseAmountMinor: 6500,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_CINEMA,
    },
    {
      id: "svc_event_lagos tech fest",
      categoryId: CatalogCategoryId.Events,
      kind: "EVENT_TICKET",
      name: "Lagos Tech Fest",
      description: "Lagos Tech Fest tickets.",
      currency: "NGN",
      baseAmountMinor: 15000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_EVENT,
    },
    {
      id: "svc_event_afrobeats",
      categoryId: CatalogCategoryId.Events,
      kind: "EVENT_TICKET",
      name: "Afrobeats Live",
      description: "Afrobeats Live concert tickets.",
      currency: "NGN",
      baseAmountMinor: 20000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_EVENT,
    },
    {
      id: "svc_bus_lagos_abuja",
      categoryId: CatalogCategoryId.Bus,
      kind: "BUS_TICKET",
      name: "Lagos → Abuja",
      description: "Intercity bus Lagos to Abuja.",
      currency: "NGN",
      baseAmountMinor: 28000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_BUS,
    },
    {
      id: "svc_bus_lagos_ibadan",
      categoryId: CatalogCategoryId.Bus,
      kind: "BUS_TICKET",
      name: "Lagos → Ibadan",
      description: "Intercity bus Lagos to Ibadan.",
      currency: "NGN",
      baseAmountMinor: 12000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_BUS,
    },
    {
      id: "svc_airline_los_abv",
      categoryId: CatalogCategoryId.Airline,
      kind: "AIRLINE_TICKET",
      name: "LOS → ABV",
      description: "Airline ticket Lagos to Abuja.",
      currency: "NGN",
      baseAmountMinor: 180000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_AIRLINE,
    },
    {
      id: "svc_airline_los_lon",
      categoryId: CatalogCategoryId.Airline,
      kind: "AIRLINE_TICKET",
      name: "LOS → LON",
      description: "Airline ticket Lagos to London (GBP).",
      currency: "GBP",
      baseAmountMinor: 45000,
      complianceStatus: "AVAILABLE",
      availability: "AVAILABLE",
      inputSchema: SCHEMA_AIRLINE,
    },
    {
      id: "svc_betting_examplebet",
      categoryId: CatalogCategoryId.Betting,
      kind: "BETTING",
      name: "ExampleBet",
      description: "Compliance-gated placeholder; checkout blocked.",
      currency: "NGN",
      baseAmountMinor: 0,
      complianceStatus: "COMPLIANCE_GATED",
      availability: "COMPLIANCE_GATED",
      inputSchema: SCHEMA_BETTING,
    },
  ];
  return defs.map(defineService);
}

function buildProducts(): readonly CatalogProduct[] {
  const services = buildServices();
  const defs: readonly ProductDefinition[] = [
    // Data: offering tiers under the Data service (service vs product distinction).
    {
      id: "prod_data_mtn_1gb",
      serviceId: "svc_data_mtn",
      name: "MTN 1GB",
      description: "1GB data bundle.",
      pricing: { catalogPriceMinor: 500, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { plan: "1GB", network: "MTN" },
    },
    {
      id: "prod_data_mtn_5gb",
      serviceId: "svc_data_mtn",
      name: "MTN 5GB",
      description: "5GB data bundle.",
      pricing: { catalogPriceMinor: 2500, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { plan: "5GB", network: "MTN" },
    },
    {
      id: "prod_data_mtn_10gb",
      serviceId: "svc_data_mtn",
      name: "MTN 10GB",
      description: "10GB data bundle.",
      pricing: { catalogPriceMinor: 5000, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { plan: "10GB", network: "MTN" },
    },
    // Airtime product tiers.
    {
      id: "prod_airtime_mtn_100",
      serviceId: "svc_airtime_mtn",
      name: "MTN ₦1,000",
      description: "₦1,000 MTN airtime.",
      pricing: { catalogPriceMinor: 1000, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { network: "MTN", amount: "1000" },
    },
    {
      id: "prod_airtime_mtn_5000",
      serviceId: "svc_airtime_mtn",
      name: "MTN ₦5,000",
      description: "₦5,000 MTN airtime.",
      pricing: { catalogPriceMinor: 5000, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { network: "MTN", amount: "5000" },
    },
    // Gift card denomination tiers.
    {
      id: "prod_gift_amazon_us_25",
      serviceId: "svc_giftcard_amazon",
      name: "Amazon $25 (US)",
      description: "Amazon $25 US gift card.",
      pricing: { catalogPriceMinor: 2500, currency: "USD" },
      availability: "AVAILABLE",
      attributes: { brand: "Amazon", region: "US", denomination: "$25" },
    },
    {
      id: "prod_gift_amazon_us_50",
      serviceId: "svc_giftcard_amazon",
      name: "Amazon $50 (US)",
      description: "Amazon $50 US gift card.",
      pricing: { catalogPriceMinor: 5000, currency: "USD" },
      availability: "AVAILABLE",
      attributes: { brand: "Amazon", region: "US", denomination: "$50" },
    },
    // Cinema screening-level availability (ticketing capacity).
    {
      id: "prod_cinema_filmhouse_oppenheimer",
      serviceId: "svc_cinema_filmhouse",
      name: "Oppenheimer — 7pm",
      description: "Oppenheimer screening, filmhouse.",
      pricing: { catalogPriceMinor: 7500, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: {
        movie: "Oppenheimer",
        screening: "2026-02-01T19:00:00.000Z",
        venue: "Filmhouse IMAX",
      },
    },
    {
      id: "prod_cinema_filmhouse_avatar",
      serviceId: "svc_cinema_filmhouse",
      name: "Avatar 3 — 9pm",
      description: "Avatar 3 screening, filmhouse.",
      pricing: { catalogPriceMinor: 8500, currency: "NGN" },
      availability: "SOLD_OUT",
      attributes: {
        movie: "Avatar 3",
        screening: "2026-02-01T21:00:00.000Z",
        venue: "Filmhouse IMAX",
      },
    },
    // Bus route product.
    {
      id: "prod_bus_lagos_abuja_standard",
      serviceId: "svc_bus_lagos_abuja",
      name: "Standard seat",
      description: "Standard bus seat Lagos→Abuja.",
      pricing: { catalogPriceMinor: 28000, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { origin: "Lagos", destination: "Abuja", class: "standard" },
    },
    // Airline fare product.
    {
      id: "prod_airline_los_abv_economy",
      serviceId: "svc_airline_los_abv",
      name: "Economy fare",
      description: "Economy LOS→ABV.",
      pricing: { catalogPriceMinor: 180000, currency: "NGN" },
      availability: "AVAILABLE",
      attributes: { origin: "LOS", destination: "ABV", fareClass: "economy" },
    },
  ];
  return defs.map((def) => defineProduct(def, services));
}

export function buildDemoCatalog(): MarketplaceCatalog {
  return {
    id: "catalog_demo",
    version: CATALOG_VERSION,
    name: "ReconcileKit Marketplace Demo",
    categories: buildCategories(),
    services: buildServices(),
    products: buildProducts(),
    simulated: true,
    createdAt: CATALOG_CREATED_AT,
  };
}

export function findServiceByKind(
  catalog: MarketplaceCatalog,
  kind: MarketplaceServiceKind,
): MarketplaceService | undefined {
  return catalog.services.find((service) => service.kind === kind);
}

export function findServiceById(
  catalog: MarketplaceCatalog,
  serviceId: string,
): MarketplaceService | undefined {
  return catalog.services.find((service) => service.id === serviceId);
}

export function findCategoryById(
  catalog: MarketplaceCatalog,
  categoryId: string,
): MarketplaceCategory | undefined {
  return catalog.categories.find((category) => category.id === categoryId);
}

export function findProductById(
  catalog: MarketplaceCatalog,
  productId: string,
): CatalogProduct | undefined {
  return catalog.products.find((product) => product.id === productId);
}

export function servicesInCategory(
  catalog: MarketplaceCatalog,
  categoryId: string,
): readonly MarketplaceService[] {
  return catalog.services.filter(
    (service) => service.categoryId === categoryId,
  );
}

export function productsInService(
  catalog: MarketplaceCatalog,
  serviceId: string,
): readonly CatalogProduct[] {
  return catalog.products.filter((product) => product.serviceId === serviceId);
}

export function categoriesByGroup(
  catalog: MarketplaceCatalog,
  group: CatalogGroup,
): readonly MarketplaceCategory[] {
  return catalog.categories
    .filter((category) => category.group === group)
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function complianceGatedCategories(
  catalog: MarketplaceCatalog,
): readonly MarketplaceCategory[] {
  return catalog.categories.filter(
    (category) => category.complianceStatus === "COMPLIANCE_GATED",
  );
}

/**
 * Catalog-side availability lookup. For simple services this maps the service's
 * availability status directly; for ticketing/product tiers it considers product
 * availability (e.g. SOLD_OUT) and reports capacity when known.
 */
export function serviceAvailability(
  catalog: MarketplaceCatalog,
  serviceId: string,
): MarketAvailabilityResult {
  const service = findServiceById(catalog, serviceId);
  if (!service) {
    return {
      productId: "",
      serviceId,
      available: false,
      displayAvailable: false,
      capacityRemaining: null,
      priceMinor: null,
      message: "service_not_found",
      simulated: true,
    };
  }
  const serviceAvailable = service.availability === "AVAILABLE";
  const inventory = productsInService(catalog, serviceId);
  const soldOutCount = inventory.filter(
    (product) => product.availability === "SOLD_OUT",
  ).length;
  const available = serviceAvailable && soldOutCount < inventory.length;
  return {
    productId: inventory[0]?.id ?? "",
    serviceId,
    available,
    displayAvailable: serviceAvailable,
    capacityRemaining: service.availability === "AVAILABLE" ? null : 0,
    priceMinor: service.baseAmountMinor,
    message: available ? "available" : "unavailable",
    simulated: true,
  };
}

/** Resolves the provider object backing a service, via the registry. */
export function providerForService(
  registry: MarketplaceProviderRegistry,
  service: MarketplaceService,
): MarketplaceProvider | null {
  try {
    const adapter = registry.providerForServiceKind(service.kind);
    return {
      id: adapter.providerId,
      name: adapter.providerName,
      serviceKinds: adapter.serviceKinds,
      simulated: true,
      createdAt: CATALOG_CREATED_AT,
    };
  } catch {
    return null;
  }
}

/**
 * Checkout gating: a service is only checkout-eligible if it is not
 * compliance-gated. Kept here (not in transactions.ts) so Phase 2E reuses it.
 */
export function assertCheckoutEligible(service: MarketplaceService): void {
  if (service.complianceStatus === "COMPLIANCE_GATED") {
    throw new Error(
      `service ${service.id} is compliance-gated and cannot be checked out`,
    );
  }
}

/** Pricing ladder snapshot used when quoting at checkout (catalog → quote). */
export function quoteForProduct(product: CatalogProduct): {
  readonly catalogPriceMinor: number;
  readonly currency: string;
  readonly expectedCheckoutMinor: number;
} {
  return {
    catalogPriceMinor: product.pricing.catalogPriceMinor,
    currency: product.pricing.currency,
    expectedCheckoutMinor: product.pricing.catalogPriceMinor,
  };
}

/**
 * Persist the seeded catalog into the JSONL store using the dedicated catalog
 * store kinds. Preserves the existing append/latest-wins semantics (each entity
 * is id-keyed, so re-seeding is idempotent on read).
 */
export async function seedCatalogToStore(store: {
  insert<T extends { readonly id: string }>(
    kind: "catalog_categories" | "catalog_services" | "catalog_products",
    record: T,
  ): Promise<T>;
}): Promise<void> {
  const catalog = buildDemoCatalog();
  for (const category of catalog.categories) {
    await store.insert("catalog_categories", category);
  }
  for (const service of catalog.services) {
    await store.insert("catalog_services", service);
  }
  for (const product of catalog.products) {
    await store.insert("catalog_products", product);
  }
}

/**
 * Reassemble a catalog view from persisted store records. Any entity missing
 * from the store is omitted; the assembled catalog remains internally
 * consistent because products resolve their category/provider from the service.
 */
export async function loadCatalogFromStore(store: {
  readAll<T>(
    kind: "catalog_categories" | "catalog_services" | "catalog_products",
  ): Promise<readonly T[]>;
}): Promise<MarketplaceCatalog> {
  const categories =
    await store.readAll<MarketplaceCategory>("catalog_categories");
  const services = await store.readAll<MarketplaceService>("catalog_services");
  const products = await store.readAll<CatalogProduct>("catalog_products");
  return {
    id: "catalog_demo",
    version: CATALOG_VERSION,
    name: "ReconcileKit Marketplace Demo",
    categories,
    services,
    products,
    simulated: true,
    createdAt: CATALOG_CREATED_AT,
  };
}
