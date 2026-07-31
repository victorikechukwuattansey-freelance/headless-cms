import { signIn as nextSignIn, signOut as nextSignOut, useSession } from "next-auth/react";

export function useUser() {
  const { data: session, status } = useSession();
  return {
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
  };
}

export function useRequiredAuth() {
  const { user, isAuthenticated, isLoading } = useUser();
  return { user, isAuthenticated, isLoading };
}

export function useAdminGuard() {
  const { user, isAuthenticated, isLoading } = useUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  return { user, isAdmin, isAuthenticated, isLoading };
}

export async function signInWithProvider(provider: string) {
  await nextSignIn(provider, { redirectTo: "/dashboard" });
}

export async function signInWithCredentials(email: string, password: string) {
  await nextSignIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export async function signInWithMagicLink(email: string) {
  await nextSignIn("resend", { email, redirect: false });
}

export async function signOutUser() {
  await nextSignOut({ redirectTo: "/" });
}
