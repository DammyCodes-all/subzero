import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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
      gmailWatchExpiration: v.optional(v.number()),
      hasHistoryId: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const ident = await ctx.auth.getUserIdentity();
    const tokenId = ident?.tokenIdentifier ?? userId;
    const parts = tokenId.split("|");
    const plain = parts.length >= 2 ? parts[1] : tokenId;
    const candidateIds = [
      ...new Set([userId, tokenId, plain, `user:${plain}`]),
    ];
    const seen = new Set<string>();
    const collected: {
      _id: Id<"connections">;
      provider: string;
      status: string;
      userId: string;
      accountEmail?: string;
      agentmailInbox?: string;
      lastGmailScanAt?: number;
      gmailScopeGranted?: boolean;
      gmailHistoryId?: string;
      gmailWatchExpiration?: number;
    }[] = [];
    for (const uid of candidateIds) {
      const batch = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      for (const c of batch) {
        if (seen.has(c._id)) continue;
        seen.add(c._id);
        collected.push(c as never);
      }
    }
    return collected.map((c) => ({
      _id: c._id,
      provider: c.provider,
      status: c.status,
      accountEmail: c.accountEmail,
      agentmailInbox: c.agentmailInbox,
      lastGmailScanAt: c.lastGmailScanAt,
      gmailScopeGranted: c.gmailScopeGranted,
      gmailWatchExpiration: (c as { gmailWatchExpiration?: number })
        .gmailWatchExpiration,
      hasHistoryId: !!(c as { gmailHistoryId?: string }).gmailHistoryId,
    }));
  },
});
