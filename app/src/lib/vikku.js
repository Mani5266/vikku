// Vikku AI — the manager's report engine.
//
// One output format, and only one: the disease-block sheet the client already reads,
// replicated column for column. Whatever the manager asks, the answer comes back in that
// grid — a date-range banner, one row per source inside each disease, and a subtotal row
// per disease. Nothing is added to it, because the whole point is that the manager does
// not have to learn a new report.
//
// Column formulas, taken from the client's own sheet rather than invented:
//
//   PERSENTAGE            total ÷ total, so always 100% (their column, their spelling)
//   Conversion % (conn)   connected ÷ total leads
//   Percentage (not conn) not connected ÷ total leads
//   Conversion % (Op)     Op ÷ connected leads
//   Conversion% (Ip)      Ip ÷ Op
//   Pending Follow-up     total leads − Op
//   Percentage (pending)  pending ÷ total leads
//
// Parsing is a keyword grammar, same as queryEngine.js — not a model call. The scope it
// read is printed above every answer so a wrong table is a misread question.

import { pct } from "@/lib/funnel";

const DAY = 24 * 60 * 60 * 1000;

/** The row dimension inside each disease block. Source is what the sheet uses. */
const ROW_DIMENSIONS = [
  { key: "source", label: "Source", words: ["source wise", "source-wise", "by source", "channel"] },
  { key: "agent_name", label: "Agent", words: ["agent wise", "agent-wise", "by agent", "telecaller"] },
  { key: "campaign", label: "Campaign", words: ["campaign wise", "campaign-wise", "by campaign"] },
  { key: "branch", label: "Branch", words: ["branch wise", "branch-wise", "by branch", "centre", "center"] },
];

const WINDOWS = [
  { days: 1, words: ["today"] },
  { days: 2, words: ["yesterday"] },
  { days: 7, words: ["last week", "last 7 days", "past week", "this week", "weekly"] },
  { days: 15, words: ["last 15 days", "fortnight", "15 day", "15 days"] },
  { days: 30, words: ["last 30 days", "last month", "this month", "monthly"] },
  { days: 90, words: ["last 90 days", "quarter", "90 days", "three months"] },
];

const DATE_RANGE =
  /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\s*(?:to|-|until|till|through)\s*(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/i;

const pad = (value) => String(value).padStart(2, "0");

/** 01-08-2026 — the banner format the client's sheet uses. */
export function formatSheetDate(date) {
  const d = new Date(date);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Reads a manager's question into a scope. Everything unmatched falls back to defaults. */
export function parseAsk(question, rows, now = new Date()) {
  const q = (question || "").toLowerCase();
  const scope = {
    question,
    from: null,
    to: new Date(now),
    windowDays: 7,
    windowLabel: "last 7 days",
    rowDimension: "source",
    filters: [],
  };

  const explicit = q.match(DATE_RANGE);
  if (explicit) {
    const [, d1, m1, y1, d2, m2, y2] = explicit;
    const year = (value) => (value.length === 2 ? 2000 + Number(value) : Number(value));
    scope.from = new Date(year(y1), Number(m1) - 1, Number(d1));
    scope.to = new Date(year(y2), Number(m2) - 1, Number(d2), 23, 59, 59);
    scope.windowDays = null;
    scope.windowLabel = `${formatSheetDate(scope.from)} to ${formatSheetDate(scope.to)}`;
  } else {
    for (const window of WINDOWS) {
      if (window.words.some((w) => q.includes(w))) {
        scope.windowDays = window.days;
        scope.windowLabel = window.words[0];
        break;
      }
    }
    scope.from = new Date(new Date(now).getTime() - scope.windowDays * DAY);
  }

  for (const dimension of ROW_DIMENSIONS) {
    if (dimension.words.some((w) => q.includes(w))) {
      scope.rowDimension = dimension.key;
      break;
    }
  }

  // Value filters. Diseases narrow which blocks appear; everything else narrows the rows.
  const values = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))];
  for (const key of ["disease", "source", "agent_name", "branch", "campaign"]) {
    for (const value of values(key)) {
      const needle = String(value).toLowerCase();
      const firstWord = needle.split(/[\s—-]+/)[0];
      const partialAllowed = key !== "campaign" || q.includes("campaign");
      if (q.includes(needle) || (partialAllowed && firstWord.length > 3 && q.includes(firstWord))) {
        scope.filters.push({ key, value });
        break;
      }
    }
  }

  return scope;
}

function applyScope(rows, scope) {
  const from = new Date(scope.from).getTime();
  const to = new Date(scope.to).getTime();
  let out = rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return t >= from && t <= to;
  });
  for (const filter of scope.filters) {
    if (filter.key === "disease") continue; // handled as block selection
    out = out.filter((r) => r[filter.key] === filter.value);
  }
  return out;
}

/** The sheet's fifteen columns, in the sheet's order and with the sheet's spelling. */
export const VIKKU_COLUMNS = [
  { key: "sno", label: "S.No" },
  { key: "disease", label: "DISEASE" },
  { key: "row", label: "Source" },
  { key: "totalLeads", label: "Total Leads" },
  { key: "totalPercentage", label: "PERSENTAGE" },
  { key: "connected", label: "Connected leads" },
  { key: "connectedPct", label: "Conversion %" },
  { key: "notConnected", label: "Not Connected leads" },
  { key: "notConnectedPct", label: "Percentage" },
  { key: "op", label: "Op" },
  { key: "opPct", label: "Conversion %" },
  { key: "ip", label: "Ip" },
  { key: "ipPct", label: "Conversion%" },
  { key: "pending", label: "Pending Follow-up" },
  { key: "pendingPct", label: "Percentage" },
];

function line(label, group) {
  const totalLeads = group.length;
  const connected = group.filter((r) => r.connected).length;
  const notConnected = totalLeads - connected;
  const op = group.filter((r) => r.op_visit).length;
  const ip = group.filter((r) => r.ip_admit).length;
  const pending = totalLeads - op;

  return {
    row: label,
    totalLeads,
    totalPercentage: totalLeads ? 100 : 0,
    connected,
    connectedPct: pct(connected, totalLeads),
    notConnected,
    notConnectedPct: pct(notConnected, totalLeads),
    op,
    opPct: pct(op, connected),
    ip,
    ipPct: pct(ip, op),
    pending,
    pendingPct: pct(pending, totalLeads),
  };
}

/**
 * The answer: one block per disease, rows by the chosen dimension, a subtotal per block,
 * and a grand total. Blocks with no leads in the window are dropped rather than shown
 * empty — the client's sheet does not carry empty diseases either.
 */
export function buildVikkuReport(question, rows, now = new Date()) {
  const scope = parseAsk(question, rows, now);
  const scoped = applyScope(rows, scope);

  const diseaseFilter = scope.filters.find((f) => f.key === "disease");
  const diseases = [...new Set(scoped.map((r) => r.disease))]
    .filter((disease) => !diseaseFilter || disease === diseaseFilter.value)
    .sort();

  const blocks = diseases
    .map((disease) => {
      const group = scoped.filter((r) => r.disease === disease);
      const dimensionValues = [...new Set(group.map((r) => r[scope.rowDimension]))].sort();
      const lines = dimensionValues
        .map((value, index) => ({
          sno: index + 1,
          ...line(value, group.filter((r) => r[scope.rowDimension] === value)),
        }))
        .filter((entry) => entry.totalLeads > 0)
        .sort((a, b) => b.totalLeads - a.totalLeads)
        .map((entry, index) => ({ ...entry, sno: index + 1 }));

      return {
        disease: disease.toUpperCase(),
        rows: lines,
        subtotal: { sno: "", ...line("Subtotal", group) },
      };
    })
    .filter((block) => block.rows.length > 0)
    .sort((a, b) => b.subtotal.totalLeads - a.subtotal.totalLeads);

  const dimensionLabel = ROW_DIMENSIONS.find((d) => d.key === scope.rowDimension).label;

  return {
    scope,
    dimensionLabel,
    banner: `${formatSheetDate(scope.from)} TO ${formatSheetDate(scope.to)}`,
    blocks,
    grandTotal: { sno: "", ...line("Grand Total", scoped) },
    leads: scoped.length,
    filterLabels: scope.filters.map((f) => `${f.key.replace("_name", "")} = ${f.value}`),
  };
}

// Percentage columns, and how many decimals the sheet prints each one with.
const PERCENT_COLUMNS = {
  totalPercentage: 0,
  connectedPct: 0,
  notConnectedPct: 0,
  opPct: 2,
  ipPct: 0,
  pendingPct: 0,
};

function formatted(row) {
  const out = { ...row };
  for (const [key, decimals] of Object.entries(PERCENT_COLUMNS)) {
    if (out[key] !== undefined) out[key] = `${Number(out[key]).toFixed(decimals)}%`;
  }
  return out;
}

/** The same grid, flattened for the CSV so the download and the screen match exactly. */
export function reportToCsvRows(report) {
  const out = [];
  for (const block of report.blocks) {
    block.rows.forEach((row, index) => {
      out.push(formatted({ ...row, disease: index === 0 ? block.disease : "" }));
    });
    out.push(formatted({ ...block.subtotal, disease: block.disease, row: "Subtotal" }));
  }
  out.push(formatted({ ...report.grandTotal, disease: "ALL", row: "Grand Total" }));
  return out;
}

export const VIKKU_SUGGESTIONS = [
  "Last week report",
  "Piles last 15 days",
  "Agent wise last 30 days",
  "01-08-2026 to 07-08-2026",
  "Meta Ads last month",
  "Branch wise last week",
];
