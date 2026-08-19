import React, { useMemo } from "react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import { agentScorecards, teamTotals } from "@/lib/agents";
import { formatMinutes } from "@/lib/touchTime";

// M6. Agent Scorecard — judge the agent on data, and separate what they achieved from
// what they followed.
//
// §28 is structural about this: outcome and process compliance are two different things
// and must never be merged into one number. So they are two tables, labelled, with the
// lead mix the agent was actually handed printed between them. The guard is that the
// outcome table is never shown alone — an agent may convert less because the leads were
// worse, and the system has to say which.

const READ_FIRST = {
  process: { variant: "destructive", label: "Read the process column first" },
  mix: { variant: "warning", label: "Read the lead mix first" },
  outcome: { variant: "secondary", label: "Outcome is the story" },
};

export default function AgentScorecard() {
  const rows = JOURNEYS;
  const cards = useMemo(() => agentScorecards(rows), [rows]);
  const team = useMemo(() => teamTotals(rows), [rows]);

  const outcomeRows = cards.map((card) => ({
    id: `o-${card.agent}`,
    agent: card.agent,
    leadsAssigned: card.outcome.leadsAssigned,
    hotLeads: card.outcome.hotLeads,
    appointments: card.outcome.appointments,
    visits: card.outcome.visits,
    surgeries: card.outcome.surgeries,
    expected: card.expectedSurgeries,
    delta: card.surgeryDelta > 0 ? `+${card.surgeryDelta}` : String(card.surgeryDelta),
    revenue: rupees(card.outcome.revenue),
    recoveryConversions: card.outcome.recoveryConversions,
  }));

  const processRows = cards.map((card) => ({
    id: `p-${card.agent}`,
    agent: card.agent,
    firstResponse: formatMinutes(card.process.avgFirstResponse),
    withinSla: card.process.withinSlaRate,
    calls: card.process.callsAttempted,
    connectedRate: card.process.connectedRate,
    qualificationAccuracy: card.process.qualificationAccuracy,
    followupsDue: card.process.followupsDue,
    followupsCompleted: card.process.followupsCompleted,
    followupsMissed: card.process.followupsMissed,
    whatsapp: card.process.whatsappActivities,
    rcs: card.process.rcsActivities,
    remarksQuality: card.process.remarksQuality,
    reasonsLogged: card.process.reasonsLogged,
    recoverable: card.process.recoverableIdentified,
  }));

  const mixRows = cards.map((card) => ({
    id: `m-${card.agent}`,
    agent: card.agent,
    qualityShare: card.mix.qualityShare,
    hotShare: card.mix.hotShare,
    junkShare: card.mix.junkShare,
    topSource: card.mix.topSource,
    readFirst: READ_FIRST[card.readFirst].label,
  }));

  return (
    <>
      <PageHeader
        screen="M6"
        title="Agent Scorecard"
        subtitle="Outcome and process compliance, kept apart — with the lead mix each agent was handed."
        thesis="§26, §28"
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Team surgeries" value={team.outcome.surgeries} detail={rupees(team.outcome.revenue)} />
          <StatTile
            label="Team first response"
            value={formatMinutes(team.process.avgFirstResponse)}
            detail={`${team.process.withinSlaRate}% inside the 5-minute SLA`}
          />
          <StatTile
            label="Team follow-up compliance"
            value={`${Math.round((team.process.followupsCompleted / Math.max(1, team.process.followupsDue)) * 100)}%`}
            detail={`${team.process.followupsMissed} scheduled calls never attempted`}
          />
          <StatTile
            label="Team qualification accuracy"
            value={`${team.process.qualificationAccuracy}%`}
            detail={`remarks complete on ${team.process.remarksQuality}% of connected calls`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {cards.map((card) => (
            <Badge key={card.agent} variant={READ_FIRST[card.readFirst].variant}>
              {card.agent} — {READ_FIRST[card.readFirst].label.toLowerCase()}
            </Badge>
          ))}
        </div>

        <DataTable
          title="Outcome performance"
          caption="What the agent achieved. Expected surgeries is what that agent's own lead mix would have produced at the team's rate, so a shortfall and bad work stop being the same sentence."
          columns={[
            { key: "agent", label: "Agent" },
            { key: "leadsAssigned", label: "Leads assigned", align: "right" },
            { key: "hotLeads", label: "Hot leads", align: "right" },
            { key: "appointments", label: "Appointments", align: "right" },
            { key: "visits", label: "Visits", align: "right" },
            { key: "surgeries", label: "Surgeries", align: "right" },
            { key: "expected", label: "Expected", align: "right" },
            { key: "delta", label: "Against expected", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "recoveryConversions", label: "Recovery conversions", align: "right" },
          ]}
          rows={outcomeRows}
        />

        <DataTable
          title="Lead mix handed to each agent"
          caption="§28's guard. Without this table the one above it is unreadable, so the two are never shown apart."
          columns={[
            { key: "agent", label: "Agent" },
            { key: "qualityShare", label: "Hot or Warm %", align: "right" },
            { key: "hotShare", label: "Hot %", align: "right" },
            { key: "junkShare", label: "Junk %", align: "right" },
            { key: "topSource", label: "Largest source" },
            { key: "readFirst", label: "Where to look" },
          ]}
          rows={mixRows}
        />

        <DataTable
          title="Process compliance"
          caption="Whether the agent followed the system. Qualification accuracy is the agent's temperature against what the transcript supports; remarks quality is structural completeness against the seven §3.2 parts, never prose style."
          columns={[
            { key: "agent", label: "Agent" },
            { key: "firstResponse", label: "Avg first response", align: "right" },
            { key: "withinSla", label: "Within SLA %", align: "right" },
            { key: "calls", label: "Calls attempted", align: "right" },
            { key: "connectedRate", label: "Connected %", align: "right" },
            { key: "qualificationAccuracy", label: "Qualification accuracy %", align: "right" },
            { key: "followupsDue", label: "Follow-ups due", align: "right" },
            { key: "followupsCompleted", label: "Completed", align: "right" },
            { key: "followupsMissed", label: "Missed", align: "right" },
            { key: "whatsapp", label: "WhatsApp", align: "right" },
            { key: "rcs", label: "RCS/MMS", align: "right" },
            { key: "remarksQuality", label: "Remarks complete %", align: "right" },
            { key: "reasonsLogged", label: "Reasons logged %", align: "right" },
            { key: "recoverable", label: "Recoverable found", align: "right" },
          ]}
          rows={processRows}
        />

        <p className="text-xs text-muted-foreground">
          The flag beside each agent is comparative, not a threshold someone picked: it fires when that agent's
          missed-call rate, SLA rate or remark completeness sits materially below the team's own figure. It says
          which column to read first. It does not say who to fire.
        </p>
      </div>
    </>
  );
}
