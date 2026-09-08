import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

interface HeaderProps {
  onMenuClick: () => void;
}

const appName = import.meta.env.VITE_APP_NAME || 'Agency OS';

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 md:hidden"
          onClick={onMenuClick}
        >
          Menu
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Dashboard</p>
          <h1 className="text-lg font-semibold text-gray-900">{appName}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user?.name || 'Guest user'}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{user?.role || 'USER'}</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          {logout.isPending ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
