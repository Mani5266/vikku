import React, { useMemo } from "react";
import { AlertTriangle, CalendarClock, TrendingDown } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { JOURNEYS } from "@/store/journeys";
import { rupees } from "@/lib/funnel";
import {
  TOLERANCE_PERCENT,
  dailyScorecard,
  dropReasonsForDay,
  reportingDay,
  stageDropStrip,
  worstRung,
} from "@/lib/dailyMonitor";

// M2. Daily Conversion Monitor — the screen a manager opens at 9am.
//
// It answers one question and then gets out of the way: is today tracking, and if not, where
// is it leaking? Everything on it is a comparison against the same metric's own recent
// history, because a number with no window attached is the exact thing the client already
// distrusts about their spreadsheet.

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" });
const shortDay = (day) => (day ? DAY_LABEL.format(new Date(`${day}T00:00:00`)) : "—");

/** A metric value in the units it was measured in, or an honest dash. */
function present(value, unit) {
  if (value === null || value === undefined) return "—";
  if (unit === "percent") return `${value}%`;
  if (unit === "minutes") return `${value} min`;
  if (unit === "rupees") return rupees(value);
  return value.toLocaleString("en-IN");
}

export default function DailyMonitor() {
  const rows = JOURNEYS;

  const chosen = useMemo(() => reportingDay(rows), [rows]);
  const card = useMemo(() => dailyScorecard(rows, { day: chosen.day }), [rows, chosen.day]);
  const strip = useMemo(() => stageDropStrip(rows, { day: chosen.day }), [rows, chosen.day]);
  const leak = useMemo(() => worstRung(strip), [strip]);
  const drops = useMemo(() => dropReasonsForDay(rows, { day: chosen.day }), [rows, chosen.day]);

  const behind = card.filter((line) => line.verdict === "behind");
  const headline = card.find((line) => line.key === "leads");

  return (
    <>
      <PageHeader
        screen="M2"
        title="Daily Conversion Monitor"
        subtitle="Today against its own recent history. Nothing here is measured against a target somebody typed."
        thesis="§31, §26"
      />

      <div className="space-y-6 p-4">
        <SectionCard
          title={`Reporting on ${shortDay(chosen.day)}`}
          caption="The monitor reports on the last complete day. A day that is still being filled looks identical to a day that collapsed, and calling the first one a collapse every morning is how a dashboard stops being read."
          control={
            <span className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs">
              <CalendarClock className="h-4 w-4 text-primary" />
              {`${headline?.today ?? 0} leads in`}
            </span>
          }
        >
          {chosen.partialDay ? (
            <p className="text-sm text-muted-foreground">
              {`${shortDay(chosen.partialDay)} is still being filled — ${chosen.partialCount} lead(s) so far against a typical ${chosen.typicalCount}. It is skipped rather than reported as a fall, and it will be the reporting day tomorrow.`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This is the newest day in the data and it is complete, so nothing has been skipped.
            </p>
          )}
        </SectionCard>

        {/* The verdict, before the table. A manager reading this at 9am gets one sentence. */}
        <SectionCard title="Where today is leaking">
          {leak && leak.gap <= -5 ? (
            <div className="flex items-start gap-3">
              <TrendingDown className="mt-1 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-lg font-semibold">
                  {`${leak.value} is ${Math.abs(leak.gap)} points below normal.`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {`${leak.todayShare}% of the day's leads got that far, against ${leak.normalShare}% across the last thirty days. That is the rung to look at first — everything below it inherits the shortfall.`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm">
              No stage is more than five points off its thirty-day norm. The day is tracking, and there
              is nothing here that needs a manager before lunch.
            </p>
          )}
          {behind.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {`${behind.length} metric(s) are more than ${TOLERANCE_PERCENT}% off their weekly average: ${behind
                .map((line) => line.value)
                .join(", ")}.`}
            </p>
          )}
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {["leads", "connected", "booked", "surgeryBooked"].map((key) => {
            const line = card.find((entry) => entry.key === key);
            return (
              <StatTile
                key={key}
                label={line.value}
                value={present(line.today, line.unit)}
                delta={line.change}
                deltaLabel="vs the 7-day average"
                deltaGood={line.goodDirection}
                detail={`30-day average ${present(line.month, line.unit)}`}
                tone={line.verdict === "behind" ? "bad" : line.verdict === "ahead" ? "good" : "default"}
              />
            );
          })}
        </div>

        <SectionCard
          title="The stage strip"
          caption="Share of the day's leads that reached each rung, against the same share across the thirty days behind it. Colour is on the gap, never on the raw share — a 4% booking rate is not bad news if 4% is what every day looks like."
        >
          <ul className="space-y-3">
            {strip.map((rung) => (
              <li key={rung.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{rung.value}</span>
                  <span className="num text-muted-foreground">
                    {rung.todayShare === null
                      ? "—"
                      : `${rung.todayShare}% today · ${rung.normalShare}% normal · ${
                          rung.gap > 0 ? "+" : ""
                        }${rung.gap} points`}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={
                      rung.tone === "bad"
                        ? "h-full rounded-full bg-destructive"
                        : rung.tone === "good"
                          ? "h-full rounded-full bg-success"
                          : "h-full rounded-full bg-primary"
                    }
                    style={{ width: `${Math.min(100, rung.todayShare ?? 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <DataTable
          title="The eleven metrics, each against both windows"
          caption="§5 is explicit that a lead count on its own is not a quality judgement, so no figure here appears without the two averages beside it and the sentence that says how it was measured."
          columns={[
            { key: "value", label: "Metric" },
            { key: "todayLabel", label: "That day", align: "right" },
            { key: "weekLabel", label: "7-day average", align: "right" },
            { key: "monthLabel", label: "30-day average", align: "right" },
            { key: "changeLabel", label: "vs 7-day", align: "right" },
            { key: "verdictLabel", label: "Reading" },
            { key: "basis", label: "Measured as" },
          ]}
          rows={card.map((line) => ({
            ...line,
            todayLabel: present(line.today, line.unit),
            weekLabel: present(line.week, line.unit),
            monthLabel: present(line.month, line.unit),
            changeLabel: line.change === null ? "—" : `${line.change > 0 ? "+" : ""}${line.change}%`,
            verdictLabel:
              line.verdict === "behind" ? "Behind" : line.verdict === "ahead" ? "Ahead" : "Normal",
          }))}
        />

        <SectionCard
          title="Why that day's leads closed"
          caption="Reasons come off each lead's own closure record. Where a lead closed without one, it is not counted here rather than being guessed at."
          footer={{ to: "/drill", label: "Open the drill-down explorer" }}
        >
          {drops.reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing from that day's cohort has closed yet, so there is no reason to report. That is
              normal for a recent day — closures land as the follow-up plans run out.
            </p>
          ) : (
            <>
              <p className="text-sm">
                {`${drops.closed} of that day's leads have closed. ${drops.recoverable} carry a reason the §23 taxonomy calls winnable.`}
              </p>
              <ul className="mt-4 space-y-3">
                {drops.reasons.map((reason) => (
                  <li key={reason.value} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{reason.value}</span>
                    <span className="flex items-center gap-2">
                      <span className="num text-sm text-muted-foreground">
                        {`${reason.leads} lead(s) · ${reason.share}%`}
                      </span>
                      {reason.recoverable > 0 && (
                        <StatusPill status={`${reason.recoverable} winnable`} tone="pending" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        <div className="flex items-start gap-2 rounded-lg bg-secondary p-4">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-muted-foreground">
            Filtering by branch, disease, source and agent, and flagging a metric into the 15-day
            report, are specified for this screen and are not built. The drill-down explorer already
            does the first of those against the same dataset.
          </p>
        </div>
      </div>
    </>
  );
}
