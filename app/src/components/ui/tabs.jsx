import React from "react";
import { cn } from "@/lib/utils";

/**
 * Filter chips — the one selection pattern used across the app. Fully rounded, options up
 * front, and the selected chip is a brand tint with brand-coloured bold text. Nothing else
 * in the app expresses "selected" a different way.
 *
 * items: [{ value, label, count }]
 */
export function Tabs({ items, value, onChange, className }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors",
              active
                ? "bg-primary-tint font-semibold text-primary"
                : "bg-card text-muted-foreground shadow-card active:bg-secondary"
            )}
          >
            {item.label}
            {typeof item.count === "number" && <span className="num text-xs">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
