// Correcting a remark without erasing the first one — §29.
//
//   npm run test:corrections
//
// The Audit Log screen has been printing "corrections post a new entry" for a while and nothing
// implemented corrections, so the sentence was true only because nobody could test it. These are
// the assertions that make it a claim rather than a hope.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const c = await load("src/lib/corrections.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

const NOW = Date.parse("2026-08-22T12:00:00+05:30");
const minutesAgo = (minutes) => new Date(NOW - minutes * 60_000).toISOString();

const original = {
  id: "call_001",
  lead_id: "lead_001",
  agent_name: "Nikhil Rao",
  interaction_date: minutesAgo(2),
  contact_outcome: "Connected",
  patient_said: "Wants the surgery but has to arrange money first.",
  agent_explained: "Explained the package and the EMI option.",
  objection_category: "Financial",
  objection_raised: "Package is too much right now",
  material_shared: "Package card",
  next_action: "Call",
  next_action_at: "2026-08-23T10:00:00+05:30",
};

// ---- the window --------------------------------------------------------------------------------

check("a call logged minutes ago is inside the quiet window", () => {
  assert.equal(c.isQuietWindow(original, NOW), true);
  assert.equal(c.isQuietWindow({ interaction_date: minutesAgo(14) }, NOW), true);
  assert.equal(c.isQuietWindow({ interaction_date: minutesAgo(16) }, NOW), false);
});

check("a record with no usable timestamp is treated as old, not as new", () => {
  // Erring the other way would let a malformed record be corrected with no explanation at all.
  assert.equal(c.isQuietWindow({}, NOW), false);
  assert.equal(c.ageOf({ interaction_date: "not a date" }, NOW), Infinity);
});

// ---- what counts as a change ---------------------------------------------------------------------

check("only fields that actually differ are counted as changed", () => {
  const changed = c.changedFields(original, {
    patient_said: "Wants the surgery but has to arrange money first.", // identical
    next_action: "WhatsApp", // different
  });
  assert.deepEqual(changed.map((field) => field.key), ["next_action"]);
});

check("whitespace alone is not a correction", () => {
  const changed = c.changedFields(original, { patient_said: "  Wants the surgery but has to arrange money first.  " });
  assert.deepEqual(changed, []);
});

check("a field the draft does not mention is left alone", () => {
  assert.deepEqual(c.changedFields(original, {}), []);
});

// ---- the guards ----------------------------------------------------------------------------------

check("a correction that changes nothing is refused", () => {
  const problems = c.correctionProblems(original, { next_action: "Call" }, "", NOW);
  assert.match(problems.join(" "), /Nothing is different yet/);
});

check("inside the window a typo needs no explanation", () => {
  const problems = c.correctionProblems(original, { patient_said: "Wants the surgery, arranging money." }, "", NOW);
  assert.deepEqual(problems, []);
});

check("outside the window a reason is mandatory", () => {
  const old = { ...original, interaction_date: minutesAgo(60) };
  const withoutReason = c.correctionProblems(old, { patient_said: "Different account of the call." }, "", NOW);
  assert.match(withoutReason.join(" "), /more than fifteen minutes ago/);

  const tooShort = c.correctionProblems(old, { patient_said: "Different account of the call." }, "typo", NOW);
  assert.equal(tooShort.length, 1, "a one-word reason is not a reason");

  const proper = c.correctionProblems(
    old,
    { patient_said: "Different account of the call." },
    "Logged against the wrong patient in a hurry.",
    NOW
  );
  assert.deepEqual(proper, []);
});

check("a correction cannot be used to empty a mandatory part", () => {
  // Deleting a remark is not correcting it, and §3.2 does not allow a call with no account of it.
  const problems = c.correctionProblems(original, { patient_said: "   " }, "", NOW);
  assert.match(problems.join(" "), /cannot be emptied/);
});

check("correcting a call that is not there fails plainly", () => {
  assert.match(c.correctionProblems(null, {}, "", NOW).join(" "), /no call here to correct/);
});

// ---- what gets written ---------------------------------------------------------------------------

check("a correction is a new record that points at the original", () => {
  const correction = c.buildCorrection(original, { next_action: "WhatsApp" }, "Agreed a message, not a call.", {
    agentName: "Nikhil Rao",
  });
  assert.equal(correction.corrects, "call_001");
  assert.equal(correction.id, undefined, "the store issues a new id — reusing the old one would overwrite it");
  assert.deepEqual(correction.corrected_fields, ["next_action"]);
  assert.equal(correction.correction_reason, "Agreed a message, not a call.");
});

check("a correction carries the whole record, not only what changed", () => {
  // So anything reading the current version of a call reads one object rather than replaying a
  // chain of diffs.
  const correction = c.buildCorrection(original, { next_action: "WhatsApp" }, "");
  assert.equal(correction.patient_said, original.patient_said);
  assert.equal(correction.lead_id, "lead_001");
  assert.equal(correction.contact_outcome, "Connected");
  assert.equal(correction.next_action, "WhatsApp");
  assert.equal(correction.correction_reason, null);
});

check("the original is never modified", () => {
  const before = JSON.stringify(original);
  c.buildCorrection(original, { patient_said: "Something else entirely" }, "A reason long enough");
  assert.equal(JSON.stringify(original), before, "nothing is overwritten — that is the whole rule");
});

// ---- how it reads afterwards ----------------------------------------------------------------------

check("the summary names the fields rather than counting them", () => {
  const changed = c.changedFields(original, { patient_said: "New account", next_action: "WhatsApp" });
  const line = c.describeCorrection(changed, "Wrong patient");
  assert.equal(line, "Corrected What the patient said and Next action — Wrong patient");
  // "Corrected 2 fields" sends a reader to go and look. This tells them whether they need to.
  assert.ok(!/\d/.test(c.describeCorrection(changed)));
});

check("both records stay in the history, and the superseded one says so", () => {
  const correction = { ...original, id: "call_002", corrects: "call_001", next_action: "WhatsApp" };
  const folded = c.foldCorrections([correction, original]);

  const originalRow = folded.find((entry) => entry.id === "call_001");
  const correctionRow = folded.find((entry) => entry.id === "call_002");

  assert.equal(originalRow.supersededBy, "call_002", "the original stays, marked");
  assert.equal(originalRow.isCorrection, false);
  assert.equal(correctionRow.isCorrection, true);
  assert.equal(correctionRow.supersededBy, null);
  assert.equal(folded.length, 2, "append-only means nothing is removed");
});

check("the current version is the correction where one exists", () => {
  const correction = { ...original, id: "call_002", corrects: "call_001", next_action: "WhatsApp" };
  const history = [correction, original];
  assert.equal(c.currentVersion(history, "call_001").id, "call_002");
  assert.equal(c.currentVersion([original], "call_001").id, "call_001");
  assert.equal(c.currentVersion([], "call_001"), null);
});

check("every correctable field is one of the seven parts, plus who else was there", () => {
  const keys = c.CORRECTABLE_FIELDS.map((field) => field.key);
  for (const part of ["patient_said", "agent_explained", "objection_raised", "material_shared", "next_action", "next_action_at"]) {
    assert.ok(keys.includes(part), part);
  }
  // The contact outcome is not correctable: whether a call connected is not a typo, and changing
  // it would move the lead onto a different follow-up plan behind everyone's back.
  assert.ok(!keys.includes("contact_outcome"));
});

console.log(`${checks} correction checks passed`);
