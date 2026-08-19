// Role-based access — Thesis §29 (audit trail), §30.11 (roles and permissions),
// screens/05-admin-screens.md S6 (Roles, Permissions & User Manual).
//
// Five roles, one screen group each. A role sees its own screens and nothing else: an agent
// cannot open the scorecard that ranks them, a manager cannot open the founder's revenue
// screens, and leadership does not work a lead queue.
//
// Two layers, and both matter:
//
//   1. Route access — which screens a role may open at all.
//   2. Data scope — what a permitted screen is allowed to show. An agent's queue is their own
//      leads, not the team's; without this, hiding the manager's screens would be theatre,
//      because the agent screens would still carry everyone's data.
//
// This is client-side, so it is an interface boundary, not a security boundary. The same map
// has to be enforced server-side before real patient data goes anywhere near it — see the
// note in app/README.md.

/** Screen codes each role may open. Codes match the specification's screen inventory. */
export const ROLES = {
  agent: {
    key: "agent",
    label: "Agent",
    description: "Works a lead queue: calls, remarks, messages, the day's scheduled follow-ups.",
    screens: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"],
    home: "/",
    scope: "own", // only leads assigned to this user
  },
  manager: {
    key: "manager",
    label: "Manager",
    description: "Monitors the team: funnel, response clock, follow-up compliance, qualification audit.",
    screens: ["A0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "O1", "O2"],
    home: "/manager",
    scope: "team", // every lead, every agent
  },
  leadership: {
    key: "leadership",
    label: "Leadership",
    description: "Decides: the five questions, campaign ROI, cohorts, drill-down, the 15-day report.",
    screens: ["L1", "L2", "L3", "L5", "L6", "L7", "M2", "M11"],
    home: "/founder",
    scope: "all",
  },
  operations: {
    key: "operations",
    label: "Operations",
    description: "Works the appointment desk, financial counseling and the recovery pool.",
    screens: ["O1", "O2", "O4"],
    home: "/recovery",
    scope: "team",
  },
  admin: {
    key: "admin",
    label: "Administration",
    description: "Owns lead sources, templates, approvals and the audit trail.",
    screens: ["A0", "S1", "S3", "S5"],
    home: "/templates",
    scope: "all",
  },
};

/**
 * Demo accounts. One per role, plus a second agent seat so data scoping is visible: signing in
 * as one agent must not show the other agent's queue.
 *
 * Passwords are the username, held in plain text and compared in the browser. That is a demo
 * credential set, not authentication — a real deployment replaces this block with the hospital's
 * identity provider and checks the password on a server that never ships to a client.
 */
export const ACCOUNTS = [
  { username: "agent123", password: "agent123", name: "Nikhil Rao", role: "agent", branch: "Jayanagar" },
  { username: "sneha123", password: "sneha123", name: "Sneha Pillai", role: "agent", branch: "Whitefield" },
  { username: "manager123", password: "manager123", name: "Meera Raghavan", role: "manager", branch: "All branches" },
  { username: "leadership123", password: "leadership123", name: "Vikram Reddy", role: "leadership", branch: "All branches" },
  { username: "operations123", password: "operations123", name: "Anitha Kulkarni", role: "operations", branch: "All branches" },
  { username: "admin123", password: "admin123", name: "Ravi Shankar", role: "admin", branch: "All branches" },
];

export function accountByUsername(username) {
  const key = String(username || "").trim().toLowerCase();
  return ACCOUNTS.find((account) => account.username === key) || null;
}

/** The account when the pair matches, null when it does not. */
export function authenticate(username, password) {
  const account = accountByUsername(username);
  if (!account) return null;
  return account.password === String(password || "") ? account : null;
}

export function roleOf(user) {
  return user ? ROLES[user.role] : null;
}

/** Screen codes, mapped to the routes that render them. */

/**
 * What each screen is called in front of a user.
 *
 * The codes stay in the code, the tests and the specification, because that is where they are
 * useful. They are never rendered: an agent who reads "A6" learns nothing, and a product that
 * shows its own spec numbering reads as a document rather than a tool.
 */
export const SCREEN_NAMES = {
  A0: "Add a lead",
  A1: "My Leads",
  A2: "Lead detail",
  A3: "Log a call",
  A4: "Qualify a lead",
  A5: "Follow-up plan",
  A6: "Send a message",
  A7: "Daily Tasks",
  A8: "Appointment",
  A9: "Close a lead",
  A10: "After the consultation",
  M1: "Manager Dashboard",
  M2: "Daily Conversion Monitor",
  M3: "Funnel Dashboard",
  M4: "Follow-up Compliance",
  M5: "Assignment Board",
  M6: "Agent Scorecard",
  M7: "Team",
  M8: "Escalation & Objection Desk",
  M9: "Communication Performance",
  M10: "Vikku AI",
  M11: "Weekly Sheet Diagnosis",
  L1: "Founder Dashboard",
  L2: "Campaign ROI",
  L3: "Cohort Comparison",
  L5: "Drill-Down Explorer",
  L6: "15-Day Report",
  L7: "Ask",
  O1: "Appointments & No-shows",
  O2: "Financial Counseling Desk",
  O4: "Recovery & Reactivation",
  S1: "Lead Sources & Intake",
  S3: "Template Library",
  S5: "Audit Log",
};

export const ROUTE_SCREENS = [
  { path: "/", screen: "A1", exact: true },
  { path: "/tasks", screen: "A7" },
  { path: "/intake", screen: "A0" },
  { path: "/queue", screen: "A1" },
  // Everything about one lead lives under /leads/:id. The suffix picks the screen, because the
  // lead id sits in the middle of the path and a prefix match cannot see past it.
  { path: "/leads", screen: "A2" },
  { path: "/leads", suffix: "/call", screen: "A3" },
  { path: "/leads", suffix: "/qualify", screen: "A4" },
  { path: "/leads", suffix: "/plan", screen: "A5" },
  { path: "/leads", suffix: "/compose", screen: "A6" },
  { path: "/leads", suffix: "/appointment", screen: "A8" },
  { path: "/leads", suffix: "/close", screen: "A9" },
  { path: "/leads", suffix: "/treatment", screen: "A10" },
  { path: "/manager", screen: "M1" },
  { path: "/daily", screen: "M2" },
  { path: "/funnel", screen: "M3" },
  { path: "/compliance", screen: "M4" },
  { path: "/assign", screen: "M5" },
  { path: "/scorecard", screen: "M6" },
  { path: "/team", screen: "M7" },
  { path: "/escalations", screen: "M8" },
  { path: "/performance", screen: "M9" },
  { path: "/vikku", screen: "M10" },
  { path: "/sheet", screen: "M11" },
  { path: "/founder", screen: "L1" },
  { path: "/roi", screen: "L2" },
  { path: "/cohorts", screen: "L3" },
  { path: "/drill", screen: "L5" },
  { path: "/report", screen: "L6" },
  { path: "/ask", screen: "L7" },
  { path: "/appointments", screen: "O1" },
  { path: "/counseling", screen: "O2" },
  { path: "/recovery", screen: "O4" },
  { path: "/sources", screen: "S1" },
  { path: "/templates", screen: "S3" },
  { path: "/audit", screen: "S5" },
];

export function screenForPath(pathname) {
  // A suffix entry wins over a bare prefix: /leads/lead_001/close is A9, not A2.
  const suffixMatch = ROUTE_SCREENS.find(
    (entry) => entry.suffix && pathname.startsWith(`${entry.path}/`) && pathname.endsWith(entry.suffix)
  );
  if (suffixMatch) return suffixMatch.screen;

  const match = ROUTE_SCREENS.filter((entry) =>
    entry.suffix
      ? false
      : entry.exact
        ? pathname === entry.path
        : pathname === entry.path || pathname.startsWith(`${entry.path}/`)
  ).sort((a, b) => b.path.length - a.path.length)[0];
  return match?.screen ?? null;
}

/** Whether a role may open a screen code. */
export function canOpenScreen(user, screen) {
  const role = roleOf(user);
  if (!role || !screen) return false;
  // A2, A3 and A6 all sit under /leads, and the agent group owns all three.
  return role.screens.includes(screen);
}

export function canOpenPath(user, pathname) {
  return canOpenScreen(user, screenForPath(pathname));
}

/**
 * Data scope. `own` narrows to the signed-in agent by name, which is how the seeded leads and
 * the journey dataset identify an owner today; a real deployment keys on a user id.
 */
export function scopeRows(rows, user) {
  const role = roleOf(user);
  if (!role || role.scope !== "own") return rows;
  return rows.filter((row) => row.agent_name === user.name);
}

/** Whether this user may open one specific lead. Ownership, not just screen access. */
export function canOpenLead(user, lead) {
  const role = roleOf(user);
  if (!role || !lead) return false;
  if (!role.screens.includes("A2")) return false;
  if (role.scope !== "own") return true;
  return lead.agent_name === user.name;
}

/** The home a role lands on after signing in. */
export function homeFor(user) {
  return roleOf(user)?.home ?? "/signin";
}
