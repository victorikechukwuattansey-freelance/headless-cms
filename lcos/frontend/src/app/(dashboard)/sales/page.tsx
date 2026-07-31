'use client';

import { useState } from 'react';
import { DollarSign, FileText, ShoppingCart, TrendingUp, Search, Plus, Download, Eye, Send, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Quote {
  id: string; number: string; customer: string; email: string; items: number; subtotal: number; total: number; status: string; validUntil: string; createdAt: string;
}
interface Order {
  id: string; number: string; customer: string; email: string; items: number; total: number; profit: number; status: string; payment: string; createdAt: string;
}
interface Invoice {
  id: string; number: string; customer: string; email: string; total: number; amountPaid: number; amountDue: number; status: string; dueDate: string; createdAt: string;
}

const quotes: Quote[] = [
  { id: 'q1', number: 'QTE-001', customer: 'Alice Johnson', email: 'alice@example.com', items: 2, subtotal: 23000, total: 23000, status: 'Approved', validUntil: '2026-08-15', createdAt: '2026-07-18' },
  { id: 'q2', number: 'QTE-002', customer: 'Henry Kim', email: 'henry@example.com', items: 1, subtotal: 25000, total: 25000, status: 'Sent', validUntil: '2026-08-10', createdAt: '2026-07-16' },
  { id: 'q3', number: 'QTE-003', customer: 'Ivy Chen', email: 'ivy@example.com', items: 1, subtotal: 40000, total: 40000, status: 'Draft', validUntil: '2026-08-20', createdAt: '2026-07-14' },
  { id: 'q4', number: 'QTE-004', customer: 'David Brown', email: 'david@example.com', items: 3, subtotal: 9800, total: 8820, status: 'Negotiating', validUntil: '2026-08-05', createdAt: '2026-07-12' },
  { id: 'q5', number: 'QTE-005', customer: 'Grace Lee', email: 'grace@example.com', items: 1, subtotal: 15000, total: 15000, status: 'Draft', validUntil: '2026-08-25', createdAt: '2026-07-19' },
];

const orders: Order[] = [
  { id: 'o1', number: 'ORD-001', customer: 'Alice Johnson', email: 'alice@example.com', items: 2, total: 23000, profit: 5800, status: 'Shipped', payment: 'Paid', createdAt: '2026-07-18' },
  { id: 'o2', number: 'ORD-002', customer: 'Bob Smith', email: 'bob@example.com', items: 1, total: 14500, profit: 4700, status: 'Processing', payment: 'Paid', createdAt: '2026-07-15' },
  { id: 'o3', number: 'ORD-003', customer: 'Carol Davis', email: 'carol@example.com', items: 1, total: 22000, profit: 5500, status: 'Pending', payment: 'Pending', createdAt: '2026-07-14' },
  { id: 'o4', number: 'ORD-004', customer: 'Eva Martinez', email: 'eva@example.com', items: 3, total: 4500, profit: 1200, status: 'Delivered', payment: 'Paid', createdAt: '2026-07-10' },
  { id: 'o5', number: 'ORD-005', customer: 'David Brown', email: 'david@example.com', items: 1, total: 1800, profit: 600, status: 'Cancelled', payment: 'Refunded', createdAt: '2026-07-08' },
];

const invoices: Invoice[] = [
  { id: 'i1', number: 'INV-001', customer: 'Alice Johnson', email: 'alice@example.com', total: 23000, amountPaid: 23000, amountDue: 0, status: 'Paid', dueDate: '2026-08-01', createdAt: '2026-07-18' },
  { id: 'i2', number: 'INV-002', customer: 'Bob Smith', email: 'bob@example.com', total: 14500, amountPaid: 14500, amountDue: 0, status: 'Paid', dueDate: '2026-08-01', createdAt: '2026-07-15' },
  { id: 'i3', number: 'INV-003', customer: 'Carol Davis', email: 'carol@example.com', total: 22000, amountPaid: 5000, amountDue: 17000, status: 'Partially Paid', dueDate: '2026-08-05', createdAt: '2026-07-14' },
  { id: 'i4', number: 'INV-004', customer: 'Eva Martinez', email: 'eva@example.com', total: 4500, amountPaid: 4500, amountDue: 0, status: 'Paid', dueDate: '2026-07-25', createdAt: '2026-07-10' },
  { id: 'i5', number: 'INV-005', customer: 'Charles Wilson', email: 'charles@example.com', total: 8700, amountPaid: 0, amountDue: 8700, status: 'Overdue', dueDate: '2026-07-01', createdAt: '2026-06-15' },
];

const statusStyles: Record<string, string> = {
  Approved: 'text-green-500 bg-green-500/10', Sent: 'text-blue-500 bg-blue-500/10', Draft: 'text-yellow-500 bg-yellow-500/10', Negotiating: 'text-orange-500 bg-orange-500/10',
  Shipped: 'text-blue-500 bg-blue-500/10', Processing: 'text-yellow-500 bg-yellow-500/10', Pending: 'text-muted-foreground bg-muted/50', Delivered: 'text-green-500 bg-green-500/10', Cancelled: 'text-red-500 bg-red-500/10',
  Paid: 'text-green-500 bg-green-500/10', 'Partially Paid': 'text-yellow-500 bg-yellow-500/10', Overdue: 'text-red-500 bg-red-500/10', Refunded: 'text-muted-foreground bg-muted/50',
};

export default function SalesPage() {
  const [tab, setTab] = useState<'quotes' | 'orders' | 'invoices'>('orders');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalRevenue = orders.filter(o => o.payment === 'Paid').reduce((s, o) => s + o.total, 0);
  const totalProfit = orders.filter(o => o.payment === 'Paid').reduce((s, o) => s + o.profit, 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue').length;

  const activeTab = tab;
  const data = activeTab === 'quotes' ? quotes : activeTab === 'orders' ? orders : invoices;

  const filtered = data.filter((item: any) =>
    item.customer.toLowerCase().includes(search.toLowerCase()) ||
    item.number.toLowerCase().includes(search.toLowerCase())
  );

  const handleRowClick = (id: string) => {
    setSelectedRow(selectedRow === id ? null : id);
  };

  const handleDownload = (e: React.MouseEvent, number: string) => {
    e.stopPropagation();
    showToast(`Downloading ${number}...`);
    setTimeout(() => showToast(`${number} downloaded`), 1500);
  };

  const handleViewDetail = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setShowDetailModal(id);
    showToast(`Opening ${id}...`, 'info');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
        }`}>{toast.message}</div>
      )}

      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Sales</h2><p className="text-muted-foreground">Quotes, orders, and invoices</p></div>
        <button onClick={() => { setShowNewModal(true); showToast(`Creating new ${tab.slice(0, -1)}...`, 'info'); }}
          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
          <Plus className="h-4 w-4" /> New {tab === 'quotes' ? 'Quote' : tab === 'orders' ? 'Order' : 'Invoice'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Revenue</p><DollarSign className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Profit</p><TrendingUp className="h-4 w-4 text-blue-500" /></div>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalProfit)}</p>
          <p className="text-xs text-muted-foreground">Margin: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Pending Orders</p><ShoppingCart className="h-4 w-4 text-yellow-500" /></div>
          <p className="mt-1 text-2xl font-bold">{pendingOrders}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Overdue Invoices</p><FileText className="h-4 w-4 text-red-500" /></div>
          <p className="mt-1 text-2xl font-bold">{overdueInvoices}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-md border p-1">
          {(['quotes', 'orders', 'invoices'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setSelectedRow(null); showToast(`Switched to ${t}`, 'info'); }}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >{t} ({t === 'quotes' ? quotes.length : t === 'orders' ? orders.length : invoices.length})</button>
          ))}
        </div>
        <div className="relative max-w-md flex-1 ml-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder={`Search ${tab}...`} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {activeTab === 'quotes' && (
                  <><th className="px-4 py-3 text-left font-medium">Quote</th><th className="px-4 py-3 text-left font-medium">Customer</th><th className="px-4 py-3 text-center font-medium">Items</th><th className="px-4 py-3 text-right font-medium">Subtotal</th><th className="px-4 py-3 text-right font-medium">Total</th><th className="px-4 py-3 text-center font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Valid Until</th><th className="px-4 py-3 text-right font-medium">Created</th></>
                )}
                {activeTab === 'orders' && (
                  <><th className="px-4 py-3 text-left font-medium">Order</th><th className="px-4 py-3 text-left font-medium">Customer</th><th className="px-4 py-3 text-center font-medium">Items</th><th className="px-4 py-3 text-right font-medium">Total</th><th className="px-4 py-3 text-right font-medium">Profit</th><th className="px-4 py-3 text-center font-medium">Status</th><th className="px-4 py-3 text-center font-medium">Payment</th><th className="px-4 py-3 text-right font-medium">Created</th></>
                )}
                {activeTab === 'invoices' && (
                  <><th className="px-4 py-3 text-left font-medium">Invoice</th><th className="px-4 py-3 text-left font-medium">Customer</th><th className="px-4 py-3 text-right font-medium">Total</th><th className="px-4 py-3 text-right font-medium">Paid</th><th className="px-4 py-3 text-right font-medium">Due</th><th className="px-4 py-3 text-center font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Due Date</th><th className="px-4 py-3 text-right font-medium">Created</th></>
                )}
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => (
                <tr key={item.id} onClick={() => handleRowClick(item.id)}
                  className={`border-b transition-colors cursor-pointer ${selectedRow === item.id ? 'bg-luxury-gold/5' : 'hover:bg-muted/30'}`}>
                  {activeTab === 'quotes' && (
                    <><td className="px-4 py-3 font-mono text-xs font-medium">{item.number}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.customer}</p><p className="text-xs text-muted-foreground">{item.email}</p></td>
                    <td className="px-4 py-3 text-center">{item.items}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.subtotal)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[item.status] || ''}`}>{item.status}</span></td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(item.validUntil)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(item.createdAt)}</td></>
                  )}
                  {activeTab === 'orders' && (
                    <><td className="px-4 py-3 font-mono text-xs font-medium">{item.number}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.customer}</p><p className="text-xs text-muted-foreground">{item.email}</p></td>
                    <td className="px-4 py-3 text-center">{item.items}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${item.profit > 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(item.profit)}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[item.status] || ''}`}>{item.status}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[item.payment] || ''}`}>{item.payment}</span></td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(item.createdAt)}</td></>
                  )}
                  {activeTab === 'invoices' && (
                    <><td className="px-4 py-3 font-mono text-xs font-medium">{item.number}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.customer}</p><p className="text-xs text-muted-foreground">{item.email}</p></td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3 text-right text-green-500">{formatCurrency(item.amountPaid)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${item.amountDue > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{formatCurrency(item.amountDue)}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[item.status] || ''}`}>{item.status}</span></td>
                    <td className={`px-4 py-3 text-right text-xs ${item.status === 'Overdue' ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{formatDate(item.dueDate)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(item.createdAt)}</td></>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => handleViewDetail(e, item.id)} className="rounded p-1 hover:bg-muted transition-colors" title="View details">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => handleDownload(e, item.number)} className="rounded p-1 hover:bg-muted transition-colors" title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No {tab} found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDetailModal(null)}>
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{showDetailModal}</h3>
            <p className="text-sm text-muted-foreground mb-4">Detailed view coming soon. This {tab.slice(0, -1)} is ready for API integration.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDetailModal(null)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Close</button>
              <button onClick={() => { showToast(`${showDetailModal} sent to printer`); setShowDetailModal(null); }}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors flex items-center gap-2">
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewModal(false)}>
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New {tab === 'quotes' ? 'Quote' : tab === 'orders' ? 'Order' : 'Invoice'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer</label>
                <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="Customer name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="customer@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Items</label>
                <textarea className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold h-20 resize-none" placeholder="Add line items..." />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowNewModal(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => { showToast(`${tab.slice(0, -1)} created`); setShowNewModal(false); }}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
                Create {tab === 'quotes' ? 'Quote' : tab === 'orders' ? 'Order' : 'Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
