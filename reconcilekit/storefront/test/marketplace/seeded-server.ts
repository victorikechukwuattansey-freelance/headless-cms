import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { createStorefrontServer } from "../../src/server.ts";
import { demoDeps } from "./demo-deps.ts";
import { executeMarketplaceTransaction } from "../../src/marketplace/transactions.ts";
import { reconcileMarketplaceTransaction } from "../../src/marketplace/reconcile.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import type { MarketplaceTransaction } from "../../src/marketplace/types.ts";
import { seedDemoTenancy } from "../../src/marketplace/seed.ts";
import { seedDemoUser } from "../../src/auth/identity.ts";
import { loginAndGetCookie } from "../auth/helpers.ts";

export interface SeededServerContext {
  readonly baseUrl: string;
  readonly cookie: string;
  readonly close: () => Promise<void>;
  readonly store: JsonlStore;
  readonly transaction: MarketplaceTransaction;
  readonly reference: string;
}

async function createSeededTransaction(
  store: JsonlStore,
): Promise<MarketplaceTransaction> {
  const deps = demoDeps(store);
  const NOW = WALLET_FIXED_TIMESTAMP;

  const result = await executeMarketplaceTransaction(deps, {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
  });

  await reconcileMarketplaceTransaction(deps, {
    transactionId: result.transaction.id,
    now: NOW,
  });

  return result.transaction;
}

export async function startSeededServer(): Promise<SeededServerContext> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-marketplace-"));
  const store = new JsonlStore(dataDir);

  // Phase 5A.3b — protected routes require a session. Seed the demo user and
  // tenancy so the shared login helper can authenticate against this server.
  await seedDemoUser(store);
  await seedDemoTenancy(store);

  const transaction = await createSeededTransaction(store);

  const server: Server = createStorefrontServer(
    loadConfig({ STOREFRONT_DATA_DIR: dataDir }),
    {
      store,
      paystack: {
        initializeTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
        verifyTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
      },
      marketplace: demoDeps(store),
    },
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await loginAndGetCookie(baseUrl);

  return {
    baseUrl,
    cookie,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    store,
    transaction,
    reference: transaction.reference,
  };
}
