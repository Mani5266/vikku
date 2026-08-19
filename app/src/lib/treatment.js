// What happens after the patient has seen the doctor — Thesis §17 (appointment and conversion),
// §24 (corrective action), §30.7 (the conversion module), §33 (the worked example).
//
// This is the half of the funnel the live product did not have.
//
// The lead flow ran Qualify → Plan → Appointment → and then stopped. `Consultation Completed` was
// a terminal state, `isConverted()` returned true on it, and the next step read "Nothing — they
// saw the doctor. Anything after this belongs to the clinical team." The queue filed the lead
// under Finished and nobody looked at it again.
//
// A hospital earns nothing from a consultation. It earns from the operation. The client's own
// arithmetic is 100 leads → 50 quality → 50% reach OPD → 50% of those get admitted, so the
// consultation is the *middle* of the funnel and everything past it was invisible. In the
// analytics dataset, 209 patients were advised surgery and 51 never booked one. Those 51 had
// already been paid for twice — once in ad spend and once in a surgeon's time — and were the most
// likely leads in the whole system to convert. They sat in a bucket labelled Finished.
//
// §33's worked example is exactly this gap: four of seven price objectors who never received
// counseling, and a hospital that concluded it had a pricing problem when it had a process that
// stopped. This file is the process that does not stop.
//
// Nothing here decides clinical questions. The doctor decides; the telecaller records what was
// decided and then works the two things that lose a booked surgery — the money conversation and
// the date.

import { pct } from "./funnel.js";

/** What the doctor concluded. Recorded by whoever spoke to the patient, never inferred. */
export const CONSULTATION_DECISIONS = [
  {
    value: "Surgery advised",
    plain: "The doctor has recommended an operation",
    clinical: false,
    detail: "The lead stays open. Money and a date are what stand between here and a booking.",
  },
  {
    value: "Tests advised",
    plain: "More reports needed before the doctor decides",
    clinical: false,
    detail: "Not a decision yet. The lead stays open and the follow-up is about the reports.",
  },
  {
    value: "Medical management",
    plain: "Treated with medicine, no operation needed",
    clinical: true,
    detail: "A real clinical outcome. The patient was helped and there is nothing to sell.",
  },
  {
    value: "No treatment needed",
    plain: "Nothing wrong that needs treating",
    clinical: true,
    detail: "A real clinical outcome. Counting it as a lost lead would make every conversion rate lie.",
  },
];

export function decisionByValue(value) {
  return CONSULTATION_DECISIONS.find((decision) => decision.value === value) ?? null;
}

/**
 * A decision the doctor made is not a lead the sales funnel lost.
 *
 * This distinction is the reason `clinical` exists. A patient sent home with medicine was treated
 * correctly; filing them beside "chose another hospital" would tell the MD his conversion rate is
 * falling when what changed was the case mix. The funnel has to be able to take them out.
 */
export function isClinicalOutcome(lead) {
  return Boolean(decisionByValue(lead?.treatment?.decision)?.clinical);
}

/** The steps between "surgery advised" and "surgery booked". In order, and each one loses patients. */
export const TREATMENT_STEPS = [
  {
    key: "counseling",
    label: "Money talk done",
    plain: "Somebody has explained the package, the EMI options and what insurance covers",
    done: (t) => Boolean(t?.counselingAt),
  },
  {
    key: "insurance",
    label: "Insurance settled",
    plain: "Either approved, or the patient knows they are paying themselves",
    done: (t) => t?.insurance === "Not using insurance" || t?.insurance === "Approved",
  },
  {
    key: "date",
    label: "Date agreed",
    plain: "A surgery date the patient has said yes to",
    done: (t) => Boolean(t?.surgeryDate),
  },
];

export const TREATMENT_STATES = {
  NONE: "none",
  AWAITING_DECISION: "awaiting-decision",
  TESTS: "tests-advised",
  COUNSELING_DUE: "counseling-due",
  INSURANCE_DUE: "insurance-due",
  DATE_DUE: "date-due",
  BOOKED: "surgery-booked",
  CLINICAL: "clinical-outcome",
  CLOSED: "closed",
};

/**
 * Where a lead sits after the consultation.
 *
 * Returns `NONE` for anybody who has not been seen yet, so a caller can ask this of any lead
 * without first checking the appointment.
 */
export function treatmentState(lead) {
  if (lead?.closure) return TREATMENT_STATES.CLOSED;
  if (lead?.appointment?.state !== "Consultation Completed") return TREATMENT_STATES.NONE;

  const treatment = lead.treatment;
  if (!treatment?.decision) return TREATMENT_STATES.AWAITING_DECISION;
  if (isClinicalOutcome(lead)) return TREATMENT_STATES.CLINICAL;
  if (treatment.decision === "Tests advised") return TREATMENT_STATES.TESTS;
  if (treatment.surgeryBookedAt) return TREATMENT_STATES.BOOKED;

  const outstanding = TREATMENT_STEPS.filter((step) => !step.done(treatment));
  if (!outstanding.length) return TREATMENT_STATES.DATE_DUE;
  return {
    counseling: TREATMENT_STATES.COUNSELING_DUE,
    insurance: TREATMENT_STATES.INSURANCE_DUE,
    date: TREATMENT_STATES.DATE_DUE,
  }[outstanding[0].key];
}

/** Steps still outstanding, in order. Empty once the surgery can be booked. */
export function outstandingSteps(lead) {
  if (lead?.treatment?.decision !== "Surgery advised") return [];
  return TREATMENT_STEPS.filter((step) => !step.done(lead.treatment));
}

/**
 * Is this lead still the agent's problem?
 *
 * The queue used to answer "no" the moment the consultation finished. It is the single most
 * expensive wrong answer in the product: the patient has been to the hospital, met a surgeon and
 * been told they need an operation, and the system stops asking anybody to call them.
 */
export function isStillWorking(lead) {
  const state = treatmentState(lead);
  return [
    TREATMENT_STATES.AWAITING_DECISION,
    TREATMENT_STATES.TESTS,
    TREATMENT_STATES.COUNSELING_DUE,
    TREATMENT_STATES.INSURANCE_DUE,
    TREATMENT_STATES.DATE_DUE,
  ].includes(state);
}

/** Has this lead reached the thing the hospital is actually paid for? */
export function isBooked(lead) {
  return treatmentState(lead) === TREATMENT_STATES.BOOKED;
}

/**
 * The one instruction, in the agent's words. Feeds the same next-step card the rest of the flow
 * uses, so the post-consultation half reads like the first half rather than like a new product.
 */
export function nextTreatmentStep(lead) {
  const state = treatmentState(lead);
  const name = lead?.patient_name ?? "this patient";

  switch (state) {
    case TREATMENT_STATES.AWAITING_DECISION:
      return {
        label: "Find out what the doctor decided",
        why: `${name} has seen the doctor and nobody has written down the outcome. Until that is recorded this lead is invisible to everybody.`,
        action: "Record the outcome",
      };
    case TREATMENT_STATES.TESTS:
      return {
        label: "Chase the reports",
        why: "The doctor asked for tests before deciding. Nothing moves until the reports are back in front of them.",
        action: "Update the treatment",
      };
    case TREATMENT_STATES.COUNSELING_DUE:
      return {
        label: "Book the money talk",
        why: "Surgery is advised and nobody has explained what it costs. This is the step that loses the most patients who had already said yes.",
        action: "Log the counseling",
      };
    case TREATMENT_STATES.INSURANCE_DUE:
      return {
        label: "Settle the insurance",
        why: "They have had the money talk and the cover is still open. A patient waiting on an approval nobody is chasing goes quiet.",
        action: "Update the insurance",
      };
    case TREATMENT_STATES.DATE_DUE:
      return {
        label: "Get a surgery date agreed",
        why: "Everything is settled except the date. This is the last thing standing between the hospital and the operation.",
        action: "Agree the date",
      };
    case TREATMENT_STATES.BOOKED:
      return {
        label: "Nothing — the surgery is booked",
        why: "Admissions own this patient now.",
        action: null,
      };
    case TREATMENT_STATES.CLINICAL:
      return {
        label: "Nothing — the doctor treated them without surgery",
        why: `${decisionByValue(lead.treatment.decision)?.plain}. This is a finished clinical outcome, not a lost lead.`,
        action: null,
      };
    default:
      return null;
  }
}

/** §23 reasons that are a price objection, for the §33 guard below. */
export const PRICE_REASONS = [
  "Treatment cost high",
  "Discount requested",
  "EMI required",
  "Insurance unavailable",
  "Budget insufficient",
  "Lower competitor price",
];

export const NO_COUNSELING_REASON = "Financial counseling not completed";

/**
 * The §33 guard, on a live lead rather than on a historical report.
 *
 * `lib/counseling.js` already refuses this on the operations desk, which reads finished journeys.
 * The refusal has to happen where the mistake is actually made — the moment an agent closes a
 * patient who was advised surgery and never counseled, and reaches for "treatment cost high"
 * because that is what the patient said on the phone.
 *
 * The patient did say it. What nobody knows is whether it was true, because nobody ever told them
 * what the treatment costs after insurance and EMI. Recording it as a price objection turns a
 * process failure into a market fact, and the MD reads it as "our packages are too expensive".
 */
export function closureProblems(lead, reason) {
  const problems = [];
  if (!reason) return problems;

  const advised = lead?.treatment?.decision === "Surgery advised";
  const counseled = Boolean(lead?.treatment?.counselingAt);

  if (advised && !counseled && PRICE_REASONS.includes(reason)) {
    problems.push(
      `The doctor advised surgery and nobody has had the money talk with ${lead.patient_name}, so "${reason}" is not something anybody here knows. Log the counseling first, or close this as "${NO_COUNSELING_REASON}" — which is the truth, and which puts the lead in the recovery pool instead of in a pricing decision.`
    );
  }

  if (reason === NO_COUNSELING_REASON && counseled) {
    problems.push(
      "The money talk is logged on this lead, so the absence of it cannot be the reason. Pick the objection the counselor actually heard."
    );
  }

  return problems;
}

export const INSURANCE_STATES = ["Not checked", "Checking", "Approval pending", "Approved", "Declined", "Not using insurance"];

export const MIN_NOTE = 12;

/** What a treatment update must carry before it may be written. */
export function updateProblems(draft = {}, lead) {
  const problems = [];
  if (!draft.decision) {
    problems.push("Record what the doctor decided");
    return problems;
  }
  if (!decisionByValue(draft.decision)) problems.push("That is not one of the four outcomes");

  if (draft.decision === "Surgery advised") {
    const quoted = Number(draft.quotedPackage);
    if (!Number.isFinite(quoted) || quoted <= 0) {
      problems.push("A quoted package is required — the money conversation cannot start without a number");
    }
  }

  if (draft.counselingAt && String(draft.counselingNote || "").trim().length < MIN_NOTE) {
    problems.push(`Say what came out of the money talk, in at least ${MIN_NOTE} characters`);
  }

  if (draft.surgeryDate && !draft.counselingAt) {
    problems.push("A date agreed before anybody explained the cost is a date that gets cancelled. Log the money talk first");
  }

  if (draft.surgeryBookedAt && outstandingSteps({ ...lead, treatment: draft }).length > 0) {
    problems.push("Finish the outstanding steps before booking the surgery");
  }

  return problems;
}

/**
 * The post-consultation funnel over a set of leads. Used by the queue banner and by the manager
 * view, so both count it the same way.
 */
export function treatmentFunnel(leads) {
  const seen = leads.filter((lead) => lead.appointment?.state === "Consultation Completed");
  const decided = seen.filter((lead) => lead.treatment?.decision);
  const advised = seen.filter((lead) => lead.treatment?.decision === "Surgery advised");
  const counseled = advised.filter((lead) => lead.treatment?.counselingAt);
  const booked = advised.filter((lead) => lead.treatment?.surgeryBookedAt);
  const working = seen.filter(isStillWorking);

  return {
    seen: seen.length,
    undecided: seen.length - decided.length,
    advised: advised.length,
    counseled: counseled.length,
    coverageRate: pct(counseled.length, advised.length),
    booked: booked.length,
    bookingRate: pct(booked.length, advised.length),
    clinical: seen.filter(isClinicalOutcome).length,
    working: working.length,
    // What is sitting in the gap, in rupees. Quoted figures only — never a band, never an estimate.
    valueInPlay: advised
      .filter((lead) => !lead.treatment?.surgeryBookedAt && !lead.closure)
      .reduce((sum, lead) => sum + (Number(lead.treatment?.quotedPackage) || 0), 0),
  };
}
