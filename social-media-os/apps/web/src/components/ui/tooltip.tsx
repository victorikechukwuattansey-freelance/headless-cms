import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipContextValue {
  show: boolean;
  setShow: (show: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function Tooltip({ children }: { children: React.ReactNode }) {
  const [show, setShow] = React.useState(false);
  return <TooltipContext.Provider value={{ show, setShow }}>{children}</TooltipContext.Provider>;
}

function TooltipTrigger({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  const context = React.useContext(TooltipContext);
  return (
    <span
      onMouseEnter={() => context?.setShow(true)}
      onMouseLeave={() => context?.setShow(false)}
      {...props}
    >
      {children}
    </span>
  );
}

function TooltipContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(TooltipContext);
  if (!context?.show) return null;

  return (
    <div
      className={cn(
        'absolute z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
