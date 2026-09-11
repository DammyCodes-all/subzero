import { Text } from "react-email";
import { emailTheme as t } from "./theme";
import {
  Cta,
  DirectCancel,
  EmailLayout,
  MailHeader,
  meta,
  metaLabel,
  p,
  prettyInterval,
  shortInterval,
  type EmailData,
} from "./shared";

export type RenewalStage = "7d" | "3d" | "24h";

// Same template, escalating directness: 7d informs, 3d warns, 24h alarms.
export function RenewalEmail({
  d,
  stage,
}: {
  d: EmailData;
  stage: RenewalStage;
}) {
  const accent = stage === "24h" ? t.danger : t.primary;
  const per = `${d.priceStr}/${shortInterval(d.billingInterval)}`;
  // 7d informs, 3d warns, 24h alarms — same layout, escalating language.
  const lead =
    stage === "7d"
      ? `Your subscription renews on ${d.renewalStr}.`
      : stage === "3d"
        ? `${d.merchant} charges ${per} in 3 days.`
        : `${d.priceStr} will be charged tomorrow.`;
  return (
    <EmailLayout
      preview={`${d.merchant} ${d.label} — ${d.renewalStr}`}
      manageUrl={d.manageUrl}
      logoUrl={d.logoUrl}
    >
      <MailHeader
        merchant={d.merchant}
        product={d.product}
        eyebrowText={d.label}
        accent={accent}
        iconUrl={d.iconUrl}
      />
      <Text style={p}>{lead}</Text>
      <Text style={meta}>
        <span style={metaLabel}>Next charge</span>
        <strong>{d.priceStr}</strong>
        <br />
        <span style={metaLabel}>Renews</span>
        <strong>{d.renewalStr}</strong>
        <br />
        <span style={metaLabel}>Billing</span>
        <strong>{prettyInterval(d.billingInterval)}</strong>
      </Text>
      <Cta href={d.ctaUrl}>Review subscription</Cta>
      <DirectCancel d={d} />
    </EmailLayout>
  );
}
