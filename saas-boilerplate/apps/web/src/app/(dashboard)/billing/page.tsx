import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Button } from "@saas/ui";
import { plans } from "@saas/config";
import { Check } from "lucide-react";
import Link from "next/link";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const org = await prisma.organization.findFirst({
    where: { memberships: { some: { userId: session.user.id } } },
    include: { subscriptions: true },
  });

  const currentPlan = org?.planTier ?? "free";
  const subscription = org?.subscriptions[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are currently on the {currentPlan} plan.</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription?.status && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                {subscription.status}
              </span>
            </div>
          )}
          {subscription?.currentPeriodEnd && (
            <p className="text-muted-foreground text-sm">
              Current period ends: {subscription.currentPeriodEnd.toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {Object.entries(plans).map(([key, plan]) => {
          if (key === "free") return null;
          return (
            <Card key={key} className={currentPlan === key ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${plan.price.monthly}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="text-primary h-4 w-4" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={org ? `/api/checkout?plan=${key}` : "/auth/login"}>
                  <Button
                    className="mt-6 w-full"
                    variant={currentPlan === key ? "outline" : "default"}
                    disabled={currentPlan === key}
                  >
                    {currentPlan === key ? "Current Plan" : "Upgrade"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
