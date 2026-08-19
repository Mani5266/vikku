import React from "react";
import { cn } from "@/lib/utils";

// Least variants possible. Brand fill for the one primary action on a screen, a quiet
// outline for everything else, and destructive only for a destructive path — never as the
// primary button. Pressed state is the darker tonal step, not a brightened hue, and every
// variant gives feedback on press.

const VARIANTS = {
  default: "bg-primary text-primary-foreground shadow-card active:bg-primary-pressed",
  secondary: "bg-secondary text-foreground active:bg-accent",
  outline: "bg-card text-foreground shadow-card active:bg-secondary",
  ghost: "text-foreground active:bg-secondary",
  destructive: "bg-destructive text-destructive-foreground shadow-card active:brightness-90",
};

// 4pt grid, and the touch target stays consistent: 48 for actions, 40 for in-table controls.
const SIZES = {
  default: "h-12 px-4 text-sm",
  sm: "h-10 px-4 text-sm",
  lg: "h-14 px-6 text-base",
  icon: "h-12 w-12",
};

export const Button = React.forwardRef(function Button(
  { className, variant = "default", size = "default", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-md font-semibold",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:bg-secondary disabled:text-placeholder disabled:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  );
});

export default Button;
