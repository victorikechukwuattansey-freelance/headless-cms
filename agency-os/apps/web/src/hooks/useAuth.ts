import { useMutation } from '@tanstack/react-query';
import { authApi } from '@agency-os/shared/service/services';
import type { SignupCredentials } from '@agency-os/shared/types/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';


export function useSignup() {
  return useMutation({
    mutationFn: (payload: SignupCredentials) => authApi.register(payload),
  });
}

export function useLogin() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      login(credentials.email, credentials.password),
    onSuccess: () => {
      navigate('/dashboard');
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      navigate('/login');
    },
  });
}
