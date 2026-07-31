import { describe, it, expect } from "vitest";
import {
  getPaginationParams,
  validateBody,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  rateLimitResponse,
} from "./index";
import { z } from "zod";

describe("getPaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const params = getPaginationParams(new URLSearchParams(""));
    expect(params.page).toBe(1);
    expect(params.perPage).toBe(20);
  });

  it("parses provided page and perPage", () => {
    const params = getPaginationParams(new URLSearchParams("page=3&perPage=15"));
    expect(params.page).toBe(3);
    expect(params.perPage).toBe(15);
  });

  it("clamps perPage to MAX_PER_PAGE", () => {
    const params = getPaginationParams(new URLSearchParams("perPage=999"));
    expect(params.perPage).toBe(100);
  });

  it("ensures minimum page is 1", () => {
    const params = getPaginationParams(new URLSearchParams("page=0"));
    expect(params.page).toBe(1);
  });

  it("ensures minimum perPage is 1", () => {
    const params = getPaginationParams(new URLSearchParams("perPage=0"));
    expect(params.perPage).toBe(1);
  });
});

describe("validateBody", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().min(0) });

  it("returns parsed data for valid input", () => {
    const result = validateBody(schema, { name: "John", age: 30 });
    expect(result.data).toEqual({ name: "John", age: 30 });
    expect(result.error).toBeUndefined();
  });

  it("returns validation error for invalid input", () => {
    const result = validateBody(schema, { name: "", age: -1 });
    expect(result.data).toBeUndefined();
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.details).toBeDefined();
  });
});

describe("errorResponse helper", () => {
  it("returns proper error structure", async () => {
    const res = errorResponse("TEST", "test message", 400);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("TEST");
  });
});

describe("notFoundResponse", () => {
  it("returns 404 with resource name", () => {
    const res = notFoundResponse("User");
    expect(res.status).toBe(404);
  });
});

describe("unauthorizedResponse", () => {
  it("returns 401 with default message", () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
  });
});

describe("rateLimitResponse", () => {
  it("returns 429", () => {
    const res = rateLimitResponse();
    expect(res.status).toBe(429);
  });
});
