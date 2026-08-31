import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || (sub.userId !== userId && !String(sub.userId).includes(String(userId)))) return null;
    const action = await ctx.db
      .query("cancellationActions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
      .first();
    return action ?? null;
  },
});

export const getBySubscriptionInternal = internalQuery({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cancellationActions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
      .first();
  },
});
