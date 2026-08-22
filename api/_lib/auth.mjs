// Who is allowed to spend money.
//
// The two functions in this API each cost something real: one mints a Soniox key, the other spends
// OpenAI credit. Unauthenticated, the deployment URL is a bill anybody can run up, and it is the
// kind of URL that ends up in a browser history, a screenshot, or a support chat.
//
// What this is
//
// A signed session cookie. `POST /api/session` checks a username and password against a list held
// in the server's environment, and hands back an HttpOnly cookie carrying the username, the role
// and an expiry, signed with HMAC-SHA256. The two paid endpoints verify that signature before
// doing anything. The cookie cannot be forged without the secret, cannot be read by JavaScript,
// and expires on its own.
//
// What this is not
//
// It does not make the demo passwords secret — they are in `rbac.js`, in a public repository, and
// anybody who reads them can sign in. Fixing that means a real identity provider, and the shape
// here is deliberately the shape that swaps in: check credentials on the server, return a signed
// token, verify the token on every call.
//
// What it does buy, today, is that the endpoints stop answering to anyone who merely knows the
// URL. That is the actual exposure.
//
// Fail closed
//
// With no `SESSION_SECRET` and no `API_USERS` configured, nothing authenticates and both
// endpoints refuse. An auth layer that quietly allows everything when misconfigured is worse than
// no auth layer, because it looks like protection on the dashboard.

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { configuredUsers } from "./users.mjs";

export const COOKIE_NAME = "vikku_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12; // one shift

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

/**
 * The signing secret.
 *
 * Returns null rather than inventing one. A generated per-instance secret would look like it
 * works, and then fail the moment a second serverless instance is warm — a cookie signed by one
 * box would not verify on another, and the symptom is a user who is randomly signed out.
 */
export function sessionSecret() {
  return env("SESSION_SECRET") || null;
}

/**
 * Whether anybody can sign in at all.
 *
 * Reads the same records the session endpoint does, so "is this deployment configured" and "who
 * may sign in" cannot disagree. A second copy of this list is a second thing to keep in step.
 */
export function hasConfiguredUsers() {
  return configuredUsers().size > 0;
}

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function hmac(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Constant-time compare, so a wrong signature cannot be found one byte at a time.
 *
 * Compares the encoded strings rather than the decoded bytes. Base64url decoding is lenient about
 * the spare bits in the final character — a 32-byte signature encodes to 43 characters carrying
 * 258 bits, so four different last characters decode to identical bytes. Comparing decoded buffers
 * therefore accepts four spellings of the same signature.
 *
 * That is not forgeable on its own: the bytes still have to equal HMAC(payload), which needs the
 * secret. But a signature check with more than one accepted answer is the kind of looseness that
 * turns into a real hole the next time somebody changes how tokens are built, so it is closed here
 * while it is cheap.
 */
function signaturesMatch(presented, expected) {
  const left = Buffer.from(String(presented), "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signSession({ username, role }, { ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now() } = {}) {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = base64url(
    JSON.stringify({
      u: username,
      r: role,
      exp: Math.floor(now / 1000) + ttlSeconds,
      // A per-session id, so a token can be told apart in a log without the log holding the token.
      id: randomUUID().slice(0, 8),
    })
  );
  return `${payload}.${base64url(hmac(payload, secret))}`;
}

/** A token in, the session out, or null. Never throws — a malformed cookie is just not signed in. */
export function verifySession(token, { now = Date.now() } = {}) {
  const secret = sessionSecret();
  if (!secret || !token || typeof token !== "string") return null;

  const at = token.indexOf(".");
  if (at <= 0) return null;
  const payload = token.slice(0, at);
  const signature = token.slice(at + 1);

  if (!signaturesMatch(signature, base64url(hmac(payload, secret)))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims?.u || !claims?.exp) return null;
    if (claims.exp * 1000 <= now) return null;
    return { username: claims.u, role: claims.r ?? null, id: claims.id ?? null };
  } catch {
    return null;
  }
}

/** Cookies arrive as one header string; Vercel does not parse them for us. */
export function readCookie(header, name) {
  if (!header) return null;
  for (const part of String(header).split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    if (part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return null;
}

export function cookieHeader(token, { ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  // HttpOnly so a script cannot read it, Secure so it never crosses plain HTTP, SameSite=Strict so
  // another site cannot cause the browser to spend this deployment's credit, and scoped to /api
  // because nothing else needs to see it.
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/api",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${ttlSeconds}`,
  ].join("; ");
}

export function clearedCookieHeader() {
  return `${COOKIE_NAME}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/**
 * The guard both paid endpoints run first.
 *
 * Returns the session, or writes the refusal and returns null — so a handler is one `if` away from
 * being protected, and forgetting the `if` is visible in review rather than invisible in
 * production.
 */
export function requireSession(request, response) {
  if (!sessionSecret() || !hasConfiguredUsers()) {
    response.status(503).json({
      ok: false,
      error: "This deployment has no sign-in configured.",
      detail: "Set SESSION_SECRET and API_USERS in the environment.",
    });
    return null;
  }

  const session = verifySession(readCookie(request.headers?.cookie, COOKIE_NAME));
  if (!session) {
    response.status(401).json({ ok: false, error: "Sign in again to use this." });
    return null;
  }
  return session;
}
