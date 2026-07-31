'use client';

import { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock, Search, Filter, Eye, FileText, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface AuthItem {
  id: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  serialNumber: string;
  status: string;
  method: string;
  riskScore: number;
  submittedBy: string;
  submittedAt: string;
  completedAt: string | null;
  certificateNumber: string;
  notes: string;
}

const items: AuthItem[] = [
  { id: 'a1', productName: 'Classic Flap Bag', sku: 'CH-001', brand: 'Chanel', category: 'Bags', serialNumber: 'CH-28471', status: 'Authentic', method: 'Entrupy', riskScore: 5, submittedBy: 'Mike R.', submittedAt: '2026-07-19', completedAt: '2026-07-19', certificateNumber: 'ENT-2026-4821', notes: 'All markers verified. Date stamp matches.' },
  { id: 'a2', productName: 'Submariner Date', sku: 'RL-001', brand: 'Rolex', category: 'Watches', serialNumber: 'RL-93847', status: 'In Progress', method: 'Manual', riskScore: 25, submittedBy: 'Sarah J.', submittedAt: '2026-07-18', completedAt: null, certificateNumber: '', notes: 'Waiting for movement photos' },
  { id: 'a3', productName: 'Neverfull MM', sku: 'LV-001', brand: 'Louis Vuitton', category: 'Bags', serialNumber: 'LV-56291', status: 'Pending', method: 'Legit App', riskScore: 15, submittedBy: 'Mike R.', submittedAt: '2026-07-17', completedAt: null, certificateNumber: '', notes: 'Photos uploaded, awaiting analysis' },
  { id: 'a4', productName: 'Kelly 28', sku: 'HE-001', brand: 'Hermès', category: 'Bags', serialNumber: 'HE-17365', status: 'Authentic', method: 'Entrupy', riskScore: 2, submittedBy: 'Sarah J.', submittedAt: '2026-07-16', completedAt: '2026-07-16', certificateNumber: 'ENT-2026-4788', notes: 'Blind stamp verified. Craftsmanship consistent.' },
  { id: 'a5', productName: 'GG Marmont Matelassé', sku: 'GU-001', brand: 'Gucci', category: 'Bags', serialNumber: 'GU-38472', status: 'Counterfeit', method: 'Entrupy', riskScore: 92, submittedBy: 'Mike R.', submittedAt: '2026-07-15', completedAt: '2026-07-15', certificateNumber: '', notes: 'Hardware quality inconsistent. Interior stamp misaligned.' },
  { id: 'a6', productName: 'Lady Dior Bag', sku: 'DI-001', brand: 'Dior', category: 'Bags', serialNumber: 'DI-28491', status: 'Pending', method: 'Manual', riskScore: 10, submittedBy: 'Sarah J.', submittedAt: '2026-07-14', completedAt: null, certificateNumber: '', notes: 'Awaiting receipt upload' },
  { id: 'a7', productName: 'Tank Française', sku: 'CA-001', brand: 'Cartier', category: 'Watches', serialNumber: 'CA-73641', status: 'Expert Review', method: 'Manual', riskScore: 45, submittedBy: 'Mike R.', submittedAt: '2026-07-13', completedAt: null, certificateNumber: '', notes: 'Movement needs expert assessment' },
  { id: 'a8', productName: 'Wayfarer Sunglasses', sku: 'RB-001', brand: 'Ray-Ban', category: 'Sunglasses', serialNumber: 'RB-91827', status: 'Authentic', method: 'Manual', riskScore: 3, submittedBy: 'Sarah J.', submittedAt: '2026-07-12', completedAt: '2026-07-12', certificateNumber: 'MAN-2026-1123', notes: 'Visual inspection passed' },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  Authentic: { label: 'Authentic', color: 'text-green-500 bg-green-500/10', icon: CheckCircle },
  Counterfeit: { label: 'Counterfeit', color: 'text-red-500 bg-red-500/10', icon: XCircle },
  Pending: { label: 'Pending', color: 'text-yellow-500 bg-yellow-500/10', icon: Clock },
  'In Progress': { label: 'In Progress', color: 'text-blue-500 bg-blue-500/10', icon: AlertTriangle },
  'Expert Review': { label: 'Expert Review', color: 'text-orange-500 bg-orange-500/10', icon: Eye },
};

export default function AuthenticationPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState<AuthItem | null>(null);
  const [tab, setTab] = useState<'queue' | 'certificates'>('queue');
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const pending = items.filter((i) => i.status === 'Pending' || i.status === 'In Progress');
  const authentic = items.filter((i) => i.status === 'Authentic');
  const counterfeit = items.filter((i) => i.status === 'Counterfeit');

  const filtered = items.filter((i) => {
    const matchesSearch = i.productName.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      i.serialNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewReport = () => {
    if (selected) showToast(`Opening auth report for ${selected.productName}...`);
  };

  const handleDownloadCert = (e: React.MouseEvent, item?: AuthItem) => {
    e.stopPropagation();
    const target = item || selected;
    if (target) showToast(`Downloading certificate for ${target.productName}...`);
  };

  const handleRequestCert = () => {
    showToast('Certificate request submitted');
  };

  const handleEyeClick = (e: React.MouseEvent, item: AuthItem) => {
    e.stopPropagation();
    setSelected(item);
    showToast(`Selected: ${item.productName} — ${item.status}`, 'info');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
        }`}>{toast.message}</div>
      )}

      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Authentication</h2><p className="text-muted-foreground">Product authentication and certificate management</p></div>
        <button onClick={() => { setShowNewRequest(true); showToast('Opening new authentication request...', 'info'); }}
          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
          <Shield className="h-4 w-4" /> New Request
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Pending Review</p><Clock className="h-4 w-4 text-yellow-500" /></div>
          <p className="mt-1 text-2xl font-bold">{pending.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Authenticated</p><CheckCircle className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{authentic.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Counterfeit Detected</p><XCircle className="h-4 w-4 text-red-500" /></div>
          <p className="mt-1 text-2xl font-bold">{counterfeit.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Authenticity Rate</p><Shield className="h-4 w-4 text-blue-500" /></div>
          <p className="mt-1 text-2xl font-bold">{items.length > 0 ? Math.round(authentic.length / items.length * 100) : 0}%</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border p-1 w-fit">
        <button onClick={() => { setTab('queue'); showToast('Viewing auth queue', 'info'); }}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'queue' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>Auth Queue ({items.length})</button>
        <button onClick={() => { setTab('certificates'); showToast('Viewing certificates', 'info'); }}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'certificates' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>Certificates</button>
      </div>

      {tab === 'queue' ? (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search by product, SKU, or serial..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold" />
            </div>
            <div className="flex gap-1 rounded-md border p-1">
              {['All', 'Pending', 'In Progress', 'Expert Review', 'Authentic', 'Counterfeit'].map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); showToast(`Filter: ${s}`, 'info'); }}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-left font-medium">Serial #</th>
                      <th className="px-4 py-3 text-center font-medium">Method</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                      <th className="px-4 py-3 text-center font-medium">Risk</th>
                      <th className="px-4 py-3 text-left font-medium">Submitted By</th>
                      <th className="px-4 py-3 text-right font-medium">Date</th>
                      <th className="w-8 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const cfg = statusConfig[item.status];
                      return (
                        <tr key={item.id} onClick={() => { setSelected(item); showToast(`Selected: ${item.productName}`, 'info'); }}
                          className={`border-b transition-colors cursor-pointer ${selected?.id === item.id ? 'bg-luxury-gold/5' : 'hover:bg-muted/30'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{item.brand[0]}</div>
                              <div><p className="font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.brand} · {item.sku}</p></div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.serialNumber}</td>
                          <td className="px-4 py-3 text-center text-xs">{item.method}</td>
                          <td className="px-4 py-3 text-center">
                            {cfg && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                                <cfg.icon className="h-3 w-3" />{cfg.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold ${
                              item.riskScore >= 70 ? 'text-red-500' :
                              item.riskScore >= 30 ? 'text-yellow-500' : 'text-green-500'
                            }`}>{item.riskScore}%</span>
                          </td>
                          <td className="px-4 py-3 text-xs">{item.submittedBy}</td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(item.submittedAt)}</td>
                          <td className="px-4 py-3">
                            <button onClick={(e) => handleEyeClick(e, item)} className="rounded p-1 hover:bg-muted transition-colors" title="View details">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border bg-card">
              {selected ? (
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      selected.status === 'Authentic' ? 'bg-green-500/10' :
                      selected.status === 'Counterfeit' ? 'bg-red-500/10' :
                      selected.status === 'Pending' ? 'bg-yellow-500/10' : 'bg-blue-500/10'
                    }`}>
                      {selected.status === 'Authentic' ? <CheckCircle className="h-5 w-5 text-green-500" /> :
                       selected.status === 'Counterfeit' ? <XCircle className="h-5 w-5 text-red-500" /> :
                       <Clock className="h-5 w-5 text-yellow-500" />}
                    </div>
                    <div><h3 className="font-semibold">{selected.productName}</h3><p className="text-xs text-muted-foreground">{selected.sku}</p></div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Serial Number</span><span className="font-mono text-xs">{selected.serialNumber}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Brand</span><span>{selected.brand}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{selected.category}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{selected.method}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Risk Score</span>
                      <span className={`font-bold ${
                        selected.riskScore >= 70 ? 'text-red-500' :
                        selected.riskScore >= 30 ? 'text-yellow-500' : 'text-green-500'
                      }`}>{selected.riskScore}%</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span>{formatDate(selected.submittedAt)}</span></div>
                    {selected.completedAt && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{formatDate(selected.completedAt)}</span></div>}
                    {selected.certificateNumber && <div className="flex justify-between"><span className="text-muted-foreground">Certificate</span><span className="font-mono text-xs text-blue-500">{selected.certificateNumber}</span></div>}
                  </div>

                  <hr className="my-3" />
                  <p className="text-xs font-medium mb-1">Notes</p>
                  <p className="text-xs text-muted-foreground">{selected.notes}</p>

                  <div className="mt-4 flex gap-2">
                    <button onClick={handleViewReport}
                      className="flex-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors">View Report</button>
                    <button onClick={(e) => handleDownloadCert(e)}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1">
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Shield className="h-8 w-8 mb-2" />
                  <p className="text-sm">Select an item</p>
                  <p className="text-xs">to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h3 className="font-semibold">Authentication Certificates</h3>
            <button onClick={handleRequestCert}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
              <FileText className="h-3.5 w-3.5" /> Request Certificate
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Certificate #</th>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Brand</th>
                  <th className="px-4 py-3 text-left font-medium">Issued By</th>
                  <th className="px-4 py-3 text-center font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Issue Date</th>
                  <th className="px-4 py-3 text-right font-medium">Expiry</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="w-8 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.filter(i => i.certificateNumber).map((item) => (
                  <tr key={item.id} onClick={() => { setSelected(item); setTab('queue'); showToast(`Viewing ${item.productName}`, 'info'); }}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-blue-500 font-medium">{item.certificateNumber}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.sku}</p></td>
                    <td className="px-4 py-3">{item.brand}</td>
                    <td className="px-4 py-3 text-xs">{item.method}</td>
                    <td className="px-4 py-3 text-center text-xs">{item.method === 'Entrupy' ? 'Digital' : 'Manual'}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{item.completedAt ? formatDate(item.completedAt) : '-'}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">-</td>
                    <td className="px-4 py-3 text-center"><span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-green-500 bg-green-500/10">Active</span></td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => handleDownloadCert(e, item)} className="rounded p-1 hover:bg-muted transition-colors" title="Download certificate">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.filter(i => i.certificateNumber).length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No certificates issued yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewRequest(false)}>
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Authentication Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="Product name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Brand</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                    <option>Chanel</option><option>Rolex</option><option>Louis Vuitton</option><option>Hermès</option><option>Gucci</option><option>Dior</option><option>Cartier</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                    <option>Bags</option><option>Watches</option><option>Jewelry</option><option>Sunglasses</option><option>Accessories</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serial Number</label>
                <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold font-mono" placeholder="e.g. CH-28471" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Authentication Method</label>
                <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                  <option>Entrupy</option><option>Manual</option><option>Legit App</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowNewRequest(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => { showToast('Authentication request created'); setShowNewRequest(false); }}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
