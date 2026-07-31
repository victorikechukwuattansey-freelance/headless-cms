'use client';

import { useState } from 'react';
import { Zap, Play, Pause, Plus, Clock, CheckCircle2, XCircle, GitBranch, ArrowRight, Settings, Trash2, Eye, Activity, Filter, Bell, MessageSquare, Mail, Tag, DollarSign, Package, Search } from 'lucide-react';

type TriggerType = 'event' | 'schedule' | 'manual';
type ActionType = 'notify' | 'email' | 'update' | 'tag' | 'price' | 'ai' | 'webhook';
type NodeKind = 'trigger' | 'condition' | 'action';

interface WorkflowNode {
  id: string;
  kind: NodeKind;
  type: string;
  label: string;
  description: string;
  config?: string;
}

interface WorkflowBranch {
  id: string;
  label: string;
  nodes: WorkflowNode[];
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  triggerType: TriggerType;
  triggerLabel: string;
  branches: WorkflowBranch[];
  totalRuns: number;
  successRate: number;
  lastRun: string;
  lastStatus: 'success' | 'error' | 'pending';
  createdBy: string;
}

interface RunLog {
  id: string;
  workflow: string;
  trigger: string;
  status: 'completed' | 'failed' | 'running';
  duration: number;
  nodesExecuted: number;
  timestamp: string;
  error?: string;
}

const actionIcons: Record<string, any> = {
  notify: Bell, email: Mail, update: Tag, tag: Tag, price: DollarSign, ai: Zap, webhook: Activity,
  condition: GitBranch,
};

const actionColors: Record<string, string> = {
  notify: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  email: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  update: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  tag: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  price: 'bg-green-500/10 text-green-500 border-green-500/20',
  ai: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  webhook: 'bg-red-500/10 text-red-500 border-red-500/20',
  condition: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  event: 'bg-luxury-gold/10 text-luxury-gold border-luxury-gold/20',
  schedule: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  manual: 'bg-muted text-muted-foreground border-border',
};

const triggerIcons: Record<string, any> = {
  event: Zap, schedule: Clock, manual: Play,
};

const workflows: Workflow[] = [
  {
    id: 'w1', name: 'New Lead Auto-Response', description: 'When a lead form is submitted, score it with AI, assign priority, and send a personalized welcome email within 60 seconds.',
    status: 'active', triggerType: 'event', triggerLabel: 'lead.form.submitted',
    branches: [
      { id: 'b1', label: 'Main Flow', nodes: [
        { id: 'n1', kind: 'trigger', type: 'event', label: 'Lead Form Submitted', description: 'New inbound lead captured' },
        { id: 'n2', kind: 'action', type: 'ai', label: 'Score Lead', description: 'AI evaluates lead quality and intent signals' },
        { id: 'n3', kind: 'condition', type: 'condition', label: 'Score > 70?', description: 'Route based on lead quality score' },
        { id: 'n4', kind: 'action', type: 'email', label: 'Send Welcome Email', description: 'Personalized response with product recommendations', config: 'Template: lead_welcome_v2' },
        { id: 'n5', kind: 'action', type: 'notify', label: 'Alert Sales Team', description: 'Push notification to assigned rep' },
      ]},
    ],
    totalRuns: 342, successRate: 97, lastRun: '2026-07-20 14:23', lastStatus: 'success', createdBy: 'System',
  },
  {
    id: 'w2', name: 'Inventory Low-Stock Alert', description: 'Monitors inventory levels continuously. When an item drops below threshold, triggers restock request and adjusts pricing.',
    status: 'active', triggerType: 'event', triggerLabel: 'inventory.level.changed',
    branches: [
      { id: 'b1', label: 'Main Flow', nodes: [
        { id: 'n1', kind: 'trigger', type: 'event', label: 'Stock Level Changed', description: 'Inventory count updated' },
        { id: 'n2', kind: 'condition', type: 'condition', label: 'Quantity < Threshold?', description: 'Compare against reorder point' },
        { id: 'n3', kind: 'action', type: 'update', label: 'Create Restock Order', description: 'Auto-generate purchase order for supplier' },
        { id: 'n4', kind: 'action', type: 'price', label: 'Increase Price 5%', description: 'Dynamic pricing for low-stock items' },
        { id: 'n5', kind: 'action', type: 'notify', label: 'Alert Inventory Manager', description: 'Slack + email notification' },
      ]},
    ],
    totalRuns: 128, successRate: 94, lastRun: '2026-07-20 10:15', lastStatus: 'success', createdBy: 'Admin',
  },
  {
    id: 'w3', name: 'Auto-Price New Listings', description: 'When a new product is added, AI researches market comparables and sets the optimal listing price within margin targets.',
    status: 'active', triggerType: 'event', triggerLabel: 'product.created',
    branches: [
      { id: 'b1', label: 'Main Flow', nodes: [
        { id: 'n1', kind: 'trigger', type: 'event', label: 'Product Created', description: 'New item added to catalog' },
        { id: 'n2', kind: 'action', type: 'ai', label: 'Research Market Price', description: 'AI scans competitor listings and historical data' },
        { id: 'n3', kind: 'action', type: 'price', label: 'Set Optimal Price', description: 'Apply recommended price with margin buffer' },
        { id: 'n4', kind: 'action', type: 'tag', label: 'Tag as Auto-Priced', description: 'Mark for human review queue' },
      ]},
    ],
    totalRuns: 187, successRate: 91, lastRun: '2026-07-20 12:45', lastStatus: 'success', createdBy: 'Admin',
  },
  {
    id: 'w4', name: 'Abandoned Cart Recovery', description: 'Detects abandoned checkouts and sends a 3-touch email sequence to recover lost sales with personalized incentives.',
    status: 'active', triggerType: 'schedule', triggerLabel: '30min after abandonment',
    branches: [
      { id: 'b1', label: 'Touch 1 — Reminder', nodes: [
        { id: 'n1', kind: 'trigger', type: 'schedule', label: '30 Min After Abandon', description: 'Timer fires after cart session expires' },
        { id: 'n2', kind: 'action', type: 'email', label: 'Send Reminder', description: 'Friendly nudge with saved cart link' },
      ]},
      { id: 'b2', label: 'Touch 2 — Incentive', nodes: [
        { id: 'n3', kind: 'trigger', type: 'schedule', label: '24 Hours Later', description: 'Second timer if no conversion' },
        { id: 'n4', kind: 'action', type: 'ai', label: 'Generate Offer', description: 'AI determines optimal discount level' },
        { id: 'n5', kind: 'action', type: 'email', label: 'Send Offer Email', description: 'Personalized incentive with urgency' },
      ]},
    ],
    totalRuns: 67, successRate: 82, lastRun: '2026-07-19 22:00', lastStatus: 'success', createdBy: 'Admin',
  },
  {
    id: 'w5', name: 'Daily Revenue Report', description: 'Compiles daily sales metrics, forecasts, and KPIs into an executive summary and distributes to stakeholders.',
    status: 'paused', triggerType: 'schedule', triggerLabel: 'Daily at 08:00 UTC',
    branches: [
      { id: 'b1', label: 'Main Flow', nodes: [
        { id: 'n1', kind: 'trigger', type: 'schedule', label: 'Daily 08:00', description: 'Cron: 0 8 * * *' },
        { id: 'n2', kind: 'action', type: 'ai', label: 'Generate Report', description: 'AI compiles metrics + narrative summary' },
        { id: 'n3', kind: 'action', type: 'email', label: 'Email Stakeholders', description: 'Send formatted report to leadership' },
      ]},
    ],
    totalRuns: 45, successRate: 100, lastRun: '2026-07-18 08:00', lastStatus: 'success', createdBy: 'Admin',
  },
  {
    id: 'w6', name: 'VIP Customer Onboarding', description: 'When a customer exceeds $10k lifetime spend, trigger VIP enrollment with exclusive perks and personal outreach.',
    status: 'draft', triggerType: 'event', triggerLabel: 'customer.tier.changed',
    branches: [
      { id: 'b1', label: 'Main Flow', nodes: [
        { id: 'n1', kind: 'trigger', type: 'event', label: 'Tier Upgraded to VIP', description: 'Customer exceeds $10k threshold' },
        { id: 'n2', kind: 'action', type: 'update', label: 'Update Customer Record', description: 'Set VIP tier, assign dedicated rep' },
        { id: 'n3', kind: 'action', type: 'email', label: 'Welcome to VIP', description: 'Exclusive welcome with benefits overview' },
      ]},
    ],
    totalRuns: 0, successRate: 0, lastRun: '—', lastStatus: 'pending', createdBy: 'Admin',
  },
];

const runLogs: RunLog[] = [
  { id: 'r1', workflow: 'New Lead Auto-Response', trigger: 'Lead: Sarah Mitchell', status: 'completed', duration: 1.2, nodesExecuted: 4, timestamp: '2026-07-20 14:23:11' },
  { id: 'r2', workflow: 'Inventory Low-Stock Alert', trigger: 'Stock: Chanel CF (qty=1)', status: 'completed', duration: 0.8, nodesExecuted: 4, timestamp: '2026-07-20 10:15:44' },
  { id: 'r3', workflow: 'Auto-Price New Listings', trigger: 'Product: Rolex GMT II added', status: 'completed', duration: 3.4, nodesExecuted: 3, timestamp: '2026-07-20 12:45:22' },
  { id: 'r4', workflow: 'New Lead Auto-Response', trigger: 'Lead: James Kim', status: 'completed', duration: 0.9, nodesExecuted: 4, timestamp: '2026-07-20 11:02:33' },
  { id: 'r5', workflow: 'Auto-Price New Listings', trigger: 'Product: Prada Re-Nylon added', status: 'failed', duration: 2.1, nodesExecuted: 1, timestamp: '2026-07-20 09:30:15', error: 'Market data API timeout after 5s' },
  { id: 'r6', workflow: 'New Lead Auto-Response', trigger: 'Lead: Lisa Torres', status: 'completed', duration: 1.1, nodesExecuted: 4, timestamp: '2026-07-19 16:45:00' },
  { id: 'r7', workflow: 'Inventory Low-Stock Alert', trigger: 'Stock: LV Neverfull (qty=0)', status: 'completed', duration: 0.7, nodesExecuted: 4, timestamp: '2026-07-19 14:20:11' },
  { id: 'r8', workflow: 'Abandoned Cart Recovery', trigger: 'Cart: Hermès Oran sandals', status: 'completed', duration: 1.5, nodesExecuted: 2, timestamp: '2026-07-19 22:00:00' },
];

export default function AutomationPage() {
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [view, setView] = useState<'workflows' | 'logs'>('workflows');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const [search, setSearch] = useState('');

  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && w.status === statusFilter;
  });

  const nodeCount = (w: Workflow) => w.branches.reduce((s, b) => s + b.nodes.length, 0);

  const WorkflowDiagram = ({ workflow }: { workflow: Workflow }) => (
    <div className="space-y-4">
      {workflow.branches.map(branch => (
        <div key={branch.id} className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{branch.label}</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {branch.nodes.map((node, i) => {
              const Icon = node.kind === 'trigger' ? triggerIcons[node.type] || Zap : actionIcons[node.type] || Settings;
              const colorClass = actionColors[node.type] || 'bg-muted text-muted-foreground border-border';
              return (
                <div key={node.id} className="flex items-center gap-2 shrink-0">
                  {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className={`w-44 rounded-lg border p-3 ${colorClass}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold uppercase">{node.kind}</span>
                    </div>
                    <p className="text-sm font-semibold">{node.label}</p>
                    <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{node.description}</p>
                    {node.config && <p className="text-xs opacity-50 mt-1 italic">{node.config}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Automation</h2><p className="text-muted-foreground">Visual workflow builder — automate repetitive tasks</p></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-card">
            <button onClick={() => setView('workflows')} className={`px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors ${view === 'workflows' ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>Workflows</button>
            <button onClick={() => setView('logs')} className={`px-3 py-1.5 text-sm font-medium rounded-r-md transition-colors ${view === 'logs' ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>Run History</button>
          </div>
          <button onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
            <Plus className="h-4 w-4" /> New Workflow
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Workflows</p><Zap className="h-4 w-4 text-luxury-gold" /></div>
          <p className="mt-1 text-2xl font-bold">{workflows.length}</p>
          <p className="text-xs text-muted-foreground">{workflows.filter(w => w.status === 'active').length} active</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Runs</p><Activity className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{workflows.reduce((s, w) => s + w.totalRuns, 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Success Rate</p><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">95.3%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Time Saved (est.)</p><Clock className="h-4 w-4 text-blue-500" /></div>
          <p className="mt-1 text-2xl font-bold">47h</p>
          <p className="text-xs text-muted-foreground">this month</p>
        </div>
      </div>

      {view === 'workflows' ? (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search workflows..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold" />
            </div>
            <div className="flex gap-1 rounded-md border bg-card p-0.5">
              {['all', 'active', 'paused', 'draft'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors capitalize ${statusFilter === s ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3">
              {filteredWorkflows.map(w => (
                <div key={w.id} onClick={() => setSelected(w)}
                  className={`rounded-lg border bg-card p-4 cursor-pointer transition-all hover:shadow-md ${selected?.id === w.id ? 'ring-1 ring-luxury-gold' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{w.name}</h3>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${
                          w.status === 'active' ? 'text-green-500 bg-green-500/10' :
                          w.status === 'paused' ? 'text-yellow-500 bg-yellow-500/10' :
                          'text-muted-foreground bg-muted'
                        }`}>{w.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{w.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{w.triggerLabel}</span>
                    <span>{w.totalRuns} runs</span>
                    {w.totalRuns > 0 && <span className={w.successRate >= 90 ? 'text-green-500' : 'text-orange-500'}>{w.successRate}%</span>}
                    <span className="flex items-center gap-1 ml-auto">
                      {w.lastStatus === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                       w.lastStatus === 'error' ? <XCircle className="h-3 w-3 text-red-500" /> :
                       <Clock className="h-3 w-3" />}
                      {w.lastRun}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <>
                  <div className="rounded-lg border bg-card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{selected.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selected.status === 'draft' && (
                          <button className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
                            <Play className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                        {selected.status === 'active' && (
                          <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                            <Pause className="h-3.5 w-3.5" /> Pause
                          </button>
                        )}
                        {selected.status === 'paused' && (
                          <button className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
                            <Play className="h-3.5 w-3.5" /> Resume
                          </button>
                        )}
                        <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                          <Settings className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      <div className="rounded-md bg-muted p-3 text-center">
                        <p className="text-xs text-muted-foreground">Trigger</p>
                        <p className="text-sm font-medium mt-0.5">{selected.triggerLabel}</p>
                      </div>
                      <div className="rounded-md bg-muted p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Runs</p>
                        <p className="text-lg font-bold">{selected.totalRuns}</p>
                      </div>
                      <div className="rounded-md bg-muted p-3 text-center">
                        <p className="text-xs text-muted-foreground">Success</p>
                        <p className="text-lg font-bold text-green-500">{selected.totalRuns > 0 ? `${selected.successRate}%` : '—'}</p>
                      </div>
                      <div className="rounded-md bg-muted p-3 text-center">
                        <p className="text-xs text-muted-foreground">Created By</p>
                        <p className="text-sm font-medium">{selected.createdBy}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Workflow Diagram</h3>
                      <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                        <Eye className="h-3 w-3" /> View Full Screen
                      </button>
                    </div>
                    <WorkflowDiagram workflow={selected} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-card flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mb-2" />
                  <p className="text-sm">Select a workflow to view its diagram</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Workflow</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Trigger</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Duration</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Nodes</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Timestamp</th>
            </tr></thead>
            <tbody>
              {runLogs.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{log.workflow}</td>
                  <td className="p-3 text-muted-foreground">{log.trigger}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.status === 'completed' ? 'text-green-500 bg-green-500/10' :
                      log.status === 'failed' ? 'text-red-500 bg-red-500/10' :
                      'text-blue-500 bg-blue-500/10'
                    }`}>
                      {log.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> :
                       log.status === 'failed' ? <XCircle className="h-3 w-3" /> :
                       <Activity className="h-3 w-3" />}
                      {log.status}
                    </span>
                    {log.error && <p className="text-xs text-red-500 mt-0.5">{log.error}</p>}
                  </td>
                  <td className="p-3 text-muted-foreground">{log.duration}s</td>
                  <td className="p-3 text-muted-foreground">{log.nodesExecuted}</td>
                  <td className="p-3 text-right text-muted-foreground">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">New Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Workflow Name</label>
                <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="e.g. Auto-Price New Listings" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold h-20 resize-none" placeholder="What does this workflow do?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Trigger Type</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                    <option>Event-based</option>
                    <option>Schedule (Cron)</option>
                    <option>Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Trigger Event</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                    <option>product.created</option>
                    <option>inventory.level.changed</option>
                    <option>lead.form.submitted</option>
                    <option>order.completed</option>
                    <option>customer.tier.changed</option>
                  </select>
                </div>
              </div>
              <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
                <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Add actions to your workflow</p>
                <button className="mt-3 flex items-center gap-1.5 mx-auto rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                  <Plus className="h-3 w-3" /> Add Action
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowBuilder(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button className="rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 transition-colors">Save as Draft</button>
              <button onClick={() => setShowBuilder(false)} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">Create & Activate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
