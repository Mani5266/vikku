import React from "react";
import { cn } from "@/lib/utils";

// Status tags stay neutral. Colour appears only where it carries meaning — green positive,
// red destructive or breached, amber pending — and the brand tint marks a selection, not a
// category. The reserved amber accent is available as `accent`, for one highlight per
// screen, never as a fill behind white text.

const VARIANTS = {
  default: "bg-secondary text-foreground",
  secondary: "bg-secondary text-muted-foreground",
  outline: "bg-card text-muted-foreground shadow-card",
  brand: "bg-primary-tint text-primary",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  accent: "bg-accent-amber/16 text-warning",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium leading-none",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export default Badge;
