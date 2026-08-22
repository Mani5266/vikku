# Signing in

Every person who uses this CRM has their own account, their own password and their own role. The
password is never stored — only a salted scrypt hash of it — and the role is decided by the server,
not by the browser.

## Adding somebody

```bash
node scripts/make-user.mjs nikhil agent "Nikhil Rao" Jayanagar
```

That prints two things: a line to paste into the `API_USERS` environment variable in the Vercel
dashboard, and a generated password to give the person directly.

The password is printed once and stored nowhere. It cannot be recovered from the record — that is
the point of hashing it. If somebody loses theirs, run the command again and replace their line.

Roles: `agent`, `manager`, `leadership`, `operations`, `admin`. An unknown role is dropped rather
than treated as a new permission level, so a typo cannot invent access.

## Turning somebody off

Comment their line out with `#`. The record stays, along with any note about why:

```
# left the team in March
# nikhil|agent|Nikhil Rao|Jayanagar|scrypt$...
```

Deleting the line works too. Commenting keeps the history, which matters when somebody asks six
months later why an account disappeared.

## What is actually enforced

**Passwords are hashed with scrypt and a per-user salt.** Somebody who can read the deployment's
environment — a colleague with dashboard access, a leaked backup, a screen shared in a support call
— learns nothing they can sign in with, here or on any other system where that person reused the
password. Two people who choose the same password get different hashes.

scrypt rather than a fast hash because being slow is the point: it makes offline guessing expensive
per attempt.

**The session is a signed cookie.** HMAC-SHA256 over the username, role and expiry, in a cookie that
is HttpOnly, Secure, SameSite=Strict and scoped to `/api`. It cannot be read by scripts, cannot
cross sites, and cannot be edited — changing one character of the payload or the signature makes it
invalid.

**The server decides the role.** The browser is told who it is and does not assert it. `rbac.js`
still draws the interface, and now draws from a role the server issued.

**A wrong username and a wrong password are indistinguishable**, in the message and in the time
taken. An unknown user is still checked against a throwaway hash, so a response does not answer "does
this person work here?" for anybody who asks.

**It fails closed.** With no `SESSION_SECRET` or no `API_USERS`, nothing authenticates and the paid
endpoints refuse with a 503 naming the missing variable. An auth layer that allows everything when
misconfigured is worse than none, because it looks like protection on the dashboard.

## What is not built, and what each one needs

**Adding a person needs a redeploy.** The records live in an environment variable, so a manager
cannot create an account from inside the product. This needs a database.

**Nothing records who signed in when.** No sign-in log, no failed-attempt trail, no "this account
was used from a new device". Also a database.

**No rate limiting on sign-in attempts.** Serverless instances share no memory, so a counter held
in one process is not a limit — it is a limit on one instance, which is not a limit. Doing this
properly needs a shared store such as Vercel KV or Upstash. scrypt's slowness is the only thing
currently making guessing expensive, and it is a real defence but not the one you would rely on.

**No password change from inside the app**, no reset flow, no expiry.

**No second factor.**

## The larger caveat

Authentication protects the API. It does not protect the data, because the leads do not live on a
server yet — `src/store/journeys.js` seeds them and `localStorage` keeps them, per browser.

So today this stops somebody who finds the deployment URL from spending your Soniox and OpenAI
credit, and it gives each person a real account with a real password. It does not yet mean an agent
cannot see another agent's leads on a server, because there is no server holding leads. `rbac.js`
scopes what is drawn; a determined person with the browser console open is only being asked
politely.

Both of those gaps close the same way: put the leads in a database and check the session on every
read. That is the next real piece of work, and it is bigger than this one.
