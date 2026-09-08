import type { JsonlStore } from "../../src/store/jsonl-store.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import type { MarketplaceTransactionDeps } from "../../src/marketplace/transactions.ts";

export function demoDeps(store: JsonlStore): MarketplaceTransactionDeps {
  return {
    store,
    registry: createMockProviderRegistry(),
    catalog: buildDemoCatalog(),
  };
}
