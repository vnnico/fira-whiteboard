const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function toDate(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatAbsolute(d) {
  const date = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

  return `${date} · ${time}`;
}

/**
 * Formats an ISO date string or Date into a more intuitive value.
 * - Recent items show relative time ("5 minutes ago")
 * - Older items show absolute ("Dec 21, 2025 · 10:25 AM")
 */
export function formatDateTime(
  input,
  { now = new Date(), relativeDaysCutoff = 7 } = {}
) {
  const d = toDate(input);
  if (!d) return "";

  const diffMs = d.getTime() - now.getTime(); // negative => past
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;

  // Relative formatting for "recent"
  if (absSec < minute) return rtf.format(diffSec, "second");
  if (absSec < hour) return rtf.format(Math.round(diffSec / minute), "minute");
  if (absSec < day) return rtf.format(Math.round(diffSec / hour), "hour");

  const diffDays = Math.round(diffSec / day);
  if (Math.abs(diffDays) <= relativeDaysCutoff)
    return rtf.format(diffDays, "day");

  return formatAbsolute(d);
}
