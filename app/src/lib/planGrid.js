import { FOLLOWUP_PROTOCOLS, checkSuppression } from "./followupProtocols.js";

// A5 — the follow-up plan as a grid (§12–§16, §30.5).
//
// The protocol already exists and A7 already lists today's duties. What was missing is the shape of
// the whole plan: which days are done, which were skipped, which were suppressed and why, and how
// many days are left. An agent asked "did you follow the plan?" currently has no screen that answers.
//
// One rule runs through it: a skipped day never disappears. A missed Day 3 call stays visible as
// missed on Day 5, because the client's actual complaint is that the follow-ups nobody made are
// exactly the ones nobody can see.

const DAY = 24 * 60 * 60 * 1000;

/** Whole days elapsed since the plan was activated, 1-based — activation day is day 1. */
export function planDay(plan, now = new Date()) {
  if (!plan?.activated_at) return null;
  const elapsed = now.getTime() - new Date(plan.activated_at).getTime();
  return Math.max(1, Math.floor(elapsed / DAY) + 1);
}

/**
 * The plan, one row per scheduled day.
 *
 * `interactions` are the lead's real logged calls; a day counts as called when a call was logged
 * inside that day's window. Nothing is inferred from the lead's status — a status can be set by
 * anybody, a logged call has a timestamp on it.
 */
export function planGrid({ plan, interactions = [], communications = [], now = new Date() }) {
  const protocol = FOLLOWUP_PROTOCOLS[plan?.temperature];
  if (!protocol || !plan?.activated_at) return null;

  const start = new Date(plan.activated_at).getTime();
  const today = planDay(plan, now);
  const suppression = checkSuppression(plan);

  const rows = protocol.steps.map((step) => {
    const from = start + (step.day - 1) * DAY;
    const to = from + DAY;
    const inWindow = (at) => {
      const time = new Date(at ?? 0).getTime();
      return time >= from && time < to;
    };

    const calls = interactions.filter((entry) => inWindow(entry.interaction_date));
    const messages = communications.filter((entry) => inWindow(entry.sent_at || entry.scheduled_for));
    const sent = messages.filter((entry) => !entry.suppressed);
    const blocked = messages.filter((entry) => entry.suppressed);

    // The state of the day, in the order that matters: what happened beats what was planned.
    let callState = "none";
    if (calls.length) callState = "done";
    else if (!step.callRequired) callState = "not-scheduled";
    else if (step.day > today) callState = "due";
    else if (step.day === today) callState = "today";
    else callState = "missed";

    let messageState = "none";
    if (sent.length) messageState = "done";
    else if (blocked.length) messageState = "suppressed";
    else if (!step.messageRequired) messageState = "not-scheduled";
    else if (suppression.active) messageState = "suppressed";
    else if (step.day > today) messageState = "due";
    else if (step.day === today) messageState = "today";
    else messageState = "missed";

    return {
      day: step.day,
      date: new Date(from).toISOString(),
      callActivity: step.callActivity,
      callRequired: step.callRequired,
      callState,
      callsLogged: calls.length,
      messageChannel: step.messageChannel,
      messageActivity: step.messageActivity,
      messageRequired: step.messageRequired,
      messageState,
      suppressedReason: blocked[0]?.suppression_reason ?? (suppression.active ? suppression.reason : null),
      isToday: step.day === today,
      isPast: step.day < today,
    };
  });

  const requiredCalls = rows.filter((row) => row.callRequired);
  const dueSoFar = rows.filter((row) => row.callRequired && row.day <= today);
  const doneSoFar = dueSoFar.filter((row) => row.callState === "done");

  return {
    protocol,
    rows,
    today,
    durationDays: protocol.durationDays,
    daysLeft: Math.max(0, protocol.durationDays - today),
    finished: today > protocol.durationDays,
    suppression,
    requiredCalls: requiredCalls.length,
    completion: dueSoFar.length ? Math.round((doneSoFar.length / dueSoFar.length) * 100) : 100,
    missed: dueSoFar.filter((row) => row.callState === "missed").length,
  };
}

/**
 * §13's ten Warm Day-15 outcomes.
 *
 * At the end of a Warm plan a lead may not sit in a generic "follow-up" status. The screen forces
 * one of these, which is the whole point: an undecided lead that nobody decides about is how 259
 * leads end up "Pending" forever.
 */
export const DAY_15_OUTCOMES = [
  { value: "Appointment booked", closes: false, next: "appointment" },
  { value: "Converted to Hot", closes: false, next: "qualify" },
  { value: "Still deciding — extend 15 days", closes: false, next: "extend" },
  { value: "Wants to be called after a fixed date", closes: false, next: "extend" },
  { value: "Moved to Cold nurture", closes: false, next: "qualify" },
  { value: "Financial counselling needed", closes: false, next: "stay" },
  { value: "Doctor callback needed", closes: false, next: "stay" },
  { value: "Chose another hospital", closes: true, next: "close" },
  { value: "No longer needs treatment", closes: true, next: "close" },
  { value: "Unreachable through the whole plan", closes: true, next: "close" },
];

export const RESCHEDULE_REASONS = [
  "Patient asked to be called later",
  "Patient was travelling",
  "Line busy through the day",
  "Hospital holiday",
  "Agent on leave",
  "Escalated — waiting on the doctor",
];
