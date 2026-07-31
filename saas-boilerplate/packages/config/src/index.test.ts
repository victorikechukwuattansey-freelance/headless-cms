import { describe, it, expect } from "vitest";
import {
  plans,
  getPlanLimits,
  getPlanById,
  DEFAULT_PAGINATION,
  MAX_PER_PAGE,
  getEnv,
} from "./index";

describe("plans", () => {
  it("has four plan tiers", () => {
    expect(Object.keys(plans)).toHaveLength(4);
  });

  it("free plan has zero price", () => {
    expect(plans.free.price.monthly).toBe(0);
    expect(plans.free.price.yearly).toBe(0);
  });

  it("pro plan price matches expected", () => {
    expect(plans.pro.price.monthly).toBe(79);
    expect(plans.pro.price.yearly).toBe(790);
  });

  it("business plan has unlimited apiCalls", () => {
    expect(plans.business.limits.apiCalls).toBe(-1);
  });

  it("starter plan has 5 team members limit", () => {
    expect(plans.starter.limits.teamMembers).toBe(5);
  });
});

describe("getPlanLimits", () => {
  it("returns free limits for unknown plan tier", () => {
    const limits = getPlanLimits("unknown");
    expect(limits.projects).toBe(1);
  });

  it("returns correct limits for pro plan", () => {
    const limits = getPlanLimits("pro");
    expect(limits.storage).toBe(10240);
    expect(limits.teamMembers).toBe(-1);
  });
});

describe("getPlanById", () => {
  it("returns the correct plan by id", () => {
    const plan = getPlanById("starter");
    expect(plan.name).toBe("Starter");
    expect(plan.price.monthly).toBe(29);
  });

  it("falls back to free for unknown id", () => {
    const plan = getPlanById("nonexistent");
    expect(plan.name).toBe("Free");
  });
});

describe("DEFAULT_PAGINATION", () => {
  it("has page 1 and perPage 20", () => {
    expect(DEFAULT_PAGINATION.page).toBe(1);
    expect(DEFAULT_PAGINATION.perPage).toBe(20);
  });
});

describe("MAX_PER_PAGE", () => {
  it("is 100", () => {
    expect(MAX_PER_PAGE).toBe(100);
  });
});

describe("getEnv", () => {
  it("returns defaults when env vars are not set", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    const env = getEnv();
    expect(env.NODE_ENV).toBeDefined();
    expect(env.AUTH_PROVIDER).toBeDefined();
    expect(env.STORAGE_PROVIDER).toBeDefined();
    expect(env.ANALYTICS_PROVIDER).toBeDefined();
    expect(env.BILLING_PROVIDER).toBeDefined();
  });
});
