import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-mute",
        className,
      )}
      {...props}
    />
  );
}
