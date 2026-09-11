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
      logoUrl={d.logoUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText="Trial ending"
        accent={t.primary}
        iconUrl={d.iconUrl}
      />
      <Text style={p}>
        {`${d.merchant} becomes ${d.priceStr}/${shortInterval(d.billingInterval)} on ${d.trialStr}. If you don't want it, cancel before then.`}
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
