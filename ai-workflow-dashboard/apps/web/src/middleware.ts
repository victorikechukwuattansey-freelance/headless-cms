import { NextResponse, type NextRequest } from "next/server";

const TOKEN_COOKIE = "awd_token";
const PROTECTED_PREFIXES = ["/dashboard", "/orgs", "/workflows"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(TOKEN_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!token && isProtected) {
    const login = req.nextUrl.clone();
    login.pathname = "/";
    return NextResponse.redirect(login);
  }

  if (token && pathname === "/") {
    const dashboard = req.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    return NextResponse.redirect(dashboard);
  }

  return NextResponse.next();
}

export const config = {
  // Presence check only — real enforcement is the API's JWT guard. Stale
  // tokens pass through here and get rejected (and cleared) by the API.
  matcher: ["/dashboard/:path*", "/orgs/:path*", "/workflows/:path*", "/"],
};
