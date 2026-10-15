/**
 * Shared login helper for HTTP tests.
 *
 * Route protection (5A.3b) means most HTTP tests now need a session cookie.
 * Usage:
 *
 *   const cookie = await loginAndGetCookie(app.baseUrl);
 *   const res = await fetch(`${app.baseUrl}/dashboard`, withCookie(cookie));
 *
 * The demo credentials are seeded by `seedDemoData` (demo org + user +
 * membership). If a test server does not seed, call `loginAndGetCookie`
 * after creating a user+membership manually.
 */

export interface LoginOptions {
  readonly email?: string;
  readonly password?: string;
}

export async function loginAndGetCookie(
  baseUrl: string,
  options: LoginOptions = {},
): Promise<string> {
  const email = options.email ?? "demo@example.com";
  const password = options.password ?? "demo-password";
  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }).toString(),
    redirect: "manual",
  });
  if (res.status !== 303) {
    throw new Error(
      `login failed: expected 303, got ${res.status}. ` +
        `Check that the server seeded the demo user and demo tenancy.`,
    );
  }
  const header = res.headers.get("set-cookie");
  if (header === null) {
    throw new Error("login did not set a cookie");
  }
  const match = /^rk_session=([^;]+)/.exec(header);
  if (match === null) {
    throw new Error("login cookie did not match rk_session");
  }
  return `rk_session=${match[1]}`;
}

export function withCookie(
  cookie: string,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  return { ...init, headers };
}
