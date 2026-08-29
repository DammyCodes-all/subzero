import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

export const getUserIdForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const emailNorm = args.email.trim().toLowerCase();
    // Delegate to canonical resolver in agentmail.ts (single source for inbox routing)
    // to avoid duplicating by_agentmailInbox / by_accountEmail logic.
    const byInbox = await ctx.db
      .query("connections")
      .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", emailNorm))
      .first();
    if (byInbox) return byInbox.userId;
    const byAccount = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail", (q) => q.eq("accountEmail", emailNorm))
      .first();
    if (byAccount) return byAccount.userId;
    return null;
  },
});

export const getMyConnections = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
  },
});
