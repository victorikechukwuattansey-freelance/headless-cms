export {
  stripe,
  createStripeCheckout,
  handleStripeWebhook,
  createStripeCustomerPortal,
} from "./stripe";
export {
  lemonSqueezy,
  createLemonSqueezyCheckout,
  handleLemonSqueezyWebhook,
} from "./lemon-squeezy";

export { createBillingService, getBillingService } from "./factory";
export type { BillingService } from "./service";
export type {
  BillingProvider,
  CheckoutOptions,
  CheckoutResult,
  Customer,
  Invoice,
  PlanTier,
  Subscription,
  SubscriptionInterval,
  SubscriptionStatus,
} from "./types";
export {
  BillingError,
  PaymentFailedError,
  NoActiveSubscriptionError,
  CustomerNotFoundError,
} from "./types";

export function getSubscriptionLimits(planTier: string) {
  const { plans } = require("@saas/config");
  const plan = plans[planTier as keyof typeof plans] ?? plans.free;
  return plan.limits;
}
