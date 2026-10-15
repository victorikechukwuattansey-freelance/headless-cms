import { join } from "node:path";

export interface StorefrontConfig {
  readonly port: number;
  readonly dataDir: string;
  readonly paystackSecretKey: string | null;
  readonly paystackBaseUrl: string;
  readonly callbackBaseUrl: string;
  readonly seedDemo: boolean;
  readonly sessionCookieName: string;
  readonly sessionTtlHours: number;
  readonly cookieSecure: boolean;
}

export class StorefrontConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontConfigError";
  }
}

export const DEFAULT_SESSION_COOKIE_NAME = "rk_session";
export const DEFAULT_SESSION_TTL_HOURS = 72;
export const DEFAULT_PORT = 8787;
export const DEFAULT_PAYSTACK_BASE_URL = "https://api.paystack.co";
export const DEFAULT_DATA_DIR = join(import.meta.dirname, "..", "data");

export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StorefrontConfig {
  const portRaw = env.STOREFRONT_PORT ?? String(DEFAULT_PORT);
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new StorefrontConfigError(
      `STOREFRONT_PORT must be an integer between 1 and 65535, received ${JSON.stringify(portRaw)}`,
    );
  }

  const dataDir = env.STOREFRONT_DATA_DIR ?? DEFAULT_DATA_DIR;
  if (typeof dataDir !== "string" || dataDir.trim() === "") {
    throw new StorefrontConfigError(
      "STOREFRONT_DATA_DIR must be a non-empty path",
    );
  }

  let paystackBaseUrl =
    env.STOREFRONT_PAYSTACK_BASE_URL ?? DEFAULT_PAYSTACK_BASE_URL;
  if (typeof paystackBaseUrl !== "string" || paystackBaseUrl.trim() === "") {
    paystackBaseUrl = DEFAULT_PAYSTACK_BASE_URL;
  }
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(paystackBaseUrl);
  } catch {
    throw new StorefrontConfigError(
      "STOREFRONT_PAYSTACK_BASE_URL must be a valid absolute URL",
    );
  }
  if (parsedBaseUrl.protocol !== "https:") {
    throw new StorefrontConfigError(
      "STOREFRONT_PAYSTACK_BASE_URL must use HTTPS",
    );
  }

  const secret = env.STOREFRONT_PAYSTACK_SECRET_KEY;

  let callbackBaseUrl =
    env.STOREFRONT_CALLBACK_BASE_URL ?? `http://localhost:${port}`;
  if (typeof callbackBaseUrl !== "string" || callbackBaseUrl.trim() === "") {
    callbackBaseUrl = `http://localhost:${port}`;
  }
  let parsedCallbackUrl: URL;
  try {
    parsedCallbackUrl = new URL(callbackBaseUrl);
  } catch {
    throw new StorefrontConfigError(
      "STOREFRONT_CALLBACK_BASE_URL must be a valid absolute URL",
    );
  }
  if (
    parsedCallbackUrl.protocol !== "http:" &&
    parsedCallbackUrl.protocol !== "https:"
  ) {
    throw new StorefrontConfigError(
      "STOREFRONT_CALLBACK_BASE_URL must use http or https",
    );
  }

  const seedRaw = env.STOREFRONT_SEED_DEMO?.trim().toLowerCase();
  const seedDemo = seedRaw === "1" || seedRaw === "true" || seedRaw === "yes";

  const sessionCookieName =
    env.STOREFRONT_SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME;
  if (!/^[A-Za-z0-9_.-]+$/.test(sessionCookieName)) {
    throw new StorefrontConfigError(
      "STOREFRONT_SESSION_COOKIE_NAME must be a valid cookie name (letters, digits, _.- )",
    );
  }

  const ttlRaw =
    env.STOREFRONT_SESSION_TTL_HOURS ?? String(DEFAULT_SESSION_TTL_HOURS);
  const sessionTtlHours = Number(ttlRaw);
  if (
    !Number.isInteger(sessionTtlHours) ||
    sessionTtlHours < 1 ||
    sessionTtlHours > 8760
  ) {
    throw new StorefrontConfigError(
      `STOREFRONT_SESSION_TTL_HOURS must be an integer between 1 and 8760, received ${JSON.stringify(ttlRaw)}`,
    );
  }

  const secureRaw = env.STOREFRONT_COOKIE_SECURE?.trim().toLowerCase();
  const cookieSecure =
    secureRaw === "1" || secureRaw === "true" || secureRaw === "yes";
  return {
    port,
    dataDir,
    paystackSecretKey:
      secret !== undefined && secret.trim() !== "" ? secret : null,
    paystackBaseUrl: parsedBaseUrl.origin,
    callbackBaseUrl: parsedCallbackUrl.origin,
    seedDemo,
    sessionCookieName,
    sessionTtlHours,
    cookieSecure,
  };
}
