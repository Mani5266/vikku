// The half of the funnel that runs after the patient has seen the doctor.
//
//   npm run test:treatment
//
// The defect this covers was business logic rather than a bug: `Consultation Completed` was a
// terminal state, seeing a doctor counted as a conversion, and the queue filed the lead under
// Finished. A hospital is paid for the operation, so that marked the middle of the funnel as the
// end of it and stopped anybody calling the most valuable leads in the system.
//
// What is asserted here is the rule set that makes those leads visible again, and the guard that
// stops the gap being papered over with a price objection nobody has evidence for.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const t = await load("src/lib/treatment.js");
const journey = await load("src/lib/journey.js");
const taxonomy = await load("src/lib/reasonTaxonomy.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

/** A lead who has been seen by the doctor, with whatever treatment record the test needs. */
const seen = (treatment) => ({
  id: "lead_x",
  patient_name: "Test Patient",
  plan: { temperature: "Hot", day: 5 },
  appointment: { state: "Consultation Completed" },
  ...(treatment ? { treatment } : {}),
});

const advised = (extra = {}) => seen({ decision: "Surgery advised", quotedPackage: 200000, ...extra });

// ---- the states ------------------------------------------------------------------------------

check("a lead who has not been seen has no treatment state at all", () => {
  assert.equal(t.treatmentState({ id: "a" }), t.TREATMENT_STATES.NONE);
  assert.equal(t.treatmentState({ appointment: { state: "Confirmed" } }), t.TREATMENT_STATES.NONE);
  assert.equal(t.nextTreatmentStep({ appointment: { state: "Confirmed" } }), null);
});

check("seen by the doctor with no outcome recorded is its own state, not silence", () => {
  const lead = seen(null);
  assert.equal(t.treatmentState(lead), t.TREATMENT_STATES.AWAITING_DECISION);
  assert.equal(t.isStillWorking(lead), true);
  assert.match(t.nextTreatmentStep(lead).label, /what the doctor decided/i);
});

check("surgery advised walks counseling, then insurance, then the date — in that order", () => {
  assert.equal(t.treatmentState(advised()), t.TREATMENT_STATES.COUNSELING_DUE);
  assert.equal(t.treatmentState(advised({ counselingAt: "2026-08-18T00:00:00Z" })), t.TREATMENT_STATES.INSURANCE_DUE);
  assert.equal(
    t.treatmentState(advised({ counselingAt: "2026-08-18T00:00:00Z", insurance: "Approved" })),
    t.TREATMENT_STATES.DATE_DUE
  );
  assert.equal(
    t.treatmentState(advised({ counselingAt: "2026-08-18T00:00:00Z", insurance: "Approved", surgeryDate: "2026-09-01" })),
    t.TREATMENT_STATES.DATE_DUE,
    "a date agreed is not a surgery booked until somebody books it"
  );
});

check("a patient paying for themselves is not stuck behind an insurance step", () => {
  const self = advised({ counselingAt: "x", insurance: "Not using insurance" });
  assert.equal(t.treatmentState(self), t.TREATMENT_STATES.DATE_DUE);
  const pending = advised({ counselingAt: "x", insurance: "Approval pending" });
  assert.equal(t.treatmentState(pending), t.TREATMENT_STATES.INSURANCE_DUE, "an approval nobody is chasing is the step");
});

check("every open state keeps the lead on somebody's list", () => {
  const open = [
    seen(null),
    seen({ decision: "Tests advised" }),
    advised(),
    advised({ counselingAt: "x" }),
    advised({ counselingAt: "x", insurance: "Approved" }),
  ];
  for (const lead of open) {
    assert.equal(t.isStillWorking(lead), true, `${t.treatmentState(lead)} must stay on the queue`);
    assert.ok(t.nextTreatmentStep(lead).action, `${t.treatmentState(lead)} must offer something to do`);
  }
});

check("booked and clinical outcomes are finished, and offer nothing to do", () => {
  const booked = advised({ counselingAt: "x", insurance: "Approved", surgeryDate: "2026-09-01", surgeryBookedAt: "y" });
  const medical = seen({ decision: "Medical management" });
  for (const lead of [booked, medical]) {
    assert.equal(t.isStillWorking(lead), false);
    assert.equal(t.nextTreatmentStep(lead).action, null);
  }
  assert.equal(t.isBooked(booked), true);
  assert.equal(t.isBooked(medical), false);
});

// ---- the distinction that keeps the funnel honest ---------------------------------------------

check("a doctor deciding against surgery is a clinical outcome, never a lost lead", () => {
  assert.equal(t.isClinicalOutcome(seen({ decision: "Medical management" })), true);
  assert.equal(t.isClinicalOutcome(seen({ decision: "No treatment needed" })), true);
  assert.equal(t.isClinicalOutcome(advised()), false);
  assert.equal(t.isClinicalOutcome(seen({ decision: "Tests advised" })), false);
  // Filing a treated patient beside "chose another hospital" tells the MD his conversion rate is
  // falling when what changed was the case mix.
  assert.equal(t.CONSULTATION_DECISIONS.filter((d) => d.clinical).length, 2);
});

// ---- the §33 guard, on a live lead -------------------------------------------------------------

check("a price closure is refused on a patient nobody had the money talk with", () => {
  const lead = { ...advised(), patient_name: "Shankar Naik" };
  for (const reason of t.PRICE_REASONS) {
    const problems = t.closureProblems(lead, reason);
    assert.equal(problems.length, 1, `${reason} must be refused`);
    assert.match(problems[0], /nobody has had the money talk/);
    assert.match(problems[0], new RegExp(t.NO_COUNSELING_REASON));
  }
});

check("the honest closure is always available, and the guard fires the other way too", () => {
  const uncounseled = advised();
  const counseled = advised({ counselingAt: "x" });
  assert.deepEqual(t.closureProblems(uncounseled, t.NO_COUNSELING_REASON), []);
  assert.deepEqual(t.closureProblems(counseled, "Treatment cost high"), []);
  assert.match(t.closureProblems(counseled, t.NO_COUNSELING_REASON)[0], /cannot be the reason/);
});

check("the guard is about price and does not block every other reason", () => {
  assert.deepEqual(t.closureProblems(advised(), "Surgery fear"), []);
  assert.deepEqual(t.closureProblems(advised(), "Hospital too far"), []);
  // And it does not apply to somebody the doctor never advised surgery for.
  assert.deepEqual(t.closureProblems(seen({ decision: "Medical management" }), "Treatment cost high"), []);
});

check("every price reason the guard names exists in the §23 taxonomy", () => {
  const known = taxonomy.NON_CONVERSION_CATEGORIES.flatMap((category) =>
    taxonomy.getReasonsForCategory(category.value).map((reason) => reason.value ?? reason)
  );
  for (const reason of [...t.PRICE_REASONS, t.NO_COUNSELING_REASON]) {
    assert.ok(known.includes(reason), `${reason} is not a §23 reason`);
  }
});

// ---- what a write must carry -------------------------------------------------------------------

check("surgery advised without a quote is refused — the money talk needs a number", () => {
  assert.match(t.updateProblems({ decision: "Surgery advised" }).join(" "), /quoted package is required/);
  assert.deepEqual(t.updateProblems({ decision: "Surgery advised", quotedPackage: 200000 }), []);
  assert.match(t.updateProblems({}).join(" "), /Record what the doctor decided/);
});

check("a date agreed before anybody explained the cost is refused", () => {
  const problems = t.updateProblems({ decision: "Surgery advised", quotedPackage: 200000, surgeryDate: "2026-09-01" });
  assert.match(problems.join(" "), /date that gets cancelled/);
});

check("logging the money talk needs a note somebody can read", () => {
  const short = t.updateProblems({ decision: "Surgery advised", quotedPackage: 1, counselingAt: "x", counselingNote: "ok" });
  assert.match(short.join(" "), /at least 12 characters/);
});

check("a surgery cannot be booked with steps still open", () => {
  const early = t.updateProblems({ decision: "Surgery advised", quotedPackage: 1, surgeryBookedAt: "now" }, {});
  assert.match(early.join(" "), /Finish the outstanding steps/);
  const ready = t.updateProblems(
    { decision: "Surgery advised", quotedPackage: 1, counselingAt: "x", counselingNote: "Package explained in full", insurance: "Approved", surgeryDate: "2026-09-01", surgeryBookedAt: "now" },
    {}
  );
  assert.deepEqual(ready, []);
});

// ---- the flow the rest of the app reads --------------------------------------------------------

check("seeing a doctor is no longer a conversion", () => {
  // This is the defect in one assertion. Before, both of these were converted and finished.
  assert.equal(journey.isConverted(seen(null)), false, "seen, outcome unknown — the work has barely started");
  assert.equal(journey.isConverted(advised()), false, "advised surgery and never counseled is not a win");
  assert.equal(
    journey.isConverted(advised({ counselingAt: "x", insurance: "Approved", surgeryDate: "d", surgeryBookedAt: "y" })),
    true
  );
  assert.equal(journey.isConverted(seen({ decision: "Medical management" })), true, "finished, clinically");
});

check("the stage bar's fourth stage is the operation, and it is live after the consultation", () => {
  const stages = journey.leadStages(advised());
  assert.equal(stages.length, 4, "four stages — the last one changed meaning, it did not multiply");
  const treatment = stages[3];
  assert.equal(treatment.key, "treatment");
  assert.equal(treatment.state, "now");
  assert.match(treatment.detail, /money talk owed/);
  assert.match(treatment.to, /\/treatment$/);
  // The appointment stage is done once they have been seen, rather than waiting on a conversion.
  assert.equal(stages[2].state, "done");
});

check("the next step after a consultation routes to the treatment screen, not to nothing", () => {
  const step = journey.nextStep(advised());
  assert.match(step.label, /money talk/i);
  assert.match(step.to, /\/treatment$/);
  // The old behaviour, asserted so it cannot come back.
  assert.notEqual(step.label, "Nothing — they saw the doctor");
});

check("a booked surgery has no next step, and a closed lead still reads as closed", () => {
  const booked = advised({ counselingAt: "x", insurance: "Approved", surgeryDate: "d", surgeryBookedAt: "y" });
  assert.equal(journey.nextStep(booked).to, null);
  const closedLead = { ...advised(), closure: { category: "Financial", reason: "Treatment cost high" } };
  assert.equal(t.treatmentState(closedLead), t.TREATMENT_STATES.CLOSED);
  assert.match(journey.nextStep(closedLead).label, /closed/i);
});

// ---- the number this exists to move ------------------------------------------------------------

check("the funnel counts what is sitting in the gap, from quotes rather than estimates", () => {
  const leads = [
    advised({ quotedPackage: 100000 }),
    advised({ quotedPackage: 50000, counselingAt: "x" }),
    { ...advised({ quotedPackage: 999999, counselingAt: "x", insurance: "Approved", surgeryDate: "d", surgeryBookedAt: "y" }) },
    seen({ decision: "Medical management" }),
    seen(null),
    { id: "not-seen", appointment: { state: "Confirmed" } },
  ];
  const funnel = t.treatmentFunnel(leads);
  assert.equal(funnel.seen, 5, "the unseen lead is not in this funnel");
  assert.equal(funnel.undecided, 1);
  assert.equal(funnel.advised, 3);
  assert.equal(funnel.counseled, 2);
  assert.equal(funnel.booked, 1);
  assert.equal(funnel.clinical, 1);
  assert.equal(funnel.working, 3, "two advised and still open, plus the one with no decision recorded");
  assert.equal(funnel.valueInPlay, 150000, "the booked one is no longer in play and nothing is estimated");
});

console.log(`${checks} treatment checks passed`);
