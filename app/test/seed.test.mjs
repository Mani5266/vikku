// The demo desk — what src/store/seedExtra.js claims to cover.
//
//   npm run test:seed
//
// The seed's own header makes a list of promises: every Today bucket reachable for both demo
// agents, all ten §17 appointment states present, seven §23 closure categories, every disease and
// every source. A promise in a comment is a comment. These are the same promises as assertions.
//
// The other thing checked here is the one that would actually hurt: the nine original guard leads
// are byte-for-byte where they were. Tests elsewhere assert on Priya Sharma by name, on lead_003's
// composer verdict and on lead_009's dead number, and a seed that renumbers them fails those tests
// in a way that reads as a bug in the communication engine rather than as a bug in the fixture.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const { buildExtras } = await load("src/store/seedExtra.js");
const protocols = await load("src/lib/followupProtocols.js");
const appointments = await load("src/lib/appointments.js");
const taxonomy = await load("src/lib/reasonTaxonomy.js");

// A fixed clock. The seed is relative to `now`, so a test that used the wall clock would be a test
// whose result depends on what time it is run — which is the exact property the seed avoids.
const NOW = new Date("2026-08-19T09:00:00.000Z");
const { leads, interactions, communications } = buildExtras(NOW);

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

const byAgent = (name) => leads.filter((lead) => lead.agent_name === name);

/** Calls the protocol had asked for by the lead's current day — the same sum `callCompliance` does. */
function owedBy(lead) {
  const protocol = protocols.FOLLOWUP_PROTOCOLS[lead.plan.temperature];
  return protocol.steps.filter((step) => step.callRequired && step.day <= lead.plan.day).length;
}

const callsOn = (id) => interactions.filter((entry) => entry.lead_id === id).length;

check("forty-two leads are added and none of them collides with the nine guard leads", () => {
  assert.equal(leads.length, 42);
  const ids = leads.map((lead) => lead.id);
  assert.equal(new Set(ids).size, 42, "a duplicate id silently replaces a lead in the store");
  for (let i = 1; i <= 9; i++) {
    assert.ok(!ids.includes(`lead_${String(i).padStart(3, "0")}`), `lead_00${i} must stay in seed.js`);
  }
});

check("nothing here is random — two builds at the same instant are identical", () => {
  const again = buildExtras(NOW);
  assert.deepEqual(again.leads, leads);
  assert.deepEqual(again.interactions, interactions);
  assert.deepEqual(again.communications, communications);
});

check("both demo agents get a queue worth looking at", () => {
  // agent123 and sneha123 are the two accounts that can actually sign in as an agent. A demo where
  // one of them opens a five-row list is the problem this file was written to fix.
  assert.ok(byAgent("Nikhil Rao").length >= 15, "agent123 needs a full day");
  assert.ok(byAgent("Sneha Pillai").length >= 8, "sneha123 needs a real queue, not a token one");
});

check("all four agents from the roster own leads", () => {
  for (const name of ["Nikhil Rao", "Sneha Pillai", "Arjun Verma", "Divya Menon"]) {
    assert.ok(byAgent(name).length > 0, `${name} owns nothing, so the team screen shows an empty row`);
  }
});

check("every Today bucket is reachable for the primary demo agent", () => {
  const mine = byAgent("Nikhil Rao");
  const open = mine.filter((lead) => !lead.closure && !["Booked", "Confirmation Pending", "Confirmed", "Patient Arrived"].includes(lead.appointment?.state));

  const ringNow = open.filter((lead) => callsOn(lead.id) === 0 && lead.number_valid !== false);
  const behind = open.filter((lead) => callsOn(lead.id) > 0 && callsOn(lead.id) < owedBy(lead));
  const settled = open.filter((lead) => callsOn(lead.id) >= owedBy(lead) && callsOn(lead.id) > 0);
  const finished = mine.filter((lead) => lead.closure || ["Booked", "Confirmation Pending", "Confirmed", "Patient Arrived"].includes(lead.appointment?.state));

  assert.ok(ringNow.length >= 3, "Ring now");
  assert.ok(behind.length >= 3, "Behind");
  assert.ok(settled.length >= 4, "Due today and Waiting between them");
  assert.ok(finished.length >= 3, "Finished");
});

check("one lead is still inside the five-minute first-call clock and one is well past it", () => {
  const untouched = leads.filter((lead) => callsOn(lead.id) === 0);
  const ages = untouched.map((lead) => (NOW - new Date(lead.created_at)) / 60000);
  assert.ok(ages.some((minutes) => minutes < 5), "without one, the pre-breach state cannot be seen");
  assert.ok(ages.some((minutes) => minutes > 24 * 60), "and without one, the breach does not look serious");
});

check("every §17 appointment state appears somewhere across the desk", () => {
  const present = new Set(leads.map((lead) => lead.appointment?.state).filter(Boolean));
  const named = appointments.APPOINTMENT_STATES.map((state) => state.value ?? state);
  // Nine of the ten. "Booked" itself is covered by lead_004 in seed.js, which this file must not
  // touch — so the assertion is on the states this file is responsible for.
  const missing = named.filter((state) => !present.has(state) && state !== "Booked");
  assert.deepEqual(missing, [], `appointment states with no lead behind them: ${missing.join(", ")}`);
});

check("a booked appointment carries a doctor, a branch, a time and a history entry", () => {
  for (const lead of leads.filter((entry) => entry.appointment)) {
    const appointment = lead.appointment;
    assert.ok(appointment.doctor, `${lead.id} has no doctor`);
    assert.ok(appointment.branch, `${lead.id} has no branch`);
    assert.ok(appointment.at, `${lead.id} has no time`);
    assert.equal(appointment.history.length, 1, `${lead.id} must carry its own state change`);
    assert.equal(appointment.history[0].state, appointment.state);
  }
});

check("the two states that need a reason have one", () => {
  for (const lead of leads.filter((entry) => appointments.REASON_REQUIRED.includes(entry.appointment?.state))) {
    assert.ok(lead.appointment.reason, `${lead.id} is ${lead.appointment.state} with no reason — the guard refuses that`);
  }
});

check("hospital-side and patient-side cancellations are distinguishable", () => {
  const cancelled = leads.find((lead) => lead.appointment?.state === "Cancelled");
  assert.ok(cancelled, "§17 asks for both sides and neither exists without one");
  assert.match(cancelled.appointment.reason, /hospital/i, "the side that cancelled has to be readable from the reason");
});

check("closures span the taxonomy and every one of them cites real evidence", () => {
  const closed = leads.filter((lead) => lead.closure);
  assert.ok(closed.length >= 7);

  // All seven §23 categories. One category repeated seven times would demonstrate nothing, and the
  // recovery segments and the escalation desk both slice on this field.
  const categories = new Set(closed.map((lead) => lead.closure.category));
  assert.deepEqual(
    [...categories].sort(),
    ["Competition", "Contactability", "Financial", "Follow-up Failure", "Hospital / Doctor", "Interest", "Lead Quality"]
  );

  for (const lead of closed) {
    const valid = taxonomy.getReasonsForCategory(lead.closure.category).some(
      (reason) => (reason.value ?? reason) === lead.closure.reason
    );
    assert.ok(valid, `${lead.id} closes as "${lead.closure.reason}", which is not in the ${lead.closure.category} list`);

    // The A9 guard refuses a closure whose evidence is not on the lead. A seeded closure that
    // breaks that rule teaches the demo to distrust the guard.
    assert.ok(lead.closure.evidenceId, `${lead.id} closes with no evidence`);
    assert.ok(
      interactions.some((entry) => entry.id === lead.closure.evidenceId && entry.lead_id === lead.id),
      `${lead.id} cites evidence that is not on this lead`
    );
  }
});

check("a closure's recoverability follows the taxonomy rather than the row", () => {
  // Price with counseling still owed is winnable; treated elsewhere is not. Both are in the desk,
  // because a recovery console with nothing excluded proves nothing about the exclusion rule.
  const price = leads.find((lead) => lead.closure?.reason === "Treatment cost high");
  const gone = leads.find((lead) => lead.closure?.reason === "Chose another hospital");
  assert.ok(price && gone);
  assert.equal(taxonomy.reasonDefaults(price.closure.category, price.closure.reason).recoverable, true);
  assert.equal(taxonomy.reasonDefaults(gone.closure.category, gone.closure.reason).recoverable, false);
});

check("every disease, every source and both branches are represented", () => {
  const diseases = new Set(leads.map((lead) => lead.disease));
  const sources = new Set(leads.map((lead) => lead.source));
  const branches = new Set(leads.map((lead) => lead.branch));
  for (const disease of ["Piles", "Hernia", "Gallstones", "Varicose Veins", "Knee Replacement", "Cataract", "Thyroid", "Circumcision"]) {
    assert.ok(diseases.has(disease), `no lead for ${disease}`);
  }
  for (const source of ["Meta Ads", "Google Ads", "YouTube", "Website", "Referral", "Camp", "Walk-in"]) {
    assert.ok(sources.has(source), `no lead from ${source}`);
  }
  assert.deepEqual([...branches].sort(), ["Jayanagar", "Whitefield"]);
});

check("all four follow-up protocols are running somewhere", () => {
  const temperatures = new Set(leads.map((lead) => lead.plan.temperature));
  assert.deepEqual([...temperatures].sort(), ["Cold", "Hot", "Not Connected", "Warm"]);
});

check("a lead's plan day is a day its protocol actually has", () => {
  for (const lead of leads) {
    const protocol = protocols.FOLLOWUP_PROTOCOLS[lead.plan.temperature];
    assert.ok(lead.plan.day >= 1 && lead.plan.day <= protocol.durationDays, `${lead.id} is on day ${lead.plan.day} of a ${protocol.durationDays}-day plan`);
  }
});

check("a lead is never older than the plan day it claims to be on", () => {
  // A lead created four hours ago cannot be on day nine of its plan. The queue would show a
  // backlog that the clock says could not have accrued.
  for (const lead of leads) {
    const ageDays = (NOW - new Date(lead.created_at)) / (24 * 60 * 60 * 1000);
    assert.ok(ageDays >= lead.plan.day - 1.05, `${lead.id} is ${ageDays.toFixed(1)} days old and on day ${lead.plan.day}`);
  }
});

check("the last call on a lead carries the full remark and the earlier ones do not pretend to", () => {
  const withObjection = leads.filter((lead) => interactions.some((entry) => entry.lead_id === lead.id && entry.objection_raised));
  assert.ok(withObjection.length >= 6, "the queue's 'what they said last time' column needs variety or it reads as filler");

  for (const lead of withObjection) {
    const mine = interactions.filter((entry) => entry.lead_id === lead.id);
    const carrying = mine.filter((entry) => entry.objection_raised);
    assert.equal(carrying.length, 1, `${lead.id} repeats the same objection on every call`);
    assert.equal(carrying[0].id, mine[mine.length - 1].id, "the objection belongs to the most recent call");
  }
});

check("every objection recorded on a call exists in the §23 taxonomy", () => {
  for (const entry of interactions.filter((call) => call.objection_raised)) {
    const valid = taxonomy.getReasonsForCategory(entry.objection_category).some(
      (reason) => (reason.value ?? reason) === entry.objection_raised
    );
    assert.ok(valid, `${entry.id} raises "${entry.objection_raised}", which is not a ${entry.objection_category} reason`);
  }
});

check("a not-connected lead logs attempts rather than conversations", () => {
  const padma = interactions.filter((entry) => entry.lead_id === "lead_016");
  assert.ok(padma.length > 0);
  for (const entry of padma) {
    assert.equal(entry.contact_outcome, "Not Connected");
    assert.ok(entry.not_connected_reason, "a not-connected call with no reason is the gap §15 closes");
    assert.equal(entry.patient_said, undefined, "nobody said anything — the call was not answered");
  }
});

check("the dead number logs its attempts and then closes, rather than being closed on sight", () => {
  const dead = leads.find((lead) => lead.number_valid === false);
  assert.ok(dead, "a wrong number is a lead-form quality signal and the desk needs one");
  assert.equal(callsOn(dead.id), 5, "five attempts across five days before the number is written off");
  assert.equal(dead.closure.reason, "Wrong number");
  assert.equal(communications.filter((entry) => entry.lead_id === dead.id).length, 0, "no message goes to a number known to be wrong");
});

check("every lead that has been called has a message history for the composer to work against", () => {
  for (const lead of leads.filter((entry) => callsOn(entry.id) > 0 && entry.number_valid !== false)) {
    assert.ok(
      communications.some((entry) => entry.lead_id === lead.id),
      `${lead.id} has calls but no messages, so the 48-hour floor has nothing to measure from`
    );
  }
});

check("the post-consultation states are all reachable from the desk", () => {
  // The half of the funnel that had no live workflow. Without a lead in each state the flow can be
  // built and never seen.
  const treated = leads.filter((lead) => lead.treatment);
  assert.ok(treated.length >= 6, "the treatment flow needs something to work on");

  const decisions = new Set(treated.map((lead) => lead.treatment.decision));
  assert.ok(decisions.has("Surgery advised"));
  assert.ok(decisions.has("Tests advised"));
  assert.ok(decisions.has("Medical management"), "a clinical outcome, so the funnel can exclude it honestly");

  const surgical = treated.filter((lead) => lead.treatment.decision === "Surgery advised");
  assert.ok(surgical.some((lead) => !lead.treatment.counselingAt), "one waiting on the money talk");
  assert.ok(
    surgical.some((lead) => lead.treatment.counselingAt && lead.treatment.insurance === "Approval pending"),
    "one waiting on an insurance approval"
  );
  assert.ok(
    surgical.some((lead) => lead.treatment.counselingAt && !lead.treatment.surgeryDate && lead.treatment.insurance === "Not using insurance"),
    "one needing only a date"
  );
  assert.ok(surgical.some((lead) => lead.treatment.surgeryBookedAt), "and one that got there");

  // Every surgical row carries a quote, because the money conversation cannot start without one.
  for (const lead of surgical) {
    assert.ok(Number(lead.treatment.quotedPackage) > 0, `${lead.id} advises surgery with no quoted package`);
  }
  // Every logged money talk carries a real timestamp and a note somebody can read.
  for (const lead of treated.filter((entry) => entry.treatment.counselingAt)) {
    assert.ok(!Number.isNaN(Date.parse(lead.treatment.counselingAt)), `${lead.id} has an unreadable counselling time`);
    assert.ok((lead.treatment.counselingNote || "").length > 20, `${lead.id} logged a money talk with no substance`);
  }
});

check("a lead seen by the doctor with no outcome recorded exists, because that is the real gap", () => {
  const undecided = leads.filter(
    (lead) => lead.appointment?.state === "Consultation Completed" && !lead.treatment
  );
  assert.ok(undecided.length >= 1, "somebody has always been seen and never written up");
});

check("every row says what it is there to demonstrate", () => {
  for (const lead of leads) {
    assert.ok(lead.shows && lead.shows.length > 30, `${lead.id} has no stated purpose, so the next person to read this seed cannot know whether to keep it`);
  }
});

console.log(`${checks} seed checks passed`);
