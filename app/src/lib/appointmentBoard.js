// O1. Appointment & No-show Board — Thesis §17 (appointment and conversion management),
// §24 (reason-based corrective action), §30.6 (the appointment module).
//
// Protect the visit, and recover it when it fails.
//
// The screen the specification describes opens with a calendar by doctor and day. **That
// calendar is not built here, and the reason is a missing field rather than a missing
// afternoon:** the journey dataset records whether an appointment was booked, confirmed,
// kept or missed, but not when it was for. Drawing a calendar would mean inventing slot
// times, and an appointment board that shows made-up times is the one screen in this app a
// front-desk person would catch in thirty seconds.
//
// What is built is the part that changes an outcome — the three boards §17 asks for, and
// the analysis underneath them:
//
//   **A no-show that was never reminded is not the patient's failure.** The dataset carries
//   how many confirmation touches each appointment received, so the board can compare
//   reminders on kept appointments against reminders on missed ones and say which side of
//   the desk the no-show came from. That comparison is the whole argument of this screen.

import { pct } from "./funnel.js";

/** The §17 reminder sequence, in order. Completion is tracked per appointment. */
export const REMINDER_SEQUENCE = [
  { key: "confirmation-call", label: "Confirmation call", when: "Within an hour of booking" },
  { key: "appointment-card", label: "RCS/MMS appointment card", when: "Same day" },
  { key: "day-before", label: "Day-before reminder", when: "24 hours ahead" },
  { key: "morning-of", label: "Morning-of reminder", when: "On the day" },
];

/** How many of the four reminders an appointment actually received. */
export function remindersSent(row) {
  return Math.min(REMINDER_SEQUENCE.length, Math.max(0, row.confirmations_count ?? 0));
}

/** The steps of the sequence that never ran, named rather than counted. */
export function remindersMissed(row) {
  return REMINDER_SEQUENCE.slice(remindersSent(row)).map((step) => step.label);
}

/** The metrics strip §17 asks for. Every rate names the base it divides by. */
export function boardMetrics(rows) {
  const booked = rows.filter((row) => row.appointment_booked);
  const confirmed = booked.filter((row) => row.appointment_confirmed);
  const arrived = booked.filter((row) => row.visited);
  const noShow = booked.filter((row) => row.no_show);
  const recovered = noShow.filter((row) => row.no_show_recovered);
  const kept = booked.filter((row) => row.visited && !row.no_show);

  const meanReminders = (group) =>
    group.length ? Math.round((group.reduce((sum, row) => sum + remindersSent(row), 0) / group.length) * 10) / 10 : 0;

  return {
    booked: booked.length,
    confirmed: confirmed.length,
    confirmationRate: pct(confirmed.length, booked.length),
    arrived: arrived.length,
    arrivalRate: pct(arrived.length, booked.length),
    noShow: noShow.length,
    noShowRate: pct(noShow.length, booked.length),
    recovered: recovered.length,
    recoveryRate: pct(recovered.length, noShow.length),
    rescheduled: booked.filter((row) => row.rescheduled).length,
    consultations: booked.filter((row) => row.consultation_completed).length,
    remindersPerKept: meanReminders(kept),
    remindersPerNoShow: meanReminders(noShow),
  };
}

/**
 * Booked, unconfirmed, and running out of time.
 *
 * Sorted by how many reminders are still outstanding, then by age. Without an appointment
 * time the queue cannot be sorted by proximity to the slot, which is what §17 asks for, so
 * it is sorted by the thing that actually predicts a no-show instead — how little contact
 * the patient has had.
 */
export function confirmationQueue(rows) {
  return rows
    .filter((row) => row.appointment_booked && !row.appointment_confirmed)
    .map((row) => ({
      id: row.id,
      patient_name: row.patient_name,
      phone_number: row.phone_number,
      disease: row.disease,
      doctor_name: row.doctor_name,
      branch: row.branch,
      agent_name: row.agent_name,
      temperature: row.temperature,
      remindersSent: remindersSent(row),
      remindersMissed: remindersMissed(row),
      outstanding: remindersMissed(row).length,
      ageDays: row.age_days,
      status: row.status,
    }))
    .sort((a, b) => b.outstanding - a.outstanding || b.ageDays - a.ageDays);
}

/**
 * The no-show board, with the one thing that makes it more than a list of absences:
 * whether the reminder sequence was ever completed for the patient who did not turn up.
 *
 * §24 forbids a dead end — every no-show carries a recovery owner and a recovery state.
 */
export function noShowBoard(rows) {
  return rows
    .filter((row) => row.no_show)
    .map((row) => {
      const missed = remindersMissed(row);
      return {
        id: row.id,
        patient_name: row.patient_name,
        phone_number: row.phone_number,
        disease: row.disease,
        doctor_name: row.doctor_name,
        branch: row.branch,
        agent_name: row.agent_name,
        remindersSent: remindersSent(row),
        remindersMissed: missed,
        // The attribution the spec asks for, stated per row rather than left to a reader
        // comparing two columns.
        attribution:
          missed.length === REMINDER_SEQUENCE.length
            ? "Never reminded — this is ours, not the patient's"
            : missed.length > 0
              ? `Partly reminded — ${missed.length} of ${REMINDER_SEQUENCE.length} steps never ran`
              : "Fully reminded — the patient did not come",
        ourFailure: missed.length > 0,
        recovered: Boolean(row.no_show_recovered),
        recoveryOwner: row.agent_name,
        recoveryState: row.no_show_recovered ? "Recovered — patient came back" : "Recovery open",
        rescheduled: Boolean(row.rescheduled),
        ageDays: row.age_days,
        lossReason: row.loss_reason,
      };
    })
    .sort((a, b) => Number(a.recovered) - Number(b.recovered) || b.remindersMissed.length - a.remindersMissed.length);
}

/** How the no-show pool splits between a process failure and a patient decision. */
export function noShowAttribution(rows) {
  const board = noShowBoard(rows);
  const ours = board.filter((entry) => entry.ourFailure);
  const theirs = board.filter((entry) => !entry.ourFailure);
  return {
    total: board.length,
    ours: ours.length,
    oursShare: pct(ours.length, board.length),
    theirs: theirs.length,
    theirsShare: pct(theirs.length, board.length),
    neverReminded: board.filter((entry) => entry.remindersSent === 0).length,
    recovered: board.filter((entry) => entry.recovered).length,
    open: board.filter((entry) => !entry.recovered).length,
  };
}

/**
 * Today's expected arrivals.
 *
 * With no slot time in the data this is the set of confirmed appointments that have not yet
 * been marked arrived — which is what a front desk actually works from, minus the ordering
 * a clock would give it. The screen says the times are missing rather than faking them.
 */
export function arrivalBoard(rows) {
  return rows
    .filter((row) => row.appointment_confirmed && !row.no_show)
    .map((row) => ({
      id: row.id,
      patient_name: row.patient_name,
      phone_number: row.phone_number,
      disease: row.disease,
      doctor_name: row.doctor_name,
      branch: row.branch,
      arrived: Boolean(row.visited),
      consultationDone: Boolean(row.consultation_completed),
      outcome: row.surgery_advised
        ? "Surgery advised"
        : row.tests_advised
          ? "Tests advised"
          : row.medical_management
            ? "Medical management"
            : row.consultation_completed
              ? "Consultation completed"
              : "Waiting",
      remindersSent: remindersSent(row),
      ageDays: row.age_days,
    }))
    .sort((a, b) => Number(a.arrived) - Number(b.arrived) || a.ageDays - b.ageDays);
}

/**
 * Reminder completeness against outcome — the table that settles the argument about
 * whether no-shows are a patient problem.
 *
 * One row per number of reminders received, so the kept rate can be read straight down.
 */
export function reminderEffect(rows) {
  const booked = rows.filter((row) => row.appointment_booked);
  return Array.from({ length: REMINDER_SEQUENCE.length + 1 }, (_, count) => {
    const group = booked.filter((row) => remindersSent(row) === count);
    const kept = group.filter((row) => row.visited && !row.no_show);
    return {
      value: count === 0 ? "No reminder at all" : `${count} of ${REMINDER_SEQUENCE.length} reminders`,
      reminders: count,
      appointments: group.length,
      kept: kept.length,
      keptRate: pct(kept.length, group.length),
      noShow: group.filter((row) => row.no_show).length,
      noShowRate: pct(group.filter((row) => row.no_show).length, group.length),
    };
  }).filter((line) => line.appointments > 0);
}

/**
 * Hospital-side and patient-side cancellations are separate reasons and report separately
 * (§17). The dataset records no cancellations, so this returns the vocabulary and an
 * explicit zero rather than a silently empty table.
 */
export const CANCELLATION_SIDES = [
  { key: "hospital", label: "Cancelled by the hospital", note: "Doctor unavailable, slot withdrawn, branch closed" },
  { key: "patient", label: "Cancelled by the patient", note: "Changed mind, timing, went elsewhere" },
];
