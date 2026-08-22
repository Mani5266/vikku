import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { accountByUsername, authenticate } from "@/lib/rbac";

// Who is signed in. Stands in for the identity provider a real deployment would use, and keeps
// the same shape: a user object with a role, resolved once, read everywhere.
//
// Resolution order:
//   1. `?as=<username>` on the URL — how a demo link is shared and how the render test signs in
//   2. the last signed-in username, from localStorage
//   3. nobody, which lands on the sign-in screen
//
// The password check runs in `authenticate()` against a plain-text demo list. It is a gate on the
// demo, not authentication: a real deployment verifies the password on a server.

const STORAGE_KEY = "vikku-session";
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const location = useLocation();
  const asParam = new URLSearchParams(location.search).get("as");
  const [user, setUser] = useState(() => (asParam ? accountByUsername(asParam) : null));

  // A `?as=` link wins over whatever was stored, so a shared link always opens as the role it
  // names. It skips the password on purpose — it exists for demos and for the render test.
  useEffect(() => {
    if (asParam) {
      const next = accountByUsername(asParam);
      if (next) {
        setUser(next);
        return;
      }
    }
    if (user) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(accountByUsername(stored));
    } catch {
      // blocked storage just means the sign-in screen appears again
    }
  }, [asParam, user]);

  /** Returns true when the pair matched. The screen shows the error on false. */
  const signIn = useCallback((username, password) => {
    const account = authenticate(username, password);
    if (!account) return false;
    try {
      localStorage.setItem(STORAGE_KEY, account.username);
    } catch {
      // session still works, it just will not survive a reload
    }
    setUser(account);

    // Ask the API for a session cookie with the same credentials. The browser's own check decides
    // what this app shows; this one decides whether the endpoints that cost money will answer.
    // Deliberately not awaited: the API is optional, and a deployment without it — the static
    // preview, the render test — must still sign in instantly.
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).catch(() => {
      // No API here. Listening will say so when somebody tries to use it.
    });

    return true;
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clean up
    }
    // The cookie is HttpOnly, so only the server can clear it. Leaving it behind would keep the
    // ability to spend on this deployment alive after somebody thought they had signed out.
    fetch("/api/session", { method: "DELETE" }).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
