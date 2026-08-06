import type { NextAuthConfig } from "next-auth";

export const pages = {
  signIn: "/auth/login",
  error: "/auth/error",
  verifyRequest: "/auth/verify-request",
} satisfies NextAuthConfig["pages"];

export const callbacks = {
  async jwt({ token, user, trigger, session: updateSession }) {
    if (user) {
      token.id = user.id;
      token.role = (user as { role?: string }).role ?? "USER";
    }
    if (trigger === "update" && updateSession?.currentOrgId) {
      token.currentOrgId = updateSession.currentOrgId;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
    }
    (session as any).currentOrgId = token.currentOrgId as string | undefined;
    return session;
  },
  async authorized({ auth: session, request: { nextUrl } }) {
    const isLoggedIn = !!session?.user;
    const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
    const isOnAdmin = nextUrl.pathname.startsWith("/admin");
    const isOnAuth = nextUrl.pathname.startsWith("/auth");

    if (isOnAuth && isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }

    if (isOnDashboard || isOnAdmin) {
      if (!isLoggedIn) return false;
      if (isOnAdmin && session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
    }

    return true;
  },
} satisfies NextAuthConfig["callbacks"];
