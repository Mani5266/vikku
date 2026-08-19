// Render smoke test — every route, server-rendered, asserted on content.
// No test framework: the app installs none, and this does not add one.
//
//   npm run test:render
//
// Catches broken imports, guard-path crashes and empty screens. It renders the
// real pages against the real seed, so a change that breaks the Composer's
// verdict path fails here rather than in the browser.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { rm } from "node:fs/promises";

const appRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.join(appRoot, "node_modules/.smoke");
const { build } = await import(pathToFileURL(path.join(appRoot, "node_modules/vite/dist/node/index.js")).href);

await build({
  root: appRoot,
  configFile: path.join(appRoot, "vite.config.js"),
  logLevel: "warn",
  // Bundle React in rather than leaving it external: the aliases that let
  // implementation/ resolve its bare imports would otherwise pull in a second
  // React copy and every hook would fail.
  ssr: { noExternal: true },
  build: {
    ssr: path.join(appRoot, "test/smokeEntry.jsx"),
    outDir,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "smokeEntry.mjs" } },
  },
});

const { renderRoute } = await import(pathToFileURL(path.join(outDir, "smokeEntry.mjs")).href);

// [route, strings the rendered HTML must contain]
// A string prefixed with "!" must NOT appear — that is how the access rules are asserted:
// hiding data is a claim, and a claim needs a test.
const CASES = [
  // A1 + A7 merged into one home, grouped by urgency rather than by temperature, one button per
  // row. "My Leads" and "Daily Tasks" were two lists of the same leads in the same order, and
  // choosing between them was the agent's first decision every morning.
  [
    "/?as=agent123",
    [
      "Everything you owe today, worst first",
      "Start here",
      "Priya Sharma",
      "What they said last time",
      // Each group states its own reason, in the terms the money is lost in.
      "as a missed lead, not as a busy day",
      // Specification words an agent cannot act on must not be here.
      "!Message guard",
      "!OPTED OUT",
      "!rotation expects",
      "!My Leads",
      "!Daily Tasks",
    ],
  ],
  // The stage bar and the single instruction — the two things that were missing when the app was
  // a pile of screens with codes on them. Codes must not appear anywhere in the interface.
  [
    "/leads/lead_001?as=agent123",
    [
      "Everything that has happened",
      "Patient details",
      "Where it is",
      // Specification vocabulary an agent cannot act on. "Lifecycle stage 9" is the twenty-stage
      // ladder, "append-only" is a database property, and neither changes what they do next.
      "!Activity history",
      "!append-only",
      "!Lifecycle stage",
      "!Identity and consent",
      // The messaging panel, in the agent's words. It used to be headed "Next action rail" and
      // list "Message guard", "Rotation expects" and "Nurture step due" — the specification's
      // vocabulary, on the screen an agent opens for every single lead.
      "Messaging",
      "Can you message now?",
      "Send it by",
      "What to send",
      "Messages held back",
      "!Next action rail",
      "!Message guard",
      "!Rotation expects",
      "!Nurture step due",
      "!a guard fired",
      // A thesis section number is provenance for a reviewer, not an instruction for a telecaller.
      // It is suppressed for the agent role on every screen, not screen by screen.
      "!Thesis §",
      "Hot Lead",
      "What to do with this lead",
      "Qualify",
      "Work the plan",
      "Appointment",
      // Stage four was "Outcome" and completed at the consultation. It is the operation now.
      "Treatment",
      "Next step",
      "You are here",
    ],
  ],
  // A4 — the temperature falls out of eleven answers rather than a feeling.
  [
    "/leads/lead_001/qualify?as=agent123",
    [
      "Qualify Priya Sharma",
      "The eleven factors",
      "How bad are the symptoms?",
      "How urgent is treatment?",
      "Clinical context",
      "Answered 0 of 11",
    ],
  ],
  // A5 — the whole plan, and a missed day that stays missed.
  [
    "/leads/lead_001/plan?as=agent123",
    ["Hot Lead", "The plan, day by day", "Calls made on time", "Calls missed", "Move a day", "Day 1"],
  ],
  // A8 — the ten §17 states as a machine. Nothing is booked on this lead, so only the first rung
  // is reachable and every other state renders greyed.
  [
    "/leads/lead_001/appointment?as=agent123",
    [
      "Appointment — Priya Sharma",
      "Where this appointment stands",
      "Nothing booked yet",
      "Consultation Completed",
      "Greyed states are not reachable from here",
    ],
  ],
  // A9 — the closure that cannot be typed without evidence. lead_001 has a logged call, so the
  // picker has something real in it.
  [
    "/leads/lead_001/close?as=agent123",
    [
      "Close Priya Sharma",
      "Why did this lead not convert?",
      "What is this based on?",
      "Still needed:",
      "Evidence — pick the call or message this is based on",
      "Call ·",
    ],
  ],
  // A lead with no activity at all cannot be closed with a diagnosed reason — there is nothing
  // to cite, and the screen says so instead of offering a blank dropdown.
  [
    "/leads/lead_009/close?as=agent123",
    ["There is nothing on this lead to cite", "Log the call first"],
  ],
  // A3 — the fast path: one tap for a dial that went nowhere, tappable phrases for the remark,
  // presets for the follow-up time, temperature on the same screen as the call.
  [
    "/leads/lead_001/call?as=agent123",
    [
      // Retitled from "Did not speak to them?", and the hint now names the patient the tap will
      // take you to. These six buttons look like the selection chips elsewhere on the screen and
      // instead save the call and navigate, which is what made the patient name appear to change
      // on its own.
      "Nobody picked up?",
      "takes you to",
      "No answer",
      "What did the patient say?",
      "Wants the surgery but has to arrange money first.",
      "How interested are they?",
      "Puts 3 calls and 3 messages on your list over 5 days.",
      "Tomorrow morning",
      // The outstanding parts are one chip each now rather than a comma-separated run-on beside
      // the buttons, so the label and the items are asserted separately. "How interested they are"
      // is appended by the screen rather than by the shipped missingRemarkParts(), and it used to
      // be the one item in lower case.
      "Still needed",
      "What the patient said",
      "How interested they are",
      "Full form — all seven parts",
      "!Structured remark (seven parts)",
      "!Sub-reason",
    ],
  ],
  // 12h since the last message: the floor blocks, the override offer appears.
  // A6 was "Communication Composer", a name from the specification that told an agent nothing
  // about when it applies. It is now a step inside working the plan, and says so.
  [
    "/leads/lead_002/compose?as=agent123",
    ["TOO SOON", "48h", "Request exception send", "Send a message", "Part of working the plan", "!Communication Composer"],
  ],
  // Cold lead whose last touch was the MMS fallback: rotation swings back to WhatsApp.
  ["/leads/lead_003/compose?as=sneha123", ["Nurture position", "No — MMS fallback", "Acknowledgement"]],
  // Hard stop: no override, and the send button is disabled.
  ["/leads/lead_005/compose?as=agent123", ["OPTED OUT", "Patient has opted out"]],
  ["/leads/lead_007/compose?as=agent123", ["CONVERTED"]],
  ["/templates?as=admin123", ["Template Library", "Pending approval", "Lint flagged"]],
  ["/performance?as=manager123", ["Communication Performance", "Cadence proof", "Fatigue"]],
  ["/audit?as=admin123", ["Audit Log"]],
  // A7 — the auto-scheduled queue. Fatima Sheikh arrived 20h ago and was never
  // called, so her first-touch SLA is breached and the manager alert renders.
  [
    "/tasks?as=sneha123",
    [
      "Fatima Sheikh",
      "Ring now",
      "Call now — first call not made yet",
      "Start here",
      "!Daily Tasks",
      "!SLA breached",
      "!§12",
    ],
  ],
  // M1 — the funnel the manager writes by hand today, computed from journeys.
  // The chart band and the "vs last week" deltas the reference board is built around, alongside
  // the tables they summarise — a picture on this screen is never the only copy of a number.
  [
    "/manager?as=manager123",
    [
      "Manager Dashboard",
      "Leads per day",
      "Where the leads came from",
      "Where the funnel loses them",
      "from last week",
      "Funnel by source",
      "First response time against outcome",
      "Follow-up compliance by agent",
      "Transcript supports",
    ],
  ],
  // L1 — the five questions of §2, each with its evidence table.
  [
    "/founder?as=leadership123",
    [
      "Founder Dashboard",
      "Where are the leads coming from?",
      "What is happening to every lead after it enters the system?",
      "Why are some leads converting?",
      "Why are some leads not converting?",
      "What action should management take",
      "Against the industry standard",
      "Leads arriving per day",
      "Share of leads by source",
    ],
  ],
  // L7 — the ask bar, answering its default question with the interpretation shown.
  ["/ask?as=leadership123", ["How this was read", "grouped by: source", "Funnel by source", "Download"]],
  // M3 — the eleven §26 transitions, with the recovery rates beside them.
  [
    "/funnel?as=manager123",
    [
      "Funnel Dashboard",
      "Lead → Connected",
      "Surgery advised → Financial counseling done",
      "Admitted → Treatment completed",
      "Recovery rates",
      "Not Connected recovery",
      "Where the most leads are dropping",
    ],
  ],
  // M6 — §28's two columns, never merged, with the lead mix between them.
  [
    "/scorecard?as=manager123",
    ["Agent Scorecard", "Outcome performance", "Lead mix handed to each agent", "Process compliance", "Qualification accuracy"],
  ],
  // M10 — opens on the mic and nothing else: no report until someone asks for one.
  ["/vikku?as=manager123", ["Vikku AI", "Tap the mic and ask", "Ask by voice"]],
  // The same screen with a question in the URL answers in the client's own sheet format,
  // columns and spelling intact.
  [
    "/vikku?q=last%20week%20report&as=manager123",
    ["PERSENTAGE", "Not Connected leads", "Pending Follow-up", "Subtotal", "Grand Total", " TO "],
  ],
  // M11 — the only screen that runs on the hospital's real numbers rather than generated ones.
  // Opens empty on purpose: nothing is computed until their sheet is pasted in.
  [
    "/sheet?as=manager123",
    [
      "Weekly Sheet Diagnosis",
      "Paste the sheet",
      "Load the 01-08 to 07-08 week",
      "!222",
    ],
  ],
  // Leadership owns it too — the MD is the audience for the red column.
  ["/sheet?as=leadership123", ["Weekly Sheet Diagnosis"]],
  // An agent has no business in the hospital-wide numbers.
  ["/sheet?as=agent123", ["This screen belongs to another role", "The Weekly Sheet Diagnosis screen is"]],
  // L2 — cost per surgery first, and the quality-against-execution split.
  ["/roi?as=leadership123", ["Source &amp; Campaign ROI", "Lowest cost per surgery", "Cost / surgery", "not working"]],
  // L3 — the §22 factors with the base each rate is computed over.
  ["/cohorts?as=leadership123", ["Cohort Comparison", "Average first response time", "Conversion pattern", "Non-conversion pattern", "Base"]],
  // L5 — the §25 ladder plus the §33 conclusion block.
  [
    "/drill?as=leadership123",
    ["Drill-Down Explorer", "Level 1 · Overall conversions", "Conversion type", "Conclusion", "Review date", "Root cause"],
  ],
  // L6 — §32's three windows and the two questions.
  [
    "/report?as=leadership123",
    ["15-Day Diagnostic Report", "Week 1", "Week 2", "Overall 15 days", "Why did leads convert?", "Why did leads not convert?"],
  ],
  // O4 — §19 segments, with §20's exclusions enforced rather than described.
  ["/recovery?as=operations123", ["Recovery &amp; Reactivation Console", "Recoverable", "Long-Term Nurture", "Genuine Lost", "Still winnable"]],

  // The thesis reference follows the role rather than the file. Six of the eight agent screens
  // were still printing it after the queue and the call screen had it removed one at a time.
  ["/leads/lead_001/qualify?as=agent123", ["Qualify Priya Sharma", "!Thesis §"]],
  ["/leads/lead_001/plan?as=agent123", ["!Thesis §"]],
  ["/leads/lead_001/appointment?as=agent123", ["!Thesis §"]],
  ["/leads/lead_001/close?as=agent123", ["!Thesis §"]],
  ["/leads/lead_001/compose?as=agent123", ["!Thesis §"]],
  // A manager is checking this build against the specification, so they keep the citation.
  ["/funnel?as=manager123", ["Thesis §"]],

  // A10 — the half of the funnel that ran off the end of the product. A patient seen by the doctor
  // and advised surgery used to be marked converted and filed under Finished.
  [
    "/leads/lead_046/treatment?as=agent123",
    [
      "After the consultation — Shankar Naik",
      "What did the doctor decide?",
      "Surgery advised",
      "Medical management",
      "Not a lost lead",
      "What stands between here and the operation",
      "Money talk done",
      "The money talk",
      "Book the money talk",
      "!Nothing — they saw the doctor",
    ],
  ],
  // The queue puts these above everything else, and says why.
  [
    "/?as=agent123",
    [
      "Seen the doctor — finish the job",
      "Shankar Naik",
      "closest to a decision",
      "!Nothing — they saw the doctor",
    ],
  ],
  // A booked surgery is the one post-consultation state that is genuinely finished.
  ["/leads/lead_051/treatment?as=agent123", ["After the consultation — Kamala Reddy", "Surgery booked"]],
  // Somebody else's lead is still somebody else's.
  ["/leads/lead_047/treatment?as=agent123", ["This screen belongs to another role", "!What stands between here and the operation"]],

  // ---- the eight screens the specification described and nobody had built ---
  // Each assertion below is the one refusal that screen exists to make. A screen that renders
  // and does not make its refusal has not been built, it has been drawn.

  // M2 — the part-day must never be reported as a collapse, and no figure appears alone.
  [
    "/daily?as=manager123",
    [
      "Daily Conversion Monitor",
      "Reporting on",
      "is still being filled",
      "The stage strip",
      "7-day average",
      "30-day average",
      "Measured as",
      // A target nobody agreed to is exactly what this screen refuses to compare against.
      "!Target",
    ],
  ],

  // M4 — the split §28 requires, on the screen and on every row.
  [
    "/compliance?as=manager123",
    [
      "Follow-up Compliance",
      "Touches nobody made",
      "Messages the platform failed to deliver",
      "This is a ticket, not an appraisal",
      "Hot lead, plan slipped",
      "Cause",
      "Delivery failure",
    ],
  ],

  // M5 — the board says plainly what it is counting, because "unassigned" would find nothing.
  [
    "/assign?as=manager123",
    [
      "Assignment Board",
      "never touched by anybody",
      "Should route to",
      "Agent capacity",
      "audit log",
    ],
  ],

  // M7 — the deactivation guard, and the absent person's queue still visible.
  [
    "/team?as=manager123",
    [
      "Team",
      "On leave",
      "Leads nobody is covering",
      "capacity actually on shift",
      "have nobody working them",
    ],
  ],

  // M8 — §33's finding, computed rather than quoted.
  [
    "/escalations?as=manager123",
    [
      "Escalation &amp; Objection Desk",
      "never reached that owner",
      "Financial counselor",
      "No live detector",
      "Closed without",
    ],
  ],

  // O1 — the no-show attribution, and the honest statement about the missing calendar.
  [
    "/appointments?as=operations123",
    [
      "Appointments &amp; No-shows",
      "never received the full reminder sequence",
      "Reminders per kept appointment",
      "no appointment time anywhere in the data",
      "Confirmation queue",
    ],
  ],

  // O2 — the guard that is the whole point of the screen, in both directions.
  [
    "/counseling?as=operations123",
    [
      "Financial Counseling Desk",
      "never received a counseling conversation",
      "cannot be closed for a price reason",
      "Financial counseling not completed",
      "process compliance and never as an outcome",
      // The budget gap is never estimated.
      "stated budget",
    ],
  ],

  // S1 — the truncated hierarchy named as the reason leadership cannot rank a creative.
  [
    "/sources?as=admin123",
    [
      "Lead Sources &amp; Intake",
      "mandatory attribution fields are missing",
      "What its absence blocks",
      "Configured, silent",
      "Duplicate detection",
    ],
  ],

  // The role boundary on the new screens. Each of these is a claim that hiding works — asserted
  // against a line only the real screen renders, because the refusal page names the screen it is
  // refusing, which is deliberate and would make a bare title check pass for the wrong reason.
  ["/counseling?as=agent123", ["This screen belongs to another role", "!never received a counseling conversation"]],
  ["/assign?as=agent123", ["This screen belongs to another role", "!Should route to"]],
  ["/sources?as=manager123", ["This screen belongs to another role", "!What its absence blocks"]],
  ["/escalations?as=leadership123", ["This screen belongs to another role", "!never reached that owner"]],
  // Leadership owns M2 alongside the manager — §31 names both.
  ["/daily?as=leadership123", ["Daily Conversion Monitor", "The stage strip"]],
  // Operations owns the appointment and counseling desks; the manager sees them too (§17).
  ["/appointments?as=manager123", ["Appointments &amp; No-shows"]],
  // ---- role-based access ---------------------------------------------------
  // No session at all: the only screen is the sign-in screen.
  // No session at all: one landing page that asks who is signing in, and shows nobody's password
  // until a role is picked. The credentials used to sit on this screen, all six of them.
  [
    "/",
    [
      "Sign in to continue",
      "Sign in as",
      "Agent",
      "Manager",
      "Leadership",
      "Operations",
      "Administration",
      "!agent123",
      "!manager123",
      "!leadership123",
      "!Password",
    ],
  ],
  // An agent cannot open the manager's dashboard, and the refusal names whose screen it is.
  ["/manager?as=agent123", ["This screen belongs to another role", "The Manager Dashboard screen is", "Nikhil Rao", "Back to my screens", "!Screen M1"]],
  // A manager cannot open the founder's screens either: a role sees its own group, not more.
  ["/founder?as=manager123", ["This screen belongs to another role", "The Founder Dashboard screen is"]],
  ["/vikku?as=agent123", ["This screen belongs to another role", "The Vikku AI screen is"]],
  // Screen access is not lead access: lead_003 belongs to Sneha Pillai, not Nikhil Rao.
  ["/leads/lead_003?as=agent123", ["This screen belongs to another role", "The Lead detail screen is"]],
  // Signing in at "/" as a non-agent redirects to that role's own home rather than refusing.
  // The redirect itself resolves in the browser, so what is asserted here is that the refusal
  // never renders; the destinations are checked in test/rbac.test.mjs.
  ["/?as=manager123", ["!This screen belongs to another role", "!Start here"]],
  ["/?as=leadership123", ["!This screen belongs to another role", "!Start here"]],
  ["/?as=operations123", ["!This screen belongs to another role", "!Start here"]],
  ["/?as=admin123", ["!This screen belongs to another role", "!Start here"]],
  // A queue is scoped to its own agent: Anita Desai and Fatima Sheikh are Sneha's, and
  // Nikhil's leads must not be on her screen at all.
  ["/?as=sneha123", ["Anita Desai", "Fatima Sheikh", "!Priya Sharma", "!Mohan Rao"]],
  // The nav only carries the role's own group — no door the role cannot open.
  ["/?as=agent123", ["Today", "!Founder Dashboard", "!Manager Dashboard", "!Vikku AI", "!Daily Tasks"]],
  ["/manager?as=manager123", ["Manager Dashboard", "Vikku AI", "!Founder Dashboard", "!Campaign ROI"]],
  ["/founder?as=leadership123", ["Founder Dashboard", "Campaign ROI", "!Agent Scorecard", "!Start here"]],
];

let failures = 0;

for (const [route, expectations] of CASES) {
  let html;
  try {
    html = renderRoute(route);
  } catch (error) {
    failures++;
    console.log(`FAIL ${route} — threw: ${error.message}`);
    continue;
  }

  const missing = expectations.filter((text) => !text.startsWith("!") && !html.includes(text));
  const leaked = expectations
    .filter((text) => text.startsWith("!"))
    .map((text) => text.slice(1))
    .filter((text) => html.includes(text));

  if (missing.length || leaked.length) {
    failures++;
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(" | ")}`);
    if (leaked.length) parts.push(`leaked: ${leaked.join(" | ")}`);
    console.log(`FAIL ${route} — ${parts.join("; ")}`);
  } else {
    console.log(`ok   ${route}`);
  }
}

await rm(outDir, { recursive: true, force: true });

if (failures) {
  console.log(`\n${failures} route(s) failed`);
  process.exit(1);
}
console.log(`\n${CASES.length} routes rendered, all assertions passed`);
