import { useState } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns, data, loading, onSort, onRowClick, rowActions, emptyMessage = 'No records found'
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    const order = sort?.key === key && sort.order === 'asc' ? 'desc' : 'asc';
    setSort({ key, order });
    onSort?.(key, order);
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left font-medium text-gray-600"
                  style={{ width: col.width }}
                >
                  {col.sortable ? (
                    <button
                      className="flex items-center gap-1 hover:text-gray-900"
                      onClick={() => handleSort(String(col.key))}
                    >
                      {col.header}
                      {sort?.key === col.key
                        ? sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        : <ChevronDown size={14} className="opacity-30" />}
                    </button>
                  ) : col.header}
                </th>
              ))}
              {rowActions && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-12">
                <Loader2 className="animate-spin mx-auto text-gray-400" />
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-12 text-gray-400">
                {emptyMessage}
              </td></tr>
            ) : data.map((row) => (
              <tr
                key={row.id}
                className={`bg-white hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-3 text-gray-700">
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
