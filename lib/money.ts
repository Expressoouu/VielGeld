export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "INR"];

// Browser locale for number formatting; currency comes from the user's setting (see useMonthData).
const make = (currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency });
let fmtr = make("EUR");

export const setCurrency = (currency: string) => void (fmtr = make(currency));

// Money is stored as integer cents (all listed currencies have 2 decimals).
export const fmt = (cents: number) => fmtr.format(cents / 100);

/** "12,50" / "12.5" -> 1250; NaN when not a number. */
export const toCents = (s: string) => Math.round(parseFloat(s.replace(",", ".")) * 100);
