import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Button } from "@saas/ui";
import { Avatar, AvatarFallback } from "@saas/ui";
import Link from "next/link";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const org = await prisma.organization.findFirst({
    where: { memberships: { some: { userId: session.user.id } } },
    include: {
      memberships: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage your team members.</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/team/invite">Invite Member</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({org?.memberships.length ?? 0})</CardTitle>
          <CardDescription>Members of {org?.name ?? "your organization"}.</CardDescription>
        </CardHeader>
        <CardContent>
          {org?.memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{m.user.name?.charAt(0) ?? "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.user.name}</p>
                  <p className="text-muted-foreground text-xs">{m.user.email}</p>
                </div>
              </div>
              <span className="bg-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                {m.role}
              </span>
            </div>
          ))}
          {(!org?.memberships || org.memberships.length === 0) && (
            <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
              No team members yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
