import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import QueueRow from "@/components/shared/QueueRow";
import { useAgentDay } from "@/store/useAgentDay";
import { BUCKETS } from "@/lib/today";

// One group of the queue, on its own page.
//
// The sidebar used to link into a section of the Today screen and scroll to it. That works and it
// reads as one long document: an agent clicking "Behind" landed part-way down a page that also had
// five other groups on it, with no way to tell what they were looking at except the heading that
// happened to be under the cursor.
//
// A group is a place. Each one gets a URL, a title, its own count and the sentence explaining why
// those leads are in it — and nothing else on screen. Today is still the whole day in urgency
// order, for the agent who wants to work straight down it.
//
// The rows are the same component the full list uses. A queue row that looks one way on Today and
// another way here would be two components pretending to be one.

// Links rather than Buttons: these navigate, and a control that navigates should be an anchor so
// it can be opened in a new tab. The queue rows already do this for the same reason.
const QUIET =
  "inline-flex h-12 items-center gap-2 rounded-md bg-card px-4 text-sm font-semibold shadow-card active:bg-secondary";
const LOUD =
  "inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card active:bg-primary-pressed";

export default function QueueGroup() {
  const { bucket } = useParams();
  const day = useAgentDay();

  const definition = useMemo(() => BUCKETS.find((entry) => entry.key === bucket) ?? null, [bucket]);
  const group = useMemo(() => day?.groups.find((entry) => entry.key === bucket) ?? null, [day, bucket]);

  // A typed URL that does not name a group. Rendered rather than bounced silently home: a redirect
  // leaves somebody who mistyped wondering whether the page existed and they lost it.
  if (!definition) {
    return (
      <>
        <PageHeader
          screen="A1"
          title="No such group"
          subtitle={`"${bucket}" is not one of the queue's groups.`}
          back={{ to: "/", label: "Back to the whole day" }}
        />
        <div className="p-4">
          <section className="card-surface p-6">
            <p className="text-sm text-muted-foreground">The queue has these:</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {BUCKETS.map((entry) => (
                <li key={entry.key}>
                  <Link to={`/queue/${entry.key}`} className={QUIET}>
                    {entry.label.split(" — ")[0]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </>
    );
  }

  const rows = group?.rows ?? [];
  // Which group to offer next: the worst one that still has work in it and is not this one.
  const nextGroup = day?.groups.find((entry) => entry.key !== bucket && entry.rows.length > 0) ?? null;

  return (
    <>
      <PageHeader
        screen="A1"
        title={definition.label}
        subtitle={definition.why}
        back={{ to: "/", label: "Back to the whole day" }}
        actions={
          <span className="num rounded-md bg-secondary px-3 py-2 text-sm font-semibold">
            {`${rows.length} lead${rows.length === 1 ? "" : "s"}`}
          </span>
        }
      />

      <div className="space-y-4 p-4">
        {rows.length === 0 ? (
          <section className="card-surface p-6">
            <p className="text-lg font-semibold">Nothing here.</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {`No leads are in "${definition.label}" right now. That is a real state and not an error — this group fills as the day moves.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/" className={QUIET}>
                Back to the whole day
              </Link>
              {nextGroup && (
                <Link to={`/queue/${nextGroup.key}`} className={LOUD}>
                  {`${nextGroup.label.split(" — ")[0]} · ${nextGroup.rows.length}`}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </section>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <QueueRow key={row.lead.id} row={row} />
            ))}
          </ul>
        )}

        {rows.length > 0 && nextGroup && (
          <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              {/* The label keeps its own casing. Lower-casing "Seen the doctor" mid-sentence
                  reads as a typo rather than as a sentence. */}
              {`When this group is clear, ${nextGroup.label.split(" — ")[0]} is next.`}
            </p>
            <Link to={`/queue/${nextGroup.key}`} className={QUIET}>
              {`${nextGroup.label.split(" — ")[0]} · ${nextGroup.rows.length}`}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
