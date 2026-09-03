const ZERO_DECIMAL = new Set([
  "JPY",
  "KRW",
  "VND",
  "CLP",
  "BIF",
  "PYG",
  "GNF",
  "MGA",
]);

export function formatPrice(
  price: number,
  currency: string,
  interval?: string,
) {
  const code = (currency || "USD").toUpperCase();
  const isZero = ZERO_DECIMAL.has(code);
  // Whole amounts drop the decimals (₦7,700 not ₦7,700.00); fractions keep 2dp.
  const minimumDigits = isZero || Number.isInteger(price) ? 0 : 2;
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: minimumDigits,
      maximumFractionDigits: isZero ? 0 : 2,
    }).format(price);
  } catch {
    // Invalid ISO (e.g. "US Dollar") — fallback to code + number
    formatted = `${code} ${price.toFixed(minimumDigits)}`;
  }
  if (interval === "monthly") return `${formatted}/mo`;
  if (interval === "yearly") return `${formatted}/yr`;
  if (interval === "weekly") return `${formatted}/wk`;
  return formatted;
}

export function daysUntil(ts?: number): number | null {
  if (!ts) return null;
  const diff = ts - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function formatCountdown(ts?: number): string {
  const d = daysUntil(ts);
  if (d === null) return "-";
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `${d} days`;
}

export function formatCountdownShort(ts?: number): string {
  const d = daysUntil(ts);
  if (d === null) return "-";
  if (d <= 0) return "today";
  if (d === 1) return "1d";
  return `${d}d`;
}

export function formatRenewalDate(ts?: number): string {
  if (!ts) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year:
      ts && new Date(ts).getFullYear() !== new Date().getFullYear()
        ? "numeric"
        : undefined,
  }).format(new Date(ts));
}

export function frictionLabel(
  difficulty?: string | null,
  steps?: number,
): string {
  const base =
    difficulty === "very_high"
      ? "Very high friction"
      : difficulty === "high"
        ? "High friction"
        : difficulty === "medium"
          ? "Medium friction"
          : difficulty === "low"
            ? "Low friction"
            : "Unknown friction";
  if (steps && steps > 0) return `${base} · ${steps} steps`;
  return base;
}

export function isUrgent(ts?: number): boolean {
  const d = daysUntil(ts);
  return d !== null && d <= 2 && d >= 0;
}

export function needsAttention(ts?: number): boolean {
  const d = daysUntil(ts);
  return d !== null && d >= 0 && d <= 7;
}
