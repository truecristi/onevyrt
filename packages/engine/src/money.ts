/**
 * Money is represented as integer MINOR UNITS (e.g. cents) everywhere in the
 * engine. This eliminates binary-float drift for currency: no library needed,
 * fully deterministic, and provable in isolation.
 *
 * The only place fractional values appear is when a fractional population
 * (expected buyers) is multiplied by a price. We round that product back to an
 * integer minor unit with an explicit, documented rounding mode so results are
 * reproducible byte-for-byte.
 */

export type Minor = number; // integer count of minor units (cents)

/** Round a real number to the nearest integer using round-half-to-even
 *  (banker's rounding) — chosen to avoid the upward bias of round-half-up
 *  when aggregating thousands of line items. Deterministic and pure. */
export function roundMinor(value: number): Minor {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundMinor received non-finite value: ${value}`);
  }
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // exactly .5 -> round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Multiply a fractional quantity by an integer price (minor units) and round. */
export function priceOf(quantity: number, unitPriceMinor: Minor): Minor {
  return roundMinor(quantity * unitPriceMinor);
}

/** Format minor units as a decimal string for display only (never for math). */
export function formatMinor(m: Minor, fractionDigits = 2): string {
  const div = 10 ** fractionDigits;
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const whole = Math.floor(abs / div);
  const frac = String(abs % div).padStart(fractionDigits, "0");
  return `${sign}${whole}.${frac}`;
}

/**
 * Currency support (Ch.014). Money is always stored as 2-decimal minor units;
 * currency affects DISPLAY only — symbol, position, separators, and how many
 * decimals to show. Only 0- and 2-decimal currencies are included so display
 * never implies more precision than the engine actually stores.
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: 0 | 2;
  symbolBefore: boolean;
  group: string;   // thousands separator
  decimal: string; // decimal separator
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  EUR: { code: "EUR", name: "Euro", symbol: "\u20ac", decimals: 2, symbolBefore: false, group: ".", decimal: "," },
  GBP: { code: "GBP", name: "British Pound", symbol: "\u00a3", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "\u00a5", decimals: 0, symbolBefore: true, group: ",", decimal: "." },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "\u00a5", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2, symbolBefore: true, group: "'", decimal: "." },
  HKD: { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  INR: { code: "INR", name: "Indian Rupee", symbol: "\u20b9", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  BRL: { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2, symbolBefore: true, group: ".", decimal: "," },
  MXN: { code: "MXN", name: "Mexican Peso", symbol: "$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2, symbolBefore: true, group: " ", decimal: "." },
  NZD: { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2, symbolBefore: false, group: " ", decimal: "," },
  NOK: { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2, symbolBefore: false, group: " ", decimal: "," },
  DKK: { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2, symbolBefore: false, group: ".", decimal: "," },
  PLN: { code: "PLN", name: "Polish Z\u0142oty", symbol: "z\u0142", decimals: 2, symbolBefore: false, group: " ", decimal: "," },
  KRW: { code: "KRW", name: "South Korean Won", symbol: "\u20a9", decimals: 0, symbolBefore: true, group: ",", decimal: "." },
  TRY: { code: "TRY", name: "Turkish Lira", symbol: "\u20ba", decimals: 2, symbolBefore: true, group: ".", decimal: "," },
  AED: { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, symbolBefore: false, group: ",", decimal: "." },
  SAR: { code: "SAR", name: "Saudi Riyal", symbol: "SAR", decimals: 2, symbolBefore: false, group: ",", decimal: "." },
  THB: { code: "THB", name: "Thai Baht", symbol: "\u0e3f", decimals: 2, symbolBefore: true, group: ",", decimal: "." },
  IDR: { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0, symbolBefore: true, group: ".", decimal: "," },
};

/** All currency codes, for pickers. Stable order = insertion order above. */
export function currencyCodes(): string[] { return Object.keys(CURRENCIES); }

/** Format 2-decimal minor units as a currency string for display only. */
export function formatMoney(m: Minor, code = "USD"): string {
  const c = CURRENCIES[code] ?? CURRENCIES.USD;
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  let body: string;
  if (c.decimals === 0) {
    const whole = Math.round(abs / 100);
    body = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, c.group);
  } else {
    const whole = Math.floor(abs / 100);
    const frac = String(abs % 100).padStart(2, "0");
    body = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, c.group) + c.decimal + frac;
  }
  return c.symbolBefore ? `${sign}${c.symbol}${body}` : `${sign}${body}\u00a0${c.symbol}`;
}
