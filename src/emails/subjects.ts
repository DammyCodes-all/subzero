import type { RenewalStage } from "./RenewalEmail";

// Subject lines for every outbound mail. Pure functions over
// preformatted strings (no JSX, no React import) so any caller — the
// preview page today, Convex dispatch tomorrow — builds the exact
// same subject from any subscription. Amounts/dates arrive already
// formatted; only the merchant name is interpolated raw.
export function renewalSubject(
  stage: RenewalStage,
  input: { merchant: string; priceStr: string },
): string {
  if (stage === "7d") return `Your ${input.merchant} subscription renews in a week!`;
  if (stage === "3d")
    return `${input.merchant} charges you ${input.priceStr} in 3 days!`;
  return `You will be charged ${input.priceStr} tomorrow!`;
}

export function trialSubject(input: {
  priceStr: string;
  trialStr: string;
  billingInterval: string;
}): string {
  const v = input.billingInterval.trim().toLowerCase();
  // monthly → "every month", yearly → "every year", "per seat" passes
  // through untouched (no "per per seat").
  const every = v.startsWith("month")
    ? "every month"
    : v.startsWith("year") || v.startsWith("annual")
      ? "every year"
      : v.startsWith("week")
        ? "every week"
        : v.startsWith("day") || v.startsWith("daily")
          ? "every day"
          : v.startsWith("per")
            ? input.billingInterval.trim()
            : `every ${input.billingInterval.trim()}`;
  return `You will be charged ${input.priceStr} ${every} starting ${input.trialStr}!`;
}

export function cancelledSubject(input: { merchant: string }): string {
  return `Your ${input.merchant} subscription has been cancelled`;
}

export function reminderSubject(input: { merchant: string }): string {
  return `You didn't finish cancelling ${input.merchant}!`;
}

export function requestSentSubject(input: { merchant: string }): string {
  return `We asked ${input.merchant} to cancel your subscription`;
}
