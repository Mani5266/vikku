import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox, PhoneMissed, Timer } from "lucide-react";
import { GreetingHeader } from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import SectionCard from "@/components/shared/SectionCard";
import { AreaLineChart, DonutChart, FunnelChart } from "@/components/shared/charts";
import { changeOverWindow, dailySeries, shareOf } from "@/lib/trends";
import { useSession } from "@/store/session";
import Tabs from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/store/store";
import { JOURNEYS } from "@/store/journeys";
import {
  TOUCH_SLA_MINUTES,
  avgTouchMinutes,
  complianceStats,
  funnel,
  funnelByDimension,
  slaBreaches,
  temperatureAudit,
  touchTimeDistribution,
} from "@/lib/funnel";
import { formatMinutes, taskQueue } from "@/lib/touchTime";

// M1. Manager Dashboard — the report the manager writes by hand today, computed.
//
// The requirement conversation's objection to the current sheet is not that it lacks
// columns; it is that a human fills it in, so a wrong number and an honest number look
// identical. Every figure here is derived from journey records and every one of them is
// downloadable, so the conversation moves from "the leads were poor quality" to a row
// with a patient, an agent and a timestamp on it.

const DIMENSIONS = [
  { value: "source", label: "Source" },
  { value: "campaign", label: "Campaign" },
  { value: "agent_name", label: "Agent" },
  { value: "disease", label: "Disease" },
  { value: "temperature", label: "Temperature" },
  { value: "branch", label: "Branch" },
];

const FUNNEL_COLUMNS = (label) => [
  { key: "value", label },
  { key: "leads", label: "Leads", align: "right" },
  { key: "connected", label: "Connected", align: "right" },
  { key: "connectedRate", label: "Connected %", align: "right" },
  { key: "quality", label: "Quality", align: "right" },
  { key: "qualityRate", label: "Quality %", align: "right" },
  { key: "op", label: "OPD", align: "right" },
  { key: "ip", label: "IP", align: "right" },
  { key: "admissionRate", label: "Admission %", align: "right" },
  { key: "pending", label: "Pending", align: "right" },
  { key: "avgTouch", label: "Avg first touch", align: "right" },
  { key: "complianceRate", label: "Follow-up %", align: "right" },
];

export default function ManagerDashboard() {
  const { leads, interactionsFor, communicationsFor } = useStore();
  const { user } = useSession();
  const [dimension, setDimension] = useState("source");
  const [trend, setTrend] = useState("leads");

  const rows = JOURNEYS;
  const total = useMemo(() => funnel(rows), [rows]);
  const compliance = useMemo(() => complianceStats(rows), [rows]);
  const audit = useMemo(() => temperatureAudit(rows), [rows]);
  const breaches = useMemo(() => slaBreaches(rows), [rows]);

  const funnelRows = useMemo(
    () =>
      funnelByDimension(rows, dimension).map((line) => ({
        ...line,
        avgTouch: formatMinutes(line.avgTouchMinutes),
      })),
    [rows, dimension]
  );

  const touchRows = useMemo(() => touchTimeDistribution(rows), [rows]);

  // The trend band. Every delta names the window it is measured against — "18.5%" on its own is
  // exactly the kind of unsourced figure this product exists to replace.
  const series = useMemo(
    () =>
      dailySeries(rows, {
        days: 14,
        measure:
          trend === "leads" ? (group) => group.length : (group) => group.filter((r) => r.ip_admit).length,
      }),
    [rows, trend]
  );

  const deltas = useMemo(
    () => ({
      leads: changeOverWindow(rows, { measure: (g) => g.length }),
      admissions: changeOverWindow(rows, { measure: (g) => g.filter((r) => r.ip_admit).length }),
      breaches: changeOverWindow(rows, {
        measure: (g) =>
          g.filter((r) => r.first_touch_minutes !== null && r.first_touch_minutes > TOUCH_SLA_MINUTES).length,
      }),
      missed: changeOverWindow(rows, { measure: (g) => complianceStats(g).missed }),
    }),
    [rows]
  );

  const sourceMixRows = useMemo(() => shareOf(rows, "source"), [rows]);
  const sourceOrder = useMemo(() => sourceMixRows.map((slice) => slice.name), [sourceMixRows]);

  // The first five transitions: the shape of the drop, above the table that proves it.
  const funnelStages = useMemo(
    () => [
      { label: "Leads", value: total.leads },
      { label: "Connected", value: total.connected },
      { label: "Hot or Warm", value: total.quality },
      { label: "Reached OPD", value: total.op },
      { label: "Admitted", value: total.ip },
    ],
    [total]
  );

  const complianceRows = useMemo(
    () =>
      funnelByDimension(rows, "agent_name").map((line) => {
        const group = rows.filter((r) => r.agent_name === line.value);
        const stats = complianceStats(group);
        const agentAudit = temperatureAudit(group);
        return {
          value: line.value,
          leads: line.leads,
          required: stats.required,
          done: stats.done,
          missed: stats.missed,
          rate: stats.rate,
          avgTouch: formatMinutes(avgTouchMinutes(group)),
          slaMet: group.filter((r) => r.first_touch_minutes !== null && r.first_touch_minutes <= TOUCH_SLA_MINUTES)
            .length,
          inflated: agentAudit.inflated,
          mismatchRate: agentAudit.mismatchRate,
        };
      }),
    [rows]
  );

  const mismatchRows = useMemo(
    () =>
      audit.rows.map((r) => ({
        id: r.id,
        patient_name: r.patient_name,
        agent_name: r.agent_name,
        source: r.source,
        agent_temperature: r.temperature,
        ai_temperature: r.ai_temperature,
        followups: `${r.followups_done}/${r.followups_required}`,
        status: r.status,
      })),
    [audit]
  );

  // Live queue — the nine leads in the store, which is where an alert actually fires.
  const liveTasks = useMemo(
    () => taskQueue(leads, interactionsFor, communicationsFor),
    [leads, interactionsFor, communicationsFor]
  );
  const liveBreaches = liveTasks.filter((t) => t.touch.state === "breached");
  const liveBacklog = liveTasks.reduce((sum, t) => sum + t.compliance.missed, 0);

  const dimensionLabel = DIMENSIONS.find((d) => d.value === dimension).label;

  return (
    <>
      <GreetingHeader
        screen="M1"
        name={user?.name}
        purpose="The funnel, the response clock and the follow-up gap — computed from records, not typed into a sheet."
        meta={<span className="text-sm text-muted-foreground">Manager Dashboard · last 90 days</span>}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Leads (90 days)"
            value={total.leads.toLocaleString("en-IN")}
            icon={Inbox}
            delta={deltas.leads.change}
            detail={`${total.connectedRate}% connected · ${total.qualityRate}% Hot or Warm`}
          />
          <StatTile
            label="Admissions"
            value={total.ip.toLocaleString("en-IN")}
            icon={CheckCircle2}
            delta={deltas.admissions.change}
            detail={`${total.admissionRate}% of leads · ${total.op} reached OPD`}
          />
          <StatTile
            label={`First touch beyond ${TOUCH_SLA_MINUTES} min`}
            value={breaches.length.toLocaleString("en-IN")}
            icon={Timer}
            tone="bad"
            delta={deltas.breaches.change}
            deltaGood="down"
            detail={`${Math.round((breaches.length / total.leads) * 100)}% of leads · average ${formatMinutes(
              avgTouchMinutes(rows)
            )}`}
          />
          <StatTile
            label="Scheduled calls never attempted"
            value={compliance.missed.toLocaleString("en-IN")}
            icon={PhoneMissed}
            tone={compliance.rate < 90 ? "bad" : "good"}
            delta={deltas.missed.change}
            deltaGood="down"
            detail={`${compliance.rate}% of ${compliance.required} scheduled calls were made`}
          />
        </div>

        {/* The chart band — two thirds and one third, the split the whole product uses. Both cards
            carry their numbers into a table further down the screen, so nothing here is only a
            picture. */}
        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title={trend === "leads" ? "Leads per day" : "Admissions per day"}
            caption="Last 14 days of the seeded window."
            control={
              <Tabs
                items={[
                  { value: "leads", label: "Leads" },
                  { value: "admissions", label: "Admissions" },
                ]}
                value={trend}
                onChange={setTrend}
                className="w-fit"
              />
            }
          >
            <AreaLineChart data={series} />
          </SectionCard>

          <SectionCard title="Where the leads came from" caption="Share of the 90-day window.">
            <DonutChart data={sourceMixRows} names={sourceOrder} totalLabel="Leads" />
          </SectionCard>
        </div>

        <SectionCard
          title="Where the funnel loses them"
          caption="Each stage carries the percentage of the stage above it — the only question a funnel is asked."
        >
          <FunnelChart stages={funnelStages} />
        </SectionCard>

        {(liveBreaches.length > 0 || liveBacklog > 0) && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Live alerts on today's queue</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {liveBreaches.length > 0 && (
                  <li>
                    {liveBreaches.length} lead{liveBreaches.length > 1 ? "s" : ""} past the {TOUCH_SLA_MINUTES}-minute
                    SLA: {liveBreaches.map((t) => `${t.lead.patient_name} (${t.lead.agent_name})`).join(", ")}
                  </li>
                )}
                {liveBacklog > 0 && <li>{liveBacklog} scheduled call(s) from earlier protocol days still unattempted</li>}
              </ul>
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Funnel — drill by dimension</h2>
            <Tabs items={DIMENSIONS} value={dimension} onChange={setDimension} className="w-fit" />
          </div>
          <DataTable
            title={`Funnel by ${dimensionLabel.toLowerCase()}`}
            caption="Step 1 of the §25 drill-down. Switch the dimension to follow a drop to its cause."
            columns={FUNNEL_COLUMNS(dimensionLabel)}
            rows={funnelRows}
            footer={{
              value: "All",
              leads: total.leads,
              connected: total.connected,
              connectedRate: total.connectedRate,
              quality: total.quality,
              qualityRate: total.qualityRate,
              op: total.op,
              ip: total.ip,
              admissionRate: total.admissionRate,
              pending: total.pending,
              avgTouch: formatMinutes(avgTouchMinutes(rows)),
              complianceRate: compliance.rate,
            }}
          />
        </div>

        <DataTable
          title="First response time against outcome"
          caption={`The gradient down the last column is the argument: speed converts. SLA ${TOUCH_SLA_MINUTES} minutes.`}
          columns={[
            { key: "band", label: "First touch" },
            { key: "leads", label: "Leads", align: "right" },
            { key: "share", label: "% of leads", align: "right" },
            { key: "connected", label: "Connected", align: "right" },
            { key: "connectedRate", label: "Connected %", align: "right" },
            { key: "ip", label: "Admissions", align: "right" },
            { key: "admissionRate", label: "Admission %", align: "right" },
          ]}
          rows={touchRows}
        />

        <DataTable
          title="Follow-up compliance by agent"
          caption="Protocol-scheduled calls against calls logged. A missed call is a process failure with a number on it — §17."
          columns={[
            { key: "value", label: "Agent" },
            { key: "leads", label: "Leads", align: "right" },
            { key: "required", label: "Calls scheduled", align: "right" },
            { key: "done", label: "Calls logged", align: "right" },
            { key: "missed", label: "Never attempted", align: "right" },
            { key: "rate", label: "Compliance %", align: "right" },
            { key: "avgTouch", label: "Avg first touch", align: "right" },
            { key: "slaMet", label: `Within ${TOUCH_SLA_MINUTES} min`, align: "right" },
            { key: "inflated", label: "Over-graded leads", align: "right" },
            { key: "mismatchRate", label: "Mismatch %", align: "right" },
          ]}
          rows={complianceRows}
        />

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Qualification audit</h2>
            <Badge variant={audit.mismatchRate > 15 ? "destructive" : "secondary"}>
              {audit.mismatchRate}% of {audit.reviewed} connected calls disagree
            </Badge>
            <Badge variant="outline">{audit.inflated} graded hotter than the conversation supports</Badge>
          </div>
          <DataTable
            title="Agent temperature against the call transcript"
            caption="§26. The temperature an agent typed is a claim; this is the claim checked against what was said. Every disagreement is listed, and the download carries all of them."
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "agent_name", label: "Agent" },
              { key: "source", label: "Source" },
              { key: "agent_temperature", label: "Agent typed" },
              { key: "ai_temperature", label: "Transcript supports" },
              { key: "followups", label: "Follow-ups" },
              { key: "status", label: "Outcome" },
            ]}
            rows={mismatchRows}
            empty="Every qualification agrees with its transcript."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          The 90-day figures come from <code>src/store/journeys.js</code> — {rows.length} generated journeys, deterministic, so a
          number here can be traced to a row in the <em>Ask</em> explorer. The live alerts read the nine seeded leads,
          which is where a guard actually fires.
        </p>
      </div>
    </>
  );
}
