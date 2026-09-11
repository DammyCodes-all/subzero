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

// Receipt to the user after SubZero sends a cancellation request to the
// merchant. Closes the loop: requested → (merchant replies) → confirmed.
export function RequestSentEmail({ d }: { d: EmailData }) {
  return (
    <EmailLayout
      preview={`Cancellation request sent — ${d.merchant}`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText="Cancellation requested"
        accent={t.primary}
        iconUrl={d.iconUrl}
      />
      <Text style={p}>
        {`We've contacted ${d.merchant} to cancel your subscription.`}
      </Text>
      <Text style={meta}>
        <span style={metaLabel}>Subscription</span>
        <strong>{d.product ?? d.merchant}</strong>
        <br />
        <span style={metaLabel}>Renews</span>
        <strong>{d.renewalStr}</strong>
        <br />
        <span style={metaLabel}>Amount at risk</span>
        <strong>{`${d.priceStr}/${shortInterval(d.billingInterval)}`}</strong>
      </Text>
      <Text style={p}>
        {`We're waiting for confirmation from ${d.merchant}.`}
      </Text>
      <Cta href={d.ctaUrl}>View request</Cta>
    </EmailLayout>
  );
}
