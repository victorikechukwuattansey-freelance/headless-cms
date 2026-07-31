import { describe, it, expect } from "vitest";
import { AnalyticsError } from "./types";

describe("AnalyticsError", () => {
  it("creates error with code and message", () => {
    const error = new AnalyticsError("ANALYTICS_001", "analytics error");
    expect(error.code).toBe("ANALYTICS_001");
    expect(error.message).toBe("analytics error");
    expect(error.name).toBe("AnalyticsError");
  });
});
