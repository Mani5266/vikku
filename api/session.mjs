// Sign in, on the server this time.
//
// `rbac.js` already checks a password, in the browser, against a plain-text list. Its own comment
// is honest about what that is: "a gate on the demo, not authentication: a real deployment
// verifies the password on a server." This is that server.
//
// The credential list lives in `API_LOGINS`, so the deployment decides who may sign in without
// anything being rebuilt, and a real identity provider replaces this one handler without the rest
// of the API knowing.
//
// POST   with { username, password }  — sets the session cookie
// DELETE                              — clears it

import { fail } from "./_lib/config.mjs";
import {
  COOKIE_NAME,
  cookieHeader,
  clearedCookieHeader,
  configuredLogins,
  readCookie,
  sessionSecret,
  signSession,
  verifySession,
} from "./_lib/auth.mjs";

// Roles are not secret and are not authorisation on their own — the app already enforces its own
// role matrix. Carrying the role in the token only saves a lookup.
const ROLES = {
  agent123: "agent",
  sneha123: "agent",
  manager123: "manager",
  leadership123: "leadership",
  operations123: "operations",
  admin123: "admin",
};

export default async function handler(request, response) {
  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", clearedCookieHeader());
    return response.status(200).json({ ok: true, signedOut: true });
  }

  if (request.method === "GET") {
    // Lets the browser find out whether it is still signed in without sending a password. The
    // cookie is HttpOnly, so the frontend genuinely cannot answer this for itself.
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

  const logins = configuredLogins();
  if (!logins) {
    return fail(
      response,
      503,
      "This deployment has no sign-in configured.",
      "Set API_LOGINS in the environment, as user:password pairs separated by commas."
    );
  }

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  const expected = logins.get(username);
  // One message for a wrong username and a wrong password. Two messages tell somebody which half
  // they got right, which turns guessing into a two-step problem.
  if (!expected || expected !== password) {
    return fail(response, 401, "That username and password do not match.");
  }

  const token = signSession({ username, role: ROLES[username] ?? null });
  response.setHeader("Set-Cookie", cookieHeader(token));
  return response.status(200).json({ ok: true, username, role: ROLES[username] ?? null });
}
