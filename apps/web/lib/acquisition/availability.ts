/**
 * Booking availability (Acquisition OS, Phase 2). Given a calendar config
 * (working hours per weekday, slot length, notice/advance limits) and the set
 * of already-booked slots, computes the open slots for a date or a date range.
 * Pure and deterministic — the "current" wall-clock time is injected — so it's
 * unit-testable. Times are treated as the business's own local wall clock; a
 * slot's identity is "YYYY-MM-DDTHH:MM", which is also the booking key.
 */
export interface AvailabilityConfig {
  /** informational label, e.g. "Europe/London" — slots are computed in the
   *  business's local wall clock, not converted */
  timezone: string;
  /** 0=Sunday … 6=Saturday → open hours, or null for a closed day */
  weekdayHours: Record<number, { start: string; end: string } | null>;
  slotMinutes: number;
  /** can't book within this many minutes of "now" */
  minNoticeMinutes?: number;
  /** can't book more than this many days ahead */
  maxAdvanceDays?: number;
}

export interface Slot {
  /** "YYYY-MM-DDTHH:MM" — the booking key and start time */
  start: string;
  /** human label, e.g. "9:30 AM" */
  label: string;
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToLabel(min: number): string {
  const h24 = Math.floor(min / 60), m = min % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function pad(n: number): string { return String(n).padStart(2, "0"); }
/** Day-of-week for a "YYYY-MM-DD" string, tz-independent (uses UTC to avoid
 *  the host machine's timezone shifting the weekday). */
function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y ?? NaN, (m ?? NaN) - 1, d ?? NaN)).getUTCDay();
}
function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? NaN, (m ?? NaN) - 1, (d ?? NaN) + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Open slots for a single date. `bookedStarts` are slot keys already taken;
 *  `nowLocal` is the current wall clock as "YYYY-MM-DDTHH:MM". */
export function daySlots(config: AvailabilityConfig, dateISO: string, bookedStarts: ReadonlySet<string>, nowLocal: string): Slot[] {
  const hours = config.weekdayHours[weekdayOf(dateISO)];
  if (!hours || config.slotMinutes <= 0) return [];
  const startMin = hhmmToMin(hours.start);
  const endMin = hhmmToMin(hours.end);
  const nowDate = nowLocal.slice(0, 10);
  const notice = config.minNoticeMinutes ?? 0;
  const maxDate = config.maxAdvanceDays != null ? addDaysISO(nowDate, config.maxAdvanceDays) : null;
  if (dateISO < nowDate) return [];
  if (maxDate && dateISO > maxDate) return [];

  const out: Slot[] = [];
  for (let t = startMin; t + config.slotMinutes <= endMin; t += config.slotMinutes) {
    const start = `${dateISO}T${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    if (bookedStarts.has(start)) continue;
    // min-notice: only matters for today (future dates are always far enough out)
    if (dateISO === nowDate) {
      const nowMin = hhmmToMin(nowLocal.slice(11, 16));
      if (t < nowMin + notice) continue;
    }
    out.push({ start, label: minToLabel(t) });
  }
  return out;
}

export interface DayAvailability { date: string; slots: Slot[] }

/** Open slots across a range of days starting at `startDate`. */
export function rangeAvailability(config: AvailabilityConfig, startDate: string, days: number, bookedStarts: ReadonlySet<string>, nowLocal: string): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(startDate, i);
    out.push({ date, slots: daySlots(config, date, bookedStarts, nowLocal) });
  }
  return out;
}

/** Is a specific slot bookable right now? Used server-side before persisting a
 *  booking, so a slot that just filled or fell outside the window is rejected. */
export function isSlotBookable(config: AvailabilityConfig, slotStart: string, bookedStarts: ReadonlySet<string>, nowLocal: string): boolean {
  const date = slotStart.slice(0, 10);
  return daySlots(config, date, bookedStarts, nowLocal).some((s) => s.start === slotStart);
}

/** A sensible default calendar for the demo funnel: Mon–Fri, 9–5, 30-min
 *  slots, 2 hours' notice, up to 14 days out. */
export const DEMO_AVAILABILITY: AvailabilityConfig = {
  timezone: "Europe/London",
  weekdayHours: { 0: null, 1: { start: "09:00", end: "17:00" }, 2: { start: "09:00", end: "17:00" }, 3: { start: "09:00", end: "17:00" }, 4: { start: "09:00", end: "17:00" }, 5: { start: "09:00", end: "17:00" }, 6: null },
  slotMinutes: 30,
  minNoticeMinutes: 120,
  maxAdvanceDays: 14,
};
