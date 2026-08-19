import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCREEN_NAMES, homeFor, roleOf } from "@/lib/rbac";
import { useSession } from "@/store/session";

// A refusal is a designed state with a next move, never a dead end — and it says which role
// owns the screen, so nobody spends the afternoon deciding the app is broken.

export default function NoAccess({ screen }) {
  const { user, signOut } = useSession();
  const role = roleOf(user);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-md bg-secondary">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">This screen belongs to another role</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user
            ? `You are signed in as ${user.name}, ${role?.label}. ${
                SCREEN_NAMES[screen] ? `The ${SCREEN_NAMES[screen]} screen is` : "This screen is"
              } outside that role.`
            : "Sign in to continue."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          to={homeFor(user)}
          className="inline-flex h-12 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card active:bg-primary-pressed"
        >
          Back to my screens
        </Link>
        <Button variant="outline" onClick={signOut}>
          Sign in as someone else
        </Button>
      </div>
      {role && (
        <p className="max-w-sm text-xs text-placeholder">
          {`What you can open: ${role.screens.map((code) => SCREEN_NAMES[code] ?? code).join(" · ")}`}
        </p>
      )}
    </div>
  );
}
