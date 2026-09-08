import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CrudService } from '../lib/crudService';
import { useDebounce } from './useDebounce';

export function useCrud<T>(service: CrudService<T>, queryKey: string) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const debouncedSearch = useDebounce(search, 400);

  const list = useQuery({
    queryKey: [queryKey, page, debouncedSearch, sortBy, sortOrder],
    queryFn: () => {
      const queryParams = {
        page,
        limit: 20,
        search: debouncedSearch,
        sortOrder,
        ...(sortBy ? { sortBy } : {}),
      };

      return service.getAll(queryParams);
    },
  });

  const create = useMutation({
    mutationFn: service.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) => service.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const remove = useMutation({
    mutationFn: service.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  return {
    data: list.data?.items ?? [],
    total: list.data?.total ?? 0,
    totalPages: list.data?.totalPages ?? 1,
    loading: list.isLoading,
    page,
    setPage,
    search,
    setSearch,
    onSort: (key: string, order: 'asc' | 'desc') => {
      setSortBy(key);
      setSortOrder(order);
    },
    create,
    update,
    remove,
  };
}
