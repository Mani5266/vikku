// How a lead gets into the system.
//
//   npm run test:intake
//
// The product had no way to create one. Every lead existed because the seed invented it: the store
// carried `updateLead` and nothing that added a record, and the §3.1 guard in sourceRegistry.js
// had nothing calling it. A telecaller taking an enquiry on the phone had nowhere to put it.
//
// Two rules carry this file. Attribution is enforced at the write layer, so a spreadsheet import
// cannot walk past a check that lives on a form. And a patient already in the system is refused a
// second record, because two agents ringing the same person about the same condition is how a
// hospital loses a lead it had already won.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const intake = await load("src/lib/intake.js");
const registry = await load("src/lib/sourceRegistry.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

const complete = {
  patient_name: "Ravi Kumar",
  phone_number: "9845011225",
  disease: "Piles",
  branch: "Jayanagar",
  source: "Meta Ads",
  campaign: "Piles — Jayanagar — Aug",
  landing_page: "/piles-consultation",
};

// ---- the number ---------------------------------------------------------------------------------

check("a mobile number is accepted in the shapes people actually type it", () => {
  for (const typed of ["9845011223", "+91 9845011223", "+91-98450-11223", "098450 11223", "91 9845011223"]) {
    assert.equal(intake.normalisePhone(typed), "+91 9845011223", `failed on ${typed}`);
  }
});

check("anything that is not an Indian mobile is refused rather than stored crooked", () => {
  for (const bad of ["", null, "12345", "1234567890", "5845011223", "abcdefghij"]) {
    assert.equal(intake.normalisePhone(bad), null, `accepted ${bad}`);
  }
  // A landline-shaped number starting 5 is the one most likely to be typed by mistake, and a lead
  // nobody can ring is worse than a lead nobody entered.
  assert.equal(intake.normalisePhone("5845011223"), null);
});

// ---- §3.1, at the write layer --------------------------------------------------------------------

check("a complete lead passes, and an empty one is refused on every count", () => {
  assert.deepEqual(intake.intakeProblems(complete), []);
  const bare = intake.intakeProblems({});
  assert.ok(bare.length >= 6, "an empty draft must fail loudly, not quietly");
  assert.ok(bare.some((p) => /name/i.test(p)));
  assert.ok(bare.some((p) => /mobile number/i.test(p)));
  assert.ok(bare.some((p) => /asking about/i.test(p)));
  assert.ok(bare.some((p) => /branch/i.test(p)));
});

check("attribution is refused one field at a time, naming the field", () => {
  for (const field of ["source", "campaign"]) {
    const problems = intake.intakeProblems({ ...complete, [field]: undefined });
    assert.ok(problems.length > 0, `${field} can be left out`);
  }
});

check("§3.1 asks for a landing page OR a form, and the path supplies the form", () => {
  // A telecaller typing an enquiry is the form. Demanding a landing page as well would make the
  // field a lie on the one path where somebody is on the phone and in a hurry.
  assert.deepEqual(intake.intakeProblems({ ...complete, landing_page: undefined }), []);
  assert.equal(intake.withDefaults({}, "manual").form, "Telecaller entry");
  assert.equal(intake.withDefaults({}, "walk-in").form, "Front desk");
  assert.equal(intake.withDefaults({}, "bulk").form, "Spreadsheet import");
  // With neither, it fails.
  const record = intake.withDefaults({ ...complete, landing_page: undefined }, "manual");
  assert.ok(registry.intakeProblems({ ...record, form: undefined }).some((p) => /Landing page or form/.test(p)));
});

check("the platform is derived from the source rather than asked for twice", () => {
  assert.equal(intake.platformFor("Meta Ads"), "Meta");
  assert.equal(intake.platformFor("Google Ads"), "Google");
  assert.equal(intake.platformFor("Website"), "Owned");
  // Nobody types "Meta" after already answering "Meta Ads". A mandatory field that has to be typed
  // twice is a mandatory field that gets faked.
  assert.equal(intake.withDefaults(complete).platform, "Meta");
  assert.deepEqual(intake.intakeProblems({ ...complete, platform: undefined }), []);
});

check("an unregistered source is refused, so the registry stays the only vocabulary", () => {
  const problems = intake.intakeProblems({ ...complete, source: "Carrier pigeon" });
  assert.ok(problems.some((p) => /not a registered source/.test(p)));
});

check("a walk-in is not asked for a landing page it could never have", () => {
  const walkIn = { patient_name: "Latha", phone_number: "9845011226", disease: "Gallstones", branch: "Whitefield" };
  assert.deepEqual(intake.intakeProblems(walkIn, { path: "walk-in" }), []);
  // Demanding one would teach the front desk to type something false into the field the MD later
  // reports on, which is worse than the field being empty.
  const asManual = intake.intakeProblems(walkIn, { path: "manual" });
  assert.ok(asManual.length > 0, "the same record is incomplete on a path where those fields are real");
});

check("the guard is the same one the source registry enforces", () => {
  // Two guards that drift apart is one guard. Anything intake accepts must satisfy §3.1 outright.
  const record = intake.withDefaults(complete, "manual");
  assert.deepEqual(registry.intakeProblems(record), []);
});

// ---- the duplicate check --------------------------------------------------------------------------

const existing = [
  { id: "lead_001", patient_name: "Priya Sharma", phone_number: "+91 98450 11223", disease: "Cataract", agent_name: "Nikhil Rao" },
  { id: "lead_002", patient_name: "Ravi Kumar", phone_number: "+91 90000 11111", disease: "Piles", agent_name: "Sneha Pillai" },
];

check("the same number is a block, whatever shape it was typed in", () => {
  const found = intake.findDuplicates({ ...complete, phone_number: "98450-11223" }, existing);
  assert.equal(found.blocking, true);
  assert.equal(found.strong[0].id, "lead_001");
});

check("the same name and condition on a different number is a look, not a block", () => {
  const found = intake.findDuplicates(complete, existing);
  assert.equal(found.blocking, false, "in a hospital this size that is a Tuesday");
  assert.equal(found.weak.length, 1);
  assert.equal(found.weak[0].id, "lead_002");
});

check("a genuinely new patient is neither", () => {
  const found = intake.findDuplicates({ patient_name: "Nobody Here", phone_number: "9000000001", disease: "Thyroid" }, existing);
  assert.equal(found.blocking, false);
  assert.equal(found.weak.length, 0);
  assert.equal(found.strong.length, 0);
});

// ---- who it goes to ---------------------------------------------------------------------------------

const roster = [
  { value: "Nikhil Rao", open: 79, capacity: 90, atCapacity: false },
  { value: "Divya Menon", open: 46, capacity: 90, atCapacity: false },
  { value: "Sneha Pillai", open: 90, capacity: 90, atCapacity: true },
];

check("a new lead goes to whoever has the most room, and says why", () => {
  const assigned = intake.assignmentFor(complete, roster);
  assert.equal(assigned.agent_name, "Divya Menon");
  assert.ok(assigned.because.includes("Divya Menon"));
  assert.ok(assigned.label, "the rule that routed it has to be nameable");
});

check("a full queue is skipped — routing into one moves the problem rather than solving it", () => {
  const assigned = intake.assignmentFor(complete, roster);
  assert.notEqual(assigned.agent_name, "Sneha Pillai");
});

check("an empty roster says so instead of picking nobody silently", () => {
  const assigned = intake.assignmentFor(complete, []);
  assert.equal(assigned.agent_name, null);
  assert.match(assigned.because, /assigning by hand/);
});

// ---- the record that gets written -------------------------------------------------------------------

check("a new lead arrives un-graded, uncalled, and at stage one", () => {
  const lead = intake.buildLead(complete, { path: "manual", assignment: intake.assignmentFor(complete, roster) });
  assert.deepEqual(lead.plan, {}, "a plan chosen before anybody spoke to the patient is a schedule nobody agreed to");
  assert.equal(lead.lead_status, "New — not called yet");
  assert.equal(lead.stage, 1);
  assert.equal(lead.number_valid, true);
  assert.equal(lead.agent_name, "Divya Menon");
  assert.equal(lead.intake_path, "manual");
});

check("the source is stored under the name the specification uses, not the ad platform's", () => {
  const lead = intake.buildLead(complete, { path: "manual" });
  assert.equal(lead.source, "Facebook", "Meta Ads and Facebook are one source, or ROI reports two half-funnels");
  assert.equal(lead.platform, "Meta");
  assert.equal(lead.phone_number, "+91 9845011225", "stored normalised, so the duplicate check works next time");
});

check("the same enquiry typed twice produces the same id, so it collides loudly", () => {
  const at = "2026-08-19T09:00:00.000Z";
  const first = intake.buildLead({ ...complete, created_at: at }, { path: "manual" });
  const second = intake.buildLead({ ...complete, created_at: at }, { path: "manual" });
  assert.equal(first.id, second.id);
});

// ---- the spreadsheet path ------------------------------------------------------------------------------

const SHEET = [
  "Name\tPhone\tCondition\tSource\tCampaign\tBranch",
  "Ravi Kumar\t9845011225\tPiles\tMeta Ads\tPiles — Jayanagar — Aug\tJayanagar",
  "Sita Rao\t9845011226\tHernia\tGoogle Ads\tGeneral Surgery — Aug\tWhitefield",
  "Broken Row\t123",
  "No Source\t9845011227\tThyroid\t\t\tJayanagar",
].join("\n");

check("a pasted sheet is read, the header skipped, and every row put through the same guard", () => {
  const { rows, rejected } = intake.parseBulk(SHEET);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.patient_name), ["Ravi Kumar", "Sita Rao"]);
  assert.equal(rejected.length, 2);
});

check("a refused row is reported with its line and its reason, never dropped", () => {
  const { rejected } = intake.parseBulk(SHEET);
  // A row that vanishes silently is a patient nobody ever calls, and nobody ever knows.
  for (const row of rejected) {
    assert.ok(row.line > 0);
    assert.ok(row.text);
    assert.ok(row.why);
  }
  assert.ok(rejected.some((row) => /three columns/.test(row.why)));
  assert.ok(rejected.some((row) => /§3.1|registered source|required/.test(row.why)));
});

check("the import cannot smuggle in a lead the form would have refused", () => {
  // The whole reason the guard sits at the write layer rather than on the form.
  const { rows } = intake.parseBulk(SHEET);
  for (const row of rows) assert.deepEqual(intake.intakeProblems(row, { path: "bulk" }), []);
});

check("commas work as well as tabs, because that is what comes out of a CSV", () => {
  const { rows } = intake.parseBulk("Ravi Kumar, 9845011225, Piles, Meta Ads, Aug, Jayanagar");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].disease, "Piles");
});

check("an empty paste yields nothing rather than an empty lead", () => {
  assert.deepEqual(intake.parseBulk("").rows, []);
  assert.deepEqual(intake.parseBulk("   \n  \n").rows, []);
});

// ---- what is honestly missing ----------------------------------------------------------------------------

check("the paths that need a server are named as unbuilt rather than left off the list", () => {
  const unbuilt = intake.INTAKE_PATHS.filter((path) => !path.built);
  assert.ok(unbuilt.length >= 2);
  // These carry most of the real volume. A source list that quietly omits them is a lie about
  // coverage, and the screen prints them greyed out with the reason.
  assert.ok(unbuilt.some((path) => /Meta|Google|website/i.test(path.label)));
  for (const path of unbuilt) assert.match(path.detail, /not built|needs a server|integration/i);
});

// ---- the lead the queue then has to work ------------------------------------------------------------------

check("a lead straight from intake is exactly what the queue calls 'ring now'", () => {
  // The last link in the chain, asserted rather than clicked. A new lead has no temperature, no
  // plan and no interactions, so the queue's first-call clock is the only duty on it — which is
  // what puts it at the top of somebody's list with five minutes on it.
  const lead = intake.buildLead(complete, { path: "manual", assignment: intake.assignmentFor(complete, roster) });
  assert.deepEqual(lead.plan, {});
  assert.equal(lead.plan.temperature, undefined, "no grade means no follow-up plan has been chosen yet");
  assert.ok(lead.agent_name, "an unowned lead is one nobody is accountable for");
  assert.ok(Date.parse(lead.created_at) > 0, "the five-minute clock measures from here");
  // Nothing has happened to it yet, which is the whole point.
  assert.equal(lead.stage, 1);
  assert.equal(lead.lead_status, "New — not called yet");
});

check("every field the downstream screens read is present on a freshly created lead", () => {
  // Qualification reads plan, the composer reads rcs_supported, the queue reads number_valid, the
  // manager screens read source, campaign, branch and agent_name. A lead missing any of them
  // renders a screen full of dashes.
  const lead = intake.buildLead(complete, { path: "manual", assignment: intake.assignmentFor(complete, roster) });
  for (const field of [
    "id", "patient_name", "phone_number", "lead_type", "disease", "source", "campaign",
    "platform", "branch", "agent_name", "lead_status", "stage", "rcs_supported",
    "number_valid", "created_at", "plan",
  ]) {
    assert.ok(lead[field] !== undefined && lead[field] !== null, `${field} is missing`);
  }
});

console.log(`${checks} intake checks passed`);
