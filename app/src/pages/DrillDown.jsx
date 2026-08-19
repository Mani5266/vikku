import React, { useMemo, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import Tabs from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import { DRILL_LEVELS, buildConclusion, drillLevel, periods } from "@/lib/diagnosis";

// L5. Drill-Down Explorer — take a metric from symptom to root cause without leaving the
// screen.
//
// §25 is a fixed ladder, not free slicing: overall → conversion type → disease → source
// and campaign → funnel stage → objection → process gap → agent → specific behaviour.
// Each rung ranks its segments by how much of the change against the previous period it
// explains, so the drill follows the loss rather than the biggest bucket.
//
// The conclusion block at the bottom is §32's seven mandatory fields, assembled from the
// path actually traversed. It cannot be produced without evidence because every line in
// it is a count over the leads in scope.

const WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "15", label: "Last 15 days" },
  { value: "30", label: "Last 30 days" },
];

export default function DrillDown() {
  const [days, setDays] = useState("15");
  const [path, setPath] = useState([]);

  const { current, previous } = useMemo(() => periods(JOURNEYS, Number(days)), [days]);
  const view = useMemo(() => drillLevel(current, previous, path), [current, previous, path]);
  const conclusion = useMemo(() => buildConclusion(view, { days: Number(days) }), [view, days]);

  const segments = view.segments.map((segment) => ({
    id: segment.value,
    value: segment.value,
    leads: segment.leads,
    previousLeads: segment.previousLeads,
    conversions: segment.conversions,
    previousConversions: segment.previousConversions,
    change: segment.previousConversions - segment.conversions === 0
      ? "0"
      : `${segment.conversions - segment.previousConversions > 0 ? "+" : "−"}${Math.abs(
          segment.conversions - segment.previousConversions
        )}`,
    conversionRate: segment.conversionRate,
    previousConversionRate: segment.previousConversionRate,
    shareOfDrop: view.drop > 0 ? segment.shareOfDrop : "—",
  }));

  return (
    <>
      <PageHeader
        screen="L5"
        title="Drill-Down Explorer"
        subtitle="The nine levels of §25, ranked at every rung by how much of the change each segment explains."
        thesis="§25, §32, §33"
        actions={
          <Tabs items={WINDOWS} value={days} onChange={(next) => { setDays(next); setPath([]); }} className="w-fit" />
        }
      />

      <div className="space-y-6 p-6">
        {/* Breadcrumb — §25's requirement that the thread is never lost. */}
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setPath([])}
            className={`rounded-md px-2 py-1 ${path.length === 0 ? "bg-accent font-medium" : "hover:bg-accent"}`}
          >
            Level 1 · Overall conversions
          </button>
          {path.map((step, index) => (
            <React.Fragment key={`${step.key}-${step.value}`}>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setPath(path.slice(0, index + 1))}
                className={`rounded-md px-2 py-1 ${
                  index === path.length - 1 ? "bg-accent font-medium" : "hover:bg-accent"
                }`}
              >
                Level {index + 2} · {DRILL_LEVELS.find((l) => l.key === step.key)?.label}: {step.value}
              </button>
            </React.Fragment>
          ))}
          {path.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPath([])}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Leads in scope" value={view.leads} detail={`${view.previousLeads} in the previous ${days} days`} />
          <StatTile
            label="Conversions"
            value={view.conversions}
            detail={`${view.previousConversions} in the previous period`}
            tone={view.drop > 0 ? "bad" : view.drop < 0 ? "good" : "default"}
          />
          <StatTile
            label={view.drop > 0 ? "Conversions lost" : "Conversions gained"}
            value={Math.abs(view.drop)}
            detail={view.drop > 0 ? "attributed in the table below" : "no drop to attribute this period"}
            tone={view.drop > 0 ? "bad" : "good"}
          />
          <StatTile label="Revenue in scope" value={rupees(conclusion.revenueAtStake)} detail="completed treatments only" />
        </div>

        {view.childLevel ? (
          <DataTable
            title={`Level ${view.levelIndex + 2} · ${view.childLevel.label}`}
            caption={
              view.drop > 0
                ? "Ranked by how many of the period's missing conversions each segment accounts for. Select a row to drill into it."
                : "Conversions did not fall this period, so the table is ranked by size. Select a row to drill into it."
            }
            columns={[
              { key: "value", label: view.childLevel.label },
              { key: "leads", label: "Leads", align: "right" },
              { key: "previousLeads", label: "Previous", align: "right" },
              { key: "conversions", label: "Conversions", align: "right" },
              { key: "previousConversions", label: "Previous", align: "right" },
              { key: "change", label: "Change", align: "right" },
              { key: "conversionRate", label: "Rate %", align: "right" },
              { key: "previousConversionRate", label: "Previous %", align: "right" },
              { key: "shareOfDrop", label: "% of drop explained", align: "right" },
            ]}
            rows={segments}
          />
        ) : (
          <div className="card-surface p-4 text-sm">
            <p className="font-medium">Level 9 reached — specific behaviour</p>
            <p className="mt-1 text-muted-foreground">
              This is the bottom of the §25 ladder. The conclusion below is now about named leads and a named
              behaviour, which is the point the thesis says an action may finally be assigned.
            </p>
          </div>
        )}

        {view.childLevel && (
          <div className="flex flex-wrap gap-1.5">
            {view.segments.slice(0, 12).map((segment) => (
              <Button
                key={segment.value}
                size="sm"
                variant="outline"
                onClick={() => setPath([...path, { key: view.childLevel.key, value: segment.value }])}
              >
                {segment.value}
                <Badge variant="secondary">{segment.leads}</Badge>
              </Button>
            ))}
          </div>
        )}

        {/* §32 / §33 — the conclusion, in the worked format the thesis uses. */}
        <div className="card-surface">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Conclusion</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assembled from the path above, in the §33 format. Every line is a count over the {view.leads} leads
              currently in scope — §3.4 forbids a decision without evidence, so there is nothing here that is not
              derived from records.
            </p>
          </div>
          <dl className="divide-y text-sm">
            {[
              ["Finding", conclusion.finding],
              ["Drill-down", conclusion.drillDown],
              ["Stage finding", conclusion.stageFinding],
              ["Root cause", conclusion.rootCause],
              ["Corrective action", conclusion.correctiveAction],
              ["Evidence", conclusion.evidence],
              ["Responsible person", conclusion.responsiblePerson],
              ["Expected result", conclusion.expectedResult],
              ["Review date", conclusion.reviewDate],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd>
                  {Array.isArray(value) ? (
                    <ul className="list-disc space-y-0.5 pl-4">
                      {value.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <DataTable
          title="Leads in scope"
          caption="The records every number above was computed from. Downloadable, so a conclusion can be taken into a review with its evidence attached."
          columns={[
            { key: "patient_name", label: "Patient" },
            { key: "phone_number", label: "Mobile" },
            { key: "disease", label: "Disease" },
            { key: "source", label: "Source" },
            { key: "campaign", label: "Campaign" },
            { key: "agent_name", label: "Agent" },
            { key: "temperature", label: "Quality" },
            { key: "drop_stage", label: "Exited at" },
            { key: "loss_reason", label: "Reason" },
            { key: "status", label: "Status" },
          ]}
          rows={view.rows.map((r) => ({
            id: r.id,
            patient_name: r.patient_name,
            phone_number: r.phone_number,
            disease: r.disease,
            source: r.source,
            campaign: r.campaign,
            agent_name: r.agent_name,
            temperature: r.temperature,
            drop_stage: r.drop_stage || "Converted",
            loss_reason: r.loss_reason || "—",
            status: r.status,
          }))}
        />
      </div>
    </>
  );
}
