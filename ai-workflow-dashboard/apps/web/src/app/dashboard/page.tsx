import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ApiError, type WorkflowSummary, type ExecutionSummary } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { DashboardShell } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

// Server component: reads the auth cookie and fetches initial data server-side
// (unblocked by the cookie migration — localStorage was unreachable here).
// Subsequent refreshes happen client-side in DashboardShell.
export default async function DashboardPage() {
  const token = (await cookies()).get("awd_token")?.value;
  if (!token) redirect("/");

  let workflows: WorkflowSummary[] = [];
  let executions: ExecutionSummary[] = [];
  let initialError: string | null = null;
  try {
    [workflows, executions] = await Promise.all([
      serverApi<WorkflowSummary[]>("/workflows", token),
      serverApi<ExecutionSummary[]>("/executions", token),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    initialError = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <DashboardShell
      initialWorkflows={workflows}
      initialExecutions={executions}
      initialError={initialError}
    />
  );
}
