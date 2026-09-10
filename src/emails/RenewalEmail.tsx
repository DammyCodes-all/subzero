import { Text } from "react-email";
import { emailTheme as t } from "./theme";
import {
  Cta,
  DirectCancel,
  EmailLayout,
  MailHeader,
  meta,
  metaLabel,
  shortInterval,
  type EmailData,
} from "./shared";

export function RenewalEmail({ d }: { d: EmailData }) {
  const accent = d.urgent ? t.danger : t.primary;
  return (
    <EmailLayout
      preview={`${d.merchant} ${d.label} — ${d.renewalStr}`}
      manageUrl={d.manageUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText={d.label}
        accent={accent}
      />
      <Text style={meta}>
        <span style={metaLabel}>Price</span>
        <strong>{`${d.priceStr}/${shortInterval(d.billingInterval)}`}</strong>
        <br />
        <span style={metaLabel}>Renews</span>
        <strong>{d.renewalStr}</strong>
      </Text>
      <Cta href={d.ctaUrl}>Review subscription</Cta>
      <DirectCancel d={d} />
    </EmailLayout>
  );
}
