import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import { fifteenDayReport } from "@/lib/diagnosis";

// L6. 15-Day Diagnostic Report — the recurring management document the whole thesis is
// built to produce.
//
// §32's structure exactly: Week 1, Week 2, the fifteen-day total, each answering the two
// questions, and a conclusion carrying the seven mandatory fields in the §33 worked
// format. The report opens on the comparison against the previous fifteen days, because
// a corrective action that is never scored against an outcome is a note, not a decision.

export default function DiagnosticReport() {
  const report = useMemo(() => fifteenDayReport(JOURNEYS), []);
  const [week1, week2, overall] = report.blocks;
  const { comparison, conclusion } = report;

  const conversionDelta = comparison.currentConversions - comparison.previousConversions;

  return (
    <>
      <PageHeader
        screen="L6"
        title="15-Day Diagnostic Report"
        subtitle="Week 1, Week 2 and the fifteen-day total — why leads converted, why they did not, and what follows."
        thesis="§32, §33"
      />

      <div className="space-y-8 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Leads (15 days)" value={overall.leads} detail={`${comparison.previousLeads} in the previous 15 days`} />
          <StatTile
            label="Conversions"
            value={overall.conversions}
            detail={`${comparison.previousConversions} previously — ${conversionDelta >= 0 ? "+" : "−"}${Math.abs(conversionDelta)}`}
            tone={conversionDelta < 0 ? "bad" : "good"}
          />
          <StatTile label="Conversion rate" value={`${overall.conversionRate}%`} detail="completed treatments per lead" />
          <StatTile label="Revenue recorded" value={rupees(overall.revenue)} detail="from this 15-day cohort" />
        </div>

        <DataTable
          title="Period summary"
          caption="§32's three windows. Week 2 is the most recent seven days."
          columns={[
            { key: "label", label: "Window" },
            { key: "leads", label: "Leads", align: "right" },
            { key: "connected", label: "Connected", align: "right" },
            { key: "conversions", label: "Conversions", align: "right" },
            { key: "conversionRate", label: "Rate %", align: "right" },
            { key: "revenueLabel", label: "Revenue", align: "right" },
          ]}
          rows={report.blocks.map((block) => ({
            id: block.key,
            label: block.label,
            leads: block.leads,
            connected: block.connected,
            conversions: block.conversions,
            conversionRate: block.conversionRate,
            revenueLabel: rupees(block.revenue),
          }))}
        />

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Why did leads convert?</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The eight §32 factors, per window. Each cell carries the number of converted patients behind it, so a
            "best" with two patients behind it cannot be mistaken for a pattern.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {report.blocks.map((block) => (
              <DataTable
                key={block.key}
                title={block.label}
                download={false}
                columns={[
                  { key: "factor", label: "Factor" },
                  { key: "value", label: "Best" },
                  { key: "leads", label: "Patients", align: "right" },
                ]}
                rows={block.whyConverted.map((line, index) => ({ id: `${block.key}-c${index}`, ...line }))}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Why did leads not convert?</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable
              title="Week 1"
              download={false}
              columns={[
                { key: "factor", label: "Factor" },
                { key: "value", label: "Detail" },
                { key: "leads", label: "Leads", align: "right" },
              ]}
              rows={week1.whyNotConverted.map((line, index) => ({ id: `w1-${index}`, ...line }))}
            />
            <DataTable
              title="Week 2"
              download={false}
              columns={[
                { key: "factor", label: "Factor" },
                { key: "value", label: "Detail" },
                { key: "leads", label: "Leads", align: "right" },
              ]}
              rows={week2.whyNotConverted.map((line, index) => ({ id: `w2-${index}`, ...line }))}
            />
          </div>
          <DataTable
            title="Overall 15 days"
            caption="The version to take into the meeting — downloadable, so the numbers arrive with the argument."
            columns={[
              { key: "factor", label: "Factor" },
              { key: "value", label: "Detail" },
              { key: "leads", label: "Leads", align: "right" },
            ]}
            rows={overall.whyNotConverted.map((line, index) => ({ id: `all-${index}`, ...line }))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Conclusion</h2>
          <div className="card-surface">
            <dl className="divide-y text-sm">
              {[
                ["Finding", conclusion.finding],
                ["Drill-down", conclusion.drillDown],
                ["Stage finding", conclusion.stageFinding],
                ["Root cause", conclusion.rootCause],
                ["Evidence", conclusion.evidence],
                ["Corrective action", conclusion.correctiveAction],
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
          <p className="text-xs text-muted-foreground">
            This conclusion is generated from the fifteen-day cohort. To produce one about a narrower slice — a
            campaign, a disease, one agent's behaviour — traverse it in the{" "}
            <Link to="/drill" className="underline">
              drill-down
            </Link>{" "}
            and read the conclusion block there; it is the same seven fields over the leads you land on.
          </p>
        </section>
      </div>
    </>
  );
}
