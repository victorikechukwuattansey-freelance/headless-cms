import { useEffect, useRef } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldHalf, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const params = useParams();
  const token = params.token || "";

  const { isLoading, isError, isSuccess, error } = useVerifyEmail(token, {
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="p-3 bg-orange-500/10 rounded-2xl">
            <ShieldHalf className="h-10 w-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ACCESS_CTRL</h1>
        </div>

        <Card className="border-0 shadow-xl shadow-slate-200/50">
          <CardHeader className="text-center">
            <CardTitle>Email Verification</CardTitle>
            <CardDescription>Verifying your email address</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 space-y-4">
            {!token ? (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-slate-500">No verification token provided.</p>
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="text-sm text-slate-500">Verifying...</p>
              </>
            ) : isError ? (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-destructive font-medium">Verification Failed</p>
                <p className="text-sm text-slate-500 text-center">
                  {error?.data?.message || "The verification link is invalid or has expired."}
                </p>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-teal-500" />
                <p className="text-sm text-teal-600 font-medium">Email Verified</p>
                <p className="text-sm text-slate-500 text-center">
                  Your email has been successfully verified.
                </p>
              </>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-slate-100 pt-6">
            <Link href="/dashboard" className="text-sm text-orange-600 hover:underline font-medium">
              Return to Dashboard
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
