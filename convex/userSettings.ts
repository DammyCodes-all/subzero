import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Per-user settings. Everything defaults to on when no row exists,
 * so existing users keep current behavior.
 */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return { notifyOnCancel: row?.notifyOnCancel ?? true };
  },
});

export const setNotifyOnCancel = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (row) {
      await ctx.db.patch(row._id, { notifyOnCancel: args.enabled });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        notifyOnCancel: args.enabled,
      });
    }
  },
});
