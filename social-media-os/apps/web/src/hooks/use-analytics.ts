'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AnalyticsMetric, ApiResponse } from '@social-media-os/shared';

interface AnalyticsSummary {
  totalPosts: number;
  totalEngagement: number;
  totalImpressions: number;
  followerGrowth: number;
  metricsByPlatform: Record<string, AnalyticsMetric[]>;
  topPosts: Array<{ id: string; content: string; engagement: number }>;
  engagementRate: number;
}

export function useAnalytics(params?: { platform?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => api.get<ApiResponse<AnalyticsSummary>>('/analytics/summary', { params }),
  });
}

export function useAnalyticsMetrics(params?: { platform?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['analytics-metrics', params],
    queryFn: () => api.get<ApiResponse<AnalyticsMetric[]>>('/analytics/metrics', { params }),
  });
}

export function useAnalyticsComparison(params?: { startDate: string; endDate: string; compareStart: string; compareEnd: string }) {
  return useQuery({
    queryKey: ['analytics-comparison', params],
    queryFn: () => api.get<ApiResponse<{
      current: AnalyticsSummary;
      previous: AnalyticsSummary;
    }>>('/analytics/compare', { params }),
  });
}
