import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import * as offers from "../lib/programme-offers";
import { pgPool } from "../lib/db";

/**
 * programme-offers.ts is instance-wide — exactly three fixed rows
 * (self_paced/cohort/premium_1to1) that real users see, same singleton
 * shape as curriculum-store.ts. Snapshot/restore around this file's run so
 * updateOffer() exercised here doesn't leave production pricing/copy
 * changed. See curriculum-store.test.ts for the identical reasoning.
 */
let snapshot: { id: string; name: string; price_label: string; description: string; active: boolean }[] = [];

before(async () => {
  snapshot = (await pgPool().query("SELECT id, name, price_label, description, active FROM programme_offers")).rows;
});

after(async () => {
  const pool = pgPool();
  await pool.query("DELETE FROM programme_offers");
  for (const row of snapshot) {
    await pool.query(
      "INSERT INTO programme_offers (id, name, price_label, description, active) VALUES ($1, $2, $3, $4, $5)",
      [row.id, row.name, row.price_label, row.description, row.active],
    );
  }
});

test("listOffers: with nothing stored yet, returns the three defaults, all inactive with no hard-coded price", async () => {
  await pgPool().query("DELETE FROM programme_offers");
  const list = await offers.listOffers();
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((o) => o.id).sort(), ["cohort", "premium_1to1", "self_paced"]);
  assert.ok(list.every((o) => o.active === false));
});

test("updateOffer: persists changes and activates the offer", async () => {
  const updated = await offers.updateOffer("premium_1to1", { name: "1:1 Coaching", priceLabel: "$2,000/mo", active: true });
  assert.equal(updated.name, "1:1 Coaching");
  assert.equal(updated.priceLabel, "$2,000/mo");
  assert.equal(updated.active, true);
  const list = await offers.listOffers();
  const found = list.find((o) => o.id === "premium_1to1");
  assert.equal(found?.name, "1:1 Coaching");
});

test("updateOffer: leaves the other two offers untouched", async () => {
  await offers.updateOffer("cohort", { active: true });
  const list = await offers.listOffers();
  const selfPaced = list.find((o) => o.id === "self_paced");
  assert.equal(selfPaced?.active, false);
});

test("updateOffer: an empty name is ignored rather than blanking the offer", async () => {
  const updated = await offers.updateOffer("self_paced", { name: "   " });
  assert.equal(updated.name, "Course Only");
});
