import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { normalizeEmail } from "../ingestion/normalize";
import { isSelfEmail } from "./selfMail";

const PRICE_HINT =
  /(\$|€|£|₦|₹|¥)\s*[\d,]+|[\d,]+\s*(USD|EUR|GBP|NGN|INR|JPY|CAD|AUD)/i;
const KEYWORDS =
  /receipt|invoice|trial|renew|subscri(?!be)|member|charged|billed|cancel|payment|plan|welcome|started|order number|auto[- ]?pay|billing|statement|GPA\./i;

// Promotional offers describe what you COULD buy ("Offer ends…", "Get deal",
// "92% off") — not a subscription the recipient holds. Screened pre-LLM so
// promos never burn extraction or reach the retry queue. Requires BOTH: an
// explicit offer marker AND no transaction evidence (receipt/order/active
// language saves legit mails that mention a discount).
const PROMO_OFFER =
  /offer ends|get (the )?deal|save now|\d+\s*% off|limited[- ]time offer|promo(code)?\b|use (this|the) code|deal expires/i;
const TRANSACTION_EVIDENCE =
  /order(\s|#| number)|receipt|invoice|GPA\.|charged|you paid|payment (received|confirmed|successful)|is now active|has (started|renewed|been activated)|welcome|trial (started|is active|ends)|first renewal|next (billing|renewal)/i;

export function isPromoOffer(hay: string): boolean {
  return PROMO_OFFER.test(hay) && !TRANSACTION_EVIDENCE.test(hay);
}

export async function processOneEmail(
  ctx: any,
  userId: string,
  subject: string,
  text: string,
  html: string,
  messageId: string,
  sourceEmail?: string,
  sourceConnectionId?: Id<"connections">,
  from?: string,
): Promise<{ status: string; subscriptionId?: string }> {
  // Never ingest our own outbound mail (nudges / test mails land in the
  // user's inbox and would otherwise become dummy subscriptions).
  if (isSelfEmail({ from, subject, text: `${subject} ${text}` }))
    return { status: "skipped" };
  const normalized = normalizeEmail({ text, html, subject });
  const hay = `${normalized.text} ${normalized.subject}`;
  if (!KEYWORDS.test(hay)) return { status: "skipped" };
  // PromoOffers ("Go Unlimited for US$1… Offer ends…") are not subscriptions.
  if (isPromoOffer(hay)) return { status: "skipped" };
  if (!PRICE_HINT.test(hay) && !/cancel/i.test(hay)) {
    // Bare "member" without price/cancel/trial/renewal signal stays out —
    // keeps "team member joined" noise from reaching the AI.
    if (!/trial|renew|subscri(?!be)/i.test(hay)) return { status: "skipped" };
  }
  const extracted: any = await ctx.runAction(
    internal.ingestion.extract.extractSubscription,
    {
      text: normalized.text,
      subject: normalized.subject,
      from: from ?? undefined,
    },
  );
  if (
    !extracted.isConfirmation &&
    (!extracted.merchant || extracted.price === undefined)
  ) {
    // Confident non-receipt (e.g. one-time purchase the model ruled out) —
    // not a failure, never retried. Anything ambiguous stays retry-eligible.
    if ((extracted.confidence ?? 0) >= 0.9) return { status: "skipped" };
    return { status: "unparsed" };
  }
  const source = `Gmail: ${subject.slice(0, 80)}`;
  const result: any = await ctx.runMutation(
    internal.ingestion.persist.persistExtracted,
    {
      userId,
      extracted,
      svixId: `gmail:${messageId}`,
      messageId: `gmail:${messageId}`,
      source,
      sourceEmail,
      sourceConnectionId,
    },
  );
  if (result.isDuplicate) return { status: "duplicate" };
  if ((result as { suppressed?: boolean }).suppressed)
    return { status: "skipped" };
  if (result.isNew && result.subscriptionId && !extracted.isConfirmation) {
    await ctx.scheduler.runAfter(
      0,
      internal.research.researchCancellationRoute,
      {
        subscriptionId: result.subscriptionId,
      },
    );
  }
  return {
    status: extracted.isConfirmation
      ? "cancelled"
      : result.isNew
        ? "created"
        : "merged",
    subscriptionId: result.subscriptionId,
  };
}
