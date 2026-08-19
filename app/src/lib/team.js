// M7. Team — Thesis §28 (agent performance must be data-based), §30.2 (assignment).
//
// Roster, capacity and coverage. Not a scorecard: M6 judges how an agent performed, M7
// answers whether the desk is staffed for tomorrow and who covers Sneha's leads when she
// takes leave.
//
// A line has to be drawn here between two kinds of field, and the file draws it explicitly
// because blurring it is how a demo starts lying:
//
//   · **Roster facts** — role, branch, languages, disease skills, shift, capacity cap,
//     leave. None of these exist in the journey dataset. They are configuration, held in
//     `ROSTER` below, and a real deployment reads them from the HR system.
//   · **Load facts** — open leads, Hot leads, overdue, completions. Every one of these is
//     computed from the journeys, so the roster and the queue cannot disagree.
//
// Anything the screen shows carries `source: "roster"` or `source: "measured"` so the two
// are never confused on the way to a decision about a person.

import { pct } from "./funnel.js";
import { DEFAULT_CAPACITY } from "./assignment.js";

/**
 * The desk as configured. Names match the journey dataset's agents and the demo accounts
 * in rbac.js, so signing in as an agent and opening M7 shows the same person.
 */
export const ROSTER = [
  {
    name: "Nikhil Rao",
    role: "Telecaller",
    branch: "Jayanagar",
    shift: "Morning · 9:00–18:00",
    languages: ["Kannada", "English", "Hindi"],
    skills: ["Piles", "Circumcision", "Hernia"],
    capacity: DEFAULT_CAPACITY,
    active: true,
    onLeave: false,
  },
  {
    name: "Sneha Pillai",
    role: "Telecaller",
    branch: "Whitefield",
    shift: "Morning · 9:00–18:00",
    languages: ["Malayalam", "English", "Tamil"],
    skills: ["Varicose Veins", "Gallstones", "Thyroid"],
    capacity: DEFAULT_CAPACITY,
    active: true,
    onLeave: false,
  },
  {
    name: "Arjun Verma",
    role: "Senior telecaller",
    branch: "Jayanagar",
    shift: "Afternoon · 12:00–21:00",
    languages: ["Hindi", "English"],
    skills: ["Knee Replacement", "Gallstones", "Piles"],
    capacity: DEFAULT_CAPACITY,
    active: true,
    onLeave: false,
  },
  {
    name: "Divya Menon",
    role: "Telecaller",
    branch: "Whitefield",
    shift: "Afternoon · 12:00–21:00",
    languages: ["Malayalam", "Kannada", "English"],
    skills: ["Cataract", "Thyroid", "Circumcision"],
    capacity: DEFAULT_CAPACITY,
    active: true,
    onLeave: true,
  },
];

/** Everything about one agent that can be measured from their leads. */
export function loadFor(rows, name) {
  const owned = rows.filter((row) => row.agent_name === name);
  const open = owned.filter((row) => row.status === "Pending");
  const converted = owned.filter((row) => row.surgery_completed);
  const owed = owned.reduce((sum, row) => sum + (row.followups_required ?? 0), 0);
  const done = owned.reduce((sum, row) => sum + Math.min(row.followups_done ?? 0, row.followups_required ?? 0), 0);

  return {
    lifetimeLeads: owned.length,
    open: open.length,
    hot: open.filter((row) => row.temperature === "Hot").length,
    warm: open.filter((row) => row.temperature === "Warm").length,
    cold: open.filter((row) => row.temperature === "Cold").length,
    overdue: open.filter((row) => !row.followup_compliant).length,
    untouched: open.filter((row) => row.first_touch_minutes === null).length,
    conversions: converted.length,
    conversionRate: pct(converted.length, owned.length),
    followupsOwed: owed,
    followupsDone: done,
    executionRate: pct(done, owed),
  };
}

/** The roster with its measured load beside it, heaviest first. */
export function teamRoster(rows, { roster = ROSTER } = {}) {
  return roster
    .map((person) => {
      const load = loadFor(rows, person.name);
      return {
        ...person,
        value: person.name,
        ...load,
        loadShare: pct(load.open, person.capacity),
        headroom: Math.max(0, person.capacity - load.open),
        atCapacity: load.open >= person.capacity,
        // Someone on leave still owns leads. That is precisely the coverage gap M7 exists
        // to surface, so it is a state on the row rather than a filter that hides them.
        uncovered: person.onLeave ? load.open : 0,
      };
    })
    .sort((a, b) => b.loadShare - a.loadShare);
}

/** Desk-level rollups of the same figures, so the team reads as a team and not four rows. */
export function teamTotals(rows, { roster = ROSTER } = {}) {
  const lines = teamRoster(rows, { roster });
  const active = lines.filter((line) => line.active && !line.onLeave);
  const sum = (key) => lines.reduce((total, line) => total + line[key], 0);

  return {
    people: lines.length,
    onShift: active.length,
    onLeave: lines.filter((line) => line.onLeave).length,
    open: sum("open"),
    hot: sum("hot"),
    overdue: sum("overdue"),
    capacity: lines.filter((line) => line.active && !line.onLeave).reduce((total, line) => total + line.capacity, 0),
    uncovered: sum("uncovered"),
    // Load against the capacity actually on shift, not against the capacity on the payroll.
    // Those are different numbers on any day somebody is away, and only one of them is true.
    utilisation: pct(
      sum("open"),
      lines.filter((line) => line.active && !line.onLeave).reduce((total, line) => total + line.capacity, 0)
    ),
  };
}

/**
 * Which diseases and languages nobody on shift covers today.
 *
 * This is the reason the screen exists. Four names and a capacity bar is a staffing table;
 * "there is nobody on shift who speaks Tamil and eleven open Tamil-speaking leads" is a
 * decision.
 */
export function coverageGaps(rows, { roster = ROSTER } = {}) {
  const onShift = roster.filter((person) => person.active && !person.onLeave);
  const covered = new Set(onShift.flatMap((person) => person.skills));
  const open = rows.filter((row) => row.status === "Pending");

  const diseases = [...new Set(open.map((row) => row.disease))]
    .map((disease) => ({
      value: disease,
      openLeads: open.filter((row) => row.disease === disease).length,
      covered: covered.has(disease),
      coveredBy: onShift.filter((person) => person.skills.includes(disease)).map((person) => person.name),
    }))
    .filter((line) => !line.covered && line.openLeads > 0)
    .sort((a, b) => b.openLeads - a.openLeads);

  return {
    onShift: onShift.map((person) => person.name),
    gaps: diseases,
    // A gap is only worth acting on if leads are actually sitting in it.
    leadsInGaps: diseases.reduce((sum, line) => sum + line.openLeads, 0),
  };
}

/**
 * The guard: deactivating a person forces reassignment of their open leads before the
 * change commits.
 *
 * Returned as problems rather than a boolean so the screen can print the count that blocks
 * the change — "63 open leads have to move first" is actionable; "cannot deactivate" is not.
 */
export function deactivationProblems(person, { reassignTo } = {}) {
  const problems = [];
  if (!person) return ["Pick a person to deactivate"];
  if (person.open > 0 && !reassignTo) {
    problems.push(
      `${person.value} still owns ${person.open} open lead(s). Choose who takes them before deactivating — a deactivated owner is how a lead becomes invisible.`
    );
  }
  if (reassignTo && reassignTo.value === person.value) {
    problems.push("Leads cannot be reassigned to the person being deactivated");
  }
  if (reassignTo?.atCapacity) {
    problems.push(`${reassignTo.value} is already at capacity — moving ${person.open} more leads there hides the same problem under a different name`);
  }
  return problems;
}

/** Covering an absence: who can take the leads, best fit first. */
export function coverCandidates(lines, person) {
  return lines
    .filter((line) => line.value !== person.value && line.active && !line.onLeave)
    .map((line) => ({
      ...line,
      sharedSkills: line.skills.filter((skill) => person.skills.includes(skill)),
      sharedLanguages: line.languages.filter((language) => person.languages.includes(language)),
      fits: line.headroom >= person.open,
    }))
    .sort(
      (a, b) =>
        Number(b.fits) - Number(a.fits) ||
        b.sharedSkills.length - a.sharedSkills.length ||
        b.headroom - a.headroom
    );
}
