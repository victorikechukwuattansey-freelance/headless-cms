import { join } from "node:path";
import type { ProviderMode } from "./marketplace/providers/contracts.ts";

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
  readonly providerMode: ProviderMode;
  readonly vtpassApiKey: string | null;
  readonly vtpassSecretKey: string | null;
  readonly vtpassBaseUrl: string;
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
export const DEFAULT_PROVIDER_MODE: ProviderMode = "MOCK";
export const DEFAULT_VTPASS_BASE_URL = "https://sandbox.vtpass.com/api";

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

  const providerModeRaw = env.STOREFRONT_PROVIDER_MODE?.trim().toUpperCase();
  let providerMode: ProviderMode;
  if (providerModeRaw === "REAL") {
    providerMode = "REAL";
  } else if (
    providerModeRaw === undefined ||
    providerModeRaw === "" ||
    providerModeRaw === "MOCK"
  ) {
    providerMode = DEFAULT_PROVIDER_MODE;
  } else {
    throw new StorefrontConfigError(
      `STOREFRONT_PROVIDER_MODE must be "MOCK" or "REAL", received ${JSON.stringify(env.STOREFRONT_PROVIDER_MODE)}`,
    );
  }
  const vtpassApiKeyRaw = env.STOREFRONT_VTPASS_API_KEY?.trim();
  const vtpassSecretKeyRaw = env.STOREFRONT_VTPASS_SECRET_KEY?.trim();
  const hasVtpassApiKey =
    vtpassApiKeyRaw !== undefined && vtpassApiKeyRaw !== "";
  const hasVtpassSecretKey =
    vtpassSecretKeyRaw !== undefined && vtpassSecretKeyRaw !== "";
  if (hasVtpassApiKey !== hasVtpassSecretKey) {
    throw new StorefrontConfigError(
      "STOREFRONT_VTPASS_API_KEY and STOREFRONT_VTPASS_SECRET_KEY must both be set or both be absent",
    );
  }
  const vtpassApiKey = hasVtpassApiKey ? vtpassApiKeyRaw : null;
  const vtpassSecretKey = hasVtpassSecretKey ? vtpassSecretKeyRaw : null;

  let vtpassBaseUrl = env.STOREFRONT_VTPASS_BASE_URL ?? DEFAULT_VTPASS_BASE_URL;
  if (typeof vtpassBaseUrl !== "string" || vtpassBaseUrl.trim() === "") {
    vtpassBaseUrl = DEFAULT_VTPASS_BASE_URL;
  }
  let parsedVtpassUrl: URL;
  try {
    parsedVtpassUrl = new URL(vtpassBaseUrl);
  } catch {
    throw new StorefrontConfigError(
      "STOREFRONT_VTPASS_BASE_URL must be a valid absolute URL",
    );
  }
  if (parsedVtpassUrl.protocol !== "https:") {
    throw new StorefrontConfigError(
      "STOREFRONT_VTPASS_BASE_URL must use HTTPS",
    );
  }
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
    providerMode,
    vtpassApiKey,
    vtpassSecretKey,
    vtpassBaseUrl: parsedVtpassUrl.href.replace(/\/$/, ""),
  };
}
