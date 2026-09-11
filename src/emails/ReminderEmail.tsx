import { Text } from "react-email";
import { emailTheme as t } from "./theme";
import {
  Cta,
  EmailLayout,
  MailHeader,
  meta,
  metaLabel,
  p,
  type EmailData,
} from "./shared";

export function ReminderEmail({ d }: { d: EmailData }) {
  return (
    <EmailLayout
      preview={`Still need to cancel ${d.merchant}?`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText="Still active"
        accent={t.danger}
        iconUrl={d.iconUrl}
      />
      <Text style={p}>
        {`You started cancelling ${d.merchant} but didn't finish. It renews on ${d.renewalStr} for ${d.priceStr} — complete it before then.`}
      </Text>
      <Text style={meta}>
        <span style={metaLabel}>Renews</span>
        <strong>{d.renewalStr}</strong>
        <br />
        <span style={metaLabel}>Next charge</span>
        <strong>{d.priceStr}</strong>
      </Text>
      <Cta href={d.ctaUrl}>Finish cancelling</Cta>
    </EmailLayout>
  );
}
