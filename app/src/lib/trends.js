// Trend arithmetic — the "vs last week" the reference board puts under every number, and the daily
// series the line chart is drawn from.
//
// One rule holds all of it together: a comparison always names its window. "18.5%" on its own is
// the kind of figure the client already distrusts; "+18.5% from last week" can be checked.

const DAY = 24 * 60 * 60 * 1000;

/** The most recent created_at in the set — the dataset's "today", not the wall clock. */
export function latestDay(rows) {
  const times = rows.map((row) => new Date(row.created_at).getTime()).filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)) : new Date();
}

/**
 * Rows created inside the window (end - days, end].
 *
 * Inclusive at the end, exclusive at the start. Both halves matter: `latestDay()` returns the most
 * recent created_at, so an end-exclusive window would drop the newest lead out of "this week"; and
 * a start-exclusive one keeps the boundary row from being counted in both windows of a comparison.
 */
export function rowsInWindow(rows, { end, days }) {
  const stop = end.getTime();
  const start = stop - days * DAY;
  return rows.filter((row) => {
    const at = new Date(row.created_at).getTime();
    return at > start && at <= stop;
  });
}

/**
 * A percentage change against the window immediately before it.
 *
 * `measure` reduces a set of rows to one number, so the same helper covers a count, a rate or a
 * rupee total. Returns null when the previous window is empty — a change from zero is not a
 * percentage, and printing "+100%" there would be the fake number this whole product exists to
 * remove.
 */
export function changeOverWindow(rows, { measure, days = 7, end }) {
  const stop = end ?? latestDay(rows);
  const current = measure(rowsInWindow(rows, { end: stop, days }));
  const previousEnd = new Date(stop.getTime() - days * DAY);
  const previous = measure(rowsInWindow(rows, { end: previousEnd, days }));
  if (!previous) return { current, previous, change: null };
  return {
    current,
    previous,
    change: Math.round(((current - previous) / previous) * 1000) / 10,
  };
}

const LABEL = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/**
 * One point per day for the last `days` days, ending on the dataset's last day.
 *
 * Days with nothing in them are still points: a gap drawn as a straight line between two busy days
 * hides the fact that nobody worked on Sunday.
 */
export function dailySeries(rows, { days = 14, measure = (group) => group.length, end } = {}) {
  const stop = end ?? latestDay(rows);
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(stop.getTime() - i * DAY);
    buckets.set(day.toISOString().slice(0, 10), []);
  }
  for (const row of rows) {
    const key = String(row.created_at).slice(0, 10);
    if (buckets.has(key)) buckets.get(key).push(row);
  }
  return [...buckets].map(([key, group]) => ({
    label: LABEL.format(new Date(`${key}T00:00:00`)),
    value: measure(group),
  }));
}

/**
 * Counts per value of `key`, largest first, with everything past `limit` folded into "Other".
 *
 * It returns counts, not percentages: the donut divides by its own total, and two places computing
 * the same percentage is two places for them to disagree. The fold at six is not cosmetic — the
 * chart ramp has six validated steps, and a seventh would be an invented colour.
 */
export function shareOf(rows, key, { limit = 6 } = {}) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] ?? "Unspecified";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, limit - 1);
  const tail = sorted.slice(limit - 1);
  const slices = head.map(([name, value]) => ({ name, value }));
  if (tail.length) {
    slices.push({ name: "Other", value: tail.reduce((sum, [, count]) => sum + count, 0) });
  }
  return slices;
}
