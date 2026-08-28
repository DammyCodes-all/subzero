import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    return await ctx.db.insert("evidence", {
      subscriptionId: args.subscriptionId,
      source: args.source,
      sourceType: args.sourceType,
      excerpt: args.excerpt,
      url: args.url,
      confidence: args.confidence,
      retrievedAt: Date.now(),
    });
  },
});
