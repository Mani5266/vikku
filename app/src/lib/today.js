import { dutiesFor } from "@/lib/touchTime";
import { isClosed, isConverted, nextStep } from "@/lib/journey";
import { lastWord } from "@/lib/agentCopy";

// The agent's day, in four buckets and one order.
//
// There used to be two home screens — My Leads and Daily Tasks — showing the same leads in the same
// order with different words on them. An agent's first decision every morning was therefore "which
// of my two lists do I look at", which is a decision the software should have made.
//
// There is one list now. It is grouped by urgency, not by temperature, because Hot / Warm / Cold is
// how a *manager* slices a pipeline and "who do I ring first" is what an *agent* needs. The buckets
// are in the order money leaves the building:
//
//   1  Ring now       nobody has called them at all — the 5-minute clock is running or blown
//   2  Behind         calls the plan asked for on earlier days that were never logged
//   3  Due today      what the plan asks for today
//   4  Waiting        nothing due; they are inside their plan and being messaged
//   5  Finished       booked, seen, or closed with a reason — off the working list
//
// Every row carries one button, and that button is `nextStep()` — the same instruction the lead's
// own screens show, so the queue and the lead never disagree about what to do.

export const BUCKETS = [
  {
    key: "ring-now",
    label: "Ring now",
    why: "Nobody has called these at all. A lead that is never rung reaches your manager's screen as a missed lead, not as a busy day.",
    tone: "bad",
  },
  {
    key: "behind",
    label: "Behind — calls you owe from earlier days",
    why: "The plan asked for these and they were never logged. They stay here until you log them; not answering counts, forgetting does not.",
    tone: "bad",
  },
  {
    key: "today",
    label: "Due today",
    why: "What the follow-up plan asks for today.",
    tone: "warn",
  },
  {
    key: "waiting",
    label: "Waiting",
    why: "Nothing is due on these today. They are inside their plan.",
    tone: "default",
  },
  {
    key: "finished",
    label: "Finished",
    why: "Booked, seen, or closed with a reason. Off your working list.",
    tone: "good",
  },
];

/** Which bucket a lead belongs in. First match wins, so the worst state always shows. */
function bucketFor({ lead, task }) {
  if (isConverted(lead) || isClosed(lead)) return "finished";
  if (lead.appointment?.state && ["Booked", "Confirmation Pending", "Confirmed", "Patient Arrived"].includes(lead.appointment.state)) {
    return "finished";
  }
  const duties = task?.duties ?? [];
  if (duties.some((duty) => duty.kind === "first-call")) return "ring-now";
  if (duties.some((duty) => duty.kind === "backlog")) return "behind";
  if (duties.some((duty) => duty.kind === "call" || duty.kind === "invalid")) return "today";
  return "waiting";
}

const BUCKET_ORDER = BUCKETS.map((bucket) => bucket.key);

/**
 * Build the whole day.
 *
 * `verdictFor` is injected rather than imported so this stays testable without the communication
 * engine's bundle, and so the queue's idea of "can a message go" is literally the engine's.
 */
export function buildToday({ leads, interactionsFor, communicationsFor, verdictFor, now = new Date() }) {
  const rows = leads.map((lead) => {
    const interactions = interactionsFor(lead.id);
    const communications = communicationsFor(lead.id);
    const task = dutiesFor(lead, interactions, communications, now);
    const verdict = verdictFor ? verdictFor(lead, communications, now) : { allowed: false, reason: null };
    const bucket = bucketFor({ lead, task });

    return {
      lead,
      bucket,
      task,
      said: lastWord(interactions),
      step: nextStep(lead, { messageAllowed: verdict.allowed, messageReason: verdict.reason }),
      // The single line under the name: what the software wants from this lead right now.
      duty: task.duties.find((d) => d.mandatory) ?? task.duties[0] ?? null,
      overdue: task.duties.some((d) => d.overdue),
    };
  });

  const groups = BUCKETS.map((bucket) => ({
    ...bucket,
    rows: rows
      .filter((row) => row.bucket === bucket.key)
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        const priority = { Hot: 3, "Not Connected": 2, Warm: 1, Cold: 0 };
        return (priority[b.lead.plan?.temperature] ?? 0) - (priority[a.lead.plan?.temperature] ?? 0);
      }),
  }));

  const work = groups.filter((group) => group.key !== "finished").flatMap((group) => group.rows);

  return {
    groups,
    rows,
    /** The one lead to start with. Null when the day is clear, which is a real state worth showing. */
    first: work[0] ?? null,
    toDo: work.length,
    counts: Object.fromEntries(groups.map((group) => [group.key, group.rows.length])),
    order: BUCKET_ORDER,
  };
}
