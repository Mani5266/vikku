// Make an API_USERS record for one person.
//
//   node scripts/make-user.mjs nikhil agent "Nikhil Rao" Jayanagar
//
// Prints the line to paste into the API_USERS environment variable in the Vercel dashboard. The
// password is generated here rather than chosen, because a password somebody invents for a
// colleague is a password that gets reused, and one nobody has to remember is one that can be long.
//
// Pass a password as a fifth argument only when somebody insists on choosing their own.
//
// The generated password is printed once, to this terminal, and is never stored anywhere. Give it
// to the person over a channel they already trust and do not keep a copy — the hash is the only
// thing that should survive this command.

import { randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const { hashPassword, ROLES } = await import(
  pathToFileURL(path.join(repoRoot, "api/_lib/users.mjs")).href
);

const [username, role = "agent", name = username, branch = "All branches", chosen] =
  process.argv.slice(2);

if (!username) {
  console.error("Usage: node scripts/make-user.mjs <username> [role] [name] [branch] [password]");
  console.error(`Roles: ${ROLES.join(", ")}`);
  process.exit(1);
}

if (!ROLES.includes(role)) {
  console.error(`"${role}" is not a role. Use one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

// Four words from a short list beats a random string somebody will write on a monitor. Long enough
// that the length does the work, ordinary enough that it can be read down a phone line.
const WORDS = [
  "amber", "anchor", "basil", "bridge", "camphor", "cedar", "compass", "copper", "coral", "cotton",
  "delta", "ember", "falcon", "granite", "harbour", "indigo", "ivory", "jasmine", "kettle", "lantern",
  "linen", "marble", "meadow", "monsoon", "nutmeg", "olive", "orchid", "pepper", "quartz", "ribbon",
  "saffron", "sandal", "silver", "tamarind", "teak", "temple", "thicket", "velvet", "walnut", "willow",
];

function generatePassword() {
  const picked = [];
  while (picked.length < 4) {
    // randomBytes rather than Math.random: a predictable password is not a password.
    const index = randomBytes(2).readUInt16BE(0) % WORDS.length;
    if (!picked.includes(WORDS[index])) picked.push(WORDS[index]);
  }
  return picked.join("-");
}

const password = chosen || generatePassword();
const hash = await hashPassword(password);

console.log("");
console.log("  Add this line to API_USERS:");
console.log("");
console.log(`    ${username}|${role}|${name}|${branch}|${hash}`);
console.log("");
console.log(`  Password for ${name}: ${password}`);
console.log("");
console.log("  Give them the password directly. It is not stored anywhere and cannot be recovered");
console.log("  from the line above — if it is lost, run this again to issue a new one.");
console.log("");
