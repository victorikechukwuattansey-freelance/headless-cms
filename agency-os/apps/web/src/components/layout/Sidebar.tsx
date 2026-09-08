import { NavLink, type NavLinkRenderProps } from 'react-router-dom';
import { navItems } from './nav.config';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const appName = import.meta.env.VITE_APP_NAME || 'Agency OS';

export function Sidebar({ isOpen }: { isOpen: boolean; onClose: () => void }) {
  const role = useAuthStore((state) => state.user?.role);
  const filtered = navItems.filter((item) => !item.roles || item.roles.includes(role || ''));

  return (
    <aside
      className={cn(
        'flex w-64 flex-col border-r border-gray-200 bg-white transition-all duration-300',
        !isOpen && '-ml-64',
      )}
    >
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-xl">{appName}</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filtered.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }: NavLinkRenderProps) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
