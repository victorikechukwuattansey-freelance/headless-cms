import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError, ApiResponse } from '../types/api.ts';

const API_BASE = 'http://localhost:5000/api';

class ApiClientError extends Error implements ApiError {
  status: number;
  code: string;
  details?: unknown;

  constructor({ status, code, message, details }: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>) => {
        const apiError: ApiError = {
          status: error.response?.status || 500,
          code: error.response?.data?.error?.code?? "UNKNOWN_ERROR",
          message: error.response?.data?.error?.message || error.message || 'An error occurred',
          details: error.response?.data?.error?.details,
        };

        return Promise.reject(new ApiClientError(apiError));
      },
    );
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }

    return null;
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  async delete<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, { data });
    return response.data.data;
  }
}

export const apiClient = new ApiClient();
