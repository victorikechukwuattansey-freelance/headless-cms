import { describe, it, expect } from "vitest";
import { formatCurrency, generateSlug, generateToken, maskEmail } from "@saas/utils";

describe("formatCurrency", () => {
  it("formats USD amounts", () => {
    expect(formatCurrency(2999)).toBe("$29.99");
    expect(formatCurrency(10000)).toBe("$100.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("generateSlug", () => {
  it("generates URL-friendly slugs", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
    expect(generateSlug("My SaaS Product!")).toBe("my-saas-product");
    expect(generateSlug("  spaces  ")).toBe("spaces");
  });
});

describe("generateToken", () => {
  it("generates tokens of correct length", () => {
    expect(generateToken(32)).toHaveLength(32);
    expect(generateToken(48)).toHaveLength(48);
    expect(generateToken(64)).toHaveLength(64);
  });
});

describe("maskEmail", () => {
  it("masks email addresses", () => {
    expect(maskEmail("john@example.com")).toBe("j**n@example.com");
    expect(maskEmail("a@b.com")).toBe("a@b.com");
  });
});
