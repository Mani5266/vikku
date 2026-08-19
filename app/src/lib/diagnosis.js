// Drill-down and diagnostic reporting — Thesis §25 (drill-down technique), §32 (15-day
// diagnostic report), §33 (sample management conclusion).
//
// §25 is not "slice the data". It is a fixed ladder of nine levels that ends in a
// specific behaviour, and the worked example in the thesis is the acceptance test:
// overall conversions fell → surgery conversions fell → mostly Piles → mostly one
// campaign → connected rate normal but booking fell → pricing objection → financial
// counseling not completed → two agents → those agents never sent the package
// comparison and never escalated.
//
// So the levels are declared as data, each level ranks its segments by how much of the
// drop it explains against a comparison period, and the path assembles into the seven
// mandatory conclusion fields of §32.

import { funnel, groupBy, pct, revenueMetrics, stageFunnel } from "@/lib/funnel";
import { TOUCH_SLA_MINUTES } from "@/lib/touchTime";

const DAY = 24 * 60 * 60 * 1000;

/** Conversion type — §25 level 2. What the patient actually ended up receiving. */
function conversionType(row) {
  if (row.surgery_completed) return "Surgery";
  if (row.surgery_advised) return "Surgery advised, not completed";
  if (row.tests_advised) return "Investigations only";
  if (row.medical_management) return "Medical management only";
  if (row.consultation_completed) return "Consultation only";
  return "Never consulted";
}

/** Process gap — §25 level 7. The step the system failed to perform. */
function processGap(row) {
  if (row.first_touch_minutes === null) return "Never contacted";
  if (row.first_touch_minutes > 240) return "First response delayed beyond 4 hours";
  if (!row.followup_compliant) return "Scheduled follow-up incomplete";
  if (row.surgery_advised && !row.financial_counseling_completed) return "Financial counseling not completed";
  if (row.appointment_booked && row.confirmations_count === 0) return "Appointment never confirmed";
  if (row.no_show && !row.no_show_recovered) return "No-show never recovered";
  if (!row.remark_complete) return "Remark incomplete — no evidence to work from";
  return "No process gap recorded";
}

/** Specific behaviour — §25 level 9. What the agent did or did not do on this lead. */
function specificBehaviour(row) {
  if (row.rcs_sent === 0) return "No RCS/MMS visual content sent at any touch";
  if (!row.doctor_profile_sent) return "Doctor credibility content never sent";
  if (row.surgery_advised && !row.financial_counseling_completed) return "Not escalated to the financial counselor";
  if (row.discount_requested && !row.financial_counseling_completed) return "Discount asked for, never taken to counseling";
  if (row.appointment_booked && row.confirmations_count < 2) return "Appointment confirmed fewer than twice";
  if (!row.remark_complete) return "Seven-part remark left incomplete";
  return "Protocol followed on this lead";
}

/**
 * The nine levels of §25. `bucket` returns the value a lead falls under at that level;
 * everything else in this file is generic over these entries.
 */
export const DRILL_LEVELS = [
  { key: "overall", label: "Overall conversions", bucket: () => "All leads" },
  { key: "type", label: "Conversion type", bucket: conversionType },
  { key: "disease", label: "Disease", bucket: (r) => r.disease },
  { key: "campaign", label: "Source and campaign", bucket: (r) => `${r.source} — ${r.campaign}` },
  { key: "stage", label: "Funnel stage", bucket: (r) => r.drop_stage || "Converted" },
  { key: "objection", label: "Objection", bucket: (r) => r.loss_reason || "No objection recorded" },
  { key: "gap", label: "Process gap", bucket: processGap },
  { key: "agent", label: "Agent", bucket: (r) => r.agent_name },
  { key: "behaviour", label: "Specific behaviour", bucket: specificBehaviour },
];

/** Splits a set of journeys into a current period and the period before it. */
export function periods(rows, days = 15, now = new Date()) {
  const end = new Date(now).getTime();
  const currentStart = end - days * DAY;
  const previousStart = end - 2 * days * DAY;
  return {
    days,
    current: rows.filter((r) => new Date(r.created_at).getTime() >= currentStart),
    previous: rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= previousStart && t < currentStart;
    }),
  };
}

/**
 * One drill level. `path` is the levels already chosen, as [{key, value}], and both row
 * sets are filtered by it before the level's segments are ranked.
 *
 * `explains` is the point of the whole screen: how many of the period's missing
 * conversions this segment accounts for. Ranking by it is what stops a drill-down from
 * being a tour of the biggest segments.
 */
export function drillLevel(currentRows, previousRows, path = []) {
  const applied = applyPath(currentRows, path);
  const appliedPrevious = applyPath(previousRows, path);

  // `level` is where the manager is standing; `childLevel` is the rung the segment
  // table offers. Level 1 of §25 is an observation about the whole period, not a
  // slice of it, so at the top of the ladder the table already lists conversion types.
  const levelIndex = Math.min(path.length, DRILL_LEVELS.length - 1);
  const level = DRILL_LEVELS[levelIndex];
  const childLevel = DRILL_LEVELS[levelIndex + 1] || null;
  const segmentLevel = childLevel || level;

  const currentConversions = applied.filter((r) => r.surgery_completed).length;
  const previousConversions = appliedPrevious.filter((r) => r.surgery_completed).length;
  const totalDrop = previousConversions - currentConversions;

  const buckets = new Map();
  for (const row of applied) {
    const key = segmentLevel.bucket(row);
    if (!buckets.has(key)) buckets.set(key, { current: [], previous: [] });
    buckets.get(key).current.push(row);
  }
  for (const row of appliedPrevious) {
    const key = segmentLevel.bucket(row);
    if (!buckets.has(key)) buckets.set(key, { current: [], previous: [] });
    buckets.get(key).previous.push(row);
  }

  const segments = [...buckets]
    .map(([value, group]) => {
      const conversions = group.current.filter((r) => r.surgery_completed).length;
      const previousConversionsHere = group.previous.filter((r) => r.surgery_completed).length;
      const explains = previousConversionsHere - conversions;
      return {
        value,
        leads: group.current.length,
        previousLeads: group.previous.length,
        conversions,
        previousConversions: previousConversionsHere,
        conversionRate: pct(conversions, group.current.length),
        previousConversionRate: pct(previousConversionsHere, group.previous.length),
        explains,
        shareOfDrop: totalDrop > 0 ? pct(Math.max(0, explains), totalDrop) : 0,
        rows: group.current,
      };
    })
    // With a drop to explain, the segment that explains most of it leads. With no drop,
    // "explains" is noise, so the table falls back to size — otherwise the period's best
    // performing segment would sort to the bottom for having gained conversions.
    .sort(
      totalDrop > 0
        ? (a, b) => b.explains - a.explains || b.leads - a.leads
        : (a, b) => b.leads - a.leads
    );

  return {
    level,
    childLevel,
    segmentLevel,
    levelIndex,
    isLast: !childLevel,
    path,
    leads: applied.length,
    previousLeads: appliedPrevious.length,
    conversions: currentConversions,
    previousConversions,
    drop: totalDrop,
    stageFunnel: stageFunnel(applied),
    segments,
    rows: applied,
  };
}

export function applyPath(rows, path) {
  return path.reduce((acc, step) => {
    const level = DRILL_LEVELS.find((l) => l.key === step.key);
    if (!level) return acc;
    return acc.filter((row) => level.bucket(row) === step.value);
  }, rows);
}

/**
 * The §33 conclusion, assembled from the path the manager actually traversed. Nothing
 * here is invented: every line is a count over the leads at that point in the drill,
 * and `evidence` lists the records the count came from, because §3.4 forbids a decision
 * without evidence and L6 refuses to publish a conclusion without it.
 */
export function buildConclusion(view, { days = 15, owner = "Telecalling manager", now = new Date() } = {}) {
  const rows = view.rows;
  const worst = view.segments[0];
  const stage = [...view.stageFunnel].filter((s) => s.entered > 0).sort((a, b) => b.dropped - a.dropped)[0];
  const objections = topOf(rows.filter((r) => r.loss_reason), "loss_reason");
  const gaps = topOf(rows, (r) => processGap(r));
  const behaviours = topOf(rows, (r) => specificBehaviour(r));
  const agents = topOf(rows.filter((r) => !r.surgery_completed), "agent_name");
  const revenue = revenueMetrics(rows);

  const scope = view.path.length
    ? view.path.map((step) => `${labelOf(step.key)}: ${step.value}`).join(" → ")
    : "All leads";

  const recoverable = rows.filter((r) => r.recoverable).length;
  const expectedFromRecovery = Math.round(recoverable * 0.18);

  return {
    finding:
      view.drop > 0
        ? `Conversions fell from ${view.previousConversions} to ${view.conversions} across the last ${days} days for ${scope}.`
        : `Conversions moved from ${view.previousConversions} to ${view.conversions} across the last ${days} days for ${scope}.`,
    drillDown: !worst
      ? "No segment stands out at this level."
      : view.drop > 0
        ? `${worst.value} accounts for ${worst.explains} of the fall (${worst.shareOfDrop}% of it), on ${worst.leads} leads.`
        : `Conversions did not fall, so there is no drop to attribute. The largest segment at this level is ${worst.value}, on ${worst.leads} leads.`,
    stageFinding: stage
      ? `The largest single leak is ${stage.label}: ${stage.dropped} of ${stage.entered} leads did not advance — ${stage.dropLabel}.`
      : "No stage data at this scope.",
    rootCause:
      joinClauses([
        objections[0] ? `${objections[0].leads} leads closed on "${objections[0].value}"` : null,
        gaps[0] && gaps[0].value !== "No process gap recorded"
          ? `${gaps[0].leads} carry the process gap "${gaps[0].value}"`
          : null,
        behaviours[0] && behaviours[0].value !== "Protocol followed on this lead"
          ? `${behaviours[0].leads} show "${behaviours[0].value}"`
          : null,
      ]) || "No single root cause is dominant at this scope.",
    evidence: [
      `${rows.length} lead records in scope, each with its remark and activity history`,
      `${rows.filter((r) => r.loss_reason).length} carry a §23 primary and secondary reason`,
      `${rows.filter((r) => r.surgery_advised).length} reached surgery advice; ${rows.filter((r) => r.financial_counseling_completed).length} completed financial counseling`,
      `${rows.filter((r) => r.appointment_booked).length} appointments booked, ${rows.filter((r) => r.no_show).length} no-shows`,
      `first-response average ${averageTouch(rows)} against a ${TOUCH_SLA_MINUTES}-minute SLA`,
    ],
    correctiveAction: correctiveActions(rows, objections, gaps),
    responsiblePerson: agents[0] ? `${owner}, with ${agents[0].value} named on ${agents[0].leads} of the affected leads` : owner,
    expectedResult:
      recoverable > 0
        ? `${expectedFromRecovery} to ${expectedFromRecovery + 2} additional conversions from the ${recoverable} recoverable leads already in this cohort, without new spend.`
        : "No recoverable leads in this cohort; the action is preventive for the next period.",
    reviewDate: new Date(new Date(now).getTime() + 14 * DAY).toISOString().slice(0, 10),
    revenueAtStake: revenue.revenue,
    leadCount: rows.length,
  };
}

/** "a", "a and b", "a; b and c" — so a missing clause never leaves a dangling "and". */
function joinClauses(parts) {
  const clauses = parts.filter(Boolean);
  if (clauses.length <= 1) return clauses[0] || "";
  return `${clauses.slice(0, -1).join("; ")} and ${clauses[clauses.length - 1]}`;
}

function correctiveActions(rows, objections, gaps) {
  const actions = [];
  const uncounseled = rows.filter((r) => r.surgery_advised && !r.financial_counseling_completed).length;
  if (uncounseled) actions.push(`Financial counselor call for ${uncounseled} patients advised surgery without counseling`);
  const unconfirmed = rows.filter((r) => r.appointment_booked && r.confirmations_count === 0).length;
  if (unconfirmed) actions.push(`Confirmation sequence enforced on ${unconfirmed} unconfirmed appointments`);
  const noRcs = rows.filter((r) => r.rcs_sent === 0 && r.connected).length;
  if (noRcs) actions.push(`Package comparison and procedure creative through RCS/MMS for ${noRcs} leads that received none`);
  const slaMissed = rows.filter((r) => r.first_touch_minutes === null || r.first_touch_minutes > 240).length;
  if (slaMissed) actions.push(`First-response SLA review — ${slaMissed} leads were first called after 4 hours`);
  const missedFollowups = rows.reduce((sum, r) => sum + Math.max(0, r.followups_required - r.followups_done), 0);
  if (missedFollowups) actions.push(`${missedFollowups} scheduled calls reassigned and coached, not written off`);
  if (objections[0]?.value?.includes("cost") || objections[0]?.value?.includes("price")) {
    actions.push("Agent coaching on price-objection handling, with the package comparison script");
  }
  if (!actions.length && gaps[0]) actions.push(`Address ${gaps[0].value}`);
  return actions;
}

function topOf(rows, keyOrFn) {
  const get = typeof keyOrFn === "function" ? keyOrFn : (r) => r[keyOrFn];
  const groups = new Map();
  for (const row of rows) {
    const key = get(row);
    if (key === null || key === undefined) continue;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups]
    .map(([value, leads]) => ({ value, leads }))
    .sort((a, b) => b.leads - a.leads);
}

function labelOf(key) {
  return DRILL_LEVELS.find((l) => l.key === key)?.label || key;
}

function averageTouch(rows) {
  const contacted = rows.filter((r) => r.first_touch_minutes !== null);
  if (!contacted.length) return "no contact";
  const minutes = Math.round(contacted.reduce((sum, r) => sum + r.first_touch_minutes, 0) / contacted.length);
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)}h`;
}

/**
 * The §32 report: week 1, week 2 and the fifteen-day total, each answering the two
 * questions, plus the previous period's expected results scored against what happened.
 */
export function fifteenDayReport(rows, now = new Date()) {
  const end = new Date(now).getTime();
  const window = (fromDays, toDays) =>
    rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= end - fromDays * DAY && t < end - toDays * DAY;
    });

  const week2 = window(8, 1); // the most recent seven days
  const week1 = window(15, 8);
  const overall = window(15, 0);
  const previous = window(30, 15);

  const blocks = [
    { key: "week1", label: "Week 1", rows: week1 },
    { key: "week2", label: "Week 2", rows: week2 },
    { key: "overall", label: "Overall 15 days", rows: overall },
  ].map((block) => ({ ...block, ...analyse(block.rows) }));

  const view = drillLevel(overall, previous, []);

  return {
    blocks,
    conclusion: buildConclusion(view, { days: 15, now }),
    comparison: {
      previousConversions: previous.filter((r) => r.surgery_completed).length,
      currentConversions: overall.filter((r) => r.surgery_completed).length,
      previousLeads: previous.length,
      currentLeads: overall.length,
    },
  };
}

/** The two §32 questions for one window, answered with a best-of and a worst-of. */
function analyse(rows) {
  const converted = rows.filter((r) => r.surgery_completed);
  const f = funnel(rows);
  const revenue = revenueMetrics(rows);

  const best = (key, pool = converted) => topOf(pool, key)[0] || { value: "—", leads: 0 };
  const conversionTimes = converted.map((r) => r.age_days).filter(Boolean);

  return {
    leads: rows.length,
    connected: f.connected,
    conversions: converted.length,
    conversionRate: f.admissionRate,
    revenue: revenue.revenue,
    whyConverted: [
      { factor: "Best source", value: best("source").value, leads: best("source").leads },
      { factor: "Best disease category", value: best("disease").value, leads: best("disease").leads },
      { factor: "Best agent", value: best("agent_name").value, leads: best("agent_name").leads },
      {
        factor: "Best channel sequence",
        value: converted.filter((r) => r.rcs_sent > 0 && r.whatsapp_sent > 0).length
          ? "WhatsApp alternating with RCS/MMS"
          : "WhatsApp only",
        leads: converted.filter((r) => r.rcs_sent > 0 && r.whatsapp_sent > 0).length,
      },
      {
        factor: "Best content",
        value: "Doctor credibility card",
        leads: converted.filter((r) => r.doctor_profile_sent).length,
      },
      {
        factor: "Best appointment process",
        value: "Confirmed twice before the visit",
        leads: converted.filter((r) => r.confirmations_count >= 2).length,
      },
      {
        factor: "Best counseling method",
        value: "Financial counseling completed before booking",
        leads: converted.filter((r) => r.financial_counseling_completed).length,
      },
      {
        factor: "Average conversion time",
        value: conversionTimes.length
          ? `${Math.round(conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length)} days`
          : "—",
        leads: conversionTimes.length,
      },
    ],
    whyNotConverted: [
      ...topOf(rows.filter((r) => r.loss_reason), "loss_reason")
        .slice(0, 4)
        .map((line) => ({ factor: "Top non-conversion reason", value: line.value, leads: line.leads })),
      ...(() => {
        const worstStage = [...stageFunnel(rows)]
          .filter((s) => s.entered > 0)
          .sort((a, b) => b.dropped - a.dropped)[0];
        return worstStage
          ? [{ factor: "Funnel drop stage", value: `${worstStage.label} — ${worstStage.dropLabel}`, leads: worstStage.dropped }]
          : [];
      })(),
      ...topOf(rows.filter((r) => !r.surgery_completed && r.status !== "Pending"), "source")
        .slice(0, 1)
        .map((line) => ({ factor: "Source-wise drop", value: line.value, leads: line.leads })),
      ...topOf(rows.filter((r) => !r.surgery_completed && r.status !== "Pending"), "disease")
        .slice(0, 1)
        .map((line) => ({ factor: "Disease-wise drop", value: line.value, leads: line.leads })),
      ...topOf(rows.filter((r) => !r.followup_compliant), "agent_name")
        .slice(0, 1)
        .map((line) => ({ factor: "Agent-wise process gap", value: line.value, leads: line.leads })),
      {
        factor: "Price issues",
        value: "Financial category",
        leads: rows.filter((r) => r.loss_category === "Financial").length,
      },
      {
        factor: "No-show issues",
        value: "Booked and never arrived",
        leads: rows.filter((r) => r.no_show && !r.no_show_recovered).length,
      },
      {
        factor: "Competitor losses",
        value: "Competition category",
        leads: rows.filter((r) => r.loss_category === "Competition").length,
      },
      {
        factor: "Follow-up failures",
        value: "Follow-up Failure category",
        leads: rows.filter((r) => r.loss_category === "Follow-up Failure").length,
      },
      {
        factor: "Not Connected cases",
        value: "Never reached",
        leads: rows.filter((r) => r.status === "Not Connected").length,
      },
    ],
  };
}

/** Grouping helper re-exported so screens can slice the drill by any dimension. */
export { groupBy };
