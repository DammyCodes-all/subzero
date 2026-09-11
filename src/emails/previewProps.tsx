import type { ReactElement } from "react";
import { CancelledEmail } from "./CancelledEmail";
import { ReminderEmail } from "./ReminderEmail";
import { RenewalEmail, type RenewalStage } from "./RenewalEmail";
import { RequestSentEmail } from "./RequestSentEmail";
import { TrialEmail } from "./TrialEmail";
import type { EmailData } from "./shared";
import { formatPrice } from "./shared";
import { merchantFaviconUrl } from "@/lib/merchantFavicon";

const DAY = 24 * 60 * 60 * 1000;

function formatDate(ms?: number): string {
  if (!ms) return "soon";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

// Fixtures mirror the account's live subscriptions (pulled via
// `npx convex data subscriptions`): same merchants, products, prices,
// intervals and cancellation URLs. Dates stay relative so "renews in 7
// days" always reads coherently.
function googleFixture(): EmailData {
  const now = Date.now();
  const merchant = "Google One";
  return {
    merchant,
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
    iconUrl: merchantFaviconUrl({ merchant }),
  };
}

function snapFixture(): EmailData {
  const now = Date.now();
  const merchant = "Snap Inc";
  return {
    merchant,
    product: "Snapchat+",
    priceStr: formatPrice(2300, "NGN"),
    billingInterval: "yearly",
    renewalStr: formatDate(now + 20 * DAY),
    trialStr: formatDate(now + 2 * DAY),
    label: "",
    ctaUrl: "/subscriptions/demo",
    cancelUrl: "https://play.google.com/store/account/subscriptions",
    manageUrl: "/subscriptions/demo",
    logoUrl: "/email-logo.png",
    iconUrl: merchantFaviconUrl({ merchant }),
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
  const g = googleFixture();
  const s = snapFixture();
  const renewal = (
    stage: RenewalStage,
    subject: string,
  ): EmailVariant => {
    const label =
      stage === "7d"
        ? "renews in 7 days"
        : stage === "3d"
          ? "renews in 3 days"
          : "renews tomorrow";
    return {
      badge: `renewal • ${stage}`,
      subject,
      element: (
        <RenewalEmail
          d={{ ...g, label, urgent: stage === "24h" }}
          stage={stage}
        />
      ),
    };
  };
  return [
    renewal("7d", `Renewal Alert: ${g.merchant} renews in 7 days`),
    renewal("3d", `Renewal Alert: ${g.merchant} renews in 3 days`),
    renewal("24h", `Renewal Alert: ${g.merchant} renews tomorrow!`),
    {
      badge: "trial ending",
      subject: `Trial ending: ${g.merchant} — ${g.trialStr}`,
      element: <TrialEmail d={g} />,
    },
    {
      badge: "cancelled • auto",
      subject: `Cancelled: ${s.merchant}. You are all set`,
      element: <CancelledEmail d={s} origin="auto" />,
    },
    {
      badge: "cancelled • manual",
      subject: `Cancelled: ${s.merchant}. You are all set`,
      element: <CancelledEmail d={s} origin="manual" />,
    },
    {
      badge: "action reminder",
      subject: `Still need to cancel ${s.merchant}?`,
      element: <ReminderEmail d={s} />,
    },
    {
      badge: "request sent",
      subject: `Cancellation request sent: ${g.merchant}`,
      element: <RequestSentEmail d={g} />,
    },
  ];
}
