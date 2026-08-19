// Converted against non-converted — Thesis §21 (conversion diagnosis), §22 (cohort
// comparison), reference/metrics.md (cohort comparison factors).
//
// §21's argument is that comparing the two cohorts is worth more than staring at the
// lost ones, because only the comparison shows what the converted patients actually
// received. The fifteen factors below are the §22 list, in the order the thesis gives
// them.
//
// L3's guard: cohorts are matched on disease before comparison, and the source mix of
// both cohorts is reported, so the table compares process rather than luck.

import { avgTouchMinutes, complianceStats, groupBy, pct } from "@/lib/funnel";
import { formatMinutes } from "@/lib/touchTime";

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

const rateOf = (rows, test) => pct(rows.filter(test).length, rows.length);

function modeOf(rows, key) {
  const groups = [...groupBy(rows, key)].sort((a, b) => b[1].length - a[1].length);
  if (!groups.length) return "—";
  const [value, group] = groups[0];
  return `${value} (${group.length})`;
}

// The fifteen §22 factors.
//
// `base` matters more than it looks. Several factors are structurally downstream of
// conversion: every converted patient booked, visited and was counselled, so comparing
// those against the whole non-converted cohort produces "100% against 6%" — arithmetic
// that is true and tells you nothing. Each factor therefore declares the population it
// is a rate *of*, and the table prints it, so the comparison stays a comparison of
// process rather than a restatement of the definition of conversion.
const FACTORS = [
  {
    key: "firstResponse",
    label: "Average first response time",
    kind: "minutes",
    lowerIsBetter: true,
    value: (rows) => avgTouchMinutes(rows),
  },
  { key: "connected", label: "Connected rate", kind: "percent", value: (rows) => rateOf(rows, (r) => r.connected) },
  {
    key: "calls",
    label: "Average number of calls",
    kind: "number",
    value: (rows) => round1(mean(rows.map((r) => r.calls_attempted))),
  },
  {
    key: "followup",
    label: "Follow-up completion",
    kind: "percent",
    value: (rows) => complianceStats(rows).rate,
  },
  {
    key: "whatsapp",
    label: "WhatsApp messages delivered (avg)",
    kind: "number",
    value: (rows) => round1(mean(rows.map((r) => r.whatsapp_sent))),
  },
  {
    key: "rcs",
    label: "RCS/MMS messages delivered (avg)",
    kind: "number",
    value: (rows) => round1(mean(rows.map((r) => r.rcs_sent))),
  },
  { key: "reply", label: "Reply rate", kind: "percent", value: (rows) => rateOf(rows, (r) => r.replies > 0) },
  {
    key: "appointment",
    label: "Appointment booking",
    kind: "percent",
    baseLabel: "of qualified leads",
    base: (r) => r.connected && r.temperature !== "Not Connected",
    value: (rows) => rateOf(rows, (r) => r.appointment_booked),
  },
  {
    key: "visit",
    label: "Patient visit",
    kind: "percent",
    baseLabel: "of booked appointments",
    base: (r) => r.appointment_booked,
    value: (rows) => rateOf(rows, (r) => r.visited),
  },
  {
    key: "confirmations",
    label: "Appointment confirmed twice",
    kind: "percent",
    baseLabel: "of booked appointments",
    base: (r) => r.appointment_booked,
    value: (rows) => rateOf(rows, (r) => r.confirmations_count >= 2),
  },
  {
    key: "doctor",
    label: "Doctor interaction",
    kind: "percent",
    baseLabel: "of booked appointments",
    base: (r) => r.appointment_booked,
    value: (rows) => rateOf(rows, (r) => r.doctor_interaction),
  },
  {
    key: "counseling",
    label: "Financial counseling completed",
    kind: "percent",
    baseLabel: "of patients advised surgery",
    base: (r) => r.surgery_advised,
    value: (rows) => rateOf(rows, (r) => r.financial_counseling_completed),
  },
  {
    key: "package",
    label: "Average quoted package",
    kind: "rupees",
    lowerIsBetter: true,
    baseLabel: "of patients advised surgery",
    base: (r) => r.surgery_advised,
    value: (rows) => {
      const quoted = rows.filter((r) => r.quoted_package);
      return quoted.length ? Math.round(mean(quoted.map((r) => r.quoted_package))) : null;
    },
  },
  {
    key: "insurance",
    label: "Insurance available",
    kind: "percent",
    baseLabel: "of patients advised surgery",
    base: (r) => r.surgery_advised,
    value: (rows) => rateOf(rows, (r) => r.insurance_available),
  },
  { key: "source", label: "Main source", kind: "text", value: (rows) => modeOf(rows, "source") },
  { key: "agent", label: "Main agent", kind: "text", value: (rows) => modeOf(rows, "agent_name") },
];

function round1(value) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function display(kind, value) {
  if (value === null || value === undefined) return "—";
  switch (kind) {
    case "minutes":
      return formatMinutes(value);
    case "percent":
      return `${value}%`;
    case "rupees":
      return `₹${Math.round(value).toLocaleString("en-IN")}`;
    default:
      return String(value);
  }
}

/**
 * The §22 table for one treatment category, or for everything when `disease` is null.
 * The non-converted cohort excludes leads still in play — comparing a finished journey
 * against an unfinished one would count pending work as failure.
 */
export function cohortComparison(rows, disease = null) {
  const scoped = disease ? rows.filter((r) => r.disease === disease) : rows;
  const converted = scoped.filter((r) => r.surgery_completed);
  const nonConverted = scoped.filter((r) => !r.surgery_completed && r.status !== "Pending");

  const factors = FACTORS.map((factor) => {
    const baseA = factor.base ? converted.filter(factor.base) : converted;
    const baseB = factor.base ? nonConverted.filter(factor.base) : nonConverted;
    const a = baseA.length ? factor.value(baseA) : null;
    const b = baseB.length ? factor.value(baseB) : null;
    let gap = "—";
    if (factor.kind !== "text" && a !== null && b !== null) {
      const delta = round1(a - b);
      const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
      gap = `${sign}${display(factor.kind, Math.abs(delta))}`;
    }
    return {
      factor: factor.label,
      base: factor.baseLabel || "of all leads in the cohort",
      convertedBase: baseA.length,
      nonConvertedBase: baseB.length,
      converted: display(factor.kind, a),
      nonConverted: display(factor.kind, b),
      gap,
      favoursConverted:
        factor.kind === "text" || a === null || b === null
          ? null
          : factor.lowerIsBetter
            ? a < b
            : a > b,
    };
  });

  return {
    disease: disease || "All treatment categories",
    convertedCount: converted.length,
    nonConvertedCount: nonConverted.length,
    // The guard: both mixes are reported, so a gap cannot be read as process when it is
    // really a difference in what each cohort was made of.
    convertedSourceMix: sourceMixLabel(converted),
    nonConvertedSourceMix: sourceMixLabel(nonConverted),
    factors,
    patterns: patterns(converted, nonConverted),
  };
}

function sourceMixLabel(rows) {
  return (
    [...groupBy(rows, "source")]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([source, group]) => `${source} ${pct(group.length, rows.length)}%`)
      .join(" · ") || "—"
  );
}

/**
 * The two generated narratives L3 asks for. Each line is a count, not an adjective:
 * "41 of 51 converted patients had financial counseling completed" is checkable, and
 * the same sentence about a hunch is not.
 */
function patterns(converted, nonConverted) {
  const lines = (rows, tests) =>
    tests
      .map(({ label, test }) => {
        const matched = rows.filter(test).length;
        return { label, leads: matched, share: pct(matched, rows.length) };
      })
      .filter((line) => line.leads > 0)
      .sort((a, b) => b.share - a.share);

  const conversion = lines(converted, [
    { label: "First call inside the 5-minute SLA", test: (r) => r.first_touch_minutes !== null && r.first_touch_minutes <= 5 },
    { label: "Full scheduled follow-up completed", test: (r) => r.followup_compliant },
    { label: "Doctor profile sent during nurturing", test: (r) => r.doctor_profile_sent },
    { label: "Financial counseling completed before booking", test: (r) => r.financial_counseling_completed },
    { label: "Appointment confirmed twice", test: (r) => r.confirmations_count >= 2 },
    { label: "Insurance approved", test: (r) => r.insurance_approved },
    { label: "Seven-part remark complete on the qualifying call", test: (r) => r.remark_complete },
  ]);

  const nonConversion = lines(nonConverted, [
    { label: "First call delayed beyond 4 hours", test: (r) => r.first_touch_minutes === null || r.first_touch_minutes > 240 },
    { label: "Scheduled follow-up incomplete", test: (r) => !r.followup_compliant },
    { label: "No RCS/MMS content sent at all", test: (r) => r.rcs_sent === 0 },
    { label: "Remark missing parts of the seven-part structure", test: (r) => !r.remark_complete },
    { label: "Surgery advised but financial counseling never completed", test: (r) => r.surgery_advised && !r.financial_counseling_completed },
    { label: "Appointment booked but never confirmed", test: (r) => r.appointment_booked && r.confirmations_count === 0 },
    { label: "No-show that was never recovered", test: (r) => r.no_show && !r.no_show_recovered },
  ]);

  return { conversion, nonConversion };
}

/** Treatment categories with enough finished journeys on both sides to compare. */
export function comparableDiseases(rows, minimum = 3) {
  return [...groupBy(rows, "disease")]
    .filter(([, group]) => group.filter((r) => r.surgery_completed).length >= minimum)
    .map(([disease]) => disease)
    .sort();
}
