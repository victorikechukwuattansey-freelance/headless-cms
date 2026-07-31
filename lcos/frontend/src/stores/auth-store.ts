import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  avatar?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logo?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, tenant: Tenant) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenant: null,
      isAuthenticated: false,
      setAuth: (token, user, tenant) => {
        localStorage.setItem('lcos_token', token);
        localStorage.setItem('lcos_tenant_id', tenant.id);
        set({ token, user, tenant, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('lcos_token');
        localStorage.removeItem('lcos_tenant_id');
        set({ token: null, user: null, tenant: null, isAuthenticated: false });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'lcos-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
