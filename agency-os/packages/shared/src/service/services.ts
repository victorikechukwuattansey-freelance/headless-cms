import { apiClient } from './client.js';
import type { AuthTokens, LoginCredentials, SignupCredentials, User } from '../types/api.ts';

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<{ user: User; tokens: AuthTokens }>('/auth/login', credentials),

  register: ({ confirmPassword, ...payload }: SignupCredentials) =>
    apiClient.post<User>('/auth/register', payload),

  logout: (refreshToken?: string) => apiClient.post<null>('/auth/logout', { refreshToken }),

  verifyEmail: (token: string) =>
    apiClient.get<null>(`/auth/verify-email/${encodeURIComponent(token)}`),

  refreshToken: (refreshToken: string) =>
    apiClient.post<{ user: User; tokens: AuthTokens }>('/auth/refresh', { refreshToken }),

  forgotPassword: (email: string) => apiClient.post<null>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiClient.post<null>('/auth/reset-password', { token, password }),
};
