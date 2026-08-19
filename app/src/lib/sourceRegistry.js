// S1. Lead Intake & Source Configuration — Thesis §5 (intake and source configuration),
// §3.1 (mandatory attribution), §30.1 (the lead capture module).
//
// One rule, and the whole screen is built to prove whether it holds: **no lead enters
// without a complete source.**
//
// §3.1 lists what "complete" means — source, campaign, platform, landing page or form, and
// the date and time of generation. The registry below holds the seventeen §5 sources; the
// audit beside it checks the leads that actually arrived against those five fields and
// reports, per field, how many records are missing it.
//
// That audit is the useful half. Two of the five fields are absent from every single lead in
// the dataset, which means the campaign hierarchy §5 describes — source → campaign → ad set
// → creative → landing page → disease — cannot be walked below its second rung. Every
// leadership screen that wants to know which *creative* produced a surgery is blocked here,
// at intake, and this is the screen that says so.

import { pct } from "./funnel.js";

/** The seventeen sources of §5, in the order the specification lists them. */
export const CANONICAL_SOURCES = [
  { name: "Facebook", platform: "Meta", paid: true },
  { name: "Instagram", platform: "Meta", paid: true },
  { name: "Google Ads", platform: "Google", paid: true },
  { name: "Google Organic", platform: "Google", paid: false },
  { name: "YouTube", platform: "Google", paid: true },
  { name: "Website", platform: "Owned", paid: false },
  { name: "WhatsApp", platform: "Owned", paid: false },
  { name: "Direct Call", platform: "Owned", paid: false },
  { name: "Existing Patient", platform: "Owned", paid: false },
  { name: "Patient Referral", platform: "Referral", paid: false },
  { name: "Doctor Referral", platform: "Referral", paid: false },
  { name: "Hospital Campaign", platform: "Owned", paid: false },
  { name: "Health Camp", platform: "Offline", paid: true },
  { name: "Offline Marketing", platform: "Offline", paid: true },
  { name: "Telecalling Database", platform: "Owned", paid: false },
  { name: "Partner Channel", platform: "Referral", paid: false },
  { name: "Other", platform: "Unclassified", paid: false },
];

/**
 * What the live data calls a source, mapped onto the canonical name.
 *
 * The mapping exists because it always exists: the ad platform writes "Meta Ads", the
 * specification says "Facebook", and a registry that pretends those are different sources
 * reports two half-funnels instead of one. Anything unmapped falls to "Other" and is
 * flagged, which is the only honest place for a name nobody registered.
 */
export const SOURCE_ALIASES = {
  "Meta Ads": "Facebook",
  "Google Ads": "Google Ads",
  YouTube: "YouTube",
  Website: "Website",
  Referral: "Doctor Referral",
  Camp: "Health Camp",
  "Walk-in": "Direct Call",
};

export function canonicalSource(name) {
  return SOURCE_ALIASES[name] ?? (CANONICAL_SOURCES.some((source) => source.name === name) ? name : "Other");
}

/**
 * The five §3.1 attribution fields, and how to tell whether a lead carries each one.
 *
 * `present` returning false for every row is a finding, not a bug — see the header. The
 * `blocks` line says what that missing field costs downstream, because "landing page: 0%"
 * on its own reads as a data-quality nit rather than as the reason L2 cannot rank creatives.
 */
export const ATTRIBUTION_FIELDS = [
  {
    key: "source",
    label: "Source",
    present: (row) => Boolean(row.source),
    blocks: "Nothing — this one is enforced today",
  },
  {
    key: "campaign",
    label: "Campaign",
    present: (row) => Boolean(row.campaign),
    blocks: "Nothing — this one is enforced today",
  },
  {
    key: "platform",
    label: "Platform",
    present: (row) => Boolean(row.platform),
    blocks: "Spend cannot be reconciled against the ad account without it",
  },
  {
    key: "landing_page",
    label: "Landing page or form",
    present: (row) => Boolean(row.landing_page || row.form),
    blocks: "Campaign ROI cannot go below the campaign rung — no ad set, no creative, no page",
  },
  {
    key: "created_at",
    label: "Date and time of generation",
    present: (row) => Boolean(row.created_at),
    blocks: "Nothing — this one is enforced today",
  },
];

/** Per §3.1 field: how many leads carry it, and what its absence costs. */
export function attributionAudit(rows) {
  return ATTRIBUTION_FIELDS.map((field) => {
    const present = rows.filter(field.present).length;
    return {
      key: field.key,
      value: field.label,
      present,
      missing: rows.length - present,
      completeness: pct(present, rows.length),
      blocks: field.blocks,
      enforced: present === rows.length,
    };
  });
}

/**
 * The source registry: every §5 source, with what the data says about the ones that are
 * actually producing leads.
 *
 * Registered-but-silent sources stay on the list rather than being filtered away. A source
 * configured months ago that has produced nothing since is exactly the row a marketing lead
 * needs to see, and filtering it out is how a dead integration stays dead.
 */
export function sourceRegistry(rows) {
  const byCanonical = new Map();
  for (const row of rows) {
    const key = canonicalSource(row.source);
    if (!byCanonical.has(key)) byCanonical.set(key, []);
    byCanonical.get(key).push(row);
  }

  const registry = CANONICAL_SOURCES.map((source) => {
    const group = byCanonical.get(source.name) ?? [];
    const campaigns = [...new Set(group.map((row) => row.campaign).filter(Boolean))];
    const converted = group.filter((row) => row.surgery_completed);
    const aliases = [...new Set(group.map((row) => row.source))].filter((name) => name !== source.name);
    return {
      value: source.name,
      platform: source.platform,
      paid: source.paid,
      live: group.length > 0,
      arrivesAs: aliases.join(", ") || (group.length ? source.name : "—"),
      leads: group.length,
      campaigns: campaigns.length,
      campaignNames: campaigns,
      converted: converted.length,
      admissionRate: pct(converted.length, group.length),
      revenue: converted.reduce((sum, row) => sum + (row.revenue || 0), 0),
      unmapped: source.name === "Other" && group.length > 0,
    };
  });

  return registry.sort((a, b) => b.leads - a.leads || a.value.localeCompare(b.value));
}

/**
 * The campaign hierarchy, as deep as the data allows.
 *
 * §5's worked example runs six rungs. This walks two and then stops, and the stop is
 * reported as `depth` rather than left as an empty table — the point of the screen is that
 * the hierarchy is truncated at intake, not that it is unpopulated.
 */
export const HIERARCHY_RUNGS = ["Source", "Campaign", "Ad set", "Creative", "Landing page", "Disease"];

export function campaignHierarchy(rows) {
  const nodes = new Map();
  for (const row of rows) {
    const source = canonicalSource(row.source);
    if (!nodes.has(source)) nodes.set(source, new Map());
    const campaigns = nodes.get(source);
    const campaign = row.campaign || "Unattributed";
    if (!campaigns.has(campaign)) campaigns.set(campaign, []);
    campaigns.get(campaign).push(row);
  }

  const tree = [...nodes]
    .map(([source, campaigns]) => ({
      source,
      leads: [...campaigns.values()].reduce((sum, group) => sum + group.length, 0),
      campaigns: [...campaigns]
        .map(([campaign, group]) => ({
          campaign,
          leads: group.length,
          converted: group.filter((row) => row.surgery_completed).length,
          diseases: [...new Set(group.map((row) => row.disease))],
        }))
        .sort((a, b) => b.leads - a.leads),
    }))
    .sort((a, b) => b.leads - a.leads);

  return {
    tree,
    depth: 2,
    rungs: HIERARCHY_RUNGS,
    missingRungs: HIERARCHY_RUNGS.slice(2, 5),
  };
}

/**
 * Duplicate detection, §5's matching rules, run over the leads that arrived.
 *
 * Phone is the strong key and name-plus-disease is the weak one, so they are reported
 * separately: a shared phone number is almost always the same person, whereas two people
 * with the same name and the same condition is a Tuesday in a hospital of this size.
 */
export const DUPLICATE_WINDOW_DAYS = 30;

export function duplicateCandidates(rows, { windowDays = DUPLICATE_WINDOW_DAYS } = {}) {
  const byPhone = new Map();
  const byNameDisease = new Map();

  for (const row of rows) {
    if (row.phone_number) {
      if (!byPhone.has(row.phone_number)) byPhone.set(row.phone_number, []);
      byPhone.get(row.phone_number).push(row);
    }
    const weak = `${row.patient_name}|${row.disease}`;
    if (!byNameDisease.has(weak)) byNameDisease.set(weak, []);
    byNameDisease.get(weak).push(row);
  }

  const withinWindow = (group) => {
    const times = group.map((row) => new Date(row.created_at).getTime()).sort((a, b) => a - b);
    return times[times.length - 1] - times[0] <= windowDays * 24 * 60 * 60 * 1000;
  };

  const collect = (map, rule) =>
    [...map]
      .filter(([, group]) => group.length > 1 && withinWindow(group))
      .map(([key, group]) => ({
        key: `${rule}:${key}`,
        rule,
        match: rule === "phone" ? key : key.replace("|", " · "),
        leads: group.length,
        sources: [...new Set(group.map((row) => row.source))].join(", "),
        // The record that wins a merge is the earliest one — attribution belongs to the
        // touch that generated the lead, not to the one that re-entered it.
        keeps: group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0].id,
      }));

  const strong = collect(byPhone, "phone");
  const weak = collect(byNameDisease, "name-and-disease");
  return {
    strong,
    weak,
    strongCount: strong.length,
    weakCount: weak.length,
    windowDays,
  };
}

/**
 * The write-layer guard §3.1 demands: a lead cannot be created through any path —
 * integration, import or manual — without complete attribution.
 *
 * It lives here rather than on the manual-entry form because the specification is explicit
 * that the check belongs at the write layer, not the UI layer. A form-only check is a check
 * a CSV import walks straight past.
 */
export function intakeProblems(lead = {}) {
  const problems = [];
  for (const field of ATTRIBUTION_FIELDS) {
    if (!field.present(lead)) problems.push(`${field.label} is required on every lead, from every path (§3.1)`);
  }
  if (lead.source && canonicalSource(lead.source) === "Other" && lead.source !== "Other") {
    problems.push(`"${lead.source}" is not a registered source — register it or map it to one of the seventeen`);
  }
  return problems;
}

/**
 * Attribution fields are read-only after creation. Changing one is an admin act and it is
 * audited (§29), so the check returns what would be written rather than a bare refusal.
 */
export function attributionChange({ lead, field, to, by, reason }) {
  const problems = [];
  if (!ATTRIBUTION_FIELDS.some((candidate) => candidate.key === field)) {
    problems.push(`${field} is not an attribution field`);
  }
  if (!by) problems.push("Attribution edits need a named admin");
  if (!String(reason || "").trim()) problems.push("Attribution edits need a reason — the field is read-only for a reason");
  return {
    problems,
    record: problems.length
      ? null
      : { lead_id: lead?.id, field, from: lead?.[field] ?? null, to, changed_by: by, reason: String(reason).trim() },
  };
}
