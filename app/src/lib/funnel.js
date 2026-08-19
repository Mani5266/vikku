// Funnel and diagnosis metrics — Thesis §16 (funnel), §17 (follow-up compliance),
// §19 (expired-lead segmentation), §24 (corrective actions), §25 (drill-down).
//
// Every number the manager and leadership screens show is computed here from journey
// records, so a figure on a dashboard and a row in the drill-down explorer cannot
// disagree. Nothing in this file reads from the DOM or the store — it takes rows and
// returns numbers, which is also what makes it testable.

/** Percentage of `d`, rounded to one decimal. Returns 0 when the base is 0. */
export function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

/**
 * The client's stated industry standard, from the requirement conversation:
 * 100 leads → 50 quality → 50% of those reach OPD → 50% of those get admitted,
 * which lands at roughly 12 admissions per 100 leads. Used only as a comparison
 * line, never as a target the system enforces.
 */
export const INDUSTRY_STANDARD = {
  qualityRate: 50,
  opFromQuality: 50,
  ipFromOp: 50,
  admissionsPer100: 12,
};

export const QUALITY_TEMPERATURES = ["Hot", "Warm"];

const isQuality = (row) => QUALITY_TEMPERATURES.includes(row.temperature);

/** The five-stage funnel for any set of journeys. §16. */
export function funnel(rows) {
  const leads = rows.length;
  const connected = rows.filter((r) => r.connected).length;
  const quality = rows.filter(isQuality).length;
  const op = rows.filter((r) => r.op_visit).length;
  const ip = rows.filter((r) => r.ip_admit).length;
  const pending = rows.filter((r) => r.status === "Pending").length;
  const lost = rows.filter((r) => r.status === "Lost").length;
  const notConnected = rows.filter((r) => r.status === "Not Connected").length;

  return {
    leads,
    connected,
    quality,
    op,
    ip,
    pending,
    lost,
    notConnected,
    connectedRate: pct(connected, leads),
    qualityRate: pct(quality, leads),
    opRate: pct(op, quality),
    ipRate: pct(ip, op),
    admissionRate: pct(ip, leads),
    pendingRate: pct(pending, leads),
  };
}

/** Groups rows by a field, preserving first-seen order. */
export function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] ?? "Unspecified";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

/**
 * The funnel, one line per value of `key` — source-wise, agent-wise, disease-wise,
 * campaign-wise or temperature-wise. This is the table the manager keeps by hand
 * today, and §25 step 1 of the drill-down.
 */
export function funnelByDimension(rows, key, { sortBy = "leads" } = {}) {
  const lines = [...groupBy(rows, key)].map(([value, group]) => ({
    value,
    ...funnel(group),
    avgTouchMinutes: avgTouchMinutes(group),
    complianceRate: complianceStats(group).rate,
    mismatchRate: temperatureAudit(group).mismatchRate,
  }));

  return lines.sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));
}

// Touch-time bands. The first band is the SLA in §7; the rest are the bands the
// client already reads their own call logs in.
export const TOUCH_BANDS = [
  { label: "Within 5 min", max: 5 },
  { label: "5 – 60 min", max: 60 },
  { label: "1 – 4 hours", max: 240 },
  { label: "4 – 12 hours", max: 720 },
  { label: "Over 12 hours", max: Infinity },
];

export const TOUCH_SLA_MINUTES = 5;

export function bandFor(minutes) {
  if (minutes === null || minutes === undefined) return "Never contacted";
  return TOUCH_BANDS.find((b) => minutes <= b.max).label;
}

/**
 * Connect rate and admission rate per touch-time band. The point of the table is
 * the gradient down the columns: it is the evidence that response speed, not lead
 * volume, is where the conversions are going. §7, §22.
 */
export function touchTimeDistribution(rows) {
  const bands = [...TOUCH_BANDS.map((b) => b.label), "Never contacted"];
  return bands.map((label) => {
    const group = rows.filter((r) => bandFor(r.first_touch_minutes) === label);
    const f = funnel(group);
    return {
      band: label,
      leads: group.length,
      share: pct(group.length, rows.length),
      connected: f.connected,
      connectedRate: f.connectedRate,
      ip: f.ip,
      admissionRate: f.admissionRate,
    };
  });
}

export function avgTouchMinutes(rows) {
  const contacted = rows.filter((r) => r.first_touch_minutes !== null);
  if (!contacted.length) return null;
  const total = contacted.reduce((sum, r) => sum + r.first_touch_minutes, 0);
  return Math.round(total / contacted.length);
}

export function slaBreaches(rows) {
  return rows.filter((r) => r.first_touch_minutes === null || r.first_touch_minutes > TOUCH_SLA_MINUTES);
}

/** Follow-up compliance — scheduled calls actually attempted. §17. */
export function complianceStats(rows) {
  const required = rows.reduce((sum, r) => sum + (r.followups_required || 0), 0);
  const done = rows.reduce((sum, r) => sum + (r.followups_done || 0), 0);
  const compliantLeads = rows.filter((r) => r.followup_compliant).length;
  return {
    required,
    done,
    missed: Math.max(0, required - done),
    rate: pct(done, required),
    compliantLeads,
    compliantLeadRate: pct(compliantLeads, rows.length),
  };
}

/**
 * Agent temperature against the temperature the transcript supports. §26 — the
 * qualification an agent typed is a claim, and this is the claim being checked.
 */
export function temperatureAudit(rows) {
  const connected = rows.filter((r) => r.connected);
  const mismatched = connected.filter((r) => r.temperature_mismatch);
  const inflated = mismatched.filter(
    (r) => rank(r.temperature) > rank(r.ai_temperature)
  );
  return {
    reviewed: connected.length,
    mismatched: mismatched.length,
    inflated: inflated.length,
    mismatchRate: pct(mismatched.length, connected.length),
    inflatedRate: pct(inflated.length, connected.length),
    rows: mismatched,
  };
}

const TEMPERATURE_RANK = { "Not Connected": 0, Cold: 1, Warm: 2, Hot: 3 };
const rank = (t) => TEMPERATURE_RANK[t] ?? 0;

/** Loss reasons, by category then reason, with the recoverable count. §19, §23. */
export function lossBreakdown(rows) {
  const closed = rows.filter((r) => r.loss_category);
  const categories = [...groupBy(closed, "loss_category")]
    .map(([category, group]) => ({
      category,
      leads: group.length,
      share: pct(group.length, closed.length),
      recoverable: group.filter((r) => r.recoverable).length,
      reasons: [...groupBy(group, "loss_reason")]
        .map(([reason, sub]) => ({
          reason,
          leads: sub.length,
          recoverable: sub.filter((r) => r.recoverable).length,
          action: sub[0].recommended_action,
          segment: sub[0].segment,
        }))
        .sort((a, b) => b.leads - a.leads),
    }))
    .sort((a, b) => b.leads - a.leads);

  return {
    closed: closed.length,
    recoverable: closed.filter((r) => r.recoverable).length,
    categories,
  };
}

/** One line per agent — the scorecard §M6 reports and §26 audits. */
export function agentScorecards(rows) {
  return funnelByDimension(rows, "agent_name").map((line) => ({
    agent: line.value,
    leads: line.leads,
    connectedRate: line.connectedRate,
    qualityRate: line.qualityRate,
    op: line.op,
    ip: line.ip,
    admissionRate: line.admissionRate,
    avgTouchMinutes: line.avgTouchMinutes,
    complianceRate: line.complianceRate,
    mismatchRate: line.mismatchRate,
  }));
}

/**
 * Why some leads convert and others do not, answered by comparing the two cohorts
 * on the two variables the system controls: response speed and follow-up completion.
 * Questions 3 and 4 of §2.
 */
export function conversionDrivers(rows) {
  // Compared within the qualified, connected population only. Comparing admitted
  // patients against every closed lead would credit response speed with work that
  // Cold and never-connected leads were never going to do — the comparison has to be
  // between leads that were both reachable and worth working.
  const comparable = rows.filter((r) => r.connected && isQuality(r));
  const converted = comparable.filter((r) => r.ip_admit);
  const lost = comparable.filter((r) => !r.ip_admit && r.status !== "Pending");

  const profile = (group) => ({
    leads: group.length,
    avgTouchMinutes: avgTouchMinutes(group),
    withinSla: pct(
      group.filter((r) => r.first_touch_minutes !== null && r.first_touch_minutes <= TOUCH_SLA_MINUTES).length,
      group.length
    ),
    complianceRate: complianceStats(group).rate,
    fullyFollowedUp: pct(group.filter((r) => r.followup_compliant).length, group.length),
  });

  return {
    basis: "Hot and Warm leads that connected",
    comparable: comparable.length,
    converted: profile(converted),
    lost: profile(lost),
  };
}

/**
 * Question 5 of §2 — what management should do, ranked by the number of leads behind
 * each action rather than by opinion. Each line carries the evidence it came from.
 */
export function recommendedActions(rows) {
  const actions = new Map();
  const add = (action, leads, evidence, owner) => {
    if (!leads) return;
    const existing = actions.get(action);
    if (existing) {
      existing.leads += leads;
      existing.evidence.push(evidence);
      return;
    }
    actions.set(action, { action, leads, evidence: [evidence], owner });
  };

  const breaches = slaBreaches(rows);
  add(
    "Enforce the 5-minute first-touch SLA with the pending-lead timer and manager alert",
    breaches.length,
    `${breaches.length} of ${rows.length} leads were first contacted after the SLA`,
    "Telecalling manager"
  );

  const compliance = complianceStats(rows);
  add(
    "Close the follow-up gap — scheduled calls are auto-assigned and must be attempted",
    compliance.missed,
    `${compliance.missed} scheduled calls of ${compliance.required} were never attempted`,
    "Telecalling manager"
  );

  const audit = temperatureAudit(rows);
  add(
    "Review qualification against call transcripts before acting on temperature counts",
    audit.inflated,
    `${audit.inflated} leads were marked hotter than the conversation supports`,
    "Quality / manager"
  );

  for (const category of lossBreakdown(rows).categories) {
    for (const reason of category.reasons) {
      if (!reason.action || !reason.recoverable) continue;
      add(reason.action, reason.recoverable, `${reason.recoverable} recoverable — ${category.category} / ${reason.reason}`, ownerFor(category.category));
    }
  }

  return [...actions.values()].sort((a, b) => b.leads - a.leads);
}

function ownerFor(category) {
  switch (category) {
    case "Financial":
      return "Financial counseling";
    case "Hospital / Doctor":
      return "Clinical operations";
    case "Follow-up Failure":
    case "Contactability":
      return "Telecalling manager";
    case "Lead Quality":
      return "Marketing";
    default:
      return "Management";
  }
}

// The eleven §26 funnel transitions, each as a pair of predicates. Defining them as
// data rather than as eleven functions means M3, L2 and the drill-down all count a
// stage the same way, and a new stage is one entry rather than three edits.
export const STAGE_TRANSITIONS = [
  { key: "connected", label: "Lead → Connected", from: () => true, to: (r) => r.connected, drop: "Not connected" },
  {
    key: "qualified",
    label: "Connected → Qualified",
    from: (r) => r.connected,
    to: (r) => r.temperature !== "Not Connected",
    drop: "Connected but never qualified",
  },
  {
    key: "hot",
    label: "Qualified → Hot or Warm",
    from: (r) => r.connected && r.temperature !== "Not Connected",
    to: isQuality,
    drop: "Qualified Cold",
  },
  {
    key: "appointment",
    label: "Qualified → Appointment booked",
    from: (r) => r.connected && r.temperature !== "Not Connected",
    to: (r) => r.appointment_booked,
    drop: "No appointment booked",
  },
  {
    key: "visit",
    label: "Appointment → Visit",
    from: (r) => r.appointment_booked,
    to: (r) => r.visited,
    drop: "Appointment no-show",
  },
  {
    key: "consultation",
    label: "Visit → Consultation completed",
    from: (r) => r.visited,
    to: (r) => r.consultation_completed,
    drop: "Left before consultation",
  },
  {
    key: "advice",
    label: "Consultation → Surgery advised",
    from: (r) => r.consultation_completed,
    to: (r) => r.surgery_advised,
    drop: "Medical management or tests only",
  },
  {
    key: "counseling",
    label: "Surgery advised → Financial counseling done",
    from: (r) => r.surgery_advised,
    to: (r) => r.financial_counseling_completed,
    drop: "Financial counseling not completed",
  },
  {
    key: "booking",
    label: "Surgery advised → Surgery booked",
    from: (r) => r.surgery_advised,
    to: (r) => r.surgery_booked,
    drop: "Surgery advised, not booked",
  },
  {
    key: "admission",
    label: "Surgery booked → Admitted",
    from: (r) => r.surgery_booked,
    to: (r) => r.admitted,
    drop: "Booked, not admitted",
  },
  {
    key: "completion",
    label: "Admitted → Treatment completed",
    from: (r) => r.admitted,
    to: (r) => r.surgery_completed,
    drop: "Admitted, not completed",
  },
];

/**
 * The full §26 funnel: entry count, exit count, rate and drop for every transition.
 * `dropRows` is carried on each line so M3 can honour its guard — a stage may not
 * report a drop it cannot explain lead by lead.
 */
export function stageFunnel(rows) {
  return STAGE_TRANSITIONS.map((transition) => {
    const entered = rows.filter(transition.from);
    const advanced = entered.filter(transition.to);
    const dropped = entered.filter((r) => !transition.to(r));
    return {
      key: transition.key,
      label: transition.label,
      entered: entered.length,
      advanced: advanced.length,
      dropped: dropped.length,
      rate: pct(advanced.length, entered.length),
      dropLabel: transition.drop,
      dropRows: dropped,
    };
  });
}

/** The three §26 recovery rates, each a second chance the system either takes or wastes. */
export function recoveryRates(rows) {
  const notConnected = rows.filter((r) => r.initially_not_connected);
  const recovered = notConnected.filter((r) => r.later_connected);
  const noShows = rows.filter((r) => r.no_show);
  const noShowsRecovered = noShows.filter((r) => r.no_show_recovered);
  const expired = rows.filter((r) => r.expired);
  const reactivated = expired.filter((r) => r.reactivated);
  const reactivationConverted = expired.filter((r) => r.reactivation_converted);

  return {
    notConnected: notConnected.length,
    notConnectedRecovered: recovered.length,
    notConnectedRecoveryRate: pct(recovered.length, notConnected.length),
    noShows: noShows.length,
    noShowsRecovered: noShowsRecovered.length,
    noShowRecoveryRate: pct(noShowsRecovered.length, noShows.length),
    noShowRate: pct(noShows.length, rows.filter((r) => r.appointment_booked).length),
    expired: expired.length,
    reactivated: reactivated.length,
    reactivationConverted: reactivationConverted.length,
    expiredRecoveryRate: pct(reactivationConverted.length, expired.length),
  };
}

/** Revenue actually recorded, and the §26 Lead-to-Revenue rate. */
export function revenueMetrics(rows) {
  const surgeries = rows.filter((r) => r.surgery_completed);
  const revenue = surgeries.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const recoveryRevenue = rows.reduce((sum, r) => sum + (r.recovery_revenue || 0), 0);
  const quoted = rows.filter((r) => r.quoted_package);
  return {
    surgeries: surgeries.length,
    revenue,
    recoveryRevenue,
    revenuePerLead: rows.length ? Math.round(revenue / rows.length) : 0,
    averageRealisedPackage: surgeries.length ? Math.round(revenue / surgeries.length) : 0,
    averageQuotedPackage: quoted.length
      ? Math.round(quoted.reduce((sum, r) => sum + r.quoted_package, 0) / quoted.length)
      : 0,
  };
}

/** ₹ 1,45,000 — Indian digit grouping, which is what the client's reports use. */
export function rupees(value) {
  if (value === null || value === undefined) return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** Source mix — question 1 of §2. */
export function sourceMix(rows) {
  return funnelByDimension(rows, "source").map((line) => ({
    source: line.value,
    leads: line.leads,
    share: pct(line.leads, rows.length),
    connectedRate: line.connectedRate,
    qualityRate: line.qualityRate,
    ip: line.ip,
    admissionRate: line.admissionRate,
  }));
}
