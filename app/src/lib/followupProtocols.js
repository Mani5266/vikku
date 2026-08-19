// Follow-up protocols — Thesis §12 (Hot), §13 (Warm), §14 (Cold), §15 (Not Connected),
// and the §12 suppression conditions.
//
// Mirrors src/lib/followupProtocols.js in the client's Base44 app: the schedule
// already exists there and is reused, not restated. communicationEngine.js imports
// FOLLOWUP_PROTOCOLS and checkSuppression from here.

export const FOLLOWUP_PROTOCOLS = {
  Hot: {
    protocolType: "hot_7day",
    label: "Hot Lead — 5 to 7 days",
    durationDays: 7,
    steps: [
      {
        day: 1,
        callActivity: "Immediate priority call",
        callRequired: true,
        messageChannel: "WhatsApp",
        messageRequired: true,
        messageActivity: "WhatsApp introduction and relevant information",
      },
      {
        day: 2,
        callActivity: "Call if response or urgency requires it",
        callRequired: false,
        messageChannel: "None",
        messageRequired: false,
        messageActivity: "No routine message",
      },
      {
        day: 3,
        callActivity: "Priority follow-up call",
        callRequired: true,
        messageChannel: "RCS/MMS",
        messageRequired: true,
        messageActivity: "RCS/MMS visual message",
      },
      {
        day: 4,
        callActivity: "Call based on patient commitment",
        callRequired: false,
        messageChannel: "None",
        messageRequired: false,
        messageActivity: "No routine message",
      },
      {
        day: 5,
        callActivity: "Appointment or objection-resolution call",
        callRequired: true,
        messageChannel: "WhatsApp",
        messageRequired: true,
        messageActivity: "WhatsApp follow-up",
      },
      {
        day: 7,
        callActivity: "Final active-stage call",
        callRequired: true,
        messageChannel: "RCS/MMS",
        messageRequired: true,
        messageActivity: "Final action message, when required",
      },
    ],
  },

  Warm: {
    protocolType: "warm_15day",
    label: "Warm Lead — 15 days",
    durationDays: 15,
    steps: [1, 3, 5, 7, 9, 11, 13, 15].map((day) => {
      const callDay = day % 4 === 1; // days 1, 5, 9, 13
      return {
        day,
        callActivity:
          day === 15 ? "Final qualification call — hard decision point" : callDay ? "Call" : "No routine call",
        callRequired: callDay || day === 15,
        messageChannel: callDay ? "WhatsApp" : "RCS/MMS",
        messageRequired: true,
        messageActivity:
          day === 15
            ? "RCS/MMS or appropriate closure message"
            : callDay
              ? "WhatsApp follow-up"
              : "RCS/MMS visual message",
      };
    }),
  },

  Cold: {
    protocolType: "cold_monthly",
    label: "Cold Lead — monthly",
    durationDays: 30,
    steps: [
      {
        day: 1,
        callActivity: "Call",
        callRequired: true,
        messageChannel: "WhatsApp",
        messageRequired: true,
        messageActivity: "WhatsApp introduction",
      },
      {
        day: 8,
        callActivity: "One call, or message only",
        callRequired: false,
        messageChannel: "RCS/MMS",
        messageRequired: true,
        messageActivity: "Education message — disease awareness, preventive information",
      },
      {
        day: 15,
        callActivity: "No routine call",
        callRequired: false,
        messageChannel: "WhatsApp",
        messageRequired: true,
        messageActivity: "WhatsApp message — doctor availability, camp announcement",
      },
      {
        day: 22,
        callActivity: "Call + final monthly qualification",
        callRequired: true,
        messageChannel: "None",
        messageRequired: false,
        messageActivity: "No routine message",
      },
    ],
  },

  "Not Connected": {
    protocolType: "not_connected_5day",
    label: "Not Connected — 5 days",
    durationDays: 5,
    steps: [
      {
        day: 1,
        callActivity: "Double dial",
        callRequired: true,
        doubleDial: true,
        messageChannel: "WhatsApp",
        messageRequired: true,
        messageActivity: "WhatsApp contact attempt",
      },
      {
        day: 2,
        callActivity: "Call attempted at a different time",
        callRequired: true,
        messageChannel: "None",
        messageRequired: false,
        messageActivity: "No routine message",
      },
      {
        day: 3,
        callActivity: "Double dial",
        callRequired: true,
        doubleDial: true,
        messageChannel: "RCS/MMS",
        messageRequired: true,
        messageActivity: "RCS/MMS contact attempt",
      },
      {
        day: 4,
        callActivity: "Alternative-time call attempt",
        callRequired: true,
        messageChannel: "None",
        messageRequired: false,
        messageActivity: "No routine message",
      },
      {
        day: 5,
        callActivity: "Double dial",
        callRequired: true,
        doubleDial: true,
        messageChannel: "WhatsApp",
        messageRequired: true,
        messageActivity: "Final WhatsApp communication",
      },
    ],
  },
};

// Section 12 — a scheduled message is suppressed, and the suppression logged,
// when any of these is true. Order is the order the thesis lists them in.
export const SUPPRESSION_CONDITIONS = [
  { key: "patient_responded", label: "Patient has already responded" },
  { key: "appointment_booked", label: "Appointment has been booked" },
  { key: "requested_later_date", label: "Patient requested a later date" },
  { key: "opted_out", label: "Patient has opted out" },
  { key: "doctor_took_over", label: "Doctor has taken over communication" },
  { key: "patient_admitted", label: "Patient is already admitted" },
  { key: "patient_converted", label: "Patient has converted" },
];

export function checkSuppression(plan = {}) {
  for (const condition of SUPPRESSION_CONDITIONS) {
    if (plan[condition.key]) {
      return { active: true, reason: condition.label, key: condition.key };
    }
  }
  return { active: false, reason: null, key: null };
}

/** The step a plan is on today, or null on a day the protocol schedules nothing. */
export function stepForDay(temperature, day) {
  const protocol = FOLLOWUP_PROTOCOLS[temperature];
  if (!protocol) return null;
  return protocol.steps.find((s) => s.day === day) || null;
}
