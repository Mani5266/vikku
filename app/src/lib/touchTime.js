// Touch time and the auto-scheduled task list — Thesis §7 (first response),
// §12–15 (follow-up protocols), §17 (compliance).
//
// Two rules from the requirement conversation are enforced here rather than described:
//
//   1. A new lead has a 5-minute clock. It starts when the lead arrives, not when the
//      agent notices, and the manager is alerted when it runs out.
//   2. Once a temperature is set, the protocol's calls are scheduled automatically and
//      are mandatory. The agent does not choose whether a scheduled call happens; the
//      only thing in their control is the outcome they log against it.
//
// Calls are never gated by the 48-hour message floor — that floor is §8 and governs
// messages only. `dutiesFor` returns the call duty regardless of message state.

import { FOLLOWUP_PROTOCOLS, checkSuppression, stepForDay } from "@/lib/followupProtocols";
import { TOUCH_SLA_MINUTES } from "@/lib/funnel";

const MINUTE = 60 * 1000;

export { TOUCH_SLA_MINUTES };

/** Minutes from lead creation to the first logged interaction, or null if none yet. */
export function firstTouchMinutes(lead, interactions) {
  if (!interactions.length) return null;
  const first = interactions.reduce((earliest, i) =>
    new Date(i.interaction_date) < new Date(earliest.interaction_date) ? i : earliest
  );
  return Math.max(0, Math.round((new Date(first.interaction_date) - new Date(lead.created_at)) / MINUTE));
}

/**
 * The state of a lead's first-touch clock.
 *
 *   met       — first contact happened inside the SLA
 *   late      — first contact happened, but after the SLA
 *   running   — no contact yet, clock still inside the SLA
 *   breached  — no contact yet, clock has run out; the manager alert fires on this
 */
export function touchTimeState(lead, interactions, now = new Date()) {
  const touched = firstTouchMinutes(lead, interactions);
  if (touched !== null) {
    return {
      state: touched <= TOUCH_SLA_MINUTES ? "met" : "late",
      minutes: touched,
      remaining: null,
      alert: false,
    };
  }

  const waiting = Math.max(0, Math.round((new Date(now) - new Date(lead.created_at)) / MINUTE));
  const remaining = TOUCH_SLA_MINUTES - waiting;
  return {
    state: remaining > 0 ? "running" : "breached",
    minutes: waiting,
    remaining,
    alert: remaining <= 0,
  };
}

export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/**
 * Calls the protocol required on or before the lead's current day, against the calls
 * actually logged. A positive `missed` is a compliance failure with a number on it,
 * which is what §17 asks the manager screen to report.
 */
export function callCompliance(lead, interactions) {
  const protocol = FOLLOWUP_PROTOCOLS[lead.plan?.temperature];
  if (!protocol) return { required: 0, done: 0, missed: 0, dueDays: [] };

  const day = lead.plan?.day ?? 1;
  const dueDays = protocol.steps.filter((s) => s.callRequired && s.day <= day).map((s) => s.day);
  const done = interactions.length;
  return {
    required: dueDays.length,
    done,
    missed: Math.max(0, dueDays.length - done),
    dueDays,
  };
}

/**
 * What this lead owes today: the scheduled call, the scheduled message, and whether
 * either is already overdue. `messageSuppressed` carries the §12 reason when the plan
 * has been suppressed — the call duty survives a suppression, the message does not.
 */
export function dutiesFor(lead, interactions, communications, now = new Date()) {
  const temperature = lead.plan?.temperature;
  const day = lead.plan?.day ?? 1;
  const step = stepForDay(temperature, day);
  const suppression = checkSuppression(lead.plan || {});
  const compliance = callCompliance(lead, interactions);
  const touch = touchTimeState(lead, interactions, now);

  const sentToday = communications.some(
    (c) => !c.suppressed && c.sent_at && c.protocol_day === day
  );

  const duties = [];

  // Wording is the agent's, not the specification's: "call now", "call today", "waiting to be
  // messaged". Nobody working a queue can act on the word "cadence".
  // A dead number is not a call to make. Telling an agent to keep ringing it wastes the only
  // thing they are short of.
  if (lead.number_valid === false) {
    duties.push({
      kind: "invalid",
      label: "Number is wrong — log it once",
      detail: "Write it down and this lead stops coming back to you.",
      overdue: false,
      mandatory: true,
    });
  } else if (touch.state === "running" || touch.state === "breached") {
    duties.push({
      kind: "first-call",
      label: "Call now — first call not made yet",
      detail:
        touch.state === "breached"
          ? `Waiting ${formatMinutes(touch.minutes)}. Your manager can see this.`
          : `${formatMinutes(Math.max(0, touch.remaining))} left to make the first call.`,
      overdue: touch.state === "breached",
      mandatory: true,
    });
  }

  if (step?.callRequired) {
    duties.push({
      kind: "call",
      label: compliance.missed > 0 ? "Call today — and you are behind" : "Call today",
      detail: step.doubleDial
        ? "Try twice, at two different times of day."
        : step.callActivity,
      overdue: compliance.missed > 0,
      mandatory: true,
    });
  }

  if (compliance.missed > 0) {
    duties.push({
      kind: "backlog",
      label: `${compliance.missed} call${compliance.missed > 1 ? "s" : ""} from earlier days not logged`,
      detail: `The plan asked for ${compliance.required} by today. ${compliance.done} logged. Not answering counts — forgetting does not.`,
      overdue: true,
      mandatory: true,
    });
  }

  if (step?.messageRequired && step.messageChannel !== "None") {
    duties.push({
      kind: "message",
      label: suppression.active ? "No message needed today" : `Send today's ${step.messageChannel} message`,
      detail: suppression.active
        ? suppression.reason
        : sentToday
          ? "Already sent today."
          : "One message every two days, so patients are not spammed.",
      overdue: !suppression.active && !sentToday,
      mandatory: false,
      suppressed: suppression.active,
    });
  }

  return {
    lead,
    temperature,
    day,
    step,
    touch,
    compliance,
    suppression,
    duties,
    overdueCount: duties.filter((d) => d.overdue).length,
  };
}

/** Every lead's duties, worst first — the order the agent should work the day in. */
export function taskQueue(leads, interactionsFor, communicationsFor, now = new Date()) {
  return leads
    .map((lead) => dutiesFor(lead, interactionsFor(lead.id), communicationsFor(lead.id), now))
    .filter((task) => task.duties.length > 0)
    .sort((a, b) => {
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
      const priority = { Hot: 3, "Not Connected": 2, Warm: 1, Cold: 0 };
      return (priority[b.temperature] ?? 0) - (priority[a.temperature] ?? 0);
    });
}
