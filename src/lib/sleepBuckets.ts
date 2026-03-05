const SLEEP_TIMEZONE = "America/Los_Angeles";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SLEEP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SLEEP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Parse local time string and return YYYY-MM-DD date bucket using 12pm-to-12pm sleep night logic.
 * 
 * Sleep nights span from 12pm one day through 11:59 PM of that day.
 * This means:
 * - Sleep starting before noon on day X belongs to day X-1's night
 * - Sleep starting at noon or later on day X belongs to day X's night
 * 
 * Example:
 * - Sleep starting 3/5 at 8am → buckets to 3/4 (morning sleep = previous night)
 * - Sleep starting 3/5 at 11pm → buckets to 3/5 (night sleep = that day's night)
 */
export const formatSleepBucket = (input: string | null | undefined) => {
  if (!input) return null;

  let dateStr: string | null = null;
  let hourStr: string | null = null;

  // Try to extract date from local time string like "Mar 4, 2026 at 11:02 PM"
  const localMatch = input.match(/(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s*(AM|PM)/i);
  if (localMatch) {
    const [, monthStr, dayStr, yearStr, hourPart, minPart, ampmPart] = localMatch;
    
    let hour = parseInt(hourPart, 10);
    if (ampmPart?.toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (ampmPart?.toUpperCase() === "AM" && hour === 12) hour = 0;

    dateStr = yearStr + "-" +
      String(new Date(`${monthStr} 1, 2000`).getMonth() + 1).padStart(2, "0") + "-" +
      String(dayStr).padStart(2, "0");
    hourStr = String(hour).padStart(2, "0");
  } else {
    // Fallback: treat as UTC ISO string and convert to local time
    const ts = Date.parse(input);
    if (Number.isNaN(ts)) return null;

    const date = new Date(ts);
    const dateParts = dateFormatter.formatToParts(date);
    const timeParts = timeFormatter.formatToParts(date);

    const dateLookup: Record<string, string> = {};
    dateParts.forEach((part) => {
      dateLookup[part.type] = part.value;
    });
    dateStr = `${dateLookup.year}-${dateLookup.month}-${dateLookup.day}`;

    const timeLookup: Record<string, string> = {};
    timeParts.forEach((part) => {
      timeLookup[part.type] = part.value;
    });
    hourStr = timeLookup.hour || "00";
  }

  if (!dateStr) return null;

  // Apply 12pm-to-12pm bucketing: if hour is before noon (0-11), shift to previous day
  const hour = parseInt(hourStr || "0", 10);
  if (hour < 12) {
    // Sleep in morning (before noon) belongs to previous night
    // Parse YYYY-MM-DD and subtract 1 day (using local date math)
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const prevYear = date.getFullYear();
    const prevMonth = String(date.getMonth() + 1).padStart(2, "0");
    const prevDay = String(date.getDate()).padStart(2, "0");
    return `${prevYear}-${prevMonth}-${prevDay}`;
  }

  return dateStr;
};
