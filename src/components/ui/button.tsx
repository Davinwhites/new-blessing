import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,opacity,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber active:scale-[0.96]",
  {
    variants: {
      variant: {
        default: "bg-alert text-white hover:bg-[#ff4655] shadow-[0_0_0_1px_rgba(230,57,70,0.4)]",
        secondary:
          "bg-panel-2 text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16)]",
        ghost:
          "bg-transparent text-mute shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:text-ink hover:shadow-[0_0_0_1px_rgba(230,57,70,0.55)]",
        outline:
          "bg-transparent text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_0_1px_rgba(232,184,74,0.5)]",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
