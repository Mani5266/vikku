import React, { useMemo, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import { BarList } from "@/components/shared/charts";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import Tabs from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JOURNEYS } from "@/store/journeys";
import {
  funnel,
  pct,
  recoveryRates,
  revenueMetrics,
  rupees,
  stageFunnel,
} from "@/lib/funnel";

// M3. Funnel Dashboard — where in the lifecycle do leads actually die?
//
// The eleven §26 transitions, each with its entry population, its rate and its drop.
// The guard is the reason the drop column is clickable: a stage may not report a drop it
// cannot explain lead by lead, so selecting one lists those leads with the reason each
// carries — and says plainly how many are still open and therefore have no reason yet.

const DIMENSIONS = [
  { value: "all", label: "All leads" },
  { value: "source", label: "Source" },
  { value: "campaign", label: "Campaign" },
  { value: "disease", label: "Disease" },
  { value: "branch", label: "Branch" },
  { value: "doctor_name", label: "Doctor" },
  { value: "agent_name", label: "Agent" },
  { value: "temperature", label: "Lead quality" },
];

export default function FunnelDashboard() {
  const rows = JOURNEYS;
  const [dimension, setDimension] = useState("all");
  const [slice, setSlice] = useState("All leads");
  const [openStage, setOpenStage] = useState(null);

  const values = useMemo(() => {
    if (dimension === "all") return ["All leads"];
    return [...new Set(rows.map((r) => r[dimension]))].sort();
  }, [rows, dimension]);

  const scoped = useMemo(() => {
    if (dimension === "all") return rows;
    return rows.filter((r) => r[dimension] === slice);
  }, [rows, dimension, slice]);

  const stages = useMemo(() => stageFunnel(scoped), [scoped]);

  // Not a waterfall: each transition is counted over its own entry population, so the honest
  // picture is which transition loses the most people — a bar list, not a funnel silhouette.
  const biggestDrops = useMemo(
    () =>
      [...stages]
        .filter((stage) => stage.dropped > 0)
        .sort((a, b) => b.dropped - a.dropped)
        .slice(0, 6)
        .map((stage) => ({ name: stage.label, value: stage.dropped })),
    [stages]
  );
  const total = useMemo(() => funnel(scoped), [scoped]);
  const recovery = useMemo(() => recoveryRates(scoped), [scoped]);
  const revenue = useMemo(() => revenueMetrics(scoped), [scoped]);

  const stageRows = stages.map((stage) => ({
    id: stage.key,
    stage: stage.label,
    entered: stage.entered,
    advanced: stage.advanced,
    rate: stage.rate,
    dropped: stage.dropped,
    exit: stage.dropLabel,
  }));

  const open = stages.find((s) => s.key === openStage) || null;
  const openRows = open
    ? open.dropRows.map((r) => ({
        id: r.id,
        patient_name: r.patient_name,
        phone_number: r.phone_number,
        disease: r.disease,
        source: r.source,
        agent_name: r.agent_name,
        temperature: r.temperature,
        status: r.status,
        reason: r.loss_reason || (r.status === "Pending" ? "still open — no reason yet" : "—"),
        recoverable: r.loss_category ? (r.recoverable ? "Yes" : "No") : "—",
      }))
    : [];
  const openPending = open ? open.dropRows.filter((r) => r.status === "Pending").length : 0;

  return (
    <>
      <PageHeader
        screen="M3"
        title="Funnel Dashboard"
        subtitle="The eleven §26 transitions, with the entry population, the rate and the drop at each one."
        thesis="§4, §17, §26"
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Leads in scope" value={total.leads} detail={`${total.connectedRate}% connected`} />
          <StatTile
            label="Overall lead-to-conversion"
            value={`${total.admissionRate}%`}
            detail={`${revenue.surgeries} completed surgeries`}
          />
          <StatTile
            label="Lead-to-revenue"
            value={rupees(revenue.revenuePerLead)}
            detail={`${rupees(revenue.revenue)} recorded in 90 days`}
          />
          <StatTile
            label="Hot-to-appointment"
            value={`${pct(
              scoped.filter((r) => ["Hot", "Warm"].includes(r.temperature) && r.appointment_booked).length,
              total.quality
            )}%`}
            detail={`of ${total.quality} Hot or Warm leads — the §26 named rate`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs items={DIMENSIONS} value={dimension} onChange={(next) => {
            setDimension(next);
            setSlice(next === "all" ? "All leads" : [...new Set(rows.map((r) => r[next]))].sort()[0]);
            setOpenStage(null);
          }} className="w-fit" />
          {dimension !== "all" && (
            <div className="flex flex-wrap gap-1">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSlice(value);
                    setOpenStage(null);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    slice === value ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </div>

        <SectionCard
          title="Where the most leads are dropping"
          caption="The six transitions losing the most leads in this slice. Each one is counted over its own entry population, so these are not stacked stages — they are six separate leaks, ranked."
        >
          <BarList data={biggestDrops} />
        </SectionCard>

        <DataTable
          title={`Stage funnel — ${dimension === "all" ? "all leads" : `${slice}`}`}
          caption="Each row is a transition, counted over its own entry population — not a single cumulative waterfall. Click a drop to see the leads behind it."
          columns={[
            { key: "stage", label: "Transition" },
            { key: "entered", label: "Entered", align: "right" },
            { key: "advanced", label: "Advanced", align: "right" },
            { key: "rate", label: "Rate %", align: "right" },
            { key: "dropped", label: "Dropped", align: "right" },
            { key: "exit", label: "Exit bucket" },
          ]}
          rows={stageRows}
        />

        <div className="flex flex-wrap gap-1.5">
          {stages
            .filter((stage) => stage.dropped > 0)
            .map((stage) => (
              <Button
                key={stage.key}
                size="sm"
                variant={openStage === stage.key ? "default" : "outline"}
                onClick={() => setOpenStage(openStage === stage.key ? null : stage.key)}
              >
                {stage.dropLabel}
                <Badge variant="secondary">{stage.dropped}</Badge>
              </Button>
            ))}
        </div>

        {open && (
          <DataTable
            title={`Leads that exited at — ${open.dropLabel}`}
            caption={`${open.dropped} leads. ${openPending} are still inside an active follow-up plan and so carry no closure reason yet; the rest each carry a §23 reason.`}
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "phone_number", label: "Mobile" },
              { key: "disease", label: "Disease" },
              { key: "source", label: "Source" },
              { key: "agent_name", label: "Agent" },
              { key: "temperature", label: "Quality" },
              { key: "status", label: "Status" },
              { key: "reason", label: "Reason" },
              { key: "recoverable", label: "Recoverable" },
            ]}
            rows={openRows}
          />
        )}

        <DataTable
          title="Recovery rates"
          caption="§26's three second chances. Each one is a pool the system either works or wastes."
          columns={[
            { key: "metric", label: "Metric" },
            { key: "pool", label: "Pool", align: "right" },
            { key: "recovered", label: "Recovered", align: "right" },
            { key: "rate", label: "Rate %", align: "right" },
            { key: "note", label: "Read as" },
          ]}
          rows={[
            {
              id: "nc",
              metric: "Not Connected recovery",
              pool: recovery.notConnected,
              recovered: recovery.notConnectedRecovered,
              rate: recovery.notConnectedRecoveryRate,
              note: "Leads that failed the first attempt and were later reached",
            },
            {
              id: "ns",
              metric: "No-show recovery",
              pool: recovery.noShows,
              recovered: recovery.noShowsRecovered,
              rate: recovery.noShowRecoveryRate,
              note: `No-show rate is ${recovery.noShowRate}% of booked appointments`,
            },
            {
              id: "ex",
              metric: "Expired lead recovery",
              pool: recovery.expired,
              recovered: recovery.reactivationConverted,
              rate: recovery.expiredRecoveryRate,
              note: `${recovery.reactivated} reactivation sequences were sent`,
            },
          ]}
        />
      </div>
    </>
  );
}
