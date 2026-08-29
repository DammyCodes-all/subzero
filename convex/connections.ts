import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

export const getUserIdForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // 1. Try by agentmail inbox
    const connByInbox = await ctx.db
      .query("connections")
      .withIndex("by_agentmail_inbox", (q) => q.eq("agentmailInbox", args.email))
      .first();

    if (connByInbox) return connByInbox.userId;

    // 2. Try by account email
    const connByAccount = await ctx.db
      .query("connections")
      .withIndex("by_account_email", (q) => q.eq("accountEmail", args.email))
      .first();

    if (connByAccount) return connByAccount.userId;

    // 3. Fallback: Return the first active user in connections or users table
    const firstConn = await ctx.db.query("connections").first();
    if (firstConn) return firstConn.userId;

    const firstUser = await ctx.db.query("users").first();
    if (firstUser) return firstUser._id;

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
