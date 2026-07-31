'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AIGeneration, ApiResponse } from '@social-media-os/shared';

interface GenerateContentInput {
  prompt: string;
  platform?: string;
  action: string;
  format: string;
  brandVoiceId?: string;
  provider?: string;
  model?: string;
}

interface AISuggestion {
  id: string;
  type: 'content' | 'hashtag' | 'caption' | 'timing';
  title: string;
  description: string;
  content: string;
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: (input: GenerateContentInput) =>
      api.post<ApiResponse<AIGeneration>>('/ai/generate', input),
  });
}

export function useAISuggestions() {
  return useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: () => api.get<ApiResponse<AISuggestion[]>>('/ai/suggestions'),
  });
}

export function useRepurposeContent() {
  return useMutation({
    mutationFn: (input: { content: string; sourcePlatform: string; targetPlatforms: string[] }) =>
      api.post<ApiResponse<Record<string, string>>>('/ai/repurpose', input),
  });
}

export function useAnalyzeContent() {
  return useMutation({
    mutationFn: (input: { content: string }) =>
      api.post<ApiResponse<{ score: number; suggestions: string[]; sentiment: string }>>('/ai/analyze', input),
  });
}

export function useGenerationHistory(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['ai-history', params],
    queryFn: () => api.get<ApiResponse<AIGeneration[]>>('/ai/history', { params }),
  });
}
