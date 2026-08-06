"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@saas/utils";
import { Button } from "@saas/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@saas/ui/components/sheet";
import {
  Users,
  CreditCard,
  Receipt,
  Flag,
  ScrollText,
  Tag,
  Megaphone,
  Mail,
  ArrowLeft,
  Menu,
} from "lucide-react";

const adminNav = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/email-broadcast", label: "Email Broadcast", icon: Mail },
];

function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {adminNav.map((item) => {
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

function AdminBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="mb-6">
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2 text-lg font-bold"
      >
        Admin
      </Link>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Dashboard
      </Link>
    </div>
  );
}

export function AdminNav() {
  return (
    <aside className="bg-muted/10 hidden w-64 shrink-0 flex-col border-r p-4 lg:flex">
      <AdminBrand />
      <nav className="flex flex-col gap-1">
        <AdminNavLinks />
      </nav>
    </aside>
  );
}

export function AdminNavSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open admin navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <AdminBrand onNavigate={() => setOpen(false)} />
          </div>
          <nav className="flex flex-col gap-1 p-4" onClick={() => setOpen(false)}>
            <AdminNavLinks />
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
