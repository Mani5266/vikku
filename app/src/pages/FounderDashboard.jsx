import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeIndianRupee, HeartPulse, Inbox, PhoneCall, Recycle, Wallet } from "lucide-react";
import { GreetingHeader } from "@/components/shared/PageHeader";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import SectionCard from "@/components/shared/SectionCard";
import { AreaLineChart, DonutChart, FunnelChart } from "@/components/shared/charts";
import { changeOverWindow, dailySeries, shareOf } from "@/lib/trends";
import { useSession } from "@/store/session";
import { JOURNEYS, SOURCE_SPEND } from "@/store/journeys";
import {
  INDUSTRY_STANDARD,
  TOUCH_SLA_MINUTES,
  avgTouchMinutes,
  complianceStats,
  conversionDrivers,
  funnel,
  lossBreakdown,
  pct,
  recommendedActions,
  revenueMetrics,
  rupees,
  slaBreaches,
  sourceMix,
  stageFunnel,
  temperatureAudit,
} from "@/lib/funnel";
import { segmentation } from "@/lib/recovery";
import { formatMinutes } from "@/lib/touchTime";

// L1. Founder Dashboard — the five questions of §2, each answered with a number and
// the table the number came from.
//
// The screen is laid out as the five questions on purpose. The client's complaint is
// not that dashboards are missing; it is that no dashboard answers "why", so every
// review ends in someone's opinion. Each section here ends in evidence that can be
// downloaded and taken into that review.

function Question({ index, question, answer, children, action }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Question {index}
        </span>
        <h2 className="text-base font-semibold">{question}</h2>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{answer}</p>
      {children}
      {action}
    </section>
  );
}

export default function FounderDashboard() {
  const rows = JOURNEYS;
  const { user } = useSession();

  const total = useMemo(() => funnel(rows), [rows]);
  const mix = useMemo(() => sourceMix(rows), [rows]);
  const compliance = useMemo(() => complianceStats(rows), [rows]);
  const drivers = useMemo(() => conversionDrivers(rows), [rows]);
  const losses = useMemo(() => lossBreakdown(rows), [rows]);
  const actions = useMemo(() => recommendedActions(rows), [rows]);
  const audit = useMemo(() => temperatureAudit(rows), [rows]);

  const arrivals = useMemo(() => dailySeries(rows, { days: 30 }), [rows]);
  const sourceSlices = useMemo(() => shareOf(rows, "source"), [rows]);
  const sourceOrder = useMemo(() => sourceSlices.map((slice) => slice.name), [sourceSlices]);
  const deltas = useMemo(
    () => ({
      leads: changeOverWindow(rows, { measure: (g) => g.length }),
      admissions: changeOverWindow(rows, { measure: (g) => g.filter((r) => r.ip_admit).length }),
    }),
    [rows]
  );
  const journeyStages = useMemo(
    () => [
      { label: "Leads", value: total.leads },
      { label: "Connected", value: total.connected },
      { label: "Hot or Warm", value: total.quality },
      { label: "Reached OPD", value: total.op },
      { label: "Admitted", value: total.ip },
    ],
    [total]
  );
  const breaches = useMemo(() => slaBreaches(rows), [rows]);
  const revenue = useMemo(() => revenueMetrics(rows), [rows]);
  const segments = useMemo(() => segmentation(rows), [rows]);
  const worstStage = useMemo(
    () =>
      [...stageFunnel(rows)]
        .filter((stage) => stage.entered > 0)
        .sort((a, b) => b.dropped - a.dropped)[0] || null,
    [rows]
  );
  const totalSpend = Object.values(SOURCE_SPEND).reduce((sum, value) => sum + value, 0);

  // The 2×2 the whole thesis rests on: response speed against follow-up completion.
  const cohorts = useMemo(() => {
    const within = (r) => r.first_touch_minutes !== null && r.first_touch_minutes <= TOUCH_SLA_MINUTES;
    const cells = [
      ["Within SLA · follow-up complete", (r) => within(r) && r.followup_compliant],
      ["Within SLA · follow-up incomplete", (r) => within(r) && !r.followup_compliant],
      ["SLA missed · follow-up complete", (r) => !within(r) && r.followup_compliant],
      ["SLA missed · follow-up incomplete", (r) => !within(r) && !r.followup_compliant],
    ];
    return cells.map(([label, test]) => {
      const group = rows.filter(test);
      const f = funnel(group);
      return {
        value: label,
        leads: group.length,
        share: pct(group.length, rows.length),
        connectedRate: f.connectedRate,
        op: f.op,
        ip: f.ip,
        admissionRate: f.admissionRate,
      };
    });
  }, [rows]);

  const statusRows = useMemo(() => {
    const statuses = ["Converted", "Pending", "Lost", "Not Connected"];
    return statuses.map((status) => {
      const group = rows.filter((r) => r.status === status);
      return {
        value: status,
        leads: group.length,
        share: pct(group.length, rows.length),
        avgTouch: formatMinutes(avgTouchMinutes(group)),
        followUp: complianceStats(group).rate,
        recoverable: group.filter((r) => r.recoverable).length,
      };
    });
  }, [rows]);

  const benchmark = [
    {
      value: "Quality (Hot or Warm) share of leads",
      ours: `${total.qualityRate}%`,
      standard: `${INDUSTRY_STANDARD.qualityRate}%`,
      gap: `${Math.round((total.qualityRate - INDUSTRY_STANDARD.qualityRate) * 10) / 10}`,
    },
    {
      value: "OPD visits as a share of quality leads",
      ours: `${total.opRate}%`,
      standard: `${INDUSTRY_STANDARD.opFromQuality}%`,
      gap: `${Math.round((total.opRate - INDUSTRY_STANDARD.opFromQuality) * 10) / 10}`,
    },
    {
      value: "Admissions as a share of OPD visits",
      ours: `${total.ipRate}%`,
      standard: `${INDUSTRY_STANDARD.ipFromOp}%`,
      gap: `${Math.round((total.ipRate - INDUSTRY_STANDARD.ipFromOp) * 10) / 10}`,
    },
    {
      value: "Admissions per 100 leads",
      ours: `${total.admissionRate}`,
      standard: `${INDUSTRY_STANDARD.admissionsPer100}`,
      gap: `${Math.round((total.admissionRate - INDUSTRY_STANDARD.admissionsPer100) * 10) / 10}`,
    },
  ];

  const recoverableRevenueNote = `${losses.recoverable} of ${losses.closed} closed leads are marked recoverable — that is the bucket to work before buying more leads.`;

  return (
    <>
      <GreetingHeader
        screen="L1"
        name={user?.name}
        purpose="Founder Dashboard — the five questions of §2, each answered from the record, and each answer downloadable."
        meta={
          <Link
            to="/ask"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-tint px-4 text-sm font-semibold text-primary"
          >
            Ask a question
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="space-y-10 p-6">
        {/* The §L1 header band: leads, connected, conversions, revenue, cost per surgery
            and the recoverable value still sitting in the lost pool. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatTile
            label="Leads (90 days)"
            value={total.leads.toLocaleString("en-IN")}
            icon={Inbox}
            delta={deltas.leads.change}
            detail="every source, every branch"
          />
          <StatTile
            label="Connected"
            value={`${total.connectedRate}%`}
            icon={PhoneCall}
            detail={`${total.connected} leads reached`}
          />
          <StatTile
            label="Conversions"
            value={total.ip.toLocaleString("en-IN")}
            icon={HeartPulse}
            delta={deltas.admissions.change}
            detail={`${total.admissionRate} per 100 leads · standard ${INDUSTRY_STANDARD.admissionsPer100}`}
            tone={total.admissionRate >= INDUSTRY_STANDARD.admissionsPer100 ? "good" : "bad"}
          />
          <StatTile
            label="Revenue"
            value={rupees(revenue.revenue)}
            icon={BadgeIndianRupee}
            detail={`${rupees(revenue.revenuePerLead)} per lead`}
          />
          <StatTile
            label="Cost per surgery"
            value={revenue.surgeries ? rupees(Math.round(totalSpend / revenue.surgeries)) : "—"}
            icon={Wallet}
            detail={`${rupees(totalSpend)} media spend across paid channels`}
          />
          <StatTile
            label="Recoverable, still in the lost pool"
            value={rupees(segments.estimatedValue)}
            icon={Recycle}
            detail={`${segments.winnable} leads — gross package value, not margin`}
          />
        </div>

        {/* The arrival curve sits above the five questions, because the first thing a director
            asks is whether the top of the funnel moved at all before anything below it is blamed. */}
        <SectionCard
          title="Leads arriving per day"
          caption="Last 30 days of the seeded window. The five questions below explain what happened to them."
        >
          <AreaLineChart data={arrivals} height={180} />
        </SectionCard>

        <Question
          index={1}
          question="Where are the leads coming from?"
          answer={`${mix.length} sources produced ${total.leads} leads. The share column is spend-independent, so a source with a small share and a high admission rate is the one to reconsider budget on — not the one with the most leads.`}
        >
          <SectionCard title="Share of leads by source" caption="Share only — spend sits in Campaign ROI.">
            <DonutChart data={sourceSlices} names={sourceOrder} totalLabel="Leads" />
          </SectionCard>

          <DataTable
            title="Source mix and outcome"
            columns={[
              { key: "source", label: "Source" },
              { key: "leads", label: "Leads", align: "right" },
              { key: "share", label: "% of leads", align: "right" },
              { key: "connectedRate", label: "Connected %", align: "right" },
              { key: "qualityRate", label: "Quality %", align: "right" },
              { key: "ip", label: "Admissions", align: "right" },
              { key: "admissionRate", label: "Admission %", align: "right" },
            ]}
            rows={mix}
          />
        </Question>

        <Question
          index={2}
          question="What is happening to every lead after it enters the system?"
          answer={`${breaches.length} of ${total.leads} leads were first contacted after the ${TOUCH_SLA_MINUTES}-minute SLA, average first touch ${formatMinutes(
            avgTouchMinutes(rows)
          )}. ${compliance.missed} of ${compliance.required} scheduled calls were never attempted. ${
            total.pending
          } leads are still open.${
            worstStage
              ? ` The single largest leak is ${worstStage.label}: ${worstStage.dropped} of ${worstStage.entered} leads did not advance.`
              : ""
          }`}
        >
          <SectionCard
            title="Where the funnel loses them"
            caption="Each stage carries the percentage of the stage above it. The tables below name the leads."
            className="mb-4"
          >
            <FunnelChart stages={journeyStages} />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable
              title="Where every lead currently stands"
              columns={[
                { key: "value", label: "Outcome" },
                { key: "leads", label: "Leads", align: "right" },
                { key: "share", label: "% of leads", align: "right" },
                { key: "avgTouch", label: "Avg first touch", align: "right" },
                { key: "followUp", label: "Follow-up %", align: "right" },
                { key: "recoverable", label: "Recoverable", align: "right" },
              ]}
              rows={statusRows}
            />
            <DataTable
              title="Against the industry standard"
              caption="The standard quoted in the requirement conversation: 100 leads → 50 quality → 50% to OPD → 50% admitted."
              columns={[
                { key: "value", label: "Stage" },
                { key: "ours", label: "Ours", align: "right" },
                { key: "standard", label: "Standard", align: "right" },
                { key: "gap", label: "Gap", align: "right" },
              ]}
              rows={benchmark}
            />
          </div>
        </Question>

        <Question
          index={3}
          question="Why are some leads converting?"
          answer={`Compared within the ${drivers.comparable} ${drivers.basis}, so the comparison is between leads that were both reachable and worth working. Admitted patients: first contact ${formatMinutes(
            drivers.converted.avgTouchMinutes
          )} on average, ${drivers.converted.withinSla}% inside the ${TOUCH_SLA_MINUTES}-minute SLA, ${
            drivers.converted.fullyFollowedUp
          }% with their full scheduled follow-up. Leads that closed without an admission: ${formatMinutes(
            drivers.lost.avgTouchMinutes
          )}, ${drivers.lost.withinSla}% inside the SLA, ${drivers.lost.fullyFollowedUp}% fully followed up.`}
        >
          <DataTable
            title="Response speed against follow-up completion"
            caption="Four cohorts, same 90 days. Read the last column top to bottom."
            columns={[
              { key: "value", label: "Cohort" },
              { key: "leads", label: "Leads", align: "right" },
              { key: "share", label: "% of leads", align: "right" },
              { key: "connectedRate", label: "Connected %", align: "right" },
              { key: "op", label: "OPD", align: "right" },
              { key: "ip", label: "Admissions", align: "right" },
              { key: "admissionRate", label: "Admission %", align: "right" },
            ]}
            rows={cohorts}
          />
        </Question>

        <Question
          index={4}
          question="Why are some leads not converting?"
          answer={`${losses.closed} closed leads each carry a category and a reason — "expired" is not one of them (§23). ${recoverableRevenueNote} Separately, ${audit.inflated} leads were graded hotter than their transcript supports, which is the number that makes a temperature count trustworthy or not.`}
        >
          <DataTable
            title="Non-conversion reasons"
            columns={[
              { key: "value", label: "Category" },
              { key: "leads", label: "Leads", align: "right" },
              { key: "share", label: "% of closed", align: "right" },
              { key: "recoverable", label: "Recoverable", align: "right" },
              { key: "top", label: "Largest single reason" },
            ]}
            rows={losses.categories.map((c) => ({
              value: c.category,
              leads: c.leads,
              share: c.share,
              recoverable: c.recoverable,
              top: `${c.reasons[0].reason} (${c.reasons[0].leads})`,
            }))}
          />
        </Question>

        {/* §L1's guard, and §35's principle "No Additional Ad Spend Before Funnel
            Diagnosis", enforced as screen ordering rather than as advice: the recoverable
            pool and the current leak are shown before anything about buying more leads. */}
        <section className="space-y-3 card-surface p-4">
          <h2 className="text-base font-semibold">Should we buy more leads?</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Not until this reads well. {segments.winnable} closed leads are still winnable, carrying{" "}
            {rupees(segments.estimatedValue)} of gross package value, and {compliance.missed} scheduled calls in the
            current cohort were never attempted.{" "}
            {worstStage
              ? `${worstStage.dropped} leads are sitting at "${worstStage.dropLabel}".`
              : ""}{" "}
            At the funnel's current {total.admissionRate}% conversion rate, buying volume multiplies this leak
            rather than the revenue.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Fix the leak first"
              value={`+${Math.round(segments.winnable * 0.05)} to +${Math.round(segments.winnable * 0.09)}`}
              detail={`conversions available from re-working the recoverable pool at a 5–9% recovery rate, at no media cost`}
            />
            <StatTile
              label="Then raise volume"
              value={`${total.admissionRate}%`}
              detail="the rate any new spend would be multiplied by — improve it before buying more"
            />
            <StatTile
              label="Current media spend"
              value={rupees(totalSpend)}
              detail={`${revenue.surgeries} surgeries — see Source & Campaign ROI before changing budgets`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Work the pool in the{" "}
            <Link to="/recovery" className="underline">
              recovery console
            </Link>
            , and trace any single drop to a named behaviour in the{" "}
            <Link to="/drill" className="underline">
              drill-down
            </Link>
            .
          </p>
        </section>

        <Question
          index={5}
          question="What action should management take to increase conversions without blindly increasing spend?"
          answer="Ranked by the number of leads behind each action, with the evidence each one came from and the owner it belongs to. Nothing here asks for more leads."
        >
          <DataTable
            title="Corrective actions, ranked by leads behind them"
            caption="§24. Each line is an owner and a number, not a suggestion."
            columns={[
              { key: "action", label: "Action" },
              { key: "leads", label: "Leads affected", align: "right" },
              { key: "owner", label: "Owner" },
              { key: "evidence", label: "Evidence" },
            ]}
            rows={actions.slice(0, 12).map((a, index) => ({
              id: `action-${index}`,
              action: a.action,
              leads: a.leads,
              owner: a.owner,
              evidence: a.evidence[0],
            }))}
          />
        </Question>

        <p className="text-xs text-muted-foreground">
          Every table on this screen downloads as a spreadsheet. For anything not shown here — one agent, one campaign,
          one disease, one week — use the <Link to="/ask" className="underline">Ask</Link> explorer, which reads the same{" "}
          {rows.length} journeys with the same metric library.
        </p>
      </div>
    </>
  );
}
