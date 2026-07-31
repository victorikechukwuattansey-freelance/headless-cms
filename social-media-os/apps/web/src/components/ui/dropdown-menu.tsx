import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, onOpenChange] = React.useState(false);
  return <DropdownMenuContext.Provider value={{ open, onOpenChange }}>{children}</DropdownMenuContext.Provider>;
}

function DropdownMenuTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownMenuContext);
  return (
    <button onClick={() => context?.onOpenChange(!context?.open)} {...props}>
      {children}
    </button>
  );
}

function DropdownMenuContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(DropdownMenuContext);
  if (!context?.open) return null;

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'absolute right-0 z-50 mt-2 min-w-[12rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
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

function DropdownMenuItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />;
}

function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel };
