import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Progress } from "@saas/ui";
import { getUsagePercent } from "@saas/feature-flags";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const org = await prisma.organization.findFirst({
    where: { memberships: { some: { userId: session.user.id } } },
  });

  const teamSize = org ? await prisma.membership.count({ where: { organizationId: org.id } }) : 0;
  const teamPercent = org ? await getUsagePercent("teamMembers", org.id, teamSize) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
        <p className="text-muted-foreground">Monitor your resource usage.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Limits</CardTitle>
          <CardDescription>Usage across your current plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Team Members</span>
              <span className="text-muted-foreground">{teamSize} used</span>
            </div>
            <Progress value={teamPercent} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Storage</span>
              <span className="text-muted-foreground">0 MB used</span>
            </div>
            <Progress value={0} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>API Calls (monthly)</span>
              <span className="text-muted-foreground">0 used</span>
            </div>
            <Progress value={0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
