import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The card the reference board is built out of: a header row with the title on the left and at most
 * one control on the right, a body, and an optional footer link.
 *
 * The footer link matters more than it looks. A card on a dashboard is a summary, and a summary that
 * does not say where the whole thing lives is a dead end — the manager sees five rows of "recent
 * leads" and has nowhere to go.
 */
export default function SectionCard({ title, caption, control, footer, children, className, bodyClassName }) {
  return (
    <section className={cn("card-surface flex flex-col overflow-hidden", className)}>
      {(title || control) && (
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {caption && <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{caption}</p>}
          </div>
          {control && <div className="flex shrink-0 items-center gap-2">{control}</div>}
        </div>
      )}
      <div className={cn("min-w-0 flex-1 px-4 pb-4", !title && "pt-4", bodyClassName)}>{children}</div>
      {footer && (
        <Link
          to={footer.to}
          className="flex h-12 items-center justify-center gap-1 bg-secondary text-sm font-semibold text-primary"
        >
          {footer.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}

// Status is the only thing that gets a pill. A pill on everything is how a dashboard turns into
// confetti — and then the one pill that means "this lead is breaching" stops being seen.
const PILL = {
  new: "bg-primary-tint text-primary",
  neutral: "bg-secondary text-secondary-foreground",
  pending: "bg-warning/10 text-warning",
  good: "bg-success/10 text-success",
  bad: "bg-destructive/10 text-destructive",
};

/** Maps the vocabulary the data actually uses onto the five tones. */
const TONE_FOR = {
  New: "new",
  Pending: "new",
  "Follow-up": "new",
  Contacted: "neutral",
  Connected: "neutral",
  "In progress": "neutral",
  Cold: "neutral",
  Qualified: "pending",
  Hot: "pending",
  Warm: "pending",
  Waiting: "pending",
  Converted: "good",
  Admitted: "good",
  Completed: "good",
  Done: "good",
  Lost: "bad",
  Breached: "bad",
  "Not Connected": "bad",
  "Opted out": "bad",
  Expired: "bad",
};

export function StatusPill({ status, tone, className }) {
  const resolved = tone ?? TONE_FOR[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium leading-none",
        PILL[resolved],
        className
      )}
    >
      {status}
    </span>
  );
}
