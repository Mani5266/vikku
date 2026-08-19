// M4. Follow-up Compliance & Overdue Queue — Thesis §24 (reason-based corrective action),
// §28 (agent performance must be data-based), §30.5 (the follow-up scheduler).
//
// One question, and it is not "how did the agent do": was the process actually executed?
//
// The guard that shapes this whole file is §28's: **a message the system failed to deliver
// is an infrastructure problem, not an agent miss, and management must be shown which
// before it acts.** So every count here is split two ways — touches never executed, and
// touches executed but undelivered — and they are never added together into one
// "compliance" number. Adding them is how a scheduler outage becomes an agent's appraisal.

import { pct } from "./funnel.js";

/**
 * Severity order, worst first. This is the order the queue is worked in, so it is data
 * rather than a sort comment: a Hot lead whose plan slipped is losing a booking today, a
 * Cold touch missed is losing one in a month.
 */
export const SEVERITIES = [
  {
    key: "hot-overdue",
    label: "Hot lead, plan slipped",
    rank: 1,
    why: "A Hot lead is the closest thing to a booking this list has. Every missed day is one the patient spends deciding somewhere else.",
    matches: (row) => row.temperature === "Hot" && !row.followup_compliant,
  },
  {
    key: "confirmation-overdue",
    label: "Appointment never confirmed",
    rank: 2,
    why: "Booked and unconfirmed is the single biggest predictor of a no-show. The slot is held, the doctor is blocked, and nobody has spoken to the patient.",
    matches: (row) => row.appointment_booked && !row.appointment_confirmed,
  },
  {
    key: "not-connected-missed",
    label: "Not Connected, double-dial missed",
    rank: 3,
    why: "The five-day Not Connected plan exists because one unanswered call is not an answer. Stopping early turns a busy patient into a lost lead.",
    matches: (row) => row.temperature === "Not Connected" && !row.followup_compliant,
  },
  {
    key: "post-consultation-missed",
    label: "Post-consultation follow-up missed",
    rank: 4,
    why: "The patient came in, met the doctor, and then heard nothing. This is the most expensive miss on the list because the hard part was already paid for.",
    matches: (row) => row.consultation_completed && !row.surgery_booked && !row.followup_compliant,
  },
  {
    key: "warm-missed",
    label: "Warm touch missed",
    rank: 5,
    why: "The fifteen-day Warm plan is what moves a maybe to a yes. Skipping touches leaves it a maybe.",
    matches: (row) => row.temperature === "Warm" && !row.followup_compliant,
  },
  {
    key: "cold-missed",
    label: "Cold touch missed",
    rank: 6,
    why: "Lowest urgency, still a commitment the system made. A Cold plan that is never run is a plan that should not have been created.",
    matches: (row) => row.temperature === "Cold" && !row.followup_compliant,
  },
];

/**
 * The first severity a lead falls into, worst first — a lead appears in the queue once.
 * A Hot lead with an unconfirmed appointment is a Hot problem; listing it twice makes the
 * queue longer without making it more true.
 */
export function severityOf(row) {
  return SEVERITIES.find((severity) => severity.matches(row)) ?? null;
}

/** Touches the plan owed that were never made. Never negative — a plan can be overdelivered. */
export function touchesMissed(row) {
  return Math.max(0, (row.followups_required ?? 0) - (row.followups_done ?? 0));
}

/** Messages the system accepted and then failed to deliver. Not the agent's miss. */
export function messagesUndelivered(row) {
  return Math.max(0, (row.messages_sent ?? 0) - (row.messages_delivered ?? 0));
}

/**
 * One queue row. `daysOverdue` is the lead's age past the point its plan should have
 * finished, which is why it is derived from age rather than from a due date the dataset
 * does not carry — and the field says so rather than pretending to a precision it lacks.
 */
export function overdueQueue(rows) {
  return rows
    .map((row) => ({ row, severity: severityOf(row) }))
    .filter(({ severity }) => severity)
    .map(({ row, severity }) => ({
      id: row.id,
      severity: severity.key,
      severityLabel: severity.label,
      rank: severity.rank,
      patient_name: row.patient_name,
      phone_number: row.phone_number,
      agent_name: row.agent_name,
      disease: row.disease,
      branch: row.branch,
      temperature: row.temperature,
      status: row.status,
      due: row.followups_required,
      done: row.followups_done,
      missed: touchesMissed(row),
      undelivered: messagesUndelivered(row),
      // The split the guard demands, stated per row so a manager reading one line already
      // knows whether to coach a person or raise a ticket.
      cause:
        touchesMissed(row) > 0 && messagesUndelivered(row) > 0
          ? "Both — touches skipped and messages undelivered"
          : touchesMissed(row) > 0
            ? "Touches never executed"
            : messagesUndelivered(row) > 0
              ? "Delivery failure — not an agent miss"
              : "Plan complete, appointment unconfirmed",
      ageDays: row.age_days,
      lossReason: row.loss_reason,
    }))
    .sort((a, b) => a.rank - b.rank || b.missed - a.missed || b.ageDays - a.ageDays);
}

/** The queue folded into its severity bands, in severity order, for the summary strip. */
export function severityBands(rows) {
  const queue = overdueQueue(rows);
  return SEVERITIES.map((severity) => {
    const group = queue.filter((entry) => entry.severity === severity.key);
    return {
      key: severity.key,
      value: severity.label,
      why: severity.why,
      leads: group.length,
      share: pct(group.length, queue.length),
      missedTouches: group.reduce((sum, entry) => sum + entry.missed, 0),
      undelivered: group.reduce((sum, entry) => sum + entry.undelivered, 0),
    };
  });
}

/**
 * The number the guard exists for: how much of the shortfall is somebody not calling, and
 * how much is the platform not delivering. Reported side by side and never summed.
 */
export function executionSplit(rows) {
  const missed = rows.reduce((sum, row) => sum + touchesMissed(row), 0);
  const undelivered = rows.reduce((sum, row) => sum + messagesUndelivered(row), 0);
  const owed = rows.reduce((sum, row) => sum + (row.followups_required ?? 0), 0);
  return {
    owed,
    executed: owed - missed,
    executionRate: pct(owed - missed, owed),
    missed,
    undelivered,
    deliveryFailureLeads: rows.filter((row) => messagesUndelivered(row) > 0).length,
    sent: rows.reduce((sum, row) => sum + (row.messages_sent ?? 0), 0),
    delivered: rows.reduce((sum, row) => sum + (row.messages_delivered ?? 0), 0),
  };
}

/**
 * Completion rate per value of a dimension — agent, disease or source.
 *
 * Agent rows carry the delivery-failure count beside the execution rate, because that is
 * the column a manager has to read before starting a conversation about an agent's numbers.
 */
export function completionBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] ?? "Unspecified";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups]
    .map(([value, group]) => {
      const split = executionSplit(group);
      return {
        value,
        leads: group.length,
        owed: split.owed,
        executed: split.executed,
        executionRate: split.executionRate,
        missed: split.missed,
        undelivered: split.undelivered,
        overdueLeads: overdueQueue(group).length,
      };
    })
    .sort((a, b) => a.executionRate - b.executionRate);
}

/**
 * The actions M4 offers, and what each one is allowed to change.
 *
 * They are listed rather than wired: this build has no scheduler behind it, and a button
 * that claims to reschedule a touch it cannot reschedule is worse than no button. The
 * screen prints the list and says so.
 */
export const QUEUE_ACTIONS = [
  { key: "escalate", label: "Escalate to the agent", writes: "An alert on the agent's queue, and a row in the audit log" },
  { key: "reassign", label: "Reassign the lead", writes: "Owner change plus reassignment history (§29)" },
  { key: "reschedule", label: "Auto-reschedule the missed touch", writes: "A new scheduled touch on the existing plan" },
  { key: "coach", label: "Add to the coaching list", writes: "A coaching note against the agent, visible on the scorecard" },
  { key: "notify", label: "Bulk-notify the selected leads", writes: "One approved message per lead, subject to the 48-hour guard" },
];
