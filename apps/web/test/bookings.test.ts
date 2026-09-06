import test, { after } from "node:test";
import assert from "node:assert/strict";
import { bookedStarts, createBooking, SlotTakenError } from "../lib/acquisition/bookings";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

// Each test uses its own funnel slug so concurrently-running rows never collide,
// and we purge exactly this file's slugs afterward.
const SLUG = uid("book-test");
after(async () => {
  await pgPool().query("DELETE FROM bookings WHERE funnel_slug LIKE $1", [`${SLUG}%`]);
});

test("createBooking persists and bookedStarts reads it back in-range", async () => {
  const slug = `${SLUG}-a`;
  const slot = "2026-08-18T09:00";
  const b = await createBooking({ funnelSlug: slug, slotStart: slot, email: "lead@example.com" });
  assert.equal(b.slotStart, slot);
  const taken = await bookedStarts(slug, "2026-08-18", "2026-08-19");
  assert.ok(taken.has(slot), "the booked slot appears in the taken set");
});

test("bookedStarts excludes slots outside the date range", async () => {
  const slug = `${SLUG}-b`;
  await createBooking({ funnelSlug: slug, slotStart: "2026-08-20T10:00" });
  const before = await bookedStarts(slug, "2026-08-18", "2026-08-20"); // toDate exclusive
  assert.equal(before.has("2026-08-20T10:00"), false, "the 20th is excluded when toDate is the 20th");
  const within = await bookedStarts(slug, "2026-08-18", "2026-08-21");
  assert.ok(within.has("2026-08-20T10:00"));
});

test("double-booking the same slot throws SlotTakenError", async () => {
  const slug = `${SLUG}-c`;
  const slot = "2026-08-18T11:00";
  await createBooking({ funnelSlug: slug, slotStart: slot });
  await assert.rejects(() => createBooking({ funnelSlug: slug, slotStart: slot }), SlotTakenError);
});

test("the same slot on a different funnel is independent", async () => {
  const slot = "2026-08-18T14:00";
  await createBooking({ funnelSlug: `${SLUG}-d1`, slotStart: slot });
  // Same wall-clock slot, different funnel → allowed (constraint is per-funnel).
  const b = await createBooking({ funnelSlug: `${SLUG}-d2`, slotStart: slot });
  assert.equal(b.slotStart, slot);
});

test("a racing pair for one slot lets exactly one win", async () => {
  const slug = `${SLUG}-e`;
  const slot = "2026-08-19T09:30";
  const results = await Promise.allSettled([
    createBooking({ funnelSlug: slug, slotStart: slot }),
    createBooking({ funnelSlug: slug, slotStart: slot }),
  ]);
  const wins = results.filter((r) => r.status === "fulfilled").length;
  const losses = results.filter((r) => r.status === "rejected" && (r.reason as Error) instanceof SlotTakenError).length;
  assert.equal(wins, 1, "exactly one insert succeeds");
  assert.equal(losses, 1, "the loser gets a clean SlotTakenError");
});
