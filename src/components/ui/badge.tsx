import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wide",
  {
    variants: {
      tone: {
        mute: "bg-mute/15 text-mute",
        amber: "bg-amber/15 text-amber",
        alert: "bg-alert/15 text-alert",
        ok: "bg-ok/15 text-ok",
      },
    },
    defaultVariants: { tone: "mute" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}
