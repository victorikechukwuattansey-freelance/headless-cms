import { apiClient } from '@agency-os/shared/service/client';
import type { PaginationParams, PaginatedResult } from '@agency-os/shared/types/api';

export interface CrudService<T, CreateDto = Partial<T>, UpdateDto = Partial<T>> {
  getAll: (params?: PaginationParams) => Promise<PaginatedResult<T>>;
  getById: (id: string) => Promise<T>;
  create: (data: CreateDto) => Promise<T>;
  update: (id: string, data: UpdateDto) => Promise<T>;
  delete: (id: string) => Promise<null>;
  bulkDelete: (ids: string[]) => Promise<null>;
}

export function createCrudService<T, CreateDto = Partial<T>, UpdateDto = Partial<T>>(
  resource: string,
): CrudService<T, CreateDto, UpdateDto> {
  return {
    getAll: (params) => apiClient.get(`/${resource}`, params),
    getById: (id) => apiClient.get(`/${resource}/${id}`),
    create: (data) => apiClient.post(`/${resource}`, data),
    update: (id, data) => apiClient.patch(`/${resource}/${id}`, data),
    delete: (id) => apiClient.delete(`/${resource}/${id}`),
    bulkDelete: (ids) => apiClient.delete(`/${resource}/bulk`, { ids }),
  };
}
