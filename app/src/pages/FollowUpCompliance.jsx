import React, { useMemo, useState } from "react";
import { ServerCrash, UserX } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { JOURNEYS } from "@/store/journeys";
import {
  QUEUE_ACTIONS,
  completionBy,
  executionSplit,
  overdueQueue,
  severityBands,
} from "@/lib/compliance";

// M4. Follow-up Compliance & Overdue Queue.
//
// The question is not how the agent did. It is whether the process ran at all — and the one
// rule that makes the answer usable is §28's: a message the platform failed to deliver is an
// infrastructure problem, not somebody's appraisal. The two counts stay apart everywhere on
// this screen, including on every individual row.

const DIMENSIONS = [
  { key: "agent_name", label: "By agent" },
  { key: "disease", label: "By disease" },
  { key: "source", label: "By source" },
  { key: "branch", label: "By branch" },
];

export default function FollowUpCompliance() {
  const rows = JOURNEYS;
  const [band, setBand] = useState(null);
  const [dimension, setDimension] = useState("agent_name");

  const bands = useMemo(() => severityBands(rows), [rows]);
  const split = useMemo(() => executionSplit(rows), [rows]);
  const queue = useMemo(() => overdueQueue(rows), [rows]);
  const lines = useMemo(() => completionBy(rows, dimension), [rows, dimension]);

  const shown = band ? queue.filter((entry) => entry.severity === band) : queue;
  const active = bands.find((entry) => entry.key === band) ?? null;

  return (
    <>
      <PageHeader
        screen="M4"
        title="Follow-up Compliance"
        subtitle="Every lead whose plan slipped, worst first — and whether it slipped because nobody called or because nothing was delivered."
        thesis="§24, §28, §30.5"
      />

      <div className="space-y-6 p-4">
        {/* The guard, stated before any number that could be misread as an agent's fault. */}
        <div className="grid gap-3 lg:grid-cols-2">
          <SectionCard title="Touches nobody made">
            <div className="flex items-start gap-3">
              <UserX className="mt-1 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-2xl font-semibold">{split.missed.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {`Scheduled follow-ups that were never executed, out of ${split.owed.toLocaleString(
                    "en-IN"
                  )} the plans owed. Execution rate ${split.executionRate}%.`}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">This is the column a coaching conversation is about.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Messages the platform failed to deliver">
            <div className="flex items-start gap-3">
              <ServerCrash className="mt-1 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-2xl font-semibold">{split.undelivered.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {`Sent and never delivered, across ${split.deliveryFailureLeads.toLocaleString(
                    "en-IN"
                  )} lead(s). ${split.delivered.toLocaleString("en-IN")} of ${split.sent.toLocaleString(
                    "en-IN"
                  )} messages arrived.`}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  This is a ticket, not an appraisal. It is never added to the number on the left.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="The queue, by severity"
          caption="A lead appears once, in the worst band it qualifies for. Listing it twice makes the queue longer without making it more true."
          control={
            band && (
              <Button size="sm" variant="outline" onClick={() => setBand(null)}>
                Show every band
              </Button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bands.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setBand(entry.key === band ? null : entry.key)}
                className={
                  entry.key === band
                    ? "rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                    : "rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                }
              >
                <p className="text-sm font-semibold">{entry.value}</p>
                <p className="num mt-1 text-xl font-semibold">{entry.leads.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {`${entry.missedTouches} touch(es) never made · ${entry.undelivered} undelivered`}
                </p>
              </button>
            ))}
          </div>
          {active && <p className="mt-4 text-sm text-muted-foreground">{active.why}</p>}
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Leads in the queue" value={queue.length.toLocaleString("en-IN")} tone="bad" detail="Every band, deduplicated" />
          <StatTile label="Follow-ups owed" value={split.owed.toLocaleString("en-IN")} detail="What the plans committed to" />
          <StatTile
            label="Execution rate"
            value={`${split.executionRate}%`}
            tone={split.executionRate >= 90 ? "good" : "bad"}
            detail="Delivery failures excluded, deliberately"
          />
          <StatTile label="Delivery failures" value={split.undelivered.toLocaleString("en-IN")} tone="warn" detail="Raise a ticket, not a review" />
        </div>

        <DataTable
          title={active ? `${active.value} — ${shown.length} lead(s)` : `The whole overdue queue — ${shown.length} lead(s)`}
          caption="Cause is stated per row, so one line already says whether to talk to a person or to open a ticket."
          columns={[
            { key: "patient_name", label: "Patient" },
            { key: "severityLabel", label: "Why it is here" },
            { key: "agent_name", label: "Agent" },
            { key: "temperature", label: "Grade" },
            { key: "disease", label: "Disease" },
            { key: "due", label: "Owed", align: "right" },
            { key: "done", label: "Done", align: "right" },
            { key: "missed", label: "Never made", align: "right" },
            { key: "undelivered", label: "Undelivered", align: "right" },
            { key: "cause", label: "Cause" },
            { key: "ageDays", label: "Age, days", align: "right" },
          ]}
          rows={shown.slice(0, 300)}
          empty="Nothing has slipped in this band."
        />
        {shown.length > 300 && (
          <p className="text-xs text-muted-foreground">
            {`Showing the worst 300 of ${shown.length}. The download writes the same 300, not the whole queue — a truncated export that says otherwise is worse than none.`}
          </p>
        )}

        <SectionCard
          title="Execution rate, sliced"
          caption="The delivery-failure column travels with the execution rate everywhere. Without it, an agent working a route with a broken WhatsApp sender reads as the worst performer on the desk."
          control={
            <div className="flex flex-wrap gap-2">
              {DIMENSIONS.map((entry) => (
                <Button
                  key={entry.key}
                  size="sm"
                  variant={entry.key === dimension ? "default" : "outline"}
                  onClick={() => setDimension(entry.key)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          }
        >
          <DataTable
            title={null}
            download={false}
            columns={[
              { key: "value", label: DIMENSIONS.find((entry) => entry.key === dimension).label.replace("By ", "") },
              { key: "leads", label: "Leads", align: "right" },
              { key: "owed", label: "Owed", align: "right" },
              { key: "executed", label: "Executed", align: "right" },
              { key: "executionRateLabel", label: "Execution", align: "right" },
              { key: "missed", label: "Never made", align: "right" },
              { key: "undelivered", label: "Undelivered", align: "right" },
              { key: "overdueLeads", label: "In the queue", align: "right" },
            ]}
            rows={lines.map((line) => ({ ...line, executionRateLabel: `${line.executionRate}%` }))}
          />
        </SectionCard>

        <SectionCard
          title="What this screen can do to a lead, and what it cannot"
          caption="Listed rather than wired. There is no scheduler behind this build, and a button that claims to reschedule a touch it cannot reschedule is worse than no button at all."
        >
          <ul className="space-y-2">
            {QUEUE_ACTIONS.map((action) => (
              <li key={action.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{action.label}</span>
                <span className="text-xs text-muted-foreground">{action.writes}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs">
            <StatusPill status="Not built" tone="bad" />
            <span className="text-muted-foreground">
              All five. The queue, the severity ordering and the cause split are real and computed;
              the actions are the next thing to build behind them.
            </span>
          </p>
        </SectionCard>
      </div>
    </>
  );
}
