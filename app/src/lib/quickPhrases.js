// The fast path for logging a call.
//
// The seven-part remark is right, and typing it ninety times a day is why agents write "will come"
// and move on. That is the same failure the client showed us: three identical remarks in a row,
// copy-pasted, useless as evidence.
//
// So every part of the remark gets tappable phrases taken from the calls agents actually make, and
// the free-text field stays there for anything the chips do not cover. A chip and a typed sentence
// produce the same record — this file only removes the typing, never the requirement.

/** What patients say, grouped so the agent finds the line in one look. */
export const PATIENT_PHRASES = [
  { group: "Money", phrases: [
    "Wants the surgery but has to arrange money first.",
    "Asked about EMI and how many months.",
    "Asked whether insurance will cover it.",
    "Says the package is more than expected.",
    "Wants to know the exact final amount.",
  ] },
  { group: "Time", phrases: [
    "Wants to come this week.",
    "Will come after salary comes in.",
    "Has to finish work commitments first.",
    "Family function this month, will come after that.",
    "Asked to be called back next week.",
  ] },
  { group: "Family and decision", phrases: [
    "Has to discuss with husband or wife.",
    "Son or daughter decides, will speak to them.",
    "Wants to bring a family member along.",
  ] },
  { group: "Doubt and fear", phrases: [
    "Afraid of surgery and the pain after.",
    "Wants to know how many days of rest.",
    "Asked which doctor will operate.",
    "Wants to hear from someone who had it done.",
    "Wants to try medicines first.",
  ] },
  { group: "Elsewhere or not needed", phrases: [
    "Already got it done at another hospital.",
    "Consulting a doctor near their house.",
    "Says the problem has reduced now.",
    "Says they only wanted information.",
  ] },
];

/** What the agent explains, in the words they use on the call. */
export const AGENT_PHRASES = [
  "Explained the procedure, the day-care discharge and the rest days.",
  "Explained the package and what is included in it.",
  "Explained EMI and offered to connect the financial counsellor.",
  "Explained the insurance process and the documents needed.",
  "Explained the doctor's experience and how many cases they have done.",
  "Explained that consultation is separate from surgery, no obligation.",
  "Offered a video consultation instead of travelling.",
  "Gave the branch address and the doctor's timings.",
  "Told them we will send details on WhatsApp.",
];

/** The objections worth one tap. The full §23 list stays in the form below. */
export const QUICK_OBJECTIONS = [
  { category: "Financial", reason: "Treatment cost high" },
  { category: "Financial", reason: "EMI required" },
  { category: "Financial", reason: "Insurance unavailable" },
  { category: "Interest", reason: "Wants to wait" },
  { category: "Interest", reason: "Surgery fear" },
  { category: "Hospital / Doctor", reason: "Hospital too far" },
  { category: "Competition", reason: "Chose another hospital" },
  { category: "Interest", reason: "Not interested" },
];

/**
 * What happens next. The label is what the agent reads; the value is the enum the shipped
 * `LeadInteraction` entity accepts. They are not the same string, and writing the label into the
 * record would put values in the database that Base44's enum rejects.
 */
export const NEXT_ACTIONS = [
  { label: "Call again", value: "Call" },
  { label: "Book appointment", value: "Appointment" },
  { label: "Money talk with counsellor", value: "Financial Counseling" },
  { label: "Send details on WhatsApp", value: "WhatsApp" },
  { label: "Send pictures and video", value: "RCS/MMS" },
  { label: "Doctor should call", value: "Doctor Callback" },
  { label: "Tell my manager", value: "Escalate" },
  { label: "Close the lead", value: "Close" },
];

/**
 * When it happens. Presets instead of a datetime field, because "tomorrow morning" is what the
 * agent said on the call and typing 2026-08-18T10:00 is not.
 */
export function followUpPresets(now = new Date()) {
  const at = (dayOffset, hour) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const isEvening = new Date(now).getHours() >= 15;
  return [
    { label: "In 2 hours", value: new Date(new Date(now).getTime() + 2 * 60 * 60 * 1000).toISOString() },
    { label: isEvening ? "Tomorrow morning" : "This evening", value: isEvening ? at(1, 10) : at(0, 18) },
    { label: "Tomorrow morning", value: at(1, 10) },
    { label: "Day after", value: at(2, 11) },
    { label: "In 3 days", value: at(3, 11) },
    { label: "Next week", value: at(7, 11) },
  ];
}

/**
 * Temperature in the agent's language, with the promise attached: choosing Hot commits them to the
 * calls the plan will schedule, and the screen says so before they choose.
 */
export const TEMPERATURE_CHOICES = [
  {
    value: "Hot",
    label: "Hot",
    plain: "Wants to come in the next few days",
    promise: "Puts 3 calls and 3 messages on your list over 5 days.",
  },
  {
    value: "Warm",
    label: "Warm",
    plain: "Interested, but not decided yet",
    promise: "Calls on alternate days for 15 days.",
  },
  {
    value: "Cold",
    label: "Cold",
    plain: "Only asking for information right now",
    promise: "One call a week for a month, then it closes.",
  },
  {
    value: "Not Connected",
    label: "Could not judge",
    plain: "Spoke, but nothing clear came out",
    promise: "Stays on the retry list for 5 days.",
  },
];

/** One-tap outcomes for a dial that did not become a conversation. */
export const NOT_CONNECTED_QUICK = [
  { reason: "No answer", label: "No answer" },
  { reason: "Busy", label: "Busy" },
  { reason: "Switched off", label: "Switched off" },
  { reason: "Call rejected", label: "Cut the call" },
  { reason: "Wrong number", label: "Wrong number" },
  { reason: "Invalid number", label: "Number does not exist" },
];

/** Join a chip onto whatever is already typed, without duplicating it. */
export function appendPhrase(existing, phrase) {
  const current = (existing || "").trim();
  if (!current) return phrase;
  if (current.includes(phrase)) return current;
  return `${current} ${phrase}`;
}
