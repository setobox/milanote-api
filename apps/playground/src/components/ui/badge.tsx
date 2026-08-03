import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-wide",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/15 text-primary",
        destructive: "border-coral/30 bg-coral/12 text-coral",
        outline: "border-glass-border bg-card/35 text-muted-foreground backdrop-blur",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-cyan/35 bg-cyan/15 text-cyan-foreground",
      },
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
