import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, StorefrontConfigError } from "../src/config.ts";

test("loadConfig applies defaults when env is empty", () => {
  const config = loadConfig({});
  assert.equal(config.port, 8787);
  assert.equal(config.paystackSecretKey, null);
  assert.equal(config.paystackBaseUrl, "https://api.paystack.co");
  assert.equal(config.callbackBaseUrl, "http://localhost:8787");
  assert.ok(
    config.dataDir.endsWith("storefront\\data") ||
      config.dataDir.endsWith("storefront/data"),
  );
});

test("loadConfig defaults seedDemo to false", () => {
  const config = loadConfig({});
  assert.equal(config.seedDemo, false);
});

test("loadConfig enables seedDemo for truthy values", () => {
  for (const value of ["1", "true", "yes", "  True  "]) {
    const config = loadConfig({ STOREFRONT_SEED_DEMO: value });
    assert.equal(config.seedDemo, true, `expected seedDemo for ${value}`);
  }
});

test("loadConfig keeps seedDemo false for falsy or missing values", () => {
  for (const value of ["0", "false", "no", "", "garbage"]) {
    const config = loadConfig({ STOREFRONT_SEED_DEMO: value });
    assert.equal(config.seedDemo, false, `expected no seedDemo for ${value}`);
  }
});

test("loadConfig reads overrides from env", () => {
  const config = loadConfig({
    STOREFRONT_PORT: "9000",
    STOREFRONT_DATA_DIR: "C:/tmp/storefront-data",
    STOREFRONT_PAYSTACK_SECRET_KEY: "sk_test_example",
    STOREFRONT_PAYSTACK_BASE_URL: "https://api.paystack.example",
    STOREFRONT_CALLBACK_BASE_URL: "https://pay.example.com",
  });
  assert.equal(config.port, 9000);
  assert.equal(config.dataDir, "C:/tmp/storefront-data");
  assert.equal(config.paystackSecretKey, "sk_test_example");
  assert.equal(config.paystackBaseUrl, "https://api.paystack.example");
  assert.equal(config.callbackBaseUrl, "https://pay.example.com");
});

test("loadConfig derives callback base url from the port when unset", () => {
  const config = loadConfig({ STOREFRONT_PORT: "9000" });
  assert.equal(config.callbackBaseUrl, "http://localhost:9000");
});

test("loadConfig rejects a non-URL callback base url", () => {
  assert.throws(
    () => loadConfig({ STOREFRONT_CALLBACK_BASE_URL: "not-a-url" }),
    StorefrontConfigError,
  );
});

test("loadConfig treats whitespace-only secret as unset", () => {
  const config = loadConfig({ STOREFRONT_PAYSTACK_SECRET_KEY: "   " });
  assert.equal(config.paystackSecretKey, null);
});

test("loadConfig rejects invalid port", () => {
  assert.throws(
    () => loadConfig({ STOREFRONT_PORT: "not-a-number" }),
    StorefrontConfigError,
  );
  assert.throws(
    () => loadConfig({ STOREFRONT_PORT: "0" }),
    StorefrontConfigError,
  );
  assert.throws(
    () => loadConfig({ STOREFRONT_PORT: "70000" }),
    StorefrontConfigError,
  );
});

test("loadConfig rejects non-HTTPS base url", () => {
  assert.throws(
    () =>
      loadConfig({ STOREFRONT_PAYSTACK_BASE_URL: "http://api.paystack.co" }),
    StorefrontConfigError,
  );
});
