// Expired-lead segmentation and the 90-day reactivation pool — Thesis §18 (post-expiry
// diagnosis), §19 (segmentation), §20 (three-month reactivation), §30.9 (recovery
// campaign module).
//
// §19 exists to answer one question: how much of the lost pool can still produce
// revenue? So each segment carries an estimated recoverable value, computed from the
// package actually quoted where there is one, and from the disease's package band where
// the lead never got that far.
//
// §20's exclusion list is enforced here rather than described. `eligibleFor` is the only
// way into a campaign, and it refuses an excluded lead even when asked directly — the
// O4 guard says exclusions cannot be overridden manually, so there is no override
// parameter to pass.

import { REACTIVATION_CONTENT, REACTIVATION_EXCLUDED_REASONS } from "@/store/journeys";
import { groupBy, pct } from "@/lib/funnel";

// Package bands used to value a lead that never reached a quote. Deliberately the same
// numbers the generator quotes from, so an estimate and a quote are comparable.
const PACKAGE_BAND = {
  Circumcision: 35000,
  Piles: 65000,
  Hernia: 85000,
  Gallstones: 95000,
  "Varicose Veins": 110000,
  "Knee Replacement": 240000,
  Cataract: 45000,
  Thyroid: 90000,
};

export const SEGMENTS = [
  {
    key: "Recoverable",
    label: "Recoverable",
    note: "Small price gap, EMI, insurance pending, no-show, family approval, surgery fear, missed follow-up",
  },
  {
    key: "Long-Term Nurture",
    label: "Long-Term Nurture",
    note: "Treatment wanted in one or two months, waiting for leave, reports or family support",
  },
  {
    key: "Genuine Lost",
    label: "Genuine Lost",
    note: "Treated elsewhere, relocated, clinically ineligible, firmly declined further contact",
  },
  {
    key: "Invalid / Non-Actionable",
    label: "Invalid / Non-Actionable",
    note: "Wrong number, fake or duplicate data, unrelated enquiry, unreachable service area",
  },
];

/**
 * What the lead is worth if it comes back. A quoted package is a fact; a band is an
 * estimate, and the two are counted separately so the total can be read honestly.
 */
export function recoverableValue(row) {
  if (row.quoted_package) return { value: row.quoted_package, basis: "quoted" };
  return { value: PACKAGE_BAND[row.disease] ?? 0, basis: "band" };
}

/** The four §19 buckets, with counts and value. */
export function segmentation(rows) {
  const closed = rows.filter((r) => r.expired);

  const segments = SEGMENTS.map((segment) => {
    const group = closed.filter((r) => r.segment === segment.key);
    const quoted = group.filter((r) => r.quoted_package);
    const value = group.reduce((sum, r) => sum + recoverableValue(r).value, 0);
    return {
      value: segment.label,
      note: segment.note,
      leads: group.length,
      share: pct(group.length, closed.length),
      quotedLeads: quoted.length,
      estimatedValue: segment.key === "Recoverable" || segment.key === "Long-Term Nurture" ? value : 0,
      rows: group,
    };
  });

  const winnable = segments
    .filter((s) => s.value === "Recoverable" || s.value === "Long-Term Nurture")
    .reduce((sum, s) => sum + s.leads, 0);

  return {
    closed: closed.length,
    winnable,
    winnableShare: pct(winnable, closed.length),
    estimatedValue: segments.reduce((sum, s) => sum + s.estimatedValue, 0),
    segments,
  };
}

/**
 * §20 eligibility. Returns a verdict rather than a boolean so the screen can show why a
 * lead is out of the pool, which is the difference between a filter and a guard.
 */
export function eligibilityOf(row) {
  if (!row.expired) return { eligible: false, reason: "Lead is still in an active follow-up plan" };
  if (REACTIVATION_EXCLUDED_REASONS.includes(row.loss_reason || "")) {
    return { eligible: false, reason: `Excluded by §20 — closed as "${row.loss_reason}"` };
  }
  if (row.segment === "Genuine Lost" || row.segment === "Invalid / Non-Actionable") {
    return { eligible: false, reason: `Excluded by §19 segment — ${row.segment}` };
  }
  if (!REACTIVATION_CONTENT[row.loss_category]) {
    return { eligible: false, reason: `No reactivation content maps to ${row.loss_category} (§11 blocks generic sends)` };
  }
  if ((row.days_since_closure ?? 0) < 30) {
    return { eligible: false, reason: `Review date not reached — ${row.days_since_closure} days since closure` };
  }
  return { eligible: true, reason: null };
}

/** Every lead the pool will accept, with the content its closure reason maps to. */
export function reactivationPool(rows) {
  return rows
    .map((row) => ({ row, eligibility: eligibilityOf(row) }))
    .filter(({ eligibility }) => eligibility.eligible)
    .map(({ row }) => ({
      id: row.id,
      patient_name: row.patient_name,
      phone_number: row.phone_number,
      disease: row.disease,
      source: row.source,
      agent_name: row.agent_name,
      loss_category: row.loss_category,
      loss_reason: row.loss_reason,
      days_since_closure: row.days_since_closure,
      review_date: row.review_date?.slice(0, 10),
      content: REACTIVATION_CONTENT[row.loss_category],
      // §20: reactivation is a new activity on the same alternating framework. The first
      // touch of a reactivation is always WhatsApp; the next planned one is RCS/MMS.
      first_channel: "WhatsApp",
      next_channel: "RCS/MMS",
      value: recoverableValue(row).value,
      sent: row.reactivated,
      replied: row.reactivation_replied,
      converted: row.reactivation_converted,
    }));
}

/** Leads the pool refused, and why. The refusals are the guard's evidence. */
export function excludedFromPool(rows) {
  return rows
    .filter((r) => r.expired)
    .map((row) => ({ row, eligibility: eligibilityOf(row) }))
    .filter(({ eligibility }) => !eligibility.eligible)
    .map(({ row, eligibility }) => ({
      id: row.id,
      patient_name: row.patient_name,
      loss_reason: row.loss_reason || "—",
      segment: row.segment || "—",
      days_since_closure: row.days_since_closure,
      excluded_because: eligibility.reason,
    }));
}

// The four campaigns §30.9 names, each defined by the reasons it is allowed to work.
export const RECOVERY_CAMPAIGNS = [
  {
    key: "price",
    label: "Price recovery",
    reasons: ["Treatment cost high", "Discount requested", "EMI required", "Budget insufficient", "Lower competitor price", "Financial counseling not completed"],
    content: "Package explanation, EMI schedule and insurance check, sent by the financial counselor",
    owner: "Financial counseling",
  },
  {
    key: "noshow",
    label: "No-show recovery",
    reasons: ["Appointment timing unsuitable", "Follow-up missed", "First response delayed"],
    content: "Appointment card with a fresh slot, plus a video consultation alternative",
    owner: "Front desk",
  },
  {
    key: "trust",
    label: "Doctor-trust recovery",
    reasons: ["Doctor confidence issue", "Requested another doctor", "Waiting time issue"],
    content: "Doctor profile, procedure volume and a doctor callback offer",
    owner: "Clinical operations",
  },
  {
    key: "location",
    label: "Location and access recovery",
    reasons: ["Hospital too far", "Branch unavailable", "Preferred local facility", "Out of location"],
    content: "Nearest branch, travel information, camp schedule and a video consultation offer",
    owner: "Marketing",
  },
  {
    key: "fear",
    label: "Surgery-fear recovery",
    reasons: ["Surgery fear", "Wants to wait", "Symptoms reduced"],
    content: "Procedure explainer, recovery timeline and a comparable patient testimonial",
    owner: "Counseling team",
  },
];

/** Campaign pools, built only from leads the §20 guard admits. */
export function recoveryCampaigns(rows) {
  const pool = reactivationPool(rows);
  return RECOVERY_CAMPAIGNS.map((campaign) => {
    const eligible = pool.filter((lead) => campaign.reasons.includes(lead.loss_reason));
    const sent = eligible.filter((l) => l.sent);
    const replied = eligible.filter((l) => l.replied);
    const converted = eligible.filter((l) => l.converted);
    return {
      value: campaign.label,
      owner: campaign.owner,
      content: campaign.content,
      eligible: eligible.length,
      estimatedValue: eligible.reduce((sum, l) => sum + l.value, 0),
      sent: sent.length,
      replied: replied.length,
      replyRate: pct(replied.length, sent.length),
      converted: converted.length,
      recoveryRate: pct(converted.length, sent.length),
      revenue: rows
        .filter((r) => converted.some((c) => c.id === r.id))
        .reduce((sum, r) => sum + (r.recovery_revenue || 0), 0),
      rows: eligible,
    };
  }).sort((a, b) => b.eligible - a.eligible);
}

/** Reason-wise recovery results, for the §30.9 results panel. */
export function recoveryResultsByReason(rows) {
  const reactivated = rows.filter((r) => r.reactivated);
  return [...groupBy(reactivated, "loss_category")]
    .map(([category, group]) => ({
      value: category,
      sent: group.length,
      replied: group.filter((r) => r.reactivation_replied).length,
      converted: group.filter((r) => r.reactivation_converted).length,
      recoveryRate: pct(group.filter((r) => r.reactivation_converted).length, group.length),
      revenue: group.reduce((sum, r) => sum + (r.recovery_revenue || 0), 0),
    }))
    .sort((a, b) => b.sent - a.sent);
}
