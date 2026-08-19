// The chart palette — one hue, six steps, validated rather than eyeballed.
//
// The rulebook allows one brand colour. A donut of six sources still has to be readable, so the
// answer is an ordinal ramp of the brand hue with a legend that carries the name and the share:
// identity never depends on telling two violets apart.
//
// Checked with the dataviz validator in ordinal mode against a white surface:
//   [PASS] Lightness monotone   steps read light→dark
//   [PASS] Adjacent ΔL          all gaps >= 0.06
//   [PASS] Light-end contrast   #B9A9FD at 2.07:1 vs surface
//   [PASS] Single hue           hue spread 16°
//
// Do not add a seventh step by interpolation: past six the gaps close below ΔL 0.06 and the ramp
// stops reading as ordered. A seventh category folds into "Other".

export const RAMP = ["#B9A9FD", "#9C86FC", "#7E5FFB", "#5438FA", "#3F22D8", "#2C16A0"];

/** The brand itself, for single-series marks. */
export const BRAND = "#5438FA";

/** The 12% ink step — gridlines and axes, the one recessive value. */
export const GRID = "rgba(23, 23, 37, 0.12)";

/** The surface the gaps and rings are drawn in. */
export const SURFACE = "#FFFFFF";

/**
 * A colour for a named category.
 *
 * The step is fixed to the name, not to the rank, so filtering a board never repaints the slices
 * that survived. `names` is the full, stable category list in its canonical order.
 */
export function colorFor(name, names) {
  const index = names.indexOf(name);
  if (index < 0) return RAMP[RAMP.length - 1];
  return RAMP[Math.min(index, RAMP.length - 1)];
}

/**
 * Steps for an ordered sequence — funnel stages, tiers, bands.
 *
 * Darkest first: the widest stage of a funnel carries the most weight, and lightening as the
 * sequence narrows keeps the eye moving down.
 */
export function ordinalSteps(count) {
  if (count <= 1) return [RAMP[3]];
  const stride = (RAMP.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => RAMP[RAMP.length - 1 - Math.round(i * stride)]);
}

/** 1,284 — never 1284. One place, so no screen invents its own. */
export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-IN");
}
