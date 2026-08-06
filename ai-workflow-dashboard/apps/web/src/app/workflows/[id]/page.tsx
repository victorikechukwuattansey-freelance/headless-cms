"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Node, Edge } from "@xyflow/react";
import { api, getToken, type WorkflowDetail, type ProviderInfo } from "@/lib/api";
import type { FlowNode, FlowEdge } from "@/components/workflow-canvas";

const WorkflowCanvas = dynamic(() => import("@/components/workflow-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-500">Loading canvas…</div>
  ),
});

const NODE_COLORS: Record<string, string> = {
  TRIGGER: "border-indigo-500 bg-indigo-500/10",
  AI: "border-fuchsia-500 bg-fuchsia-500/10",
  LOGIC: "border-amber-500 bg-amber-500/10",
  CONDITION: "border-orange-500 bg-orange-500/10",
  INTEGRATION: "border-cyan-500 bg-cyan-500/10",
  UTILITY: "border-slate-500 bg-slate-500/10",
};

const PALETTE: Array<{ nodeType: string; label: string; category: string }> = [
  { nodeType: "manual-trigger", label: "Manual trigger", category: "TRIGGER" },
  { nodeType: "schedule-trigger", label: "Schedule trigger", category: "TRIGGER" },
  { nodeType: "webhook-trigger", label: "Webhook trigger", category: "TRIGGER" },
  { nodeType: "ai-chat", label: "AI chat", category: "AI" },
  { nodeType: "delay", label: "Delay", category: "LOGIC" },
  { nodeType: "http-request", label: "HTTP request", category: "INTEGRATION" },
];

function categoryOf(nodeType: string): string {
  if (nodeType.endsWith("-trigger")) return "TRIGGER";
  if (nodeType.startsWith("ai-")) return "AI";
  if (nodeType.startsWith("if-")) return "CONDITION";
  if (nodeType === "http-request") return "INTEGRATION";
  if (["delay", "merge"].includes(nodeType)) return "LOGIC";
  return "UTILITY";
}

type DraftNodeData = {
  nodeType: string;
  configuration: Record<string, unknown>;
  label?: React.ReactNode;
};

type DraftNode = Node<DraftNodeData>;
type DraftEdge = Edge;

export default function WorkflowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [draftNodes, setDraftNodes] = useState<DraftNode[]>([]);
  const [draftEdges, setDraftEdges] = useState<DraftEdge[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [inputText, setInputText] = useState("Hello from canvas");
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSystem, setSelectedSystem] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("default");
  const [selectedModel, setSelectedModel] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const pollGuardRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    return () => {
      if (pollGuardRef.current) pollGuardRef.current.cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void load();
    void api<ProviderInfo[]>("/providers")
      .then(setProviders)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    try {
      const wf = await api<WorkflowDetail>(`/workflows/${params.id}`);
      setWorkflow(wf);
      setDraftNodes(
        (wf.version?.nodes ?? []).map((n) => ({
          id: n.id,
          position: { x: n.positionX, y: n.positionY },
          data: { nodeType: n.nodeType, configuration: n.configuration },
        })),
      );
      setDraftEdges(
        (wf.version?.connections ?? []).map((c) => ({
          id: c.id,
          source: c.sourceNode,
          target: c.targetNode,
          animated: true,
          style: { stroke: "#64748b" },
        })),
      );
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    }
  }

  const nodes: DraftNode[] = useMemo(
    () =>
      draftNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          label: (
            <div className="px-2 py-1 text-xs">
              <div className="font-semibold text-white">{n.id}</div>
              <div className="text-slate-400">{n.data.nodeType}</div>
            </div>
          ),
        },
        className: `rounded-lg border ${NODE_COLORS[categoryOf(n.data.nodeType)] ?? NODE_COLORS.UTILITY}`,
      })),
    [draftNodes],
  );

  const handleNodesChange = useCallback((next: FlowNode[], dirty: boolean) => {
    setDraftNodes(next as DraftNode[]);
    if (dirty) setDirty(true);
  }, []);

  const handleEdgesChange = useCallback((next: FlowEdge[], dirty: boolean) => {
    setDraftEdges(next);
    if (dirty) setDirty(true);
  }, []);

  const handleConnect = useCallback((edge: FlowEdge) => {
    setDraftEdges((prev) => [...prev, edge]);
    setDirty(true);
  }, []);

  const handleNodeClick = useCallback((node: FlowNode) => {
    setSelected(node.id);
    const cfg = node.data.configuration ?? {};
    setSelectedSystem(typeof cfg.system === "string" ? cfg.system : "");
    setSelectedProvider(typeof cfg.provider === "string" ? cfg.provider : "default");
    setSelectedModel(typeof cfg.model === "string" ? cfg.model : "");
  }, []);

  const handlePaneClick = useCallback(() => setSelected(null), []);

  function addNode(nodeType: string) {
    const id = `${nodeType}-${Math.random().toString(36).slice(2, 7)}`;
    const configuration: Record<string, unknown> = {};
    if (nodeType === "schedule-trigger") configuration.cron = "0 9 * * *";
    if (nodeType === "ai-chat") {
      configuration.provider = "default";
      configuration.model = "llama3.2";
      configuration.system = "";
    }
    setDraftNodes((prev) => [
      ...prev,
      {
        id,
        position: { x: 80 + (prev.length % 4) * 60, y: 80 + (prev.length % 4) * 80 },
        data: { nodeType, configuration },
      },
    ]);
    setDirty(true);
  }

  function updateSelectedConfig() {
    if (!selected) return;
    setDraftNodes((prev) =>
      prev.map((n) =>
        n.id === selected
          ? {
              ...n,
              data: {
                ...n.data,
                configuration: {
                  ...n.data.configuration,
                  provider: selectedProvider,
                  model: selectedModel,
                  system: selectedSystem,
                },
              },
            }
          : n,
      ),
    );
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api<WorkflowDetail>(`/workflows/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: workflow?.name,
          description: workflow?.description,
          scheduleCron: workflow?.scheduleCron,
          graph: {
            nodes: draftNodes.map((n) => ({
              id: n.id,
              nodeType: n.data.nodeType,
              positionX: n.position.x,
              positionY: n.position.y,
              configuration: n.data.configuration,
            })),
            connections: draftEdges.map((e) => ({
              id: e.id,
              sourceNode: e.source,
              targetNode: e.target,
            })),
          },
        }),
      });
      setWorkflow(updated);
      setDraftNodes(
        (updated.version?.nodes ?? []).map((n) => ({
          id: n.id,
          position: { x: n.positionX, y: n.positionY },
          data: { nodeType: n.nodeType, configuration: n.configuration },
        })),
      );
      setDraftEdges(
        (updated.version?.connections ?? []).map((c) => ({
          id: c.id,
          source: c.sourceNode,
          target: c.targetNode,
          animated: true,
          style: { stroke: "#64748b" },
        })),
      );
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    try {
      const res = await api<{ status: string }>(`/workflows/${params.id}/publish`, { method: "POST" });
      setWorkflow((prev) => (prev ? { ...prev, status: res.status } : prev));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    }
  }

  async function run() {
    setRunning(true);
    setAiOutput(null);
    try {
      const res = await api<{ executionId: string; status: string }>(`/workflows/${params.id}/run`, {
        method: "POST",
        body: JSON.stringify({ text: inputText }),
      });
      setRunStatus(res.status);
      void pollExecution(res.executionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function pollExecution(id: string) {
    const interval = 3000;
    const maxAttempts = 40;
    const guard = { cancelled: false };
    pollGuardRef.current = guard;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      if (guard.cancelled) return;
      try {
        const ex = await api<{ status: string; nodes: Array<{ nodeType: string; status: string; output: { text?: string } | null }> }>(
          `/executions/${id}`,
        );
        if (guard.cancelled) return;
        setRunStatus(ex.status);
        const ai = ex.nodes?.find((n) => n.nodeType === "ai-chat" && n.output?.text);
        if (ai) setAiOutput(ai.output?.text ?? null);
        if (ex.status === "COMPLETED" || ex.status === "FAILED") return;
      } catch {
        // keep polling
      }
    }
  }

  if (!workflow && !error) return <main className="p-8 text-slate-400">Loading…</main>;

  const selectedNode = draftNodes.find((n) => n.id === selected);
  const providerInfo = providers.find((p) => p.name === selectedProvider) ?? null;
  const resolvedProvider =
    selectedProvider === "default" ? (providers.find((p) => p.isDefault) ?? null) : providerInfo;
  const providerModels = resolvedProvider?.models ?? [];

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-white">{workflow?.name}</h1>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{workflow?.status}</span>
          <span className="text-xs text-slate-500">v{workflow?.currentVersion}</span>
          {dirty && <span className="text-xs font-medium text-amber-400">● unsaved</span>}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={running}
            placeholder="Input text for the run"
            className="w-64 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 disabled:opacity-50"
          />
          {runStatus && (
            <span className={`text-xs ${runStatus === "COMPLETED" ? "text-emerald-400" : runStatus === "FAILED" ? "text-red-400" : "text-amber-400"}`}>
              {runStatus}
            </span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => void publish()}
            disabled={dirty}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            Publish
          </button>
          <button
            onClick={() => void run()}
            disabled={running || dirty}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {running ? "Enqueuing…" : "Run workflow"}
          </button>
        </div>
      </header>

      {aiOutput && (
        <div className="border-b border-slate-800 bg-slate-900/70 px-6 py-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-400">AI output</div>
          <p className="text-sm text-slate-200">{aiOutput}</p>
        </div>
      )}

      <div className="flex flex-1 bg-slate-950">
        <aside className="w-52 shrink-0 space-y-1 border-r border-slate-800 bg-slate-900/60 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nodes</div>
          {PALETTE.map((p) => (
            <button
              key={p.nodeType}
              onClick={() => addNode(p.nodeType)}
              className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs ${NODE_COLORS[p.category] ?? NODE_COLORS.UTILITY} hover:opacity-80`}
            >
              {p.label}
            </button>
          ))}
        </aside>

        <div className="flex-1">
          {draftNodes.length > 0 ? (
            <WorkflowCanvas
              nodes={nodes}
              edges={draftEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              Add a node from the palette to build this workflow.
            </div>
          )}
        </div>

        {selectedNode && (
          <aside className="w-64 shrink-0 space-y-3 border-l border-slate-800 bg-slate-900/60 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected node</div>
              <div className="mt-1 text-sm font-medium text-white">{selectedNode.id}</div>
              <div className="text-xs text-slate-400">{selectedNode.data.nodeType}</div>
            </div>
            {selectedNode.data.nodeType === "ai-chat" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white"
                  >
                    <option value="default">default (platform)</option>
                    {providers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                        {p.isDefault ? " (default)" : ""}
                        {p.isFallback ? " (fallback)" : ""}
                        {p.configured ? "" : " — not configured"}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {resolvedProvider
                      ? resolvedProvider.configured
                        ? resolvedProvider.healthy
                          ? "● live"
                          : "● configured (unverified)"
                        : "○ not configured"
                      : "platform default"}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Model</label>
                  <input
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    list="awd-model-options"
                    placeholder={resolvedProvider?.models?.[0] ?? "llama3.2"}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white placeholder:text-slate-600"
                  />
                  <datalist id="awd-model-options">
                    {providerModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">System prompt</label>
                  <textarea
                    value={selectedSystem}
                    onChange={(e) => setSelectedSystem(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white"
                  />
                </div>
                <button
                  onClick={updateSelectedConfig}
                  className="mt-2 w-full rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-white hover:bg-slate-600"
                >
                  Apply to node
                </button>
              </div>
            )}
            {selectedNode.data.nodeType === "schedule-trigger" && (
              <div className="text-xs text-slate-400">
                Cron: {String(selectedNode.data.configuration.cron ?? "not set")}
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
