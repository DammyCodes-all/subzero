import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { dedupKey } from "./lib/dedup";
import { getDifficulty } from "./lib/difficulty";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.tokenIdentifier;
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    return subs;
  },
});

export const needsAttention = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.tokenIdentifier;
    const now = Date.now();
    const horizon = now + (args.days ?? 7) * 24 * 60 * 60 * 1000;
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_renewal", (q) =>
        q
          .eq("userId", userId)
          .gte("nextRenewalAt", now)
          .lte("nextRenewalAt", horizon),
      )
      .order("asc")
      .take(20);
    return subs;
  },
});

export const get = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.tokenIdentifier;
    const sub = await ctx.db.get(args.id);
    if (!sub || sub.userId !== userId) return null;
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
      cancellationMethod: args.cancellationMethod,
      cancellationDifficulty: difficulty,
      billingProvider: args.billingProvider,
      dedupKey: key,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.scheduleNudgesForSubscription, {
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
    difficulty: v.string(),
    evidenceUrl: v.optional(v.string()),
    evidenceExcerpt: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) return;

    await ctx.db.patch(args.subscriptionId, {
      cancellationMethod: args.cancellationMethod as any,
      cancellationUrl: args.cancellationUrl ?? undefined,
      cancellationDifficulty: args.difficulty as any,
      status: "action_ready", 
    });

    await ctx.db.insert("cancellationActions", {
      subscriptionId: args.subscriptionId,
      type: args.cancellationMethod as any,
      status: "ready",
      instructions: args.instructions,
    });

    await ctx.db.insert("evidence", {
      subscriptionId: args.subscriptionId,
      source: "Firecrawl Search",
      sourceType: "firecrawl",
      url: args.evidenceUrl ?? undefined,
      excerpt: args.evidenceExcerpt,
      confidence: 0.85,
      retrievedAt: Date.now(),
    });
  },
});
