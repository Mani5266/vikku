// Agent performance — Thesis §28, reference/metrics.md (agent metrics).
//
// §28's demand is structural, not cosmetic: outcome and process compliance are separate
// things and must never be merged into one score. An agent may convert less because the
// leads were worse; another may have good leads and work them badly. So this file
// returns two labelled groups plus the lead-quality mix the agent was actually handed,
// and M6 renders all three together.
//
// Two of the twenty metrics are only measurable because of fields the AI layer will
// own: qualification accuracy compares the temperature the agent typed against what the
// transcript supports (§26), and remarks quality scores structural completeness against
// the seven §3.2 parts — never prose style.

import {
  TOUCH_SLA_MINUTES,
  avgTouchMinutes,
  complianceStats,
  groupBy,
  pct,
  revenueMetrics,
} from "@/lib/funnel";

/** Outcome performance — what the agent achieved. §28. */
function outcomeOf(rows) {
  const revenue = revenueMetrics(rows);
  return {
    leadsAssigned: rows.length,
    hotLeads: rows.filter((r) => r.temperature === "Hot").length,
    appointments: rows.filter((r) => r.appointment_booked).length,
    visits: rows.filter((r) => r.visited).length,
    surgeries: revenue.surgeries,
    revenue: revenue.revenue,
    recoveryConversions: rows.filter((r) => r.reactivation_converted).length,
  };
}

/** Process compliance — whether the agent followed the system. §28. */
function processOf(rows) {
  const compliance = complianceStats(rows);
  const connected = rows.filter((r) => r.connected);
  const agreed = connected.filter((r) => !r.temperature_mismatch);
  const closed = rows.filter((r) => r.status === "Lost" || r.status === "Not Connected");

  return {
    avgFirstResponse: avgTouchMinutes(rows),
    withinSlaRate: pct(
      rows.filter((r) => r.first_touch_minutes !== null && r.first_touch_minutes <= TOUCH_SLA_MINUTES).length,
      rows.length
    ),
    callsAttempted: rows.reduce((sum, r) => sum + (r.calls_attempted || 0), 0),
    connectedRate: pct(connected.length, rows.length),
    qualificationAccuracy: pct(agreed.length, connected.length),
    followupsDue: compliance.required,
    followupsCompleted: compliance.done,
    followupsMissed: compliance.missed,
    whatsappActivities: rows.reduce((sum, r) => sum + (r.whatsapp_sent || 0), 0),
    rcsActivities: rows.reduce((sum, r) => sum + (r.rcs_sent || 0), 0),
    remarksQuality: pct(connected.filter((r) => r.remark_complete).length, connected.length),
    reasonsLogged: pct(closed.filter((r) => r.loss_reason).length, closed.length),
    recoverableIdentified: rows.filter((r) => r.recoverable).length,
  };
}

/**
 * The lead mix the agent was handed. Without it, the outcome column is unreadable —
 * which is exactly the argument §28 makes and the guard M6 enforces.
 */
function mixOf(rows) {
  const share = (test) => pct(rows.filter(test).length, rows.length);
  return {
    hotShare: share((r) => r.temperature === "Hot"),
    qualityShare: share((r) => ["Hot", "Warm"].includes(r.temperature)),
    junkShare: share((r) => ["Wrong number", "Fake lead", "Duplicate", "Out of location"].includes(r.loss_reason || "")),
    topSource:
      [...groupBy(rows, "source")].sort((a, b) => b[1].length - a[1].length)[0]?.[0] || "—",
  };
}

/**
 * One scorecard per agent, plus the team line. `expectedSurgeries` normalises the
 * outcome against the mix: it is what the agent's own lead mix would have produced at
 * the team's stage-by-stage rates, so "fewer surgeries" and "worse work" stop being the
 * same sentence.
 */
export function agentScorecards(rows) {
  const teamQualityRate = pct(rows.filter((r) => ["Hot", "Warm"].includes(r.temperature)).length, rows.length);
  const teamSurgeryPerQuality = pct(
    rows.filter((r) => r.surgery_completed).length,
    rows.filter((r) => ["Hot", "Warm"].includes(r.temperature)).length
  );
  // The flag compares an agent against the team, not against a number someone picked.
  // Absolute thresholds would either flag everyone or nobody as the team moves.
  const team = processOf(rows);
  const teamMissRate = team.followupsMissed / Math.max(1, team.followupsDue);

  const lines = [...groupBy(rows, "agent_name")].map(([agent, group]) => {
    const outcome = outcomeOf(group);
    const process = processOf(group);
    const mix = mixOf(group);
    const quality = group.filter((r) => ["Hot", "Warm"].includes(r.temperature)).length;
    const expectedSurgeries = Math.round((quality * teamSurgeryPerQuality) / 100);
    return {
      agent,
      outcome,
      process,
      mix,
      expectedSurgeries,
      surgeryDelta: outcome.surgeries - expectedSurgeries,
      // A flag, not a verdict. It says which column to read first.
      readFirst:
        process.followupsMissed / Math.max(1, process.followupsDue) > teamMissRate + 0.03 ||
        process.withinSlaRate < team.withinSlaRate - 5 ||
        process.remarksQuality < team.remarksQuality - 8
          ? "process"
          : mix.qualityShare < teamQualityRate - 6
            ? "mix"
            : "outcome",
    };
  });

  return lines.sort((a, b) => b.outcome.surgeries - a.outcome.surgeries);
}

export function teamTotals(rows) {
  return { outcome: outcomeOf(rows), process: processOf(rows), mix: mixOf(rows) };
}
