'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  UserCircle,
  DollarSign,
  Shield,
  Truck,
  Brain,
  Settings,
  BarChart3,
  Megaphone,
  Layers,
  Zap,
  Bell,
  MessageSquare,
  Shirt,
  LogOut,
  Search,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: ShoppingBag },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'CRM', href: '/crm', icon: Users },
  { name: 'Sales', href: '/sales', icon: DollarSign },
  { name: 'Authentication', href: '/authentication', icon: Shield },
  { name: 'Suppliers', href: '/suppliers', icon: Truck },
  { name: 'AI Studio', href: '/ai-studio', icon: Brain },
  { name: 'Automation', href: '/automation', icon: Zap },
  { name: 'Marketing', href: '/marketing', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Assets', href: '/assets', icon: Layers },
  { name: 'Integrations', href: '/integrations', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Shirt className="h-6 w-6 text-luxury-gold" />
        <span className="font-display text-xl font-bold tracking-tight">LCOS</span>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-md border bg-muted py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-20">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t bg-card p-4">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
