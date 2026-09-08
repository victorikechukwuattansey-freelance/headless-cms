# Marketplace Catalog Architecture (Phase 2D)

The marketplace catalog foundation. A single, common catalog model that represents a
broad digital-services marketplace without a bespoke product system per service. It is
built on top of the Phase 2A marketplace types, the Phase 2B provider contracts/registry,
and the Phase 2C wallet/payment layer. **No real provider integrations.**

Scope: catalog **foundation only**. UI, checkout, transaction orchestration,
ReconcileKit integration, and admin tooling belong to later phases (2E+).

---

## 1. Model Overview

```
Catalog
  └─ Category            (CatalogCategory — groups services by product area)
      └─ Service/Product (MarketplaceService — sellable service definition)
          └─ Offering    (CatalogProduct — optional product/fare/denomination tier)
  └─ Provider association (via MarketplaceProviderRegistry from Phase 2B)
```

One catalog, many categories, one service per sellable definition, zero-or-many
products (offerings) per service. The service/product distinction is used only where it
adds value (bundles, denominations, fares, screenings), not forced onto airtime.

### 1.1 Category (the group-by domain)

`MarketplaceCategory` (Phase 2A) groups services. It carries a `CatalogGroup` and a
`ComplianceStatus`. The twelve seeded categories map 1:1 to the approved parity scope:

| Category       | Group                   | Fulfillment             | Id                |
| -------------- | ----------------------- | ----------------------- | ----------------- |
| Airtime        | CORE_VTU_BILL_PAYMENT   | INSTANT_DIGITAL         | `cat_airtime`     |
| Data           | CORE_VTU_BILL_PAYMENT   | INSTANT_DIGITAL         | `cat_data`        |
| Electricity    | CORE_VTU_BILL_PAYMENT   | UTILITY                 | `cat_electricity` |
| Cable / Pay TV | CORE_VTU_BILL_PAYMENT   | UTILITY                 | `cat_cable`       |
| Internet       | CORE_VTU_BILL_PAYMENT   | SUBSCRIPTION            | `cat_internet`    |
| Education      | CORE_VTU_BILL_PAYMENT   | UTILITY                 | `cat_education`   |
| Gift Cards     | DIGITAL_GOODS           | DIGITAL_GOOD            | `cat_gift_cards`  |
| Cinema         | TICKETING               | TICKET                  | `cat_cinema`      |
| Events         | TICKETING               | TICKET                  | `cat_events`      |
| Bus            | TICKETING               | TICKET                  | `cat_bus`         |
| Airline        | TICKETING               | TICKET                  | `cat_airline`     |
| Betting/Gaming | FUTURE_COMPLIANCE_GATED | FUTURE_COMPLIANCE_GATED | `cat_betting`     |

### 1.2 Service vs Product

- **`MarketplaceService`** — a sellable definition: `id`, `categoryId`, `kind`,
  `providerId`, `currency`, `baseAmountMinor`, `complianceStatus`, `fulfillmentType`,
  `availability`, `inputSchema`. A service selects a provider **by reference to the
  registry** (see §4), never a hard-coded adapter name embedded in UI/logic.
- **`CatalogProduct`** (new in 2D) — an optional offering tier under a service, used
  where the distinction is useful:
  - Data `→` MTN `→` 1GB / 5GB / 10GB (each an offering with its own price)
  - Electricity `→` AEDC `→` prepaid
  - Gift card `→` Amazon `→` US `→` $25 / $50
  - Cinema `→` Filmhouse `→` Oppenheimer 7pm / Avatar 3 9pm (screening-level availability)
  - Airline `→` LOS→ABV `→` economy fare

The catalog core does not need to change when a new tier is added — products are data.

### 1.3 Service-specific configuration

Each service carries an `inputSchema` — an ordered list of `ServiceInputDescriptor`s
(name, label, type, required, options). The schema is **data**, so generic UI/checkout
can render fields per service without service-specific UI components. Examples (all from
the seeded data):

- Airtime: `network`, `recipient`, `amount`
- Electricity: `provider`, `meterNumber`, `meterType`, `amount`
- Gift card: `brand`, `region`, `denomination`, `quantity`
- Airline: `origin`, `destination`, `date`, `passenger`, `flight`

## 2. Fulfillment Model

`FulfillmentType` (new) is an explicit classification of **how** a service is delivered.
It maps per category via `fulfillmentTypeForCategory` and is stored on each service and
product.

```
INSTANT_DIGITAL       airtime, data top-up
UTILITY               electricity, cable, education, (bill payments)
SUBSCRIPTION          internet
DIGITAL_GOOD          gift cards, vouchers
RESERVATION           (reserved for future reservation-style flows)
TICKET                cinema, events, bus, airline
FUTURE_COMPLIANCE_GATED  betting/gaming placeholder
```

`RESERVATION` is declared in the union but not assigned in the current seed, to keep the
set forward-compatible with future reserve-then-issue flows without forcing ticketing
into it.

## 3. Pricing Model

`ProductPricing` holds `catalogPriceMinor` + `currency` (plus optional preview and
availability-search minimums). `MarketplaceService` holds `baseAmountMinor`.

**Catalog price is explicitly NOT the reconciliation truth.** The system distinguishes
(and will compare at reconciliation):

```
catalog price → checkout quote → authorized amount → provider amount → settled amount
```

`quoteForProduct` produces the catalog→checkout snapshot. Later phases add checkout,
authorized, provider, and settled rungs from the wallet/provider layers. No complex
pricing engine; cross-currency examples (USD gift cards, GBP airline) carry their own
currency via `pricing.currency`, separate from preliminary FX handling.

## 4. Provider Association

The catalog does **not** hard-code "Electricity = provider X" in application logic.
Instead:

- `providerIdForServiceKind(kind)` resolves via `createMockProviderRegistry().providerForServiceKind`
  (Phase 2B), so a service's `providerId` matches the registered adapter's `providerId`.
- `providerForService(registry, service)` returns a `MarketplaceProvider` view of the
  backing adapter.
- Two different categories can map to the same provider (electricity + cable `→`
  "Mock Bill Provider"), proving the boundary is a registry concern, not a per-category
  hard-code. Replacing providers later means changing the registry, not the catalog.

## 5. Availability Model

`AvailabilityStatus` (new): `AVAILABLE`, `UNAVAILABLE`, `BUSY`, `SOLD_OUT`,
`COMPLIANCE_GATED`.

- Simple services: service-level `AVAILABLE` / `UNAVAILABLE`.
- Products/offerings: product-level `AVAILABLE` / `SOLD_OUT` (e.g. a screening that is
  sold out while another screening under the same service remains available).
- `serviceAvailability(catalog, serviceId)` returns a `MarketAvailabilityResult`
  (available, displayAvailable, capacityRemaining, price, message). A service with any
  orderable offering is available; a fully sold-out service is unavailable.

Mock data only. No external availability APIs.

## 6. Compliance Gating

Betting/gaming is seeded as a `COMPLIANCE_GATED` **placeholder only** — no betting
functionality. `assertCheckoutEligible(service)` throws for any `COMPLIANCE_GATED`
service; it lives in `catalog.ts` so Phase 2E (transaction orchestration) reuses it.
The registry also throws for `BETTING` provider lookup, so no provider is wired.

## 7. Persistence

Reuses the existing JSONL append/latest-wins architecture. Added three store kinds
(dedicated to catalog entities):

- `catalog_categories` → `catalog-categories.jsonl`
- `catalog_services` → `catalog-services.jsonl`
- `catalog_products` → `catalog-products.jsonl`

`seedCatalogToStore` seeds the demo catalog; `loadCatalogFromStore` reassembles a
`MarketplaceCatalog` view. Existing Paystack/pilot store kinds are unchanged.

## 8. Seed Data

`buildDemoCatalog()` deterministically seeds:

- **12 categories** across all 5 groups (incl. the gated betting placeholder).
- **24 services** covering every service kind + `DIGITAL_VOUCHER`, with multiple
  networks (MTN/Airtel), utility providers (AEDC/IKEDC), cable packages (DStv/GOtv),
  internet plans (Spectranet/ipNX), education products (JAMB/WAEC), gift card brands
  (Amazon/Steam), cinema venues & movies, events, bus routes, and airline routes
  (including a GBP fare for FX coverage).
- **11 products/offerings** demonstrating the service/product distinction and
  tier-level availability (e.g. a SOLD_OUT screening).

All data is explicit `simulated: true` mock data. No credentials, no real transactions.

## 9. Extension Path

- Add a category/service/product = add seeded definitions; the model and core helpers
  don't change.
- Add a provider = register a new adapter in the registry; catalog `providerId` resolves
  through it.
- New fulfillment semantics = extend the `FulfillmentType` union + per-category map.
- Checkout gating for compliance-gated categories is ready via `assertCheckoutEligible`.
- Phase 2E transaction orchestration will consume `servicesInCategory`, `findServiceById`,
  `quoteForProduct`, and `assertCheckoutEligible` directly.

## 10. Decisions vs the Phase 2 Plan

1. **Seed entity store kinds** — plan §E line 424 lists `catalog_categories` /
   `catalog_services` (done), but the plan also names a `wallet_ledger_entries` kind
   whereas the implemented store uses `wallet_ledger` (Phase 2C noted this). Phase 2D
   adds exactly the catalog kinds actually required and reuses the existing
   `marketplace_catalog` convention rather than adding redundant kinds.
2. **`DIGITAL_VOUCHER` seeded as a real service** — the plan lists it as a service kind;
   the seed now provides it under the Gift Cards category so `findServiceByKind`
   breadth tests pass for the full approved set.
3. **`providerForService` returns the registry `providerId`** (not the adapter `id`), so
   the returned `MarketplaceProvider.id` equals each service's `providerId`. This keeps
   the provider reference stable and consistent with contracts.
