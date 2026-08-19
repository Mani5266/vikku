// A4, A5, A8, A9 — the four agent screens that close the specification's gaps.
//
//   npm run test:screens
//
// Each of these screens exists to stop a specific thing being faked, and each of those stops is a
// rule that can be checked without a browser. That is what this file checks: the tie-break that
// refuses to grade a split decision Hot, the state machine that refuses an unreachable appointment
// transition, the closure that refuses an uncitable reason, and the plan grid that refuses to let a
// missed day disappear.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const qualification = await load("src/lib/qualification.js");
const appointments = await load("src/lib/appointments.js");
const closure = await load("src/lib/closure.js");
const grid = await load("src/lib/planGrid.js");
const taxonomy = await load("src/lib/reasonTaxonomy.js");
const protocols = await load("src/lib/followupProtocols.js");
const journey = await load("src/lib/journey.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

// ---- A4 qualification -------------------------------------------------------------------------

const answerAll = (band) =>
  Object.fromEntries(
    qualification.QUALIFICATION_FACTORS.map((factor) => [
      factor.key,
      factor.options.find((option) => option.band === band).value,
    ])
  );

check("the spec's eleven factors are all present, each with a Hot, Warm and Cold answer", () => {
  assert.equal(qualification.QUALIFICATION_FACTORS.length, 11);
  for (const factor of qualification.QUALIFICATION_FACTORS) {
    const bands = factor.options.map((option) => option.band).sort();
    assert.deepEqual(bands, ["Cold", "Hot", "Warm"], `${factor.key} does not offer all three bands`);
  }
});

check("all-Hot answers suggest Hot, all-Cold suggest Cold", () => {
  assert.equal(qualification.scoreLead(answerAll("Hot")).suggested, "Hot");
  assert.equal(qualification.scoreLead(answerAll("Cold")).suggested, "Cold");
});

check("no suggestion until every question is answered", () => {
  const partial = { ...answerAll("Hot") };
  delete partial.symptom_severity;
  const score = qualification.scoreLead(partial);
  assert.equal(score.complete, false);
  assert.equal(score.suggested, null, "a suggestion from ten answers invites grading on a hunch");
});

check("a tie breaks cooler, never hotter", () => {
  // Six Hot indicators against five Warm is Hot. Five against five is not.
  const factors = qualification.QUALIFICATION_FACTORS;
  const tied = {};
  factors.forEach((factor, index) => {
    const band = index < 5 ? "Hot" : index < 10 ? "Warm" : "Cold";
    tied[factor.key] = factor.options.find((option) => option.band === band).value;
  });
  const score = qualification.scoreLead(tied);
  assert.equal(score.matched.Hot.length, 5);
  assert.equal(score.matched.Warm.length, 5);
  assert.equal(score.suggested, "Warm", "a five-five split graded Hot is the over-grading M6 catches");
});

check("an override needs a written justification, matching the suggestion does not", () => {
  assert.equal(qualification.overrideProblem({ suggested: "Warm", chosen: "Warm" }), null);
  assert.ok(qualification.overrideProblem({ suggested: "Warm", chosen: "Hot", justification: "felt hot" }));
  assert.equal(
    qualification.overrideProblem({
      suggested: "Warm",
      chosen: "Hot",
      justification: "Son is flying in on Friday and wants it done that week.",
    }),
    null
  );
});

check("every band a qualification can produce is a protocol the scheduler runs", () => {
  for (const band of ["Hot", "Warm", "Cold"]) {
    assert.ok(protocols.FOLLOWUP_PROTOCOLS[band], `no protocol for ${band}`);
  }
});

// ---- A8 appointments --------------------------------------------------------------------------

check("the ten §17 states are all here", () => {
  assert.equal(appointments.APPOINTMENT_STATES.length, 10);
  for (const state of ["Suggested", "Booked", "Confirmed", "No-show", "Consultation Completed"]) {
    assert.ok(appointments.APPOINTMENT_STATES.some((s) => s.value === state), state);
  }
});

check("an appointment cannot skip rungs", () => {
  assert.deepEqual(appointments.nextStates(null), ["Suggested"]);
  assert.ok(!appointments.nextStates("Suggested").includes("Consultation Completed"));
  assert.ok(!appointments.nextStates("Booked").includes("Patient Arrived"), "arrival before confirmation");
  assert.ok(appointments.nextStates("Confirmed").includes("Patient Arrived"));
  assert.deepEqual(appointments.nextStates("Consultation Completed"), [], "a finished visit goes nowhere");
});

check("every reachable state is itself a declared state", () => {
  const known = new Set(appointments.APPOINTMENT_STATES.map((s) => s.value));
  for (const state of [null, ...known]) {
    for (const next of appointments.nextStates(state)) {
      assert.ok(known.has(next), `${state} leads to unknown state ${next}`);
    }
  }
});

check("cancel and no-show cannot be saved without a reason", () => {
  for (const state of appointments.REASON_REQUIRED) {
    const problems = appointments.bookingProblems({ state });
    assert.ok(problems.some((p) => p.includes("reason")), `${state} saved without a reason`);
    assert.equal(
      appointments.bookingProblems({ state, reason: appointments.CANCEL_REASONS[0] }).length,
      0,
      `${state} with a reason should save`
    );
  }
});

check("a booking needs a doctor, a branch, a type and a slot that is not in the past", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(
    appointments.bookingProblems({
      state: "Booked",
      doctor: "Dr. Ananya Rao",
      branch: "Jayanagar",
      consultationType: "In-person",
      at: future,
    }).length,
    0
  );
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.ok(
    appointments
      .bookingProblems({
        state: "Booked",
        doctor: "Dr. Ananya Rao",
        branch: "Jayanagar",
        consultationType: "In-person",
        at: past,
      })
      .some((p) => p.includes("past"))
  );
});

check("a no-show raises a recovery task rather than ending the lead", () => {
  const task = appointments.recoveryTaskFor({ state: "No-show", reason: "Work came up" });
  assert.ok(task);
  assert.equal(task.kind, "no_show_recovery");
  assert.ok(new Date(task.dueAt).getTime() > Date.now());
  assert.equal(appointments.recoveryTaskFor({ state: "Confirmed" }), null);
});

check("the reminder plan runs before the appointment, never after", () => {
  const at = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const plan = appointments.reminderPlan(at);
  assert.equal(plan.length, 4);
  for (const reminder of plan) {
    assert.ok(new Date(reminder.when) < new Date(at), `${reminder.label} fires after the visit`);
  }
});

// ---- A9 closure -------------------------------------------------------------------------------

const validClosure = {
  category: "Financial",
  reason: "EMI required",
  detail: "Wants the surgery but the EMI has to be arranged through his son first.",
  evidenceId: "call_001",
  recoverable: true,
  action: "EMI option",
  owner: "Financial counsellor",
  reviewDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
};

check("a complete closure passes", () => {
  assert.deepEqual(closure.closureProblems(validClosure, { evidenceIds: ["call_001"] }), []);
});

check("a closure cannot be saved without evidence", () => {
  const problems = closure.closureProblems({ ...validClosure, evidenceId: null }, { evidenceIds: ["call_001"] });
  assert.ok(problems.some((p) => p.toLowerCase().includes("evidence")));
});

check("evidence that is not on the lead is refused", () => {
  // This is the whole point of the field: an agent cannot cite a record that does not exist.
  const problems = closure.closureProblems({ ...validClosure, evidenceId: "call_typed_by_hand" }, {
    evidenceIds: ["call_001"],
  });
  assert.ok(problems.some((p) => p.includes("no longer exists")));
});

check('"Lead expired" is refused as a reason', () => {
  const problems = closure.closureProblems({ ...validClosure, detail: "Lead Expired" }, {
    evidenceIds: ["call_001"],
  });
  assert.ok(problems.some((p) => p.includes("status, not a reason")));
});

check("a recoverable closure needs an action, an owner and a future review date", () => {
  for (const field of ["action", "owner", "reviewDate"]) {
    const problems = closure.closureProblems({ ...validClosure, [field]: "" }, { evidenceIds: ["call_001"] });
    assert.ok(problems.length > 0, `${field} was not required`);
  }
  const stale = { ...validClosure, reviewDate: "2020-01-01" };
  assert.ok(
    closure.closureProblems(stale, { evidenceIds: ["call_001"] }).some((p) => p.includes("past"))
  );
});

check("a non-recoverable closure needs neither owner nor review date", () => {
  const lost = {
    ...validClosure,
    recoverable: false,
    action: "",
    owner: null,
    reviewDate: "",
  };
  assert.deepEqual(closure.closureProblems(lost, { evidenceIds: ["call_001"] }), []);
});

check("a competition loss must name the hospital", () => {
  const competitive = {
    ...validClosure,
    category: "Competition",
    reason: taxonomy.getReasonsForCategory("Competition")[0],
    competitor: "",
  };
  assert.ok(
    closure.closureProblems(competitive, { evidenceIds: ["call_001"] }).some((p) => p.includes("hospital"))
  );
});

check("saying not recoverable overrides the taxonomy and excludes the 90-day pool", () => {
  const recoverable = closure.segmentFor("Financial", "EMI required", true);
  assert.equal(recoverable.segment, "Recoverable");
  const lost = closure.segmentFor("Financial", "EMI required", false);
  assert.equal(lost.segment, "Genuine Lost");
  assert.equal(lost.reactivation, "Not eligible");
});

check("the evidence picker is built only from records that exist", () => {
  const empty = closure.evidenceOptions({ interactions: [], communications: [] });
  assert.deepEqual(empty, [], "a lead with no activity must offer nothing to cite");

  const options = closure.evidenceOptions({
    interactions: [{ id: "call_1", interaction_date: "2026-08-10T09:00:00.000Z", patient_said: "Wants EMI." }],
    communications: [{ id: "msg_1", channel: "WhatsApp", sent_at: "2026-08-12T09:00:00.000Z" }],
    appointment: { state: "No-show", updated_at: "2026-08-14T09:00:00.000Z", reason: "Work came up" },
  });
  assert.equal(options.length, 3);
  assert.equal(options[0].kind, "Appointment", "newest first");
  assert.equal(options[2].kind, "Call");
});

// ---- A5 plan grid -----------------------------------------------------------------------------

const DAY = 86_400_000;
const activated = new Date("2026-08-10T09:00:00.000Z");

check("a missed day stays missed for the rest of the plan", () => {
  // Day 1 called, day 3 not, and we are on day 5. Day 3 must still read missed.
  const view = grid.planGrid({
    plan: { temperature: "Hot", activated_at: activated.toISOString() },
    interactions: [{ interaction_date: new Date(activated.getTime() + 2 * 3600_000).toISOString() }],
    now: new Date(activated.getTime() + 4 * DAY),
  });
  assert.equal(view.today, 5);
  assert.equal(view.rows.find((row) => row.day === 1).callState, "done");
  assert.equal(view.rows.find((row) => row.day === 3).callState, "missed");
  assert.ok(view.missed >= 1, "a missed call that stops being counted is a missed call nobody fixes");
});

check("completion is measured against the calls due so far, not the whole plan", () => {
  const view = grid.planGrid({
    plan: { temperature: "Hot", activated_at: activated.toISOString() },
    interactions: [{ interaction_date: new Date(activated.getTime() + 3600_000).toISOString() }],
    now: new Date(activated.getTime() + 1000),
  });
  assert.equal(view.today, 1);
  assert.equal(view.completion, 100, "day 1 done on day 1 is 100%, not 1 of 7");
});

check("a suppression holds the messages and says which condition did it", () => {
  const view = grid.planGrid({
    plan: { temperature: "Hot", activated_at: activated.toISOString(), appointment_booked: true },
    now: new Date(activated.getTime() + 2 * DAY),
  });
  assert.equal(view.suppression.active, true);
  assert.match(view.suppression.reason, /Appointment/i);
  const dayOne = view.rows.find((row) => row.day === 1);
  assert.equal(dayOne.messageState, "suppressed");
});

check("no plan means no grid, rather than an empty one", () => {
  assert.equal(grid.planGrid({ plan: null }), null);
  assert.equal(grid.planGrid({ plan: { temperature: "Hot" } }), null, "a plan with no activation is not running");
});

check("the ten §13 Day-15 outcomes are all here, and each says where it goes", () => {
  assert.equal(grid.DAY_15_OUTCOMES.length, 10);
  for (const outcome of grid.DAY_15_OUTCOMES) {
    assert.ok(["appointment", "qualify", "extend", "stay", "close"].includes(outcome.next), outcome.value);
    if (outcome.closes) assert.equal(outcome.next, "close", `${outcome.value} closes but does not route to closure`);
  }
  assert.ok(grid.DAY_15_OUTCOMES.some((outcome) => outcome.closes), "at least one outcome must end the lead");
});

// ---- the flow ---------------------------------------------------------------------------------
//
// The app was a pile of screens with specification codes on them, and nothing said where a lead was
// or what came next. These checks hold the four stages honest.

check("a brand-new lead starts at Qualify and nothing downstream is open", () => {
  const fresh = { id: "lead_x" };
  const stages = journey.leadStages(fresh);
  // Stage four was "outcome" — "they came, or it closes with a reason" — and it completed the
  // moment the consultation finished. A hospital is paid for the operation, so it is the
  // operation. Still four stages; the last one changed meaning rather than multiplying.
  assert.deepEqual(stages.map((s) => s.key), ["qualify", "plan", "appointment", "treatment"]);
  assert.equal(stages[0].state, "now");
  assert.equal(stages[1].state, "locked", "a plan before a grade is a schedule nobody chose");
  assert.equal(stages[2].state, "locked");
});

check("a locked stage says what has to happen first", () => {
  const stages = journey.leadStages({ id: "lead_x" });
  assert.match(stages[1].detail, /Qualify first/);
});

check("qualifying unlocks the plan", () => {
  const stages = journey.leadStages({ id: "lead_x", plan: { temperature: "Hot" } });
  assert.equal(stages[0].state, "done");
  assert.equal(stages[1].state, "now");
});

check("a booked appointment moves the lead on from the plan", () => {
  const stages = journey.leadStages({
    id: "lead_x",
    plan: { temperature: "Hot" },
    appointment: { state: "Confirmed" },
  });
  assert.equal(stages[1].state, "later");
  assert.equal(stages[2].state, "now");
});

check("a closed lead shows every stage settled", () => {
  const stages = journey.leadStages({
    id: "lead_x",
    plan: { temperature: "Warm" },
    closure: { reason: "Chose another hospital", category: "Competition" },
  });
  assert.equal(stages[3].state, "done");
  assert.match(stages[3].detail, /Chose another hospital/);
});

check("there is always exactly one instruction, and it fits the stage", () => {
  assert.match(journey.nextStep({ id: "l" }).label, /Qualify/);
  assert.match(journey.nextStep({ id: "l", plan: { temperature: "Hot" } }).label, /Call/);
  assert.match(
    journey.nextStep({ id: "l", plan: { temperature: "Hot" }, appointment: { state: "Suggested" } }).label,
    /booked/
  );
  assert.match(
    journey.nextStep({ id: "l", plan: { temperature: "Hot" }, appointment: { state: "No-show" } }).label,
    /missed appointment/
  );
});

check("a closed or converted lead is told to do nothing, with the reason", () => {
  const closed = journey.nextStep({ id: "l", closure: { category: "Financial", reason: "EMI required" } });
  assert.equal(closed.to, null, "a closed lead must not carry an action button");
  assert.match(closed.why, /EMI required/);

  // This assertion used to read `nextStep({appointment: "Consultation Completed"}).to === null`,
  // which is the defect written down as a rule: a patient who had been to the hospital and met a
  // surgeon was told there was nothing to do. Seeing a doctor is the middle of the funnel. Now
  // only a booked surgery or a doctor deciding against one finishes a lead.
  const seenOnly = journey.nextStep({ id: "l", appointment: { state: "Consultation Completed" } });
  assert.match(seenOnly.to, /\/treatment$/, "the outcome still has to be recorded");

  const booked = journey.nextStep({
    id: "l",
    appointment: { state: "Consultation Completed" },
    treatment: {
      decision: "Surgery advised",
      quotedPackage: 200000,
      counselingAt: "x",
      insurance: "Approved",
      surgeryDate: "2026-09-01",
      surgeryBookedAt: "y",
    },
  });
  assert.equal(booked.to, null, "a booked surgery is genuinely finished");

  const clinical = journey.nextStep({
    id: "l",
    appointment: { state: "Consultation Completed" },
    treatment: { decision: "Medical management" },
  });
  assert.equal(clinical.to, null, "treated without surgery is finished too, and is not a loss");
});

check("the message step is offered only when the guard allows it, and says why when it does not", () => {
  const lead = { id: "l", plan: { temperature: "Hot" } };
  const allowed = journey.nextStep(lead, { messageAllowed: true });
  assert.ok(allowed.alternative, "a permitted message should be offered beside the call");

  const blocked = journey.nextStep(lead, { messageAllowed: false, messageReason: "only 12h since the last one" });
  assert.equal(blocked.alternative, undefined, "a blocked message must not be offered");
  assert.match(blocked.why, /12h since the last one/, "the refusal has to say why");
});

check("a dead number is never an instruction to ring again", () => {
  const step = journey.nextStep({ id: "l", number_valid: false, plan: { temperature: "Hot" } });
  assert.match(step.label, /number is wrong/i);
  assert.match(step.action, /wrong number/i);
  assert.ok(!/call them/i.test(step.label), "ringing a dead number wastes the only thing an agent is short of");
});

console.log(`${checks} agent-screen checks passed`);
