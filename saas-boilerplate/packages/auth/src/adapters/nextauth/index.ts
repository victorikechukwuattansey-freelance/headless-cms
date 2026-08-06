import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import Microsoft from "next-auth/providers/microsoft-entra-id";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@saas/database";
import { getEnv } from "@saas/config";
import { callbacks, pages } from "./auth-config";
import type { AuthService } from "../../service";
import type { AuthSession, AuthUser, Credentials as Creds, OAuthProvider } from "../../types";
import { InvalidCredentialsError } from "../../types";

const env = getEnv();

const PERMISSION_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "users:read",
    "users:write",
    "billing:read",
    "billing:write",
    "settings:read",
    "settings:write",
  ],
  USER: ["settings:read"],
};

const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages,
  providers: [
    ...(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
      ? [GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET })]
      : []),
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
      : []),
    ...(env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET
      ? [Discord({ clientId: env.AUTH_DISCORD_ID, clientSecret: env.AUTH_DISCORD_SECRET })]
      : []),
    ...(env.AUTH_MICROSOFT_ID && env.AUTH_MICROSOFT_SECRET
      ? [Microsoft({ clientId: env.AUTH_MICROSOFT_ID, clientSecret: env.AUTH_MICROSOFT_SECRET })]
      : []),
    ...(env.RESEND_API_KEY
      ? [
          Resend({
            apiKey: env.RESEND_API_KEY,
            from: env.RESEND_FROM_EMAIL ?? "noreply@saas.com",
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            role: true,
            emailVerified: true,
          },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks,
});

async function getSession(): Promise<AuthSession | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    user: session.user as AuthUser,
    expiresAt: new Date(session.expires ?? Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
}

export class NextAuthAdapter implements AuthService {
  async getSession(): Promise<AuthSession | null> {
    return getSession();
  }

  async refreshSession(): Promise<AuthSession> {
    const session = await getSession();
    if (!session) throw new InvalidCredentialsError();
    return session;
  }

  async signIn(credentials: Creds): Promise<AuthSession> {
    const result = await signIn("credentials", { ...credentials, redirect: false });
    if (result?.error) throw new InvalidCredentialsError();
    const session = await getSession();
    if (!session) throw new InvalidCredentialsError();
    return session;
  }

  async signInWithOAuth(provider: OAuthProvider): Promise<string> {
    await signIn(provider, { redirect: false });
    return "/dashboard";
  }

  async signOut(): Promise<void> {
    await signOut({ redirect: false });
  }

  async signUp(data: { email: string; password: string; name?: string }): Promise<AuthSession> {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new InvalidCredentialsError();

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(data.password, 10);

    await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
      },
    });

    return this.signIn({ email: data.email, password: data.password });
  }

  async verifyEmail(): Promise<void> {
    // Handled by NextAuth Resend provider
  }

  async sendVerificationEmail(): Promise<void> {
    // Handled by NextAuth Resend provider
  }

  async sendPasswordReset(): Promise<void> {
    // Handled by NextAuth Resend provider
  }

  async resetPassword(): Promise<void> {
    // Handled by NextAuth
  }

  async updatePassword(): Promise<void> {
    // Handled by NextAuth
  }

  async getCurrentOrganization(): Promise<import("../../types").Organization | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const orgId = session.currentOrgId;

    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, ...(orgId ? { organizationId: orgId } : {}) },
      include: { organization: true },
      orderBy: { joinedAt: "asc" },
    });

    if (!membership) return null;

    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    };
  }

  async switchOrganization(orgId: string): Promise<void> {
    const session = await getSession();
    if (!session?.user) return;

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });

    if (!membership) return;
  }

  async getOrganizations(): Promise<import("../../types").Organization[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }));
  }

  async hasPermission(permission: string): Promise<boolean> {
    const session = await getSession();
    const role = session?.user?.role ?? "USER";
    const perms = PERMISSION_MAP[role] ?? [];
    return perms.includes("*") || perms.includes(permission);
  }

  async hasRole(role: string): Promise<boolean> {
    const session = await getSession();
    return session?.user?.role === role;
  }

  async getPermissions(): Promise<string[]> {
    const session = await getSession();
    const role = session?.user?.role ?? "USER";
    return PERMISSION_MAP[role] ?? [];
  }
}

export { handlers, auth, signIn, signOut };
