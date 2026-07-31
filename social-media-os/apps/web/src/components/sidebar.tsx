'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Sparkles,
  BarChart3,
  MessageCircle,
  Image,
  Palette,
  GitBranch,
  Flag,
  Settings,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Posts', href: '/posts', icon: FileText },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'AI Studio', href: '/ai-studio', icon: Sparkles },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Engagement', href: '/engagement', icon: MessageCircle },
  { label: 'Content Library', href: '/content-library', icon: Image },
  { label: 'Brand Voice', href: '/brand-voice', icon: Palette },
  { label: 'Workflows', href: '/workflows', icon: GitBranch },
  { label: 'Campaigns', href: '/campaigns', icon: Flag },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className={cn('flex items-center border-b px-4 h-14', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <div className="h-7 w-7 rounded-md bg-brand-terracotta flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span>SMO</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <div className="h-7 w-7 rounded-md bg-brand-terracotta flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={collapsed ? 'mt-2' : ''}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t p-3', collapsed && 'flex justify-center')}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              JD
            </div>
            <div className="text-xs">
              <p className="font-medium">John Doe</p>
              <p className="text-muted-foreground">Pro Plan</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            JD
          </div>
        )}
      </div>
    </aside>
  );
}
