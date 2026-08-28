import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { dedupKey } from "./lib/dedup";
import { getDifficulty } from "./lib/difficulty";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject as string;
    // Use by_user index; cast needed because auth subject is string not Id
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .take(100);
    return subs;
  },
});

export const needsAttention = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject as string;
    const now = Date.now();
    const horizon = now + (args.days ?? 7) * 24 * 60 * 60 * 1000;
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_renewal", (q) =>
        q
          .eq("userId", userId as never)
          .gte("nextRenewalAt", now)
          .lte("nextRenewalAt", horizon),
      )
      .order("asc")
      .take(20);
    return subs;
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
    const userId = identity.subject as string;
    const key = dedupKey(args);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_dedup", (q) =>
        q.eq("userId", userId as never).eq("dedupKey", key),
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
      userId: userId as never,
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
