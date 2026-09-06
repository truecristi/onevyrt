/**
 * Workspace currency — a small shared list so the Numbers pillar, the offer,
 * and funnel payments all speak the same set instead of hardcoding USD. Kept
 * deliberately short (the majors most owners use); anything unrecognised falls
 * back to USD. Codes are ISO-4217 upper-case; formatMoney (engine) and Stripe
 * (lower-case) each take the case they want at the edge.
 */
export interface CurrencyOption { code: string; label: string; symbol: string }

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "CAD", label: "Canadian Dollar", symbol: "$" },
  { code: "AUD", label: "Australian Dollar", symbol: "$" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "$" },
  { code: "SGD", label: "Singapore Dollar", symbol: "$" },
  { code: "ZAR", label: "South African Rand", symbol: "R" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export const DEFAULT_CURRENCY = "USD";

/** Normalise any input to a supported ISO-4217 code, defaulting to USD. */
export function normalizeCurrency(v: unknown): string {
  if (typeof v !== "string") return DEFAULT_CURRENCY;
  const up = v.trim().toUpperCase();
  return BY_CODE.has(up) ? up : DEFAULT_CURRENCY;
}

/** The display symbol for a currency code (e.g. "£"), defaulting to "$". */
export function currencySymbol(code: string): string {
  return BY_CODE.get(normalizeCurrency(code))?.symbol ?? "$";
}
