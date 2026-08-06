import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("SaaS Boilerplate"),
  DATABASE_URL: z.string(),
  STORAGE_PROVIDER: z.enum(["s3", "uploadthing"]).default("s3"),
  ANALYTICS_PROVIDER: z.enum(["posthog", "plausible", "google-analytics"]).default("posthog"),
  BILLING_PROVIDER: z.enum(["stripe", "lemon-squeezy"]).default("stripe"),
  AUTH_PROVIDER: z.enum(["next-auth", "supabase"]).default("next-auth"),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_DISCORD_ID: z.string().optional(),
  AUTH_DISCORD_SECRET: z.string().optional(),
  AUTH_MICROSOFT_ID: z.string().optional(),
  AUTH_MICROSOFT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  LEMON_SQUEEZY_API_KEY: z.string().optional(),
  LEMON_SQUEEZY_STORE_ID: z.string().optional(),
  LEMON_SQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  UPLOADTHING_SECRET: z.string().optional(),
  UPLOADTHING_APP_ID: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.coerce.boolean().default(true),
  REDIS_URL: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_BUCKET_NAME: z.string().default("saas-uploads"),
});

const clientSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("SaaS Boilerplate"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let cachedEnv: Env | null = null;
let cachedClientEnv: ClientEnv | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  console.log("NODE_ENV =", process.env.NODE_ENV);
  console.log("DATABASE_URL exists =", !!process.env.DATABASE_URL);
  console.log("DATABASE_URL starts with =", process.env.DATABASE_URL?.substring(0, 15));

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.flatten().fieldErrors);
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment variables");
    }
    cachedEnv = result.data ?? ({} as Env);
    return cachedEnv;
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv;

  const result = clientSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid client environment variables:", result.error.flatten().fieldErrors);
    cachedClientEnv = result.data ?? ({} as ClientEnv);
    return cachedClientEnv;
  }

  cachedClientEnv = result.data;
  return cachedClientEnv;
}

export const plans = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with basic features",
    price: { monthly: 0, yearly: 0 },
    features: ["Up to 1 project", "Basic analytics", "Community support", "1 team member"],
    limits: {
      projects: 1,
      teamMembers: 1,
      storage: 100, // MB
      apiCalls: 1000, // per month
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Perfect for small projects",
    price: { monthly: 29, yearly: 290 },
    features: [
      "Up to 5 projects",
      "Advanced analytics",
      "Email support",
      "5 team members",
      "API access",
      "1GB storage",
    ],
    limits: {
      projects: 5,
      teamMembers: 5,
      storage: 1024,
      apiCalls: 10000,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For growing businesses",
    price: { monthly: 79, yearly: 790 },
    features: [
      "Unlimited projects",
      "Real-time analytics",
      "Priority support",
      "Unlimited team members",
      "API access",
      "10GB storage",
      "Custom domains",
      "Team collaboration",
    ],
    limits: {
      projects: -1,
      teamMembers: -1,
      storage: 10240,
      apiCalls: 100000,
    },
  },
  business: {
    id: "business",
    name: "Business",
    description: "For large teams and enterprises",
    price: { monthly: 199, yearly: 1990 },
    features: [
      "Everything in Pro",
      "100GB storage",
      "SSO/SAML",
      "Audit logs",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Advanced permissions",
      "White labeling",
    ],
    limits: {
      projects: -1,
      teamMembers: -1,
      storage: 102400,
      apiCalls: -1,
    },
  },
} as const;

export type PlanId = keyof typeof plans;

export function getPlanLimits(planTier: string) {
  const plan = plans[planTier as PlanId] ?? plans.free;
  return plan.limits;
}

export function getPlanById(id: string) {
  return plans[id as PlanId] ?? plans.free;
}

export const DEFAULT_PAGINATION = {
  page: 1,
  perPage: 20,
};

export const MAX_PER_PAGE = 100;
