import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Lock } from "lucide-react";
import { leadStages } from "@/lib/journey";
import { cn } from "@/lib/utils";

// The stage bar that sits at the top of every screen belonging to one lead.
//
// It exists because the app previously gave no answer to "where is this lead and what comes next".
// Four stages, always visible, always in the same order, each saying done / now / later / not yet.
// A locked stage says what has to happen first rather than only refusing.

const STATE = {
  done: {
    chip: "bg-success/10 text-success",
    word: "Done",
  },
  now: {
    chip: "bg-primary text-primary-foreground",
    word: "You are here",
  },
  later: {
    chip: "bg-secondary text-muted-foreground",
    word: "Later",
  },
  locked: {
    chip: "bg-secondary/60 text-placeholder",
    word: "Not yet",
  },
};

export default function LeadJourney({ lead, current }) {
  if (!lead) return null;
  const stages = leadStages(lead);

  // The stage bar used to carry `bg-card`, directly below a `bg-card` header that has a drop
  // shadow. The two read as a single white panel with a shadow drawn across the middle of it —
  // the kind of seam that makes a screen look unfinished without anybody being able to say why.
  // It now sits on the page background as its own band, so the header's shadow lands where a
  // header's shadow should.
  return (
    <nav aria-label="Lead stages" className="px-4 py-4 md:px-6">
      <ol className="flex flex-wrap items-stretch gap-2">
        {stages.map((stage, index) => {
          const active = stage.key === current;
          const meta = STATE[active ? "now" : stage.state] ?? STATE.later;
          const locked = stage.state === "locked" && !active;

          const body = (
            <>
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    meta.chip
                  )}
                >
                  {stage.state === "done" ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-4 w-4" /> : index + 1}
                </span>
                <span className="text-sm font-semibold">{stage.label}</span>
              </span>
              <span className="mt-1 block text-xs font-medium">{meta.word}</span>
              <span className="block text-xs text-muted-foreground">{stage.detail}</span>
            </>
          );

          return (
            <li key={stage.key} className="flex items-center gap-2">
              {locked ? (
                <span
                  className={cn(
                    "block min-w-[9rem] rounded-md px-4 py-2",
                    "bg-secondary/60"
                  )}
                  title={stage.plain}
                >
                  {body}
                </span>
              ) : (
                <Link
                  to={stage.to}
                  title={stage.plain}
                  className={cn(
                    "block min-w-[9rem] rounded-md px-4 py-2",
                    active ? "bg-primary-tint" : "bg-secondary"
                  )}
                >
                  {body}
                </Link>
              )}
              {index < stages.length - 1 && (
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-placeholder sm:block" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The one instruction on the screen.
 *
 * Everything else a lead screen shows is reference. This is what an agent at their ninetieth call
 * reads: one sentence saying what to do, one saying why, and one button.
 */
export function NextStepCard({ step }) {
  if (!step) return null;
  return (
    <section className="card-surface p-4">
      <p className="text-xs text-muted-foreground">Next step</p>
      <p className="mt-1 text-lg font-semibold">{step.label}</p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{step.why}</p>
      {step.to && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={step.to}
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card active:bg-primary-pressed"
          >
            {step.action}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {step.alternative && (
            <Link
              to={step.alternative.to}
              className="inline-flex h-12 items-center gap-2 rounded-md bg-card px-4 text-sm font-semibold shadow-card active:bg-secondary"
            >
              {step.alternative.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
