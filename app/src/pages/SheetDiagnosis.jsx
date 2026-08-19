import React, { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { BarList } from "@/components/shared/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { diagnose, headline, parseSheet, rupees } from "@/lib/sheetDiagnosis";

// M11. Weekly Sheet Diagnosis — their own numbers in, the question the sheet cannot answer out.
//
// Every other screen in this app runs on generated journeys. This one runs on the hospital's real
// weekly export, pasted straight out of Excel, which makes it the only screen that can be shown in
// a meeting without the words "this is sample data".
//
// It is deliberately not a CRM feature. Nobody has to change how they work for it to be useful,
// which is the whole point: it earns the meeting that earns the rollout.

const SAMPLE = `S.No\tDISEASE\tSource\tTotal Leads\tPERSENTAGE\tConnected leads\tConversion %\tNot Connected leads\tPercentage\tOp\tConversion %\tIp\tConversion%\tPending Follow-up\tPercentage
1\tCIRCUM\tYoutube\t94\t100%\t94\t100%\t0\t0%\t23\t24.00%\t11\t48%\t71\t76%
2\t\tDOUBLE TICK\t59\t100%\t59\t100%\t0\t0%\t4\t7.00%\t1\t25%\t55\t93%
3\t\tWebsite\t17\t100%\t17\t100%\t0\t0%\t5\t29.00%\t4\t80%\t12\t71%
4\t\tGOOGLE\t2\t100%\t2\t100%\t0\t0%\t1\t50.00%\t1\t100%\t1\t50%
\t\tSubtotal\t172\t100%\t172\t100%\t0\t0%\t33\t19.00%\t17\t52%\t139\t81%
1\tPILES\tYoutube\t35\t100%\t29\t83%\t6\t17%\t5\t17.00%\t2\t40%\t30\t86%
2\t\tWebsite\t4\t100%\t3\t75%\t1\t25%\t1\t25.00%\t0\t0%\t3\t75%
3\t\tGoogle\t4\t100%\t4\t100%\t0\t0%\t3\t75.00%\t2\t67%\t1\t25%
4\t\tSuman TV\t6\t100%\t6\t100%\t0\t0%\t1\t17.00%\t1\t100%\t5\t83%
1\tGYNIC\tYoutube\t1\t100%\t1\t100%\t0\t0%\t0\t0%\t0\t0%\t1\t100%
2\t\tSuman TV\t6\t100%\t6\t100%\t0\t0%\t1\t17%\t0\t0%\t5\t83%
3\t\tWebsite\t7\t100%\t7\t100%\t0\t0%\t3\t43%\t0\t0%\t4\t57%
4\t\tMETA\t2\t100%\t2\t100%\t0\t0%\t0\t0%\t0\t0%\t2\t100%
5\t\tGOOGLE\t1\t100%\t1\t100%\t0\t0%\t0\t0%\t0\t0%\t1\t100%
1\tVARICOSE\tYoutube\t13\t100%\t11\t85%\t2\t15%\t5\t45.00%\t1\t20%\t8\t62%
2\t\tWebsite\t29\t100%\t26\t90%\t3\t10%\t8\t31.00%\t1\t13%\t21\t72%
3\t\tTV\t2\t100%\t2\t100%\t0\t0%\t0\t0.00%\t0\t0%\t2\t100%`;

export default function SheetDiagnosis() {
  const [text, setText] = useState("");
  const [packages, setPackages] = useState({});

  const parsed = useMemo(() => parseSheet(text), [text]);
  const diseases = useMemo(() => [...new Set(parsed.rows.map((row) => row.disease))], [parsed.rows]);

  const result = useMemo(() => {
    if (!parsed.rows.length) return null;
    const packageValue = Object.fromEntries(
      Object.entries(packages).map(([disease, value]) => [disease, Number(value) || 0])
    );
    return diagnose(parsed.rows, { packageValue });
  }, [parsed.rows, packages]);

  const priced = result && Object.values(packages).some((value) => Number(value) > 0);

  return (
    <>
      <PageHeader
        screen="M11"
        title="Weekly Sheet Diagnosis"
        subtitle="Paste the hospital's own weekly sheet. This screen says what those fifteen columns cannot."
        thesis="§2, §18, §19, §23"
      />

      <div className="space-y-6 p-4">
        <SectionCard
          title="Paste the sheet"
          caption="Select the rows in Excel and paste. Merged disease cells, thousands separators, percent signs and subtotal rows are all handled — no cleanup needed."
          control={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setText(SAMPLE)}>
                <ClipboardPaste className="h-4 w-4" />
                Load the 01-08 to 07-08 week
              </Button>
              {text && (
                <Button variant="outline" size="sm" onClick={() => setText("")}>
                  Clear
                </Button>
              )}
            </div>
          }
        >
          <Textarea
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste here. Anything the parser cannot read is listed below rather than silently dropped."
          />
          {text && (
            <p className="mt-2 text-xs text-muted-foreground">
              {`${parsed.rows.length} source rows read across ${diseases.length} disease blocks. Subtotal rows are ignored so this can be checked against their own subtotals.`}
            </p>
          )}
        </SectionCard>

        {parsed.problems.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-4">
            <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold">The sheet disagrees with itself in {parsed.problems.length} place(s)</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {parsed.problems.map((problem) => (
                  <li key={problem}>· {problem}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Reported rather than corrected. A tool that quietly fixes their arithmetic is a tool
                they stop trusting the moment they notice.
              </p>
            </div>
          </div>
        )}

        {result && (
          <>
            <SectionCard title="The sentence to open the meeting with">
              <p className="text-lg font-semibold">{headline(result)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Every number in that sentence is theirs. Nothing here is computed from sample data.
              </p>
            </SectionCard>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Leads in the week" value={result.totals.leads.toLocaleString("en-IN")} detail={`${result.totals.connectedRate}% connected`} />
              <StatTile
                label="Pending follow-up"
                value={result.totals.pending.toLocaleString("en-IN")}
                tone="bad"
                detail={`${result.totals.pendingRate}% of every lead, none with a recorded reason`}
              />
              <StatTile label="Reached OPD" value={result.totals.op.toLocaleString("en-IN")} detail={`${result.totals.opRate}% of leads`} />
              <StatTile
                label="Admitted"
                value={result.totals.ip.toLocaleString("en-IN")}
                detail={`${result.totals.admissionRate} per 100 leads`}
                tone={result.totals.admissionRate >= 12 ? "good" : "bad"}
              />
            </div>

            <SectionCard
              title="Where the pending pool sits"
              caption="Blocks ranked by how many leads are parked in them, largest first."
            >
              <BarList data={result.byDisease.map((line) => ({ name: line.disease, value: line.pending }))} />
            </SectionCard>

            <DataTable
              title="By disease block"
              caption="Checked against their own subtotal rows — the parser ignores those, so the two should agree."
              columns={[
                { key: "disease", label: "Disease" },
                { key: "leads", label: "Leads", align: "right" },
                { key: "connected", label: "Connected", align: "right" },
                { key: "op", label: "OPD", align: "right" },
                { key: "ip", label: "Admitted", align: "right" },
                { key: "pending", label: "Pending", align: "right" },
                { key: "pendingRate", label: "Pending %", align: "right" },
                { key: "admissionRate", label: "Admission %", align: "right" },
                ...(priced ? [{ key: "value", label: "Pending at package value", align: "right" }] : []),
              ]}
              rows={result.byDisease.map((line) => ({
                ...line,
                value: priced ? rupees(line.pendingValue) : null,
              }))}
            />

            <DataTable
              title="By source"
              caption="The MD funds these. This is the table that says which spend produced nothing."
              columns={[
                { key: "source", label: "Source" },
                { key: "leads", label: "Leads", align: "right" },
                { key: "ip", label: "Admitted", align: "right" },
                { key: "admissionRate", label: "Admission %", align: "right" },
                { key: "pending", label: "Pending", align: "right" },
                { key: "pendingRate", label: "Pending %", align: "right" },
              ]}
              rows={result.bySource}
            />

            {result.deadWeight.length > 0 && (
              <SectionCard
                title="Volume that produced no admission at all"
                caption="Ten or more leads, zero admissions, in one week. Not proof the source is bad — it is proof nobody can currently tell you whether it is bad, which is the argument."
              >
                <ul className="space-y-2">
                  {result.deadWeight.map((line) => (
                    <li key={line.source} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold">{line.source}</span>
                      <span className="num text-muted-foreground">
                        {`${line.leads} leads · 0 admitted · ${line.pending} still pending`}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <SectionCard
              title="Package value per disease"
              caption="Optional, and left blank on purpose. Guessing a hospital's package prices and then printing a rupee figure in front of their MD is how a meeting ends early."
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {diseases.map((disease) => (
                  <div key={disease} className="space-y-2">
                    <label htmlFor={`pkg-${disease}`} className="block text-sm font-semibold">
                      {disease}
                    </label>
                    <Input
                      id={`pkg-${disease}`}
                      inputMode="numeric"
                      value={packages[disease] ?? ""}
                      placeholder="e.g. 65000"
                      onChange={(event) =>
                        setPackages((current) => ({ ...current, [disease]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              {priced && (
                <p className="mt-4 text-sm">
                  {`The pending pool is worth ${rupees(result.pendingValue)} at package value. Gross, not margin, and only if every one of them converted — which they will not. It is the size of the question, not the size of the prize.`}
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="What this sheet structurally cannot tell you"
              caption="Facts about the columns, not guesses about the patients. This is the list that argues for one reason column."
            >
              <ol className="space-y-4">
                {result.blindSpots.map((spot) => (
                  <li key={spot.question}>
                    <p className="text-sm font-semibold">{spot.question}</p>
                    <p className="text-sm text-muted-foreground">{spot.because}</p>
                    <p className="mt-1 text-xs text-primary">{`Fix: ${spot.fix}`}</p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </>
        )}

        {!result && text && (
          <SectionCard title="Nothing readable in that paste">
            <p className="text-sm text-muted-foreground">
              The parser looks for a row where the fourth cell is a number — that is the Total Leads
              column. Paste the data rows including the header, straight from Excel.
            </p>
          </SectionCard>
        )}
      </div>
    </>
  );
}
