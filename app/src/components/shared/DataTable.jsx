import React from "react";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, reportFilename } from "@/lib/csv";
import { cn } from "@/lib/utils";

// The report table.
//
// White card, one shadow, no container stroke. Inside the table there is exactly one divider
// value — the 12% step — because fifteen columns of figures cannot be read without row
// separation; that is the single sanctioned exception to the no-strokes rule, and it is the
// same divider everywhere.
//
// Figures are monospaced, tabular and thousands-separated (12,761 — never 12761). Columns
// size to their content and the container scrolls, so a label never wraps to keep a table
// inside a viewport. No fills, no colour coding: these are read printed and in Excel.
//
// The download writes the same columns and rows being rendered, so the file and the screen
// cannot disagree.

/** 12,761 rather than 12761. Strings and pre-formatted values pass through untouched. */
function present(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return String(value);
}

export default function DataTable({
  title,
  caption,
  columns,
  rows,
  empty = "Nothing to show yet.",
  emptyAction,
  download = true,
  footer,
  className,
}) {
  return (
    <section className={cn("card-surface overflow-hidden", className)}>
      {(title || download) && (
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {caption && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{caption}</p>}
          </div>
          {download && rows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCsv(reportFilename(title || "report"), columns, rows)}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
        </div>
      )}

      <div className="scroll-slim max-h-[36rem] overflow-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-secondary">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap border-b border-border px-4 py-2 text-left text-xs font-semibold text-muted-foreground",
                    column.align === "right" && "text-right"
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? row.value ?? index} className="border-b border-border last:border-0">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-2 align-top",
                      column.align === "right" ? "num whitespace-nowrap text-right" : "max-w-[26rem]"
                    )}
                  >
                    {present(row[column.key]) ?? <span className="text-placeholder">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  {/* Empty is a designed state with a next move, never bare grey text. */}
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
                    <p className="text-sm font-semibold">{empty}</p>
                    {emptyAction}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {footer && (
            <tfoot className="sticky bottom-0 bg-secondary font-semibold">
              <tr>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "border-t border-border px-4 py-2",
                      column.align === "right" && "num whitespace-nowrap text-right"
                    )}
                  >
                    {present(footer[column.key]) ?? ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

// Tone is meaning, not decoration: red for a breach, green for a figure that beat its
// benchmark, amber for something pending. Everything else stays neutral.
const TONE = {
  default: "text-foreground",
  bad: "text-destructive",
  good: "text-success",
  warn: "text-warning",
};

/**
 * One number with its label — the tile above every report table.
 *
 * The contract, taken from the reference board: label, value, and then either a delta against a
 * named period or a detail line. Three things, never four.
 *
 *   · `icon` renders a 40px brand-tint chip. It is decoration with a job: four tiles in a row are
 *     only scannable as four different things if they look like four different things.
 *   · `delta` is a signed percentage. Its colour is direction × whether up is good, which is why
 *     `deltaGood` exists — a rising cost per surgery is red, a falling missed-follow-up count is
 *     green. Direction alone never decides the colour.
 *   · the value uses proportional figures, not tabular. `tabular-nums` gives every digit the width
 *     of a zero, which makes a standalone 121 look gappy at this size; tabular is for columns.
 */
export function StatTile({
  label,
  value,
  detail,
  tone = "default",
  icon: Icon,
  delta = null,
  deltaLabel = "from last week",
  deltaGood = "up",
}) {
  const rising = typeof delta === "number" && delta > 0;
  const flat = typeof delta === "number" && delta === 0;
  const helpful = deltaGood === "up" ? rising : !rising;
  const Arrow = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="card-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-tint text-primary">
            <Icon className="h-6 w-6" />
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-xl font-semibold", TONE[tone])}>{value}</p>
      {typeof delta === "number" && (
        <p className="mt-2 flex items-center gap-1 text-xs">
          {!flat && <Arrow className={cn("h-4 w-4", helpful ? "text-success" : "text-destructive")} />}
          <span
            className={cn(
              "num font-semibold",
              flat ? "text-muted-foreground" : helpful ? "text-success" : "text-destructive"
            )}
          >
            {flat ? "No change" : `${rising ? "+" : ""}${delta}%`}
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </p>
      )}
      {/* The delta says which way it moved; the detail says what the number is made of. The client's
          whole complaint is about figures with nothing under them, so both stay. */}
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
