import * as React from 'react';
import { cn } from '@/lib/utils';

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function Popover({ children }: { children: React.ReactNode }) {
  const [open, onOpenChange] = React.useState(false);
  return <PopoverContext.Provider value={{ open, onOpenChange }}>{children}</PopoverContext.Provider>;
}

function PopoverTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(PopoverContext);
  return <button onClick={() => context?.onOpenChange(!context?.open)} {...props}>{children}</button>;
}

function PopoverContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(PopoverContext);
  if (!context?.open) return null;

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'absolute z-50 mt-2 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
          className
        )}
        onClick={() => context.onOpenChange(false)}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
