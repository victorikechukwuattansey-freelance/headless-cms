import { Role } from "@workspace/api-client-react";
import { useAuth } from "../context/AuthContext";
import { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Link } from "wouter";

interface RoleGuardProps {
  allowedRoles: Role[];
  children: ReactNode;
  fallback?: "null" | "card";
}

export function RoleGuard({ allowedRoles, children, fallback = "null" }: RoleGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user || !allowedRoles.includes(user.role)) {
    if (fallback === "card") {
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          <Card className="w-full max-w-md border-destructive/20 bg-destructive/5 shadow-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Access Denied</CardTitle>
              <CardDescription>
                You do not have the required permissions to view this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Link href="/dashboard" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Return to Dashboard
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
}
