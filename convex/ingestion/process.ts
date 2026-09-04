"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { isSelfEmail } from "../lib/selfMail";
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
    attemptId: v.optional(v.id("ingestionAttempts")),
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

    const markAttempt = async (
      status:
        | "processing"
        | "created"
        | "merged"
        | "duplicate"
        | "skipped"
        | "unparsed"
        | "no_user"
        | "cancelled"
        | "failed",
      extra?: { subscriptionId?: Id<"subscriptions"> | null; reason?: string },
    ) => {
      if (!args.attemptId) return;
      try {
        await ctx.runMutation(internal.ingestionAttempts.updateAttempt, {
          attemptId: args.attemptId,
          status,
          subscriptionId: extra?.subscriptionId ?? undefined,
          reason: extra?.reason,
        });
      } catch (e) {
        console.error("[ingestion] updateAttempt failed", String(e));
      }
    };

    try {
      // 1. Resolve user (prefer inboxId, then to, then from as last resort)
      console.log(
        `[ingestion] Resolving user: inboxId=${inboxId}, from=${from.slice(0, 50)}, to=${to.slice(0, 50)}`,
      );
      const routing: {
        userId: string;
        sourceEmail?: string;
        sourceConnectionId?: Id<"connections">;
      } | null = await ctx.runQuery(internal.agentmail.resolveRoutingByInbox, {
        inboxId,
        fallbackTo: to || undefined,
        fallbackFrom: from || undefined,
      });
      console.log(`[ingestion] Resolved userId: ${routing?.userId ?? "NULL"}`);
      if (!routing) {
        console.log("[ingestion] No user found — returning no_user");
        await markAttempt("no_user", { reason: "no_user" });
        return { subscriptionId: null, evidenceId: null, status: "no_user" };
      }
      const userId = routing.userId;

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
      // Never ingest our own outbound mail (nudges / test mails forwarded
      // back would otherwise become dummy subscriptions).
      if (isSelfEmail({ from, subject: args.subject, text: normalized.text })) {
        console.log("[ingestion] Self mail — returning skipped");
        await markAttempt("skipped", { reason: "skipped: self mail" });
        return { subscriptionId: null, evidenceId: null, status: "skipped" };
      }
      const bodyForKeyword = `${normalized.text} ${normalized.subject}`.trim();
      console.log(
        `[ingestion] Keyword check: textLen=${normalized.text.length}, subject="${normalized.subject.slice(0, 60)}", hasKeyword=${KEYWORDS.test(bodyForKeyword)}`,
      );
      if (!KEYWORDS.test(bodyForKeyword)) {
        console.log("[ingestion] No keyword match — returning skipped");
        await markAttempt("skipped", {
          reason: `skipped: no keyword in "${args.subject.slice(0, 60)}"`,
        });
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
      console.log(
        `[ingestion] Extraction result: merchant="${extracted.merchant ?? "null"}", price=${extracted.price ?? "null"}, currency="${extracted.currency}", isConfirmation=${extracted.isConfirmation}, confidence=${extracted.confidence}, quote="${extracted.quote.slice(0, 80)}"`,
      );

      console.log(
        `[ingestion] Persisting: merchant="${extracted.merchant}", price=${extracted.price}, interval="${extracted.billingInterval}"`,
      );
      const source = `${extracted.merchant ?? args.subject.slice(0, 40) ?? "Forwarded email"} via forward`;
      const excerpt =
        extracted.quote || normalized.text.slice(0, 500) || args.subject;

      // 6. Handle missing merchant/price for normal receipts
      if (
        !extracted.isConfirmation &&
        (!extracted.merchant || extracted.price === undefined)
      ) {
        console.log(
          `[ingestion] Missing merchant or price — merchant="${extracted.merchant ?? "null"}", price=${extracted.price ?? "null"} — returning unparsed`,
        );
        await markAttempt("unparsed", {
          reason: `unparsed: missing merchant/price`,
        });
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
          sourceEmail: routing.sourceEmail,
          sourceConnectionId: routing.sourceConnectionId,
        },
      )) as {
        subscriptionId: Id<"subscriptions"> | null;
        evidenceId: Id<"evidence"> | null;
        isNew: boolean;
        isDuplicate: boolean;
      };

      if (result.isDuplicate) {
        await markAttempt("duplicate", {
          reason: extracted.merchant ?? args.subject.slice(0, 32) ?? "receipt",
        });
        return {
          subscriptionId: null,
          evidenceId: null,
          status: "duplicate",
        };
      }

      if (extracted.isConfirmation) {
        if (result.subscriptionId) {
          await markAttempt("cancelled", {
            subscriptionId: result.subscriptionId,
            reason: extracted.merchant ?? "subscription",
          });
          return {
            subscriptionId: result.subscriptionId,
            evidenceId: result.evidenceId,
            status: "cancelled",
          };
        }
        await markAttempt("unparsed", { reason: "confirmation without match" });
        return {
          subscriptionId: null,
          evidenceId: null,
          status: "unparsed",
        };
      }

      if (!result.subscriptionId) {
        await markAttempt("unparsed", { reason: "persist returned no id" });
        return { subscriptionId: null, evidenceId: null, status: "unparsed" };
      }

      if (result.isNew) {
        await ctx.scheduler.runAfter(
          0,
          internal.research.researchCancellationRoute,
          {
            subscriptionId: result.subscriptionId,
          },
        );
      }

      const finalStatus = result.isNew
        ? ("created" as const)
        : ("merged" as const);
      await markAttempt(finalStatus, {
        subscriptionId: result.subscriptionId,
        reason: extracted.merchant,
      });
      return {
        subscriptionId: result.subscriptionId,
        evidenceId: result.evidenceId,
        status: finalStatus,
      };
    } catch (e) {
      console.error("[ingestion] processForwardedEmail failed", String(e));
      await markAttempt("failed", { reason: String(e).slice(0, 200) });
      throw e;
    }
  },
});
