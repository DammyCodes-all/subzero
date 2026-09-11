import { emailTheme as t } from "./theme";
import {
  DecisionButtons,
  EmailLayout,
  Hero,
  MailHeader,
  shortInterval,
  type EmailData,
} from "./shared";

export function TrialEmail({ d }: { d: EmailData }) {
  return (
    <EmailLayout
      preview={`${d.merchant} trial ends ${d.trialStr}`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText="Trial ending"
        accent={t.primary}
        iconUrl={d.iconUrl}
      />
      <Hero
        amount={`${d.priceStr}/${shortInterval(d.billingInterval)}`}
        sub={`Free until ${d.trialStr}`}
      />
      <DecisionButtons
        d={d}
        primaryLabel={`Cancel ${d.merchant} trial`}
        micro="Do nothing and the trial converts to paid."
      />
    </EmailLayout>
  );
}
