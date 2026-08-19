import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import { useSession } from "@/store/session";
import { useAgentDay } from "@/store/useAgentDay";
import { GreetingHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { buildToday } from "@/lib/today";
import { telHref } from "@/lib/agentCopy";
import { cn } from "@/lib/utils";

// A1 + A7. Today — the agent's only home.
//
// There were two: My Leads and Daily Tasks, showing the same leads in the same order with different
// words. The agent's first decision every morning was "which of my two lists" — a decision the
// software should have made for them. Both routes now render this.
//
// The rules this screen is built on, each learned from watching what a telecaller actually does:
//
//   · One list. Grouped by urgency, never by temperature — Hot / Warm / Cold is how a manager
//     slices a pipeline; "who do I ring first" is what an agent needs at 9am.
//   · One button per row, and it is the same instruction the lead's own screen shows. An agent
//     never picks a screen; they press the button and the right screen opens.
//   · Every group says why it exists in one sentence, in money terms where money is the point.
//   · An empty day is a designed state. "Nothing due" is information, not a blank page.

const TONE = {
  bad: "text-destructive",
  warn: "text-warning",
  good: "text-success",
  default: "text-foreground",
};

function Row({ row }) {
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

export default function Today() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const day = useAgentDay();
  const focus = params.get("focus");
  // The sidebar links into a group rather than to a second screen. Finished is collapsed by
  // default, so arriving at it from the sidebar has to open it or the link goes nowhere visible.
  const [showFinished, setShowFinished] = useState(focus === "finished");

  useEffect(() => {
    if (!focus) return;
    if (focus === "finished") setShowFinished(true);
    const target = document.getElementById(`group-${focus}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, day]);

  const leads = day?.rows ?? [];

  const first = day.first;

  return (
    <>
      <GreetingHeader
        name={user?.name}
        purpose="Everything you owe today, worst first. Work down the list — the button on each row opens the right screen."
        meta={
          <span className="text-sm text-muted-foreground">
            {day.toDo === 0 ? "Nothing due" : `${day.toDo} to do`} · {leads.length} leads are yours
          </span>
        }
      />

      <div className="space-y-6 p-4">
        {/* One focal point: start here. An agent should never have to choose where to begin. */}
        {first ? (
          <section className="card-surface p-4">
            <p className="text-xs text-muted-foreground">Start here</p>
            <p className="mt-1 text-lg font-semibold">
              {first.lead.patient_name} · {first.lead.disease}
            </p>
            <p className={cn("mt-1 text-sm font-semibold", first.overdue ? "text-destructive" : "text-foreground")}>
              {first.duty?.label ?? first.step?.label}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {first.step?.why ?? first.duty?.detail}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={telHref(first.lead.phone_number)}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card active:bg-primary-pressed"
              >
                <Phone className="h-6 w-6" />
                {`Call ${first.lead.phone_number}`}
              </a>
              {first.step?.to && (
                <Button variant="outline" onClick={() => navigate(first.step.to)}>
                  {first.step.action}
                </Button>
              )}
            </div>
          </section>
        ) : (
          <section className="card-surface p-4">
            <p className="text-lg font-semibold">Nothing is due right now</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Every call the plans asked for today is logged. New leads land at the top of this
              screen the moment they arrive, and you have five minutes to make the first call.
            </p>
          </section>
        )}

        {day.groups.map((group) => {
          if (group.rows.length === 0) return null;
          if (group.key === "finished" && !showFinished) {
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setShowFinished(true)}
                className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-primary"
              >
                {`Show ${group.rows.length} finished`}
              </button>
            );
          }

          return (
            <section key={group.key} id={`group-${group.key}`} className="scroll-mt-28">
              <div className="mb-2">
                <h2 className={cn("text-base font-semibold", TONE[group.tone])}>
                  {`${group.label} · ${group.rows.length}`}
                </h2>
                <p className="max-w-3xl text-xs text-muted-foreground">{group.why}</p>
              </div>
              <ul className="space-y-2">
                {group.rows.map((row) => (
                  <Row key={row.lead.id} row={row} />
                ))}
              </ul>
            </section>
          );
        })}

        <p className="text-xs text-muted-foreground">
          You can always call. Only the planned message waits — one every two days per patient, so
          nobody is spammed.
        </p>
      </div>
    </>
  );
}
