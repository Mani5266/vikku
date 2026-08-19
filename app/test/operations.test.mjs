// The eight manager, operations and administration screens.
//
//   npm run test:ops
//
// M2, M4, M5, M7, M8, O1, O2 and S1 were the block of screens the specification described and
// nobody had built. Each of them exists to stop one specific thing being faked, and each of those
// stops is a rule that can be checked without a browser:
//
//   M2  a part-day is never reported as a collapse
//   M4  a delivery failure is never counted as an agent's miss
//   M5  an assignment into a full queue is refused, and a reassignment carries its reason
//   M7  a person who still owns open leads cannot be deactivated
//   M8  "closed without ever reaching the person who could have fixed it" is counted
//   O1  a no-show that was never reminded is attributed to the hospital, not the patient
//   O2  a price closure on an uncounseled patient is refused — in both directions
//   S1  the attribution fields §3.1 makes mandatory are audited rather than assumed
//
// Fixtures are hand-built rather than drawn from the 1,500-journey seed. A test that asserts on
// generated data passes for whatever the generator happens to produce; a test that asserts on
// eight rows written by hand fails when the rule changes, which is the only kind worth running.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const monitor = await load("src/lib/dailyMonitor.js");
const compliance = await load("src/lib/compliance.js");
const assignment = await load("src/lib/assignment.js");
const team = await load("src/lib/team.js");
const escalations = await load("src/lib/escalations.js");
const board = await load("src/lib/appointmentBoard.js");
const counseling = await load("src/lib/counseling.js");
const sources = await load("src/lib/sourceRegistry.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

/** A journey with every field the screens read, overridable per test. */
const lead = (over = {}) => ({
  id: "jrn_x",
  patient_name: "Test Patient",
  phone_number: "+91 9000000000",
  disease: "Piles",
  source: "Meta Ads",
  campaign: "Piles — Jayanagar — Aug",
  branch: "Jayanagar",
  agent_name: "Nikhil Rao",
  doctor_name: "Dr. Anand Kulkarni",
  created_at: "2026-08-10T06:00:00.000Z",
  age_days: 8,
  first_touch_minutes: 4,
  connected: true,
  temperature: "Warm",
  status: "Pending",
  followups_required: 5,
  followups_done: 5,
  followup_compliant: true,
  messages_sent: 4,
  messages_delivered: 4,
  confirmations_count: 0,
  appointment_suggested: false,
  appointment_booked: false,
  appointment_confirmed: false,
  rescheduled: false,
  no_show: false,
  no_show_recovered: false,
  visited: false,
  consultation_completed: false,
  surgery_advised: false,
  tests_advised: false,
  medical_management: false,
  doctor_interaction: false,
  doctor_profile_sent: false,
  financial_counseling_completed: false,
  insurance_available: false,
  insurance_approved: false,
  discount_requested: false,
  quoted_package: null,
  surgery_booked: false,
  admitted: false,
  surgery_completed: false,
  revenue: 0,
  expired: false,
  recoverable: false,
  loss_category: null,
  loss_reason: null,
  days_since_closure: null,
  ...over,
});

// ---- M2. Daily Conversion Monitor -------------------------------------------------------------

// Fourteen normal days of ten leads each, then a part-day carrying one. That last day is the
// export being taken mid-morning, and it is the shape the real dataset has.
const dayOf = (n) => `2026-08-${String(n).padStart(2, "0")}`;
const steadyDays = [];
for (let d = 1; d <= 14; d++) {
  for (let i = 0; i < 10; i++) {
    steadyDays.push(lead({ id: `d${d}_${i}`, created_at: `${dayOf(d)}T06:00:00.000Z`, connected: i < 8 }));
  }
}
const withPartial = [...steadyDays, lead({ id: "partial", created_at: `${dayOf(15)}T04:00:00.000Z` })];

check("the monitor steps over a part-day and names the day it stepped over", () => {
  const chosen = monitor.reportingDay(withPartial);
  assert.equal(chosen.day, dayOf(14), "reporting on the part-day prints a collapse that did not happen");
  assert.equal(chosen.partialDay, dayOf(15));
  assert.equal(chosen.partialCount, 1);
  assert.equal(chosen.typicalCount, 10);
});

check("a full last day is reported on directly, with nothing skipped", () => {
  const chosen = monitor.reportingDay(steadyDays);
  assert.equal(chosen.day, dayOf(14));
  assert.equal(chosen.partialDay, null, "a complete day must never be silently discarded");
});

check("every metric carries both trailing averages, never a bare number", () => {
  const card = monitor.dailyScorecard(withPartial);
  assert.equal(card.length, 11, "§31 names eleven metrics");
  for (const line of card) {
    assert.ok(line.basis, `${line.value} must say how it is measured`);
    assert.ok("week" in line && "month" in line, `${line.value} must carry both windows`);
  }
  const leadsIn = card.find((line) => line.key === "leads");
  assert.equal(leadsIn.today, 10);
  assert.equal(leadsIn.week, 10);
  assert.equal(leadsIn.verdict, "normal", "a steady day is not news");
});

check("a metric where down is good is judged on direction, not on sign", () => {
  const fast = steadyDays.map((row) =>
    row.created_at.startsWith(dayOf(14)) ? { ...row, first_touch_minutes: 1 } : { ...row, first_touch_minutes: 40 }
  );
  const line = monitor.dailyScorecard(fast).find((entry) => entry.key === "firstResponse");
  assert.ok(line.change < 0, "response time fell");
  assert.equal(line.verdict, "ahead", "a falling response time is good news and must not be flagged red");
});

check("a metric with no base returns null rather than a confident zero", () => {
  const nobodyTouched = steadyDays.map((row) => ({ ...row, first_touch_minutes: null }));
  const line = monitor.dailyScorecard(nobodyTouched).find((entry) => entry.key === "firstResponse");
  assert.equal(line.today, null, "a median over nothing is not 0 minutes");
});

check("the stage strip tones on the gap against normal, never on the raw share", () => {
  // Day 14 books nothing; the thirty days behind it book half. The rung must read bad on the gap.
  const rows = steadyDays.map((row) => ({
    ...row,
    appointment_booked: !row.created_at.startsWith(dayOf(14)) && row.id.endsWith("0"),
  }));
  const strip = monitor.stageDropStrip(rows, { day: dayOf(14) });
  const booked = strip.find((rung) => rung.key === "booked");
  assert.equal(booked.todayShare, 0);
  assert.ok(booked.normalShare > 0);
  assert.ok(booked.gap < 0);
  assert.equal(booked.tone, "bad");
  assert.equal(monitor.worstRung(strip).key, "booked");
});

check("drop reasons are counted off the closure record, never inferred", () => {
  const closed = [
    lead({ id: "c1", created_at: `${dayOf(14)}T06:00:00.000Z`, loss_category: "Financial", loss_reason: "Treatment cost high", recoverable: true }),
    lead({ id: "c2", created_at: `${dayOf(14)}T06:00:00.000Z`, loss_category: "Financial", loss_reason: "Treatment cost high", recoverable: true }),
    lead({ id: "c3", created_at: `${dayOf(14)}T06:00:00.000Z`, loss_category: "Interest", loss_reason: "Not interested", recoverable: false }),
    lead({ id: "c4", created_at: `${dayOf(14)}T06:00:00.000Z` }),
  ];
  const found = monitor.dropReasonsForDay(closed, { day: dayOf(14) });
  assert.equal(found.closed, 3, "the lead with no reason is not a closure");
  assert.equal(found.recoverable, 2);
  assert.equal(found.reasons[0].reason, "Treatment cost high");
  assert.equal(found.reasons[0].leads, 2);
});

// ---- M4. Follow-up Compliance -----------------------------------------------------------------

check("a lead lands in exactly one severity, the worst one it qualifies for", () => {
  const hotAndUnconfirmed = lead({
    temperature: "Hot",
    followup_compliant: false,
    appointment_booked: true,
    appointment_confirmed: false,
  });
  const queue = compliance.overdueQueue([hotAndUnconfirmed]);
  assert.equal(queue.length, 1, "listing one lead twice makes the queue longer, not truer");
  assert.equal(queue[0].severity, "hot-overdue");
});

check("severities come back worst first", () => {
  const rows = [
    lead({ id: "cold", temperature: "Cold", followup_compliant: false }),
    lead({ id: "hot", temperature: "Hot", followup_compliant: false }),
    lead({ id: "warm", temperature: "Warm", followup_compliant: false }),
  ];
  assert.deepEqual(
    compliance.overdueQueue(rows).map((entry) => entry.id),
    ["hot", "warm", "cold"]
  );
});

check("a delivery failure is never counted as an agent miss", () => {
  // The plan ran in full. Two messages the platform accepted never arrived.
  const platformFault = lead({ followups_required: 5, followups_done: 5, messages_sent: 6, messages_delivered: 4 });
  assert.equal(compliance.touchesMissed(platformFault), 0);
  assert.equal(compliance.messagesUndelivered(platformFault), 2);

  const split = compliance.executionSplit([platformFault]);
  assert.equal(split.missed, 0, "nothing was skipped");
  assert.equal(split.undelivered, 2);
  assert.equal(split.executionRate, 100, "a scheduler outage must not move an agent's execution rate");
});

check("the two causes are named per row so a manager knows who to talk to", () => {
  const skipped = lead({ temperature: "Hot", followups_required: 5, followups_done: 2, followup_compliant: false });
  const undelivered = lead({
    temperature: "Hot",
    followups_required: 5,
    followups_done: 5,
    followup_compliant: false,
    messages_sent: 5,
    messages_delivered: 3,
  });
  assert.equal(compliance.overdueQueue([skipped])[0].cause, "Touches never executed");
  assert.equal(compliance.overdueQueue([undelivered])[0].cause, "Delivery failure — not an agent miss");
});

check("an overdelivered plan never reads as a negative miss", () => {
  assert.equal(compliance.touchesMissed(lead({ followups_required: 3, followups_done: 7 })), 0);
});

check("completion by agent puts the worst executor first and keeps the split visible", () => {
  const rows = [
    lead({ agent_name: "Good", followups_required: 10, followups_done: 10 }),
    lead({ agent_name: "Bad", followups_required: 10, followups_done: 3 }),
  ];
  const lines = compliance.completionBy(rows, "agent_name");
  assert.equal(lines[0].value, "Bad");
  assert.equal(lines[0].executionRate, 30);
  assert.equal(lines[1].executionRate, 100);
});

// ---- M5. Assignment Board ---------------------------------------------------------------------

const waiting = [
  lead({ id: "w1", first_touch_minutes: null, age_days: 12, source: "Meta Ads", disease: "Piles" }),
  lead({ id: "w2", first_touch_minutes: null, age_days: 2, source: "Walk-in", disease: "Cataract" }),
  lead({ id: "w3", first_touch_minutes: null, age_days: 40, disease: "Hernia" }),
  lead({ id: "touched", first_touch_minutes: 3, age_days: 5 }),
];

check("the board holds leads nobody has ever touched, oldest first, inside the window", () => {
  const pool = assignment.waitingPool(waiting, { days: 30 });
  assert.deepEqual(pool.map((entry) => entry.id), ["w1", "w2"], "40 days old is history, and a touched lead is not waiting");
  assert.equal(pool[0].waitingDays, 12);
});

check("every waiting lead names the rule that should have routed it", () => {
  const pool = assignment.waitingPool(waiting, { days: 30 });
  const walkIn = pool.find((entry) => entry.id === "w2");
  assert.match(walkIn.rule, /branch desk/i);
  assert.equal(walkIn.routeTo, "Jayanagar front desk");
  const paid = pool.find((entry) => entry.id === "w1");
  assert.equal(paid.routeTo, "Jayanagar team");
  for (const entry of pool) assert.ok(entry.because, "a rule with no stated reason is a rule nobody trusts");
});

check("the rule set has no hole — every lead matches something", () => {
  const odd = { id: "odd", source: "Carrier pigeon", disease: "Unheard of", branch: null, first_touch_minutes: null, age_days: 1 };
  assert.equal(assignment.ruleFor(odd).key, "catch-all");
  assert.equal(assignment.ruleFor(odd).routeTo, "Manager queue");
});

check("SLA bands escalate, and a lead waiting days lands past the breach", () => {
  assert.equal(assignment.slaBand(3).key, "inside");
  assert.equal(assignment.slaBand(30).key, "late");
  assert.equal(assignment.slaBand(600).key, "breached");
  assert.equal(assignment.slaBand(3 * 24 * 60).key, "abandoned");
  assert.equal(assignment.slaBand(20 * 24 * 60).key, "written-off");
});

check("the summary counts the whole history behind the window's work", () => {
  const summary = assignment.boardSummary(waiting, { days: 30 });
  assert.equal(summary.waiting, 2, "the work");
  assert.equal(summary.neverTouchedEver, 3, "the argument");
  assert.equal(summary.oldestDays, 12);
});

check("assignment is refused into a full queue, and a reassignment needs a reason", () => {
  const full = { value: "Nikhil Rao", open: 90, capacity: 90, atCapacity: true };
  const free = { value: "Divya Menon", open: 10, capacity: 90, atCapacity: false };
  const leadRow = { id: "w1", nominal_owner: "Sneha Pillai", rule: "branch", waitingDays: 12 };

  assert.match(assignment.assignmentProblems({ lead: leadRow, agent: full, reason: "x" }).join(" "), /at capacity/);
  assert.match(
    assignment.assignmentProblems({ lead: leadRow, agent: free }).join(" "),
    /needs a reason/,
    "taking a lead off another agent without a reason is exactly what §29 forbids"
  );
  assert.deepEqual(assignment.assignmentProblems({ lead: leadRow, agent: free, reason: "Sneha is on leave" }), []);
});

check("the assignment record carries what the audit log needs", () => {
  const record = assignment.assignmentRecord({
    lead: { id: "w1", nominal_owner: "Sneha Pillai", rule: "Everything else routes by branch", waitingDays: 12 },
    agent: { value: "Divya Menon" },
    reason: "  Sneha is on leave  ",
    by: "Meera Raghavan",
  });
  assert.deepEqual(record, {
    lead_id: "w1",
    from: "Sneha Pillai",
    to: "Divya Menon",
    reason: "Sneha is on leave",
    rule: "Everything else routes by branch",
    waiting_days_at_assignment: 12,
    assigned_by: "Meera Raghavan",
  });
});

check("the roster reports load against a stated capacity, lightest first", () => {
  const rows = [
    ...Array.from({ length: 20 }, (_, i) => lead({ id: `a${i}`, agent_name: "Busy", status: "Pending" })),
    lead({ id: "b0", agent_name: "Quiet", status: "Pending" }),
  ];
  const roster = assignment.rosterLoad(rows, { capacity: 20 });
  assert.equal(roster[0].value, "Quiet");
  assert.equal(roster[1].value, "Busy");
  assert.equal(roster[1].atCapacity, true);
  assert.equal(roster[1].headroom, 0);
});

// ---- M7. Team ---------------------------------------------------------------------------------

const teamRows = [
  ...Array.from({ length: 12 }, (_, i) => lead({ id: `n${i}`, agent_name: "Nikhil Rao", disease: "Piles" })),
  ...Array.from({ length: 4 }, (_, i) => lead({ id: `d${i}`, agent_name: "Divya Menon", disease: "Cataract" })),
];

check("the roster merges configured facts with measured load and never mixes them up", () => {
  const lines = team.teamRoster(teamRows);
  const nikhil = lines.find((line) => line.value === "Nikhil Rao");
  assert.equal(nikhil.shift, "Morning · 9:00–18:00", "configured");
  assert.equal(nikhil.open, 12, "measured");
});

check("somebody on leave still shows the leads nobody is covering", () => {
  const lines = team.teamRoster(teamRows);
  const divya = lines.find((line) => line.value === "Divya Menon");
  assert.equal(divya.onLeave, true);
  assert.equal(divya.uncovered, 4, "hiding an absent person's queue is how those leads go quiet");
  assert.equal(team.teamTotals(teamRows).uncovered, 4);
});

check("utilisation divides by the capacity on shift, not the capacity on the payroll", () => {
  const totals = team.teamTotals(teamRows);
  assert.equal(totals.people, 4);
  assert.equal(totals.onShift, 3);
  assert.equal(totals.capacity, 3 * assignment.DEFAULT_CAPACITY, "the person on leave is not capacity today");
});

check("a coverage gap is only reported where open leads are actually sitting in it", () => {
  // Cataract is only on the absent person's skill list, and four open leads need it.
  const gaps = team.coverageGaps(teamRows);
  assert.ok(gaps.gaps.some((line) => line.value === "Cataract" && line.openLeads === 4));
  assert.ok(!gaps.gaps.some((line) => line.value === "Piles"), "Piles is covered by two people on shift");
  assert.equal(gaps.leadsInGaps, 4);
});

check("a person holding open leads cannot be deactivated until they move", () => {
  const lines = team.teamRoster(teamRows);
  const nikhil = lines.find((line) => line.value === "Nikhil Rao");
  const sneha = lines.find((line) => line.value === "Sneha Pillai");

  assert.match(team.deactivationProblems(nikhil).join(" "), /12 open lead/);
  assert.deepEqual(team.deactivationProblems(nikhil, { reassignTo: sneha }), []);
  assert.match(team.deactivationProblems(nikhil, { reassignTo: nikhil }).join(" "), /cannot be reassigned to the person/);
});

check("cover candidates exclude the absent and prefer a real skill overlap", () => {
  const lines = team.teamRoster(teamRows);
  const nikhil = lines.find((line) => line.value === "Nikhil Rao");
  const candidates = team.coverCandidates(lines, nikhil);
  assert.ok(!candidates.some((line) => line.value === "Nikhil Rao"));
  assert.ok(!candidates.some((line) => line.onLeave), "somebody on leave cannot cover an absence");
  assert.equal(candidates[0].value, "Arjun Verma", "shares Piles with Nikhil");
});

// ---- M8. Escalation & Objection Desk ----------------------------------------------------------

check("all six §24 objections are present, each with an owner and a prescribed action", () => {
  assert.equal(escalations.OBJECTIONS.length, 6);
  for (const objection of escalations.OBJECTIONS) {
    assert.ok(objection.routesTo, `${objection.label} needs an owner`);
    assert.ok(objection.action, `${objection.label} needs an action`);
    assert.ok(objection.liveBasis, `${objection.label} must say how it is detected, or why it cannot be`);
  }
});

check("an objection with no live detector reports as undetectable rather than as empty", () => {
  const desk = escalations.escalationDesk([lead()]);
  const fear = desk.find((queue) => queue.key === "fear");
  assert.equal(fear.detectable, false);
  assert.equal(fear.live, 0);
  assert.match(fear.liveBasis, /call remark/, "the screen must say why the queue is empty");
  assert.equal(escalations.deskSummary(desk).undetectable, 3);
});

check("the live price queue is surgery advised and never booked, on an open lead", () => {
  const rows = [
    lead({ id: "live", surgery_advised: true, surgery_booked: false, status: "Pending", quoted_package: 65000 }),
    lead({ id: "booked", surgery_advised: true, surgery_booked: true, status: "Pending" }),
    lead({ id: "closed", surgery_advised: true, surgery_booked: false, status: "Lost" }),
  ];
  const price = escalations.escalationDesk(rows).find((queue) => queue.key === "price");
  assert.deepEqual(price.liveRows.map((entry) => entry.id), ["live"]);
  assert.equal(price.routesTo, "Financial counselor");
});

check("closed-without-escalation counts the leads the prescribed action never reached", () => {
  const rows = [
    lead({ id: "never", expired: true, loss_reason: "Treatment cost high", financial_counseling_completed: false, recoverable: true, quoted_package: 65000 }),
    lead({ id: "did", expired: true, loss_reason: "Treatment cost high", financial_counseling_completed: true }),
  ];
  const price = escalations.escalationDesk(rows).find((queue) => queue.key === "price");
  assert.equal(price.closed, 2);
  assert.equal(price.never, 1, "§33's whole finding is this number");
  assert.equal(price.neverShare, 50);
  assert.equal(price.recoverable, 1);
  assert.equal(price.lostValue, 65000);
  assert.equal(price.prescribedLabel, "financial counseling");
});

check("resolving an escalation needs an outcome and a real note", () => {
  assert.match(escalations.resolutionProblems({}).join(" "), /Pick what actually happened/);
  assert.match(escalations.resolutionProblems({ outcome: "Made it up" }).join(" "), /not on the list/);
  assert.match(
    escalations.resolutionProblems({ outcome: escalations.RESOLUTION_OUTCOMES[0], note: "ok" }).join(" "),
    /at least 15 characters/
  );
  assert.deepEqual(
    escalations.resolutionProblems({ outcome: escalations.RESOLUTION_OUTCOMES[0], note: "Explained the package and the EMI option" }),
    []
  );
});

check("a discount approval cannot be written without an amount, a reason and an approver", () => {
  const base = { outcome: escalations.RESOLUTION_OUTCOMES[0], note: "Approved a controlled discount", discount: true };
  const problems = escalations.resolutionProblems(base);
  assert.match(problems.join(" "), /needs an amount/);
  assert.match(problems.join(" "), /needs a justification/);
  assert.match(problems.join(" "), /named approver/);
  assert.deepEqual(
    escalations.resolutionProblems({ ...base, discountAmount: 5000, discountJustification: "Below the 10% band", approver: "Meera Raghavan" }),
    []
  );
});

// ---- O1. Appointment & No-show Board ----------------------------------------------------------

check("the reminder sequence is the four §17 steps, and missed steps are named", () => {
  assert.equal(board.REMINDER_SEQUENCE.length, 4);
  assert.equal(board.remindersSent(lead({ confirmations_count: 2 })), 2);
  assert.deepEqual(board.remindersMissed(lead({ confirmations_count: 2 })), [
    "Day-before reminder",
    "Morning-of reminder",
  ]);
  assert.equal(board.remindersSent(lead({ confirmations_count: 9 })), 4, "a count cannot exceed the sequence");
  assert.equal(board.remindersSent(lead({ confirmations_count: null })), 0);
});

check("a no-show that was never reminded is attributed to the hospital", () => {
  const never = lead({ appointment_booked: true, no_show: true, confirmations_count: 0 });
  const fully = lead({ appointment_booked: true, no_show: true, confirmations_count: 4 });
  const [neverRow] = board.noShowBoard([never]);
  const [fullyRow] = board.noShowBoard([fully]);
  assert.match(neverRow.attribution, /this is ours/);
  assert.equal(neverRow.ourFailure, true);
  assert.match(fullyRow.attribution, /the patient did not come/);
  assert.equal(fullyRow.ourFailure, false);
});

check("every no-show carries a recovery owner and a state — §24 forbids a dead end", () => {
  const rows = [
    lead({ appointment_booked: true, no_show: true, no_show_recovered: false }),
    lead({ appointment_booked: true, no_show: true, no_show_recovered: true }),
  ];
  for (const entry of board.noShowBoard(rows)) {
    assert.ok(entry.recoveryOwner);
    assert.ok(entry.recoveryState);
  }
  assert.equal(board.noShowBoard(rows)[0].recovered, false, "open recoveries come first");
});

check("the attribution split adds up and separates the never-reminded", () => {
  const rows = [
    lead({ id: "n1", appointment_booked: true, no_show: true, confirmations_count: 0 }),
    lead({ id: "n2", appointment_booked: true, no_show: true, confirmations_count: 2 }),
    lead({ id: "n3", appointment_booked: true, no_show: true, confirmations_count: 4, no_show_recovered: true }),
  ];
  const split = board.noShowAttribution(rows);
  assert.equal(split.total, 3);
  assert.equal(split.ours, 2);
  assert.equal(split.theirs, 1);
  assert.equal(split.ours + split.theirs, split.total);
  assert.equal(split.neverReminded, 1);
  assert.equal(split.recovered, 1);
});

check("the confirmation queue leads with the appointment nobody has contacted", () => {
  const rows = [
    lead({ id: "some", appointment_booked: true, appointment_confirmed: false, confirmations_count: 3 }),
    lead({ id: "none", appointment_booked: true, appointment_confirmed: false, confirmations_count: 0 }),
    lead({ id: "done", appointment_booked: true, appointment_confirmed: true }),
  ];
  assert.deepEqual(board.confirmationQueue(rows).map((entry) => entry.id), ["none", "some"]);
});

check("reminder count against kept rate is reported per step, with the base beside it", () => {
  const rows = [
    lead({ id: "k1", appointment_booked: true, confirmations_count: 4, visited: true }),
    lead({ id: "k2", appointment_booked: true, confirmations_count: 4, visited: true }),
    lead({ id: "m1", appointment_booked: true, confirmations_count: 0, no_show: true }),
  ];
  const effect = board.reminderEffect(rows);
  const none = effect.find((line) => line.reminders === 0);
  const all = effect.find((line) => line.reminders === 4);
  assert.equal(none.appointments, 1);
  assert.equal(none.keptRate, 0);
  assert.equal(all.appointments, 2);
  assert.equal(all.keptRate, 100);
  assert.ok(effect.every((line) => line.appointments > 0), "an empty rung is not a data point");
});

check("board metrics divide by the base they name", () => {
  const rows = [
    lead({ appointment_booked: true, appointment_confirmed: true, visited: true, confirmations_count: 3 }),
    lead({ appointment_booked: true, appointment_confirmed: false, no_show: true, confirmations_count: 1 }),
    lead({ appointment_booked: false }),
  ];
  const metrics = board.boardMetrics(rows);
  assert.equal(metrics.booked, 2, "the unbooked lead is not in any appointment rate");
  assert.equal(metrics.confirmationRate, 50);
  assert.equal(metrics.noShowRate, 50);
  assert.equal(metrics.recoveryRate, 0);
  assert.equal(metrics.remindersPerKept, 3);
  assert.equal(metrics.remindersPerNoShow, 1);
});

// ---- O2. Financial Counseling Desk ------------------------------------------------------------

check("the post-consultation state is the furthest one reached, not the first", () => {
  assert.equal(counseling.stateOf(lead({ surgery_advised: true })).key, "counseling-pending");
  assert.equal(
    counseling.stateOf(lead({ surgery_advised: true, financial_counseling_completed: true, surgery_booked: true })).key,
    "booked"
  );
  assert.equal(
    counseling.stateOf(lead({ surgery_advised: true, financial_counseling_completed: true, insurance_available: true, insurance_approved: false })).key,
    "insurance-pending"
  );
  assert.equal(counseling.stateOf(lead()), null, "a lead never advised surgery is not on this desk");
});

check("coverage is the §33 number: advised, never counseled, never booked", () => {
  const rows = [
    lead({ id: "a", surgery_advised: true, financial_counseling_completed: true, surgery_booked: true }),
    lead({ id: "b", surgery_advised: true, financial_counseling_completed: false, surgery_booked: false }),
    lead({ id: "c", surgery_advised: true, financial_counseling_completed: false, surgery_booked: false }),
    lead({ id: "d", surgery_advised: false }),
  ];
  const found = counseling.coverage(rows);
  assert.equal(found.advised, 3);
  assert.equal(found.counseled, 1);
  assert.equal(found.coverageRate, 33.3);
  assert.equal(found.uncounseledAndLost, 2);
});

check("counseling effect is stated in points with both bases visible", () => {
  const rows = [
    lead({ surgery_advised: true, financial_counseling_completed: true, surgery_booked: true }),
    lead({ surgery_advised: true, financial_counseling_completed: true, surgery_booked: true }),
    lead({ surgery_advised: true, financial_counseling_completed: false, surgery_booked: false }),
    lead({ surgery_advised: true, financial_counseling_completed: false, surgery_booked: false }),
  ];
  const effect = counseling.counselingEffect(rows);
  assert.equal(effect.withCounseling.patients, 2);
  assert.equal(effect.withCounseling.bookingRate, 100);
  assert.equal(effect.withoutCounseling.patients, 2);
  assert.equal(effect.withoutCounseling.bookingRate, 0);
  assert.equal(effect.pointsGained, 100);
});

check("a price closure is refused on a patient nobody counseled", () => {
  const uncounseled = { patient_name: "X", counseled: false };
  const problems = counseling.closureProblems({ lead: uncounseled, reason: "Treatment cost high" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /never counseled/);
  assert.match(problems[0], new RegExp(counseling.NO_COUNSELING_REASON));
});

check("the guard fires the other way too — counseling happened, so its absence is not the reason", () => {
  const counseled = { patient_name: "Y", counseled: true };
  const problems = counseling.closureProblems({ lead: counseled, reason: counseling.NO_COUNSELING_REASON });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /cannot be the reason/);
});

check("the honest closure is always available", () => {
  assert.deepEqual(
    counseling.closureProblems({ lead: { counseled: false }, reason: counseling.NO_COUNSELING_REASON }),
    [],
    "a counselor who never called must be able to record exactly that"
  );
  assert.deepEqual(counseling.closureProblems({ lead: { counseled: true }, reason: "Treatment cost high" }), []);
  assert.deepEqual(counseling.closureProblems({ lead: { counseled: false }, reason: "Surgery fear" }), [], "the guard is about price, not about everything");
});

check("the missing budget field is reported as missing, never estimated", () => {
  const gap = counseling.gapAnalysis([lead({ surgery_advised: true, quoted_package: 65000 })]);
  assert.equal(gap.averageQuoted, 65000);
  assert.equal(gap.stated, null);
  assert.equal(gap.averageGap, null, "inventing a patient's budget in front of a counselor ends the meeting");
  assert.match(gap.missingField, /stated budget/);
});

check("a counseling session needs an outcome and a note, and a discount needs a justification", () => {
  assert.match(counseling.sessionProblems({}).join(" "), /Pick what came out/);
  assert.match(counseling.sessionProblems({ outcome: counseling.SESSION_OUTCOMES[0], note: "no" }).join(" "), /at least 15/);
  const discount = counseling.sessionProblems({
    outcome: "Discount requested — pending approval",
    note: "Patient asked for a reduction on the package",
  });
  assert.match(discount.join(" "), /needs an amount/);
  assert.match(discount.join(" "), /needs a justification/);
});

// ---- S1. Lead Intake & Source Configuration ---------------------------------------------------

check("the registry holds all seventeen §5 sources, live or not", () => {
  assert.equal(sources.CANONICAL_SOURCES.length, 17);
  const registry = sources.sourceRegistry([lead({ source: "Meta Ads" })]);
  assert.equal(registry.length, 17, "a configured source that produced nothing is exactly the row to keep");
  assert.equal(registry.filter((line) => line.live).length, 1);
});

check("what the ad platform calls a source is folded onto the name the specification uses", () => {
  assert.equal(sources.canonicalSource("Meta Ads"), "Facebook");
  assert.equal(sources.canonicalSource("Camp"), "Health Camp");
  assert.equal(sources.canonicalSource("Something nobody registered"), "Other");
  const registry = sources.sourceRegistry([lead({ source: "Meta Ads" }), lead({ source: "Meta Ads" })]);
  const facebook = registry.find((line) => line.value === "Facebook");
  assert.equal(facebook.leads, 2, "two names for one source must not report two half-funnels");
  assert.equal(facebook.arrivesAs, "Meta Ads");
});

check("an unregistered source lands in Other and is flagged", () => {
  const registry = sources.sourceRegistry([lead({ source: "Carrier pigeon" })]);
  const other = registry.find((line) => line.value === "Other");
  assert.equal(other.leads, 1);
  assert.equal(other.unmapped, true);
});

check("the §3.1 audit reports each mandatory field's completeness and what its absence blocks", () => {
  const audit = sources.attributionAudit([lead(), lead()]);
  assert.equal(audit.length, 5);
  const landing = audit.find((line) => line.key === "landing_page");
  assert.equal(landing.completeness, 0);
  assert.equal(landing.enforced, false);
  assert.match(landing.blocks, /ad set|creative/i, "a missing field has to say what it costs");
  assert.equal(audit.find((line) => line.key === "source").completeness, 100);
});

check("the hierarchy stops where the data stops, and says which rungs are missing", () => {
  const hierarchy = sourceRegistryHierarchy();
  assert.equal(hierarchy.depth, 2);
  assert.deepEqual(hierarchy.rungs.length, 6);
  assert.deepEqual(hierarchy.missingRungs, ["Ad set", "Creative", "Landing page"]);
  assert.equal(hierarchy.tree[0].source, "Facebook");
  assert.equal(hierarchy.tree[0].campaigns[0].leads, 2);
});
function sourceRegistryHierarchy() {
  return sources.campaignHierarchy([
    lead({ source: "Meta Ads", campaign: "Piles — Jayanagar — Aug" }),
    lead({ source: "Meta Ads", campaign: "Piles — Jayanagar — Aug" }),
    lead({ source: "Website", campaign: "Organic — Website" }),
  ]);
}

check("duplicates on a phone number are strong, name-and-disease is weak, and they stay apart", () => {
  const rows = [
    lead({ id: "1", phone_number: "+91 9111111111", patient_name: "A", created_at: "2026-08-01T00:00:00.000Z" }),
    lead({ id: "2", phone_number: "+91 9111111111", patient_name: "B", created_at: "2026-08-05T00:00:00.000Z" }),
    lead({ id: "3", phone_number: "+91 9222222222", patient_name: "C", disease: "Piles", created_at: "2026-08-01T00:00:00.000Z" }),
    lead({ id: "4", phone_number: "+91 9333333333", patient_name: "C", disease: "Piles", created_at: "2026-08-02T00:00:00.000Z" }),
  ];
  const found = sources.duplicateCandidates(rows);
  assert.equal(found.strongCount, 1);
  assert.equal(found.weakCount, 1);
  assert.equal(found.strong[0].keeps, "1", "the earliest record owns the attribution");
});

check("a duplicate outside the window is not a duplicate", () => {
  const rows = [
    lead({ id: "1", phone_number: "+91 9111111111", created_at: "2026-01-01T00:00:00.000Z" }),
    lead({ id: "2", phone_number: "+91 9111111111", created_at: "2026-08-01T00:00:00.000Z" }),
  ];
  assert.equal(sources.duplicateCandidates(rows, { windowDays: 30 }).strongCount, 0);
});

check("intake refuses an incomplete lead from any path, not just the form", () => {
  assert.deepEqual(sources.intakeProblems({}).length, 5);
  const complete = { source: "Facebook", campaign: "X", platform: "Meta", landing_page: "/piles", created_at: "2026-08-01" };
  assert.deepEqual(sources.intakeProblems(complete), []);
  assert.match(
    sources.intakeProblems({ ...complete, source: "Carrier pigeon" }).join(" "),
    /not a registered source/
  );
});

check("an attribution edit is refused without an admin and a reason, and returns what it would write", () => {
  const leadRow = { id: "x", campaign: "Old" };
  assert.ok(sourceEdit(leadRow, {}).problems.length >= 2);
  const ok = sourceEdit(leadRow, { by: "Ravi Shankar", reason: "Campaign was mapped to the wrong month" });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.record.from, "Old");
  assert.equal(ok.record.to, "New");
  assert.equal(ok.record.changed_by, "Ravi Shankar");
});
function sourceEdit(leadRow, extra) {
  return sources.attributionChange({ lead: leadRow, field: "campaign", to: "New", ...extra });
}

console.log(`${checks} operations checks passed`);
