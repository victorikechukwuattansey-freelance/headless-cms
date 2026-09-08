import { useState, useCallback } from 'react';
import { apiClient } from '@agency-os/shared/service/client';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (
    method: HttpMethod,
    url: string,
    payload?: unknown,
  ) => {
    setLoading(true);
    setError(null);

    try {
      let result: T;

      switch (method) {
        case 'get':
          result = await apiClient.get<T>(url, isRecord(payload) ? payload : undefined);
          break;
        case 'post':
          result = await apiClient.post<T>(url, payload);
          break;
        case 'put':
          result = await apiClient.put<T>(url, payload);
          break;
        case 'patch':
          result = await apiClient.patch<T>(url, payload);
          break;
        case 'delete':
          result = await apiClient.delete<T>(url);
          break;
      }

      setData(result);
      return result;
    } catch (err) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof err.message === 'string'
          ? err.message
          : 'Something went wrong';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}
