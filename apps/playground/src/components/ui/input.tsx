import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "glass-input flex h-10 w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none transition-[color,background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
