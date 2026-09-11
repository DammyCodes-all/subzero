import { Text } from "react-email";
import { emailTheme as t } from "./theme";
import {
  Cta,
  EmailLayout,
  Hero,
  MailHeader,
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
      <Hero
        amount={d.priceStr}
        sub={`Renews ${d.renewalStr}`}
        tone="urgent"
      />
      <Text style={p}>
        {`You started cancelling ${d.merchant} but didn't finish.`}
      </Text>
      <Cta href={d.ctaUrl}>Finish cancelling</Cta>
    </EmailLayout>
  );
}
