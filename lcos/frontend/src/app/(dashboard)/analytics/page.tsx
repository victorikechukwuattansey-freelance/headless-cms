'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Users, ShoppingCart, Eye, Calendar, Download, RefreshCw, ArrowUpRight, ArrowDownRight, Filter, ChevronDown, Clock, Target, Zap, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface KPI {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: any;
  color: string;
}

interface ChartBar {
  label: string;
  value: number;
  color?: string;
}

interface TopProduct {
  name: string;
  sku: string;
  sold: number;
  revenue: number;
  margin: number;
  trend: number;
}

interface RevenueByCategory {
  category: string;
  revenue: number;
  percentage: number;
  color: string;
}

interface TrafficSource {
  source: string;
  visitors: number;
  conversions: number;
  rate: number;
  color: string;
}

interface CustomerMetric {
  label: string;
  value: string;
  change: number;
}

const kpis: KPI[] = [
  { label: 'Total Revenue', value: '$284,320', change: 18.2, changeLabel: 'vs last month', icon: DollarSign, color: 'text-green-500' },
  { label: 'Orders', value: '1,247', change: 12.5, changeLabel: 'vs last month', icon: ShoppingCart, color: 'text-blue-500' },
  { label: 'Avg Order Value', value: '$228', change: 5.1, changeLabel: 'vs last month', icon: Target, color: 'text-purple-500' },
  { label: 'Conversion Rate', value: '3.8%', change: 0.4, changeLabel: 'vs last month', icon: Zap, color: 'text-luxury-gold' },
];

const revenueData: ChartBar[] = [
  { label: 'Jan', value: 142 }, { label: 'Feb', value: 168 }, { label: 'Mar', value: 195 },
  { label: 'Apr', value: 210 }, { label: 'May', value: 248 }, { label: 'Jun', value: 262 },
  { label: 'Jul', value: 284 },
];

const ordersData: ChartBar[] = [
  { label: 'Jan', value: 89 }, { label: 'Feb', value: 102 }, { label: 'Mar', value: 118 },
  { label: 'Apr', value: 125 }, { label: 'May', value: 141 }, { label: 'Jun', value: 138 },
  { label: 'Jul', value: 147 },
];

const topProducts: TopProduct[] = [
  { name: 'Hermès Birkin 25', sku: 'HE-001', sold: 34, revenue: 221000, margin: 42, trend: 12 },
  { name: 'Rolex Submariner', sku: 'RL-001', sold: 28, revenue: 186400, margin: 38, trend: 8 },
  { name: 'Chanel Classic Flap', sku: 'CH-001', sold: 45, revenue: 162000, margin: 45, trend: 15 },
  { name: 'Louis Vuitton Neverfull', sku: 'LV-001', sold: 62, revenue: 93000, margin: 35, trend: -3 },
  { name: 'Cartier Tank Française', sku: 'CA-001', sold: 18, revenue: 76500, margin: 33, trend: 22 },
  { name: 'Prada Re-Nylon Bag', sku: 'PR-001', sold: 38, revenue: 57000, margin: 40, trend: 6 },
];

const categoryData: RevenueByCategory[] = [
  { category: 'Handbags', revenue: 142000, percentage: 50, color: 'bg-purple-500' },
  { category: 'Watches', revenue: 85200, percentage: 30, color: 'bg-blue-500' },
  { category: 'Jewelry', revenue: 28400, percentage: 10, color: 'bg-emerald-500' },
  { category: 'Ready-to-Wear', revenue: 17040, percentage: 6, color: 'bg-orange-500' },
  { category: 'Accessories', revenue: 11680, percentage: 4, color: 'bg-pink-500' },
];

const trafficSources: TrafficSource[] = [
  { source: 'Organic Search', visitors: 12400, conversions: 420, rate: 3.4, color: 'bg-green-500' },
  { source: 'Paid Search', visitors: 8200, conversions: 310, rate: 3.8, color: 'bg-blue-500' },
  { source: 'Social Media', visitors: 6800, conversions: 180, rate: 2.6, color: 'bg-pink-500' },
  { source: 'Email', visitors: 4200, conversions: 210, rate: 5.0, color: 'bg-purple-500' },
  { source: 'Direct', visitors: 3100, conversions: 155, rate: 5.0, color: 'bg-foreground' },
  { source: 'Referral', visitors: 2300, conversions: 92, rate: 4.0, color: 'bg-orange-500' },
];

const customerMetrics: CustomerMetric[] = [
  { label: 'New Customers', value: '342', change: 14.2 },
  { label: 'Returning Customers', value: '68%', change: 3.1 },
  { label: 'Avg Customer LTV', value: '$4,280', change: 8.5 },
  { label: 'Churn Rate', value: '2.1%', change: -0.4 },
  { label: 'NPS Score', value: '72', change: 5 },
  { label: 'Avg Days Between Purchases', value: '34', change: -2.3 },
];

const weeklyRevenue = [
  { day: 'Mon', value: 42800 }, { day: 'Tue', value: 38200 }, { day: 'Wed', value: 45600 },
  { day: 'Thu', value: 41200 }, { day: 'Fri', value: 48900 }, { day: 'Sat', value: 39800 }, { day: 'Sun', value: 27800 },
];

const maxRevenue = Math.max(...revenueData.map(d => d.value));
const maxOrders = Math.max(...ordersData.map(d => d.value));
const maxWeekly = Math.max(...weeklyRevenue.map(d => d.value));
const maxCat = Math.max(...categoryData.map(d => d.revenue));
const maxTraffic = Math.max(...trafficSources.map(d => d.visitors));

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [compareMode, setCompareMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedBar, setSelectedBar] = useState<{ chart: string; index: number } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRefresh = () => {
    setLoading(true);
    showToast('Refreshing analytics data...', 'info');
    setTimeout(() => {
      setLoading(false);
      showToast('Analytics data refreshed');
    }, 1500);
  };

  const handleExport = (format: string) => {
    setShowExportMenu(false);
    showToast(`Exporting report as ${format.toUpperCase()}...`);
    setTimeout(() => showToast(`Report exported as ${format.toUpperCase()}`), 2000);
  };

  const handleBarClick = (chart: string, index: number, label: string, value: number) => {
    setSelectedBar(selectedBar?.chart === chart && selectedBar.index === index ? null : { chart, index });
    showToast(`${chart}: ${label} — ${chart === 'Revenue' ? formatCurrency(value * 1000) : value + ' orders'}`, 'info');
  };

  const handleProductClick = (sku: string) => {
    setSelectedProduct(selectedProduct === sku ? null : sku);
    const p = topProducts.find(tp => tp.sku === sku);
    if (p) showToast(`Selected: ${p.name} — ${formatCurrency(p.revenue)} revenue`);
  };

  const handleSourceClick = (source: string) => {
    setSelectedSource(selectedSource === source ? null : source);
    const s = trafficSources.find(ts => ts.source === source);
    if (s) showToast(`${s.source}: ${s.visitors.toLocaleString()} visitors, ${s.rate}% conversion`);
  };

  const handleInsightClick = (index: number) => {
    setSelectedInsight(selectedInsight === index ? null : index);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
    const c = categoryData.find(cd => cd.category === category);
    if (c) showToast(`${c.category}: ${formatCurrency(c.revenue)} (${c.percentage}% of total)`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Analytics</h2><p className="text-muted-foreground">Business insights, reports, and performance tracking</p></div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border bg-card p-0.5">
            {['7d', '30d', '90d', '12m'].map(r => (
              <button key={r} onClick={() => { setDateRange(r); showToast(`Date range: ${r}`, 'info'); }}
                className={`px-3 py-1 text-xs font-medium rounded capitalize transition-colors ${dateRange === r ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{r}</button>
            ))}
          </div>
          <button onClick={() => { setCompareMode(!compareMode); showToast(compareMode ? 'Comparison off' : 'Comparison on — showing previous period', 'info'); }}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${compareMode ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>
            <BarChart3 className="h-3 w-3" /> Compare
          </button>
          <button onClick={handleRefresh} disabled={loading}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Loading...' : 'Refresh'}
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors">
              <Download className="h-3 w-3" /> Export <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 rounded-md border bg-card shadow-lg z-50 py-1">
                  {['CSV', 'PDF', 'Excel'].map(f => (
                    <button key={f} onClick={() => handleExport(f)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">{f}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {kpi.change >= 0 ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                <span className={`text-xs font-medium ${kpi.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {kpi.change >= 0 ? '+' : ''}{kpi.change}%
                </span>
                <span className="text-xs text-muted-foreground">{kpi.changeLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Revenue Trend</h3>
            <span className="text-xs text-muted-foreground">Last 7 months (in $k)</span>
          </div>
          <div className="flex items-end gap-2 h-48">
            {revenueData.map((d, i) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleBarClick('Revenue', i, d.label, d.value)}>
                <span className="text-[10px] text-muted-foreground">${d.value}k</span>
                <div className={`w-full rounded-t transition-all ${selectedBar?.chart === 'Revenue' && selectedBar.index === i ? 'bg-luxury-gold' : 'bg-foreground/80 hover:bg-luxury-gold'}`}
                  style={{ height: `${(d.value / maxRevenue) * 160}px` }} />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
          {compareMode && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">vs Previous Period</p>
              <div className="flex items-end gap-2 h-24">
                {revenueData.map((d, i) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-muted transition-all"
                      style={{ height: `${((d.value * 0.82) / maxRevenue) * 80}px` }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Orders Trend</h3>
            <span className="text-xs text-muted-foreground">Last 7 months</span>
          </div>
          <div className="flex items-end gap-2 h-48">
            {ordersData.map((d, i) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleBarClick('Orders', i, d.label, d.value)}>
                <span className="text-[10px] text-muted-foreground">{d.value}</span>
                <div className={`w-full rounded-t transition-all ${selectedBar?.chart === 'Orders' && selectedBar.index === i ? 'bg-blue-500' : 'bg-blue-500/70 hover:bg-blue-500'}`}
                  style={{ height: `${(d.value / maxOrders) * 160}px` }} />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Revenue by Category</h3>
          </div>
          <div className="space-y-3">
            {categoryData.map(cat => (
              <div key={cat.category} className="cursor-pointer" onClick={() => handleCategoryClick(cat.category)}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={selectedCategory === cat.category ? 'font-semibold' : ''}>{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(cat.revenue)}</span>
                    <span className="text-xs text-muted-foreground">{cat.percentage}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${cat.color} transition-all ${selectedCategory === cat.category ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`} style={{ width: `${cat.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total</span>
              <span className="font-bold">{formatCurrency(categoryData.reduce((s, c) => s + c.revenue, 0))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Weekly Revenue</h3>
            <span className="text-xs text-muted-foreground">This week</span>
          </div>
          <div className="flex items-end gap-2 h-36">
            {weeklyRevenue.map((d, i) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleBarClick('Weekly', i, d.day, d.value)}>
                <span className="text-[10px] text-muted-foreground">${(d.value / 1000).toFixed(1)}k</span>
                <div className={`w-full rounded-t transition-all ${selectedBar?.chart === 'Weekly' && selectedBar.index === i ? 'bg-emerald-500' : 'bg-emerald-500/70 hover:bg-emerald-500'}`}
                  style={{ height: `${(d.value / maxWeekly) * 120}px` }} />
                <span className="text-xs text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Weekly Total</span>
              <span className="font-bold">{formatCurrency(weeklyRevenue.reduce((s, d) => s + d.value, 0))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Traffic Sources</h3>
          </div>
          <div className="space-y-2.5">
            {trafficSources.map(src => (
              <div key={src.source} onClick={() => handleSourceClick(src.source)}
                className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors ${
                  selectedSource === src.source ? 'bg-muted' : 'hover:bg-muted/50'
                }`}>
                <div className={`h-2.5 w-2.5 rounded-full ${src.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{src.source}</span>
                    <span className="font-medium shrink-0">{src.visitors.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{src.conversions} conversions</span>
                    <span>{src.rate}% rate</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-semibold">Top Products</h3>
          <span className="text-xs text-muted-foreground">Ranked by revenue</span>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-t bg-muted/50">
            <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
            <th className="text-left p-3 font-medium text-muted-foreground">SKU</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Units Sold</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Revenue</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Margin</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Trend</th>
          </tr></thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={p.sku} onClick={() => handleProductClick(p.sku)}
                className={`border-t last:border-0 transition-colors cursor-pointer ${
                  selectedProduct === p.sku ? 'bg-luxury-gold/5' : 'hover:bg-muted/30'
                }`}>
                <td className="p-3 font-medium flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  {p.name}
                </td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                <td className="p-3 text-right">{p.sold}</td>
                <td className="p-3 text-right font-medium">{formatCurrency(p.revenue)}</td>
                <td className="p-3 text-right">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.margin >= 40 ? 'text-green-500 bg-green-500/10' : p.margin >= 35 ? 'text-yellow-500 bg-yellow-500/10' : 'text-orange-500 bg-orange-500/10'}`}>
                    {p.margin}%
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span className={`flex items-center justify-end gap-1 text-xs font-medium ${p.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {p.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {p.trend >= 0 ? '+' : ''}{p.trend}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Customer Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            {customerMetrics.map(m => (
              <div key={m.label} className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold mt-0.5">{m.value}</p>
                <span className={`text-xs font-medium ${m.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {m.change >= 0 ? '+' : ''}{m.change}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Insights</h3>
          <div className="space-y-3">
            {[
              { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10', title: 'Revenue up 18% MoM', desc: 'Hermès and Rolex driving growth — both categories above 35% margin.' },
              { icon: Target, color: 'text-luxury-gold', bg: 'bg-luxury-gold/10', title: 'Email campaigns highest converting', desc: '5.0% conversion rate vs. 3.4% organic search. Increase email cadence.' },
              { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', title: 'LV Neverfull trend declining', desc: 'Down 3% — consider bundling or promotional pricing to clear inventory.' },
              { icon: Zap, color: 'text-blue-500', bg: 'bg-blue-500/10', title: 'Tuesday 2pm = peak conversion', desc: 'Schedule email sends and social posts around this window for maximum impact.' },
            ].map((insight, i) => {
              const Icon = insight.icon;
              return (
                <div key={i} onClick={() => handleInsightClick(i)}
                  className={`flex items-start gap-3 rounded-md border p-3 transition-colors cursor-pointer ${
                    selectedInsight === i ? 'bg-muted' : 'hover:bg-muted/30'
                  }`}>
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${insight.bg}`}>
                    <Icon className={`h-4 w-4 ${insight.color}`} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


