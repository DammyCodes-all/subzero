import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { normalizeEmail } from "../ingestion/normalize";
import { isSelfEmail } from "./selfMail";

const PRICE_HINT =
  /(\$|€|£|₦|₹|¥)\s*[\d,]+|[\d,]+\s*(USD|EUR|GBP|NGN|INR|JPY|CAD|AUD)/i;
const KEYWORDS =
  /receipt|trial|renewal|subscription|invoice|charged|billed|cancelled|canceled|payment|plan|order number|GPA\./i;

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
  if (!PRICE_HINT.test(hay) && !/cancelled|canceled/i.test(hay)) {
    if (!/trial|renewal|subscription/i.test(hay)) return { status: "skipped" };
  }
  const extracted: any = await ctx.runAction(
    internal.ingestion.extract.extractSubscription,
    {
      text: normalized.text,
      subject: normalized.subject,
    },
  );
  if (
    !extracted.isConfirmation &&
    (!extracted.merchant || extracted.price === undefined)
  ) {
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
