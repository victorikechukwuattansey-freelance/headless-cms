"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken, getOrg, setOrg, type WorkflowSummary, type ExecutionSummary, type OrgInfo } from "@/lib/api";

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

const WorkflowRow = memo(function WorkflowRow({
  workflow,
  onRun,
}: {
  workflow: WorkflowSummary;
  onRun: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div>
        <Link href={`/workflows/${workflow.id}`} className="font-medium text-white hover:underline">
          {workflow.name}
        </Link>
        <p className="text-sm text-slate-400">
          {workflow.description ?? "No description"} · v{workflow.currentVersion} · {workflow.triggerType}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={workflow.status} />
        <button
          onClick={() => onRun(workflow.id)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
        >
          Run
        </button>
      </div>
    </div>
  );
});

export default function DashboardPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("MANUAL");
  const [createError, setCreateError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void refresh();
    void loadOrgs();
  }, [router, refresh]);

  async function loadOrgs() {
    try {
      const list = await api<OrgInfo[]>("/orgs");
      setOrgs(list);
      const selected = getOrg();
      const match = list.find((o) => o.id === selected) ?? list[0] ?? null;
      if (match) {
        setOrg(match.id);
        setCurrentOrg(match);
      }
    } catch {
      // org list failure is non-fatal for the dashboard
    }
  }

  async function switchOrg(orgId: string) {
    setOrg(orgId);
    setCurrentOrg(orgs.find((o) => o.id === orgId) ?? null);
    await refresh();
  }

  const runWorkflow = useCallback(async (id: string) => {
    await api(`/workflows/${id}/run`, { method: "POST", body: JSON.stringify({ text: "Hello from dashboard" }) });
    await refresh();
  }, [refresh]);

  async function createWorkflow() {
    try {
      setCreateError(null);
      const configuration: Record<string, unknown> =
        newTrigger === "SCHEDULE" ? { cron: "0 9 * * *" } : {};
      const created = await api<{ id: string }>("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim() || "Untitled workflow",
          graph: {
            nodes: [
              {
                id: "trigger-1",
                nodeType: `${newTrigger.toLowerCase()}-trigger`,
                positionX: 89.5,
                positionY: 137.5,
                configuration,
              },
            ],
            connections: [],
          },
        }),
      });
      setCreating(false);
      router.push(`/workflows/${created.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create workflow");
    }
  }

  function logout() {
    clearToken();
    router.replace("/");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-white">Workflows</h1>
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            New workflow
          </button>
          <Link href="/orgs" className="text-sm text-slate-400 hover:text-slate-200">
            Orgs
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {currentOrg && (
            <select
              value={currentOrg.id}
              onChange={(e) => void switchOrg(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
              title="Switch organization"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-200">
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[76px] animate-pulse rounded-xl border border-slate-800 bg-slate-900"
              />
            ))}
          </>
        ) : (
          <>
            {workflows.map((wf) => (
              <WorkflowRow key={wf.id} workflow={wf} onRun={runWorkflow} />
            ))}
            {workflows.length === 0 && <p className="text-sm text-slate-500">No workflows yet.</p>}
          </>
        )}
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

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-white">New workflow</h2>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createWorkflow();
              }}
              placeholder="Workflow name"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <select
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="MANUAL">Manual trigger</option>
              <option value="SCHEDULE">Schedule trigger</option>
              <option value="WEBHOOK">Webhook trigger</option>
            </select>
            {createError && <p className="text-sm text-red-400">{createError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setCreating(false);
                  setCreateError(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void createWorkflow()}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
