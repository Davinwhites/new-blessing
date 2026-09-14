import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl bg-panel p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.07)] sm:p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "mb-4 flex items-center justify-between gap-3 text-sm font-semibold tracking-tight text-ink",
        className,
      )}
      {...props}
    />
  );
}
