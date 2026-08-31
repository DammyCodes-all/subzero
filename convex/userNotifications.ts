import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyNotifications = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      type: v.string(),
      status: v.string(),
      scheduledAt: v.number(),
      attemptedAt: v.optional(v.number()),
      subscriptionId: v.id("subscriptions"),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows.map((n) => ({
      _id: n._id,
      type: n.type,
      status: n.status,
      scheduledAt: n.scheduledAt,
      attemptedAt: n.attemptedAt,
      subscriptionId: n.subscriptionId,
    }));
  },
});
