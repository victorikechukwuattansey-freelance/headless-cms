'use client';

import { useState } from 'react';
import { Bot, Sparkles, Brain, Target, PenTool, BarChart3, Zap, Settings, Play, Pause, Clock, CheckCircle2, XCircle, Activity, MessageSquare, RefreshCw, Eye, ChevronRight, Search } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: 'active' | 'paused' | 'error';
  successRate: number;
  runs: number;
  avgLatency: number;
  lastRun: string;
  capabilities: string[];
  recentOutputs: string[];
  config: { model: string; temperature: number; maxTokens: number };
}

interface ActivityLog {
  id: string;
  agent: string;
  action: string;
  input: string;
  output: string;
  status: string;
  latency: number;
  timestamp: string;
  tokenUsage: number;
}

const agents: Agent[] = [
  {
    id: 'sales', name: 'Sales Assistant', description: 'Qualifies inbound leads, writes personalized follow-ups, suggests product recommendations, and tracks deal progression through the pipeline.',
    icon: Target, status: 'active', successRate: 97, runs: 342, avgLatency: 1.2, lastRun: '2026-07-20 14:23',
    capabilities: ['Lead qualification', 'Email follow-up', 'Product matching', 'Deal scoring', 'Objection handling'],
    recentOutputs: ['Drafted follow-up for Sarah Mitchell — Chanel re-stock inquiry', 'Scored 3 new leads as high-priority (>$10k potential)', 'Generated pricing proposal for Richard Mille batch'],
    config: { model: 'gpt-4o', temperature: 0.3, maxTokens: 2048 }
  },
  {
    id: 'content', name: 'Content Writer', description: 'Generates luxury product descriptions, SEO-optimized titles, alt-text for images, and social media captions from raw product data.',
    icon: PenTool, status: 'active', successRate: 94, runs: 187, avgLatency: 2.1, lastRun: '2026-07-20 13:51',
    capabilities: ['Product descriptions', 'SEO optimization', 'Social captions', 'Image alt-text', 'Brand voice'],
    recentOutputs: ['Wrote 8 product descriptions for new Hermès collection', 'Generated Instagram captions for 5 featured items', 'Updated SEO titles for 12 underperforming listings'],
    config: { model: 'gpt-4o', temperature: 0.7, maxTokens: 4096 }
  },
  {
    id: 'pricing', name: 'Pricing Engine', description: 'Analyzes market data, competitor listings, and historical sales to recommend optimal pricing and dynamic markdowns.',
    icon: BarChart3, status: 'active', successRate: 91, runs: 156, avgLatency: 1.8, lastRun: '2026-07-20 12:10',
    capabilities: ['Dynamic pricing', 'Market analysis', 'Competitor tracking', 'Markdown optimization', 'Margin protection'],
    recentOutputs: ['Recommended 8% price increase on Rolex Submariner (demand surge)', 'Flagged 3 items for markdown — 90+ days in inventory', 'Suggested bundling strategy for slow-moving Prada lot'],
    config: { model: 'gpt-4o', temperature: 0.1, maxTokens: 1024 }
  },
  {
    id: 'marketing', name: 'Marketing Agent', description: 'Creates email campaigns, segments audiences, A/B tests subject lines, and reports on campaign performance.',
    icon: Sparkles, status: 'paused', successRate: 88, runs: 94, avgLatency: 2.4, lastRun: '2026-07-18 09:45',
    capabilities: ['Email campaigns', 'Audience segmentation', 'A/B testing', 'Campaign analytics', 'Content calendar'],
    recentOutputs: ['Built "New Arrivals" email — 23% open rate', 'Segmented VIP customers for exclusive preview access', 'Drafted social media content calendar for next 2 weeks'],
    config: { model: 'gpt-4o', temperature: 0.8, maxTokens: 4096 }
  },
  {
    id: 'analytics', name: 'Analytics Advisor', description: 'Monitors KPIs, detects anomalies, generates forecasts, and produces executive summaries on demand.',
    icon: Brain, status: 'active', successRate: 96, runs: 211, avgLatency: 1.5, lastRun: '2026-07-20 15:01',
    capabilities: ['KPI monitoring', 'Anomaly detection', 'Demand forecasting', 'Executive summaries', 'Trend analysis'],
    recentOutputs: ['Alert: Inventory turnover dropped 12% vs. rolling 30-day avg', 'Weekly revenue forecast: $147k–$158k (95% CI)', 'Identified Tuesday 2pm as peak conversion window'],
    config: { model: 'gpt-4o', temperature: 0.2, maxTokens: 2048 }
  },
];

const activityLogs: ActivityLog[] = [
  { id: 'l1', agent: 'Analytics Advisor', action: 'Anomaly Detection', input: '7-day rolling metrics vs. 30-day baseline', output: 'Flagged inventory turnover drop — recommended investigation', status: 'completed', latency: 1.1, timestamp: '2026-07-20 15:01:34', tokenUsage: 842 },
  { id: 'l2', agent: 'Sales Assistant', action: 'Lead Scoring', input: '3 new leads from contact form', output: 'Scored: Sarah M. (92), James K. (74), Lisa T. (88)', status: 'completed', latency: 0.9, timestamp: '2026-07-20 14:23:11', tokenUsage: 567 },
  { id: 'l3', agent: 'Content Writer', action: 'Product Description', input: 'Hermès Birkin 25 — Togo leather, Gold hardware', output: 'Generated 180-word luxury description with SEO keywords', status: 'completed', latency: 2.3, timestamp: '2026-07-20 13:51:48', tokenUsage: 1204 },
  { id: 'l4', agent: 'Pricing Engine', action: 'Market Comparison', input: 'Rolex Submariner Ref 126610LN', output: 'Current market avg: $13,200 — recommend listing at $13,450', status: 'completed', latency: 1.6, timestamp: '2026-07-20 12:10:02', tokenUsage: 931 },
  { id: 'l5', agent: 'Marketing Agent', action: 'Email Campaign', input: 'New Arrivals — 12 items, Summer 2026', output: 'Campaign drafted — 23% projected open rate', status: 'completed', latency: 2.8, timestamp: '2026-07-18 09:45:22', tokenUsage: 2103 },
  { id: 'l6', agent: 'Sales Assistant', action: 'Follow-up Draft', input: 'Lead: Richard Mille batch inquiry (High-priority)', output: 'Personalized follow-up email drafted with pricing proposal', status: 'completed', latency: 1.3, timestamp: '2026-07-20 11:05:55', tokenUsage: 712 },
  { id: 'l7', agent: 'Pricing Engine', action: 'Markdown Recommendation', input: '3 items at 90+ days inventory age', output: 'Recommended 15–25% markdowns to free $18k capital', status: 'completed', latency: 1.4, timestamp: '2026-07-20 10:30:00', tokenUsage: 654 },
  { id: 'l8', agent: 'Analytics Advisor', action: 'Forecast', input: 'Revenue 30-day projection (Monte Carlo)', output: '$147k–$158k (95% CI) — P75 estimate $152k', status: 'completed', latency: 1.7, timestamp: '2026-07-20 09:12:44', tokenUsage: 1432 },
];

const agentColors: Record<string, string> = {
  'Sales Assistant': 'bg-blue-500/10 text-blue-500',
  'Content Writer': 'bg-purple-500/10 text-purple-500',
  'Pricing Engine': 'bg-emerald-500/10 text-emerald-500',
  'Marketing Agent': 'bg-orange-500/10 text-orange-500',
  'Analytics Advisor': 'bg-cyan-500/10 text-cyan-500',
};

export default function AIStudioPage() {
  const [selected, setSelected] = useState<Agent | null>(null);
  const [logFilter, setLogFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredLogs = activityLogs.filter(l => {
    const matchesSearch = l.agent.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase());
    if (logFilter === 'all') return matchesSearch;
    return matchesSearch && l.agent === logFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">AI Studio</h2><p className="text-muted-foreground">AI-powered assistants for your luxury commerce operations</p></div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh All
          </button>
          <button className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
            <Settings className="h-3.5 w-3.5" /> Global Config
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Active Agents</p><Bot className="h-4 w-4 text-luxury-gold" /></div>
          <p className="mt-1 text-2xl font-bold">{agents.filter(a => a.status === 'active').length}<span className="text-sm text-muted-foreground ml-1">/ {agents.length}</span></p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Runs</p><Zap className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{agents.reduce((s, a) => s + a.runs, 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Avg Success Rate</p><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{(agents.reduce((s, a) => s + a.successRate, 0) / agents.length).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Tokens Used (24h)</p><Activity className="h-4 w-4 text-orange-500" /></div>
          <p className="mt-1 text-2xl font-bold">12.4k</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Agents</h3>
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <div key={agent.id} onClick={() => setSelected(agent)}
                className={`rounded-lg border bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                  selected?.id === agent.id ? 'ring-1 ring-luxury-gold' : ''
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${agentColors[agent.name]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{agent.name}</h4>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        agent.status === 'active' ? 'text-green-500 bg-green-500/10' :
                        agent.status === 'paused' ? 'text-yellow-500 bg-yellow-500/10' :
                        'text-red-500 bg-red-500/10'
                      }`}>{agent.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{agent.runs} runs</span>
                      <span>{agent.successRate}% success</span>
                      <span>{agent.avgLatency}s avg</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-muted mt-2 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${agent.successRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.status === 'active' ? (
                      <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </button>
                    ) : (
                      <button className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
                        <Play className="h-3.5 w-3.5" /> Resume
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="rounded-md bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Runs</p>
                    <p className="text-lg font-bold">{selected.runs}</p>
                  </div>
                  <div className="rounded-md bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Success</p>
                    <p className="text-lg font-bold text-green-500">{selected.successRate}%</p>
                  </div>
                  <div className="rounded-md bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Latency</p>
                    <p className="text-lg font-bold">{selected.avgLatency}s</p>
                  </div>
                  <div className="rounded-md bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Last Run</p>
                    <p className="text-sm font-bold">{selected.lastRun.split(' ')[1]}</p>
                  </div>
                </div>
                <h4 className="text-sm font-semibold mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selected.capabilities.map(c => (
                    <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{c}</span>
                  ))}
                </div>
                <h4 className="text-sm font-semibold mb-2">Recent Outputs</h4>
                <div className="space-y-2">
                  {selected.recentOutputs.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      <p>{o}</p>
                    </div>
                  ))}
                </div>
                <hr className="my-4" />
                <h4 className="text-sm font-semibold mb-2">Configuration</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-muted p-2 text-center">
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="text-sm font-medium">{selected.config.model}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2 text-center">
                    <p className="text-xs text-muted-foreground">Temperature</p>
                    <p className="text-sm font-medium">{selected.config.temperature}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2 text-center">
                    <p className="text-xs text-muted-foreground">Max Tokens</p>
                    <p className="text-sm font-medium">{selected.config.maxTokens.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border bg-card flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Bot className="h-8 w-8 mb-2" />
              <p className="text-sm">Select an agent to view details</p>
            </div>
          )}

          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Activity Log</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
                    className="rounded-md border bg-transparent py-1.5 pl-8 pr-3 text-xs outline-none focus:border-luxury-gold w-48" />
                </div>
                <select value={logFilter} onChange={e => setLogFilter(e.target.value)}
                  className="rounded-md border bg-transparent px-2 py-1.5 text-xs outline-none focus:border-luxury-gold">
                  <option value="all">All Agents</option>
                  {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {filteredLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${agentColors[log.agent]}`}>{log.agent.split(' ')[0]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{log.action}</p>
                      <span className="inline-flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3 w-3" /> {log.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Input: {log.input}</p>
                    <p className="text-xs text-muted-foreground">Output: {log.output}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>{log.latency}s</p>
                    <p>{log.tokenUsage} tok</p>
                    <p className="mt-0.5">{log.timestamp.split(' ')[1]}</p>
                  </div>
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No activity logs found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
