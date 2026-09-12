// Narrative email copy — mirrors src/emails/* voice and subjects.
// Convex cannot render React, so this is the plain-text + simple HTML
// source of truth for real sends. Keep subjects in sync with
// src/emails/subjects.ts.
function formatPrice(price: number, currency: string): string {
  const iso = currency?.toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: iso,
      minimumFractionDigits: 0,
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
    const fromEnv = (
      globalThis as unknown as { process?: { env?: Record<string, string> } }
    )?.process?.env?.SITE_URL as string | undefined;
    if (fromEnv) return fromEnv.replace(/\/$/, "");
  } catch {}
  return "http://localhost:3000";
}

function intervalNoun(billingInterval: string): string {
  const v = (billingInterval || "").trim().toLowerCase();
  if (v.startsWith("month")) return "month";
  if (v.startsWith("year") || v.startsWith("annual")) return "year";
  if (v.startsWith("week")) return "week";
  if (v.startsWith("quarter")) return "quarter";
  if (v.startsWith("day") || v.startsWith("daily")) return "day";
  return billingInterval.trim() || "period";
}

function namedPlan(merchant: string, product?: string): string {
  return product && product !== merchant
    ? `${merchant} (${product})`
    : merchant;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, bodyHtml: string, manageUrl: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 12px"><h1 style="font-size:22px;line-height:30px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}<p style="color:#888;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:24px">You get this because you track this subscription in SubZero. <a href="${esc(manageUrl)}">Manage notifications</a></p></div>`;
}

function pHtml(text: string): string {
  return `<p style="color:#444;font-size:15px;line-height:24px;margin:0 0 12px">${text}</p>`;
}

function buttonHtml(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:block;background:#0A1420;color:#fff;text-align:center;font-weight:bold;font-size:15px;padding:13px 20px;border-radius:8px;text-decoration:none;margin:16px 0 4px">${esc(label)}</a>`;
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

export function renewalSubject(
  stage: "7d" | "3d" | "24h",
  input: { merchant: string; priceStr: string },
): string {
  if (stage === "7d")
    return `Your ${input.merchant} subscription renews in a week!`;
  if (stage === "3d")
    return `${input.merchant} charges you ${input.priceStr} in 3 days!`;
  return `You will be charged ${input.priceStr} tomorrow!`;
}

export function cancelledSubject(input: { merchant: string }): string {
  return `Your ${input.merchant} subscription has been cancelled`;
}

export function renewalNudgeTemplate(
  input: TemplateInput,
  type: "7d" | "3d" | "24h",
) {
  const priceStr = formatPrice(input.price, input.currency);
  const renewalStr = formatDate(input.nextRenewalAt);
  const noun = intervalNoun(input.billingInterval);
  const plan = namedPlan(input.merchant, input.product);
  const ctaUrl =
    input.dashboardUrl ??
    `${siteUrl()}/dashboard/subscriptions?sub=${input.subscriptionId ?? ""}`;
  const manageUrl = `${siteUrl()}/dashboard/settings`;
  const subject = renewalSubject(type, {
    merchant: input.merchant,
    priceStr,
  });

  let title: string;
  let text: string;
  let bodyHtml: string;

  if (type === "7d") {
    title = `Your ${input.merchant} subscription renews in a week`;
    text =
      `${title}\n\n` +
      `Your ${plan} renews ${renewalStr}. It will be ${priceStr} for another ${noun}${input.product ? ` of ${input.product}` : ""}.\n\n` +
      `Still using it? Ignore this. We're flagging it now because there's still plenty of time to cancel before the charge.\n\n` +
      (input.cancellationUrl
        ? `Cancel ${input.merchant} directly: ${input.cancellationUrl}\nOr review it in SubZero: ${ctaUrl}`
        : `Review it in SubZero: ${ctaUrl}`) +
      `\n\nSubZero`;
    bodyHtml =
      pHtml(
        `Your ${esc(plan)} renews ${esc(renewalStr)}. It will be <strong>${esc(priceStr)}</strong> for another ${esc(noun)}.`,
      ) +
      pHtml(
        `Still using it? Ignore this. We're flagging it now because there's still plenty of time to cancel before the charge.`,
      ) +
      pHtml(
        input.cancellationUrl
          ? `<a href="${esc(input.cancellationUrl)}">Cancel ${esc(input.merchant)}</a> directly. Or <a href="${esc(ctaUrl)}">review it in SubZero</a>.`
          : `<a href="${esc(ctaUrl)}">Review it in SubZero</a> to see the cancellation steps before ${esc(renewalStr)}.`,
      );
  } else if (type === "3d") {
    title = `${input.merchant} charges you ${priceStr} in 3 days`;
    const target = input.cancellationUrl ?? ctaUrl;
    text =
      `${title}\n\n` +
      `Your ${plan} renews ${renewalStr}. That is ${priceStr} for another ${noun}.\n\n` +
      `Haven't opened it lately? Cancel now. Refunds after the charge are a pain.\n\n` +
      `Cancel here: ${target}` +
      (input.cancellationUrl ? `\nOr review it in SubZero: ${ctaUrl}` : "") +
      `\n\nSubZero`;
    bodyHtml =
      pHtml(
        `Your ${esc(plan)} renews ${esc(renewalStr)}. That is ${esc(priceStr)} for another ${esc(noun)}.`,
      ) +
      pHtml(`Haven't opened it lately? Cancel now. Refunds after the charge are a pain.`) +
      buttonHtml(target, `Cancel ${input.merchant}`) +
      (input.cancellationUrl
        ? pHtml(`Or <a href="${esc(ctaUrl)}">review it in SubZero</a> first.`)
        : "");
  } else {
    title = `You will be charged ${priceStr} tomorrow`;
    const target = input.cancellationUrl ?? ctaUrl;
    text =
      `${title}\n\n` +
      `Your ${plan} renews tomorrow. That means ${input.merchant} will bill you ${priceStr} for another ${noun}${input.product ? ` of ${input.product}` : ""}.\n\n` +
      `If you still use it, do nothing and it will just continue. If you no longer need it, cancel today so this charge never happens. Once it goes through, refunds are hard to get.\n\n` +
      `Cancel here: ${target}` +
      (input.cancellationUrl ? `\nOr review it in SubZero: ${ctaUrl}` : "") +
      `\n\nSubZero`;
    bodyHtml =
      pHtml(
        `Your ${esc(plan)} renews tomorrow. That means ${esc(input.merchant)} will bill you <strong>${esc(priceStr)}</strong> for another ${esc(noun)}.`,
      ) +
      pHtml(
        `If you still use it, do nothing and it will just continue. If you no longer need it, cancel today so this charge never happens. Once it goes through, refunds are hard to get.`,
      ) +
      buttonHtml(target, `Cancel ${input.merchant}`) +
      (input.cancellationUrl
        ? pHtml(
            `It takes about a minute. Or <a href="${esc(ctaUrl)}">review it in SubZero</a> first.`,
          )
        : "");
  }

  return { subject, text, html: shell(title, bodyHtml, manageUrl) };
}

export function trialEndingTemplate(input: TemplateInput) {
  const subject = `Trial ending: ${input.merchant} — ${formatDate(input.trialEndsAt)}`;
  const priceStr = formatPrice(input.price, input.currency);
  const trialStr = formatDate(input.trialEndsAt);
  const dash =
    input.dashboardUrl ??
    `${siteUrl()}/dashboard/subscriptions?sub=${input.subscriptionId ?? ""}`;
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

export function cancelledTemplate(
  input: TemplateInput,
  origin: "auto" | "manual" = "auto",
) {
  const subject = cancelledSubject({ merchant: input.merchant });
  const priceStr = formatPrice(input.price, input.currency);
  const noun = intervalNoun(input.billingInterval);
  const plan = namedPlan(input.merchant, input.product);
  const ctaUrl =
    input.dashboardUrl ??
    `${siteUrl()}/dashboard/subscriptions?sub=${input.subscriptionId ?? ""}`;
  const manageUrl = `${siteUrl()}/dashboard/settings`;
  const title = `Your ${input.merchant} subscription has been cancelled`;
  const first =
    origin === "manual"
      ? "You marked this cancelled in SubZero, so your list is up to date."
      : `We saw ${input.merchant}'s confirmation email and updated your list.`;
  const text =
    `${title}\n\n` +
    `${plan} is cancelled. You keep ${priceStr} every ${noun} from here on. It will not charge you again.\n\n` +
    `${first} If that doesn't look right, restore it in SubZero: ${ctaUrl}\n\nSubZero`;
  const bodyHtml =
    pHtml(
      `${esc(plan)} is cancelled. You keep <strong>${esc(priceStr)}</strong> every ${esc(noun)} from here on. It will not charge you again.`,
    ) + pHtml(`${esc(first)} If that doesn't look right, <a href="${esc(ctaUrl)}">restore it in SubZero</a>.`);
  return { subject, text, html: shell(title, bodyHtml, manageUrl) };
}

export function actionReminderTemplate(input: TemplateInput) {
  const subject = `Still need to cancel ${input.merchant}?`;
  const priceStr = formatPrice(input.price, input.currency);
  const dash =
    input.dashboardUrl ??
    `${siteUrl()}/dashboard/subscriptions?sub=${input.subscriptionId ?? ""}`;
  const text = `Reminder — you started cancelling ${input.merchant} (${priceStr}) but it's still active.

Renews: ${formatDate(input.nextRenewalAt)}
Finish here: ${dash}

— SubZero`;
  return { subject, text };
}
