"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { AlertTriangle } from "lucide-react";

export default function MarketingError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <AlertTriangle className="text-destructive h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
