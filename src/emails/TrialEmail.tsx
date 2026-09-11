import { Text } from "react-email";
import {
  EmailLayout,
  MainButton,
  NarrativeTitle,
  QuietLink,
  Strong,
  intervalNoun,
  namedPlan,
  p,
  type EmailData,
} from "./shared";

export function TrialEmail({ d }: { d: EmailData }) {
  const plan = namedPlan(d);
  const noun = intervalNoun(d.billingInterval);
  return (
    <EmailLayout
      preview={`${d.merchant} trial ends ${d.trialStr}`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <NarrativeTitle>
        Your {d.merchant} free trial ends soon
      </NarrativeTitle>
      <Text style={p}>
        You started {plan} as a free trial. On {d.trialStr} the trial ends
        and it automatically turns into a paid plan at{" "}
        <Strong>{d.priceStr}</Strong> every {noun}. That will be your first
        real charge.
      </Text>
      <Text style={p}>
        If you want to keep it, do nothing and it will convert on its own. If
        you only signed up to try it, cancel before {d.trialStr} so you are
        never charged. It takes about a minute.
      </Text>
      <MainButton href={d.cancelUrl ?? d.ctaUrl}>
        Cancel the {d.merchant} trial
      </MainButton>
      {d.cancelUrl ? (
        <Text style={p}>
          Or <QuietLink href={d.ctaUrl}>review it in SubZero</QuietLink>.
        </Text>
      ) : null}
    </EmailLayout>
  );
}
