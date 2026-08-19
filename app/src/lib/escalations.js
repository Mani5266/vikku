// M8. Escalation & Objection Desk — Thesis §24 (reason-based corrective action),
// §31 (the manager's daily pattern), §33 (the worked example).
//
// The queue of leads that need somebody more senior than the agent, grouped by the
// objection that put them there, each carrying the corrective action §24 prescribes.
//
// The desk works two pools, and keeping them apart is the point of the screen:
//
//   · **Live** — the objection is open and somebody can still act on it today.
//   · **Closed without escalation** — the lead was closed for an objection that had a
//     named owner and a prescribed action, and it never reached that owner. §33's worked
//     example is exactly this: four of seven price objectors never received counseling.
//     That pool is not work, it is evidence, and it is what makes the case for the desk.
//
// A limit worth stating rather than hiding: an objection on an *open* lead lives in the
// call remark, and parsing remarks is the AI layer, which is not built. So the live
// detectors below run on structural facts the dataset does carry — surgery advised and not
// booked, a no-show never recovered, a plan that slipped. Three of the six objections have
// no live detector, and the screen says so on the queue rather than showing an empty box.

import { pct } from "./funnel.js";

/**
 * The §24 table, verbatim in structure: objection, who it routes to, and what that person
 * is supposed to do. `detectLive` may be null — that is a statement about this build, not
 * about the objection.
 */
export const OBJECTIONS = [
  {
    key: "price",
    label: "Price issue",
    routesTo: "Financial counselor",
    action: "Counselor call, package explanation, EMI, insurance check, controlled discount, value comparison",
    detectLive: (row) => row.status === "Pending" && row.surgery_advised && !row.surgery_booked,
    liveBasis: "Surgery advised, no date booked, lead still open",
    closedReasons: [
      "Treatment cost high",
      "Discount requested",
      "EMI required",
      "Insurance unavailable",
      "Budget insufficient",
      "Financial counseling not completed",
      "Lower competitor price",
    ],
    // The §33 test: was the prescribed action ever performed on the leads closed for it?
    prescribedDone: (row) => row.financial_counseling_completed,
    prescribedLabel: "financial counseling",
  },
  {
    key: "fear",
    label: "Surgery fear",
    routesTo: "Doctor",
    action: "Doctor counseling, procedure explainer, recovery timeline, pain-management info, testimonial, family counseling",
    detectLive: null,
    liveBasis: "Recorded in the call remark, which this build does not parse — see the AI layer",
    closedReasons: ["Surgery fear", "Wants to wait", "Symptoms reduced"],
    prescribedDone: (row) => row.doctor_interaction,
    prescribedLabel: "any contact with a doctor",
  },
  {
    key: "trust",
    label: "Doctor trust",
    routesTo: "Doctor / Manager",
    action: "Doctor profile, credentials, procedure volume, video consultation, success story, doctor callback",
    detectLive: null,
    liveBasis: "Recorded in the call remark, which this build does not parse — see the AI layer",
    closedReasons: ["Doctor confidence issue", "Requested another doctor", "Waiting time issue"],
    prescribedDone: (row) => row.doctor_profile_sent || row.doctor_interaction,
    prescribedLabel: "the doctor profile or a doctor callback",
  },
  {
    key: "location",
    label: "Location",
    routesTo: "Manager",
    action: "Nearest branch, map and travel info, video consultation, camp or satellite consultation, suitable timing",
    detectLive: null,
    liveBasis: "Recorded in the call remark, which this build does not parse — see the AI layer",
    closedReasons: ["Hospital too far", "Branch unavailable", "Preferred local facility", "Out of location"],
    prescribedDone: (row) => row.appointment_suggested,
    prescribedLabel: "an alternative slot or branch offer",
  },
  {
    key: "no-show",
    label: "Appointment no-show",
    routesTo: "Agent / Front desk",
    action: "Reschedule, reminder sequence, pre-appointment call, RCS/MMS appointment card, video alternative, no-show reason capture",
    detectLive: (row) => row.no_show && !row.no_show_recovered,
    liveBasis: "Missed the appointment and was never recovered",
    closedReasons: ["Appointment timing unsuitable"],
    prescribedDone: (row) => row.no_show_recovered,
    prescribedLabel: "a recovery attempt",
  },
  {
    key: "follow-up",
    label: "Follow-up missed",
    routesTo: "Manager",
    action: "Agent alert, escalation, auto-reschedule, compliance report, Hot overdue queue",
    detectLive: (row) =>
      row.status === "Pending" && !row.followup_compliant && ["Hot", "Warm"].includes(row.temperature),
    liveBasis: "Open Hot or Warm lead whose plan has slipped",
    closedReasons: ["First response delayed", "Follow-up missed", "Insufficient calls", "Message not sent"],
    prescribedDone: (row) => row.followup_compliant,
    prescribedLabel: "the follow-up plan it was owed",
  },
];

export function objectionByKey(key) {
  return OBJECTIONS.find((objection) => objection.key === key) ?? null;
}

/** Age of an escalation, in days. Derived from lead age — the dataset carries no raise-time. */
const ageOf = (row) => row.age_days ?? 0;

/**
 * The live queue for one objection. Empty when the objection has no live detector, which
 * the caller distinguishes from "nothing to do" via `objection.detectLive`.
 */
export function liveQueue(rows, objection) {
  if (!objection.detectLive) return [];
  return rows
    .filter(objection.detectLive)
    .map((row) => ({
      id: row.id,
      objection: objection.key,
      objectionLabel: objection.label,
      patient_name: row.patient_name,
      phone_number: row.phone_number,
      disease: row.disease,
      branch: row.branch,
      agent_name: row.agent_name,
      doctor_name: row.doctor_name,
      temperature: row.temperature,
      owner: objection.routesTo,
      action: objection.action,
      ageDays: ageOf(row),
      // The evidence link §29 requires: what on this lead says the objection is real.
      evidence: objection.liveBasis,
      prescribedDone: Boolean(objection.prescribedDone(row)),
      value: row.quoted_package ?? null,
    }))
    .sort((a, b) => b.ageDays - a.ageDays);
}

/**
 * Leads closed for this objection, split by whether the prescribed action was ever
 * performed. `never` is the number that makes the argument.
 */
export function closedWithoutEscalation(rows, objection) {
  const closed = rows.filter(
    (row) => row.expired && objection.closedReasons.includes(row.loss_reason || "")
  );
  const never = closed.filter((row) => !objection.prescribedDone(row));
  return {
    closed: closed.length,
    never: never.length,
    neverShare: pct(never.length, closed.length),
    recoverable: never.filter((row) => row.recoverable).length,
    lostValue: never.reduce((sum, row) => sum + (row.quoted_package ?? 0), 0),
    prescribedLabel: objection.prescribedLabel,
    rows: never.slice(0, 50).map((row) => ({
      id: row.id,
      patient_name: row.patient_name,
      disease: row.disease,
      agent_name: row.agent_name,
      loss_reason: row.loss_reason,
      recoverable: row.recoverable,
      daysSinceClosure: row.days_since_closure,
    })),
  };
}

/** Every objection queue, ordered by how much live work is sitting in it. */
export function escalationDesk(rows) {
  return OBJECTIONS.map((objection) => {
    const live = liveQueue(rows, objection);
    const closed = closedWithoutEscalation(rows, objection);
    return {
      key: objection.key,
      value: objection.label,
      routesTo: objection.routesTo,
      action: objection.action,
      liveBasis: objection.liveBasis,
      detectable: Boolean(objection.detectLive),
      live: live.length,
      liveRows: live,
      oldestDays: live[0]?.ageDays ?? 0,
      ...closed,
    };
  }).sort((a, b) => b.live - a.live || b.never - a.never);
}

/** The desk's one-line summary — live work first, then the evidence pool behind it. */
export function deskSummary(desk) {
  return {
    live: desk.reduce((sum, queue) => sum + queue.live, 0),
    queues: desk.filter((queue) => queue.live > 0).length,
    undetectable: desk.filter((queue) => !queue.detectable).length,
    closedWithoutAction: desk.reduce((sum, queue) => sum + queue.never, 0),
    recoverable: desk.reduce((sum, queue) => sum + queue.recoverable, 0),
    lostValue: desk.reduce((sum, queue) => sum + queue.lostValue, 0),
  };
}

/**
 * The §24 guard on closing an escalation: an outcome and a note, always. A discount
 * approval carries three more fields, because §29 requires an approver on the record and
 * an approval nobody signed is the one audit finding that ends a hospital contract.
 */
export const RESOLUTION_OUTCOMES = [
  "Objection answered — lead continues",
  "Appointment or surgery booked",
  "Handed to the doctor",
  "Handed to financial counseling",
  "Returned to the agent with instructions",
  "Closed — objection stands",
];

export const MIN_NOTE = 15;

export function resolutionProblems(draft = {}) {
  const problems = [];
  if (!draft.outcome) problems.push("Pick what actually happened");
  else if (!RESOLUTION_OUTCOMES.includes(draft.outcome)) problems.push("That outcome is not on the list");

  const note = String(draft.note || "").trim();
  if (note.length < MIN_NOTE) {
    problems.push(`Write what was said, in at least ${MIN_NOTE} characters — the next person to open this lead reads it`);
  }

  if (draft.discount) {
    const amount = Number(draft.discountAmount);
    if (!Number.isFinite(amount) || amount <= 0) problems.push("A discount needs an amount");
    if (!String(draft.discountJustification || "").trim()) problems.push("A discount needs a justification — it goes to the audit log");
    if (!String(draft.approver || "").trim()) problems.push("A discount needs a named approver");
  }
  return problems;
}
