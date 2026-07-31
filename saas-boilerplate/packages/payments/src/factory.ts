import { getEnv } from "@saas/config";
import type { BillingService } from "./service";
import { StripeBillingAdapter } from "./adapters/stripe";
import { LemonSqueezyAdapter } from "./adapters/lemon-squeezy";

let instance: BillingService | null = null;

export function createBillingService(): BillingService {
  if (instance) return instance;

  const env = getEnv();
  const provider = env.BILLING_PROVIDER ?? "stripe";

  switch (provider) {
    case "stripe":
      instance = new StripeBillingAdapter();
      break;
    case "lemon-squeezy":
      instance = new LemonSqueezyAdapter();
      break;
    default:
      instance = new StripeBillingAdapter();
  }

  return instance;
}

export function getBillingService(): BillingService {
  return createBillingService();
}
