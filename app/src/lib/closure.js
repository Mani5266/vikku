import { EXPIRED_LEAD_SEGMENTS, reasonDefaults } from "./reasonTaxonomy.js";

// A9 — non-conversion reason capture (§3.3, §18, §19, §23).
//
// This is the screen the whole product is arguing for. The client's sheet closes leads as "Lead
// Expired", which is an operational status wearing a business reason's clothes: it says the clock
// ran out, not why nobody bought. Every downstream question — which reasons are recoverable, what
// the 90-day pool contains, which corrective action a manager owes — reads a field that today gets
// typed as "not interested" and forgotten.
//
// So the eight §23 fields are mandatory, and one of them cannot be typed at all.
//
// `evidence_source` must point at a real activity record — a call, a message, an appointment. A
// closure that cites nothing is the same unfalsifiable claim as a copy-pasted remark, and the
// picker below is built from records that actually exist on the lead, so an agent cannot invent one.

export const MIN_DETAIL = 20;

/** Statuses that are not business reasons and must be refused (§18). */
export const REJECTED_REASONS = ["Lead Expired", "Expired", "Closed", "No response", "Old lead"];

/**
 * Build the evidence picker from the lead's real activity.
 *
 * Nothing is synthesised here: if a lead has no calls and no messages there is nothing to cite, and
 * the screen says so rather than offering a blank dropdown.
 */
export function evidenceOptions({ interactions = [], communications = [], appointment = null }) {
  const options = [];

  for (const call of interactions) {
    const when = call.interaction_date;
    const summary =
      call.contact_outcome === "Not Connected"
        ? `Not connected — ${call.not_connected_reason || "no reason recorded"}`
        : (call.patient_said || call.feedback || "Call logged").slice(0, 80);
    options.push({
      id: call.id,
      kind: "Call",
      when,
      label: `Call · ${summary}`,
    });
  }

  for (const message of communications) {
    options.push({
      id: message.id,
      kind: message.suppressed ? "Suppressed message" : "Message",
      when: message.sent_at || message.scheduled_for || message.created_at,
      label: `${message.suppressed ? "Blocked" : "Sent"} ${message.channel} · ${
        message.template_name || message.nurture_label || "message"
      }`,
    });
  }

  if (appointment?.state) {
    options.push({
      id: `appointment_${appointment.updated_at || appointment.at || "current"}`,
      kind: "Appointment",
      when: appointment.updated_at || appointment.at,
      label: `Appointment · ${appointment.state}${appointment.reason ? ` — ${appointment.reason}` : ""}`,
    });
  }

  return options.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
}

/** The segment a reason lands in, and whether the 90-day pool may touch it (§19, §20). */
export function segmentFor(category, reason, recoverable) {
  const defaults = reasonDefaults(category, reason);
  const segment = recoverable === false ? "Genuine Lost" : defaults?.segment ?? "Long-Term Nurture";
  const row = EXPIRED_LEAD_SEGMENTS.find((s) => s.value === segment);
  return { segment, reactivation: row?.reactivation ?? "Not eligible" };
}

/**
 * Everything that stops a closure, named in the agent's words.
 *
 * Returned as a list rather than a boolean so the screen can print what is still missing *before*
 * the agent taps Submit — a form that only tells you at the end is a form people learn to fight.
 */
export function closureProblems(draft = {}, { evidenceIds = [] } = {}) {
  const problems = [];

  if (!draft.category) problems.push("Reason category");
  if (!draft.reason) problems.push("Which reason exactly");

  if ((draft.detail || "").trim().length < MIN_DETAIL) {
    problems.push(`A remark of at least ${MIN_DETAIL} characters`);
  }
  if (REJECTED_REASONS.some((bad) => (draft.detail || "").trim().toLowerCase() === bad.toLowerCase())) {
    problems.push('"Lead expired" is a status, not a reason — say why they did not come');
  }

  if (!draft.evidenceId) problems.push("Evidence — pick the call or message this is based on");
  else if (!evidenceIds.includes(draft.evidenceId)) {
    problems.push("That evidence record no longer exists on this lead");
  }

  if (draft.recoverable === null || draft.recoverable === undefined) {
    problems.push("Recoverable — yes or no");
  }

  if (draft.recoverable === true) {
    if (!draft.action) problems.push("What we will do about it");
    if (!draft.owner) problems.push("Who owns that action");
    if (!draft.reviewDate) problems.push("When it gets reviewed");
    else if (new Date(draft.reviewDate).getTime() < Date.now()) {
      problems.push("The review date is in the past");
    }
  }

  if (draft.category === "Competition" && !draft.competitor) {
    problems.push("Which hospital they chose");
  }

  return problems;
}

export const OWNERS = [
  "Telecalling manager",
  "Financial counsellor",
  "Clinical operations",
  "Marketing",
  "Branch manager",
];
