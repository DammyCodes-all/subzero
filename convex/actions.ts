import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

/** All subscriptions that are in an actionable state for the current user */
export const listActionable = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("subscriptions"),
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
      status: v.union(
        v.literal("active"),
        v.literal("action_ready"),
        v.literal("user_started"),
        v.literal("cancellation_pending"),
        v.literal("cancelled"),
        v.literal("failed"),
      ),
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
      cancellationUrl: v.optional(v.string()),
      cancellationDifficulty: v.optional(
        v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("very_high"),
        ),
      ),
      nextRenewalAt: v.optional(v.number()),
      trialEndsAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db.query("subscriptions").collect();
    return all
      .filter(
        (s) =>
          (s.userId === userId || s.userId.includes(userId)) &&
          (s.status === "action_ready" ||
            s.status === "user_started" ||
            s.status === "cancellation_pending"),
      )
      .map((s) => ({
        _id: s._id,
        merchant: s.merchant,
        product: s.product,
        price: s.price,
        currency: s.currency,
        billingInterval: s.billingInterval,
        status: s.status,
        cancellationMethod: s.cancellationMethod,
        cancellationUrl: s.cancellationUrl,
        cancellationDifficulty: s.cancellationDifficulty,
        nextRenewalAt: s.nextRenewalAt,
        trialEndsAt: s.trialEndsAt,
      }));
  },
});

/** Load a subscription owned by the caller, or throw. */
async function ownedSub(ctx: MutationCtx, id: Id<"subscriptions">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const sub = await ctx.db.get(id);
  if (!sub || (sub.userId !== userId && !sub.userId.includes(userId)))
    throw new Error("Not found");
  return sub;
}

const NUDGE_TYPES = ["7d", "3d", "24h", "confirmed"] as const;

/** Drop pending (unsent) notifications so silenced subs leave no stale rows. */
async function clearPendingNudges(
  ctx: MutationCtx,
  subscriptionId: Id<"subscriptions">,
) {
  for (const type of NUDGE_TYPES) {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_subscription_and_type", (q) =>
        q.eq("subscriptionId", subscriptionId).eq("type", type),
      )
      .collect();
    for (const n of rows) {
      if (n.status === "pending") await ctx.db.delete(n._id);
    }
  }
}

/** Re-arm future nudges after a sub becomes audible again. */
async function rescheduleNudges(
  ctx: MutationCtx,
  subscriptionId: Id<"subscriptions">,
) {
  await ctx.scheduler.runAfter(
    0,
    internal.notifications.scheduleNudgesForSubscription,
    { subscriptionId },
  );
}

/** Mark a subscription's cancellation as confirmed (user self-reports) */
export const markCancelled = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSub(ctx, args.id);
    await ctx.db.patch(args.id, { status: "cancelled" });
    await clearPendingNudges(ctx, args.id);
    await ctx.scheduler.runAfter(0, internal.notifications.notifyCancelled, {
      subscriptionId: args.id,
      origin: "manual",
    });
    return null;
  },
});

/** Restore a cancelled subscription to active (undo). */
export const markActive = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSub(ctx, args.id);
    await ctx.db.patch(args.id, { status: "active" });
    await rescheduleNudges(ctx, args.id);
    return null;
  },
});

/** Mute or unmute renewal alerts for one subscription. */
export const setMuted = mutation({
  args: { id: v.id("subscriptions"), muted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSub(ctx, args.id);
    await ctx.db.patch(args.id, { muted: args.muted });
    if (args.muted) {
      await clearPendingNudges(ctx, args.id);
    } else {
      await rescheduleNudges(ctx, args.id);
    }
    return null;
  },
});

/** Soft-hide a subscription so it stays out of lists and scans. */
export const hideSubscription = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSub(ctx, args.id);
    await ctx.db.patch(args.id, { hidden: true });
    await clearPendingNudges(ctx, args.id);
    return null;
  },
});

/** Restore a hidden subscription. */
export const unhideSubscription = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSub(ctx, args.id);
    await ctx.db.patch(args.id, { hidden: false });
    await rescheduleNudges(ctx, args.id);
    return null;
  },
});

/** Mark a subscription as "user started" — cancellation in progress */
export const markStarted = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sub = await ctx.db.get(args.id);
    if (!sub || (sub.userId !== userId && !sub.userId.includes(userId)))
      throw new Error("Not found");
    await ctx.db.patch(args.id, { status: "user_started" });
    return null;
  },
});
