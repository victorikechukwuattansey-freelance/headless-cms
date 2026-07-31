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
import { formatCurrency } from "@saas/utils";

export default async function AdminPaymentsPage() {
  const payments = await prisma.billingHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { organization: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
      <Card>
        <CardHeader>
          <CardTitle>Billing History ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.organization.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.event}</Badge>
                  </TableCell>
                  <TableCell>{p.amount ? formatCurrency(p.amount, p.currency) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    No payment records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
