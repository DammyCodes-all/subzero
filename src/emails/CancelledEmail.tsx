import { Text } from "react-email";
import { emailTheme as t } from "./theme";
import {
  Cta,
  EmailLayout,
  Hero,
  MailHeader,
  p,
  shortInterval,
  type EmailData,
} from "./shared";

export function CancelledEmail({
  d,
  origin,
}: {
  d: EmailData;
  origin: "auto" | "manual";
}) {
  return (
    <EmailLayout preview={`${d.merchant} cancelled`} manageUrl={d.manageUrl} logoUrl={d.logoUrl}>
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText="Cancelled"
        accent={t.primary}
        iconUrl={d.iconUrl}
      />
      <Hero
        amount={`${d.priceStr}/${shortInterval(d.billingInterval)}`}
        sub="Saved · never charged again"
        tone="success"
      />
      <Text style={p}>
        {origin === "manual"
          ? `You marked this subscription cancelled.`
          : `We spotted ${d.merchant}'s cancellation email and marked it cancelled.`}
      </Text>
      <Text style={p}>
        If this looks wrong, open SubZero and restore it in one tap.
      </Text>
      <Cta href={d.ctaUrl}>View subscription</Cta>
    </EmailLayout>
  );
}
