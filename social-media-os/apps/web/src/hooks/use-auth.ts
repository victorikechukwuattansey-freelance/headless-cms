'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const result = await signIn('credentials', {
        email: input.email,
        password: input.password,
        redirect: false,
      });
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      router.push('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const response = await api.post<{ success: boolean }>('/auth/register', input);
      return response;
    },
    onSuccess: () => {
      router.push('/login');
    },
  });

  const logout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const loginWithOAuth = async (provider: 'google' | 'github') => {
    await signIn(provider, { callbackUrl: '/dashboard' });
  };

  return {
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    loginWithOAuth,
    logout,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}
