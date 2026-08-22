// Sign in, on the server.
//
// `rbac.js` checks a password in the browser against a plain-text list, and its own comment is
// honest about what that is: "a gate on the demo, not authentication: a real deployment verifies
// the password on a server." This is that server.
//
// Three things make it real rather than a second demo:
//
// **The password is never stored.** Records hold a scrypt hash with a per-user salt. Somebody who
// reads the deployment's environment learns nothing they can sign in with, here or anywhere else
// the person reused that password.
//
// **The server decides the role.** The browser is told who it is; it does not assert it. `rbac.js`
// still drives what the interface draws, and it now draws from a role the server issued and signed
// rather than from a username typed into a box.
//
// **Wrong username and wrong password are indistinguishable**, in both the message and the time
// taken. An unknown user is still checked against a throwaway hash, so the response does not answer
// "does this person work here?" for anyone who asks.
//
// POST   { username, password }  — signs in, sets the cookie
// GET                            — who am I, if anyone
// DELETE                         — signs out

import { fail } from "./_lib/config.mjs";
import {
  COOKIE_NAME,
  cookieHeader,
  clearedCookieHeader,
  readCookie,
  sessionSecret,
  signSession,
  verifySession,
} from "./_lib/auth.mjs";
import { authenticateUser, configuredUsers } from "./_lib/users.mjs";

export default async function handler(request, response) {
  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", clearedCookieHeader());
    return response.status(200).json({ ok: true, signedOut: true });
  }

  if (request.method === "GET") {
    // The cookie is HttpOnly, so the browser genuinely cannot answer this for itself. This is how
    // the app finds out whether a session survived a reload.
    const session = verifySession(readCookie(request.headers?.cookie, COOKIE_NAME));
    return response.status(200).json({ ok: true, session: session ?? null });
  }

  if (request.method !== "POST") return fail(response, 405, "Use POST, GET or DELETE.");

  if (!sessionSecret()) {
    return fail(
      response,
      503,
      "This deployment has no sign-in configured.",
      "Set SESSION_SECRET in the environment."
    );
  }

  const users = configuredUsers();
  if (!users.size) {
    return fail(
      response,
      503,
      "This deployment has nobody who can sign in.",
      "Set API_USERS. Generate a record with: node scripts/make-user.mjs <username> <role>"
    );
  }

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const user = await authenticateUser(body.username, body.password, users);

  // One message for a wrong username and a wrong password. Two messages tell somebody which half
  // they got right, which turns guessing into a two-step problem.
  if (!user) return fail(response, 401, "That username and password do not match.");

  const token = signSession({ username: user.username, role: user.role });
  response.setHeader("Set-Cookie", cookieHeader(token));
  return response.status(200).json({
    ok: true,
    user: { username: user.username, role: user.role, name: user.name, branch: user.branch },
  });
}
