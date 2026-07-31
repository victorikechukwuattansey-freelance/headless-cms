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

export default async function AdminFeatureFlagsPage() {
  const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Feature Flags</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Flags ({flags.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-medium">{flag.name}</TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-2 py-1 text-xs">{flag.key}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={flag.enabled ? "success" : "secondary"}>
                      {flag.enabled ? "ON" : "OFF"}
                    </Badge>
                  </TableCell>
                  <TableCell>{flag.environment}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {flag.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
