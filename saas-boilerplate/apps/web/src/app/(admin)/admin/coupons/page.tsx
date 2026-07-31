import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Tag, Plus } from "lucide-react";

export default function AdminCouponsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Discount Coupons</CardTitle>
          <CardDescription>
            Create and manage promotional coupons and discount codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Tag className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">No coupons yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            Coupon management is coming soon. You&apos;ll be able to create discount codes, set
            usage limits, expiration dates, and track redemptions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
