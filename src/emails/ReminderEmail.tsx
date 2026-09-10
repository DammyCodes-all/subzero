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
      />
      <Text style={p}>
        {`You started cancelling ${d.merchant} (${d.priceStr}) but it's still active.`}
      </Text>
      <Text style={meta}>
        <span style={metaLabel}>Renews</span>
        <strong>{d.renewalStr}</strong>
      </Text>
      <Cta href={d.ctaUrl}>Finish cancelling</Cta>
    </EmailLayout>
  );
}
