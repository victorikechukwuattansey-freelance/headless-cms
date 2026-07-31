import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
    currentOrgId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    currentOrgId?: string;
  }
}
