import React, { useMemo, useState } from "react";
import { Clock, UserPlus } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOURNEYS } from "@/store/journeys";
import { useSession } from "@/store/session";
import {
  BOARD_WINDOW_DAYS,
  assignmentProblems,
  assignmentRecord,
  boardSummary,
  rosterLoad,
  waitingPool,
} from "@/lib/assignment";

// M5. Unassigned & Assignment Board.
//
// One rule: no lead sits without an owner. What this board actually lists needs saying out
// loud, because the honest version is narrower than the title — every lead in the dataset has
// a name against it from the moment it arrives, so what is listed here is the failure that
// matters more: **arrived, nominally owned, never touched by a human being.**

export default function AssignmentBoard() {
  const rows = JOURNEYS;
  const { user } = useSession();
  const [selected, setSelected] = useState(null);
  const [agentName, setAgentName] = useState(null);
  const [reason, setReason] = useState("");
  const [assigned, setAssigned] = useState([]);

  const pool = useMemo(() => waitingPool(rows), [rows]);
  const summary = useMemo(() => boardSummary(rows), [rows]);
  const roster = useMemo(() => rosterLoad(rows), [rows]);

  const open = pool.filter((entry) => !assigned.some((record) => record.lead_id === entry.id));
  const lead = open.find((entry) => entry.id === selected) ?? null;
  const agent = roster.find((entry) => entry.value === agentName) ?? null;
  const problems = assignmentProblems({ lead, agent, reason });

  const commit = () => {
    if (!lead || !agent || problems.length) return;
    setAssigned((current) => [assignmentRecord({ lead, agent, reason, by: user?.name }), ...current]);
    setSelected(null);
    setAgentName(null);
    setReason("");
  };

  return (
    <>
      <PageHeader
        screen="M5"
        title="Assignment Board"
        subtitle="Leads that arrived and that nobody has ever picked up, oldest first, each with the routing rule that should have caught it."
        thesis="§30.2, §7, §29"
      />

      <div className="space-y-6 p-4">
        <SectionCard title="What this board is counting">
          <p className="text-lg font-semibold">
            {`${summary.neverTouchedEver} leads in the last ninety days were never touched by anybody. ${summary.lostWhileWaiting} of them have already closed.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {`${summary.waiting} arrived inside the last ${BOARD_WINDOW_DAYS} days and are still waiting — ${summary.waitingShare}% of everything that came in during that window. The oldest has been sitting for ${summary.oldestDays} days.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Every one of these carries an agent's name in the record. That is exactly why counting
            "unassigned" leads would have found nothing: the ownership field was filled in and the
            phone was never picked up.
          </p>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Waiting now" value={open.length} icon={Clock} tone="bad" detail={`Inside ${BOARD_WINDOW_DAYS} days`} />
          <StatTile label="Oldest wait" value={`${summary.oldestDays} days`} tone="bad" detail="Against a five-minute first-touch SLA" />
          <StatTile label="Never touched, all time" value={summary.neverTouchedEver} detail="Ninety days" />
          <StatTile label="Assigned in this session" value={assigned.length} icon={UserPlus} detail="Held in the page, not persisted" />
        </div>

        {summary.bands.length > 0 && (
          <SectionCard
            title="Against the intake SLA"
            caption="The bands are written for a live desk. On this dataset every waiting lead has fallen into the same one, which is the finding rather than a rendering problem."
          >
            <ul className="space-y-2">
              {summary.bands.map((band) => (
                <li key={band.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{band.value}</span>
                  <span className="flex items-center gap-3">
                    <span className="num text-muted-foreground">{`${band.leads} lead(s)`}</span>
                    {band.escalation && <StatusPill status={band.escalation} tone="bad" />}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <SectionCard
            title="Waiting for a first call"
            caption="Click a lead to assign it. The rule column is what the configured routing says should have happened, not what did."
          >
            <div className="scroll-slim max-h-[32rem] overflow-auto">
              <ul className="space-y-2">
                {open.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(entry.id === selected ? null : entry.id)}
                      className={
                        entry.id === selected
                          ? "w-full rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                          : "w-full rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                      }
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{entry.patient_name}</span>
                        <StatusPill status={`${entry.waitingDays} days waiting`} tone="bad" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {`${entry.disease} · ${entry.source} · ${entry.branch} · currently against ${entry.nominal_owner}`}
                      </p>
                      <p className="mt-1 text-xs text-primary">{`Should route to ${entry.routeTo} — ${entry.rule}`}</p>
                    </button>
                  </li>
                ))}
                {open.length === 0 && (
                  <li className="py-12 text-center text-sm font-semibold">
                    Nothing is waiting. Every lead in the window has had a first call.
                  </li>
                )}
              </ul>
            </div>
          </SectionCard>

          <div className="space-y-4">
            <SectionCard
              title="Agent capacity"
              caption="Lightest load first. An assignment into a full queue is refused — it does not fix anything, it just moves the problem onto next week's overdue list."
            >
              <ul className="space-y-2">
                {roster.map((entry) => (
                  <li key={entry.value}>
                    <button
                      type="button"
                      onClick={() => setAgentName(entry.value === agentName ? null : entry.value)}
                      className={
                        entry.value === agentName
                          ? "w-full rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                          : "w-full rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                      }
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{entry.value}</span>
                        <span className="num text-xs text-muted-foreground">{`${entry.open} / ${entry.capacity}`}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-card">
                        <div
                          className={entry.atCapacity ? "h-full bg-destructive" : "h-full bg-primary"}
                          style={{ width: `${Math.min(100, entry.load)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {`${entry.hot} Hot · ${entry.overdue} overdue · ${entry.headroom} free`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Assign">
              {!lead && <p className="text-sm text-muted-foreground">Pick a lead on the left.</p>}
              {lead && (
                <>
                  <p className="text-sm">
                    {`${lead.patient_name} → ${agent?.value ?? "nobody yet"}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{lead.because}</p>
                  <div className="mt-3 space-y-2">
                    <label htmlFor="assign-reason" className="block text-xs font-semibold">
                      Reason
                    </label>
                    <Input
                      id="assign-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Required when taking a lead off another agent"
                    />
                  </div>
                  {problems.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-destructive">
                      {problems.map((problem) => (
                        <li key={problem}>· {problem}</li>
                      ))}
                    </ul>
                  )}
                  <Button className="mt-4 w-full" disabled={problems.length > 0} onClick={commit}>
                    {problems.length > 0 ? "Not ready" : `Assign to ${agent.value}`}
                  </Button>
                </>
              )}
            </SectionCard>
          </div>
        </div>

        <DataTable
          title="What each assignment would write to the audit log"
          caption="§29 requires a change of custody to carry who moved it, where from, where to and why. This is the record, held in the page for the session — there is no server behind it."
          columns={[
            { key: "lead_id", label: "Lead" },
            { key: "from", label: "From" },
            { key: "to", label: "To" },
            { key: "reason", label: "Reason" },
            { key: "rule", label: "Rule" },
            { key: "waiting_days_at_assignment", label: "Waited, days", align: "right" },
            { key: "assigned_by", label: "By" },
          ]}
          rows={assigned}
          empty="Nothing assigned yet in this session."
        />
      </div>
    </>
  );
}
