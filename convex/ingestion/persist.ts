import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { dedupKey } from "../lib/dedup";
import { getDifficulty } from "../lib/difficulty";
import { cleanProductName, healDirtyProductNames } from "../lib/product";

export const checkSvixId = internalQuery({
  args: { svixId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!args.svixId) return false;
    const hit = await ctx.db
      .query("evidence")
      .withIndex("by_svixId", (q) => q.eq("svixId", args.svixId))
      .first();
    return !!hit;
  },
});

const extractedValidator = v.object({
  merchant: v.optional(v.string()),
  product: v.optional(v.string()),
  price: v.optional(v.number()),
  currency: v.optional(v.string()),
  billingInterval: v.union(
    v.literal("monthly"),
    v.literal("yearly"),
    v.literal("weekly"),
    v.literal("unknown"),
  ),
  nextRenewalAt: v.optional(v.number()),
  trialEndsAt: v.optional(v.number()),
  billingProvider: v.optional(v.string()),
  isConfirmation: v.boolean(),
  confidence: v.number(),
  quote: v.string(),
});

export const persistExtracted = internalMutation({
  args: {
    userId: v.string(),
    extracted: extractedValidator,
    svixId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    source: v.string(),
    sourceEmail: v.optional(v.string()),
    sourceConnectionId: v.optional(v.id("connections")),
  },
  returns: v.object({
    subscriptionId: v.union(v.id("subscriptions"), v.null()),
    evidenceId: v.union(v.id("evidence"), v.null()),
    isNew: v.boolean(),
    isDuplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Atomic idempotency: check svixId (AgentMail) and messageId (Gmail)
    if (args.svixId) {
      const dup = await ctx.db
        .query("evidence")
        .withIndex("by_svixId", (q) => q.eq("svixId", args.svixId))
        .first();
      if (dup)
        return {
          subscriptionId: null,
          evidenceId: null,
          isNew: false,
          isDuplicate: true,
        };
    }
    if (args.messageId) {
      const dup2 = await ctx.db
        .query("evidence")
        .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
        .first();
      if (dup2)
        return {
          subscriptionId: null,
          evidenceId: null,
          isNew: false,
          isDuplicate: true,
        };
    }

    const ex = args.extracted;
    const confidence = Math.max(0, Math.min(1, ex.confidence));
    const excerpt = ex.quote.slice(0, 10000) || args.source.slice(0, 500);
    const now = Date.now();
    // Source-level cleaning: never store raw store titles in product —
    // every key, insert, and patch below uses the cleaned value.
    const product = cleanProductName(ex.product);

    // Confirmation branch: email says cancellation confirmed
    if (ex.isConfirmation) {
      const merchant = ex.merchant?.trim();
      if (!merchant) {
        return {
          subscriptionId: null,
          evidenceId: null,
          isNew: false,
          isDuplicate: false,
        };
      }
      // Find best matching subscription by merchant (case-insensitive).
      // Use bounded take(100) for now; if user has >100 subs this may miss —
      // will be replaced by an index `by_user_and_merchant` when needed.
      // For current scale (<100 typical) this is safe.
      const all = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .take(100);
      const lower = merchant.toLowerCase();
      const match =
        all.find((s) => s.merchant.toLowerCase() === lower) ??
        all.find(
          (s) =>
            s.merchant.toLowerCase().includes(lower) ||
            lower.includes(s.merchant.toLowerCase()),
        );

      if (match) {
        await ctx.db.patch(match._id, { status: "cancelled" });
        const evidenceId = await ctx.db.insert("evidence", {
          subscriptionId: match._id,
          source: `${merchant} cancellation confirmation`,
          sourceType: "email",
          excerpt,
          confidence,
          retrievedAt: now,
          svixId: args.svixId,
          messageId: args.messageId,
        });
        await healDirtyProductNames(ctx, args.userId);
        return {
          subscriptionId: match._id,
          evidenceId,
          isNew: false,
          isDuplicate: false,
        };
      }

      // No prior subscription — create a cancelled placeholder if we have price, otherwise just log
      if (ex.price && ex.currency) {
        const key = dedupKey({
          merchant,
          product,
          billingProvider: ex.billingProvider,
          price: ex.price,
          currency: ex.currency,
        });
        const id = await ctx.db.insert("subscriptions", {
          userId: args.userId,
          merchant,
          product,
          price: ex.price,
          currency: ex.currency,
          billingInterval: ex.billingInterval,
          status: "cancelled",
          nextRenewalAt: ex.nextRenewalAt,
          trialEndsAt: ex.trialEndsAt,
          billingProvider: ex.billingProvider,
          sourceEmail: args.sourceEmail,
          sourceConnectionId: args.sourceConnectionId,
          cancellationMethod: "unknown",
          cancellationDifficulty: getDifficulty(
            "unknown",
            0,
            !!ex.billingProvider,
          ),
          dedupKey: key,
        });
        const evidenceId = await ctx.db.insert("evidence", {
          subscriptionId: id,
          source: `${merchant} cancellation confirmation`,
          sourceType: "email",
          excerpt,
          confidence,
          retrievedAt: now,
          svixId: args.svixId,
          messageId: args.messageId,
        });
        return {
          subscriptionId: id,
          evidenceId,
          isNew: true,
          isDuplicate: false,
        };
      }

      return {
        subscriptionId: null,
        evidenceId: null,
        isNew: false,
        isDuplicate: false,
      };
    }

    // Normal receipt / trial branch — require merchant (or product as fallback) + price
    let merchant = ex.merchant?.trim();
    if (!merchant && product) merchant = product;
    if (!merchant || ex.price === undefined || ex.price === null) {
      return {
        subscriptionId: null,
        evidenceId: null,
        isNew: false,
        isDuplicate: false,
      };
    }
    const price = ex.price;
    const currency = (ex.currency ?? "USD").toUpperCase().slice(0, 3);
    if (Number.isNaN(price) || price <= 0 || price > 100000) {
      return {
        subscriptionId: null,
        evidenceId: null,
        isNew: false,
        isDuplicate: false,
      };
    }
    // Guard: one-time payments (exam fees, purchases) look like merchant+price but have no renewal/trial.
    // Only create subscription if it has a billing interval or a future date.
    if (
      ex.billingInterval === "unknown" &&
      !ex.nextRenewalAt &&
      !ex.trialEndsAt &&
      !ex.isConfirmation
    ) {
      return {
        subscriptionId: null,
        evidenceId: null,
        isNew: false,
        isDuplicate: false,
      };
    }

    const key = dedupKey({
      merchant,
      product,
      billingProvider: ex.billingProvider,
      price,
      currency,
    });

    let existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_dedup", (q) =>
        q.eq("userId", args.userId).eq("dedupKey", key),
      )
      .unique();

    // Fallback: if not found and we now have a billingProvider, try matching the same
    // merchant/product/price/currency without provider to avoid duplicate rows on enrichment.
    // e.g., first receipt had no provider -> key "...||price|cur", second adds "google play".
    if (!existing && ex.billingProvider) {
      const fallbackKey = dedupKey({
        merchant,
        product,
        billingProvider: undefined,
        price,
        currency,
      });
      existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_and_dedup", (q) =>
          q.eq("userId", args.userId).eq("dedupKey", fallbackKey),
        )
        .unique();
    }

    const difficulty = getDifficulty("unknown", 0, !!ex.billingProvider);

    let subscriptionId: string;
    let isNew = true;
    if (existing) {
      isNew = false;
      // Patch renewal/trial if newer, keep other fields
      const patch: Record<string, unknown> = {};
      if (
        ex.nextRenewalAt &&
        (!existing.nextRenewalAt || ex.nextRenewalAt > existing.nextRenewalAt)
      ) {
        patch.nextRenewalAt = ex.nextRenewalAt;
      }
      if (
        ex.trialEndsAt &&
        (!existing.trialEndsAt || ex.trialEndsAt > existing.trialEndsAt)
      ) {
        patch.trialEndsAt = ex.trialEndsAt;
      }
      if (product && !existing.product) patch.product = product;
      // Preserve the first-known source inbox if we don't have one yet.
      if (args.sourceEmail && !existing.sourceEmail)
        patch.sourceEmail = args.sourceEmail;
      if (args.sourceConnectionId && !existing.sourceConnectionId) {
        patch.sourceConnectionId = args.sourceConnectionId;
      }
      const addedProvider = !!(ex.billingProvider && !existing.billingProvider);
      if (addedProvider) {
        patch.billingProvider = ex.billingProvider;
        patch.dedupKey = key;
        // Re-trigger research with new provider context (generic site hint)
        patch.researchStatus = "pending";
      }
      // Always ensure difficulty is set if missing
      if (!existing.cancellationDifficulty)
        patch.cancellationDifficulty = difficulty;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch as never);
      }
      if (addedProvider && existing.researchStatus !== "pending") {
        await ctx.scheduler.runAfter(
          0,
          internal.research.researchCancellationRoute,
          {
            subscriptionId: existing._id,
          },
        );
      }
      subscriptionId = existing._id;
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        userId: args.userId,
        merchant,
        product,
        price,
        currency,
        billingInterval: ex.billingInterval,
        status: "active",
        nextRenewalAt: ex.nextRenewalAt,
        trialEndsAt: ex.trialEndsAt,
        billingProvider: ex.billingProvider,
        sourceEmail: args.sourceEmail,
        sourceConnectionId: args.sourceConnectionId,
        cancellationDifficulty: difficulty,
        cancellationMethod: "unknown",
        dedupKey: key,
        researchStatus: "pending",
      });
    }

    const evidenceId = await ctx.db.insert("evidence", {
      subscriptionId: subscriptionId as never,
      source: `${merchant} via forward`,
      sourceType: "email",
      excerpt,
      confidence,
      retrievedAt: now,
      svixId: args.svixId,
      messageId: args.messageId,
    });

    // Self-heal rows stored before write-path cleaning (bounded, indexed).
    await healDirtyProductNames(ctx, args.userId);

    return {
      subscriptionId: subscriptionId as never,
      evidenceId,
      isNew,
      isDuplicate: false,
    };
  },
});

export const persistUnparsed = internalMutation({
  args: {
    userId: v.string(),
    source: v.string(),
    excerpt: v.string(),
    svixId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    confidence: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // For unparsed forwards we do not create a subscription — but we log
    // the attempt by inserting evidence against a throwaway? Instead we just
    // return null. The caller can log. We keep this mutation for future
    // "unparsed" table if needed. For now no DB write without subscriptionId.
    // To satisfy "evidence for every important field", we could create a
    // placeholder evidence against the most recent subscription, but spec says
    // don't show it if we can't back it — so we do nothing.
    return null;
  },
});
