import React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("card-surface text-card-foreground", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1 p-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-4 pt-2", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />;
}
