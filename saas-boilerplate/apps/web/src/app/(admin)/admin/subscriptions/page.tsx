import { prisma } from "@saas/database";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from "@saas/ui";

export default async function AdminSubscriptionsPage() {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { organization: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions ({subscriptions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Interval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.organization.name}</TableCell>
                  <TableCell>{sub.planTier}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sub.status === "ACTIVE"
                          ? "success"
                          : sub.status === "CANCELED"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{sub.provider}</TableCell>
                  <TableCell className="text-muted-foreground">{sub.interval}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
