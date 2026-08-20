import { type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
  ghost: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}