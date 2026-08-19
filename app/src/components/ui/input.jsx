import React from "react";
import { cn } from "@/lib/utils";

// 48px tall like every other control, 8px radius, placeholder at the 45% step. The field is
// a white surface with the app's one shadow rather than a stroke.

export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md bg-card px-4 text-sm shadow-card",
        "placeholder:text-placeholder",
        "transition-shadow duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-placeholder",
        className
      )}
      {...props}
    />
  );
});

export default Input;
