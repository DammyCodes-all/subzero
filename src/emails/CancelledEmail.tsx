import { Text } from "react-email";
import {
  EmailLayout,
  NarrativeTitle,
  QuietLink,
  Strong,
  intervalNoun,
  namedPlan,
  p,
  signoff,
  type EmailData,
} from "./shared";

export function CancelledEmail({
  d,
  origin,
}: {
  d: EmailData;
  origin: "auto" | "manual";
}) {
  const plan = namedPlan(d);
  const noun = intervalNoun(d.billingInterval);
  return (
    <EmailLayout
      preview={`${d.merchant} cancelled`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <NarrativeTitle>
        Your {d.merchant} subscription has been cancelled
      </NarrativeTitle>
      <Text style={p}>
        {plan} is cancelled. You keep <Strong>{d.priceStr}</Strong> every{" "}
        {noun} from here on. It will not charge you again.
      </Text>
      <Text style={p}>
        {origin === "manual"
          ? "You marked this cancelled in SubZero, so your list is up to date."
          : `We saw ${d.merchant}'s confirmation email and updated your list.`}{" "}
        If that doesn&apos;t look right,{" "}
        <QuietLink href={d.ctaUrl}>restore it in SubZero</QuietLink>.
      </Text>
      <Text style={signoff}>SubZero</Text>
    </EmailLayout>
  );
}
