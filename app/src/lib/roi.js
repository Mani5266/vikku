// Cost and ROI metrics — Thesis §5 (lead intake and source configuration), §26 (funnel
// metrics), reference/metrics.md (cost metrics).
//
// §5's rule is the one this file exists to enforce: lead count alone must never be used
// to judge a campaign. Every ranking here therefore carries cost per surgery and
// revenue beside the count, and the default sort is cost per surgery.
//
// Spend lives in `SOURCE_SPEND` in the journey generator because it is configuration,
// not measurement. Campaign-level spend is apportioned from its source by lead share —
// stated on screen, because it is an assumption, not a figure from the ad platform.

import { SOURCE_SPEND } from "@/store/journeys";
import { funnel, groupBy, pct, revenueMetrics } from "@/lib/funnel";

const JUNK_REASONS = ["Wrong number", "Fake lead", "Duplicate", "Out of location", "Unrelated enquiry"];

const money = (value) => (Number.isFinite(value) ? Math.round(value) : null);

/** Cost, conversion and revenue for one set of leads against one spend figure. */
export function costLine(rows, spend) {
  const f = funnel(rows);
  const revenue = revenueMetrics(rows);
  const appointments = rows.filter((r) => r.appointment_booked).length;
  const visits = rows.filter((r) => r.visited).length;
  const consultations = rows.filter((r) => r.consultation_completed).length;
  const advised = rows.filter((r) => r.surgery_advised).length;
  const booked = rows.filter((r) => r.surgery_booked).length;
  const junk = rows.filter((r) => JUNK_REASONS.includes(r.loss_reason || "")).length;

  const per = (count) => (spend > 0 && count > 0 ? money(spend / count) : null);

  return {
    leads: f.leads,
    connected: f.connected,
    connectedRate: f.connectedRate,
    quality: f.quality,
    qualityRate: f.qualityRate,
    appointments,
    visits,
    consultations,
    surgeryAdvised: advised,
    surgeryBooked: booked,
    surgeries: revenue.surgeries,
    revenue: revenue.revenue,
    spend,
    costPerLead: per(f.leads),
    costPerConnected: per(f.connected),
    costPerAppointment: per(appointments),
    costPerSurgery: per(revenue.surgeries),
    junkLeads: junk,
    junkRate: pct(junk, f.leads),
    // Return on ad spend. Null where there is no media cost, because 0 spend does not
    // mean infinite return — it means the channel is not bought.
    roas: spend > 0 ? Math.round((revenue.revenue / spend) * 100) / 100 : null,
  };
}

/** One line per source, with its own spend figure. */
export function sourceRoi(rows) {
  return [...groupBy(rows, "source")]
    .map(([source, group]) => ({
      value: source,
      ...costLine(group, SOURCE_SPEND[source] ?? 0),
    }))
    .sort(bySurgeryCost);
}

/**
 * One line per campaign. Spend is apportioned from the campaign's source by lead
 * share, which is an assumption the screen states rather than hides.
 */
export function campaignRoi(rows) {
  const leadsBySource = new Map([...groupBy(rows, "source")].map(([source, group]) => [source, group.length]));

  return [...groupBy(rows, "campaign")]
    .map(([campaign, group]) => {
      const source = group[0].source;
      const sourceLeads = leadsBySource.get(source) || group.length;
      const spend = Math.round(((SOURCE_SPEND[source] ?? 0) * group.length) / sourceLeads);
      return {
        value: campaign,
        source,
        apportioned: (SOURCE_SPEND[source] ?? 0) > 0,
        ...costLine(group, spend),
      };
    })
    .sort(bySurgeryCost);
}

/** Cost per surgery ascending, with unbought and non-converting channels last. */
function bySurgeryCost(a, b) {
  if (a.costPerSurgery === null && b.costPerSurgery === null) return b.surgeries - a.surgeries;
  if (a.costPerSurgery === null) return 1;
  if (b.costPerSurgery === null) return -1;
  return a.costPerSurgery - b.costPerSurgery;
}

/**
 * The seven questions §5 says the source configuration must be able to answer, each as
 * a ranked view rather than a paragraph. `metric` names the column the view sorts on.
 */
export const ROI_VIEWS = [
  { key: "leads", label: "Most leads", metric: "leads", direction: "desc" },
  { key: "connected", label: "Most connected leads", metric: "connected", direction: "desc" },
  { key: "quality", label: "Most Hot or Warm leads", metric: "quality", direction: "desc" },
  { key: "appointments", label: "Most appointments", metric: "appointments", direction: "desc" },
  { key: "surgeries", label: "Most surgeries", metric: "surgeries", direction: "desc" },
  { key: "junk", label: "Most junk data", metric: "junkRate", direction: "desc" },
  { key: "cost", label: "Lowest cost per surgery", metric: "costPerSurgery", direction: "asc" },
];

export function applyRoiView(lines, viewKey) {
  const view = ROI_VIEWS.find((v) => v.key === viewKey) || ROI_VIEWS[ROI_VIEWS.length - 1];
  const sorted = [...lines].sort((a, b) => {
    const x = a[view.metric];
    const y = b[view.metric];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return view.direction === "asc" ? x - y : y - x;
  });
  return { view, lines: sorted };
}

/**
 * §5 and §28 make the same distinction, and L2's guard depends on it: a campaign that
 * looks bad may have delivered reachable, qualified leads that were then worked badly.
 * This splits the blame with numbers before anyone pauses a campaign.
 */
export function qualityVersusExecution(rows) {
  const connected = rows.filter((r) => r.connected);
  const quality = connected.filter((r) => ["Hot", "Warm"].includes(r.temperature));
  const compliantQuality = quality.filter((r) => r.followup_compliant);
  const withinSla = rows.filter((r) => r.first_touch_minutes !== null && r.first_touch_minutes <= 5);
  const junk = rows.filter((r) => JUNK_REASONS.includes(r.loss_reason || ""));

  const leadQualityScore = pct(quality.length, rows.length);
  const executionScore = Math.round(
    (pct(compliantQuality.length, quality.length) + pct(withinSla.length, rows.length)) / 2
  );

  return {
    leadQualityScore,
    executionScore,
    junkRate: pct(junk.length, rows.length),
    verdict:
      leadQualityScore < 25 && executionScore >= 40
        ? "Lead quality — the leads arriving are largely unqualified"
        : executionScore < 40 && leadQualityScore >= 25
          ? "Follow-up execution — qualified leads were not worked to protocol"
          : leadQualityScore < 25 && executionScore < 40
            ? "Both — poor leads and poor execution; fix execution first, it is cheaper"
            : "Neither is clearly at fault — drill into the stage funnel before acting",
  };
}
