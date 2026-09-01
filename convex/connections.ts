import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";

export const getUserIdForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const emailNorm = args.email.trim().toLowerCase();
    const byInbox = await ctx.db
      .query("connections")
      .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", emailNorm))
      .first();
    if (byInbox) return byInbox.userId;
    const byAccount = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail_status", (q) =>
        q.eq("accountEmail", emailNorm).eq("status", "connected"),
      )
      .collect();
    const googleAccount = byAccount.find((c) => c.provider === "google");
    if (googleAccount) return googleAccount.userId;
    if (byAccount[0]) return byAccount[0].userId;
    return null;
  },
});

export const getMyConnections = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("connections"),
      provider: v.string(),
      status: v.string(),
      accountEmail: v.optional(v.string()),
      agentmailInbox: v.optional(v.string()),
      lastGmailScanAt: v.optional(v.number()),
      gmailScopeGranted: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((c) => ({
      _id: c._id,
      provider: c.provider,
      status: c.status,
      accountEmail: c.accountEmail,
      agentmailInbox: c.agentmailInbox,
      lastGmailScanAt: c.lastGmailScanAt,
      gmailScopeGranted: c.gmailScopeGranted,
    }));
  },
});
