import type { Repositories } from "../../src/db/repositories/index.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import type { MarketplaceTransactionDeps } from "../../src/marketplace/transactions.ts";

export function demoDeps(repos: Repositories): MarketplaceTransactionDeps {
  return {
    repos,
    registry: createMockProviderRegistry(),
    catalog: buildDemoCatalog(),
  };
}
