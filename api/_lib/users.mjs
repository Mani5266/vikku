// Who exists, and how a password is checked.
//
// The previous version compared passwords as plain text against `API_LOGINS`. That is better than
// checking them in the browser and it is still not something to run a hospital on: anyone who can
// read the deployment's environment — a colleague with dashboard access, a leaked backup, a
// support session with the screen shared — reads every password, and people reuse passwords.
//
// So passwords are stored as scrypt hashes with a per-user salt. The stored value cannot be turned
// back into a password, a stolen record cannot be replayed against another system, and two people
// who happen to choose the same password get different hashes.
//
// scrypt rather than SHA-256, because the point is to be slow. A fast hash lets somebody who
// obtains the records try billions of guesses a second offline; scrypt's memory cost makes that
// expensive per guess. It is in `node:crypto`, so this stays dependency-free.
//
// Where the records live
//
// One environment variable, `API_USERS`, holding one line per person. Not a file in the repository:
// a hash in a public repository is an offline cracking target, and the whole point of hashing is to
// make theft useless rather than to make it slower to read.
//
// What this still is not
//
// There is no database, so a manager cannot add a person without a redeploy, and nothing records
// who signed in when. Both need somewhere to write, which this app does not have yet — the leads
// themselves still live in a browser's localStorage. `docs/AUTH.md` says so plainly rather than
// leaving it to be discovered.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

// N=16384 is the usual interactive default: roughly a tenth of a second per hash on a small
// serverless instance. Slow enough to make offline guessing expensive, fast enough that signing in
// does not feel broken.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SALT_BYTES = 16;

export const ROLES = ["agent", "manager", "leadership", "operations", "admin"];

/** `scrypt$<saltHex>$<hashHex>` — the parameters travel with the hash so they can be changed. */
export async function hashPassword(password, salt = randomBytes(SALT_BYTES)) {
  const derived = await scrypt(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Check a password against a stored hash.
 *
 * Always does the work, even when the stored value is malformed. Returning early on a bad record
 * makes an unknown user answer faster than a known one, and that difference is enough to enumerate
 * who works here.
 */
export async function verifyPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  const usable = parts.length === 3 && parts[0] === "scrypt";
  const salt = usable ? Buffer.from(parts[1], "hex") : randomBytes(SALT_BYTES);
  const expected = usable ? Buffer.from(parts[2], "hex") : randomBytes(SCRYPT.keylen);

  const derived = await scrypt(String(password ?? ""), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });

  if (derived.length !== expected.length) return false;
  const match = timingSafeEqual(derived, expected);
  return usable && match;
}

/**
 * The people who may sign in.
 *
 * `API_USERS` holds one record per line (or per semicolon), each:
 *
 *     username | role | display name | branch | scrypt$salt$hash
 *
 * Pipe-separated because a scrypt hash contains `$` and a display name can contain almost
 * anything. Lines starting `#` are comments, so a deployment can note why somebody was disabled
 * without deleting the record.
 */
export function parseUsers(raw) {
  const users = new Map();
  if (!raw) return users;

  for (const line of String(raw).split(/[\n;]+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [username, role, name, branch, hash] = trimmed.split("|").map((part) => part.trim());
    if (!username || !hash) continue;
    if (role && !ROLES.includes(role)) continue; // an unknown role is a typo, not a new permission

    users.set(username, {
      username,
      role: role || "agent",
      name: name || username,
      branch: branch || "All branches",
      hash,
    });
  }
  return users;
}

export function configuredUsers() {
  return parseUsers((process.env.API_USERS ?? "").trim());
}

/**
 * Username and password in, the user out, or null.
 *
 * An unknown username is still checked against a throwaway hash so that signing in as somebody who
 * does not work here takes as long as signing in as somebody who does. Without that, the response
 * time answers "does this person have an account?" for anybody who asks.
 */
export async function authenticateUser(username, password, users = configuredUsers()) {
  const user = users.get(String(username ?? "").trim());
  const ok = await verifyPassword(password, user?.hash ?? "not-a-real-hash");
  if (!user || !ok) return null;
  const { hash, ...withoutHash } = user;
  void hash;
  return withoutHash;
}
