// A8 — appointment booking (§17, §30.6).
//
// Every dashboard in this product counts appointments. Until now nothing in the app could create
// one, which meant the appointment funnel was a number with no screen behind it.
//
// The ten §17 states are a machine, not a dropdown: a lead cannot go from Suggested straight to
// Consultation Completed, and Cancelled and No-show both cost a reason because §3.3 applies to
// closure-adjacent events too. A no-show also raises its own recovery task rather than quietly
// ending the lead.

export const APPOINTMENT_STATES = [
  { value: "Suggested", plain: "We offered a slot", terminal: false },
  { value: "Patient Considering", plain: "They are thinking about it", terminal: false },
  { value: "Booked", plain: "Slot taken", terminal: false },
  { value: "Confirmation Pending", plain: "Waiting for them to confirm", terminal: false },
  { value: "Confirmed", plain: "They confirmed they will come", terminal: false },
  { value: "Rescheduled", plain: "Moved to another slot", terminal: false },
  { value: "Cancelled", plain: "They cancelled", terminal: true },
  { value: "No-show", plain: "They did not come", terminal: true },
  { value: "Patient Arrived", plain: "They reached the hospital", terminal: false },
  { value: "Consultation Completed", plain: "The doctor saw them", terminal: true },
];

/** What may follow what. An appointment that skips a rung is a record nobody can audit. */
const TRANSITIONS = {
  none: ["Suggested"],
  Suggested: ["Patient Considering", "Booked", "Cancelled"],
  "Patient Considering": ["Booked", "Cancelled"],
  Booked: ["Confirmation Pending", "Confirmed", "Rescheduled", "Cancelled"],
  "Confirmation Pending": ["Confirmed", "Rescheduled", "Cancelled", "No-show"],
  Confirmed: ["Patient Arrived", "Rescheduled", "Cancelled", "No-show"],
  Rescheduled: ["Confirmation Pending", "Confirmed", "Cancelled", "No-show"],
  "Patient Arrived": ["Consultation Completed"],
  Cancelled: ["Suggested"], // a cancelled visit can be offered again
  "No-show": ["Suggested"],
  "Consultation Completed": [],
};

export function nextStates(current) {
  return TRANSITIONS[current || "none"] ?? [];
}

/** The two states §3.3 will not accept without a reason. */
export const REASON_REQUIRED = ["Cancelled", "No-show"];

export const CANCEL_REASONS = [
  "Patient postponed for money reasons",
  "Family member unavailable",
  "Work or travel came up",
  "Health got better",
  "Chose another hospital",
  "Distance or travel too difficult",
  "Patient stopped responding",
];

/** Consultation types, and whether travel information applies. */
export const CONSULTATION_TYPES = [
  { value: "In-person", label: "In-person", travel: true },
  { value: "Video", label: "Video consultation", travel: false },
];

/**
 * The reminder plan a booking switches the lead onto (§12): routine follow-up messaging is
 * suppressed and these four go out instead.
 */
export function reminderPlan(appointmentAt) {
  if (!appointmentAt) return [];
  const at = new Date(appointmentAt);
  const minus = (hours) => new Date(at.getTime() - hours * 60 * 60 * 1000).toISOString();
  return [
    { key: "confirmation_call", label: "Confirmation call", when: minus(48), channel: "Call" },
    { key: "appointment_card", label: "Appointment card with address and timing", when: minus(47), channel: "RCS/MMS" },
    { key: "day_before", label: "Day-before reminder", when: minus(24), channel: "WhatsApp" },
    { key: "morning_of", label: "Morning-of reminder", when: minus(3), channel: "WhatsApp" },
  ];
}

export const PREPARATION_NOTES = [
  "Come fasting if blood work is planned",
  "Bring previous scans and reports",
  "Bring insurance card and ID",
  "Allow two hours at the hospital",
];

/** What stops a save. Returned as a list so the screen can name every gap before the tap. */
export function bookingProblems({ state, doctor, branch, at, consultationType, reason }) {
  const problems = [];
  if (!state) problems.push("Pick what happened");
  if (REASON_REQUIRED.includes(state)) {
    if (!reason) problems.push(`A ${state.toLowerCase()} needs a reason — §3.3 applies here too`);
    return problems;
  }
  if (!doctor) problems.push("Doctor");
  if (!branch) problems.push("Branch");
  if (!consultationType) problems.push("In-person or video");
  if (!at) problems.push("Date and time");
  else if (new Date(at).getTime() < Date.now() - 60 * 60 * 1000) {
    problems.push("The slot is in the past");
  }
  return problems;
}

/** A no-show raises a recovery task rather than ending the lead silently (§24). */
export function recoveryTaskFor(appointment) {
  if (appointment?.state !== "No-show") return null;
  return {
    kind: "no_show_recovery",
    label: "No-show recovery call",
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    note: `Missed ${appointment.doctor ? `${appointment.doctor}'s ` : ""}appointment. Reason recorded: ${
      appointment.reason || "not stated"
    }.`,
  };
}
