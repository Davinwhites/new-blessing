import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-24 w-full rounded-md border border-line bg-panel-2 px-3 py-2.5 text-sm text-ink placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
