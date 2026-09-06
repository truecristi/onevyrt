import test from "node:test";
import assert from "node:assert/strict";
import { roundMinor, priceOf, formatMinor, formatMoney, CURRENCIES, currencyCodes } from "../src/money.ts";

test("roundMinor: basic up/down", () => {
  assert.equal(roundMinor(10.4), 10);
  assert.equal(roundMinor(10.6), 11);
  assert.equal(roundMinor(0.49), 0);
});

test("roundMinor: banker's rounding on exact halves", () => {
  assert.equal(roundMinor(0.5), 0);   // to even (0)
  assert.equal(roundMinor(1.5), 2);   // to even (2)
  assert.equal(roundMinor(2.5), 2);   // to even (2)
  assert.equal(roundMinor(3.5), 4);   // to even (4)
});

test("roundMinor: rejects non-finite", () => {
  assert.throws(() => roundMinor(Infinity), RangeError);
  assert.throws(() => roundMinor(NaN), RangeError);
});

test("priceOf: fractional buyers x integer price", () => {
  // 40 buyers @ 9700 minor ($97) -> 388000
  assert.equal(priceOf(40, 9700), 388000);
  // 12.5 buyers @ 999 minor -> 12487.5 -> banker's -> 12488
  assert.equal(priceOf(12.5, 999), 12488);
});

test("formatMinor: display only", () => {
  assert.equal(formatMinor(388000), "3880.00");
  assert.equal(formatMinor(9700), "97.00");
  assert.equal(formatMinor(-2050), "-20.50");
});

test("formatMoney: USD symbol, grouping, 2 decimals", () => {
  assert.equal(formatMoney(123456, "USD"), "$1,234.56");
  assert.equal(formatMoney(0, "USD"), "$0.00");
  assert.equal(formatMoney(-500, "USD"), "-$5.00");
});

test("formatMoney: EUR euro-style separators, symbol after", () => {
  assert.equal(formatMoney(123456, "EUR"), "1.234,56\u00a0\u20ac");
});

test("formatMoney: JPY has zero decimals (rounds minor units to whole yen)", () => {
  assert.equal(formatMoney(123456, "JPY"), "\u00a51,235");
  assert.equal(formatMoney(100, "JPY"), "\u00a51");
});

test("formatMoney: unknown code falls back to USD", () => {
  assert.equal(formatMoney(100, "ZZZ"), "$1.00");
});

test("formatMoney: registry + codes are consistent", () => {
  const codes = currencyCodes();
  assert.ok(codes.includes("USD") && codes.includes("EUR") && codes.includes("JPY"));
  for (const code of codes) assert.equal(CURRENCIES[code].code, code);
});
