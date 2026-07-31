'use client';

import { useState } from 'react';
import { Users, UserPlus, TrendingUp, Star, Search, Filter, Mail, Phone, Tag } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isVip: boolean;
  totalSpent: number;
  totalOrders: number;
  lastPurchase: string;
  tags: string[];
  source: string;
  createdAt: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  score: number;
  budget: number;
  productInterest: string;
  notes: string;
  createdAt: string;
}

const customers: Customer[] = [
  { id: 'c1', firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', phone: '+1 (212) 555-0101', isVip: true, totalSpent: 185000, totalOrders: 12, lastPurchase: '2026-07-18', tags: ['VIP', 'Chanel Collector', 'Repeat Buyer'], source: 'Instagram', createdAt: '2025-03-15' },
  { id: 'c2', firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', phone: '+1 (212) 555-0102', isVip: false, totalSpent: 32000, totalOrders: 3, lastPurchase: '2026-06-20', tags: ['Watch Buyer'], source: 'Website', createdAt: '2025-09-01' },
  { id: 'c3', firstName: 'Carol', lastName: 'Davis', email: 'carol@example.com', phone: '+1 (212) 555-0103', isVip: true, totalSpent: 256000, totalOrders: 18, lastPurchase: '2026-07-19', tags: ['VIP', 'Hermès Collector', 'Referral'], source: 'Referral', createdAt: '2024-11-20' },
  { id: 'c4', firstName: 'David', lastName: 'Brown', email: 'david@example.com', phone: '+1 (212) 555-0104', isVip: false, totalSpent: 8500, totalOrders: 1, lastPurchase: '2026-05-10', tags: ['First Time'], source: 'WhatsApp', createdAt: '2026-05-10' },
  { id: 'c5', firstName: 'Eva', lastName: 'Martinez', email: 'eva@example.com', phone: '+1 (212) 555-0105', isVip: true, totalSpent: 95000, totalOrders: 7, lastPurchase: '2026-07-15', tags: ['VIP', 'Bag Collector'], source: 'Instagram', createdAt: '2025-06-01' },
  { id: 'c6', firstName: 'Frank', lastName: 'Wilson', email: 'frank@example.com', phone: '+1 (212) 555-0106', isVip: false, totalSpent: 4200, totalOrders: 2, lastPurchase: '2026-04-22', tags: ['Sunglasses'], source: 'Facebook', createdAt: '2026-01-15' },
];

const leads: Lead[] = [
  { id: 'l1', firstName: 'Grace', lastName: 'Lee', email: 'grace@example.com', phone: '+1 (212) 555-0201', source: 'Instagram', status: 'New', score: 75, budget: 15000, productInterest: 'Chanel Classic Flap', notes: 'Looking for a vintage flap bag', createdAt: '2026-07-19' },
  { id: 'l2', firstName: 'Henry', lastName: 'Kim', email: 'henry@example.com', phone: '+1 (212) 555-0202', source: 'Website', status: 'Contacted', score: 60, budget: 25000, productInterest: 'Rolex Daytona', notes: 'Prefers 2020+ model', createdAt: '2026-07-17' },
  { id: 'l3', firstName: 'Ivy', lastName: 'Chen', email: 'ivy@example.com', phone: '+1 (212) 555-0203', source: 'Referral', status: 'Qualified', score: 90, budget: 40000, productInterest: 'Hermès Birkin 30', notes: 'Serious buyer, wants to schedule viewing', createdAt: '2026-07-14' },
  { id: 'l4', firstName: 'Jack', lastName: 'Taylor', email: 'jack@example.com', phone: '+1 (212) 555-0204', source: 'WhatsApp', status: 'Negotiation', score: 85, budget: 12000, productInterest: 'Louis Vuitton Travel Set', notes: 'Negotiating price on 3 items', createdAt: '2026-07-10' },
  { id: 'l5', firstName: 'Kate', lastName: 'Adams', email: 'kate@example.com', phone: '+1 (212) 555-0205', source: 'TikTok', status: 'New', score: 40, budget: 5000, productInterest: 'Gucci Bag', notes: 'Browsing, first contact', createdAt: '2026-07-20' },
];

const leadColumns = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];

const leadColors: Record<string, string> = {
  New: 'border-l-blue-500',
  Contacted: 'border-l-yellow-500',
  Qualified: 'border-l-green-500',
  Negotiation: 'border-l-orange-500',
  Won: 'border-l-emerald-600',
  Lost: 'border-l-red-500',
};

export default function CrmPage() {
  const [tab, setTab] = useState<'customers' | 'leads'>('customers');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const totalCustomers = customers.length;
  const totalLeads = leads.length;
  const vipCount = customers.filter((c) => c.isVip).length;
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgOrderValue = totalRevenue / customers.reduce((s, c) => s + c.totalOrders, 0);

  const filteredCustomers = customers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLeads = leads.filter((l) =>
    `${l.firstName} ${l.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    l.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CRM</h2>
          <p className="text-muted-foreground">Manage customers, leads, and relationships</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border p-1">
          <button
            onClick={() => setTab('customers')}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'customers' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Customers
          </button>
          <button
            onClick={() => setTab('leads')}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'leads' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Leads ({totalLeads})
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Customers</p><Users className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-1 text-2xl font-bold">{totalCustomers}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">VIP Clients</p><Star className="h-4 w-4 text-luxury-gold" /></div>
          <p className="mt-1 text-2xl font-bold">{vipCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Active Leads</p><UserPlus className="h-4 w-4 text-blue-500" /></div>
          <p className="mt-1 text-2xl font-bold">{totalLeads}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Avg Order Value</p><TrendingUp className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(avgOrderValue)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={tab === 'customers' ? 'Search customers...' : 'Search leads...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold"
          />
        </div>
      </div>

      {tab === 'customers' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Contact</th>
                    <th className="px-4 py-3 text-right font-medium">Total Spent</th>
                    <th className="px-4 py-3 text-center font-medium">Orders</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-right font-medium">Last Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {c.firstName[0]}{c.lastName[0]}
                            {c.isVip && <Star className="absolute -top-0.5 -right-0.5 h-3 w-3 text-luxury-gold fill-luxury-gold" />}
                          </div>
                          <span className="font-medium">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs">{c.email}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.totalSpent)}</td>
                      <td className="px-4 py-3 text-center">{c.totalOrders}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.source}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(c.lastPurchase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            {selectedCustomer ? (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-medium">
                    {selectedCustomer.firstName[0]}{selectedCustomer.lastName[0]}
                    {selectedCustomer.isVip && <Star className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-luxury-gold fill-luxury-gold" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
                    <p className="text-xs text-muted-foreground">Customer since {formatDate(selectedCustomer.createdAt)}</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{selectedCustomer.email}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{selectedCustomer.phone}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Tag className="h-3.5 w-3.5" />{selectedCustomer.tags.join(', ')}</div>
                  <hr className="my-3" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Lifetime Value</span><span className="font-semibold">{formatCurrency(selectedCustomer.totalSpent)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Orders</span><span className="font-semibold">{selectedCustomer.totalOrders}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg Order</span><span className="font-semibold">{formatCurrency(selectedCustomer.totalSpent / selectedCustomer.totalOrders)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Purchase</span><span className="font-semibold">{formatDate(selectedCustomer.lastPurchase)}</span></div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                <p className="text-sm">Select a customer</p>
                <p className="text-xs">to view details</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {leadColumns.map((col) => {
            const columnLeads = filteredLeads.filter((l) => l.status === col);
            return (
              <div key={col} className="rounded-lg border bg-card">
                <div className={`border-l-4 ${leadColors[col] || 'border-l-gray-500'} px-4 py-3 border-b`}>
                  <p className="text-sm font-medium">{col}</p>
                  <p className="text-xs text-muted-foreground">{columnLeads.length} leads</p>
                </div>
                <div className="space-y-2 p-2">
                  {columnLeads.map((lead) => (
                    <div key={lead.id} className="rounded-md border p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{lead.firstName} {lead.lastName}</p>
                        <span className={`text-xs font-medium ${
                          lead.score >= 80 ? 'text-green-500' : lead.score >= 50 ? 'text-yellow-500' : 'text-muted-foreground'
                        }`}>{lead.score}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{lead.productInterest}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{lead.source}</span>
                        <span className="text-xs font-medium">{formatCurrency(lead.budget)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <button className="rounded p-1 hover:bg-muted"><Mail className="h-3 w-3" /></button>
                        <button className="rounded p-1 hover:bg-muted"><Phone className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <p className="text-xs text-center text-muted-foreground py-4">No leads</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
