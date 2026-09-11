import type { ReactElement } from "react";
import { CancelledEmail } from "./CancelledEmail";
import { ReminderEmail } from "./ReminderEmail";
import { RenewalEmail, type RenewalStage } from "./RenewalEmail";
import { RequestSentEmail } from "./RequestSentEmail";
import { TrialEmail } from "./TrialEmail";
import {
  cancelledSubject,
  reminderSubject,
  renewalSubject,
  requestSentSubject,
  trialSubject,
} from "./subjects";
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
    ctaUrl: "/subscriptions/demo",
    cancelUrl: "https://play.google.com/store/account/subscriptions",
    manageUrl: "/subscriptions/demo",
    logoUrl: "/email-logo.png",
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
  const g = googleFixture();
  const s = snapFixture();
  const renewal = (stage: RenewalStage, subject: string): EmailVariant => {
    return {
      badge: `renewal • ${stage}`,
      subject,
      element: <RenewalEmail d={g} stage={stage} />,
    };
  };
  return [
    renewal("7d", renewalSubject("7d", g)),
    renewal("3d", renewalSubject("3d", g)),
    renewal("24h", renewalSubject("24h", g)),
    {
      badge: "trial ending",
      subject: trialSubject(g),
      element: <TrialEmail d={g} />,
    },
    {
      badge: "cancelled • auto",
      subject: cancelledSubject(s),
      element: <CancelledEmail d={s} origin="auto" />,
    },
    {
      badge: "cancelled • manual",
      subject: cancelledSubject(s),
      element: <CancelledEmail d={s} origin="manual" />,
    },
    {
      badge: "action reminder",
      subject: reminderSubject(s),
      element: <ReminderEmail d={s} />,
    },
    {
      badge: "request sent",
      subject: requestSentSubject(g),
      element: <RequestSentEmail d={g} />,
    },
  ];
}
