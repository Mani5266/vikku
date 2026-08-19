// Agent fast-path self-check.
//
//   npm run test:agent
//
// The fast path exists to remove typing, not to write different data. So the values the chips put
// into a record are checked against the vocabularies that own them: the shipped `LeadInteraction`
// next-action enum, the §23 reason taxonomy, and the protocol table. A friendly label that does not
// map to an accepted value is the bug this file exists to catch — it already caught one.
//
// Everything imported here is dependency-free, so this runs under plain Node with no bundler.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const quick = await load("src/lib/quickPhrases.js");
const taxonomy = await load("src/lib/reasonTaxonomy.js");
const protocols = await load("src/lib/followupProtocols.js");

// The shipped component is JSX, so its enum is read from source rather than imported. Reading it
// from the real file is the point: if Base44's accepted values change, this test moves with them.
const shipped = fs.readFileSync(
  path.resolve(appRoot, "../implementation/src/components/shared/StructuredRemark.jsx"),
  "utf8"
);
const SHIPPED_NEXT_ACTIONS = shipped
  .slice(shipped.indexOf("export const NEXT_ACTIONS = ["))
  .slice(0, shipped.slice(shipped.indexOf("export const NEXT_ACTIONS = [")).indexOf("];"))
  .match(/"([^"]+)"/g)
  .map((s) => s.replaceAll('"', ""));

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

check("the shipped enum was actually parsed", () => {
  assert.ok(SHIPPED_NEXT_ACTIONS.length >= 6, "expected the shipped next-action enum");
  assert.ok(SHIPPED_NEXT_ACTIONS.includes("Financial Counseling"));
});

check("every next-action chip maps to a value the entity accepts", () => {
  for (const action of quick.NEXT_ACTIONS) {
    assert.ok(
      SHIPPED_NEXT_ACTIONS.includes(action.value),
      `"${action.label}" writes "${action.value}", which the entity enum does not accept`
    );
  }
});

check("next-action chips are labelled for an agent, not for the schema", () => {
  // At least some labels must differ from the raw enum: "Doctor Callback" is a database value,
  // "Doctor should call" is what a telecaller reads.
  assert.ok(quick.NEXT_ACTIONS.some((action) => action.label !== action.value));
});

check("every quick objection exists in the §23 taxonomy", () => {
  for (const objection of quick.QUICK_OBJECTIONS) {
    const reasons = taxonomy.getReasonsForCategory(objection.category);
    assert.ok(reasons.length, `unknown category ${objection.category}`);
    assert.ok(
      reasons.includes(objection.reason),
      `"${objection.reason}" is not a reason under ${objection.category}`
    );
  }
});

check("every quick objection resolves to a recoverability and an action", () => {
  for (const objection of quick.QUICK_OBJECTIONS) {
    const defaults = taxonomy.reasonDefaults(objection.category, objection.reason);
    assert.ok(defaults, `${objection.reason} has no defaults`);
    assert.equal(typeof defaults.recoverable, "boolean");
    assert.ok(defaults.action);
  }
});

check("every temperature choice is a protocol the scheduler knows", () => {
  for (const choice of quick.TEMPERATURE_CHOICES) {
    assert.ok(protocols.FOLLOWUP_PROTOCOLS[choice.value], `no protocol for ${choice.value}`);
  }
});

check("what a temperature promises matches what its protocol schedules", () => {
  const hot = protocols.FOLLOWUP_PROTOCOLS.Hot;
  const hotCalls = hot.steps.filter((s) => s.callRequired).length;
  const hotChoice = quick.TEMPERATURE_CHOICES.find((c) => c.value === "Hot");
  // The Hot card promises 5 days and several calls; the protocol must not be quieter than that.
  assert.ok(hotCalls >= 3, `Hot schedules only ${hotCalls} calls`);
  assert.ok(/5 days/.test(hotChoice.promise));

  const warm = protocols.FOLLOWUP_PROTOCOLS.Warm;
  assert.equal(warm.durationDays, 15);
  assert.ok(/15 days/.test(quick.TEMPERATURE_CHOICES.find((c) => c.value === "Warm").promise));
});

check("follow-up presets are all in the future, valid and distinct", () => {
  const now = new Date("2026-08-17T09:30:00.000Z");
  const presets = quick.followUpPresets(now);
  assert.ok(presets.length >= 5);
  const seen = new Set();
  for (const preset of presets) {
    const when = new Date(preset.value);
    assert.ok(!Number.isNaN(when.getTime()), `${preset.label} is not a date`);
    assert.ok(when > now, `${preset.label} is in the past`);
    assert.ok(preset.label.trim().length > 0);
    seen.add(preset.value);
  }
  assert.ok(seen.size >= presets.length - 1, "presets should not collapse onto one timestamp");
});

check("presets are offered in ascending order", () => {
  const presets = quick.followUpPresets(new Date("2026-08-17T09:30:00.000Z"));
  const times = presets.map((p) => new Date(p.value).getTime());
  assert.deepEqual([...times].sort((a, b) => a - b), times);
});

check("phrase chips append without repeating themselves", () => {
  const one = quick.appendPhrase("", "Wants EMI.");
  assert.equal(one, "Wants EMI.");
  const two = quick.appendPhrase(one, "Afraid of surgery.");
  assert.equal(two, "Wants EMI. Afraid of surgery.");
  assert.equal(quick.appendPhrase(two, "Wants EMI."), two, "a repeated tap must not duplicate text");
});

check("a single patient phrase already satisfies the remark's minimum length", () => {
  // The gate needs 10 characters. A chip that cannot clear it on its own would force typing.
  for (const group of quick.PATIENT_PHRASES) {
    for (const phrase of group.phrases) assert.ok(phrase.trim().length >= 10, phrase);
  }
  for (const phrase of quick.AGENT_PHRASES) assert.ok(phrase.trim().length >= 10, phrase);
});

check("not-connected reasons are distinct and labelled", () => {
  const reasons = new Set();
  for (const option of quick.NOT_CONNECTED_QUICK) {
    assert.ok(option.reason && option.label);
    reasons.add(option.reason);
  }
  assert.equal(reasons.size, quick.NOT_CONNECTED_QUICK.length);
  // The two that mean "this number is useless" must be reachable, because they are what stops a
  // dead lead coming back to the agent every day.
  assert.ok(reasons.has("Wrong number"));
  assert.ok(reasons.has("Invalid number"));
});

console.log(`${checks} agent fast-path checks passed`);
