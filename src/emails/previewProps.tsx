import type { ReactElement } from "react";
import { CancelledEmail } from "./CancelledEmail";
import { ReminderEmail } from "./ReminderEmail";
import { RenewalEmail, type RenewalStage } from "./RenewalEmail";
import { RequestSentEmail } from "./RequestSentEmail";
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
    logoUrl: "/email-logo.png",
  };
}

export type EmailVariant = {
  badge: string;
  subject: string;
  element: ReactElement;
};

// Same variants + subjects as the old text templates, so dispatch
// can switch over without copy drift.
export function emailVariants(): EmailVariant[] {
  const d = demoData();
  const renewal = (
    stage: RenewalStage,
    subject: string,
  ): EmailVariant => {
    const label =
      stage === "7d"
        ? "renews in 7 days"
        : stage === "3d"
          ? "renews in 3 days"
          : "renews tomorrow!";
    return {
      badge: `renewal • ${stage}`,
      subject,
      element: (
        <RenewalEmail
          d={{ ...d, label, urgent: stage === "24h" }}
          stage={stage}
        />
      ),
    };
  };
  return [
    renewal("7d", `Renewal Alert: ${d.merchant} renews in 7 days`),
    renewal("3d", `Renewal Alert: ${d.merchant} renews in 3 days`),
    renewal("24h", `Renewal Alert: ${d.merchant} renews tomorrow!`),
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
    {
      badge: "request sent",
      subject: `Cancellation request sent: ${d.merchant}`,
      element: <RequestSentEmail d={d} />,
    },
  ];
}
