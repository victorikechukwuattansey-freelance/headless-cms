import { auth } from "@saas/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminNav, AdminNavSheet } from "@/components/layout/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-4 lg:hidden">
          <AdminNavSheet />
          <Link href="/admin" className="text-lg font-bold">
            Admin
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
