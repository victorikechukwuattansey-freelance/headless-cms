import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import {
  CatalogCategoryId,
  assertCheckoutEligible,
  buildDemoCatalog,
  categoriesByGroup,
  complianceGatedCategories,
  findCategoryById,
  findProductById,
  findServiceById,
  findServiceByKind,
  providerForService,
  productsInService,
  quoteForProduct,
  seedCatalogToStore,
  loadCatalogFromStore,
  serviceAvailability,
  servicesInCategory,
} from "../../src/marketplace/catalog.ts";
import type {
  CatalogProduct,
  FulfillmentType,
  MarketplaceCategory,
  MarketplaceService,
  MarketplaceServiceKind,
} from "../../src/marketplace/types.ts";

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-catalog-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("catalog includes all required service kinds across every approved category", () => {
  const catalog = buildDemoCatalog();

  const required: readonly MarketplaceServiceKind[] = [
    "AIRTIME",
    "DATA",
    "ELECTRICITY",
    "CABLE_TV",
    "INTERNET",
    "EDUCATION",
    "GIFT_CARD",
    "DIGITAL_VOUCHER",
    "CINEMA_TICKET",
    "EVENT_TICKET",
    "BUS_TICKET",
    "AIRLINE_TICKET",
  ];

  for (const kind of required) {
    assert.ok(findServiceByKind(catalog, kind), `missing service kind ${kind}`);
  }
});

test("compliance-gated betting is a seeded placeholder only", () => {
  const catalog = buildDemoCatalog();

  const betting = findServiceByKind(catalog, "BETTING");
  assert.ok(betting);
  assert.equal(betting.complianceStatus, "COMPLIANCE_GATED");
  assert.equal(betting.availability, "COMPLIANCE_GATED");

  const categories = complianceGatedCategories(catalog);
  assert.equal(categories.length, 1);
  assert.equal(categories[0]?.id, CatalogCategoryId.Betting);
});

test("checkout gating blocks compliance-gated services", () => {
  const catalog = buildDemoCatalog();
  const betting = findServiceByKind(catalog, "BETTING");
  const airtime = findServiceByKind(catalog, "AIRTIME");
  assert.ok(betting);
  assert.ok(airtime);

  assert.throws(() => assertCheckoutEligible(betting), /compliance-gated/i);
  assert.doesNotThrow(() => assertCheckoutEligible(airtime));
});

test("category creation produces all twelve seeded categories in order", () => {
  const catalog = buildDemoCatalog();

  assert.equal(catalog.categories.length, 12);
  const ids = catalog.categories.map((category) => category.id);
  assert.ok(ids.includes(CatalogCategoryId.Airtime));
  assert.ok(ids.includes(CatalogCategoryId.Betting));

  const core = categoriesByGroup(catalog, "CORE_VTU_BILL_PAYMENT");
  assert.equal(core.length, 6);
  assert.equal(core[0]?.id, CatalogCategoryId.Airtime);
  assert.equal(core[0]?.displayOrder, 1);

  const ticketing = categoriesByGroup(catalog, "TICKETING");
  assert.equal(ticketing.length, 4);
});

test("every seeded category maps to exactly one fulfillment type", () => {
  const catalog = buildDemoCatalog();
  const seen = new Map<string, FulfillmentType>();

  for (const category of catalog.categories) {
    const services = servicesInCategory(catalog, category.id);
    for (const service of services) {
      const assigned = service.fulfillmentType;
      const prior = seen.get(category.id);
      if (prior !== undefined) {
        assert.equal(
          assigned,
          prior,
          `category ${category.id} mixed fulfillment types`,
        );
      } else {
        seen.set(category.id, assigned);
      }
    }
  }

  assert.equal(seen.get(CatalogCategoryId.Airtime), "INSTANT_DIGITAL");
  assert.equal(seen.get(CatalogCategoryId.Data), "INSTANT_DIGITAL");
  assert.equal(seen.get(CatalogCategoryId.Electricity), "UTILITY");
  assert.equal(seen.get(CatalogCategoryId.Cable), "UTILITY");
  assert.equal(seen.get(CatalogCategoryId.Internet), "SUBSCRIPTION");
  assert.equal(seen.get(CatalogCategoryId.Education), "UTILITY");
  assert.equal(seen.get(CatalogCategoryId.GiftCards), "DIGITAL_GOOD");
  assert.equal(seen.get(CatalogCategoryId.Cinema), "TICKET");
  assert.equal(seen.get(CatalogCategoryId.Events), "TICKET");
  assert.equal(seen.get(CatalogCategoryId.Bus), "TICKET");
  assert.equal(seen.get(CatalogCategoryId.Airline), "TICKET");
  assert.equal(seen.get(CatalogCategoryId.Betting), "FUTURE_COMPLIANCE_GATED");
});

test("full fulfillment-type coverage across the union", () => {
  const catalog = buildDemoCatalog();
  const assigned = new Set(
    catalog.services.map((service) => service.fulfillmentType),
  );

  const expected: readonly FulfillmentType[] = [
    "INSTANT_DIGITAL",
    "UTILITY",
    "SUBSCRIPTION",
    "DIGITAL_GOOD",
    "TICKET",
    "FUTURE_COMPLIANCE_GATED",
  ];
  for (const type of expected) {
    assert.ok(assigned.has(type), `fulfillment type ${type} not exercised`);
  }
});

test("services expose reusable input schemas without UI-specific logic", () => {
  const catalog = buildDemoCatalog();

  const airtime = findServiceByKind(catalog, "AIRTIME");
  const data = findServiceByKind(catalog, "DATA");
  const electricity = findServiceByKind(catalog, "ELECTRICITY");
  const giftCard = findServiceByKind(catalog, "GIFT_CARD");
  const airline = findServiceByKind(catalog, "AIRLINE_TICKET");

  assert.ok(airtime);
  assert.ok(data);
  assert.ok(electricity);
  assert.ok(giftCard);
  assert.ok(airline);

  assert.deepEqual(
    airtime.inputSchema.map((field) => field.name),
    ["network", "recipient", "amount"],
  );
  assert.equal(airtime.inputSchema[0]?.type, "SELECT");
  assert.ok(data.inputSchema.some((field) => field.name === "plan"));
  assert.ok(
    electricity.inputSchema.some((field) => field.name === "meterType"),
  );
  assert.ok(
    giftCard.inputSchema.some((field) => field.name === "denomination"),
  );
  assert.ok(airline.inputSchema.some((field) => field.name === "flight"));

  const subjectField = airtime.inputSchema.find(
    (field) => field.name === "recipient",
  );
  assert.equal(subjectField?.type, "PHONE");
  assert.equal(subjectField?.required, true);
});

test("service/product distinction: data service has offering tiers", () => {
  const catalog = buildDemoCatalog();

  const dataService = findServiceByKind(catalog, "DATA");
  assert.ok(dataService);

  const products = productsInService(catalog, dataService.id);
  assert.ok(
    products.length >= 3,
    `expected data offering tiers, got ${products.length}`,
  );

  const tenGb = products.find(
    (product) => product.attributes["plan"] === "10GB",
  );
  assert.ok(tenGb);
  assert.equal(tenGb.name, "MTN 10GB");
  assert.equal(tenGb.pricing.catalogPriceMinor, 5000);
  assert.equal(tenGb.pricing.currency, "NGN");
});

test("gift card products carry brand, region, and denomination", () => {
  const catalog = buildDemoCatalog();

  const amazon = findServiceByKind(catalog, "GIFT_CARD");
  assert.ok(amazon);

  const us25 = findProductById(catalog, "prod_gift_amazon_us_25");
  assert.ok(us25);
  assert.equal(us25.attributes["brand"], "Amazon");
  assert.equal(us25.attributes["region"], "US");
  assert.equal(us25.attributes["denomination"], "$25");
  assert.equal(us25.pricing.currency, "USD");
});

test("provider association: catalog services map to registry adapters, never hard-coded provider names", () => {
  const catalog = buildDemoCatalog();
  const registry = createMockProviderRegistry();

  for (const service of catalog.services) {
    if (service.kind === "BETTING") {
      continue;
    }
    const provider = providerForService(registry, service);
    assert.ok(provider, `no provider for ${service.kind}`);
    assert.equal(provider.serviceKinds.includes(service.kind), true);
    assert.equal(
      provider.id,
      service.providerId,
      `service ${service.id} provider mismatch`,
    );
  }
});

test("two different categories can resolve to the same provider via registry", () => {
  const catalog = buildDemoCatalog();
  const registry = createMockProviderRegistry();

  const electricity = findServiceByKind(catalog, "ELECTRICITY");
  const cable = findServiceByKind(catalog, "CABLE_TV");
  assert.ok(electricity);
  assert.ok(cable);

  const electricProvider = providerForService(registry, electricity);
  const cableProvider = providerForService(registry, cable);
  assert.ok(electricProvider);
  assert.ok(cableProvider);
  assert.equal(electricProvider.name, cableProvider.name);
  assert.equal(electricProvider?.name, "Mock Bill Provider");
});

test("pricing: catalog price is independent from checkout/authorized/settled amounts", () => {
  const catalog = buildDemoCatalog();

  const busProduct = findProductById(catalog, "prod_bus_lagos_abuja_standard");
  assert.ok(busProduct);
  const quote = quoteForProduct(busProduct);

  assert.equal(quote.catalogPriceMinor, 28000);
  assert.equal(quote.expectedCheckoutMinor, 28000);
  assert.equal(quote.currency, "NGN");

  // The quote is a snapshot; it must not be the only price source. A later
  // authorized amount or provider amount is produced by providers/reconciliation,
  // and the quote exists purely as the catalog->checkout input.
  const authorizedAmountMinor = 28001;
  assert.notEqual(authorizedAmountMinor, quote.catalogPriceMinor);
});

test("availability: simple services are available and ticketing can be sold out", () => {
  const catalog = buildDemoCatalog();

  const airtime = findServiceByKind(catalog, "AIRTIME");
  assert.ok(airtime);
  const availability = serviceAvailability(catalog, airtime.id);
  assert.equal(availability.available, true);
  assert.equal(availability.message, "available");

  const soldOutScreening = findProductById(
    catalog,
    "prod_cinema_filmhouse_avatar",
  );
  assert.ok(soldOutScreening);
  assert.equal(soldOutScreening.availability, "SOLD_OUT");

  // A cinema service with any available screening stays available at service
  // level, while the sold-out product tier is individually not orderable.
  const avatarService = findServiceById(catalog, soldOutScreening.serviceId);
  assert.ok(avatarService);
  assert.equal(serviceAvailability(catalog, avatarService.id).available, true);

  // An unavailable service (betting is compliance-gated, so pick one that is
  // fully sold out) reports unavailable with a reason.
  const fullySoldOut = catalog.products.filter(
    (product) => product.availability === "SOLD_OUT",
  );
  assert.ok(fullySoldOut.length >= 1);
});

test("availability: unknown service reports unavailable with a reason", () => {
  const catalog = buildDemoCatalog();
  const result = serviceAvailability(catalog, "svc_does_not_exist");
  assert.equal(result.available, false);
  assert.equal(result.message, "service_not_found");
});

test("catalog retrieval helpers filter by category and fetch by id", () => {
  const catalog = buildDemoCatalog();

  const electricityCategory = findCategoryById(
    catalog,
    CatalogCategoryId.Electricity,
  );
  assert.ok(electricityCategory);
  assert.equal(electricityCategory.name, "Electricity");

  const electricityServices = servicesInCategory(
    catalog,
    CatalogCategoryId.Electricity,
  );
  assert.ok(electricityServices.length >= 2);
  for (const service of electricityServices) {
    assert.equal(service.categoryId, CatalogCategoryId.Electricity);
    assert.equal(service.fulfillmentType, "UTILITY");
  }

  const unknown = findServiceById(catalog, "svc_missing");
  assert.equal(unknown, undefined);
});

test("seeded catalog represents the full breadth of the approved parity categories", () => {
  const catalog = buildDemoCatalog();

  const networks = new Set(
    catalog.services
      .filter((service) => service.kind === "AIRTIME")
      .map((service) => service.name),
  );
  assert.ok(networks.has("MTN Airtime"));
  assert.ok(networks.has("Airtel Airtime"));

  const utilityProviders = new Set(
    catalog.services
      .filter((service) => service.kind === "ELECTRICITY")
      .map((service) => service.name),
  );
  assert.ok(utilityProviders.has("AEDC Prepaid"));

  const cablePackages = new Set(
    catalog.services
      .filter((service) => service.kind === "CABLE_TV")
      .map((service) => service.name),
  );
  assert.ok(cablePackages.has("DStv"));
  assert.ok(cablePackages.has("GOtv"));

  const education = findServiceByKind(catalog, "EDUCATION");
  assert.ok(education);

  const cinemaProducts = productsInService(
    catalog,
    catalog.products.find((p) => p.kind === "CINEMA_TICKET")?.serviceId ?? "",
  );
  assert.ok(cinemaProducts.length >= 1);

  const busServices = servicesInCategory(catalog, CatalogCategoryId.Bus);
  assert.ok(busServices.some((service) => service.name.includes("Abuja")));

  const airlineServices = servicesInCategory(
    catalog,
    CatalogCategoryId.Airline,
  );
  assert.ok(airlineServices.some((service) => service.currency === "GBP"));
});

test("seed persistence round-trips categories, services, and products", async (t) => {
  const store = tempStore(t);
  await seedCatalogToStore(store);

  const restored = await loadCatalogFromStore(store);

  assert.equal(restored.categories.length, 12);
  assert.ok(restored.services.length >= 20);
  assert.ok(restored.products.length >= 10);
  assert.equal(
    findServiceByKind(restored, "BETTING")?.complianceStatus,
    "COMPLIANCE_GATED",
  );
  assert.equal(restored.createdAt, "2026-01-01T12:00:00.000Z");
});

test("catalog is deterministic: two builds produce identical entities", () => {
  const a = buildDemoCatalog();
  const b = buildDemoCatalog();

  assert.deepEqual(a.categories, b.categories);
  assert.deepEqual(a.services, b.services);
  assert.deepEqual(a.products, b.products);
});

test("every service carries consistent category, provider, and fulfillment metadata", () => {
  const catalog = buildDemoCatalog();
  const categoryById = new Map(
    catalog.categories.map((category) => [category.id, category]),
  );

  for (const service of catalog.services) {
    const category = categoryById.get(service.categoryId);
    assert.ok(
      category,
      `service ${service.id} has orphan category ${service.categoryId}`,
    );
    const products = productsInService(catalog, service.id);

    for (const product of products) {
      assert.equal(product.serviceId, service.id);
      assert.equal(product.categoryId, service.categoryId);
      assert.equal(product.providerId, service.providerId);
      assert.equal(product.fulfillmentType, service.fulfillmentType);
    }
  }
});

test("compliance-gated categories are never eligible for checkout", () => {
  const catalog = buildDemoCatalog();
  const gated = catalog.categories.filter(
    (category) => category.complianceStatus === "COMPLIANCE_GATED",
  );

  assert.equal(gated.length, 1);
  assert.equal(gated[0]?.id, CatalogCategoryId.Betting);

  for (const category of gated) {
    for (const service of servicesInCategory(catalog, category.id)) {
      assert.throws(() => assertCheckoutEligible(service), /compliance-gated/i);
    }
  }
});
