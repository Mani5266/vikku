// Non-conversion reason taxonomy — Thesis §23, reference/reason-codes.md.
// The closed vocabulary for closing a lead, and the objection picklist the
// structured remark reads from. Mirrors src/lib/reasonTaxonomy.js in the app.

export const NON_CONVERSION_CATEGORIES = [
  { value: "Financial", label: "Financial" },
  { value: "Interest", label: "Interest" },
  { value: "Follow-up Failure", label: "Follow-up Failure" },
  { value: "Hospital / Doctor", label: "Hospital / Doctor" },
  { value: "Competition", label: "Competition" },
  { value: "Lead Quality", label: "Lead Quality" },
  { value: "Contactability", label: "Contactability" },
];

// sub-reason -> { recoverable, action, segment }
const REASONS = {
  Financial: [
    ["Treatment cost high", true, "Financial counselor call", "Recoverable"],
    ["Discount requested", true, "Controlled discount approval", "Recoverable"],
    ["EMI required", true, "EMI option", "Recoverable"],
    ["Insurance unavailable", true, "Insurance check", "Recoverable"],
    ["Budget insufficient", true, "Package explanation, value comparison", "Recoverable"],
    ["Financial counseling not completed", true, "Counselor call — process failure, not a patient decision", "Recoverable"],
  ],
  Interest: [
    ["Not interested", false, "Close", "Genuine Lost"],
    ["General enquiry", false, "Long-term nurture", "Long-Term Nurture"],
    ["No current requirement", true, "Long-term nurture", "Long-Term Nurture"],
    ["Wants to wait", true, "90-day reactivation", "Long-Term Nurture"],
    ["Symptoms reduced", true, "Health check reminder", "Long-Term Nurture"],
    ["Surgery fear", true, "Doctor counseling, procedure explainer", "Recoverable"],
  ],
  "Follow-up Failure": [
    ["First response delayed", true, "Immediate re-engagement, SLA review", "Recoverable"],
    ["Follow-up missed", true, "Agent alert, manager escalation", "Recoverable"],
    ["Insufficient calls", true, "Reschedule the plan", "Recoverable"],
    ["Message not sent", true, "Send, and investigate the scheduler", "Recoverable"],
    ["Wrong information provided", true, "Corrective call, agent coaching", "Recoverable"],
    ["Patient query unresolved", true, "Escalate to doctor or counselor", "Recoverable"],
  ],
  "Hospital / Doctor": [
    ["Doctor confidence issue", true, "Doctor profile, credentials, callback", "Recoverable"],
    ["Requested another doctor", true, "Reassign doctor", "Recoverable"],
    ["Hospital too far", true, "Nearest branch, video consultation", "Recoverable"],
    ["Branch unavailable", true, "Alternative branch or camp", "Recoverable"],
    ["Appointment timing unsuitable", true, "Suitable slot", "Recoverable"],
    ["Waiting time issue", true, "Priority slot, process review", "Recoverable"],
  ],
  Competition: [
    ["Chose another hospital", false, "Capture competitor name and the learning", "Genuine Lost"],
    ["Lower competitor price", true, "Value comparison if pre-treatment", "Recoverable"],
    ["Continued with existing doctor", false, "Long-term nurture", "Long-Term Nurture"],
    ["Preferred local facility", false, "Note location gap for branch planning", "Genuine Lost"],
  ],
  "Lead Quality": [
    ["Wrong number", false, "Lead form quality signal", "Invalid / Non-Actionable"],
    ["Duplicate", false, "Duplicate detection rules", "Invalid / Non-Actionable"],
    ["Fake lead", false, "Audience or creative quality", "Invalid / Non-Actionable"],
    ["Out of location", false, "Location targeting", "Invalid / Non-Actionable"],
    ["Unrelated enquiry", false, "Creative and landing page relevance", "Invalid / Non-Actionable"],
    ["Already treated", false, "Audience exclusion", "Genuine Lost"],
  ],
  Contactability: [
    ["Not lifting", true, "Alternative-time attempts, controlled reactivation", "Recoverable"],
    ["Switched off", true, "Retry schedule", "Recoverable"],
    ["Call rejected", true, "Message-first approach", "Recoverable"],
    ["Invalid number", false, "Lead form validation signal", "Invalid / Non-Actionable"],
    ["No WhatsApp", true, "RCS/MMS or SMS only", "Recoverable"],
    ["Repeatedly unreachable", false, "Final Not Connected", "Invalid / Non-Actionable"],
  ],
};

export function getReasonsForCategory(category) {
  if (!category || category === "None") return [];
  return (REASONS[category] || []).map(([reason]) => reason);
}

export function reasonDefaults(category, reason) {
  const row = (REASONS[category] || []).find(([r]) => r === reason);
  if (!row) return null;
  const [, recoverable, action, segment] = row;
  return { recoverable, action, segment };
}

export const EXPIRED_LEAD_SEGMENTS = [
  { value: "Recoverable", reactivation: "Eligible" },
  { value: "Long-Term Nurture", reactivation: "Eligible on a longer cycle" },
  { value: "Genuine Lost", reactivation: "Not eligible" },
  { value: "Invalid / Non-Actionable", reactivation: "Not eligible" },
];
