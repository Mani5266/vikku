// A short-lived Soniox key, minted for one browser tab.
//
// The alternative is to proxy the audio: browser sends microphone frames to our server, our server
// forwards them to Soniox, transcripts come back the same way. That works and it is worse in every
// respect. It doubles the network hops on a live call, it puts a websocket-holding process on the
// critical path of every conversation — which serverless functions cannot do anyway — and it makes
// the whole system's latency depend on a box in a different country from both ends.
//
// Soniox issues temporary keys, so the browser talks to Soniox directly. The real key never leaves
// the server; what the browser holds is a `temp:` key that expires, is scoped to transcription
// alone, and is worth nothing to anybody who scrapes it after the call.

import { config, fail, readPost, require } from "./_lib/config.mjs";
import { requireSession } from "./_lib/auth.mjs";

const SONIOX_TEMPORARY_KEY_URL = "https://api.soniox.com/v1/auth/temporary-api-key";

export default async function handler(request, response) {
  const body = readPost(request, response);
  if (body === null) return;

  // Before anything that costs money.
  const session = requireSession(request, response);
  if (!session) return;

  try {
    require("sonioxApiKey");
  } catch (error) {
    // 503 rather than 500: the code is fine, the deployment is missing an environment variable,
    // and the screen says so plainly instead of showing a broken microphone.
    return fail(response, 503, error.message);
  }

  try {
    const minted = await fetch(SONIOX_TEMPORARY_KEY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sonioxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usage_type: "transcribe_websocket",
        expires_in_seconds: config.sonioxKeyTtlSeconds,
      }),
    });

    if (!minted.ok) {
      const detail = await minted.text();
      return fail(response, 502, "Soniox refused to issue a key.", detail.slice(0, 300));
    }

    const { api_key: apiKey, expires_at: expiresAt } = await minted.json();

    // The language hints ride along with the key so the browser does not carry a second copy of
    // this configuration that can drift from the server's.
    return response.status(200).json({
      ok: true,
      apiKey,
      expiresAt,
      languageHints: config.languageHints,
    });
  } catch (error) {
    return fail(response, 502, "Could not reach Soniox.", String(error?.message || error));
  }
}
