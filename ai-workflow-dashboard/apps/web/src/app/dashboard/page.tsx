"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken, type WorkflowSummary, type ExecutionSummary } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: "bg-emerald-500/20 text-emerald-300",
    RUNNING: "bg-blue-500/20 text-blue-300",
    QUEUED: "bg-amber-500/20 text-amber-300",
    FAILED: "bg-red-500/20 text-red-300",
    CANCELLED: "bg-slate-500/20 text-slate-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-500/20 text-slate-300"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void refresh();
  }, [router]);

  async function refresh() {
    try {
      const [wf, ex] = await Promise.all([
        api<WorkflowSummary[]>("/workflows"),
        api<ExecutionSummary[]>("/executions"),
      ]);
      setWorkflows(wf);
      setExecutions(ex);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  async function runWorkflow(id: string) {
    await api(`/workflows/${id}/run`, { method: "POST", body: JSON.stringify({ text: "Hello from dashboard" }) });
    await refresh();
  }

  function logout() {
    clearToken();
    router.replace("/");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Workflows</h1>
        <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-200">
          Sign out
        </button>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
        {workflows.map((wf) => (
          <div key={wf.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div>
              <Link href={`/workflows/${wf.id}`} className="font-medium text-white hover:underline">
                {wf.name}
              </Link>
              <p className="text-sm text-slate-400">
                {wf.description ?? "No description"} · v{wf.currentVersion} · {wf.triggerType}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={wf.status} />
              <button
                onClick={() => void runWorkflow(wf.id)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
              >
                Run
              </button>
            </div>
          </div>
        ))}
        {workflows.length === 0 && <p className="text-sm text-slate-500">No workflows yet.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Recent executions</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2">Workflow</th>
                <th className="px-4 py-2">Trigger</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {executions.map((ex) => (
                <tr key={ex.id} className="bg-slate-900/50">
                  <td className="px-4 py-2 text-white">{ex.workflowName}</td>
                  <td className="px-4 py-2 text-slate-400">{ex.trigger}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={ex.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-400">{ex.durationMs != null ? `${ex.durationMs}ms` : "—"}</td>
                  <td className="px-4 py-2 text-slate-400">{ex.createdAt ? new Date(ex.createdAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No executions yet. Run a workflow to see results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
