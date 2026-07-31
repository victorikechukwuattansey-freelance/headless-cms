import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ToastProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning';
  onClose?: () => void;
  className?: string;
}

const variantStyles = {
  default: 'bg-background border',
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100',
};

function Toast({ children, variant = 'default', onClose, className }: ToastProps) {
  return (
    <div
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between space-x-2 rounded-md border p-4 shadow-lg',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-50 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export { Toast };
