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
      ? "Very hard to cancel"
      : difficulty === "high"
        ? "Hard to cancel"
        : difficulty === "medium"
          ? "Some effort to cancel"
          : difficulty === "low"
            ? "Easy to cancel"
            : "Cancel effort unknown";
  if (steps && steps > 0) return `${base} · ${steps} steps`;
  return base;
}

// Display names: the product is what users recognize ("Snapchat+"), the
// merchant is the legal entity ("Snap Inc"). Also strips raw store-listing
// suffixes the extractor sometimes keeps ("Snapchat+ (Snapchat: Chat with
// Friends)" — App Store titles are "Name: Tagline" inside parens).
export function displayNames(
  merchant: string,
  product?: string | null,
): { title: string; subtitle: string | null } {
  const cleaned =
    product?.replace(/\s*\([^()]*:[^()]*\)\s*$/, "").trim() || null;
  const title = cleaned || merchant;
  return { title, subtitle: title !== merchant ? merchant : null };
}

export function isUrgent(ts?: number): boolean {
  const d = daysUntil(ts);
  return d !== null && d <= 2 && d >= 0;
}

export function needsAttention(ts?: number): boolean {
  const d = daysUntil(ts);
  return d !== null && d >= 0 && d <= 7;
}

// Single source of truth for urgency badges. Never hardcode "Due soon" —
// it must reflect the actual renewal date, not the card slot.
export function urgencyLabel(
  nextRenewalAt?: number,
  trialEndsAt?: number,
): string | null {
  if (isUrgent(nextRenewalAt) || isUrgent(trialEndsAt)) return "Action needed";
  const ts = [nextRenewalAt, trialEndsAt]
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b)[0];
  if (ts === undefined) return null;
  const d = daysUntil(ts);
  if (d === null) return null;
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return "Due soon";
  return `In ${d} days`;
}
