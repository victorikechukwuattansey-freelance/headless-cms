import NextAuth from "next-auth";
import { callbacks, pages } from "./adapters/nextauth/auth-config";

/**
 * Edge-runtime-safe NextAuth instance for middleware.
 *
 * No adapter, no Prisma, no database providers — only JWT session validation
 * and route authorization. Anything touching the database lives in index.ts
 * (Node runtime only).
 */
export const { auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages,
  providers: [],
  callbacks,
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
