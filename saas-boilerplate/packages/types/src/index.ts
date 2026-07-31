export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

export interface SearchParams {
  query: string;
  fields?: string[];
}

export interface DateRangeParams {
  from: Date;
  to: Date;
}

export type AsyncReturnType<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : never;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export type ActionState<T = void> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
};
