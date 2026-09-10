import { Text } from "react-email";
import { emailTheme as t } from "./theme";
import {
  Cta,
  EmailLayout,
  MailHeader,
  meta,
  metaLabel,
  p,
  shortInterval,
  type EmailData,
} from "./shared";

export function TrialEmail({ d }: { d: EmailData }) {
  return (
    <EmailLayout
      preview={`${d.merchant} trial ends ${d.trialStr}`}
      manageUrl={d.manageUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText="Trial ending"
        accent={t.primary}
      />
      <Text style={p}>
        {`Your trial ends on ${d.trialStr}. After that you'll be charged ${d.priceStr}/${shortInterval(d.billingInterval)}.`}
      </Text>
      <Text style={meta}>
        <span style={metaLabel}>Trial ends</span>
        <strong>{d.trialStr}</strong>
        <br />
        <span style={metaLabel}>Then</span>
        <strong>{`${d.priceStr}/${shortInterval(d.billingInterval)}`}</strong>
      </Text>
      <Cta href={d.ctaUrl}>Cancel before charge</Cta>
    </EmailLayout>
  );
}
