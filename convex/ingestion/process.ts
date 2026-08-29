"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { normalizeEmail } from "./normalize";

const KEYWORDS =
  /receipt|trial|renewal|subscription|invoice|charged|billed|cancelled|canceled|payment|plan/i;

export const processForwardedEmail = internalAction({
  args: {
    inboxId: v.string(),
    to: v.string(),
    from: v.string(),
    subject: v.string(),
    text: v.optional(v.string()),
    html: v.optional(v.string()),
    svixId: v.optional(v.string()),
    svixTimestamp: v.optional(v.number()),
    messageId: v.optional(v.string()),
  },
  returns: v.object({
    subscriptionId: v.union(v.id("subscriptions"), v.null()),
    evidenceId: v.union(v.id("evidence"), v.null()),
    status: v.union(
      v.literal("created"),
      v.literal("merged"),
      v.literal("cancelled"),
      v.literal("duplicate"),
      v.literal("skipped"),
      v.literal("unparsed"),
      v.literal("no_user"),
    ),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    subscriptionId: Id<"subscriptions"> | null;
    evidenceId: Id<"evidence"> | null;
    status:
      | "created"
      | "merged"
      | "cancelled"
      | "duplicate"
      | "skipped"
      | "unparsed"
      | "no_user";
  }> => {
    void args.svixTimestamp;
    const inboxId = args.inboxId.trim();
    const from = args.from.trim();
    const to = args.to.trim();

    // 1. Resolve user (prefer inboxId, then to, then from as last resort)
    const userId: string | null = await ctx.runQuery(
      internal.agentmail.resolveUserByInbox,
      { inboxId, fallbackTo: to || undefined, fallbackFrom: from || undefined },
    );
    if (!userId) {
      return { subscriptionId: null, evidenceId: null, status: "no_user" };
    }

    // 2. Dedupe is handled atomically inside persistExtracted transaction.
    // Do not pre-check here — that creates a TOCTOU window between read and
    // write. The mutation checks by_svixId and returns duplicate if seen.

    // 3. Hydrate if body empty due to 1MB cap — try fetch full message
    let text = args.text ?? "";
    let html = args.html ?? "";
    if (!text && !html && args.messageId) {
      try {
        const apiKey = process.env.AGENTMAIL_API_KEY;
        if (apiKey) {
          const res = await fetch(
            `https://api.agentmail.to/v1/messages/${encodeURIComponent(args.messageId)}`,
            { headers: { Authorization: `Bearer ${apiKey}` } },
          );
          if (res.ok) {
            const j = (await res.json()) as { text?: string; html?: string };
            if (j.text) text = j.text;
            if (j.html) html = j.html;
          }
        }
      } catch {
        // ignore hydrate failure
      }
    }

    // 4. Normalize
    const normalized = normalizeEmail({ text, html, subject: args.subject });
    const bodyForKeyword = `${normalized.text} ${normalized.subject}`.trim();
    if (!KEYWORDS.test(bodyForKeyword)) {
      // Still allow confirmation emails that might not have keywords? Already covered by regex above (cancelled)
      // If no keyword match, treat as unparsed — no LLM call to save cost
      return { subscriptionId: null, evidenceId: null, status: "skipped" };
    }

    // 5. Extract via OpenAI (or mock)
    const extracted: {
      merchant?: string;
      product?: string;
      price?: number;
      currency?: string;
      billingInterval: "monthly" | "yearly" | "weekly" | "unknown";
      nextRenewalAt?: number;
      trialEndsAt?: number;
      billingProvider?: string;
      isConfirmation: boolean;
      confidence: number;
      quote: string;
    } = await ctx.runAction(internal.ingestion.extract.extractSubscription, {
      text: normalized.text,
      subject: normalized.subject,
    });

    const source = `${extracted.merchant ?? args.subject.slice(0, 40) ?? "Forwarded email"} via forward`;
    const excerpt =
      extracted.quote || normalized.text.slice(0, 500) || args.subject;

    // 6. Handle missing merchant/price for normal receipts
    if (
      !extracted.isConfirmation &&
      (!extracted.merchant || extracted.price === undefined)
    ) {
      // Don't create subscription, but we still want traceability — persistUnparsed is no-op for now, just return unparsed
      return { subscriptionId: null, evidenceId: null, status: "unparsed" };
    }

    // 7. Persist
    const result = (await ctx.runMutation(
      internal.ingestion.persist.persistExtracted,
      {
        userId,
        extracted,
        svixId: args.svixId,
        messageId: args.messageId,
        source,
      },
    )) as {
      subscriptionId: Id<"subscriptions"> | null;
      evidenceId: Id<"evidence"> | null;
      isNew: boolean;
      isDuplicate: boolean;
    };

    if (result.isDuplicate) {
      return {
        subscriptionId: null,
        evidenceId: null,
        status: "duplicate",
      };
    }

    if (extracted.isConfirmation) {
      if (result.subscriptionId) {
        return {
          subscriptionId: result.subscriptionId,
          evidenceId: result.evidenceId,
          status: "cancelled",
        };
      }
      return {
        subscriptionId: null,
        evidenceId: null,
        status: "unparsed",
      };
    }

    if (!result.subscriptionId) {
      return { subscriptionId: null, evidenceId: null, status: "unparsed" };
    }

    return {
      subscriptionId: result.subscriptionId,
      evidenceId: result.evidenceId,
      status: result.isNew ? "created" : "merged",
    };
  },
});
