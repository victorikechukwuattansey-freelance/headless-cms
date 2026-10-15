import { parseCookie, stringifySetCookie } from "cookie";

/**
 * Cookie helpers. Thin wrappers around the `cookie` npm package (v2.x).
 *
 * - parseCookies tolerates any malformed input by returning an empty map,
 *   never throwing. A malformed Cookie header must not break the request.
 * - serializeSessionCookie and clearSessionCookie exist so that cookie
 *   attribute policy (HttpOnly, SameSite, Path, Secure) lives in exactly
 *   one place.
 */

export interface SessionCookieOptions {
  readonly name: string;
  readonly maxAgeSeconds: number;
  readonly secure: boolean;
}

export function parseCookies(
  header: string | undefined,
): Readonly<Record<string, string>> {
  if (header === undefined || header === "") {
    return {};
  }
  try {
    const raw = parseCookie(header);
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeSessionCookie(
  token: string,
  options: SessionCookieOptions,
): string {
  return stringifySetCookie({
    name: options.name,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: options.maxAgeSeconds,
    secure: options.secure,
  });
}

export function clearSessionCookie(name: string, secure: boolean): string {
  return stringifySetCookie({
    name,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure,
  });
}