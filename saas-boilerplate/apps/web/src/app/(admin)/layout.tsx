import { auth } from "@saas/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="bg-muted/10 w-64 space-y-1 border-r p-4">
        <div className="mb-6">
          <Link href="/admin" className="flex items-center gap-2 text-lg font-bold">
            Admin
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Dashboard
          </Link>
        </div>
        {adminNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
