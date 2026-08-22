import React, { useState } from "react";
import { ChevronLeft, Gauge, LogIn, RefreshCcw, ScrollText, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCOUNTS, ROLES } from "@/lib/rbac";
import { useSession } from "@/store/session";

// One landing page, two steps.
//
// Step one asks the only question that matters on the way in: who is signing in. Step two shows the
// form, and beside it the demo credentials **for that role alone**.
//
// Printing all six accounts on the landing page was the previous design, and it was wrong twice
// over: a reviewer had to read six rows to find their one, and every role's password sat on a screen
// that anybody could open. Showing one role's credentials after that role is chosen is both easier
// to use and closer to how the real thing behaves — you do not learn the manager's password by
// visiting the login page.
//
// The form itself is unchanged: the typed values go through `signIn`, so the path being demonstrated
// is the real one and a wrong password still fails.

const ROLE_ORDER = ["agent", "manager", "leadership", "operations", "admin"];

const ROLE_ICON = {
  agent: Users,
  manager: Gauge,
  leadership: Target,
  operations: RefreshCcw,
  admin: ScrollText,
};

function BrandBlock({ caption }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-primary text-base font-bold text-primary-foreground">
        V
      </span>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold">Vikku Lead Conversion CRM</h1>
        <p className="text-sm text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

export default function SignIn() {
  const { signIn } = useSession();
  const [roleKey, setRoleKey] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const role = roleKey ? ROLES[roleKey] : null;
  const accounts = roleKey ? ACCOUNTS.filter((account) => account.role === roleKey) : [];

  const choose = (key) => {
    // The first account of the role is filled in, so a reviewer is one tap from being inside.
    const first = ACCOUNTS.find((account) => account.role === key);
    setRoleKey(key);
    setUsername(first?.username ?? "");
    setPassword(first?.password ?? "");
    setError(null);
  };

  const back = () => {
    setRoleKey(null);
    setUsername("");
    setPassword("");
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    // Awaited now: signing in also asks the server, and its answer decides the role. Firing and
    // forgetting would land somebody on a screen drawn for a role the server had not agreed to.
    if (!(await signIn(username, password))) {
      setError("Wrong username or password.");
      setPassword("");
    }
  };

  // ---- step one: who is signing in ------------------------------------------------------------
  if (!role) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-4">
        <BrandBlock caption="Sign in to continue." />

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Sign in as</h2>
          <p className="text-sm text-muted-foreground">
            Each role opens its own screens and nothing else. Pick one to see its demo credentials.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_ORDER.map((key) => {
              const option = ROLES[key];
              const Icon = ROLE_ICON[key];
              const count = ACCOUNTS.filter((account) => account.role === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => choose(key)}
                  className="card-surface flex items-start gap-4 p-4 text-left active:bg-secondary"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-tint text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                    <span className="mt-1 block text-xs text-placeholder">
                      {option.screens.length} screen{option.screens.length > 1 ? "s" : ""} · {count} demo
                      account{count > 1 ? "s" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Demo credentials are shown after a role is picked, not before. Before real patient data
          reaches this app, sign-in and the role map both move to the server — a hidden screen is not
          a protected screen.
        </p>
      </div>
    );
  }

  // ---- step two: the form, and only this role's credentials ------------------------------------
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-4">
      <BrandBlock caption={`Signing in as ${role.label}.`} />

      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Pick a different role
      </button>

      <form onSubmit={submit} className="card-surface space-y-4 p-4">
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-semibold">
            Username
          </label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
        </div>

        {/* The failure branch, designed rather than an alert box. */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full">
          <LogIn className="h-6 w-6" />
          Sign in as {role.label}
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{role.label} demo account{accounts.length > 1 ? "s" : ""}</h2>
        <p className="text-xs text-muted-foreground">
          Only this role's credentials are shown. Tap a row to fill the form above.
        </p>
        <div className="space-y-1">
          {accounts.map((account) => (
            <button
              key={account.username}
              type="button"
              onClick={() => {
                setUsername(account.username);
                setPassword(account.password);
                setError(null);
              }}
              className="card-surface flex w-full items-center gap-4 px-4 py-2 text-left active:bg-secondary"
            >
              <span className="num min-w-0 flex-1 truncate text-sm">{account.username}</span>
              <span className="num truncate text-xs text-placeholder">{account.password}</span>
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{account.name}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Demo credentials, compared in the browser. Before real patient data reaches this app, sign-in
        and the role map both move to the server — a hidden screen is not a protected screen.
      </p>
    </div>
  );
}
