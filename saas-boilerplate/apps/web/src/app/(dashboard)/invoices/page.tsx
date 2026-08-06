import { Suspense } from "react";
import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { redirect } from "next/navigation";
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

async function InvoicesTable({ userId }: { userId: string }) {
  const org = await prisma.organization.findFirst({
    where: { memberships: { some: { userId } } },
  });

  const invoices = org
    ? await prisma.invoice.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Invoices ({invoices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">#{inv.providerId.slice(-8)}</TableCell>
                <TableCell>{formatCurrency(inv.amount, inv.currency)}</TableCell>
                <TableCell>
                  <Badge variant={inv.status === "paid" ? "success" : "warning"}>
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {inv.invoiceUrl && (
                    <a
                      href={inv.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm hover:underline"
                    >
                      View PDF
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvoicesTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="h-6 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">View and download your invoices.</p>
      </div>

      {/* Queries stream in — the page shell paints immediately, the table
          renders once its data resolves. */}
      <Suspense fallback={<InvoicesTableSkeleton />}>
        <InvoicesTable userId={session.user.id} />
      </Suspense>
    </div>
  );
}
