// The API's sign-in, and the guard on the two endpoints that cost money.
//
//   npm run test:auth
//
// Both paid endpoints spend something real — one mints a Soniox key, the other spends OpenAI
// credit — so the guard in front of them is the one piece of this system where "it looked fine
// when I clicked it" is not evidence of anything. A signature check that accepts a forgery accepts
// it silently.
//
// What is asserted: a forged token is refused, an expired one is refused, a tampered payload is
// refused, a missing configuration refuses everything rather than allowing everything, and both
// endpoints answer 401 before they reach a provider.

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const load = (relative) => import(pathToFileURL(path.join(repoRoot, relative)).href);

const auth = await load("api/_lib/auth.mjs");

let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  void name;
};

/**
 * Environment is process-wide, so every case sets what it needs and puts it back.
 *
 * Awaits the callback before restoring. A plain try/finally around `fn()` restores as soon as an
 * async callback returns its promise — which is before its body has run past the first `await` —
 * so the second half of every async case would see the environment already put back. That failure
 * looks exactly like a broken guard rather than a broken test.
 */
async function withEnv(vars, fn) {
  const before = {};
  for (const [key, value] of Object.entries(vars)) {
    before[key] = process.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// One real user, hashed the way the deployment would hold them. Built once because scrypt is
// deliberately slow — that cost is the point in production and only a nuisance here.
const users = await load("api/_lib/users.mjs");
const HASH = await users.hashPassword("correct-horse-battery");
const SIGNED_IN = {
  SESSION_SECRET: "a-test-secret-that-is-long-enough",
  API_USERS: `agent123|agent|Nikhil Rao|Jayanagar|${HASH}`,
};

/** A response object shaped like the one Vercel passes in. */
function fakeResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

// ---- the token ---------------------------------------------------------------------------------

await check("a signed token verifies, and carries who it is for", async () => {
  await withEnv(SIGNED_IN, () => {
    const token = auth.signSession({ username: "agent123", role: "agent" });
    const session = auth.verifySession(token);
    assert.equal(session.username, "agent123");
    assert.equal(session.role, "agent");
  });
});

await check("a token with a changed payload is refused", async () => {
  await withEnv(SIGNED_IN, () => {
    const token = auth.signSession({ username: "agent123", role: "agent" });
    const [payload, signature] = token.split(".");
    // Promote yourself to admin and keep the original signature.
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), r: "admin" })
    ).toString("base64url");
    assert.equal(auth.verifySession(`${forged}.${signature}`), null);
  });
});

await check("a signature is accepted in exactly one spelling", async () => {
  // Base64url decoding ignores the spare bits in the last character, so four different final
  // characters decode to the same 32 bytes. Comparing decoded buffers would accept all four. Not
  // forgeable by itself — the bytes still have to equal the real HMAC — but a check with more than
  // one right answer is the kind of looseness that becomes a hole later.
  // The variants are derived from the token's own last character rather than guessed. A 32-byte
  // signature is 43 base64url characters carrying 258 bits, so the final character's low two bits
  // are ignored and the alphabet splits into groups of four that decode identically. Trying a
  // fixed set like A-F only lands in the right group some of the time, which makes the test pass
  // by luck on most runs — the first version of this did exactly that.
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  await withEnv(SIGNED_IN, () => {
    const token = auth.signSession({ username: "agent123", role: "agent" });
    assert.ok(auth.verifySession(token), "the real token must verify");

    const last = token[token.length - 1];
    const index = ALPHABET.indexOf(last);
    assert.ok(index >= 0, "the signature must be base64url");

    const groupStart = index & ~3;
    let checked = 0;
    for (let offset = 0; offset < 4; offset++) {
      const character = ALPHABET[groupStart + offset];
      if (character === last) continue;
      const variant = token.slice(0, -1) + character;
      // Same decoded bytes, different spelling. A buffer comparison accepts these.
      assert.deepEqual(
        Buffer.from(variant.slice(variant.indexOf(".") + 1), "base64url"),
        Buffer.from(token.slice(token.indexOf(".") + 1), "base64url"),
        "the variant must decode identically, or this test is checking nothing"
      );
      assert.equal(auth.verifySession(variant), null, `the spelling ending ${character} must be refused`);
      checked++;
    }
    assert.equal(checked, 3, "every other spelling in the group must be tried");
  });
});

await check("a signature altered anywhere is refused", async () => {
  await withEnv(SIGNED_IN, () => {
    const token = auth.signSession({ username: "agent123", role: "agent" });
    const at = token.indexOf(".");
    const signature = token.slice(at + 1);
    for (const index of [0, 5, Math.floor(signature.length / 2), signature.length - 2]) {
      const character = signature[index] === "x" ? "y" : "x";
      const altered = signature.slice(0, index) + character + signature.slice(index + 1);
      assert.equal(
        auth.verifySession(`${token.slice(0, at)}.${altered}`),
        null,
        `a signature altered at index ${index} must be refused`
      );
    }
  });
});

await check("a token signed with a different secret is refused", async () => {
  const token = await withEnv(SIGNED_IN, () => auth.signSession({ username: "agent123", role: "agent" }));
  await withEnv({ ...SIGNED_IN, SESSION_SECRET: "a-different-secret-entirely" }, () => {
    assert.equal(auth.verifySession(token), null);
  });
});

await check("an expired token is refused", async () => {
  await withEnv(SIGNED_IN, () => {
    const token = auth.signSession({ username: "agent123", role: "agent" }, { ttlSeconds: 60 });
    assert.ok(auth.verifySession(token));
    // Ninety seconds later.
    assert.equal(auth.verifySession(token, { now: Date.now() + 90_000 }), null);
  });
});

await check("rubbish in the cookie is not signed in, and does not throw", async () => {
  await withEnv(SIGNED_IN, () => {
    for (const value of ["", ".", "abc", "abc.def", null, undefined, 42, "a.b.c"]) {
      assert.equal(auth.verifySession(value), null, String(value));
    }
  });
});

await check("with no secret configured, nothing signs and nothing verifies", async () => {
  // Fail closed. An auth layer that allows everything when misconfigured is worse than none,
  // because it looks like protection on the dashboard.
  await withEnv({ SESSION_SECRET: null, API_USERS: `agent123|agent|Nikhil Rao|Jayanagar|${HASH}` }, () => {
    assert.equal(auth.signSession({ username: "agent123" }), null);
    assert.equal(auth.verifySession("anything"), null);
  });
});

// ---- cookies -----------------------------------------------------------------------------------

await check("the cookie cannot be read by scripts, sent over plain HTTP, or used cross-site", () => {
  const header = auth.cookieHeader("token-value");
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Path=\/api/);
});

await check("a cookie is picked out of a header holding several", () => {
  const header = `other=1; ${auth.COOKIE_NAME}=abc%2Edef; another=2`;
  assert.equal(auth.readCookie(header, auth.COOKIE_NAME), "abc.def");
  assert.equal(auth.readCookie(header, "missing"), null);
  assert.equal(auth.readCookie(undefined, auth.COOKIE_NAME), null);
});

await check("signing out expires the cookie rather than leaving it to run out", () => {
  assert.match(auth.clearedCookieHeader(), /Max-Age=0/);
});

// ---- passwords ---------------------------------------------------------------------------------

await check("a password is never stored, only a salted hash of it", async () => {
  const hash = await users.hashPassword("correct-horse-battery");
  assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.ok(!hash.includes("correct-horse-battery"));
  assert.equal(await users.verifyPassword("correct-horse-battery", hash), true);
  assert.equal(await users.verifyPassword("correct-horse-batterx", hash), false);
  assert.equal(await users.verifyPassword("", hash), false);
});

await check("the same password twice gives two different hashes", async () => {
  // Per-user salt. Without it, two people who choose the same password are visibly the same in the
  // records, and one cracked hash opens both accounts.
  const first = await users.hashPassword("shared-password");
  const second = await users.hashPassword("shared-password");
  assert.notEqual(first, second);
  assert.equal(await users.verifyPassword("shared-password", first), true);
  assert.equal(await users.verifyPassword("shared-password", second), true);
});

await check("a malformed or missing hash refuses rather than throwing", async () => {
  for (const stored of ["", null, undefined, "not-a-hash", "scrypt$zz$zz", "md5$a$b"]) {
    assert.equal(await users.verifyPassword("anything", stored), false, String(stored));
  }
});

// ---- the people who may sign in -----------------------------------------------------------------

await check("user records are read from the environment and never defaulted", async () => {
  await withEnv({ API_USERS: null }, () => assert.equal(users.configuredUsers().size, 0));
  await withEnv({ API_USERS: `nikhil|agent|Nikhil Rao|Jayanagar|${HASH}` }, () => {
    const record = users.configuredUsers().get("nikhil");
    assert.equal(record.role, "agent");
    assert.equal(record.name, "Nikhil Rao");
    assert.equal(record.branch, "Jayanagar");
  });
});

await check("every role is accepted and an unknown one is dropped", () => {
  for (const role of users.ROLES) {
    const parsed = users.parseUsers(`somebody|${role}|Name|Branch|${HASH}`);
    assert.equal(parsed.get("somebody").role, role, role);
  }
  // A typo must not become a new permission level.
  assert.equal(users.parseUsers(`somebody|superuser|Name|Branch|${HASH}`).size, 0);
});

await check("a commented-out record cannot sign in", () => {
  // How somebody is disabled without losing the note about why.
  const parsed = users.parseUsers(`# left in March\n# nikhil|agent|Nikhil Rao|Jayanagar|${HASH}`);
  assert.equal(parsed.size, 0);
});

await check("several people are read from one variable", () => {
  const parsed = users.parseUsers(
    `nikhil|agent|Nikhil Rao|Jayanagar|${HASH}\nmeera|manager|Meera Raghavan|All branches|${HASH}\nvikram|leadership|Vikram Reddy|All branches|${HASH}`
  );
  assert.equal(parsed.size, 3);
  assert.deepEqual([...parsed.values()].map((user) => user.role), ["agent", "manager", "leadership"]);
});

await check("authenticating never hands back the hash", async () => {
  const parsed = users.parseUsers(`nikhil|manager|Meera|All branches|${HASH}`);
  const user = await users.authenticateUser("nikhil", "correct-horse-battery", parsed);
  assert.equal(user.role, "manager");
  assert.equal(user.hash, undefined, "the hash must not travel back to the browser");
  assert.equal(await users.authenticateUser("nikhil", "wrong", parsed), null);
  assert.equal(await users.authenticateUser("ghost", "correct-horse-battery", parsed), null);
});

// ---- the endpoints -----------------------------------------------------------------------------

const sessionHandler = (await load("api/session.mjs")).default;
const sonioxHandler = (await load("api/soniox-token.mjs")).default;
const extractHandler = (await load("api/extract-remark.mjs")).default;

await check("signing in with the right password sets a session cookie", async () => {
  await withEnv(SIGNED_IN, async () => {
    const response = fakeResponse();
    await sessionHandler({ method: "POST", body: { username: "agent123", password: "correct-horse-battery" }, headers: {} }, response);
    assert.equal(response.code, 200);
    // The server answers with who this is, including the role. The browser is told; it does not
    // assert. And the hash never travels.
    assert.equal(response.body.user.username, "agent123");
    assert.equal(response.body.user.role, "agent");
    assert.equal(response.body.user.name, "Nikhil Rao");
    assert.equal(response.body.user.hash, undefined);
    assert.match(response.headers["Set-Cookie"], new RegExp(auth.COOKIE_NAME));
  });
});

await check("a wrong password and an unknown user give the same answer", async () => {
  await withEnv(SIGNED_IN, async () => {
    const wrongPassword = fakeResponse();
    await sessionHandler({ method: "POST", body: { username: "agent123", password: "nope" }, headers: {} }, wrongPassword);
    const unknownUser = fakeResponse();
    await sessionHandler({ method: "POST", body: { username: "ghost", password: "nope" }, headers: {} }, unknownUser);

    assert.equal(wrongPassword.code, 401);
    assert.equal(unknownUser.code, 401);
    // Two different messages would tell somebody which half they got right.
    assert.equal(wrongPassword.body.error, unknownUser.body.error);
    assert.equal(wrongPassword.headers["Set-Cookie"], undefined);
  });
});

await check("the paid endpoints refuse a request with no cookie", async () => {
  await withEnv(SIGNED_IN, async () => {
    for (const handler of [sonioxHandler, extractHandler]) {
      const response = fakeResponse();
      await handler({ method: "POST", body: { transcript: "x".repeat(80) }, headers: {} }, response);
      assert.equal(response.code, 401, handler.name);
      assert.equal(response.body.ok, false);
    }
  });
});

await check("the paid endpoints refuse a forged cookie", async () => {
  await withEnv(SIGNED_IN, async () => {
    const headers = { cookie: `${auth.COOKIE_NAME}=made.up` };
    const response = fakeResponse();
    await sonioxHandler({ method: "POST", body: {}, headers }, response);
    assert.equal(response.code, 401);
  });
});

await check("a valid cookie gets past the guard and on to the real work", async () => {
  await withEnv(SIGNED_IN, async () => {
    const token = auth.signSession({ username: "agent123", role: "agent" });
    const response = fakeResponse();
    // A transcript too short to draft from, so this stops before any provider is called and the
    // assertion is about the guard rather than about OpenAI.
    await extractHandler(
      { method: "POST", body: { transcript: "hi" }, headers: { cookie: `${auth.COOKIE_NAME}=${token}` } },
      response
    );
    assert.equal(response.code, 200);
    assert.equal(response.body.draft, null);
  });
});

await check("an unconfigured deployment refuses rather than allows", async () => {
  await withEnv({ SESSION_SECRET: null, API_USERS: null }, async () => {
    const response = fakeResponse();
    await sonioxHandler({ method: "POST", body: {}, headers: {} }, response);
    assert.equal(response.code, 503);
    assert.match(response.body.detail, /SESSION_SECRET/);
  });
});

await check("signing out clears the cookie", async () => {
  const response = fakeResponse();
  await sessionHandler({ method: "DELETE", headers: {} }, response);
  assert.equal(response.code, 200);
  assert.match(response.headers["Set-Cookie"], /Max-Age=0/);
});

console.log(`${checks} auth checks passed`);
