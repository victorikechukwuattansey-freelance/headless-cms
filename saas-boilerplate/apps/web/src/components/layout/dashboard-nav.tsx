"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@saas/utils";
import { Button } from "@saas/ui/components/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@saas/ui/components/sheet";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Users,
  Bell,
  Key,
  BarChart3,
  LifeBuoy,
  Menu,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/team", label: "Team", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function DashboardNav() {
  return (
    <aside className="bg-muted/10 hidden w-64 shrink-0 flex-col border-r p-4 lg:flex">
      <nav className="flex flex-col gap-1">
        <NavLinks />
      </nav>
    </aside>
  );
}

export function DashboardNavSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-full flex-col">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-b px-6 py-5 text-lg font-bold"
          >
            SaaS
          </Link>
          <nav className="flex flex-col gap-1 p-4" onClick={() => setOpen(false)}>
            <NavLinks />
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
