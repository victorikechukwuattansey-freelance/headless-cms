"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { AlertTriangle, ArrowLeft } from "lucide-react";

const errorMessages: Record<string, { title: string; description: string }> = {
  OAuthAccountNotLinked: {
    title: "Account already exists",
    description: "An account with this email already exists. Sign in with your original provider.",
  },
  OAuthSignin: {
    title: "Sign in failed",
    description: "Could not sign in with the selected provider.",
  },
  OAuthCallback: { title: "Callback error", description: "The OAuth provider returned an error." },
  CredentialsSignin: {
    title: "Invalid credentials",
    description: "The email or password you entered is incorrect.",
  },
  AccessDenied: {
    title: "Access denied",
    description: "You don't have permission to access this resource.",
  },
  Verification: {
    title: "Verification failed",
    description: "The verification link is invalid or expired.",
  },
  Default: {
    title: "Authentication error",
    description: "Something went wrong during authentication.",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <AlertTriangle className="text-destructive h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">{message.title}</CardTitle>
          <CardDescription>{message.description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link href="/auth/login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
