import * as React from "react";
import { cn } from "@/lib/utils";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-md border border-line bg-panel-2 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";
