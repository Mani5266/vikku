// Correcting a call remark without erasing what was written first — Thesis §29 (evidence and
// audit trail), §3.2 (no call without a remark).
//
// §29 says the activity history is append-only and that "corrections post a new correcting entry
// that references the original; nothing is overwritten". The Audit Log screen has been printing
// that sentence for a while and nothing implemented it: there was no way to correct a remark at
// all, so the claim was true only in the sense that a door nobody built is a door nobody walked
// through.
//
// That gap is not cosmetic. An agent mistypes what a patient said — a wrong figure, the wrong
// condition, an objection attributed to the wrong person — and the record then carries it forever.
// The honest options are to let them edit it, which loses the original, or to let them correct it,
// which keeps both. §29 chose the second and this is it.
//
// The rules, and why each one:
//
// **A correction is a new interaction, never an edit.** The original keeps its id, its timestamp
// and its text. Anything else would let a bad call be tidied up afterwards, which is the exact
// thing an audit trail exists to prevent.
//
// **A correction points at what it corrects.** `corrects` holds the original's id, so the history
// can show them together and a reader is never left wondering which version was believed.
//
// **A correction says what changed and why.** A record that silently disagrees with an earlier one
// is worse than either version alone.
//
// **The window is short and it is a nudge, not a lock.** Fifteen minutes is what the specification
// names, but a correction after fifteen minutes is still better than a wrong record left standing.
// So the window does not refuse — it changes what the screen asks for. Inside it, correcting a
// typo needs no ceremony; outside it, the reason becomes mandatory, because a change to yesterday's
// record is a different act from fixing what you typed a minute ago.

/** §3.2's seven parts, as they are stored on an interaction. Only these can be corrected. */
export const CORRECTABLE_FIELDS = [
  { key: "patient_said", label: "What the patient said" },
  { key: "agent_explained", label: "What you explained" },
  { key: "objection_category", label: "Objection category" },
  { key: "objection_raised", label: "The objection" },
  { key: "material_shared", label: "What you shared" },
  { key: "next_action", label: "Next action" },
  { key: "next_action_at", label: "When it must happen" },
  { key: "who_else_present", label: "Who else was on the call" },
];

/** The specification's window, in milliseconds. */
export const QUIET_CORRECTION_MS = 15 * 60 * 1000;

const MIN_REASON_LENGTH = 10;

/** How long ago this interaction was written. */
export function ageOf(interaction, now = Date.now()) {
  const at = Date.parse(interaction?.interaction_date ?? "");
  return Number.isFinite(at) ? now - at : Infinity;
}

/**
 * Is this still inside the quiet window?
 *
 * Inside it a correction reads as finishing the job. Outside it a correction reads as revisiting a
 * record somebody may already have acted on, and that is worth a sentence explaining why.
 */
export function isQuietWindow(interaction, now = Date.now()) {
  return ageOf(interaction, now) <= QUIET_CORRECTION_MS;
}

/** Only the fields that actually differ, so a correction never claims to change what it did not. */
export function changedFields(original = {}, draft = {}) {
  return CORRECTABLE_FIELDS.filter(({ key }) => {
    if (!(key in draft)) return false;
    const before = original[key] ?? "";
    const after = draft[key] ?? "";
    return String(before).trim() !== String(after).trim();
  });
}

/**
 * What stands between this correction and the record.
 *
 * Returns the sentences an agent has to act on, in the order they will read them. Empty means the
 * correction can be posted.
 */
export function correctionProblems(original, draft, reason, now = Date.now()) {
  const problems = [];

  if (!original) {
    problems.push("There is no call here to correct.");
    return problems;
  }

  const changed = changedFields(original, draft);
  if (!changed.length) {
    problems.push("Nothing is different yet. Change what was wrong, then post the correction.");
  }

  // A correction that empties a mandatory part is a deletion wearing a correction's clothes.
  for (const key of ["patient_said", "agent_explained"]) {
    if (key in draft && String(original[key] ?? "").trim() && !String(draft[key] ?? "").trim()) {
      const field = CORRECTABLE_FIELDS.find((entry) => entry.key === key);
      problems.push(`${field.label} cannot be emptied. A correction replaces a record, it does not delete one.`);
    }
  }

  if (!isQuietWindow(original, now) && String(reason ?? "").trim().length < MIN_REASON_LENGTH) {
    problems.push(
      `This call was logged more than fifteen minutes ago. Say why it is being corrected, in at least ${MIN_REASON_LENGTH} characters.`
    );
  }

  return problems;
}

/**
 * Build the correcting interaction.
 *
 * It carries the whole corrected record rather than only the changed fields, so anything reading
 * the latest version of a call reads one object rather than replaying a chain. `corrects` and
 * `changed` carry the history that makes it auditable.
 */
export function buildCorrection(original, draft, reason, { agentName } = {}) {
  const changed = changedFields(original, draft);
  return {
    ...original,
    ...draft,
    id: undefined, // the store issues a new one; reusing the original's would overwrite it
    corrects: original.id,
    correction_reason: String(reason ?? "").trim() || null,
    corrected_fields: changed.map((field) => field.key),
    agent_name: agentName || original.agent_name,
  };
}

/**
 * The one-line summary that goes in the audit log and on the history entry.
 *
 * Names the fields rather than counting them. "Corrected 2 fields" tells a reader to go and look;
 * "corrected what the patient said and the next action" tells them whether they need to.
 */
export function describeCorrection(changed = [], reason = null) {
  const labels = changed.map((field) => field.label ?? field);
  const list =
    labels.length <= 1
      ? labels[0] ?? "nothing"
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return reason ? `Corrected ${list} — ${reason}` : `Corrected ${list}`;
}

/**
 * The history, with corrections folded into the calls they correct.
 *
 * Both stay in the list — §29 is append-only and hiding the original would defeat the point — but
 * a superseded entry is marked so a reader is never left comparing two records without being told
 * which one is current.
 */
export function foldCorrections(interactions = []) {
  const correctionsByTarget = new Map();
  for (const entry of interactions) {
    if (entry.corrects) correctionsByTarget.set(entry.corrects, entry);
  }

  return interactions.map((entry) => ({
    ...entry,
    supersededBy: correctionsByTarget.get(entry.id)?.id ?? null,
    isCorrection: Boolean(entry.corrects),
  }));
}

/** The version to believe: the correction if there is one, otherwise the original. */
export function currentVersion(interactions = [], interactionId) {
  const correction = interactions.find((entry) => entry.corrects === interactionId);
  return correction ?? interactions.find((entry) => entry.id === interactionId) ?? null;
}
