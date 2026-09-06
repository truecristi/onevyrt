import test from "node:test";
import assert from "node:assert/strict";
import { daySlots, rangeAvailability, isSlotBookable, DEMO_AVAILABILITY, type AvailabilityConfig } from "../lib/acquisition/availability";

const CFG: AvailabilityConfig = {
  timezone: "UTC",
  weekdayHours: { 0: null, 1: { start: "09:00", end: "11:00" }, 2: { start: "09:00", end: "11:00" }, 3: { start: "09:00", end: "11:00" }, 4: { start: "09:00", end: "11:00" }, 5: { start: "09:00", end: "11:00" }, 6: null },
  slotMinutes: 30,
  minNoticeMinutes: 60,
  maxAdvanceDays: 14,
};
// 2026-08-17 is a Monday, 2026-08-16 a Sunday.

test("daySlots: 9-11 in 30-min steps gives four slots on a weekday", () => {
  const s = daySlots(CFG, "2026-08-18", new Set(), "2026-08-16T00:00");
  assert.deepEqual(s.map((x) => x.start.slice(11)), ["09:00", "09:30", "10:00", "10:30"]);
  assert.equal(s[0]!.label, "9:00 AM");
  assert.equal(s[2]!.label, "10:00 AM");
});

test("daySlots: a closed day (Sunday) has no slots", () => {
  assert.equal(daySlots(CFG, "2026-08-16", new Set(), "2026-08-15T00:00").length, 0);
});

test("daySlots: booked slots are removed", () => {
  const s = daySlots(CFG, "2026-08-18", new Set(["2026-08-18T09:30", "2026-08-18T10:30"]), "2026-08-16T00:00");
  assert.deepEqual(s.map((x) => x.start.slice(11)), ["09:00", "10:00"]);
});

test("daySlots: min-notice hides slots too soon today", () => {
  // now is 09:15 on the same day, 60-min notice → first bookable is 10:30
  const s = daySlots(CFG, "2026-08-18", new Set(), "2026-08-18T09:15");
  assert.deepEqual(s.map((x) => x.start.slice(11)), ["10:30"]);
});

test("daySlots: past dates and beyond-advance dates are empty", () => {
  assert.equal(daySlots(CFG, "2026-08-10", new Set(), "2026-08-16T00:00").length, 0, "past");
  assert.equal(daySlots(CFG, "2026-09-30", new Set(), "2026-08-16T00:00").length, 0, "beyond 14 days");
});

test("rangeAvailability: spans days, skips the weekend", () => {
  const r = rangeAvailability(CFG, "2026-08-16", 3, new Set(), "2026-08-15T00:00");
  assert.deepEqual(r.map((d) => d.slots.length), [0, 4, 4]); // Sun 0, Mon 4, Tue 4
});

test("isSlotBookable: true for an open slot, false once booked", () => {
  assert.equal(isSlotBookable(CFG, "2026-08-18T09:00", new Set(), "2026-08-16T00:00"), true);
  assert.equal(isSlotBookable(CFG, "2026-08-18T09:00", new Set(["2026-08-18T09:00"]), "2026-08-16T00:00"), false);
  assert.equal(isSlotBookable(CFG, "2026-08-16T09:00", new Set(), "2026-08-16T00:00"), false, "closed Sunday");
});

test("DEMO_AVAILABILITY: weekday gives a full 9-5 grid", () => {
  const s = daySlots(DEMO_AVAILABILITY, "2026-08-18", new Set(), "2026-08-16T00:00");
  assert.equal(s.length, 16); // 8 hours * 2 per hour
  assert.equal(s[0]!.start.slice(11), "09:00");
  assert.equal(s[s.length - 1]!.start.slice(11), "16:30");
});
