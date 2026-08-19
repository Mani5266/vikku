// Reading TRH's own weekly sheet, and saying what it cannot.
//
// Their sheet, week of 01-08-2026 to 07-08-2026: 282 leads, 270 connected, 60 reached OPD, 24
// admitted, and 222 sitting in a column they colour red themselves. Fifteen columns, and not one
// of them is *why*. No reason column. No agent column. `PERSENTAGE` reads 100% on every row, so a
// column of prime real estate does no work at all.
//
// This file does two jobs and refuses a third.
//
//   1. Parse the sheet as it actually arrives — pasted straight out of Excel, tabs, stray commas
//      in the thousands, percent signs, blank cells where a merged disease name used to be.
//   2. Say what the numbers do support: where the pending pool concentrates, what it is worth at
//      package value, and which sources are producing volume that never converts.
//   3. It will NOT invent reasons. The sheet has no reason column, so every "why" here is reported
//      as unknown. Guessing is the exact failure the product exists to remove, and a tool that
//      guesses on the sales call is a tool that gets caught on the second one.

/** A cell out of Excel: "1,234" · "81%" · "" · " 17 ". */
function num(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[,%\s₹]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Column order as it appears in their export. The parser keys off position rather than the header
 * text, because the header row carries merged cells and their own spelling (`PERSENTAGE`, and
 * `Conversion%` with and without a space) which is not stable between weeks.
 */
export const SHEET_COLUMNS = [
  "S.No",
  "DISEASE",
  "Source",
  "Total Leads",
  "PERSENTAGE",
  "Connected leads",
  "Conversion %",
  "Not Connected leads",
  "Percentage",
  "Op",
  "Conversion %",
  "Ip",
  "Conversion%",
  "Pending Follow-up",
  "Percentage",
];

const SUBTOTAL = /^(sub\s*total|total|grand\s*total)$/i;

/**
 * Parse a pasted sheet.
 *
 * Excel copies as tab-separated. The disease name is a merged cell, so it appears once per block
 * and the rows under it are blank — the parser carries the last seen name forward, which is the
 * one piece of cleanup a human would otherwise do by hand every week.
 *
 * Subtotal rows are dropped rather than summed, because their own subtotals are what the analysis
 * is being checked against.
 */
export function parseSheet(text) {
  const rows = [];
  const problems = [];
  let disease = null;

  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const [index, line] of lines.entries()) {
    const cells = line.split(/\t|\s{2,}|,(?=\s*[A-Za-z])/).map((cell) => cell.trim());
    if (cells.length < 4) continue;

    // Header rows and the date banner carry no digits in the leads position.
    const leads = num(cells[3]);
    if (leads === null) continue;
    if (/^s\.?no$/i.test(cells[0])) continue;

    const label = cells[1] || "";
    const source = cells[2] || "";

    if (SUBTOTAL.test(label) || SUBTOTAL.test(source) || SUBTOTAL.test(cells[0])) continue;
    if (label) disease = label;

    const row = {
      disease: disease || "Unspecified",
      source: source || "Unspecified",
      leads,
      connected: num(cells[5]),
      notConnected: num(cells[7]),
      op: num(cells[9]),
      ip: num(cells[11]),
      pending: num(cells[13]),
    };

    // The sheet is filled by hand, so it disagrees with itself sometimes. Say so rather than
    // silently correcting it — a tool that quietly fixes their arithmetic is a tool they stop
    // trusting the moment they notice.
    if (row.connected !== null && row.connected > row.leads) {
      problems.push(`${row.disease} / ${row.source}: connected (${row.connected}) is more than leads (${row.leads}).`);
    }
    if (row.pending !== null && row.pending > row.leads) {
      problems.push(`${row.disease} / ${row.source}: pending (${row.pending}) is more than leads (${row.leads}).`);
    }
    if (row.op !== null && row.ip !== null && row.ip > row.op) {
      problems.push(`${row.disease} / ${row.source}: admissions (${row.ip}) exceed OPD visits (${row.op}).`);
    }

    rows.push({ ...row, line: index + 1 });
  }

  return { rows, problems };
}

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/** Rupees the way the client reads them: ₹13,36,150 rather than ₹1,336,150. */
export function rupees(value) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

/**
 * The analysis the sheet cannot do.
 *
 * `packageValue` is per-disease and supplied by the caller, because guessing a hospital's package
 * prices and then printing a rupee figure in front of their MD is how a demo dies.
 */
export function diagnose(rows, { packageValue = {}, defaultPackage = 0 } = {}) {
  const totals = {
    leads: sum(rows, "leads"),
    connected: sum(rows, "connected"),
    op: sum(rows, "op"),
    ip: sum(rows, "ip"),
    pending: sum(rows, "pending"),
  };

  const valueOf = (disease) => packageValue[disease] ?? defaultPackage;

  const byDisease = [...new Set(rows.map((row) => row.disease))].map((disease) => {
    const group = rows.filter((row) => row.disease === disease);
    const pending = sum(group, "pending");
    const leads = sum(group, "leads");
    return {
      disease,
      leads,
      connected: sum(group, "connected"),
      op: sum(group, "op"),
      ip: sum(group, "ip"),
      pending,
      pendingRate: pct(pending, leads),
      admissionRate: pct(sum(group, "ip"), leads),
      pendingValue: pending * valueOf(disease),
    };
  });

  const bySource = [...new Set(rows.map((row) => row.source))].map((source) => {
    const group = rows.filter((row) => row.source === source);
    const leads = sum(group, "leads");
    const ip = sum(group, "ip");
    const pending = sum(group, "pending");
    return {
      source,
      leads,
      ip,
      pending,
      pendingRate: pct(pending, leads),
      admissionRate: pct(ip, leads),
      pendingValue: group.reduce((total, row) => total + (row.pending ?? 0) * valueOf(row.disease), 0),
    };
  });

  const pendingValue = byDisease.reduce((total, line) => total + line.pendingValue, 0);

  // Sources carrying real volume that produced nothing. Named, not ranked by rate, because a
  // source with 2 leads and 0 admissions is noise and a source with 59 is a decision.
  const deadWeight = bySource
    .filter((line) => line.leads >= 10 && line.ip === 0)
    .sort((a, b) => b.leads - a.leads);

  const worstBlock = [...byDisease].sort((a, b) => b.pending - a.pending)[0] ?? null;

  return {
    totals: {
      ...totals,
      connectedRate: pct(totals.connected, totals.leads),
      opRate: pct(totals.op, totals.leads),
      admissionRate: pct(totals.ip, totals.leads),
      pendingRate: pct(totals.pending, totals.leads),
    },
    byDisease: byDisease.sort((a, b) => b.pending - a.pending),
    bySource: bySource.sort((a, b) => b.pending - a.pending),
    pendingValue,
    deadWeight,
    worstBlock,
    /**
     * What the sheet structurally cannot answer. This is the list that sells the reason column,
     * and every line of it is a fact about the columns, not a guess about the patients.
     */
    blindSpots: [
      {
        question: "Why is any of the pending pool pending?",
        because: "There is no reason column anywhere in the sheet.",
        fix: "One column: the reason, chosen from a fixed list rather than typed.",
      },
      {
        question: "Which of the pending are still winnable?",
        because: "Without a reason there is no way to separate 'arranging money' from 'chose another hospital'.",
        fix: "Recoverable yes or no, which follows automatically once the reason is a list.",
      },
      {
        question: "Who was handling them?",
        because: "There is no agent column, so the sheet cannot tell you whether this is a lead problem or a follow-up problem.",
        fix: "Agent name on the row.",
      },
      {
        question: "How fast was the first call made?",
        because: "The sheet has no time in it at all, only counts.",
        fix: "First-response time, which the phone system already knows.",
      },
      {
        question: "What is PERSENTAGE for?",
        because: "It reads 100% on every row of the export, so it carries no information.",
        fix: "Replace it. It is already the widest unused column on the page.",
      },
    ],
  };
}

/** The sentence to open the meeting with. Built from their numbers, never from ours. */
export function headline(result) {
  const { totals } = result;
  if (!totals.leads) return null;
  return (
    `${totals.pending.toLocaleString("en-IN")} of your ${totals.leads.toLocaleString("en-IN")} leads ` +
    `(${totals.pendingRate}%) are sitting in the red column, and nobody can say why for a single one of them. ` +
    `${totals.ip.toLocaleString("en-IN")} admissions came out of the ${totals.leads.toLocaleString("en-IN")}.`
  );
}
