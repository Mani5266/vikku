// Where a lead comes from — Thesis §3.1 (mandatory attribution), §5 (intake and source
// configuration), §7 (touch time), §30.1 (the lead capture module).
//
// This is the mouth of the funnel, and until now the product did not have one.
//
// Every lead in the system existed because `buildSeed()` invented it. There was no form, no
// import, no `addLead` on the store — only `updateLead`. A telecaller taking an enquiry on the
// phone had nowhere to put it, and the §3.1 guard in sourceRegistry.js, which refuses a lead
// without complete attribution, had nothing calling it. Everything downstream — the queue, the
// five-minute clock, qualification, the plan, the appointment, the treatment — assumed a lead was
// already there.
//
// Two paths are built, and they are the two that matter for this hospital:
//
//   **One at a time.** The enquiry that arrives while somebody is on the phone or standing at the
//   front desk. This is the path where attribution is usually lost, because the person typing is
//   in a hurry and the fields that matter to the MD are the ones that mean nothing to them.
//
//   **Pasted from a sheet.** How TRH works today. They live in Excel, they already paste their
//   weekly export into M11, and a product that cannot accept a spreadsheet is a product that asks
//   a hospital to change how it works before it has proved anything.
//
// The paths that need a server — ad-platform webhooks, website forms, IVR and call-tracking
// numbers, WhatsApp — are named in `INTAKE_PATHS` with `built: false` rather than left out, because
// a source list that quietly omits the ones producing most of the volume is a lie about coverage.

import { CANONICAL_SOURCES, canonicalSource, intakeProblems as attributionProblems } from "./sourceRegistry.js";
import { ruleFor } from "./assignment.js";

/** How a lead can reach this system, and which of those this build can actually do. */
export const INTAKE_PATHS = [
  {
    key: "manual",
    label: "Somebody called or messaged us",
    built: true,
    detail: "Typed while the enquiry is happening. The path where attribution is lost most often.",
    defaults: { lead_type: "Inbound", form: "Telecaller entry" },
  },
  {
    key: "walk-in",
    label: "They walked into the hospital",
    built: true,
    detail: "The front desk has the patient in front of them. No campaign, and that is the truth rather than a gap.",
    defaults: { lead_type: "Walk-in", source: "Direct Call", campaign: "Front desk walk-in", platform: "Owned", form: "Front desk" },
  },
  {
    key: "bulk",
    label: "Bring in a list from a sheet",
    built: true,
    detail: "How this hospital works today. Choose the file or paste the cells — every row goes through the same guard as a typed lead.",
    defaults: { lead_type: "Inbound", form: "Spreadsheet import" },
  },
  {
    key: "webhook",
    label: "Straight from Meta, Google or the website form",
    built: false,
    detail: "Needs a server to receive the callback. This is where most of the volume comes from and it is not built.",
  },
  {
    key: "ivr",
    label: "Missed call and call-tracking numbers",
    built: false,
    detail: "Needs the telephony integration. Not built.",
  },
];

export function pathByKey(key) {
  return INTAKE_PATHS.find((path) => path.key === key) ?? null;
}

/** Indian mobile numbers, in the shapes people actually type them. */
export function normalisePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) return null;
  return `+91 ${ten}`;
}

/**
 * What a lead must carry before it may be written.
 *
 * §3.1 is enforced at the write layer rather than on the form, which is the only place it holds:
 * a check that lives on a form is a check a spreadsheet import walks straight past. Both paths in
 * this file call this, and so does every test.
 *
 * The attribution fields are read against the path. A walk-in has no landing page, and demanding
 * one would teach the front desk to type something false into the field the MD later reports on —
 * which is worse than the field being empty. The path supplies what is true for it, and what is
 * still missing after that is a real gap.
 */
export function intakeProblems(draft = {}, { path = "manual" } = {}) {
  const problems = [];
  const record = withDefaults(draft, path);

  if (!String(record.patient_name || "").trim()) problems.push("A name — you cannot call somebody you cannot greet");
  if (!record.phone_number) {
    problems.push("A mobile number. Ten digits starting 6, 7, 8 or 9");
  }
  if (!String(record.disease || "").trim()) {
    problems.push("What they are asking about. Without it nobody knows which doctor or which package");
  }
  if (!record.branch) problems.push("Which branch this belongs to");

  problems.push(...attributionProblems(record));
  return problems;
}

/** The platform a source belongs to. A property of the source, not a separate thing to type. */
export function platformFor(source) {
  const canonical = canonicalSource(source);
  return CANONICAL_SOURCES.find((entry) => entry.name === canonical)?.platform ?? null;
}

/**
 * The path's own truths, filled in before the guard reads the record.
 *
 * Platform is derived rather than asked for. §3.1 requires it on every lead, but nobody typing an
 * enquiry should have to answer "Meta" after already answering "Meta Ads" — the registry holds
 * which platform each of the seventeen sources belongs to, so this reads it from there. Deriving
 * a field from one already given is not the same as inventing one, and it is the difference
 * between a mandatory field that gets filled and a mandatory field that gets faked.
 */
export function withDefaults(draft = {}, pathKey = "manual") {
  const path = pathByKey(pathKey);
  const merged = { ...(path?.defaults ?? {}), ...stripEmpty(draft) };
  return {
    ...merged,
    phone_number: normalisePhone(merged.phone_number),
    platform: merged.platform ?? platformFor(merged.source),
    created_at: merged.created_at ?? new Date().toISOString(),
  };
}

function stripEmpty(draft) {
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

/**
 * Is this person already in the system?
 *
 * Two agents ringing the same patient about the same condition is the fastest way a hospital loses
 * a lead it had already won, and it is invisible from inside either agent's queue. The phone number
 * is the strong signal; the same name with the same condition is worth a look and nothing more,
 * because in a hospital of this size that is a Tuesday.
 */
export function findDuplicates(draft, existing = []) {
  const phone = normalisePhone(draft.phone_number);
  const name = String(draft.patient_name || "").trim().toLowerCase();
  const disease = String(draft.disease || "").trim().toLowerCase();

  const strong = phone ? existing.filter((lead) => normalisePhone(lead.phone_number) === phone) : [];
  const weak = existing.filter(
    (lead) =>
      !strong.includes(lead) &&
      name &&
      String(lead.patient_name || "").trim().toLowerCase() === name &&
      String(lead.disease || "").trim().toLowerCase() === disease
  );

  return { strong, weak, blocking: strong.length > 0 };
}

/**
 * Who this lead goes to, and why.
 *
 * The routing rules already exist for the assignment board, so intake uses the same ones rather
 * than a second set. `agent_name` is picked from whoever the rule points at and has the most room,
 * because a rule that routes into a full queue has moved the problem rather than solved it.
 */
export function assignmentFor(draft, roster = []) {
  const rule = ruleFor(draft);
  const available = roster.filter((entry) => !entry.atCapacity);
  const pool = available.length ? available : roster;
  const owner = [...pool].sort((a, b) => (a.open ?? 0) - (b.open ?? 0))[0] ?? null;
  return {
    ...rule,
    agent_name: owner?.value ?? null,
    // Said out loud on the form, because "why did I get this one" is the first question an agent
    // asks about a lead they did not expect.
    because: owner
      ? `${rule.because} ${owner.value} has the most room right now.`
      : `${rule.because} Nobody is on the roster, so this needs assigning by hand.`,
  };
}

/**
 * Build the record the store will hold.
 *
 * A new lead starts un-graded on purpose. The temperature decides the follow-up plan, and a plan
 * chosen before anybody has spoken to the patient is a schedule nobody agreed to — so intake stops
 * at "somebody has to call this person", which is exactly what the queue then says.
 */
export function buildLead(draft, { path = "manual", assignment, id } = {}) {
  const record = withDefaults(draft, path);
  return {
    id: id ?? `lead_${Math.abs(hash(`${record.phone_number}${record.created_at}`)).toString(36)}`,
    patient_name: String(record.patient_name).trim(),
    phone_number: record.phone_number,
    lead_type: record.lead_type ?? "Inbound",
    disease: String(record.disease).trim(),
    source: canonicalSource(record.source),
    campaign: record.campaign,
    platform: record.platform,
    form: record.form,
    landing_page: record.landing_page ?? null,
    branch: record.branch,
    agent_name: assignment?.agent_name ?? null,
    assignment_rule: assignment?.label ?? null,
    lead_status: "New — not called yet",
    stage: 1,
    rcs_supported: true,
    number_valid: true,
    created_at: record.created_at,
    intake_path: path,
    // No plan and no temperature. The first call decides both.
    plan: {},
  };
}

/** Deterministic, so the same enquiry typed twice produces the same id and collides loudly. */
function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (Math.imul(31, value) + text.charCodeAt(i)) | 0;
  return value;
}

/**
 * A pasted sheet, read the way the weekly export is read in M11: by position, tolerant of the
 * header row, and reporting what it could not use rather than dropping it silently.
 *
 * Columns: name, phone, condition, source, campaign, branch.
 */
export const BULK_COLUMNS = ["Name", "Phone", "Condition", "Source", "Campaign", "Branch"];

/**
 * Rows of cells in, drafts out, with everything refused listed rather than dropped.
 *
 * This is the shared middle of both bulk paths. A pasted block and a chosen .xlsx arrive as the
 * same thing — an array of rows of strings — so a spreadsheet cannot be held to a different
 * standard than text typed by hand. One guard, one place, and the §3.1 attribution rule cannot be
 * walked past by picking a different button on the form.
 */
export function parseRows(rows, { path = "bulk" } = {}) {
  const drafts = [];
  const rejected = [];

  for (const [index, cells] of (rows || []).entries()) {
    const line = index + 1;
    const text = cells.join("\t");

    if (cells.filter((cell) => cell !== "").length < 3) {
      rejected.push({
        line,
        text,
        why: "Fewer than three columns — need at least a name, a number and a condition",
      });
      continue;
    }
    // The header, in whatever case they typed it.
    if (/^(name|patient|s\.?no)$/i.test(cells[0])) continue;

    const draft = {
      patient_name: cells[0],
      phone_number: cells[1],
      disease: cells[2],
      source: cells[3],
      campaign: cells[4],
      branch: cells[5],
    };
    const problems = intakeProblems(draft, { path });
    if (problems.length) {
      rejected.push({ line, text, why: problems[0] });
      continue;
    }
    drafts.push(draft);
  }

  return { rows: drafts, rejected };
}

/** A pasted block of text, split into the same rows a spreadsheet produces. */
export function parseBulk(text, { path = "bulk" } = {}) {
  const rows = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|\s*,\s*|\s{2,}/).map((cell) => cell.trim()));

  return parseRows(rows, { path });
}
