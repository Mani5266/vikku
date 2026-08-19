import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Same compound API as the shadcn Select the Base44 app uses
// (Select / SelectTrigger / SelectValue / SelectContent / SelectItem, onValueChange),
// implemented without Radix so this app carries no extra dependency.

const SelectContext = createContext(null);

export function Select({ value = "", onValueChange, disabled = false, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (next) => {
    onValueChange?.(next);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value, select, open, setOpen, disabled }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children, ...props }) {
  const ctx = useContext(SelectContext);
  return (
    <button
      type="button"
      disabled={ctx.disabled}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
}

export function SelectValue({ placeholder = "Select" }) {
  const ctx = useContext(SelectContext);
  return (
    <span className={cn("truncate", !ctx.value && "text-muted-foreground")}>
      {ctx.value || placeholder}
    </span>
  );
}

export function SelectContent({ className, children }) {
  const ctx = useContext(SelectContext);
  if (!ctx.open) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-card p-1 shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, className, children }) {
  const ctx = useContext(SelectContext);
  const selected = ctx.value === value;
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => ctx.select(value)}
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
        selected && "font-medium",
        className
      )}
    >
      <span>{children}</span>
      {selected && <Check className="h-3.5 w-3.5" />}
    </div>
  );
}
