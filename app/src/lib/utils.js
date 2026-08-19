export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hoursAgo(value, now = new Date()) {
  if (!value) return null;
  return Math.floor((new Date(now) - new Date(value)) / (60 * 60 * 1000));
}

export function relative(value, now = new Date()) {
  const h = hoursAgo(value, now);
  if (h === null) return "—";
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** ISO string shifted back by a number of hours — used to seed believable history. */
export function hoursBefore(hours, from = new Date()) {
  return new Date(new Date(from).getTime() - hours * 60 * 60 * 1000).toISOString();
}
