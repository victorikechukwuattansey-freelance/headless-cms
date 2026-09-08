// apps/web/src/components/PageShell.tsx
import type { ReactNode } from 'react';

interface Props {
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageShell({ title, description, children }: Props) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}