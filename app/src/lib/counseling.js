// O2. Financial Counseling Desk — Thesis §17 (appointment and conversion), §24 (corrective
// action), §30.7 (the conversion module), §33 (the worked example).
//
// Close the gap between "surgery advised" and "surgery booked".
//
// This is the screen §33 was written about. Its worked example is four of seven price
// objectors who never received counseling — a hospital concluding it had a pricing problem
// when what it had was a process that stopped. So the guard here is not decoration:
//
//   **A lead may not be closed for a price reason unless a counseling session was logged,
//   or the absence of counseling is itself recorded as the reason.**
//
// `closureProblems` enforces it, and it refuses in both directions: it will not accept
// "treatment cost high" on a patient nobody counseled, and it will not accept "financial
// counseling not completed" on a patient who was counseled. A guard that only fires one way
// is a guard people learn to route around.
//
// One field the specification asks for is genuinely absent from the dataset: the patient's
// stated budget, and therefore the gap between it and the quoted package. `gapAnalysis`
// returns the shape with `stated: null` rather than estimating it, because a rupee figure
// invented in front of a financial counselor is the fastest way to lose the room.

import { pct, rupees } from "./funnel.js";

/**
 * The §17 post-consultation states, in order. `reached` is evaluated top-down and the
 * *last* matching state wins, so a patient who is booked reads as booked rather than as
 * every rung they climbed to get there.
 */
export const COUNSELING_STATES = [
  {
    key: "advised",
    label: "Surgery advised",
    reached: (row) => row.surgery_advised,
    owner: "Counselor",
    next: "Log a counseling session",
  },
  {
    key: "counseling-pending",
    label: "Financial counseling pending",
    reached: (row) => row.surgery_advised && !row.financial_counseling_completed,
    owner: "Counselor",
    next: "Call the patient and explain the package",
  },
  {
    key: "counseling-done",
    label: "Financial counseling completed",
    reached: (row) => row.financial_counseling_completed,
    owner: "Counselor",
    next: "Check insurance or offer EMI",
  },
  {
    key: "insurance-pending",
    label: "Insurance approval pending",
    reached: (row) => row.insurance_available && !row.insurance_approved,
    owner: "Insurance desk",
    next: "Chase the approval",
  },
  {
    key: "date-pending",
    label: "Surgery date pending",
    reached: (row) => row.financial_counseling_completed && !row.surgery_booked && (!row.insurance_available || row.insurance_approved),
    owner: "Counselor",
    next: "Agree a date",
  },
  {
    key: "booked",
    label: "Surgery booked",
    reached: (row) => row.surgery_booked,
    owner: "Admissions",
    next: "Hand to admissions",
  },
];

export function stateOf(row) {
  const reached = COUNSELING_STATES.filter((state) => state.reached(row));
  return reached[reached.length - 1] ?? null;
}

/** Everybody the desk owns: advised surgery, whatever happened next. */
export function counselingQueue(rows) {
  return rows
    .filter((row) => row.surgery_advised)
    .map((row) => {
      const state = stateOf(row);
      return {
        id: row.id,
        patient_name: row.patient_name,
        phone_number: row.phone_number,
        disease: row.disease,
        doctor_name: row.doctor_name,
        branch: row.branch,
        agent_name: row.agent_name,
        state: state?.key ?? "advised",
        stateLabel: state?.label ?? "Surgery advised",
        owner: state?.owner ?? "Counselor",
        next: state?.next ?? "Log a counseling session",
        quoted: row.quoted_package,
        quotedLabel: row.quoted_package ? rupees(row.quoted_package) : "Not quoted",
        counseled: Boolean(row.financial_counseling_completed),
        insurance: row.insurance_available
          ? row.insurance_approved
            ? "Approved"
            : "Approval pending"
          : "None",
        discountRequested: Boolean(row.discount_requested),
        booked: Boolean(row.surgery_booked),
        admitted: Boolean(row.admitted),
        status: row.status,
        lossCategory: row.loss_category,
        lossReason: row.loss_reason,
        ageDays: row.age_days,
      };
    })
    .sort((a, b) => Number(a.booked) - Number(b.booked) || Number(a.counseled) - Number(b.counseled) || (b.quoted ?? 0) - (a.quoted ?? 0));
}

/**
 * Counseling coverage — of the patients advised surgery, how many actually got the
 * conversation. §28 requires this to be reported as **process compliance**, never as an
 * outcome number, which is why it sits apart from the conversion figures below.
 */
export function coverage(rows) {
  const advised = rows.filter((row) => row.surgery_advised);
  const counseled = advised.filter((row) => row.financial_counseling_completed);
  return {
    advised: advised.length,
    counseled: counseled.length,
    coverageRate: pct(counseled.length, advised.length),
    uncounseled: advised.length - counseled.length,
    // The §33 number: advised, never counseled, and never booked.
    uncounseledAndLost: advised.filter((row) => !row.financial_counseling_completed && !row.surgery_booked).length,
  };
}

/**
 * Conversion with counseling against conversion without it.
 *
 * Stated as two rates with their bases beside them, because a gap between two percentages is
 * only an argument once a reader can see it is 154 patients against 55 and not 4 against 3.
 */
export function counselingEffect(rows) {
  const advised = rows.filter((row) => row.surgery_advised);
  const line = (group, label) => ({
    value: label,
    patients: group.length,
    booked: group.filter((row) => row.surgery_booked).length,
    bookingRate: pct(group.filter((row) => row.surgery_booked).length, group.length),
    revenue: group.reduce((sum, row) => sum + (row.revenue || 0), 0),
  });
  const withIt = line(advised.filter((row) => row.financial_counseling_completed), "Counseling completed");
  const without = line(advised.filter((row) => !row.financial_counseling_completed), "Never counseled");
  return {
    withCounseling: withIt,
    withoutCounseling: without,
    // A difference in percentage points, not a ratio. "Twice as likely" hides the base.
    pointsGained: Math.round((withIt.bookingRate - without.bookingRate) * 10) / 10,
  };
}

/** Discount usage, and whether it actually moved anything. */
export function discountEffect(rows) {
  const advised = rows.filter((row) => row.surgery_advised);
  const line = (group, label) => ({
    value: label,
    patients: group.length,
    booked: group.filter((row) => row.surgery_booked).length,
    bookingRate: pct(group.filter((row) => row.surgery_booked).length, group.length),
    revenue: group.reduce((sum, row) => sum + (row.revenue || 0), 0),
    averagePackage: group.length
      ? Math.round(group.reduce((sum, row) => sum + (row.quoted_package || 0), 0) / group.length)
      : 0,
  });
  return {
    requested: line(advised.filter((row) => row.discount_requested), "Discount requested"),
    notRequested: line(advised.filter((row) => !row.discount_requested), "No discount requested"),
    usageRate: pct(advised.filter((row) => row.discount_requested).length, advised.length),
  };
}

/** Insurance, which changes the conversation more than the discount does. */
export function insuranceMix(rows) {
  const advised = rows.filter((row) => row.surgery_advised);
  const buckets = [
    { value: "Insurance approved", match: (row) => row.insurance_available && row.insurance_approved },
    { value: "Approval pending", match: (row) => row.insurance_available && !row.insurance_approved },
    { value: "Self-pay", match: (row) => !row.insurance_available },
  ];
  return buckets.map((bucket) => {
    const group = advised.filter(bucket.match);
    return {
      value: bucket.value,
      patients: group.length,
      share: pct(group.length, advised.length),
      booked: group.filter((row) => row.surgery_booked).length,
      bookingRate: pct(group.filter((row) => row.surgery_booked).length, group.length),
    };
  });
}

/**
 * The gap between what the hospital quoted and what the patient said they could pay.
 *
 * `stated` is null throughout: the dataset has no budget field, so the gap cannot be
 * computed. The function still exists, and still returns the quoted side, because a screen
 * that silently drops the row teaches nobody that the field is missing — and this is the
 * single field that would make the desk's numbers actionable.
 */
export function gapAnalysis(rows) {
  const quoted = rows.filter((row) => row.surgery_advised && row.quoted_package);
  return {
    patients: quoted.length,
    averageQuoted: quoted.length
      ? Math.round(quoted.reduce((sum, row) => sum + row.quoted_package, 0) / quoted.length)
      : 0,
    stated: null,
    averageGap: null,
    missingField: "The patient's stated budget is not captured anywhere in the current intake, so the gap cannot be measured — only the quote can.",
  };
}

/** The §23 reasons that count as a price closure for the purposes of the guard. */
export const PRICE_REASONS = [
  "Treatment cost high",
  "Discount requested",
  "EMI required",
  "Insurance unavailable",
  "Budget insufficient",
  "Lower competitor price",
];

/** The reason that records the absence of counseling as the cause. */
export const NO_COUNSELING_REASON = "Financial counseling not completed";

/**
 * The §33 guard, both ways.
 *
 * `lead` is a queue row from `counselingQueue`. Returns problems, never a boolean, so the
 * screen prints the reason beside the disabled button.
 */
export function closureProblems({ lead, reason } = {}) {
  const problems = [];
  if (!lead) return ["Pick a patient"];
  if (!reason) return ["Pick the reason this patient is not going ahead"];

  if (PRICE_REASONS.includes(reason) && !lead.counseled) {
    problems.push(
      `This patient was never counseled, so "${reason}" is not something anybody knows. Either log the counseling session first, or close this as "${NO_COUNSELING_REASON}" — which is the truth and is what §33 exists to catch.`
    );
  }

  if (reason === NO_COUNSELING_REASON && lead.counseled) {
    problems.push(
      "Counseling was completed on this patient, so the absence of counseling cannot be the reason. Pick the objection the counselor actually heard."
    );
  }

  return problems;
}

/** What a counseling session records. A session with no outcome is not a session. */
export const SESSION_OUTCOMES = [
  "Package explained — patient considering",
  "EMI offered",
  "Insurance check started",
  "Discount requested — pending approval",
  "Escalated to the doctor",
  "Surgery date agreed",
  "Patient declined",
];

export const MIN_SESSION_NOTE = 15;

export function sessionProblems(draft = {}) {
  const problems = [];
  if (!draft.outcome) problems.push("Pick what came out of the session");
  else if (!SESSION_OUTCOMES.includes(draft.outcome)) problems.push("That outcome is not on the list");
  if (String(draft.note || "").trim().length < MIN_SESSION_NOTE) {
    problems.push(`Write what was discussed, in at least ${MIN_SESSION_NOTE} characters`);
  }
  if (draft.outcome === "Discount requested — pending approval") {
    if (!Number(draft.discountAmount)) problems.push("A discount request needs an amount");
    if (!String(draft.justification || "").trim()) problems.push("A discount request needs a justification — §29 writes it to the audit log");
  }
  return problems;
}
