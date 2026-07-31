import * as React from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface CommandProps {
  children: React.ReactNode;
  className?: string;
}

function Command({ children, className }: CommandProps) {
  return (
    <div className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)}>
      {children}
    </div>
  );
}

function CommandInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center border-b px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <input
        className={cn(
          'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('max-h-72 overflow-y-auto overflow-x-hidden', className)} {...props} />;
}

function CommandEmpty({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="py-6 text-center text-sm text-muted-foreground" {...props}>{children || 'No results found.'}</div>;
}

function CommandGroup({ className, heading, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { heading?: string }) {
  return (
    <div className={cn('overflow-hidden p-1', className)} {...props}>
      {heading && <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</div>}
      {children}
    </div>
  );
}

function CommandItem({ className, onSelect, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
        className
      )}
      onClick={onSelect}
      {...props}
    />
  );
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
