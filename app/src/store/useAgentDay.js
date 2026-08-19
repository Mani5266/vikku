import { useEffect, useMemo, useState } from "react";
import { canSendMessage } from "@/lib/communicationEngine";
import { buildToday } from "@/lib/today";
import { scopeRows } from "@/lib/rbac";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";

// The agent's day, computed once and read from two places.
//
// The Today screen has always built this. The sidebar now shows the same five groups with their
// counts, which is the whole reason this moved out of the page: two components each calling
// `buildToday` with their own arguments is two components that will eventually disagree about how
// many calls somebody owes, and the one place that shows up is the one place it must not — the
// number an agent trusts to tell them when they are finished.
//
// Everything here is derived. Nothing is stored, so there is no count to keep in sync with the
// data behind it.

/**
 * A clock that ticks rather than a timestamp captured once.
 *
 * The queue is time-sensitive: a lead crosses the five-minute first-call SLA while the screen is
 * open, and a duty becomes overdue at midnight. Without a tick the sidebar would keep saying "3 to
 * do" for the rest of the shift. Fifteen seconds is well below the resolution anything on screen
 * is measured in.
 */
export function useTicker(intervalMs = 15000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * The signed-in agent's leads, grouped by urgency.
 *
 * Returns `null` for anybody who is not an agent. A manager has no personal queue — their leads
 * are the team's — and a "you owe 3 calls" badge on a manager's sidebar would be inventing work
 * for somebody who does not work a queue.
 */
export function useAgentDay() {
  const { leads: allLeads, interactionsFor, communicationsFor } = useStore();
  const { user } = useSession();
  const now = useTicker();

  const leads = useMemo(() => scopeRows(allLeads, user), [allLeads, user]);

  return useMemo(() => {
    if (user?.role !== "agent") return null;
    // buildToday already returns `rows` (every lead) and `counts` (per group), so nothing is
    // recomputed or duplicated here.
    return buildToday({
      leads,
      interactionsFor,
      communicationsFor,
      verdictFor: (lead, communications, at) =>
        canSendMessage({ plan: lead.plan, lead, communications, now: at }),
      now,
    });
  }, [user, leads, interactionsFor, communicationsFor, now]);
}
