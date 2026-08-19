import React, { useMemo, useState } from "react";
import { UserMinus, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { JOURNEYS } from "@/store/journeys";
import { coverCandidates, coverageGaps, deactivationProblems, teamRoster, teamTotals } from "@/lib/team";

// M7. Team — roster, capacity and coverage.
//
// Two kinds of fact sit on this screen and the difference matters enough to label it on every
// row: the shift, the skills and the leave flag are **configuration** the hospital owns, while
// the open leads, the Hot count and the overdue count are **measured** from the same journeys
// the rest of the app reads. Confusing the two is how a staffing screen ends up making a claim
// about a person that the data never supported.

export default function Team() {
  const rows = JOURNEYS;
  const [selected, setSelected] = useState(null);
  const [coverWith, setCoverWith] = useState(null);

  const lines = useMemo(() => teamRoster(rows), [rows]);
  const totals = useMemo(() => teamTotals(rows), [rows]);
  const coverage = useMemo(() => coverageGaps(rows), [rows]);

  const person = lines.find((line) => line.value === selected) ?? null;
  const candidates = person ? coverCandidates(lines, person) : [];
  const replacement = candidates.find((line) => line.value === coverWith) ?? null;
  const problems = person ? deactivationProblems(person, { reassignTo: replacement }) : [];

  return (
    <>
      <PageHeader
        screen="M7"
        title="Team"
        subtitle="Who is on shift, what they are carrying, and what nobody is covering today."
        thesis="§28, §30.2"
      />

      <div className="space-y-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="On the desk" value={`${totals.onShift} of ${totals.people}`} icon={Users} detail={`${totals.onLeave} on leave`} />
          <StatTile label="Open leads" value={totals.open.toLocaleString("en-IN")} detail={`${totals.hot} of them Hot`} />
          <StatTile
            label="Utilisation"
            value={`${totals.utilisation}%`}
            tone={totals.utilisation >= 90 ? "bad" : "default"}
            detail="Against the capacity actually on shift, not on the payroll"
          />
          <StatTile
            label="Leads nobody is covering"
            value={totals.uncovered.toLocaleString("en-IN")}
            tone={totals.uncovered ? "bad" : "good"}
            detail="Owned by someone on leave"
          />
        </div>

        {coverage.gaps.length > 0 && (
          <SectionCard
            title="Coverage gaps on today's shift"
            caption="A gap is only listed where open leads are actually sitting in it. Nobody needs to know that no one on shift handles a condition with no live patients."
          >
            <p className="text-sm">
              {`${coverage.leadsInGaps} open lead(s) need a skill nobody on shift has. On today's roster that is ${coverage.onShift.join(", ")}.`}
            </p>
            <ul className="mt-4 space-y-2">
              {coverage.gaps.map((gap) => (
                <li key={gap.value} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{gap.value}</span>
                  <span className="flex items-center gap-2">
                    <span className="num text-muted-foreground">{`${gap.openLeads} open`}</span>
                    <StatusPill status="Nobody on shift" tone="bad" />
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard
          title="The desk"
          caption="Shift, languages and skills are configuration. Everything to the right of them is computed from the leads themselves."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {lines.map((line) => (
              <button
                key={line.value}
                type="button"
                onClick={() => {
                  setSelected(line.value === selected ? null : line.value);
                  setCoverWith(null);
                }}
                className={
                  line.value === selected
                    ? "rounded-md border-2 border-primary bg-primary-tint p-4 text-left"
                    : "rounded-md border-2 border-transparent bg-secondary p-4 text-left"
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{line.value}</span>
                  {line.onLeave ? (
                    <StatusPill status="On leave" tone="bad" />
                  ) : (
                    <StatusPill status={line.atCapacity ? "At capacity" : "Available"} tone={line.atCapacity ? "bad" : "good"} />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {`${line.role} · ${line.branch} · ${line.shift}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {`Speaks ${line.languages.join(", ")} · handles ${line.skills.join(", ")}`}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-card">
                  <div
                    className={line.atCapacity ? "h-full bg-destructive" : "h-full bg-primary"}
                    style={{ width: `${Math.min(100, line.loadShare)}%` }}
                  />
                </div>
                <p className="num mt-1 text-xs text-muted-foreground">
                  {`${line.open} open of ${line.capacity} · ${line.hot} Hot · ${line.overdue} overdue · ${line.executionRate}% of touches executed`}
                </p>
                {line.uncovered > 0 && (
                  <p className="mt-2 text-xs text-destructive">
                    {`${line.uncovered} open lead(s) have nobody working them while this person is away.`}
                  </p>
                )}
              </button>
            ))}
          </div>
        </SectionCard>

        {person && (
          <SectionCard
            title={`Cover or deactivate ${person.value}`}
            caption="Deactivating somebody who still owns open leads is refused. A deactivated owner is how a lead becomes invisible — it keeps its name, stops appearing on anybody's queue, and nobody notices until the quarter closes."
          >
            <p className="text-sm">
              {`${person.open} open lead(s), ${person.hot} of them Hot, ${person.overdue} already overdue.`}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {candidates.map((candidate) => (
                <Button
                  key={candidate.value}
                  size="sm"
                  variant={candidate.value === coverWith ? "default" : "outline"}
                  onClick={() => setCoverWith(candidate.value === coverWith ? null : candidate.value)}
                >
                  {`${candidate.value} · ${candidate.headroom} free${
                    candidate.sharedSkills.length ? ` · shares ${candidate.sharedSkills.join(", ")}` : ""
                  }`}
                </Button>
              ))}
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nobody else is on shift, so there is nobody to hand these to. That is a rostering
                  decision, not a CRM one.
                </p>
              )}
            </div>

            {problems.length > 0 ? (
              <ul className="mt-4 space-y-1 text-xs text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>· {problem}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-success">
                {`${person.open} lead(s) would move to ${replacement?.value}. The change is safe to commit.`}
              </p>
            )}

            <Button className="mt-4" disabled={problems.length > 0}>
              <UserMinus className="h-4 w-4" />
              {problems.length > 0 ? "Blocked" : `Reassign and deactivate`}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              The button is the guard, not the write. There is no user store behind this build, so
              nothing is deactivated — what is real is the refusal.
            </p>
          </SectionCard>
        )}

        <DataTable
          title="The roster as a table"
          caption="The same figures, downloadable, for the rostering conversation that happens outside this app."
          columns={[
            { key: "value", label: "Agent" },
            { key: "role", label: "Role" },
            { key: "branch", label: "Branch" },
            { key: "shift", label: "Shift" },
            { key: "statusLabel", label: "Status" },
            { key: "open", label: "Open", align: "right" },
            { key: "hot", label: "Hot", align: "right" },
            { key: "overdue", label: "Overdue", align: "right" },
            { key: "loadLabel", label: "Load", align: "right" },
            { key: "executionLabel", label: "Touches executed", align: "right" },
            { key: "conversionLabel", label: "Surgeries per lead", align: "right" },
          ]}
          rows={lines.map((line) => ({
            ...line,
            statusLabel: line.onLeave ? "On leave" : line.active ? "On shift" : "Deactivated",
            loadLabel: `${line.loadShare}%`,
            executionLabel: `${line.executionRate}%`,
            conversionLabel: `${line.conversionRate}%`,
          }))}
        />
      </div>
    </>
  );
}
