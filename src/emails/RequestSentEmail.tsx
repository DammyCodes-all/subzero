import { Text } from "react-email";
import {
  EmailLayout,
  NarrativeTitle,
  QuietLink,
  Strong,
  namedPlan,
  p,
  shortInterval,
  type EmailData,
} from "./shared";

// Receipt after SubZero sends a cancellation request to the merchant.
// Requested to (merchant replies) to confirmed. Link only, nothing to tap.
export function RequestSentEmail({ d }: { d: EmailData }) {
  const plan = namedPlan(d);
  return (
    <EmailLayout
      preview={`Cancellation request sent, ${d.merchant}`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <NarrativeTitle>
        We asked {d.merchant} to cancel for you
      </NarrativeTitle>
      <Text style={p}>
        We contacted {d.merchant} about your {plan}. It sits at{" "}
        <Strong>{`${d.priceStr}/${shortInterval(d.billingInterval)}`}</Strong>
        , renewing {d.renewalStr}. That is the charge we are trying to stop.
      </Text>
      <Text style={p}>
        Now we wait for them to confirm. We will email you when it is done.
        No need to chase them.{" "}
        <QuietLink href={d.ctaUrl}>Follow the request in SubZero</QuietLink> if
        you are curious.
      </Text>
    </EmailLayout>
  );
}
