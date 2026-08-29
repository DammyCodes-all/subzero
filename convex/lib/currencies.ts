// Top 8 currencies for hackathon — ISO 4217 + symbol mapping
// Best practice: store ISO code, display via Intl, respect minor units

export const SYMBOL_TO_ISO: Record<string, string> = {
  "$": "USD",
  "C$": "CAD",
  "A$": "AUD",
  "€": "EUR",
  "£": "GBP",
  "₦": "NGN",
  "₹": "INR",
  "¥": "JPY",
};

// ISO codes we explicitly support — others fallback via Intl if Groq returns them
export const ISO_SET = new Set([
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "INR",
  "JPY",
  "CAD",
  "AUD",
]);

// Zero-decimal currencies (minor unit = 0) — Intl should show no .00
export const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "BIF", "PYG"]);

// Normalize free-form currency strings to ISO 4217
// Maps "US Dollar", "$", "US$" → "USD", validates against ISO_SET
export function normalizeCurrency(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toUpperCase();
  if (!s) return undefined;
  // Direct ISO
  if (/^[A-Z]{3}$/.test(s) && ISO_SET.has(s)) return s;
  // Common long forms
  const map: Record<string, string> = {
    "US DOLLAR": "USD",
    "US DOLLARS": "USD",
    "USDOLLAR": "USD",
    "DOLLAR": "USD",
    "EURO": "EUR",
    "POUND": "GBP",
    "BRITISH POUND": "GBP",
    "NAIRA": "NGN",
    "NGN": "NGN",
    "RUPEE": "INR",
    "INDIAN RUPEE": "INR",
    "YEN": "JPY",
    "JAPANESE YEN": "JPY",
    "CANADIAN DOLLAR": "CAD",
    "AUSTRALIAN DOLLAR": "AUD",
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "₦": "NGN",
    "₹": "INR",
    "¥": "JPY",
    "C$": "CAD",
    "A$": "AUD",
  };
  if (map[s]) return map[s];
  // Slice first 3 letters for cases like "USDollars"
  const slice = s.slice(0, 3);
  if (ISO_SET.has(slice)) return slice;
  // If it's 3 letters but not in our Top 8, still allow if it looks like ISO (e.g. ZAR, KES) — let Intl try
  if (/^[A-Z]{3}$/.test(s)) return s;
  return undefined;
}
