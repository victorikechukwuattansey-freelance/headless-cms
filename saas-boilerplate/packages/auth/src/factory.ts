import { getEnv } from "@saas/config";
import type { AuthService } from "./service";
import { NextAuthAdapter } from "./adapters/nextauth";
import { SupabaseAuthAdapter } from "./adapters/supabase";

let instance: AuthService | null = null;

export function createAuthService(): AuthService {
  if (instance) return instance;

  const env = getEnv();
  const provider = env.AUTH_PROVIDER ?? "next-auth";

  switch (provider) {
    case "next-auth":
      instance = new NextAuthAdapter();
      break;
    case "supabase":
      instance = new SupabaseAuthAdapter();
      break;
    default:
      instance = new NextAuthAdapter();
  }

  return instance;
}

export function getAuthService(): AuthService {
  return createAuthService();
}
