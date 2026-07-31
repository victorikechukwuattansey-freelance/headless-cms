'use client';

import { useState } from 'react';
import { Package, AlertTriangle, TrendingDown, Truck, Search, Filter, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface InventoryItem {
  id: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  quantity: number;
  location: string;
  status: string;
  sellingPrice: number;
  totalCost: number;
  lastMovement: string;
  daysInStock: number;
}

interface MovementLog {
  id: string;
  productName: string;
  sku: string;
  type: string;
  from: string;
  to: string;
  qty: number;
  user: string;
  date: string;
}

const items: InventoryItem[] = [
  { id: '1', productName: 'Classic Flap Bag', sku: 'CH-001', brand: 'Chanel', category: 'Bags', quantity: 2, location: 'Vault A', status: 'Available', sellingPrice: 8500, totalCost: 6200, lastMovement: '2026-07-18', daysInStock: 45 },
  { id: '2', productName: 'Submariner Date', sku: 'RL-001', brand: 'Rolex', category: 'Watches', quantity: 1, location: 'Vault B', status: 'Available', sellingPrice: 14500, totalCost: 9800, lastMovement: '2026-07-17', daysInStock: 23 },
  { id: '3', productName: 'Neverfull MM', sku: 'LV-001', brand: 'Louis Vuitton', category: 'Bags', quantity: 3, location: 'Shelf 4', status: 'Available', sellingPrice: 1800, totalCost: 1100, lastMovement: '2026-07-15', daysInStock: 67 },
  { id: '4', productName: 'Kelly 28', sku: 'HE-001', brand: 'Hermès', category: 'Bags', quantity: 1, location: 'Vault A', status: 'Reserved', sellingPrice: 22000, totalCost: 16500, lastMovement: '2026-07-19', daysInStock: 12 },
  { id: '5', productName: 'GG Marmont', sku: 'GU-001', brand: 'Gucci', category: 'Bags', quantity: 0, location: 'Shelf 2', status: 'Sold', sellingPrice: 1200, totalCost: 750, lastMovement: '2026-07-10', daysInStock: 89 },
  { id: '6', productName: 'Wayfarer Sunglasses', sku: 'RB-001', brand: 'Ray-Ban', category: 'Sunglasses', quantity: 5, location: 'Shelf 1', status: 'Available', sellingPrice: 250, totalCost: 120, lastMovement: '2026-07-14', daysInStock: 30 },
  { id: '7', productName: 'Lady Dior Bag', sku: 'DI-001', brand: 'Dior', category: 'Bags', quantity: 0, location: 'Incoming', status: 'Incoming', sellingPrice: 5200, totalCost: 3800, lastMovement: '2026-07-20', daysInStock: 0 },
  { id: '8', productName: 'Tank Française', sku: 'CA-001', brand: 'Cartier', category: 'Watches', quantity: 1, location: 'Vault B', status: 'Damaged', sellingPrice: 3800, totalCost: 2600, lastMovement: '2026-07-08', daysInStock: 120 },
];

const movements: MovementLog[] = [
  { id: 'm1', productName: 'Kelly 28', sku: 'HE-001', type: 'Reserved', from: 'Available', to: 'Reserved', qty: 1, user: 'Sarah J.', date: '2026-07-19' },
  { id: 'm2', productName: 'Classic Flap Bag', sku: 'CH-001', type: 'Received', from: 'Incoming', to: 'Available', qty: 1, user: 'Mike R.', date: '2026-07-18' },
  { id: 'm3', productName: 'Lady Dior Bag', sku: 'DI-001', type: 'Shipped', from: 'Ordered', to: 'Incoming', qty: 1, user: 'System', date: '2026-07-17' },
  { id: 'm4', productName: 'Submariner Date', sku: 'RL-001', type: 'Received', from: 'Incoming', to: 'Available', qty: 1, user: 'Mike R.', date: '2026-07-17' },
  { id: 'm5', productName: 'GG Marmont', sku: 'GU-001', type: 'Sold', from: 'Available', to: 'Sold', qty: 1, user: 'Sarah J.', date: '2026-07-10' },
  { id: 'm6', productName: 'Tank Française', sku: 'CA-001', type: 'Damaged', from: 'Available', to: 'Damaged', qty: 1, user: 'Mike R.', date: '2026-07-08' },
];

const statusColors: Record<string, string> = {
  Available: 'text-green-500 bg-green-500/10',
  Reserved: 'text-blue-500 bg-blue-500/10',
  Sold: 'text-gray-500 bg-gray-500/10',
  Incoming: 'text-yellow-500 bg-yellow-500/10',
  Damaged: 'text-red-500 bg-red-500/10',
  Returned: 'text-orange-500 bg-orange-500/10',
  Lost: 'text-red-500 bg-red-500/10',
};

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAdjust, setShowAdjust] = useState<string | null>(null);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.sellingPrice, 0);
  const totalCost = items.reduce((s, i) => s + i.quantity * i.totalCost, 0);
  const lowStock = items.filter((i) => i.quantity > 0 && i.quantity <= 2).length;
  const pendingIncoming = items.filter((i) => i.status === 'Incoming').length;

  const filtered = items.filter((i) => {
    const matchSearch = i.productName.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
          <p className="text-muted-foreground">{totalItems} units across {items.length} products</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Filter className="h-4 w-4" />
            Export
          </button>
          <button className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
            <Plus className="h-4 w-4" />
            Add Stock
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total Units</p>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-2xl font-bold">{totalItems}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Inventory Value</p>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </div>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted-foreground">Cost: {formatCurrency(totalCost)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Low Stock Items</p>
            <AlertTriangle className={`h-4 w-4 ${lowStock > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </div>
          <p className="mt-1 text-2xl font-bold">{lowStock}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Incoming</p>
            <Truck className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="mt-1 text-2xl font-bold">{pendingIncoming}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold"
          />
        </div>
        <div className="flex gap-1 rounded-md border p-1">
          {['All', 'Available', 'Reserved', 'Sold', 'Incoming', 'Damaged'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-center font-medium">Qty</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Sell Price</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Days</th>
                <th className="px-4 py-3 text-right font-medium">Last Movement</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{item.brand[0]}</div>
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.brand} / {item.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.sku}</td>
                  <td className={`px-4 py-3 text-center font-bold text-lg ${
                    item.quantity <= 1 && item.quantity > 0 ? 'text-red-500' :
                    item.quantity === 0 ? 'text-muted-foreground' : ''
                  }`}>{item.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{item.location}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.status] || ''}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.sellingPrice)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.totalCost)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.daysInStock > 0 ? `${item.daysInStock}d` : '-'}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(item.lastMovement)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setShowAdjust(showAdjust === item.id ? null : item.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <h3 className="font-semibold">Stock Movement Log</h3>
        </div>
        <div className="divide-y">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${
                  m.type === 'Sold' ? 'bg-red-500' :
                  m.type === 'Received' ? 'bg-green-500' :
                  m.type === 'Reserved' ? 'bg-blue-500' :
                  m.type === 'Damaged' ? 'bg-orange-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <p className="text-sm font-medium">{m.productName} <span className="text-muted-foreground font-normal">- {m.type}</span></p>
                  <p className="text-xs text-muted-foreground">{m.from} → {m.to} • {m.user}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">x{m.qty}</span>
                <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
