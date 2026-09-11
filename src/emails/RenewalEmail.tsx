import { emailTheme as t } from "./theme";
import {
  DecisionButtons,
  EmailLayout,
  Hero,
  MailHeader,
  prettyInterval,
  type EmailData,
} from "./shared";

export type RenewalStage = "7d" | "3d" | "24h";

// Eyebrow carries the when, hero carries the how-much. The decision
// block does the helping: cancel is one tap, keeping needs nothing.
export function RenewalEmail({
  d,
  stage,
}: {
  d: EmailData;
  stage: RenewalStage;
}) {
  const accent = stage === "24h" ? t.danger : t.primary;
  const sub =
    stage === "7d"
      ? `Renews ${d.renewalStr} · ${prettyInterval(d.billingInterval)}`
      : stage === "3d"
        ? `Charges ${d.renewalStr} · ${prettyInterval(d.billingInterval)}`
        : `Charged tomorrow · ${d.renewalStr}`;
  return (
    <EmailLayout
      preview={`${d.merchant} ${d.label} — ${d.renewalStr}`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText={d.label}
        accent={accent}
        iconUrl={d.iconUrl}
      />
      <Hero
        amount={d.priceStr}
        sub={sub}
        tone={stage === "24h" ? "urgent" : "neutral"}
      />
      <DecisionButtons
        d={d}
        primaryLabel={`Cancel ${d.merchant}`}
        micro="No action needed to keep it."
      />
    </EmailLayout>
  );
}
