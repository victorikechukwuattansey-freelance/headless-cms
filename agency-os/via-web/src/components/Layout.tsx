import { useAuth } from "../context/AuthContext";
import { Link, useLocation } from "wouter";
import { Role, useHealthCheck } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Users, 
  User as UserIcon, 
  LogOut,
  ShieldHalf,
  Menu,
  X,
  Server
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { RoleBadge } from "./RoleBadge";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: healthData, isError: isHealthError } = useHealthCheck();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: [Role.USER, Role.AGENT, Role.ADMIN] },
    { name: "Users", href: "/users", icon: Users, roles: [Role.ADMIN] },
    { name: "Profile", href: "/profile", icon: UserIcon, roles: [Role.USER, Role.AGENT, Role.ADMIN] },
  ];

  if (!user) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 z-50 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2 text-white">
          <ShieldHalf className="h-6 w-6 text-orange-500" />
          <span className="font-bold tracking-tight text-lg">ACCESS_CTRL</span>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex h-full flex-col flex-1">
          <div className="hidden lg:flex h-16 items-center gap-2 px-6 bg-slate-950/50 border-b border-white/5">
            <ShieldHalf className="h-6 w-6 text-orange-500" />
            <span className="font-bold tracking-tight text-lg text-white">ACCESS_CTRL</span>
          </div>

          <div className="p-4 bg-slate-900/50 lg:bg-transparent mt-16 lg:mt-0">
            <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-white font-medium uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-white">{user.name}</span>
                <span className="truncate text-xs text-slate-500">{user.email}</span>
              </div>
            </div>
            <div className="mt-3 px-2">
              <RoleBadge role={user.role} />
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              if (!item.roles.includes(user.role)) return null;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors
                    ${isActive 
                      ? "bg-orange-500/10 text-orange-500" 
                      : "hover:bg-white/5 hover:text-white"
                    }
                  `}
                >
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-orange-500" : "text-slate-500 group-hover:text-slate-300"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 bg-black/20 rounded-md">
              <Server className="h-3 w-3" />
              <span>System:</span>
              {isHealthError ? (
                <span className="text-red-400 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400"></span> Offline</span>
              ) : healthData ? (
                <span className="text-teal-400 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal-400"></span> {healthData.status}</span>
              ) : (
                <span className="text-slate-400">Checking...</span>
              )}
            </div>

            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5"
              onClick={() => logout()}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto lg:pt-0 pt-16">
        <div className="h-full p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
