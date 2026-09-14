import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-md border border-line bg-panel-2 px-3 text-sm text-ink placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
