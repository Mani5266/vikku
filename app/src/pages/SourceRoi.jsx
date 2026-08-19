import React, { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import Tabs from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { JOURNEYS, SOURCE_SPEND } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import { ROI_VIEWS, applyRoiView, campaignRoi, qualityVersusExecution, sourceRoi } from "@/lib/roi";

// L2. Source & Campaign ROI — which spend actually produces surgeries?
//
// §5's rule is the whole screen: lead count alone must never judge a campaign. So the
// default sort is cost per surgery, the seven §5 questions are pre-built views rather
// than things to work out, and the guard is enforced at the bottom — a campaign cannot be
// called "not working" until the split between lead quality and follow-up execution has
// been read, which is the same distinction §28 makes about agents.

const LEVELS = [
  { value: "source", label: "By source" },
  { value: "campaign", label: "By campaign" },
];

const COLUMNS = (label) => [
  { key: "value", label },
  { key: "spendLabel", label: "Spend", align: "right" },
  { key: "leads", label: "Leads", align: "right" },
  { key: "connectedRate", label: "Connected %", align: "right" },
  { key: "quality", label: "Quality", align: "right" },
  { key: "appointments", label: "Appointments", align: "right" },
  { key: "visits", label: "Visits", align: "right" },
  { key: "surgeryAdvised", label: "Advised", align: "right" },
  { key: "surgeries", label: "Surgeries", align: "right" },
  { key: "revenueLabel", label: "Revenue", align: "right" },
  { key: "cplLabel", label: "Cost / lead", align: "right" },
  { key: "cpaLabel", label: "Cost / appointment", align: "right" },
  { key: "cpsLabel", label: "Cost / surgery", align: "right" },
  { key: "roasLabel", label: "Return on spend", align: "right" },
  { key: "junkRate", label: "Junk %", align: "right" },
];

function present(line) {
  return {
    ...line,
    id: line.value,
    spendLabel: line.spend > 0 ? rupees(line.spend) : "no media spend",
    revenueLabel: rupees(line.revenue),
    cplLabel: line.costPerLead === null ? "—" : rupees(line.costPerLead),
    cpaLabel: line.costPerAppointment === null ? "—" : rupees(line.costPerAppointment),
    cpsLabel: line.costPerSurgery === null ? "—" : rupees(line.costPerSurgery),
    roasLabel: line.roas === null ? "—" : `${line.roas}×`,
  };
}

export default function SourceRoi() {
  const rows = JOURNEYS;
  const [level, setLevel] = useState("source");
  const [viewKey, setViewKey] = useState("cost");
  const [selected, setSelected] = useState(null);

  const lines = useMemo(() => (level === "source" ? sourceRoi(rows) : campaignRoi(rows)), [rows, level]);
  const { view, lines: sorted } = useMemo(() => applyRoiView(lines, viewKey), [lines, viewKey]);

  const totalSpend = Object.values(SOURCE_SPEND).reduce((a, b) => a + b, 0);
  const totalRevenue = lines.reduce((sum, l) => sum + l.revenue, 0);
  const totalSurgeries = lines.reduce((sum, l) => sum + l.surgeries, 0);

  const scoped = useMemo(() => {
    if (!selected) return null;
    return level === "source"
      ? rows.filter((r) => r.source === selected)
      : rows.filter((r) => r.campaign === selected);
  }, [rows, level, selected]);
  const split = useMemo(() => (scoped ? qualityVersusExecution(scoped) : null), [scoped]);

  return (
    <>
      <PageHeader
        screen="L2"
        title="Source & Campaign ROI"
        subtitle="Cost per surgery first. Lead count is the last column anyone should judge a campaign on."
        thesis="§5, §26"
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Media spend (90 days)" value={rupees(totalSpend)} detail="from the configured spend table" />
          <StatTile label="Revenue recorded" value={rupees(totalRevenue)} detail={`${totalSurgeries} completed surgeries`} />
          <StatTile
            label="Blended cost per surgery"
            value={totalSurgeries ? rupees(Math.round(totalSpend / totalSurgeries)) : "—"}
            detail="paid channels only, across all sources"
          />
          <StatTile
            label="Return on spend"
            value={totalSpend ? `${Math.round((totalRevenue / totalSpend) * 100) / 100}×` : "—"}
            detail="revenue recorded against media spend"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs items={LEVELS} value={level} onChange={(next) => { setLevel(next); setSelected(null); }} className="w-fit" />
          <Tabs
            items={ROI_VIEWS.map((v) => ({ value: v.key, label: v.label }))}
            value={viewKey}
            onChange={setViewKey}
            className="w-fit"
          />
        </div>

        <DataTable
          title={`${view.label} — ${level === "source" ? "by source" : "by campaign"}`}
          caption={
            level === "campaign"
              ? "Campaign spend is apportioned from its source by lead share. That is an assumption, not a figure from the ad platform — replace it with real campaign spend before making budget decisions on this column."
              : "Sources with no media spend show no cost columns. Zero spend is not infinite return; it means the channel is not bought."
          }
          columns={COLUMNS(level === "source" ? "Source" : "Campaign")}
          rows={sorted.map(present)}
        />

        <div>
          <p className="mb-2 text-sm font-semibold">Before flagging anything as "not working"</p>
          <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
            §5 and §28 make the same distinction, and this screen will not let it be skipped: a channel that
            looks bad may have delivered reachable, qualified leads that were then worked badly. Pick a row to
            see which of the two it was.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lines.map((line) => (
              <button
                key={line.value}
                type="button"
                onClick={() => setSelected(selected === line.value ? null : line.value)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selected === line.value ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {line.value}
              </button>
            ))}
          </div>

          {split && (
            <div className="mt-3 card-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{selected}</h3>
                <Badge variant="outline">{`lead quality ${split.leadQualityScore}%`}</Badge>
                <Badge variant="outline">{`execution ${split.executionScore}%`}</Badge>
                <Badge variant="secondary">{`junk ${split.junkRate}%`}</Badge>
              </div>
              <p className="mt-2 flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{split.verdict}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Lead quality is the share of leads that qualified Hot or Warm. Execution combines the share of
                qualified leads that received their full scheduled follow-up with the share of all leads
                contacted inside the 5-minute SLA.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Spend is configuration, not measurement — it lives in <code>SOURCE_SPEND</code> in{" "}
          <code>src/store/journeys.js</code>. Every cost figure on this screen is only as honest as that table,
          which is why it is one edit away rather than buried in a calculation.
        </p>
      </div>
    </>
  );
}
