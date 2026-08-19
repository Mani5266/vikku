import React, { useMemo, useState } from "react";
import { BellRing, CalendarX } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard, { StatusPill } from "@/components/shared/SectionCard";
import DataTable, { StatTile } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { JOURNEYS } from "@/store/journeys";
import {
  CANCELLATION_SIDES,
  REMINDER_SEQUENCE,
  arrivalBoard,
  boardMetrics,
  confirmationQueue,
  noShowAttribution,
  noShowBoard,
  reminderEffect,
} from "@/lib/appointmentBoard";

// O1. Appointment & No-show Board.
//
// The calendar the specification opens with is not here, and the reason is a missing field
// rather than a missing afternoon: the dataset records whether an appointment was booked,
// confirmed, kept or missed, but never when it was for. Inventing slot times would produce the
// one screen a front-desk person catches in thirty seconds.
//
// What is here is the part that changes an outcome — and one number that settles an argument
// hospitals have every month: **how many of the people who did not turn up were never reminded.**

const BOARDS = [
  { key: "confirmation", label: "Confirmation queue" },
  { key: "noshow", label: "No-show board" },
  { key: "arrival", label: "Arrival board" },
];

export default function AppointmentBoard() {
  const rows = JOURNEYS;
  const [board, setBoard] = useState("confirmation");

  const metrics = useMemo(() => boardMetrics(rows), [rows]);
  const confirmations = useMemo(() => confirmationQueue(rows), [rows]);
  const noShows = useMemo(() => noShowBoard(rows), [rows]);
  const attribution = useMemo(() => noShowAttribution(rows), [rows]);
  const arrivals = useMemo(() => arrivalBoard(rows), [rows]);
  const effect = useMemo(() => reminderEffect(rows), [rows]);

  return (
    <>
      <PageHeader
        screen="O1"
        title="Appointments & No-shows"
        subtitle="Protect the visit, and recover it when it fails."
        thesis="§17, §24, §30.6"
      />

      <div className="space-y-6 p-4">
        <SectionCard title="Whose failure the no-shows actually were">
          <p className="text-lg font-semibold">
            {`${attribution.ours} of ${attribution.total} no-shows never received the full reminder sequence. ${attribution.neverReminded} received none of it at all.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {`That is ${attribution.oursShare}% of every missed appointment sitting on our side of the desk, not the patient's. ${attribution.recovered} were recovered; ${attribution.open} recoveries are still open.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {`The sequence is the four §17 steps: ${REMINDER_SEQUENCE.map((step) => step.label).join(" · ")}.`}
          </p>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Booked" value={metrics.booked.toLocaleString("en-IN")} detail={`${metrics.confirmed} confirmed · ${metrics.confirmationRate}%`} />
          <StatTile label="Arrived" value={metrics.arrived.toLocaleString("en-IN")} tone="good" detail={`${metrics.arrivalRate}% of everything booked`} />
          <StatTile
            label="No-show rate"
            value={`${metrics.noShowRate}%`}
            icon={CalendarX}
            tone={metrics.noShowRate > 15 ? "bad" : "default"}
            detail={`${metrics.noShow} missed · ${metrics.recovered} recovered (${metrics.recoveryRate}%)`}
          />
          <StatTile
            label="Reminders per kept appointment"
            value={metrics.remindersPerKept}
            icon={BellRing}
            detail={`${metrics.remindersPerNoShow} per no-show — the gap is the whole argument`}
          />
        </div>

        <SectionCard
          title="Reminders against whether the patient came"
          caption="One row per number of reminders received. Read it straight down: this is the table that decides whether the reminder sequence is worth automating."
        >
          <DataTable
            title={null}
            download={false}
            columns={[
              { key: "value", label: "Reminders received" },
              { key: "appointments", label: "Appointments", align: "right" },
              { key: "kept", label: "Kept", align: "right" },
              { key: "keptRateLabel", label: "Kept rate", align: "right" },
              { key: "noShow", label: "No-show", align: "right" },
              { key: "noShowRateLabel", label: "No-show rate", align: "right" },
            ]}
            rows={effect.map((line) => ({
              ...line,
              keptRateLabel: `${line.keptRate}%`,
              noShowRateLabel: `${line.noShowRate}%`,
            }))}
          />
        </SectionCard>

        <SectionCard
          title="The three boards"
          caption="§17 asks for a calendar and three side panels. The three panels are here; the calendar is not, because there is no appointment time anywhere in the data and drawing one would mean making the times up."
          control={
            <div className="flex flex-wrap gap-2">
              {BOARDS.map((entry) => (
                <Button
                  key={entry.key}
                  size="sm"
                  variant={entry.key === board ? "default" : "outline"}
                  onClick={() => setBoard(entry.key)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            {board === "confirmation" &&
              `${confirmations.length} appointment(s) are booked and unconfirmed. Sorted by how many reminder steps are still outstanding, because without a slot time that is the best available predictor of a no-show.`}
            {board === "noshow" &&
              `${noShows.length} missed appointment(s), open recoveries first. Every row carries a recovery owner and a state — §24 forbids a no-show being a dead end.`}
            {board === "arrival" &&
              `${arrivals.length} confirmed appointment(s), those not yet marked arrived first. Without slot times these cannot be ordered by the clock, which is what a front desk would actually want.`}
          </p>
        </SectionCard>

        {board === "confirmation" && (
          <DataTable
            title="Booked and unconfirmed"
            caption="The reminder steps that never ran are named, not counted, so the next call already knows what to say."
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "disease", label: "Disease" },
              { key: "doctor_name", label: "Doctor" },
              { key: "branch", label: "Branch" },
              { key: "agent_name", label: "Agent" },
              { key: "remindersSent", label: "Reminders sent", align: "right" },
              { key: "missedLabel", label: "Steps that never ran" },
              { key: "ageDays", label: "Age, days", align: "right" },
            ]}
            rows={confirmations.slice(0, 200).map((entry) => ({
              ...entry,
              missedLabel: entry.remindersMissed.join(" · ") || "None — all four ran",
            }))}
            empty="Every booked appointment has been confirmed."
          />
        )}

        {board === "noshow" && (
          <DataTable
            title="No-shows"
            caption="Attribution is stated per row rather than left to a reader comparing two columns."
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "disease", label: "Disease" },
              { key: "doctor_name", label: "Doctor" },
              { key: "remindersSent", label: "Reminders", align: "right" },
              { key: "attribution", label: "Whose failure" },
              { key: "recoveryOwner", label: "Recovery owner" },
              { key: "recoveryState", label: "Recovery" },
              { key: "ageDays", label: "Age, days", align: "right" },
            ]}
            rows={noShows.slice(0, 200)}
            empty="Nobody has missed an appointment."
          />
        )}

        {board === "arrival" && (
          <DataTable
            title="Expected in"
            caption="Confirmed and not yet marked arrived, first. The consultation outcome is carried through so the desk can see which arrivals turned into a surgical recommendation."
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "disease", label: "Disease" },
              { key: "doctor_name", label: "Doctor" },
              { key: "branch", label: "Branch" },
              { key: "arrivedLabel", label: "Arrived" },
              { key: "outcome", label: "Consultation outcome" },
              { key: "remindersSent", label: "Reminders", align: "right" },
            ]}
            rows={arrivals.slice(0, 200).map((entry) => ({ ...entry, arrivedLabel: entry.arrived ? "Yes" : "Not yet" }))}
            empty="Nothing is confirmed for arrival."
          />
        )}

        <SectionCard
          title="What this board still cannot tell you"
          caption="Named rather than left as an empty panel — a blank table teaches nobody that the field is missing."
        >
          <ul className="space-y-3 text-sm">
            <li>
              <span className="font-medium">The calendar itself.</span>{" "}
              <span className="text-muted-foreground">
                There is no appointment date or time in the data model, so no slot, no doctor's day
                and no double-booking check can exist. This is the single field that would turn the
                three boards above into a working front desk.
              </span>
            </li>
            <li>
              <span className="font-medium">Cancellations.</span>{" "}
              <span className="text-muted-foreground">
                {`§17 requires the two sides to report separately — ${CANCELLATION_SIDES.map((side) => side.label.toLowerCase()).join(" and ")} — and neither is recorded anywhere, so both read zero rather than being estimated.`}
              </span>
            </li>
            <li>
              <span className="font-medium">Marking somebody arrived.</span>{" "}
              <span className="text-muted-foreground">
                The arrival board reads state; it does not write it. <StatusPill status="Not built" tone="bad" />
              </span>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
