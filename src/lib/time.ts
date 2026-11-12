// Times are saved in UTC. They are always shown in Indian time, whatever the computer's own time zone is.
const INDIAN_TIME_ZONE = "Asia/Kolkata";

// "en-CA" formats as YYYY-MM-DD, which is what the API uses for dates and what
// compares correctly as plain text.
const isoDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: INDIAN_TIME_ZONE });

const dateOnlyFormat = new Intl.DateTimeFormat("en-IN", { timeZone: INDIAN_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });
const timeOnlyFormat = new Intl.DateTimeFormat("en-IN", { timeZone: INDIAN_TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true });
const fullFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIAN_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

/** "Today, 10:41 PM" or "08 Nov 2026, 10:41 PM". The text is empty if the time cannot be read. */
export function formatShortTime(isoText: string, now: Date = new Date()): string {
  const moment = new Date(isoText);
  if (Number.isNaN(moment.getTime())) {
    return "";
  }
  const dayText = dateOnlyFormat.format(moment) === dateOnlyFormat.format(now) ? "Today" : dateOnlyFormat.format(moment);
  return `${dayText}, ${timeOnlyFormat.format(moment).toUpperCase()}`;
}

/** "Monday, 09 November 2026 at 10:41:35 PM IST" (shown when the mouse is over the short time). */
export function formatFullTime(isoText: string): string {
  const moment = new Date(isoText);
  if (Number.isNaN(moment.getTime())) {
    return "";
  }
  return `${fullFormat.format(moment).toUpperCase().replace(" AT ", " at ")} IST`;
}

/** "10:05 AM" in Indian time. Empty text when there is no time. */
export function formatClock(isoText: string | null | undefined): string {
  if (!isoText) {
    return "";
  }
  const moment = new Date(isoText);
  return Number.isNaN(moment.getTime()) ? "" : timeOnlyFormat.format(moment).toUpperCase();
}

/** 275 -> "4h 35m". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) {
    return "";
  }
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Today's date in Indian time, as "YYYY-MM-DD". The backend decides the same way (leave/service.py get_today). */
export function companyToday(now: Date = new Date()): string {
  return isoDateFormat.format(now);
}
