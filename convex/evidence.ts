import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const listBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || (sub.userId as unknown as string) !== identity.tokenIdentifier) {
      // Also check plain uid fallback for legacy rows
      const parts = identity.tokenIdentifier.split("|");
      const uid = parts.length >= 2 ? parts[1] : identity.tokenIdentifier;
      if (!sub || !((sub.userId as unknown as string).includes(uid))) return [];
    }
    return await ctx.db
      .query("evidence")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .take(20);
  },
});

export const getBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || (sub.userId as unknown as string) !== identity.tokenIdentifier) {
      const parts = identity.tokenIdentifier.split("|");
      const uid = parts.length >= 2 ? parts[1] : identity.tokenIdentifier;
      if (!sub || !((sub.userId as unknown as string).includes(uid))) return [];
    }
    return await ctx.db
      .query("evidence")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .collect();
  },
});

export const add = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    source: v.string(),
    sourceType: v.union(
      v.literal("email"),
      v.literal("firecrawl"),
      v.literal("manual"),
    ),
    excerpt: v.string(),
    url: v.optional(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) throw new Error("Subscription not found");
    if ((sub.userId as unknown as string) !== identity.tokenIdentifier) {
      const parts = identity.tokenIdentifier.split("|");
      const uid = parts.length >= 2 ? parts[1] : identity.tokenIdentifier;
      if (!((sub.userId as unknown as string).includes(uid))) throw new Error("Not authorized");
    }
    const confidence = Math.max(0, Math.min(1, args.confidence));
    const excerpt = args.excerpt.slice(0, 10000);
    return await ctx.db.insert("evidence", {
      subscriptionId: args.subscriptionId,
      source: args.source,
      sourceType: args.sourceType,
      excerpt,
      url: args.url,
      confidence,
      retrievedAt: Date.now(),
    });
  },
});

export const addInternal = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    source: v.string(),
    sourceType: v.union(
      v.literal("email"),
      v.literal("firecrawl"),
      v.literal("manual"),
    ),
    excerpt: v.string(),
    url: v.optional(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const confidence = Math.max(0, Math.min(1, args.confidence));
    const excerpt = args.excerpt.slice(0, 10000);
    return await ctx.db.insert("evidence", {
      subscriptionId: args.subscriptionId,
      source: args.source,
      sourceType: args.sourceType,
      excerpt,
      url: args.url,
      confidence,
      retrievedAt: Date.now(),
    });
  },
});

