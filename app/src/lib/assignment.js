// M5. Unassigned & Assignment Board — Thesis §30.2 (the lead assignment module),
// §7 (touch time), §29 (audit trail).
//
// One rule: no lead sits without an owner.
//
// What counts as "without an owner" here needs stating plainly, because the honest answer
// is narrower than the screen title suggests. The journey dataset gives every lead an
// `agent_name` at creation, so there is no literally unowned record to list. What it does
// carry is `first_touch_minutes === null` — a lead nobody has ever picked up. That is the
// failure M5 exists to catch, and it is the pool this board works: **arrived, nominally
// owned, never touched by a human being.**
//
// Twenty-two of them in the last thirty days, the oldest waiting twenty-nine days. A board
// with a routing rule beside each row is how that stops being invisible.

import { pct } from "./funnel.js";

/** How far back the board looks. Older than this is history, not a work queue. */
export const BOARD_WINDOW_DAYS = 30;

/**
 * Escalating alert bands against the §7 intake SLA.
 *
 * The bands are written for a live system, not for this seed. In production the top band
 * is where almost every row sits; in the seeded ninety days every waiting lead has fallen
 * to the bottom one, and the board says exactly that rather than inventing a spread.
 */
export const SLA_BANDS = [
  { key: "inside", label: "Inside SLA", maxMinutes: 5, tone: "good", escalate: null },
  { key: "late", label: "Late", maxMinutes: 60, tone: "warn", escalate: "Agent alert" },
  { key: "breached", label: "Breached", maxMinutes: 24 * 60, tone: "bad", escalate: "Manager alert" },
  { key: "abandoned", label: "Abandoned", maxMinutes: 7 * 24 * 60, tone: "bad", escalate: "Reassign now" },
  { key: "written-off", label: "Written off in practice", maxMinutes: Infinity, tone: "bad", escalate: "Reassign or close with a reason" },
];

export function slaBand(minutesWaiting) {
  return SLA_BANDS.find((band) => minutesWaiting <= band.maxMinutes) ?? SLA_BANDS[SLA_BANDS.length - 1];
}

/**
 * The routing rules the board checks each waiting lead against.
 *
 * These are configuration, not derived data — S2 owns editing them, M5 only reports which
 * one *should* have matched. They are ordered, first match wins, and the last one is a
 * catch-all so no lead can ever come back "no rule matched", which would be a silent hole
 * in exactly the place a silent hole is most expensive.
 */
export const ASSIGNMENT_RULES = [
  {
    key: "hot-source",
    label: "Walk-in and referral go to the branch desk",
    matches: (lead) => ["Walk-in", "Referral"].includes(lead.source),
    routeTo: (lead) => `${lead.branch} front desk`,
    because: "The patient is already in the building or was sent by a doctor. These convert far above the ad sources and must not queue behind them.",
  },
  {
    key: "high-value",
    label: "High-value procedures go to the senior caller",
    matches: (lead) => ["Knee Replacement", "Varicose Veins", "Gallstones"].includes(lead.disease),
    routeTo: () => "Senior caller",
    because: "A ₹1L+ package needs a caller who can hold a financial conversation on the first call.",
  },
  {
    key: "branch",
    label: "Everything else routes by branch",
    matches: (lead) => Boolean(lead.branch),
    routeTo: (lead) => `${lead.branch} team`,
    because: "The caller who books the appointment should be the one who knows that branch's slots.",
  },
  {
    key: "catch-all",
    label: "Unrouted — manager assigns by hand",
    matches: () => true,
    routeTo: () => "Manager queue",
    because: "No rule matched. That is itself the finding: a lead reached intake that the rule set does not describe.",
  },
];

export function ruleFor(lead) {
  const rule = ASSIGNMENT_RULES.find((candidate) => candidate.matches(lead));
  return { key: rule.key, label: rule.label, routeTo: rule.routeTo(lead), because: rule.because };
}

/**
 * Leads that arrived and were never touched, newest window first.
 *
 * Waiting time is derived from `age_days`, because the dataset records when a lead arrived
 * and whether anybody reached it, not a separate assignment timestamp. The field is named
 * `waitingDays` rather than dressed up as a precise clock.
 */
export function waitingPool(rows, { days = BOARD_WINDOW_DAYS } = {}) {
  return rows
    .filter((row) => row.first_touch_minutes === null && row.age_days <= days)
    .map((row) => {
      const minutes = row.age_days * 24 * 60;
      const band = slaBand(minutes);
      const rule = ruleFor(row);
      return {
        id: row.id,
        patient_name: row.patient_name,
        phone_number: row.phone_number,
        disease: row.disease,
        source: row.source,
        campaign: row.campaign,
        branch: row.branch,
        nominal_owner: row.agent_name,
        waitingDays: row.age_days,
        band: band.key,
        bandLabel: band.label,
        tone: band.tone,
        escalation: band.escalate,
        rule: rule.label,
        routeTo: rule.routeTo,
        because: rule.because,
        status: row.status,
      };
    })
    .sort((a, b) => b.waitingDays - a.waitingDays);
}

/**
 * The board's headline. `neverTouchedEver` is the whole ninety days, not the window: the
 * window is the work, the ninety-day figure is the argument for doing it.
 */
export function boardSummary(rows, { days = BOARD_WINDOW_DAYS } = {}) {
  const pool = waitingPool(rows, { days });
  const everUntouched = rows.filter((row) => row.first_touch_minutes === null);
  const inWindow = rows.filter((row) => row.age_days <= days);
  const worst = pool[0] ?? null;

  return {
    waiting: pool.length,
    windowLeads: inWindow.length,
    waitingShare: pct(pool.length, inWindow.length),
    neverTouchedEver: everUntouched.length,
    lostWhileWaiting: everUntouched.filter((row) => row.status !== "Pending").length,
    oldestDays: worst?.waitingDays ?? 0,
    // Every band present in the pool, so the screen can state the spread rather than
    // implying one. On the seeded data this is a single band, which is the finding.
    bands: SLA_BANDS.map((band) => ({
      key: band.key,
      value: band.label,
      leads: pool.filter((lead) => lead.band === band.key).length,
      escalation: band.escalate,
    })).filter((band) => band.leads > 0),
  };
}

/**
 * The agent roster with the load an assignment would land on.
 *
 * `capacity` is configuration — a cap the hospital sets per shift, not a number this app
 * can derive — so it is passed in and defaulted once, here, rather than invented per screen.
 */
export const DEFAULT_CAPACITY = 90;

export function rosterLoad(rows, { capacity = DEFAULT_CAPACITY } = {}) {
  const names = [...new Set(rows.map((row) => row.agent_name))].filter(Boolean);
  return names
    .map((name) => {
      const owned = rows.filter((row) => row.agent_name === name);
      const open = owned.filter((row) => row.status === "Pending");
      const hot = open.filter((row) => row.temperature === "Hot");
      const overdue = open.filter((row) => !row.followup_compliant);
      const load = pct(open.length, capacity);
      return {
        value: name,
        open: open.length,
        hot: hot.length,
        overdue: overdue.length,
        capacity,
        load,
        // At capacity is a refusal, not a warning: assigning into a full queue is how the
        // overdue column on M4 gets filled.
        atCapacity: open.length >= capacity,
        headroom: Math.max(0, capacity - open.length),
        lifetimeLeads: owned.length,
      };
    })
    .sort((a, b) => a.load - b.load);
}

/**
 * Whether one assignment may be written, and why not when it may not.
 *
 * Returns a list of problems rather than a boolean, so the screen can print the reason
 * beside the disabled button instead of leaving the manager guessing — the same contract
 * the closure and booking guards use.
 */
export function assignmentProblems({ lead, agent, reason } = {}) {
  const problems = [];
  if (!lead) problems.push("Pick a lead to assign");
  if (!agent) problems.push("Pick an agent to assign it to");
  if (agent?.atCapacity) {
    problems.push(`${agent.value} is at capacity — ${agent.open} open leads against a cap of ${agent.capacity}`);
  }
  // §29: a reassignment is a change of custody and has to carry its reason into the audit
  // log. A first assignment does not, because there is nothing being taken away.
  if (lead?.nominal_owner && agent && lead.nominal_owner !== agent.value && !String(reason || "").trim()) {
    problems.push("Reassigning away from another agent needs a reason — it is written to the audit log");
  }
  return problems;
}

/** What an assignment writes. Listed, because the audit trail is a §29 requirement. */
export function assignmentRecord({ lead, agent, reason, by }) {
  return {
    lead_id: lead.id,
    from: lead.nominal_owner ?? null,
    to: agent.value,
    reason: String(reason || "").trim() || null,
    rule: lead.rule,
    waiting_days_at_assignment: lead.waitingDays,
    assigned_by: by ?? null,
  };
}
