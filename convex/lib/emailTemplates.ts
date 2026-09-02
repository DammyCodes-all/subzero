// Plain text templates only — no HTML
function formatPrice(price: number, currency: string): string {
  const iso = currency?.toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: iso,
      maximumFractionDigits: iso === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${iso} ${price}`;
  }
}

function formatDate(ms?: number): string {
  if (!ms) return "soon";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

function siteUrl(): string {
  try {
    const fromEnv = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process?.env?.SITE_URL as string | undefined;
    if (fromEnv) return fromEnv.replace(/\/$/, "");
  } catch {}
  return "http://localhost:3000";
}

export type TemplateInput = {
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: string;
  nextRenewalAt?: number;
  trialEndsAt?: number;
  cancellationUrl?: string;
  cancellationDifficulty?: string;
  dashboardUrl?: string;
  subscriptionId?: string;
};

export function renewalNudgeTemplate(input: TemplateInput, type: "7d" | "3d" | "24h") {
  const label = type === "7d" ? "renews in 7 days" : type === "3d" ? "renews in 3 days" : "renews tomorrow!";
  const subject = `Renewal Alert: ${input.merchant} ${label}`;
  const priceStr = formatPrice(input.price, input.currency);
  const renewalStr = formatDate(input.nextRenewalAt);
  const dash = input.dashboardUrl ?? `${siteUrl()}/subscriptions/${input.subscriptionId ?? ""}`;
  const text = `Hi there,

Your ${input.merchant}${input.product ? ` (${input.product})` : ""} subscription (${priceStr}/${input.billingInterval}) ${label} — ${renewalStr}.

Price: ${priceStr}
Renews: ${renewalStr}

${input.cancellationUrl ? `Cancel directly: ${input.cancellationUrl}` : "Open SubZero to view cancellation steps."}

View in SubZero:
${dash}

Thanks,
SubZero`;
  return { subject, text };
}

export function trialEndingTemplate(input: TemplateInput) {
  const subject = `Trial ending: ${input.merchant} — ${formatDate(input.trialEndsAt)}`;
  const priceStr = formatPrice(input.price, input.currency);
  const trialStr = formatDate(input.trialEndsAt);
  const dash = input.dashboardUrl ?? `${siteUrl()}/subscriptions/${input.subscriptionId ?? ""}`;
  const text = `Hi there,

Your ${input.merchant} trial ends on ${trialStr}. After that you'll be charged ${priceStr}/${input.billingInterval}.

Trial ends: ${trialStr}
Then: ${priceStr}/${input.billingInterval}

Want to keep it? No action needed.
Want to cancel before charge?
${dash}

— SubZero`;
  return { subject, text };
}

export function cancelledTemplate(input: TemplateInput) {
  const subject = `Cancelled: ${input.merchant} — you're all set`;
  const priceStr = formatPrice(input.price, input.currency);
  const dash = input.dashboardUrl ?? siteUrl();
  const text = `Good news — your ${input.merchant} subscription is marked cancelled.

Saved: ${priceStr}/${input.billingInterval}
If you get charged anyway, forward the receipt to subzero-agent@agentmail.to and we'll flag it.

Manage: ${dash}

— SubZero`;
  return { subject, text };
}

export function actionReminderTemplate(input: TemplateInput) {
  const subject = `Still need to cancel ${input.merchant}?`;
  const priceStr = formatPrice(input.price, input.currency);
  const dash = input.dashboardUrl ?? `${siteUrl()}/subscriptions/${input.subscriptionId ?? ""}`;
  const text = `Reminder — you started cancelling ${input.merchant} (${priceStr}) but it's still active.

Renews: ${formatDate(input.nextRenewalAt)}
Finish here: ${dash}

— SubZero`;
  return { subject, text };
}
