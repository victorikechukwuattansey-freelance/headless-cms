import {
  BarChart3,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  badge?: string;
}

export const navItems: NavItem[] = [
  { label: 'Overview',   href: '/dashboard',            icon: LayoutDashboard },
  { label: 'Analytics',  href: '/dashboard/analytics',  icon: BarChart3 },
  { label: 'Users',      href: '/dashboard/users',      icon: Users },
  { label: 'Settings',   href: '/dashboard/settings',   icon: Settings },
  { label: 'Admin',      href: '/admin',                icon: Shield,  roles: ['ADMIN'] },
];
