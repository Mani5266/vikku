import React, { useState } from "react";
import { BRAND, GRID, RAMP, SURFACE, colorFor, formatNumber, ordinalSteps } from "@/lib/chartPalette";
import { cn } from "@/lib/utils";

// Four chart forms, no dependencies.
//
// Each form is picked by the job the data does, not by what looks good: change over time is a line,
// share of a whole is a donut, magnitude across names is a bar list, an ordered sequence that only
// shrinks is a funnel. Anything else stays a table — this app is read printed and in Excel, and a
// picture that cannot be exported is a picture the manager cannot argue with.
//
// Two implementation rules make these render sharply at any width without a resize observer:
//   · the SVG carries geometry only, stretched with preserveAspectRatio="none", and every stroke is
//     `vector-effect="non-scaling-stroke"` so 2px stays 2px
//   · every label is HTML positioned over the SVG, so type never stretches with the container
//
// They are also server-renderable: no window, no measurement, no effects.

/** Ticks a human would choose: 0 / 100 / 200, not 0 / 137 / 274. */
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const rough = max / (count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/* ------------------------------------------------------------------ area line */

/**
 * Change over time, one series.
 *
 * One series means no legend box — the card title already names what is plotted. Only the last
 * point is labelled; a number on every point is chaos and goes unread.
 */
export function AreaLineChart({ data, height = 200, unit = "", className }) {
  const [hover, setHover] = useState(null);
  const points = data ?? [];
  if (points.length < 2) return null;

  const max = Math.max(...points.map((p) => p.value), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  const x = (i) => (i / (points.length - 1)) * 100;
  const y = (v) => 100 - (v / top) * 100;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;
  const active = hover === null ? points.length - 1 : hover;

  return (
    <div className={cn("relative", className)} style={{ paddingLeft: 44, paddingBottom: 24 }}>
      {/* Y ticks, in ink — never in the data colour. */}
      <div className="absolute left-0 top-0 w-10 text-right" style={{ height }}>
        {ticks
          .slice()
          .reverse()
          .map((tick) => (
            <div
              key={tick}
              className="num absolute right-0 -translate-y-1/2 text-xs text-placeholder"
              style={{ top: `${(1 - tick / top) * 100}%` }}
            >
              {formatNumber(tick)}
            </div>
          ))}
      </div>

      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              x1="0"
              x2="100"
              y1={y(tick)}
              y2={y(tick)}
              stroke={GRID}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={BRAND} fillOpacity="0.1" />
          <path
            d={line}
            fill="none"
            stroke={BRAND}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* The marker is HTML so a stretched viewBox cannot turn a circle into an ellipse. The
            2px surface ring keeps it legible where it sits on the line. */}
        <span
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${x(active)}%`,
            top: `${y(points[active].value)}%`,
            background: BRAND,
            boxShadow: `0 0 0 2px ${SURFACE}`,
          }}
        />

        {/* Hit targets are wider than the marks: one column per point. */}
        <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
          {points.map((point, index) => (
            <button
              key={point.label}
              type="button"
              tabIndex={-1}
              aria-label={`${point.label}: ${formatNumber(point.value)}`}
              className="h-full flex-1"
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
            />
          ))}
        </div>

        {hover !== null && (
          <div
            className="card-raised pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap px-2 py-1"
            style={{ left: `${x(hover)}%`, top: `${y(points[hover].value)}%`, marginTop: -8 }}
          >
            <p className="text-xs text-muted-foreground">{points[hover].label}</p>
            <p className="num text-sm font-semibold">
              {formatNumber(points[hover].value)}
              {unit}
            </p>
          </div>
        )}
      </div>

      {/* First, middle and last only — a label per day collides at any real width. */}
      <div className="mt-2 flex justify-between text-xs text-placeholder">
        <span>{points[0].label}</span>
        <span className="hidden sm:inline">{points[Math.floor((points.length - 1) / 2)].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- donut */

/**
 * Share of a whole, six slices at most.
 *
 * A slice's step is fixed to its name through `names`, so filtering the board never repaints the
 * slices that survived. The legend carries the name and the share, so identity never depends on
 * telling two violets apart.
 */
export function DonutChart({ data, names, total, totalLabel = "Total", className }) {
  const slices = (data ?? []).filter((slice) => slice.value > 0);
  const sum = total ?? slices.reduce((acc, slice) => acc + slice.value, 0);
  if (!slices.length || sum <= 0) return null;

  const order = names ?? slices.map((slice) => slice.name);
  const circumference = 2 * Math.PI * 15.9155;
  let offset = 0;

  return (
    // Capped: in a full-width card an uncapped legend strands the percentage a foot from its
    // name, and the pair stops reading as one row.
    <div className={cn("flex max-w-lg flex-wrap items-center gap-6", className)}>
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
          {slices.map((slice) => {
            const share = slice.value / sum;
            // The 2px surface gap between touching arcs: white does the separating, never a stroke.
            const length = Math.max(share * circumference - 0.6, 0.2);
            const dash = `${length} ${circumference - length}`;
            const node = (
              <circle
                key={slice.name}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke={colorFor(slice.name, order)}
                strokeWidth="6"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += share * circumference;
            return node;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-lg font-semibold tabular-nums">{formatNumber(sum)}</p>
            <p className="text-xs text-muted-foreground">{totalLabel}</p>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: colorFor(slice.name, order) }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="num shrink-0 text-muted-foreground">{Math.round((slice.value / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------- bar list */

/**
 * Magnitude across names. One series, so every bar takes the same colour: colouring nominal bars by
 * their value spends the identity channel re-encoding what bar length already shows.
 */
export function BarList({ data, valueSuffix = "", className }) {
  const rows = data ?? [];
  if (!rows.length) return null;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className={cn("space-y-4", className)}>
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-4">
          <span className="truncate text-sm" title={row.name}>
            {row.name}
          </span>
          <span className="h-2 rounded-sm bg-secondary">
            <span
              className="block h-2 rounded-sm"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%`, background: BRAND }}
            />
          </span>
          <span className="num text-right text-sm font-semibold">
            {formatNumber(row.value)}
            {valueSuffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------- funnel */

/**
 * An ordered sequence that only ever shrinks.
 *
 * Ordinal, so it takes lightness steps of the one hue rather than separate colours — the reader
 * sees the order in the colour. Each stage carries its own count and the percentage of the stage
 * above it, because "how many dropped here" is the only question a funnel is asked.
 */
export function FunnelChart({ stages, className }) {
  const rows = stages ?? [];
  if (rows.length < 2) return null;
  const top = Math.max(rows[0].value, 1);
  const steps = ordinalSteps(rows.length);

  return (
    <ol className={cn("space-y-1", className)}>
      {rows.map((stage, index) => {
        const width = Math.max((stage.value / top) * 100, 6);
        const previous = index === 0 ? null : rows[index - 1].value;
        const kept = previous ? Math.round((stage.value / Math.max(previous, 1)) * 100) : 100;
        return (
          <li key={stage.label} className="flex items-center gap-4">
            <span className="w-40 shrink-0 truncate text-sm" title={stage.label}>
              {stage.label}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="flex h-10 items-center justify-end rounded-sm px-2"
                style={{ width: `${width}%`, background: steps[index], color: SURFACE }}
              >
                <span className="num text-xs font-semibold">{formatNumber(stage.value)}</span>
              </span>
            </span>
            <span className="num w-16 shrink-0 text-right text-xs text-muted-foreground">
              {index === 0 ? "—" : `${kept}%`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { RAMP };
