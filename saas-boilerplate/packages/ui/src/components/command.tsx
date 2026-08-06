import * as React from "react";
import { cn } from "@saas/utils";
import { Search } from "lucide-react";

interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {}

function Command({ className, ...props }: CommandProps) {
  return (
    <div
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        className,
      )}
      {...props}
    />
  );
}

interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div
      className={cn("flex items-center border-b px-3", containerClassName)}
      cmdk-input-wrapper=""
    >
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <input
        ref={ref}
        className={cn(
          "placeholder:text-muted-foreground flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
CommandInput.displayName = "CommandInput";

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className,
      )}
      {...props}
    >
      {heading && <div cmdk-group-heading="">{heading}</div>}
      {children}
    </div>
  ),
);
CommandGroup.displayName = "CommandGroup";

interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, disabled, selected = false, onSelect, ...props }, ref) => (
    <div
      ref={ref}
      aria-selected={selected}
      className={cn(
        "aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      onClick={disabled ? undefined : onSelect}
      role="option"
      {...props}
    />
  ),
);
CommandItem.displayName = "CommandItem";

interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {}

function CommandEmpty({ className, ...props }: CommandEmptyProps) {
  return (
    <div
      className={cn("text-muted-foreground py-6 text-center text-sm", className)}
      cmdk-empty=""
      {...props}
    />
  );
}

export { Command, CommandInput, CommandGroup, CommandItem, CommandEmpty };
