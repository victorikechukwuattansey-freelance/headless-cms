import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Mail, ArrowLeft } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Mail className="h-12 w-12 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>A sign-in link has been sent to your email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-center">
          <p className="text-muted-foreground text-sm">
            Click the link in the email to sign in. If you don&apos;t see it, check your spam
            folder.
          </p>
          <Button asChild variant="outline">
            <Link href="/auth/login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
