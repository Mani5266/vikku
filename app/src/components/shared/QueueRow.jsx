import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import { telHref } from "@/lib/agentCopy";
import { cn } from "@/lib/utils";

// One lead, as the queue shows it.
//
// Lifted out of Today so the single-bucket pages render an identical row. A queue row that looks
// one way on the full list and another way on "Ring now" is two components pretending to be one,
// and the second one is where the phone link quietly stops working.

export default function QueueRow({ row }) {
  const { lead, duty, said, step, overdue } = row;

  return (
    <li className="card-surface flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-[12rem] flex-1">
        {/* The patient name is how an agent opens the lead, and on a phone it was a 17px-tall
            target — under the 24px WCAG 2.5.8 minimum and well under what a thumb can hit while
            walking. The text size is unchanged; the tap area is padded out around it. */}
        <Link
          to={`/leads/${lead.id}`}
          className="-my-1 inline-flex min-h-[2.75rem] items-center py-1 text-sm font-semibold hover:underline"
        >
          {lead.patient_name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {lead.disease}
          {lead.plan?.temperature ? ` · ${lead.plan.temperature}` : ""}
        </p>
        {duty && (
          <p className={cn("mt-1 text-sm", overdue ? "font-semibold text-destructive" : "text-foreground")}>
            {duty.label}
          </p>
        )}
        {duty?.detail && <p className="text-xs text-muted-foreground">{duty.detail}</p>}
      </div>

      <div className="min-w-[14rem] flex-1">
        <p className="text-xs text-muted-foreground">What they said last time</p>
        <p className="text-sm">{said?.said || "Not called yet"}</p>
        {said?.objection && (
          <p className="text-xs text-muted-foreground">{`Worry: ${said.objection}`}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a
          href={telHref(lead.phone_number)}
          className="inline-flex h-12 items-center gap-2 rounded-md bg-card px-4 text-sm font-semibold shadow-card active:bg-secondary"
        >
          <Phone className="h-4 w-4" />
          Call
        </a>
        {step?.to && (
          <Link
            to={step.to}
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card active:bg-primary-pressed"
          >
            {step.action}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </li>
  );
}
