// CSV export. Every report table on the manager and leadership screens is
// downloadable, because the client reads reports in a spreadsheet and prints them —
// the screen is a view of the report, not a replacement for it.

/** RFC 4180 quoting: wrap when the value contains a comma, quote or newline. */
function cell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** columns: [{ key, label }] — the same array the table renders from. */
export function toCsv(columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => cell(row[c.key])).join(","));
  return [head, ...body].join("\n");
}

/**
 * Hands the browser a file. Excel opens a UTF-8 CSV correctly only with the byte
 * order mark, which is why it is prepended.
 */
export function downloadCsv(filename, columns, rows) {
  const blob = new Blob(["﻿", toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A filename that says what the report is and when it was taken. */
export function reportFilename(name, now = new Date()) {
  const stamp = new Date(now).toISOString().slice(0, 10);
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${stamp}.csv`;
}
