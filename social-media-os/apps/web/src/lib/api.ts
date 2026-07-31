const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  async get<T>(path: string, options?: ApiOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'GET',
      headers: getHeaders(),
      ...options,
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, data?: unknown, options?: ApiOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'POST',
      headers: getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, data?: unknown, options?: ApiOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'PUT',
      headers: getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, data?: unknown, options?: ApiOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'PATCH',
      headers: getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string, options?: ApiOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'DELETE',
      headers: getHeaders(),
      ...options,
    });
    return handleResponse<T>(response);
  },
};
