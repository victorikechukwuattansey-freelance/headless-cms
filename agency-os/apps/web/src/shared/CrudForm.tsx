import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import type { DefaultValues } from 'react-hook-form';
import type { ZodSchema } from 'zod';

interface Props<T> {
  schema: ZodSchema;
  defaultValues?: Partial<T>;
  onSubmit: (data: T) => void;
  children: ReactNode;
  loading?: boolean;
}

export function CrudForm<T extends Record<string, unknown>>({
  schema, defaultValues, onSubmit, children, loading
}: Props<T>) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
     ...(defaultValues && {
    defaultValue: defaultValues
  })
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        {children}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </form>
    </FormProvider>
  );
}
