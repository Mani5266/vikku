// Design-system self-check.
//
//   npm run test:design
//
// design/design.md makes claims about the charts. A claim that nothing enforces is a comment, so
// the ones that can be checked are checked here: the ramp's shape, the rule that a slice's colour
// follows its name rather than its rank, the six-step fold, and the refusal to print a percentage
// change against an empty window.
//
// The palette's colour science (monotone lightness, ΔL gaps, light-end contrast, single hue) was
// validated with the dataviz validator in ordinal mode and the result is recorded in
// src/lib/chartPalette.js. What is checked here is that nobody quietly adds a seventh step.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const load = (relative) => import(pathToFileURL(path.join(appRoot, relative)).href);

const palette = await load("src/lib/chartPalette.js");
const trends = await load("src/lib/trends.js");

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

check("the ramp is exactly the six validated steps", () => {
  assert.equal(palette.RAMP.length, 6, "a seventh step closes the gaps below the validated ΔL 0.06");
  for (const step of palette.RAMP) assert.match(step, /^#[0-9A-F]{6}$/);
  assert.equal(new Set(palette.RAMP).size, 6, "a repeated step is two categories wearing one colour");
});

check("a slice keeps its colour when the board is filtered", () => {
  // The rule from design.md: colour follows the entity, never its rank. Filtering out the biggest
  // source must not repaint the ones that survived.
  const all = ["Website", "Meta Ads", "Google Ads", "Referral", "Walk-in", "Other"];
  const before = palette.colorFor("Referral", all);
  const after = palette.colorFor("Referral", all); // same canonical list, shorter chart
  assert.equal(before, after);
  // And a different canonical order is a different, deliberate assignment — not an accident.
  assert.notEqual(palette.colorFor("Referral", ["Referral", ...all]), before);
});

check("an unknown category still gets a colour rather than undefined", () => {
  assert.match(palette.colorFor("Something new", ["Website"]), /^#/);
});

check("ordinal steps run darkest first and never repeat", () => {
  const steps = palette.ordinalSteps(5);
  assert.equal(steps.length, 5);
  assert.equal(steps[0], palette.RAMP[palette.RAMP.length - 1], "the widest funnel stage carries the most weight");
  assert.equal(new Set(steps).size, 5, "two stages sharing a step stop reading as ordered");
});

check("ordinal steps survive being asked for more than the ramp holds", () => {
  const steps = palette.ordinalSteps(9);
  assert.equal(steps.length, 9);
  for (const step of steps) assert.ok(palette.RAMP.includes(step), "never an interpolated colour");
});

check("figures are grouped the Indian way", () => {
  assert.equal(palette.formatNumber(1284), "1,284");
  assert.equal(palette.formatNumber(1336150), "13,36,150");
});

// ---- trends ---------------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const END = new Date("2026-08-18T00:00:00.000Z");
const rowsAt = (offsets) => offsets.map((d, i) => ({ id: i, created_at: new Date(END.getTime() - d * DAY).toISOString() }));

check("a day with nothing in it is still a point", () => {
  // A gap drawn as a straight line between two busy days hides the fact that nobody worked Sunday.
  const series = trends.dailySeries(rowsAt([0, 0, 3]), { days: 5, end: END });
  assert.equal(series.length, 5);
  assert.deepEqual(
    series.map((point) => point.value),
    [0, 1, 0, 0, 2]
  );
});

check("a change is measured against the window immediately before it", () => {
  // 4 leads in the last 7 days, 2 in the 7 before that.
  const rows = rowsAt([0, 1, 2, 3, 8, 9]);
  const result = trends.changeOverWindow(rows, { measure: (group) => group.length, days: 7, end: END });
  assert.equal(result.current, 4);
  assert.equal(result.previous, 2);
  assert.equal(result.change, 100);
});

check("a change against an empty window is null, never +100%", () => {
  const result = trends.changeOverWindow(rowsAt([0, 1]), { measure: (g) => g.length, days: 7, end: END });
  assert.equal(result.previous, 0);
  assert.equal(result.change, null, "printing a percentage here is exactly the fake number this product removes");
});

check("the seventh category folds into Other rather than inventing a colour", () => {
  const rows = ["a", "a", "a", "b", "b", "c", "d", "e", "f", "g"].map((source, i) => ({ id: i, source }));
  const slices = trends.shareOf(rows, "source");
  assert.equal(slices.length, 6);
  assert.equal(slices[0].name, "a");
  assert.equal(slices[slices.length - 1].name, "Other");
  assert.equal(
    slices.reduce((sum, slice) => sum + slice.value, 0),
    rows.length,
    "folding must not lose leads"
  );
});

check("shareOf returns counts, not percentages", () => {
  const slices = trends.shareOf([{ source: "a" }, { source: "a" }], "source");
  assert.deepEqual(slices, [{ name: "a", value: 2 }]);
});

// ---- the cascade trap ------------------------------------------------------------------------

check("no hand-written utility collides with a generated Tailwind colour utility", () => {
  // This one is a scar. `.text-secondary` was defined in @layer components as the 60% ink step,
  // but Tailwind also generates `text-secondary` from the `secondary` colour token, and utilities
  // sort after components — so the chart legend painted near-white text on a white card and the
  // percentages simply vanished. Nothing in the type system catches that, so it is caught here.
  const css = fs.readFileSync(path.join(appRoot, "src/index.css"), "utf8");
  const config = fs.readFileSync(path.join(appRoot, "tailwind.config.js"), "utf8");

  const colorBlock = config.slice(config.indexOf("colors: {"), config.indexOf("fontFamily:"));
  const colorKeys = [...colorBlock.matchAll(/^\s{8}([a-zA-Z]+):/gm)].map((m) => m[1]);
  assert.ok(colorKeys.includes("secondary"), "expected to have parsed the colour keys");

  const handWritten = [...css.matchAll(/^\s*\.([a-z][a-z0-9-]*)\s*\{/gm)].map((m) => m[1]);
  for (const cls of handWritten) {
    for (const prefix of ["text", "bg", "border", "ring", "fill", "stroke"]) {
      for (const key of colorKeys) {
        assert.notEqual(
          cls,
          `${prefix}-${key}`,
          `.${cls} loses the cascade to Tailwind's generated ${prefix}-${key} utility`
        );
      }
    }
  }
});

console.log(`${checks} design checks passed`);
