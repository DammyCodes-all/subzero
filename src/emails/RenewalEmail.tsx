import { Text } from "react-email";
import {
  ActionLink,
  EmailLayout,
  MainButton,
  NarrativeTitle,
  QuietLink,
  Strong,
  intervalNoun,
  namedPlan,
  p,
  signoff,
  type EmailData,
} from "./shared";

export type RenewalStage = "7d" | "3d" | "24h";

// One short letter per stage. 7d stays link only, 3d and 24h get a button
// because the charge is close enough to tap through.
export function RenewalEmail({
  d,
  stage,
}: {
  d: EmailData;
  stage: RenewalStage;
}) {
  const plan = namedPlan(d);
  const noun = intervalNoun(d.billingInterval);
  const target = d.cancelUrl ?? d.ctaUrl;
  const cancelLabel = `Cancel ${d.merchant}`;

  if (stage === "7d") {
    return (
      <EmailLayout
        preview={`${d.merchant} renews ${d.renewalStr}`}
        manageUrl={d.manageUrl}
        logoUrl={d.logoUrl}
      >
        <NarrativeTitle>
          Your {d.merchant} subscription renews in a week
        </NarrativeTitle>
        <Text style={p}>
          Your {plan} renews {d.renewalStr}. It will be{" "}
          <Strong>{d.priceStr}</Strong> for another {noun}
          {d.product ? ` of ${d.product}` : ""}.
        </Text>
        <Text style={p}>
          Still using it? Ignore this. We're flagging it now because there's still plenty of time to cancel before the charge.
        </Text>
        <Text style={p}>
          {d.cancelUrl ? (
            <>
              <ActionLink href={d.cancelUrl}>{cancelLabel}</ActionLink>{" "}
              directly, it takes about a minute. Or{" "}
              <QuietLink href={d.ctaUrl}>review it in SubZero</QuietLink> if
              you want the details first.
            </>
          ) : (
            <>
              <ActionLink href={d.ctaUrl}>Review it in SubZero</ActionLink>{" "}
              to see the cancellation steps before {d.renewalStr}.
            </>
          )}
        </Text>
        <Text style={signoff}>SubZero</Text>
      </EmailLayout>
    );
  }

  if (stage === "3d") {
    return (
      <EmailLayout
        preview={`${d.merchant} renews ${d.renewalStr}`}
        manageUrl={d.manageUrl}
        logoUrl={d.logoUrl}
      >
        <NarrativeTitle>
          {d.merchant} charges you {d.priceStr} in 3 days
        </NarrativeTitle>
        <Text style={p}>
          Your {plan} renews {d.renewalStr}. That is {d.priceStr} for another{" "}
          {noun}.
        </Text>
        <Text style={p}>
          Haven&apos;t opened it lately? Cancel now. Refunds after the charge
          are a pain.
        </Text>
        <MainButton href={target}>{cancelLabel}</MainButton>
        {d.cancelUrl ? (
          <Text style={p}>
            Or <QuietLink href={d.ctaUrl}>review it in SubZero</QuietLink>{" "}
            first.
          </Text>
        ) : null}
      </EmailLayout>
    );
  }

  return (
    <EmailLayout
      preview={`${d.merchant} renews tomorrow`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <NarrativeTitle>
        You will be charged {d.priceStr} tomorrow
      </NarrativeTitle>
      <Text style={p}>
        Your {plan} renews tomorrow. That means {d.merchant} will bill you <Strong>{d.priceStr}</Strong> for another {noun}
        {d.product ? ` of ${d.product}` : ""}.
      </Text>
      <Text style={p}>
        If you still use it, do nothing and it will just continue. If you no
        longer need it, cancel today so this charge never happens. Once it
        goes through, refunds are hard to get.
      </Text>
      <MainButton href={target}>{cancelLabel}</MainButton>
      {d.cancelUrl ? (
        <Text style={p}>
          It takes about a minute. Or{" "}
          <QuietLink href={d.ctaUrl}>review it in SubZero</QuietLink> first.
        </Text>
      ) : null}
    </EmailLayout>
  );
}
