// Minimal stub of src/lib/followupProtocols.js, so communicationEngine can be
// tested without the app. Mirrors only the two exports the engine imports.
// The real file is the source of truth — this exists to keep the test runnable.

export const FOLLOWUP_PROTOCOLS = {
  Hot: {
    protocolType: "hot_7day",
    steps: [
      { day: 1, messageChannel: "WhatsApp", messageRequired: true, messageActivity: "WhatsApp introduction and relevant information" },
      { day: 2, messageChannel: "None", messageRequired: false, messageActivity: "No routine message" },
      { day: 3, messageChannel: "RCS/MMS", messageRequired: true, messageActivity: "RCS/MMS visual message" },
      { day: 4, messageChannel: "None", messageRequired: false, messageActivity: "No routine message" },
      { day: 5, messageChannel: "WhatsApp", messageRequired: true, messageActivity: "WhatsApp follow-up" },
    ],
  },
  Cold: {
    protocolType: "cold_monthly",
    steps: [{ day: 1, messageChannel: "WhatsApp", messageRequired: true, messageActivity: "WhatsApp introduction" }],
  },
};

export const SUPPRESSION_CONDITIONS = [
  { key: "patient_responded", label: "Patient has already responded" },
  { key: "appointment_booked", label: "Appointment has been booked" },
  { key: "requested_later_date", label: "Patient requested a later date" },
  { key: "opted_out", label: "Patient has opted out" },
  { key: "doctor_took_over", label: "Doctor has taken over communication" },
  { key: "patient_admitted", label: "Patient is already admitted" },
  { key: "patient_converted", label: "Patient has converted" },
];

export function checkSuppression(plan) {
  for (const cond of SUPPRESSION_CONDITIONS) {
    if (plan[cond.key]) return { active: true, reason: cond.label, key: cond.key };
  }
  return { active: false, reason: null, key: null };
}
