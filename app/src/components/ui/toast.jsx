import React, { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

// Minimal stand-in for the app's useToast() hook, with the same call shape:
//   toast({ title, description, variant: "destructive" })

const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback(({ title, description, variant = "default", duration = 6000 }) => {
    const id = `${title}-${items.length}-${performance.now()}`;
    setItems((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), duration);
  }, [items.length]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-md border p-3 shadow-lg",
              t.variant === "destructive"
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "bg-card"
            )}
          >
            <p className="text-sm font-medium">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs opacity-90">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
