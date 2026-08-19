import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useSession } from "@/store/session";

// The nav bar: fixed height, 16px edge padding, white surface with the app's one shadow, no
// stroke. Two hierarchy levers on the title block — size for the heading, the 60% opacity
// step for everything under it.

export default function PageHeader({ screen, title, subtitle, thesis, back, actions }) {
  void screen; // accepted, deliberately not rendered — see the note below
  // A thesis section number is provenance: it tells whoever is checking this build against the
  // specification where a screen's rules came from. That reader is a manager, an analyst or a
  // reviewer. It is not the telecaller, who cannot act on "§17, §30.6" at their ninetieth call and
  // for whom it is one more line of noise above the thing they came to do.
  //
  // The reference was already stripped from the queue and the call screen for exactly that reason.
  // Doing it per screen left the other six agent screens carrying it, so the decision now lives in
  // one place and follows the role rather than the file.
  const { user } = useSession();
  const showThesis = user?.role !== "agent";
  return (
    <header className="sticky top-0 z-30 bg-card px-4 py-5 shadow-card md:px-6 md:py-6">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      {/* Actions sit centred against the title block rather than pinned to the top. Top-aligned,
          a single control floated to the far-right corner of a bar reads as a status indicator
          rather than as part of this screen. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {/* The screen code is not rendered. "A6" is the specification's name for a thing,
              not a step in anybody's day, and putting it on screen made the product read as a
              spec dump. The prop is still accepted so call sites and tests keep working. */}
          <h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
          {/* One template literal, not `Thesis {thesis}`. JSX splits that into two text nodes, so
              a server-rendered assertion for "Thesis §" never matches — which quietly makes a
              negative assertion pass whether the text is there or not. */}
          {thesis && showThesis && (
            <p className="mt-1 text-xs text-placeholder">{`Thesis ${thesis}`}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * The day opens with a sentence, not a label.
 *
 * The reference board leads with "Good morning, Dr. Sarah — here's what's happening with your
 * practice today", and it is the right instinct: the person opening this at 9am wants to be told
 * where they stand before being handed controls. Interior screens keep the compact header above —
 * a greeting on a drill-down explorer is noise.
 *
 * `meta` is the right-hand slot: a date range, a count, a bell. One line, never two.
 */
export function GreetingHeader({ name, screen, purpose, meta }) {
  void screen; // accepted, deliberately not rendered
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (name ?? "").split(" ")[0];

  return (
    <header className="sticky top-0 z-30 bg-card px-4 py-5 shadow-card md:px-6 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold md:text-2xl">
            {part}
            {first ? `, ${first}` : ""}
          </h1>
          {purpose && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{purpose}</p>}
        </div>
        {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
    </header>
  );
}
