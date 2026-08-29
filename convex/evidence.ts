import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const listBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
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

