// A4 — qualification and scoring (§7, §30.3).
//
// The client's complaint about temperature is not that agents lack a dropdown. It is that the
// dropdown is a feeling: "Hot" gets typed because the patient sounded nice, and M6 then shows 19% of
// graded calls disagreeing with what was actually said.
//
// So the temperature stops being an opinion and becomes an arithmetic result of eleven explicit
// answers. The agent can still override it — an override is often right, a patient's tone carries
// information the eleven factors do not — but an override costs a written justification and shows up
// on the manager's qualification-accuracy column. That is the whole design: disagreeing is allowed,
// disagreeing silently is not.

/**
 * The eleven §7 factors. Each option carries the band it indicates, so the screen can show *which*
 * Hot indicators matched rather than only a total.
 */
export const QUALIFICATION_FACTORS = [
  {
    key: "symptom_severity",
    label: "How bad are the symptoms?",
    options: [
      { value: "severe", label: "Severe — daily life affected", band: "Hot" },
      { value: "moderate", label: "Moderate — manageable but troubling", band: "Warm" },
      { value: "mild", label: "Mild — occasional discomfort", band: "Cold" },
    ],
  },
  {
    key: "duration",
    label: "How long has the problem been there?",
    options: [
      { value: "long", label: "More than a year", band: "Hot" },
      { value: "months", label: "A few months", band: "Warm" },
      { value: "recent", label: "Recent — just noticed", band: "Cold" },
    ],
  },
  {
    key: "urgency",
    label: "How urgent is treatment?",
    options: [
      { value: "advised_now", label: "A doctor has already advised surgery", band: "Hot" },
      { value: "soon", label: "Should be done, no date fixed", band: "Warm" },
      { value: "exploring", label: "Only exploring options", band: "Cold" },
    ],
  },
  {
    key: "distance",
    label: "How far is the patient from the hospital?",
    options: [
      { value: "near", label: "Same city", band: "Hot" },
      { value: "medium", label: "Within a few hours", band: "Warm" },
      { value: "far", label: "Another state or country", band: "Cold" },
    ],
  },
  {
    key: "financial_readiness",
    label: "Is the money arranged?",
    options: [
      { value: "ready", label: "Ready to pay or insurance approved", band: "Hot" },
      { value: "arranging", label: "Arranging — EMI or insurance in process", band: "Warm" },
      { value: "not_ready", label: "No plan for the money yet", band: "Cold" },
    ],
  },
  {
    key: "appointment_readiness",
    label: "Will they come for a consultation?",
    options: [
      { value: "this_week", label: "This week", band: "Hot" },
      { value: "this_month", label: "Some time this month", band: "Warm" },
      { value: "no_date", label: "No date, only information", band: "Cold" },
    ],
  },
  {
    key: "decision_authority",
    label: "Who decides?",
    options: [
      { value: "self", label: "The patient decides", band: "Hot" },
      { value: "with_family", label: "Patient with family", band: "Warm" },
      { value: "someone_else", label: "Someone else decides", band: "Cold" },
    ],
  },
  {
    key: "previous_treatment",
    label: "What has been tried already?",
    options: [
      { value: "failed_medication", label: "Medicines tried, did not work", band: "Hot" },
      { value: "on_medication", label: "Currently on medication", band: "Warm" },
      { value: "nothing", label: "Nothing tried yet", band: "Cold" },
    ],
  },
  {
    key: "insurance",
    label: "Is there insurance?",
    options: [
      { value: "approved", label: "Yes, and it covers this", band: "Hot" },
      { value: "checking", label: "Yes, coverage being checked", band: "Warm" },
      { value: "none", label: "No insurance", band: "Cold" },
    ],
  },
  {
    key: "consultation_interest",
    label: "How interested are they in seeing the doctor?",
    options: [
      { value: "asked", label: "Asked for an appointment themselves", band: "Hot" },
      { value: "open", label: "Open to it if convenient", band: "Warm" },
      { value: "reluctant", label: "Does not want to come yet", band: "Cold" },
    ],
  },
  {
    key: "surgery_interest",
    label: "How do they feel about surgery?",
    options: [
      { value: "wants", label: "Wants it done", band: "Hot" },
      { value: "considering", label: "Considering it", band: "Warm" },
      { value: "avoiding", label: "Wants to avoid surgery", band: "Cold" },
    ],
  },
];

/** Extra context the qualification carries but does not score. */
export const QUALIFICATION_CONTEXT = [
  { key: "sub_condition", label: "Sub-condition", placeholder: "e.g. bilateral, grade 3" },
  { key: "investigations_done", label: "Investigations already done", placeholder: "e.g. scan, blood work" },
  { key: "referring_doctor", label: "Referring doctor", placeholder: "Name, if any" },
];

const BANDS = ["Hot", "Warm", "Cold"];

/**
 * Score a set of answers.
 *
 * The suggestion is the band with the most matched indicators, and ties break **cooler** — calling a
 * lead Hot on a five-five split is the over-grading the audit already catches, so the arithmetic
 * refuses to do it.
 */
export function scoreLead(answers = {}) {
  const matched = { Hot: [], Warm: [], Cold: [] };

  for (const factor of QUALIFICATION_FACTORS) {
    const chosen = factor.options.find((option) => option.value === answers[factor.key]);
    if (chosen) matched[chosen.band].push(factor.label);
  }

  const answered = matched.Hot.length + matched.Warm.length + matched.Cold.length;
  const complete = answered === QUALIFICATION_FACTORS.length;

  // Ties break cooler. Take the highest indicator count, then the *coolest* band holding it —
  // scanning cold-first is what makes a five-five split Warm rather than Hot.
  let suggested = null;
  if (answered > 0) {
    const top = Math.max(...BANDS.map((band) => matched[band].length));
    suggested = ["Cold", "Warm", "Hot"].find((band) => matched[band].length === top);
  }

  return {
    matched,
    answered,
    total: QUALIFICATION_FACTORS.length,
    complete,
    suggested: complete ? suggested : null,
    // A percentage of the Hot indicators, for the header figure. Not a probability, and labelled
    // as an indicator count on screen so nobody reads it as one.
    hotShare: answered ? Math.round((matched.Hot.length / answered) * 100) : 0,
  };
}

/** An override is legal only with a justification long enough to be a sentence. */
export const MIN_JUSTIFICATION = 15;

export function overrideProblem({ suggested, chosen, justification }) {
  if (!chosen) return "Pick a classification.";
  if (!suggested) return "Answer all eleven questions first.";
  if (chosen === suggested) return null;
  if ((justification || "").trim().length < MIN_JUSTIFICATION) {
    return `You are grading this ${chosen} when the answers say ${suggested}. Write why, in a sentence.`;
  }
  return null;
}
