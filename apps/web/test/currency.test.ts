import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCurrency, currencySymbol, DEFAULT_CURRENCY } from "../lib/studio/currency";
import { sanitizeEconomics } from "../lib/studio/economics";

test("normalizeCurrency: accepts a supported code (any case), else falls back to USD", () => {
  assert.equal(normalizeCurrency("gbp"), "GBP");
  assert.equal(normalizeCurrency("EUR"), "EUR");
  assert.equal(normalizeCurrency("wat"), DEFAULT_CURRENCY);
  assert.equal(normalizeCurrency(undefined), DEFAULT_CURRENCY);
  assert.equal(normalizeCurrency(42), DEFAULT_CURRENCY);
});

test("currencySymbol: maps codes to symbols, defaults to $", () => {
  assert.equal(currencySymbol("GBP"), "£");
  assert.equal(currencySymbol("EUR"), "€");
  assert.equal(currencySymbol("USD"), "$");
  assert.equal(currencySymbol("nonsense"), "$");
});

test("sanitizeEconomics: stores a normalized currency, omits it when absent", () => {
  assert.equal(sanitizeEconomics({ currency: "gbp" }).currency, "GBP");
  assert.equal(sanitizeEconomics({ currency: "zzz" }).currency, "USD");
  assert.equal("currency" in sanitizeEconomics({}), false, "no currency key when none supplied");
});
