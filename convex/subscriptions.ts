import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { dedupKey } from "./lib/dedup";
import { getDifficulty } from "./lib/difficulty";

import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db.query("subscriptions").collect();
    return all.filter((s) => s.userId === userId || s.userId.includes(userId));
  },
});

export const needsAttention = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const now = Date.now();
    const horizon = now + (args.days ?? 7) * 24 * 60 * 60 * 1000;
    const all = await ctx.db.query("subscriptions").collect();
    return all
      .filter(
        (s) =>
          (s.userId === userId || s.userId.includes(userId)) &&
          s.nextRenewalAt !== undefined &&
          s.nextRenewalAt >= now &&
          s.nextRenewalAt <= horizon,
      )
      .sort((a, b) => (a.nextRenewalAt ?? 0) - (b.nextRenewalAt ?? 0))
      .slice(0, 20);
  },
});

export const get = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sub = await ctx.db.get(args.id);
    if (!sub || (sub.userId !== userId && !sub.userId.includes(userId))) return null;
    return sub;
  },
});

export const upsert = mutation({
  args: {
    merchant: v.string(),
    product: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    billingInterval: v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("unknown"),
    ),
    billingProvider: v.optional(v.string()),
    nextRenewalAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancellationUrl: v.optional(v.string()),
    cancellationMethod: v.optional(
      v.union(
        v.literal("open_web"),
        v.literal("open_provider"),
        v.literal("send_email"),
        v.literal("contact_support"),
        v.literal("manual"),
        v.literal("unknown"),
      ),
    ),
    steps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const key = dedupKey(args);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_dedup", (q) =>
        q.eq("userId", userId).eq("dedupKey", key),
      )
      .unique();

    const hasProvider = !!args.billingProvider;
    const difficulty = getDifficulty(
      args.cancellationMethod ?? "unknown",
      args.steps ?? 0,
      hasProvider,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        product: args.product ?? existing.product,
        price: args.price,
        currency: args.currency,
        billingInterval: args.billingInterval,
        nextRenewalAt: args.nextRenewalAt ?? existing.nextRenewalAt,
        trialEndsAt: args.trialEndsAt ?? existing.trialEndsAt,
        cancellationUrl: args.cancellationUrl ?? existing.cancellationUrl,
        cancellationMethod:
          args.cancellationMethod ?? existing.cancellationMethod,
        cancellationDifficulty: difficulty,
        billingProvider: args.billingProvider ?? existing.billingProvider,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId,
      merchant: args.merchant,
      product: args.product,
      price: args.price,
      currency: args.currency,
      billingInterval: args.billingInterval,
      status: "active",
      nextRenewalAt: args.nextRenewalAt,
      trialEndsAt: args.trialEndsAt,
      cancellationUrl: args.cancellationUrl,
      cancellationMethod: args.cancellationMethod,
      cancellationDifficulty: difficulty,
      billingProvider: args.billingProvider,
      dedupKey: key,
    });
  },
});

export const upsertInternal = internalMutation({
  args: {
    userId: v.string(),
    merchant: v.string(),
    product: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    billingInterval: v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("unknown"),
    ),
    billingProvider: v.optional(v.string()),
    nextRenewalAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancellationUrl: v.optional(v.string()),
    cancellationMethod: v.optional(
      v.union(
        v.literal("open_web"),
        v.literal("open_provider"),
        v.literal("send_email"),
        v.literal("contact_support"),
        v.literal("manual"),
        v.literal("unknown"),
      ),
    ),
    steps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const key = dedupKey(args);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_dedup", (q) =>
        q.eq("userId", userId).eq("dedupKey", key),
      )
      .unique();

    const hasProvider = !!args.billingProvider;
    const difficulty = getDifficulty(
      args.cancellationMethod ?? "unknown",
      args.steps ?? 0,
      hasProvider,
    );

    if (existing) {
      const patch: Record<string, unknown> = {
        product: args.product ?? existing.product,
        price: args.price,
        currency: args.currency,
        billingInterval: args.billingInterval,
        billingProvider: args.billingProvider ?? existing.billingProvider,
      };
      if (args.nextRenewalAt && (!existing.nextRenewalAt || args.nextRenewalAt > existing.nextRenewalAt)) patch.nextRenewalAt = args.nextRenewalAt;
      if (args.trialEndsAt && (!existing.trialEndsAt || args.trialEndsAt > existing.trialEndsAt)) patch.trialEndsAt = args.trialEndsAt;
      if (args.cancellationUrl && !existing.cancellationUrl) patch.cancellationUrl = args.cancellationUrl;
      if (args.cancellationMethod && existing.cancellationMethod === "unknown") patch.cancellationMethod = args.cancellationMethod;
      if (!existing.cancellationDifficulty) patch.cancellationDifficulty = difficulty;
      // Don't clobber researched route
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch as never);
      return existing._id;
    }

    const subId = await ctx.db.insert("subscriptions", {
      userId,
      merchant: args.merchant,
      product: args.product,
      price: args.price,
      currency: args.currency,
      billingInterval: args.billingInterval,
      status: "active",
      nextRenewalAt: args.nextRenewalAt,
      trialEndsAt: args.trialEndsAt,
      cancellationUrl: args.cancellationUrl,
      cancellationMethod: args.cancellationMethod ?? "unknown",
      cancellationDifficulty: difficulty,
      billingProvider: args.billingProvider,
      dedupKey: key,
      researchStatus: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.notifications.scheduleNudgesForSubscription, {
      subscriptionId: subId,
    });
    await ctx.scheduler.runAfter(0, internal.research.researchCancellationRoute, {
      subscriptionId: subId,
    });

    return subId;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUpcomingForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_renewal", (q) =>
        q.gte("nextRenewalAt", now).lte("nextRenewalAt", nextWeek),
      )
      .collect();
  },
});

export const saveResearchResult = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    cancellationMethod: v.string(),
    cancellationUrl: v.optional(v.string()),
    instructions: v.array(v.string()),
    difficulty: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
    evidenceExcerpt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) return;

    const validMethods = new Set(["open_web","open_provider","send_email","contact_support","manual","unknown"]);
    const methodRaw = String(args.cancellationMethod ?? "unknown").toLowerCase().replace("-","_");
    const method = validMethods.has(methodRaw) ? methodRaw : "unknown";
    const instructions = (args.instructions ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
    const hasVerifiedRoute = method !== "unknown" && instructions.length > 0;

    // Provider-aware enforcement: store-billed subs MUST cancel via provider dashboard, not merchant web portal
    let finalMethod = method as any;
    let finalInstructions = [...instructions];
    let finalUrl = args.cancellationUrl ?? undefined;
    if (sub.billingProvider) {
      const p = sub.billingProvider.toLowerCase();
      const isStoreBilled = p.includes("google") || p.includes("apple") || p.includes("amazon");
      if (isStoreBilled) {
        finalMethod = "open_provider";
        // Force canonical provider URL if LLM returned merchant portal (e.g., accounts.snapchat.com)
        const isProviderUrl = finalUrl ? (finalUrl.includes("play.google.com") || finalUrl.includes("apps.apple.com") || finalUrl.includes("amazon.com")) : false;
        if (!isProviderUrl) {
          if (p.includes("google")) finalUrl = "https://play.google.com/store/account/subscriptions";
          else if (p.includes("apple")) finalUrl = "https://apps.apple.com/account/subscriptions";
          else if (p.includes("amazon")) finalUrl = "https://www.amazon.com/gp/help/customer/display.html?nodeId=G57AV2WTEF34REEB";
        }
        // If LLM gave merchant-portal steps (contains snapchat.com / merchant domain) but not Play steps, override
        const hasProviderHint = finalInstructions.some((s) => /play store|google play|app store|payments.*subscriptions/i.test(s));
        const hasMerchantPortalHint = finalInstructions.some((s) => /snapchat\.com|accounts\./i.test(s));
        if (!hasProviderHint || hasMerchantPortalHint) {
          if (p.includes("google")) {
            finalInstructions = [
              "Open Google Play",
              "Tap your profile → Payments & subscriptions → Subscriptions",
              `Find ${sub.merchant}${sub.product ? ` · ${sub.product}` : ""}`,
              "Tap Cancel subscription → Confirm",
              "Save the confirmation — SubZero marks it cancelled",
            ];
          } else if (p.includes("apple")) {
            finalInstructions = [
              "Open Settings on iPhone/iPad → tap your name → Subscriptions",
              `Find ${sub.merchant}`,
              "Tap Cancel Subscription → Confirm",
            ];
          }
        }
      }
    }

    const difficulty = getDifficulty(
      finalMethod,
      finalInstructions.length,
      !!sub.billingProvider,
    );

    const patch: Record<string, unknown> = {
      cancellationMethod: finalMethod,
      cancellationDifficulty: difficulty,
      researchStatus: hasVerifiedRoute || method === "unknown" ? "done" : "done",
      researchedAt: Date.now(),
    };
    if (finalUrl) patch.cancellationUrl = finalUrl;
    // Only promote to action_ready when we have a verified route; unknown stays active
    // finalHasVerified recomputed after provider override — declare here for status
    const _finalHasVerifiedEarly = finalMethod !== "unknown" && finalInstructions.length > 0;
    patch.status = _finalHasVerifiedEarly ? "action_ready" : "active";
    if (!_finalHasVerifiedEarly && finalMethod === "unknown") {
      patch.cancellationUrl = undefined;
    }
    await ctx.db.patch(args.subscriptionId, patch as never);

    // Dedup cancellationActions — patch if exists
    const existingAction = await ctx.db
      .query("cancellationActions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
      .first();
    // hasVerifiedRoute recomputed with final values
    const finalHasVerified = finalMethod !== "unknown" && finalInstructions.length > 0;
    if (existingAction) {
      await ctx.db.patch(existingAction._id, {
        type: finalMethod,
        status: finalHasVerified ? "ready" as const : "failed" as const,
        instructions: finalInstructions.length ? finalInstructions : undefined,
      });
    } else if (finalHasVerified) {
      await ctx.db.insert("cancellationActions", {
        subscriptionId: args.subscriptionId,
        type: finalMethod,
        status: "ready",
        instructions: finalInstructions,
      });
    }
    // If we overrode to provider but original evidence was merchant portal, replace firecrawl evidence excerpt with provider hint
    let finalExcerpt = args.evidenceExcerpt;
    let finalEvidenceUrl = args.evidenceUrl;
    if (sub.billingProvider?.toLowerCase().includes("google") && finalMethod === "open_provider" && finalExcerpt && /snapchat\.com/i.test(finalExcerpt)) {
      finalExcerpt = "Subscriptions on Google Play are managed in Google Play — open Play Store > Payments & subscriptions > Subscriptions to cancel.";
      finalEvidenceUrl = finalUrl;
    }

    // Dedup evidence: reuse if same URL already stored for this sub — use finalExcerpt/finalEvidenceUrl after provider override
    const excerpt = (finalExcerpt ?? "").slice(0, 500).trim();
    const evidenceUrlToUse = finalEvidenceUrl ?? args.evidenceUrl;
    if (excerpt || evidenceUrlToUse) {
      const existingEvidence = await ctx.db
        .query("evidence")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
        .collect();
      const alreadyHas = existingEvidence.some(
        (e) => e.sourceType === "firecrawl" && e.url === evidenceUrlToUse && e.excerpt === excerpt,
      );
      if (!alreadyHas) {
        const firecrawlOld = existingEvidence.filter((e) => e.sourceType === "firecrawl");
        for (const old of firecrawlOld) await ctx.db.delete(old._id);
        await ctx.db.insert("evidence", {
          subscriptionId: args.subscriptionId,
          source: sub.merchant ? `${sub.merchant} Help Center` : "Firecrawl Search",
          sourceType: "firecrawl",
          url: evidenceUrlToUse ?? undefined,
          excerpt: excerpt || `How to cancel ${sub.merchant}`,
          confidence: finalHasVerified ? 0.85 : 0.55,
          retrievedAt: Date.now(),
        });
      }
    }
  },
});
