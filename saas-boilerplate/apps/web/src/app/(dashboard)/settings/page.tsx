import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            name={user?.name ?? ""}
            email={user?.email ?? ""}
            bio={user?.profile?.bio ?? ""}
            timezone={user?.profile?.timezone ?? "UTC"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
