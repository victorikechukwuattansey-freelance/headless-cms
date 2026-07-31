import { describe, it, expect } from "vitest";

describe("FeatureFlags module exports", () => {
  it("exports expected functions", async () => {
    const mod = await import("./index");
    expect(typeof mod.isFeatureEnabled).toBe("function");
    expect(typeof mod.getEnabledFeatures).toBe("function");
    expect(typeof mod.hasReachedLimit).toBe("function");
    expect(typeof mod.getUsagePercent).toBe("function");
    expect(typeof mod.getAllFeatureFlags).toBe("function");
    expect(typeof mod.toggleFeatureFlag).toBe("function");
    expect(typeof mod.createFeatureFlag).toBe("function");
  });
});
