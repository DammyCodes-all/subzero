import { Text } from "react-email";
import {
  EmailLayout,
  MainButton,
  NarrativeTitle,
  Strong,
  namedPlan,
  p,
  type EmailData,
} from "./shared";

export function ReminderEmail({ d }: { d: EmailData }) {
  const plan = namedPlan(d);
  return (
    <EmailLayout
      preview={`Still need to cancel ${d.merchant}?`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <NarrativeTitle>
        You didn&apos;t finish cancelling {d.merchant}
      </NarrativeTitle>
      <Text style={p}>
        You started cancelling {plan} but it is still on. Left alone it
        renews <Strong>{d.renewalStr}</Strong> for{" "}
        <Strong>{d.priceStr}</Strong>.
      </Text>
      <Text style={p}>Finish it now while you are thinking about it.</Text>
      <MainButton href={d.ctaUrl}>Finish cancelling</MainButton>
    </EmailLayout>
  );
}
