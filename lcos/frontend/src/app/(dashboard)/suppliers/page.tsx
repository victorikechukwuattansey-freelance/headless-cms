'use client';

import { useState } from 'react';
import { Truck, Globe, Star, Package, Search, Plus, Phone, Mail, MapPin, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  specialties: string[];
  reliabilityScore: number;
  avgShippingDays: number;
  totalProducts: number;
  totalSpent: number;
  lastOrder: string;
  status: string;
  notes: string;
}

interface PurchaseRecord {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  date: string;
  status: string;
}

const suppliers: Supplier[] = [
  { id: 's1', name: 'Luxe Europe SAS', contactName: 'Pierre Dubois', email: 'pierre@luxeeurope.com', phone: '+33 1 42 68 00 01', country: 'France', city: 'Paris', specialties: ['Chanel', 'Hermès', 'Louis Vuitton'], reliabilityScore: 98, avgShippingDays: 5, totalProducts: 47, totalSpent: 425000, lastOrder: '2026-07-18', status: 'Active', notes: 'Premium partner. Consistent high-quality inventory. Net 30 terms.' },
  { id: 's2', name: 'Tokyo Vintage Co.', contactName: 'Yuki Tanaka', email: 'yuki@tokyovintage.jp', phone: '+81 3 6234 1001', country: 'Japan', city: 'Tokyo', specialties: ['Rolex', 'Cartier', 'Hermès'], reliabilityScore: 95, avgShippingDays: 7, totalProducts: 32, totalSpent: 312000, lastOrder: '2026-07-15', status: 'Active', notes: 'Excellent watch sourcing. DHL Express shipping.' },
  { id: 's3', name: 'Miami Luxury Hub', contactName: 'Carlos Rivera', email: 'carlos@miamiluxury.com', phone: '+1 (305) 555-0142', country: 'USA', city: 'Miami', specialties: ['Gucci', 'Prada', 'Saint Laurent'], reliabilityScore: 88, avgShippingDays: 4, totalProducts: 28, totalSpent: 189000, lastOrder: '2026-07-10', status: 'Active', notes: 'Good for contemporary luxury. Prefers wire transfer.' },
  { id: 's4', name: 'Milan Elite Goods', contactName: 'Marco Rossi', email: 'marco@milanelite.it', phone: '+39 02 8765 4321', country: 'Italy', city: 'Milan', specialties: ['Prada', 'Gucci', 'Bottega Veneta'], reliabilityScore: 92, avgShippingDays: 6, totalProducts: 19, totalSpent: 156000, lastOrder: '2026-07-08', status: 'Active', notes: 'Italian leather goods specialist. Seasonal collections.' },
  { id: 's5', name: 'Dubai Prestige Traders', contactName: 'Ahmed Al-Rashid', email: 'ahmed@dubaiprestige.ae', phone: '+971 4 567 8901', country: 'UAE', city: 'Dubai', specialties: ['Rolex', 'Audemars Piguet', 'Richard Mille'], reliabilityScore: 78, avgShippingDays: 10, totalProducts: 15, totalSpent: 420000, lastOrder: '2026-06-28', status: 'Active', notes: 'High-value watches. Longer shipping times but competitive pricing.' },
  { id: 's6', name: 'London Estate Sales', contactName: 'Emily Watson', email: 'emily@londonestate.co.uk', phone: '+44 20 7946 0123', country: 'UK', city: 'London', specialties: ['Hermès', 'Chanel', 'Cartier'], reliabilityScore: 72, avgShippingDays: 8, totalProducts: 11, totalSpent: 89000, lastOrder: '2026-06-15', status: 'Inactive', notes: 'Estate sale sourcing. Inconsistent availability.' },
];

const purchases: PurchaseRecord[] = [
  { id: 'p1', productName: 'Classic Flap Bag', sku: 'CH-001', quantity: 1, unitCost: 6200, totalCost: 6200, date: '2026-07-10', status: 'Received' },
  { id: 'p2', productName: 'Submariner Date', sku: 'RL-001', quantity: 1, unitCost: 9800, totalCost: 9800, date: '2026-07-05', status: 'Received' },
  { id: 'p3', productName: 'Kelly 28', sku: 'HE-001', quantity: 1, unitCost: 16500, totalCost: 16500, date: '2026-07-01', status: 'Received' },
  { id: 'p4', productName: 'Lady Dior Bag', sku: 'DI-001', quantity: 2, unitCost: 3800, totalCost: 7600, date: '2026-07-12', status: 'Shipped' },
  { id: 'p5', productName: 'Tank Française', sku: 'CA-001', quantity: 1, unitCost: 2600, totalCost: 2600, date: '2026-06-20', status: 'Pending' },
];

const scoreColor = (score: number) =>
  score >= 90 ? 'text-green-500' : score >= 75 ? 'text-yellow-500' : 'text-orange-500';

const scoreBgColor = (score: number) =>
  score >= 90 ? 'bg-green-500/10' : score >= 75 ? 'bg-yellow-500/10' : 'bg-orange-500/10';

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.country.toLowerCase().includes(search.toLowerCase()) ||
    s.specialties.join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Suppliers</h2><p className="text-muted-foreground">Manage sourcing partners and supplier relationships</p></div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Supplier
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Suppliers</p><Truck className="h-4 w-4" /></div>
          <p className="mt-1 text-2xl font-bold">{suppliers.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Active Partners</p><Star className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{suppliers.filter(s => s.status === 'Active').length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Countries</p><Globe className="h-4 w-4 text-blue-500" /></div>
          <p className="mt-1 text-2xl font-bold">{new Set(suppliers.map(s => s.country)).size}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Spent</p><TrendingUp className="h-4 w-4 text-luxury-gold" /></div>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(suppliers.reduce((s, su) => s + su.totalSpent, 0))}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {filtered.map((supplier) => (
            <div key={supplier.id} onClick={() => setSelected(supplier)}
              className={`rounded-lg border bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                selected?.id === supplier.id ? 'ring-1 ring-luxury-gold' : ''
              }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {supplier.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{supplier.name}</h3>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        supplier.status === 'Active' ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground bg-muted'
                      }`}>{supplier.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{supplier.contactName}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.city}, {supplier.country}</span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{supplier.totalProducts} products</span>
                      <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{supplier.avgShippingDays} days avg</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {supplier.specialties.map((sp) => (
                        <span key={sp} className="rounded-full bg-muted px-2 py-0.5 text-xs">{sp}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Star className={`h-3.5 w-3.5 ${supplier.reliabilityScore >= 90 ? 'text-green-500 fill-green-500' : scoreColor(supplier.reliabilityScore)}`} />
                    <span className={`font-bold text-lg ${scoreColor(supplier.reliabilityScore)}`}>{supplier.reliabilityScore}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Reliability</p>
                  <p className="text-sm font-medium mt-1">{formatCurrency(supplier.totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">total spent</p>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No suppliers found</div>
          )}
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-lg border bg-card p-5">
                <h3 className="font-semibold mb-3">Contact</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{selected.email}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{selected.phone}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{selected.city}, {selected.country}</div>
                </div>
                <hr className="my-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Products Sourced</span><span className="font-medium">{selected.totalProducts}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Spent</span><span className="font-medium">{formatCurrency(selected.totalSpent)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg Shipping</span><span className="font-medium">{selected.avgShippingDays} days</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Order</span><span className="font-medium">{formatDate(selected.lastOrder)}</span></div>
                </div>
                <hr className="my-3" />
                <p className="text-xs text-muted-foreground">{selected.notes}</p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <h3 className="font-semibold mb-3">Recent Purchases</h3>
                <div className="space-y-2">
                  {purchases.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <div><p className="font-medium text-xs">{p.productName}</p><p className="text-xs text-muted-foreground">{p.sku} x{p.quantity}</p></div>
                      <div className="text-right"><p className="text-xs font-medium">{formatCurrency(p.totalCost)}</p><p className="text-xs text-muted-foreground">{formatDate(p.date)}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border bg-card flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Truck className="h-8 w-8 mb-2" />
              <p className="text-sm">Select a supplier</p>
              <p className="text-xs">to view details</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Supplier</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Company Name</label>
                  <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="Company name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Name</label>
                  <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Country</label>
                  <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="Country" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="email@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="+1 (555) 000-0000" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">Add Supplier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
