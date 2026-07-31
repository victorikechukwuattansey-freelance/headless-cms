'use client';

import { useState, useEffect } from 'react';
import { BarChart3, ShoppingBag, DollarSign, Users, TrendingUp, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const stats = [
  {
    name: 'Revenue Today',
    value: '$12,450',
    change: '+12.5%',
    changeType: 'positive',
    icon: DollarSign,
  },
  {
    name: 'Active Products',
    value: '1,234',
    change: '+3.2%',
    changeType: 'positive',
    icon: ShoppingBag,
  },
  {
    name: 'Total Customers',
    value: '456',
    change: '+8.1%',
    changeType: 'positive',
    icon: Users,
  },
  {
    name: 'Inventory Value',
    value: '$2.4M',
    change: '-2.4%',
    changeType: 'negative',
    icon: Package,
  },
];

const recentOrders = [
  { id: 'ORD-001', customer: 'Alice Johnson', product: 'Chanel Classic Flap Bag', amount: 4500, status: 'Shipped' },
  { id: 'ORD-002', customer: 'Bob Smith', product: 'Rolex Submariner', amount: 12500, status: 'Processing' },
  { id: 'ORD-003', customer: 'Carol Davis', product: 'Louis Vuitton Neverfull', amount: 2100, status: 'Pending' },
  { id: 'ORD-004', customer: 'David Brown', product: 'Hermès Kelly 28', amount: 18500, status: 'Shipped' },
  { id: 'ORD-005', customer: 'Eva Martinez', product: 'Gucci GG Marmont', amount: 1800, status: 'Delivered' },
];

const topBrands = [
  { name: 'Chanel', revenue: 125000, growth: '+15%' },
  { name: 'Hermès', revenue: 98000, growth: '+22%' },
  { name: 'Louis Vuitton', revenue: 87000, growth: '+8%' },
  { name: 'Rolex', revenue: 76000, growth: '+31%' },
  { name: 'Gucci', revenue: 54000, growth: '+5%' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="rounded-lg border bg-card p-4 card-hover">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-bold">{stat.value}</p>
              <span
                className={`text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <h3 className="font-semibold">Recent Orders</h3>
          </div>
          <div className="divide-y">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">{order.product}</p>
                  <p className="text-xs text-muted-foreground">{order.customer} • {order.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(order.amount)}</p>
                  <span className={`text-xs font-medium ${
                    order.status === 'Delivered' ? 'text-green-500' :
                    order.status === 'Shipped' ? 'text-blue-500' :
                    order.status === 'Processing' ? 'text-yellow-500' :
                    'text-muted-foreground'
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <h3 className="font-semibold">Top Performing Brands</h3>
          </div>
          <div className="divide-y">
            {topBrands.map((brand) => (
              <div key={brand.name} className="flex items-center justify-between px-6 py-3">
                <p className="text-sm font-medium">{brand.name}</p>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(brand.revenue)}</p>
                  <span className="text-xs font-medium text-green-500">{brand.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
