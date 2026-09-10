import type { ReactElement } from "react";
import { CancelledEmail } from "./CancelledEmail";
import { ReminderEmail } from "./ReminderEmail";
import { RenewalEmail } from "./RenewalEmail";
import { TrialEmail } from "./TrialEmail";
import type { EmailData } from "./shared";
import { formatPrice } from "./shared";

const DAY = 24 * 60 * 60 * 1000;

function formatDate(ms?: number): string {
  if (!ms) return "soon";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

// Synthetic fixtures only — never feed real user rows into preview.
function demoData(): EmailData {
  const now = Date.now();
  return {
    merchant: "Google One",
    product: "Google AI Plus (400 GB)",
    priceStr: formatPrice(7700, "NGN"),
    billingInterval: "monthly",
    renewalStr: formatDate(now + 6 * DAY),
    trialStr: formatDate(now + 2 * DAY),
    label: "",
    ctaUrl: "/subscriptions/demo",
    cancelUrl: "https://play.google.com/store/account/subscriptions",
    manageUrl: "/subscriptions/demo",
  };
}

export type EmailVariant = {
  badge: string;
  subject: string;
  element: ReactElement;
};

// Same 7 variants + subjects as the old text templates, so dispatch
// can switch over without copy drift.
export function emailVariants(): EmailVariant[] {
  const d = demoData();
  const withLabel = (label: string, urgent = false): EmailData => ({
    ...d,
    label,
    urgent,
  });
  return [
    {
      badge: "renewal • 7d",
      subject: `Renewal Alert: ${d.merchant} renews in 7 days`,
      element: <RenewalEmail d={withLabel("renews in 7 days")} />,
    },
    {
      badge: "renewal • 3d",
      subject: `Renewal Alert: ${d.merchant} renews in 3 days`,
      element: <RenewalEmail d={withLabel("renews in 3 days")} />,
    },
    {
      badge: "renewal • 24h",
      subject: `Renewal Alert: ${d.merchant} renews tomorrow!`,
      element: <RenewalEmail d={withLabel("renews tomorrow!", true)} />,
    },
    {
      badge: "trial ending",
      subject: `Trial ending: ${d.merchant} — ${d.trialStr}`,
      element: <TrialEmail d={d} />,
    },
    {
      badge: "cancelled • auto",
      subject: `Cancelled: ${d.merchant}. You are all set`,
      element: <CancelledEmail d={d} origin="auto" />,
    },
    {
      badge: "cancelled • manual",
      subject: `Cancelled: ${d.merchant}. You are all set`,
      element: <CancelledEmail d={d} origin="manual" />,
    },
    {
      badge: "action reminder",
      subject: `Still need to cancel ${d.merchant}?`,
      element: <ReminderEmail d={d} />,
    },
  ];
}
