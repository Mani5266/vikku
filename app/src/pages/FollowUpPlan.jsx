import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Ban, Check, Clock, Minus, Phone, X } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import LeadJourney from "@/components/shared/LeadJourney";
import NoAccess from "@/components/shared/NoAccess";
import { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenLead } from "@/lib/rbac";
import { DAY_15_OUTCOMES, RESCHEDULE_REASONS, planGrid } from "@/lib/planGrid";
import { cn } from "@/lib/utils";

// A5. Follow-up Update — the whole plan, not just today.
//
// A7 answers "what do I do now". This answers "was the plan followed", which is the question the
// manager asks and nobody could previously show. A missed day stays visible as missed for the rest
// of the plan; that is the point.

const STATE = {
  done: { label: "Done", icon: Check, className: "bg-success/10 text-success" },
  today: { label: "Today", icon: Clock, className: "bg-primary-tint text-primary" },
  due: { label: "Later", icon: Clock, className: "bg-secondary text-muted-foreground" },
  missed: { label: "Missed", icon: X, className: "bg-destructive/10 text-destructive" },
  suppressed: { label: "Held", icon: Ban, className: "bg-warning/10 text-warning" },
  "not-scheduled": { label: "—", icon: Minus, className: "text-placeholder" },
  none: { label: "—", icon: Minus, className: "text-placeholder" },
};

function Cell({ state, detail }) {
  const meta = STATE[state] ?? STATE.none;
  const Icon = meta.icon;
  return (
    <div>
      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", meta.className)}>
        <Icon className="h-4 w-4" />
        {meta.label}
      </span>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default function FollowUpPlan() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { leadById, interactionsFor, communicationsFor, updateLead, audit } = useStore();
  const { user } = useSession();

  const lead = leadById(leadId);
  const [reschedulingDay, setReschedulingDay] = useState(null);
  const [outcome, setOutcome] = useState(null);

  const grid = useMemo(() => {
    if (!lead) return null;
    return planGrid({
      plan: lead.plan,
      interactions: interactionsFor(lead.id),
      communications: communicationsFor(lead.id),
    });
  }, [lead, interactionsFor, communicationsFor]);

  if (!lead) return <NoAccess screen="A5" />;
  if (!canOpenLead(user, lead)) return <NoAccess screen="A5" />;

  if (!grid) {
    return (
      <>
        <PageHeader
          screen="A5"
          title={`${lead.patient_name} — follow-up plan`}
          subtitle="No plan is running on this lead yet."
          back={{ to: `/leads/${lead.id}`, label: lead.patient_name }}
        />
        <div className="p-4">
          <SectionCard title="No plan running">
            <p className="text-sm text-muted-foreground">
              A plan starts when the lead is classified. Qualify them and the matching protocol
              activates itself.
            </p>
            <Button className="mt-4" onClick={() => navigate(`/leads/${lead.id}/qualify`)}>
              Qualify this lead
            </Button>
          </SectionCard>
        </div>
      </>
    );
  }

  // §13: a Warm plan may not end in a generic "follow-up" status. This is the forcing point.
  const needsDecision = grid.finished && lead.plan?.temperature === "Warm" && !lead.plan?.day15_outcome;

  const reschedule = (day, reason) => {
    const skips = { ...(lead.plan?.reschedules ?? {}), [day]: { reason, at: new Date().toISOString() } };
    updateLead(lead.id, { plan: { reschedules: skips } });
    audit?.({
      action: "followup_rescheduled",
      lead_id: lead.id,
      actor: user?.name,
      detail: `Day ${day} moved: ${reason}`,
    });
    setReschedulingDay(null);
  };

  const recordOutcome = (option) => {
    updateLead(lead.id, { plan: { day15_outcome: option.value, day15_at: new Date().toISOString() } });
    audit?.({
      action: "warm_day15_decision",
      lead_id: lead.id,
      actor: user?.name,
      detail: option.value,
    });
    if (option.next === "close") navigate(`/leads/${lead.id}/close`);
    else if (option.next === "appointment") navigate(`/leads/${lead.id}/appointment`);
    else if (option.next === "qualify") navigate(`/leads/${lead.id}/qualify`);
  };

  return (
    <>
      <PageHeader
        screen="A5"
        title={`${lead.patient_name} — ${grid.protocol.label}`}
        subtitle="Every scheduled day, what was supposed to happen and what did. A missed day stays missed."
        thesis="§12–§16, §30.5"
        back={{ to: `/leads/${lead.id}`, label: lead.patient_name }}
      />

      <LeadJourney lead={lead} current="plan" />

      <div className="space-y-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Plan day"
            value={`${Math.min(grid.today, grid.durationDays)} of ${grid.durationDays}`}
            detail={grid.finished ? "The plan has run out" : `${grid.daysLeft} days left`}
          />
          <StatTile
            label="Calls made on time"
            value={`${grid.completion}%`}
            detail="of the calls due so far"
            tone={grid.completion >= 90 ? "good" : "bad"}
          />
          <StatTile
            label="Calls missed"
            value={grid.missed}
            detail="still owed, they do not expire"
            tone={grid.missed ? "bad" : "good"}
          />
          <StatTile
            label="Messages"
            value={grid.suppression.active ? "Held" : "Running"}
            detail={grid.suppression.reason ?? "No suppression is active"}
            tone={grid.suppression.active ? "warn" : "default"}
          />
        </div>

        {needsDecision && (
          <SectionCard
            title="This plan is over. Pick what happened."
            caption="§13: a Warm lead cannot stay in a generic follow-up status at the end of fifteen days. Leaving it undecided is how leads sit Pending forever."
          >
            <div className="flex flex-wrap gap-1">
              {DAY_15_OUTCOMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOutcome(option)}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm",
                    outcome?.value === option.value
                      ? "bg-primary-tint font-semibold text-primary"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {option.value}
                </button>
              ))}
            </div>
            <Button className="mt-4 w-full" disabled={!outcome} onClick={() => recordOutcome(outcome)}>
              {outcome?.closes ? "Record and close with a reason" : "Record this"}
            </Button>
          </SectionCard>
        )}

        {lead.plan?.day15_outcome && (
          <div className="flex items-start gap-2 rounded-lg bg-primary-tint p-4">
            <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm">
              Day 15 decision recorded: <span className="font-semibold">{lead.plan.day15_outcome}</span>
            </p>
          </div>
        )}

        <SectionCard
          title="The plan, day by day"
          caption="A day counts as called when a call was logged inside it. Nothing here reads the lead's status — a status can be typed, a logged call has a timestamp."
        >
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead className="bg-secondary">
                <tr>
                  {["Day", "Call", "What the call is for", "Message", "What the message is"].map((head) => (
                    <th key={head} className="whitespace-nowrap border-b border-border px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => {
                  const moved = lead.plan?.reschedules?.[row.day];
                  return (
                    <tr
                      key={row.day}
                      className={cn("border-b border-border last:border-0", row.isToday && "bg-primary-tint/40")}
                    >
                      <td className="num whitespace-nowrap px-4 py-2 align-top font-semibold">
                        {`Day ${row.day}`}
                        {row.isToday && <span className="ml-1 text-xs text-primary">today</span>}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Cell
                          state={moved ? "suppressed" : row.callState}
                          detail={moved ? `Moved: ${moved.reason}` : row.callsLogged ? `${row.callsLogged} logged` : null}
                        />
                      </td>
                      <td className="px-4 py-2 align-top text-muted-foreground">{row.callActivity}</td>
                      <td className="px-4 py-2 align-top">
                        <Cell state={row.messageState} detail={row.suppressedReason} />
                      </td>
                      <td className="px-4 py-2 align-top text-muted-foreground">
                        {row.messageChannel === "None" ? "—" : `${row.messageChannel} · ${row.messageActivity}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Move a day"
          caption="Rescheduling costs a reason. A day that moves without one is a day that quietly disappears."
        >
          <div className="flex flex-wrap gap-1">
            {grid.rows
              .filter((row) => row.callRequired && row.callState !== "done")
              .map((row) => (
                <button
                  key={row.day}
                  type="button"
                  onClick={() => setReschedulingDay(row.day === reschedulingDay ? null : row.day)}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm",
                    reschedulingDay === row.day
                      ? "bg-primary-tint font-semibold text-primary"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {`Day ${row.day}`}
                </button>
              ))}
          </div>

          {reschedulingDay && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">{`Why is Day ${reschedulingDay} moving?`}</p>
              <div className="flex flex-wrap gap-1">
                {RESCHEDULE_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => reschedule(reschedulingDay, reason)}
                    className="rounded-md bg-secondary px-4 py-2 text-sm text-muted-foreground"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/leads/${lead.id}/call`)}>
            <Phone className="h-4 w-4" />
            Log a call
          </Button>
          <Button variant="outline" onClick={() => navigate(`/leads/${lead.id}/appointment`)}>
            Book the appointment
          </Button>
          <Button variant="outline" onClick={() => navigate(`/leads/${lead.id}/qualify`)}>
            Re-qualify
          </Button>
          <Button variant="outline" onClick={() => navigate(`/leads/${lead.id}/close`)}>
            <AlertTriangle className="h-4 w-4" />
            Close with a reason
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Ending a plan without a conversion goes through{" "}
          <Link to={`/leads/${lead.id}/close`} className="font-semibold text-primary">
            the closure screen
          </Link>
          . There is no silent expiry — that is the §18 rule this product exists to enforce.
        </p>
      </div>
    </>
  );
}
