import { loadConfig } from "./config.ts";
import type { StorefrontConfig } from "./config.ts";
import { disconnectPrisma, getPrismaClient } from "./db/client.ts";
import { buildRepositories } from "./db/repositories/index.ts";

import { createStorefrontServer } from "./server.ts";
import type { PaystackGateway } from "./paystack/gateway.ts";
import { initializeTransaction, verifyTransaction } from "./paystack/client.ts";
import type { MarketplaceTransactionDeps } from "./marketplace/transactions.ts";
import { createProviderRegistry } from "./marketplace/providers/registry.ts";
import { VtpassClient } from "./vtpass/client.ts";
import { buildDemoCatalog } from "./marketplace/catalog.ts";
import { seedDemoData } from "./marketplace/seed.ts";
import { seedDemoUser } from "./auth/identity.ts";

function buildPaystackGateway(config: StorefrontConfig): PaystackGateway {
  const withSecret =
    <A extends readonly unknown[], R>(
      fn: (
        options: { secretKey: string; baseUrl: string },
        ...args: A
      ) => Promise<R>,
    ) =>
    async (...args: A): Promise<R> => {
      const secretKey = config.paystackSecretKey;
      if (secretKey === null) {
        throw new Error(
          "STOREFRONT_PAYSTACK_SECRET_KEY is not set; cannot contact Paystack",
        );
      }
      return fn({ secretKey, baseUrl: config.paystackBaseUrl }, ...args);
    };
  return {
    initializeTransaction: withSecret(initializeTransaction),
    verifyTransaction: withSecret(verifyTransaction),
  };
}

const config = loadConfig();

const repos = buildRepositories(getPrismaClient());

const vtpassClient =
  config.vtpassApiKey !== null && config.vtpassSecretKey !== null
    ? new VtpassClient({
        apiKey: config.vtpassApiKey,
        secretKey: config.vtpassSecretKey,
        baseUrl: config.vtpassBaseUrl,
      })
    : undefined;

const marketplaceDeps: MarketplaceTransactionDeps = {
  repos,
  registry: createProviderRegistry(config.providerMode, vtpassClient),
  catalog: buildDemoCatalog(),
};

if (config.seedDemo) {
  await seedDemoData(repos);
}

const server = createStorefrontServer(config, {
  repos,
  paystack: buildPaystackGateway(config),
  marketplace: marketplaceDeps,
});

server.listen(config.port, () => {
  console.log(
    `reconcilekit-storefront listening on http://localhost:${config.port}`,
  );
  console.log(`data directory: ${config.dataDir}`);
  console.log(`callback base url: ${config.callbackBaseUrl}`);
  if (config.seedDemo) {
    console.log("demo data seeded: 16 canonical scenarios available");
  }
  if (config.paystackSecretKey === null) {
    console.log(
      "warning: STOREFRONT_PAYSTACK_SECRET_KEY is not set; Paystack calls will fail until it is configured",
    );
  }
});

const shutdown = async (): Promise<void> => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectPrisma();
  process.exit(0);
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
