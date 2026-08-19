// Access-rule self-check — the role map, tested as a table rather than described in prose.
//
//   npm run test:rbac
//
// src/lib/rbac.js imports nothing, so this runs under plain Node with no bundler and no test
// framework, in the same style as the engine self-check.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rbac = await import(
  pathToFileURL(path.resolve(import.meta.dirname, "../src/lib/rbac.js")).href
);
const { ACCOUNTS, authenticate, canOpenLead, canOpenScreen, homeFor, scopeRows, screenForPath } = rbac;

let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  void name;
};

const account = (username) => ACCOUNTS.find((a) => a.username === username);
const agent = account("agent123");
const otherAgent = account("sneha123");
const manager = account("manager123");
const leadership = account("leadership123");
const operations = account("operations123");
const admin = account("admin123");

// ---- credentials -----------------------------------------------------------
check("every demo account signs in with its own password", () => {
  for (const a of ACCOUNTS) assert.equal(authenticate(a.username, a.password)?.username, a.username);
});

check("a wrong password is refused", () => {
  assert.equal(authenticate("manager123", "agent123"), null);
  assert.equal(authenticate("manager123", ""), null);
  assert.equal(authenticate("manager123", undefined), null);
});

check("an unknown username is refused", () => {
  assert.equal(authenticate("nobody", "nobody"), null);
});

check("the username is case-insensitive and trimmed, the password is not", () => {
  assert.equal(authenticate("  Manager123 ", "manager123")?.role, "manager");
  assert.equal(authenticate("manager123", "Manager123"), null);
});

// ---- route access ----------------------------------------------------------
check("paths map to their screen codes", () => {
  assert.equal(screenForPath("/"), "A1");
  assert.equal(screenForPath("/tasks"), "A7");
  // The lead id sits in the middle of the path, so the screen comes off the suffix. Before the
  // agent's four remaining screens existed, everything under /leads answered A2.
  assert.equal(screenForPath("/leads/lead_001"), "A2");
  assert.equal(screenForPath("/leads/lead_001/call"), "A3");
  assert.equal(screenForPath("/leads/lead_001/qualify"), "A4");
  assert.equal(screenForPath("/leads/lead_001/plan"), "A5");
  assert.equal(screenForPath("/leads/lead_001/compose"), "A6");
  assert.equal(screenForPath("/leads/lead_001/appointment"), "A8");
  assert.equal(screenForPath("/leads/lead_001/close"), "A9");
  assert.equal(screenForPath("/manager"), "M1");
  assert.equal(screenForPath("/daily"), "M2");
  assert.equal(screenForPath("/compliance"), "M4");
  assert.equal(screenForPath("/assign"), "M5");
  assert.equal(screenForPath("/team"), "M7");
  assert.equal(screenForPath("/escalations"), "M8");
  assert.equal(screenForPath("/vikku"), "M10");
  assert.equal(screenForPath("/founder"), "L1");
  // /appointments is the operations board; /leads/:id/appointment is the agent's booking screen.
  // They differ by one character and mean different things, so both are pinned here.
  assert.equal(screenForPath("/appointments"), "O1");
  assert.equal(screenForPath("/leads/lead_001/appointment"), "A8");
  assert.equal(screenForPath("/counseling"), "O2");
  assert.equal(screenForPath("/recovery"), "O4");
  assert.equal(screenForPath("/sources"), "S1");
  assert.equal(screenForPath("/nowhere"), null);
});

check("each role opens its own group and no other", () => {
  const matrix = [
    [agent, ["A1", "A2", "A3", "A6", "A7"], ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "L1", "L2", "O1", "O2", "O4", "S1", "S3", "S5"]],
    // The manager owns the appointment and counseling desks alongside operations — §17 names
    // both roles on O1 and O2 — and does not own the administration group.
    [manager, ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "O1", "O2"], ["A1", "A7", "L1", "L5", "O4", "S1", "S3", "S5"]],
    // §31 puts leadership on the daily monitor and nowhere else in the manager group.
    [leadership, ["L1", "L2", "L3", "L5", "L6", "L7", "M2"], ["A1", "M1", "M4", "M5", "M6", "M7", "M8", "M10", "O1", "O2", "O4", "S1", "S5"]],
    [operations, ["O1", "O2", "O4"], ["A1", "M1", "M2", "L1", "S1", "S3"]],
    [admin, ["S1", "S3", "S5"], ["A1", "M1", "M2", "L1", "O1", "O2", "O4"]],
  ];
  for (const [user, allowed, denied] of matrix) {
    for (const screen of allowed) assert.equal(canOpenScreen(user, screen), true, `${user.role} ${screen}`);
    for (const screen of denied) assert.equal(canOpenScreen(user, screen), false, `${user.role} ${screen}`);
  }
});

check("nobody signed in opens nothing", () => {
  assert.equal(canOpenScreen(null, "A1"), false);
  assert.equal(canOpenScreen(undefined, "L1"), false);
});

check("an unmapped path is not openable by any role", () => {
  for (const user of ACCOUNTS) assert.equal(canOpenScreen(user, screenForPath("/nowhere")), false);
});

// ---- data scope ------------------------------------------------------------
const ROWS = [
  { id: 1, agent_name: "Nikhil Rao" },
  { id: 2, agent_name: "Sneha Pillai" },
  { id: 3, agent_name: "Nikhil Rao" },
];

check("an agent's rows are their own", () => {
  assert.deepEqual(scopeRows(ROWS, agent).map((r) => r.id), [1, 3]);
  assert.deepEqual(scopeRows(ROWS, otherAgent).map((r) => r.id), [2]);
});

check("a manager, leadership, operations and admin see every row", () => {
  for (const user of [manager, leadership, operations, admin]) {
    assert.equal(scopeRows(ROWS, user).length, 3, user.role);
  }
});

check("lead access is ownership, not just screen access", () => {
  const nikhilsLead = { agent_name: "Nikhil Rao" };
  const snehasLead = { agent_name: "Sneha Pillai" };
  assert.equal(canOpenLead(agent, nikhilsLead), true);
  assert.equal(canOpenLead(agent, snehasLead), false);
  assert.equal(canOpenLead(otherAgent, snehasLead), true);
  // A manager owns no lead screen at all, so ownership never even comes up.
  assert.equal(canOpenLead(manager, nikhilsLead), false);
  assert.equal(canOpenLead(agent, null), false);
});

// ---- landing ---------------------------------------------------------------
check("each role lands on its own home", () => {
  assert.equal(homeFor(agent), "/");
  assert.equal(homeFor(manager), "/manager");
  assert.equal(homeFor(leadership), "/founder");
  assert.equal(homeFor(operations), "/recovery");
  assert.equal(homeFor(admin), "/templates");
  assert.equal(homeFor(null), "/signin");
});

check("every role's home is a screen that role can open", () => {
  for (const user of ACCOUNTS) {
    assert.equal(canOpenScreen(user, screenForPath(homeFor(user))), true, user.username);
  }
});

check("every role on the sign-in picker has an account behind it", () => {
  // The landing page offers one card per role and fills the form from that role's first account.
  // A role with no account would render a card that leads to an empty form.
  for (const key of Object.keys(rbac.ROLES)) {
    const accounts = rbac.ACCOUNTS.filter((account) => account.role === key);
    assert.ok(accounts.length >= 1, `role ${key} has no demo account`);
    assert.ok(rbac.authenticate(accounts[0].username, accounts[0].password), `${key}'s first account cannot sign in`);
  }
});

check("only the agent owns the nine agent screens", () => {
  const agentScreens = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"];
  const agent = ACCOUNTS.find((account) => account.role === "agent");
  for (const screen of agentScreens) {
    assert.equal(canOpenScreen(agent, screen), true, `agent cannot open ${screen}`);
  }
  for (const user of ACCOUNTS.filter((account) => account.role !== "agent")) {
    for (const screen of agentScreens) {
      assert.equal(canOpenScreen(user, screen), false, `${user.username} can open ${screen}`);
    }
  }
});

console.log(`${checks} access checks passed`);
