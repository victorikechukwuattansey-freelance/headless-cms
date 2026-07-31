import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  generateSlug,
  generateToken,
  generateApiKey,
  truncate,
  maskEmail,
  sleep,
  tryCatch,
  tryCatchAsync,
  parseSearchParams,
  buildQueryString,
} from "./index";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    expect(cn("px-4", "px-2")).toBe("px-2");
  });
});

describe("formatCurrency", () => {
  it("formats USD amounts", () => {
    expect(formatCurrency(2999)).toBe("$29.99");
    expect(formatCurrency(10000)).toBe("$100");
    expect(formatCurrency(0)).toBe("$0");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2026-07-30");
    expect(result).toContain("July");
    expect(result).toContain("2026");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2026, 0, 1));
    expect(result).toContain("January");
    expect(result).toContain("2026");
  });

  it("accepts custom options", () => {
    const result = formatDate("2026-07-30", { month: "short" });
    expect(result).toContain("Jul");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent dates", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });
});

describe("generateSlug", () => {
  it("generates URL-friendly slugs", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
    expect(generateSlug("My SaaS Product!")).toBe("my-saas-product");
    expect(generateSlug("  spaces  ")).toBe("spaces");
    expect(generateSlug("ALLCAPS")).toBe("allcaps");
  });
});

describe("generateToken", () => {
  it("generates tokens of correct length", () => {
    expect(generateToken(32)).toHaveLength(32);
    expect(generateToken(48)).toHaveLength(48);
    expect(generateToken(64)).toHaveLength(64);
  });
});

describe("generateApiKey", () => {
  it("generates key with prefix", () => {
    const { key, keyPrefix } = generateApiKey("test");
    expect(key.startsWith("test_")).toBe(true);
    expect(keyPrefix.startsWith("test_")).toBe(true);
    expect(key.length).toBeGreaterThan(keyPrefix.length);
  });
});

describe("truncate", () => {
  it("returns string as-is when shorter than max length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and appends ellipsis", () => {
    expect(truncate("hello world this is long", 10)).toBe("hello worl...");
  });
});

describe("maskEmail", () => {
  it("masks email addresses", () => {
    expect(maskEmail("john@example.com")).toBe("j**n@example.com");
  });
});

describe("sleep", () => {
  it("resolves after given ms", async () => {
    const start = Date.now();
    await sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});

describe("tryCatch", () => {
  it("returns data on success", () => {
    const { data, error } = tryCatch(() => 42);
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("returns error on failure", () => {
    const { data, error } = tryCatch(() => {
      throw new Error("fail");
    });
    expect(data).toBeNull();
    expect(error?.message).toBe("fail");
  });
});

describe("tryCatchAsync", () => {
  it("returns data on success", async () => {
    const { data, error } = await tryCatchAsync(async () => 42);
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("returns error on failure", async () => {
    const { data, error } = await tryCatchAsync(async () => {
      throw new Error("fail");
    });
    expect(data).toBeNull();
    expect(error?.message).toBe("fail");
  });
});

describe("parseSearchParams", () => {
  it("returns defaults when params are missing", () => {
    const params = parseSearchParams(new URLSearchParams(""));
    expect(params.page).toBe(1);
    expect(params.perPage).toBe(20);
    expect(params.search).toBeUndefined();
  });

  it("parses provided params", () => {
    const params = parseSearchParams(
      new URLSearchParams("page=2&perPage=10&search=test&sort=name&order=desc"),
    );
    expect(params.page).toBe(2);
    expect(params.perPage).toBe(10);
    expect(params.search).toBe("test");
    expect(params.sort).toBe("name");
    expect(params.order).toBe("desc");
  });
});

describe("buildQueryString", () => {
  it("builds query string from params", () => {
    expect(buildQueryString({ page: 1, search: "test" })).toBe("?page=1&search=test");
  });

  it("excludes undefined and null values", () => {
    expect(buildQueryString({ page: 1, search: undefined, sort: null })).toBe("?page=1");
  });

  it("returns empty string for empty params", () => {
    expect(buildQueryString({})).toBe("");
  });
});
