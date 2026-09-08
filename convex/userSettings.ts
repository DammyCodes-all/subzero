import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
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
    return {
      notifyOnCancel: row?.notifyOnCancel ?? true,
      notify7d: row?.notify7d ?? true,
      notify3d: row?.notify3d ?? true,
      notify24h: row?.notify24h ?? true,
    };
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

export const setLeadTimes = mutation({
  args: {
    notify7d: v.boolean(),
    notify3d: v.boolean(),
    notify24h: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const patch = {
      notify7d: args.notify7d,
      notify3d: args.notify3d,
      notify24h: args.notify24h,
    };
    if (row) {
      await ctx.db.patch(row._id, patch);
    } else {
      await ctx.db.insert("userSettings", { userId, ...patch });
    }

    // Reconcile existing subscriptions so the save takes effect immediately:
    // drop pending rows for warnings that were just turned off, then
    // re-run scheduling (it dedupes and only adds missing future ones).
    const enabled = {
      "7d": args.notify7d,
      "3d": args.notify3d,
      "24h": args.notify24h,
    } as const;
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of subs) {
      for (const t of ["7d", "3d", "24h"] as const) {
        if (enabled[t]) continue;
        const pending = await ctx.db
          .query("notifications")
          .withIndex("by_subscription_and_type", (q) =>
            q.eq("subscriptionId", s._id).eq("type", t),
          )
          .collect();
        for (const n of pending) {
          if (n.status === "pending") await ctx.db.delete(n._id);
        }
      }
      if (s.status === "cancelled" || s.muted || s.hidden) continue;
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.scheduleNudgesForSubscription,
        { subscriptionId: s._id },
      );
    }
  },
});
