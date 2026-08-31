import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    })
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

/** Mark a subscription's cancellation as confirmed (user self-reports) */
export const markCancelled = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sub = await ctx.db.get(args.id);
    if (!sub || (sub.userId !== userId && !sub.userId.includes(userId)))
      throw new Error("Not found");
    await ctx.db.patch(args.id, { status: "cancelled" });
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
