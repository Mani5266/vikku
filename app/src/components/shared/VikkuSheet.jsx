import React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, reportFilename } from "@/lib/csv";
import { VIKKU_COLUMNS, reportToCsvRows } from "@/lib/vikku";
import { cn } from "@/lib/utils";

// The client's sheet, replicated: ruled grid, no fills except the three the sheet itself
// uses on its subtotal row — green on the Op conversion, pink on the Ip conversion, red on
// the pending follow-up percentage. Everything else is black on white on purpose.

const CELL = "border border-neutral-400 px-2 py-1 whitespace-nowrap";
const NUM = `${CELL} text-right tabular-nums`;
const CENTER = `${CELL} text-center`;

// The sheet prints most percentages as whole numbers, and the Op conversion column with
// two decimals. Replicated, because "same format" includes the formatting.
function Percent({ value, decimals = 0 }) {
  return <>{`${Number(value).toFixed(decimals)}%`}</>;
}

function DataRow({ row, diseaseCell }) {
  return (
    <tr>
      <td className={CENTER}>{row.sno}</td>
      {diseaseCell}
      <td className={CELL}>{row.row}</td>
      <td className={NUM}>{row.totalLeads}</td>
      <td className={NUM}>
        <Percent value={row.totalPercentage} />
      </td>
      <td className={NUM}>{row.connected}</td>
      <td className={NUM}>
        <Percent value={row.connectedPct} />
      </td>
      <td className={NUM}>{row.notConnected}</td>
      <td className={NUM}>
        <Percent value={row.notConnectedPct} />
      </td>
      <td className={NUM}>{row.op}</td>
      <td className={NUM}>
        <Percent value={row.opPct} decimals={2} />
      </td>
      <td className={NUM}>{row.ip}</td>
      <td className={NUM}>
        <Percent value={row.ipPct} />
      </td>
      <td className={NUM}>{row.pending}</td>
      <td className={NUM}>
        <Percent value={row.pendingPct} />
      </td>
    </tr>
  );
}

function SubtotalRow({ row, label = "Subtotal", disease }) {
  return (
    <tr className="font-semibold">
      <td className={CENTER} />
      <td className={CENTER}>{disease}</td>
      <td className={CELL}>{label}</td>
      <td className={NUM}>{row.totalLeads}</td>
      <td className={NUM}>
        <Percent value={row.totalPercentage} />
      </td>
      <td className={NUM}>{row.connected}</td>
      <td className={NUM}>
        <Percent value={row.connectedPct} />
      </td>
      <td className={NUM}>{row.notConnected}</td>
      <td className={NUM}>
        <Percent value={row.notConnectedPct} />
      </td>
      <td className={NUM}>{row.op}</td>
      <td className={cn(NUM, "bg-green-500 text-black")}>
        <Percent value={row.opPct} decimals={2} />
      </td>
      <td className={NUM}>{row.ip}</td>
      <td className={cn(NUM, "bg-pink-200 text-black")}>
        <Percent value={row.ipPct} />
      </td>
      <td className={NUM}>{row.pending}</td>
      <td className={cn(NUM, "bg-red-600 text-white")}>
        <Percent value={row.pendingPct} />
      </td>
    </tr>
  );
}

export default function VikkuSheet({ report, download = true }) {
  const header = VIKKU_COLUMNS.map((column) => ({
    ...column,
    label: column.key === "row" ? report.dimensionLabel : column.label,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {report.leads} leads · {report.banner}
          {report.filterLabels.length ? ` · ${report.filterLabels.join(" · ")}` : ""}
        </p>
        {download && report.blocks.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(reportFilename(`vikku ${report.banner}`), header, reportToCsvRows(report))
            }
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        )}
      </div>

      {report.blocks.length === 0 ? (
        <div className="rounded border border-neutral-400 bg-white px-3 py-8 text-center text-sm text-neutral-600">
          No leads in that window.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white text-neutral-900">
          <table className="border-collapse text-[11px] leading-tight">
            {/* The banner row the sheet carries above its columns. */}
            <thead>
              <tr>
                <th className="border border-transparent" colSpan={3} />
                <th className={cn(CENTER, "font-semibold")} colSpan={7}>
                  {report.banner}
                </th>
                <th className="border border-transparent" colSpan={5} />
              </tr>
            </thead>
            <tbody>
              {report.blocks.map((block) => (
                <React.Fragment key={block.disease}>
                  <tr className="font-semibold">
                    {header.map((column) => (
                      <th key={`${block.disease}-${column.key}-${column.label}`} className={CENTER}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                  {block.rows.map((row, index) => (
                    <DataRow
                      key={`${block.disease}-${row.row}`}
                      row={row}
                      diseaseCell={
                        index === 0 ? (
                          <td className={cn(CENTER, "font-semibold")} rowSpan={block.rows.length}>
                            {block.disease}
                          </td>
                        ) : null
                      }
                    />
                  ))}
                  <SubtotalRow row={block.subtotal} disease={block.disease} />
                  {/* The sheet leaves a blank line between disease blocks. */}
                  <tr>
                    <td className="h-3 border-none" colSpan={header.length} />
                  </tr>
                </React.Fragment>
              ))}
              <tr className="font-semibold">
                {header.map((column) => (
                  <th key={`total-${column.key}-${column.label}`} className={CENTER}>
                    {column.label}
                  </th>
                ))}
              </tr>
              <SubtotalRow row={report.grandTotal} disease="ALL" label="Grand Total" />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
