import React, { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import { RESOLUTION_OUTCOMES, deskSummary, escalationDesk, resolutionProblems } from "@/lib/escalations";

// M8. Escalation & Objection Desk.
//
// Six objections, six owners, six prescribed actions — the §24 table, made into a queue. The
// desk works two pools and keeps them visibly apart: what is still open, and what was closed
// for an objection that had a named owner and never reached them. The second pool is §33's
// worked example, computed rather than quoted.

export default function EscalationDesk() {
  const rows = JOURNEYS;
  const [active, setActive] = useState("price");
  const [draft, setDraft] = useState({ outcome: "", note: "", discount: false });

  const desk = useMemo(() => escalationDesk(rows), [rows]);
  const summary = useMemo(() => deskSummary(desk), [desk]);
  const queue = desk.find((entry) => entry.key === active) ?? desk[0];
  const problems = resolutionProblems(draft);

  return (
    <>
      <PageHeader
        screen="M8"
        title="Escalation & Objection Desk"
        subtitle="Leads that need somebody more senior than the agent, grouped by the objection that put them there."
        thesis="§24, §31, §33"
      />

      <div className="space-y-6 p-4">
        <SectionCard title="What the desk is holding">
          <p className="text-lg font-semibold">
            {`${summary.closedWithoutAction} leads were closed for an objection that had a named owner, and never reached that owner.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {`${summary.recoverable} of them carry a reason the §23 taxonomy still calls winnable, against ${rupees(
              summary.lostValue
            )} of quoted package value. ${summary.live} lead(s) are open on the desk right now.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            §33's worked example is a hospital that concluded it had a pricing problem when what it
            had was a process that stopped. This is that number, computed from the closure records.
          </p>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open escalations" value={summary.live} icon={ShieldAlert} tone={summary.live ? "bad" : "good"} detail={`Across ${summary.queues} queue(s)`} />
          <StatTile label="Closed without the action" value={summary.closedWithoutAction} tone="bad" detail="Nobody senior was ever involved" />
          <StatTile label="Still winnable" value={summary.recoverable} tone="warn" detail="By the §23 taxonomy" />
          <StatTile label="Quoted value behind them" value={rupees(summary.lostValue)} detail="Gross, and only where a quote exists" />
        </div>

        <SectionCard
          title="The six §24 objections"
          caption="Pick a queue. Each carries the owner it routes to and the action that owner is supposed to take — those two columns are the specification, not a suggestion this app invented."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {desk.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setActive(entry.key)}
                className={
                  entry.key === queue.key
                    ? "rounded-md border-2 border-primary bg-primary-tint p-3 text-left"
                    : "rounded-md border-2 border-transparent bg-secondary p-3 text-left"
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{entry.value}</span>
                  {!entry.detectable && <StatusPill status="No live detector" tone="neutral" />}
                </div>
                <p className="num mt-1 text-xl font-semibold">{entry.live}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {`open · ${entry.never} closed without ${entry.prescribedLabel}`}
                </p>
                <p className="mt-1 text-xs text-primary">{`Routes to ${entry.routesTo}`}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={`${queue.value} — what the owner is supposed to do`}
          caption={queue.action}
        >
          {queue.detectable ? (
            <p className="text-sm">
              {`${queue.live} lead(s) match right now. Detected as: ${queue.liveBasis.toLowerCase()}.`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {`This queue is empty because it cannot be filled yet, not because nobody has the objection. ${queue.liveBasis}. What the desk can still show is the closed pool below — leads that carried this objection all the way to a closure without ${queue.prescribedLabel} ever happening.`}
            </p>
          )}
        </SectionCard>

        {queue.live > 0 && (
          <DataTable
            title={`Open — ${queue.value}`}
            caption="Oldest first. Age is the lead's age, because the dataset records when a lead arrived and not when somebody raised a hand."
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "disease", label: "Disease" },
              { key: "branch", label: "Branch" },
              { key: "agent_name", label: "Agent" },
              { key: "doctor_name", label: "Doctor" },
              { key: "owner", label: "Routes to" },
              { key: "valueLabel", label: "Quoted", align: "right" },
              { key: "ageDays", label: "Age, days", align: "right" },
              { key: "evidence", label: "Why it is here" },
            ]}
            rows={queue.liveRows.slice(0, 200).map((entry) => ({
              ...entry,
              valueLabel: entry.value ? rupees(entry.value) : "—",
            }))}
          />
        )}

        <DataTable
          title={`Closed without ${queue.prescribedLabel} — ${queue.never} of ${queue.closed}`}
          caption={`${queue.neverShare}% of the leads closed for this objection never got the action §24 prescribes for it. This is the evidence pool, not a work queue — most of these have been closed for weeks.`}
          columns={[
            { key: "patient_name", label: "Patient" },
            { key: "disease", label: "Disease" },
            { key: "agent_name", label: "Agent" },
            { key: "loss_reason", label: "Closed as" },
            { key: "recoverableLabel", label: "Winnable" },
            { key: "daysSinceClosure", label: "Days closed", align: "right" },
          ]}
          rows={queue.rows.map((entry) => ({ ...entry, recoverableLabel: entry.recoverable ? "Yes" : "No" }))}
          empty="Nothing was closed for this objection."
        />

        <SectionCard
          title="Resolving an escalation"
          caption="An outcome and a note, always. A discount approval carries three more fields, because §29 requires an approver on the record and an approval nobody signed is the audit finding that ends a hospital contract."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {RESOLUTION_OUTCOMES.map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant={draft.outcome === outcome ? "default" : "outline"}
                  onClick={() => setDraft((current) => ({ ...current, outcome: current.outcome === outcome ? "" : outcome }))}
                >
                  {outcome}
                </Button>
              ))}
            </div>

            <Textarea
              rows={3}
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="What was actually said. The next person to open this lead reads this and nothing else."
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.discount}
                onChange={(event) => setDraft((current) => ({ ...current, discount: event.target.checked }))}
              />
              This resolution approves a discount
            </label>

            {draft.discount && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  inputMode="numeric"
                  value={draft.discountAmount ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, discountAmount: event.target.value }))}
                  placeholder="Amount in rupees"
                />
                <Input
                  value={draft.discountJustification ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, discountJustification: event.target.value }))}
                  placeholder="Justification"
                />
                <Input
                  value={draft.approver ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, approver: event.target.value }))}
                  placeholder="Approver"
                />
              </div>
            )}

            {problems.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>· {problem}</li>
                ))}
              </ul>
            )}

            <Button disabled={problems.length > 0}>
              {problems.length > 0 ? "Not ready to resolve" : "Resolve this escalation"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The guard is real and the write is not. There is no escalation entity behind this build,
              so what this form demonstrates is the refusal — which is the part §29 actually cares about.
            </p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
