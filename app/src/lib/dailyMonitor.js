// M2. Daily Conversion Monitor — Thesis §31 (the manager's daily working pattern),
// §26 (funnel metrics).
//
// One question: is today tracking, and if not, where is it leaking?
//
// Two rules shape everything here, and both come from the specification's guards:
//
//   1. A comparison always names its window. Eleven metrics are reported against the
//      trailing 7-day and 30-day averages of the *same* metric, never against a target
//      somebody typed. §5 is explicit that a lead count on its own is not a quality
//      judgement, so no absolute number is returned without the two averages beside it.
//   2. The reporting day is the last *complete* day. The dataset's newest day is the day
//      the export was taken, and it is nearly always a part-day — 2 leads against a
//      trailing median of 17. Reporting on it would print "leads in, down 88%" every
//      morning, which is the fake alarm this product exists to remove. The partial day is
//      named on screen rather than silently dropped.

import { pct } from "./funnel.js";

const DAY = 24 * 60 * 60 * 1000;
const iso = (date) => date.toISOString().slice(0, 10);

/** Rows created on one calendar day, keyed the way the dataset stores them. */
export function rowsOnDay(rows, day) {
  return rows.filter((row) => String(row.created_at).slice(0, 10) === day);
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * A day carrying less than this share of the trailing fortnight's median intake is treated
 * as still being filled. The threshold is a judgement, not a fact, which is why it is named
 * here rather than buried: a genuinely terrible day looks like a partial one, so the screen
 * prints both counts and lets a manager tell them apart.
 */
export const PARTIAL_DAY_SHARE = 0.4;

/** Which day the monitor reports on, and which day it stepped over to get there. */
export function reportingDay(rows) {
  const days = [...new Set(rows.map((row) => String(row.created_at).slice(0, 10)))].sort();
  if (!days.length) return { day: null, partialDay: null, partialCount: 0, typicalCount: 0 };

  const newest = days[days.length - 1];
  const trailing = days.slice(-15, -1).map((day) => rowsOnDay(rows, day).length);
  const typical = median(trailing);
  const newestCount = rowsOnDay(rows, newest).length;

  if (typical && newestCount < typical * PARTIAL_DAY_SHARE && days.length > 1) {
    return {
      day: days[days.length - 2],
      partialDay: newest,
      partialCount: newestCount,
      typicalCount: typical,
    };
  }
  return { day: newest, partialDay: null, partialCount: 0, typicalCount: typical };
}

/**
 * The eleven §31 metrics. Each carries how it is measured, because "connected rate" means
 * three different things in three different hospitals and the client's whole complaint is
 * about numbers with nothing under them.
 *
 * `measure` returns null when the metric has no base in the cohort — a confirmation rate
 * over zero appointments is not 0%, it is "nothing booked", and the screen says so.
 */
export const DAILY_METRICS = [
  {
    key: "leads",
    label: "Leads in",
    unit: "count",
    basis: "Leads created on the day",
    measure: (rows) => rows.length,
  },
  {
    key: "connected",
    label: "Connected rate",
    unit: "percent",
    basis: "Of the day's leads, the share reached on the phone at least once",
    measure: (rows) => (rows.length ? pct(rows.filter((r) => r.connected).length, rows.length) : null),
  },
  {
    key: "firstResponse",
    label: "First response, median",
    unit: "minutes",
    goodDirection: "down",
    basis: "Minutes from arrival to the first contact attempt, median across the day's contacted leads",
    measure: (rows) => {
      const touched = rows.map((r) => r.first_touch_minutes).filter((m) => typeof m === "number");
      return touched.length ? Math.round(median(touched)) : null;
    },
  },
  {
    key: "hot",
    label: "Hot generated",
    unit: "count",
    basis: "Leads the agent graded Hot",
    measure: (rows) => rows.filter((r) => r.temperature === "Hot").length,
  },
  {
    key: "booked",
    label: "Appointments booked",
    unit: "count",
    basis: "Of the day's cohort, how many reached a booked appointment",
    measure: (rows) => rows.filter((r) => r.appointment_booked).length,
  },
  {
    key: "confirmed",
    label: "Appointments confirmed",
    unit: "count",
    basis: "Booked appointments confirmed before the slot",
    measure: (rows) => rows.filter((r) => r.appointment_confirmed).length,
  },
  {
    key: "visits",
    label: "Visits",
    unit: "count",
    basis: "Patients who actually arrived",
    measure: (rows) => rows.filter((r) => r.visited).length,
  },
  {
    key: "consultations",
    label: "Consultations completed",
    unit: "count",
    basis: "Arrivals that finished a consultation",
    measure: (rows) => rows.filter((r) => r.consultation_completed).length,
  },
  {
    key: "advised",
    label: "Surgery advised",
    unit: "count",
    basis: "Consultations that ended in a surgical recommendation",
    measure: (rows) => rows.filter((r) => r.surgery_advised).length,
  },
  {
    key: "surgeryBooked",
    label: "Surgery booked",
    unit: "count",
    basis: "Advised patients who booked a date",
    measure: (rows) => rows.filter((r) => r.surgery_booked).length,
  },
  {
    key: "revenue",
    label: "Revenue recorded",
    unit: "rupees",
    basis: "Package value of completed surgeries traced back to the day's cohort",
    measure: (rows) => rows.reduce((sum, r) => sum + (r.revenue || 0), 0),
  },
];

/** The trailing average of a metric over the `days` days ending the day before `day`. */
function trailingAverage(rows, metric, day, days) {
  const end = new Date(`${day}T00:00:00Z`).getTime();
  const values = [];
  for (let i = 1; i <= days; i++) {
    const group = rowsOnDay(rows, iso(new Date(end - i * DAY)));
    if (!group.length) continue;
    const value = metric.measure(group);
    if (value !== null) values.push(value);
  }
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return metric.unit === "percent" || metric.unit === "minutes"
    ? Math.round(mean * 10) / 10
    : Math.round(mean);
}

const changeAgainst = (today, baseline) =>
  baseline === null || !baseline ? null : Math.round(((today - baseline) / baseline) * 1000) / 10;

/**
 * How far off the 7-day average a metric has to be before the monitor calls it. A dashboard
 * that flags every wobble is a dashboard nobody reads by the second week.
 */
export const TOLERANCE_PERCENT = 15;

/** Today against the trailing 7-day and 30-day averages, one line per metric. */
export function dailyScorecard(rows, { day } = {}) {
  const on = day ?? reportingDay(rows).day;
  const cohort = rowsOnDay(rows, on);

  return DAILY_METRICS.map((metric) => {
    const today = metric.measure(cohort);
    const week = trailingAverage(rows, metric, on, 7);
    const month = trailingAverage(rows, metric, on, 30);
    const change = today === null ? null : changeAgainst(today, week);
    const goodDirection = metric.goodDirection ?? "up";

    let verdict = "normal";
    if (change !== null && Math.abs(change) > TOLERANCE_PERCENT) {
      const helping = goodDirection === "up" ? change > 0 : change < 0;
      verdict = helping ? "ahead" : "behind";
    }

    return {
      key: metric.key,
      value: metric.label,
      unit: metric.unit,
      basis: metric.basis,
      goodDirection,
      today,
      week,
      month,
      change,
      verdict,
      base: cohort.length,
    };
  });
}

/**
 * Where the day's cohort is stalling relative to normal. Each rung is the share of the day's
 * leads that got that far, set against the same share across the trailing thirty days. Read
 * downwards: the first rung whose gap goes badly negative is where today is leaking.
 */
export const STAGE_RUNGS = [
  { key: "connected", label: "Connected", reached: (r) => r.connected },
  { key: "qualified", label: "Graded Hot or Warm", reached: (r) => ["Hot", "Warm"].includes(r.temperature) },
  { key: "booked", label: "Appointment booked", reached: (r) => r.appointment_booked },
  { key: "confirmed", label: "Appointment confirmed", reached: (r) => r.appointment_confirmed },
  { key: "visited", label: "Patient arrived", reached: (r) => r.visited },
  { key: "advised", label: "Surgery advised", reached: (r) => r.surgery_advised },
  { key: "surgeryBooked", label: "Surgery booked", reached: (r) => r.surgery_booked },
];

export function stageDropStrip(rows, { day, baselineDays = 30 } = {}) {
  const on = day ?? reportingDay(rows).day;
  const cohort = rowsOnDay(rows, on);
  const end = new Date(`${on}T00:00:00Z`).getTime();
  const baseline = rows.filter((row) => {
    const at = new Date(row.created_at).getTime();
    return at < end && at >= end - baselineDays * DAY;
  });

  return STAGE_RUNGS.map((rung) => {
    const todayShare = cohort.length ? pct(cohort.filter(rung.reached).length, cohort.length) : null;
    const normalShare = baseline.length ? pct(baseline.filter(rung.reached).length, baseline.length) : null;
    const gap = todayShare === null || normalShare === null ? null : Math.round((todayShare - normalShare) * 10) / 10;
    return {
      key: rung.key,
      value: rung.label,
      reached: cohort.filter(rung.reached).length,
      todayShare,
      normalShare,
      gap,
      // Tone sits on the gap and never on the raw share. A 4% booking rate is not bad news
      // if 4% is what every day looks like.
      tone: gap === null ? "default" : gap <= -5 ? "bad" : gap >= 5 ? "good" : "default",
    };
  });
}

/** Which rung is leaking worst today — the one line the manager acts on. */
export function worstRung(strip) {
  return strip.filter((rung) => rung.gap !== null && rung.gap < 0).sort((a, b) => a.gap - b.gap)[0] ?? null;
}

/**
 * The day's top closure reasons, and how many of them the §23 taxonomy says are still
 * winnable. Reasons come off each lead's own closure record — nothing here is inferred.
 */
export function dropReasonsForDay(rows, { day, limit = 5 } = {}) {
  const on = day ?? reportingDay(rows).day;
  const cohort = rowsOnDay(rows, on).filter((row) => row.loss_reason);
  const counts = new Map();
  for (const row of cohort) {
    const key = `${row.loss_category} — ${row.loss_reason}`;
    const entry =
      counts.get(key) ?? { value: key, category: row.loss_category, reason: row.loss_reason, leads: 0, recoverable: 0 };
    entry.leads += 1;
    if (row.recoverable) entry.recoverable += 1;
    counts.set(key, entry);
  }
  const ranked = [...counts.values()].sort((a, b) => b.leads - a.leads).slice(0, limit);
  return {
    closed: cohort.length,
    recoverable: cohort.filter((row) => row.recoverable).length,
    reasons: ranked.map((entry) => ({ ...entry, share: pct(entry.leads, cohort.length) })),
  };
}
