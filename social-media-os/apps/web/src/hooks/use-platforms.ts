'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SocialAccount, ApiResponse } from '@social-media-os/shared';
import { listPlatforms } from '@social-media-os/shared';

export function usePlatforms() {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: () => api.get<ApiResponse<SocialAccount[]>>('/platforms/accounts'),
  });
}

export function useConnectPlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform: string) =>
      api.post<ApiResponse<{ authUrl: string }>>(`/platforms/${platform}/connect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
  });
}

export function useDisconnectPlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      api.delete<ApiResponse<void>>(`/platforms/accounts/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
  });
}

export function useAvailablePlatforms() {
  return listPlatforms();
}
