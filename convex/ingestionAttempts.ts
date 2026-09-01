import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const createProcessingAttempt = internalMutation({
  args: {
    userId: v.string(),
    svixId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    inboxId: v.string(),
    from: v.optional(v.string()),
    subject: v.optional(v.string()),
    sourceEmail: v.optional(v.string()),
    sourceConnectionId: v.optional(v.id("connections")),
  },
  returns: v.object({
    attemptId: v.id("ingestionAttempts"),
    isNew: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const subject = args.subject?.slice(0, 120);
    const from = args.from?.slice(0, 120);

    if (args.svixId) {
      const dup = await ctx.db
        .query("ingestionAttempts")
        .withIndex("by_svixId", (q) => q.eq("svixId", args.svixId))
        .first();
      if (dup) return { attemptId: dup._id, isNew: false };
    }
    if (args.messageId) {
      const dup2 = await ctx.db
        .query("ingestionAttempts")
        .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
        .first();
      if (dup2) return { attemptId: dup2._id, isNew: false };
    }

    const id = await ctx.db.insert("ingestionAttempts", {
      userId: args.userId,
      svixId: args.svixId,
      messageId: args.messageId,
      inboxId: args.inboxId,
      from,
      subject,
      sourceEmail: args.sourceEmail,
      sourceConnectionId: args.sourceConnectionId,
      status: "processing",
      receivedAt: now,
      updatedAt: now,
    });
    return { attemptId: id, isNew: true };
  },
});

export const updateAttempt = internalMutation({
  args: {
    attemptId: v.id("ingestionAttempts"),
    status: v.union(
      v.literal("processing"),
      v.literal("created"),
      v.literal("merged"),
      v.literal("duplicate"),
      v.literal("skipped"),
      v.literal("unparsed"),
      v.literal("no_user"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    subscriptionId: v.optional(v.id("subscriptions")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.attemptId);
    if (!existing) return;
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.subscriptionId) patch.subscriptionId = args.subscriptionId;
    if (args.reason) patch.reason = args.reason.slice(0, 500);
    await ctx.db.patch(args.attemptId, patch as never);
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = Math.min(args.limit ?? 5, 20);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Use index range so we don't miss a `processing` row beyond take window
    const recent = await ctx.db
      .query("ingestionAttempts")
      .withIndex("by_user_receivedAt", (q) =>
        q.eq("userId", userId).gte("receivedAt", sevenDaysAgo),
      )
      .order("desc")
      .take(limit);
    return recent;
  },
});

export const cleanupOldAttempts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const old = await ctx.db.query("ingestionAttempts").collect();
    let deleted = 0;
    for (const row of old) {
      if (row.receivedAt < cutoff) {
        await ctx.db.delete(row._id);
        deleted += 1;
        if (deleted >= 100) break;
      }
    }
    return { deleted };
  },
});
