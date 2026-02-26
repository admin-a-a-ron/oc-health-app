const SLEEP_TIMEZONE = "America/Los_Angeles";
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SLEEP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatSleepBucket = (iso: string | null | undefined) => {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const shifted = new Date(ts + HALF_DAY_MS);
  const parts = dateFormatter.formatToParts(shifted);
  const lookup: Record<string, string> = {};
  parts.forEach((part) => {
    lookup[part.type] = part.value;
  });
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};
