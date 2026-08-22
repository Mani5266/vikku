// Every secret this product holds, in one file, read at the point of use.
//
// This is the whole reason the app grew a backend. Soniox and OpenAI both authenticate with a
// bearer key, and a key placed in a React bundle is a key published to anyone who opens the
// network tab. Nothing else about the CRM needed a server; these two things did.
//
// The functions here are Vercel serverless functions living in `/api` at the repository root, so
// the deploy stays exactly what it was: one `git push`, one build, one origin. No second host, no
// container, no separate URL for the frontend to be configured with.

export class MissingCredential extends Error {}

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

export const config = {
  get sonioxApiKey() {
    return env("SONIOX_API_KEY");
  },
  get openaiApiKey() {
    return env("OPENAI_API_KEY");
  },
  get extractionModel() {
    // Off the critical path of the conversation — this runs after the call ends, so it is chosen
    // for how well it reads a messy transcript rather than for time-to-first-token.
    return env("EXTRACTION_MODEL", "gpt-4.1-mini");
  },
  // How long a browser's Soniox key lives. Long enough for a hospital call, short enough that a
  // leaked one is worthless by the time anybody could use it.
  get sonioxKeyTtlSeconds() {
    return Number(env("SONIOX_KEY_TTL_SECONDS", "1800"));
  },
  // Which languages the recogniser should expect. Hints rather than a lock: a locked recogniser
  // mangles the half of the sentence that is not in its language, and a Bangalore telecalling
  // floor switches between four of them inside one sentence.
  get languageHints() {
    return env("LANGUAGE_HINTS", "en,hi,kn,te")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
  },
};

export function require(...names) {
  const missing = names.filter((name) => !config[name]);
  if (missing.length) {
    throw new MissingCredential(
      `Not configured on the server: ${missing
        .map((name) => name.replace(/([A-Z])/g, "_$1").toUpperCase())
        .join(", ")}`
    );
  }
}

/** One shape for every failure, so the browser never has to guess what went wrong. */
export function fail(response, status, message, detail) {
  return response.status(status).json({ ok: false, error: message, detail: detail ?? null });
}

/**
 * Method and body guard.
 *
 * Vercel parses JSON bodies already, but a request with no body at all arrives as undefined and
 * every handler would otherwise need the same three lines to survive it.
 */
export function readPost(request, response) {
  if (request.method !== "POST") {
    fail(response, 405, "Use POST.");
    return null;
  }
  return request.body && typeof request.body === "object" ? request.body : {};
}
