import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

export const getConnectionsInternal = internalQuery({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("connections"),
      gmailRefreshToken: v.optional(v.string()),
      gmailScopeGranted: v.optional(v.boolean()),
      status: v.string(),
      accountEmail: v.optional(v.string()),
      lastGmailScanAt: v.optional(v.number()),
      gmailHistoryId: v.optional(v.string()),
      gmailWatchExpiration: v.optional(v.number()),
      gmailBackfillSeededAt: v.optional(v.number()),
      gmailBackfillQuery: v.optional(
        v.union(v.literal("narrow"), v.literal("broad")),
      ),
      gmailBackfillPageToken: v.optional(v.string()),
      gmailBackfillProcessed: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    // Collect all candidate userIds for this user (token-ish or plain)
    const userIdCandidates = [args.userId];
    const parts = args.userId.split("|");
    if (parts.length >= 2) {
      userIdCandidates.push(parts[1]);
      userIdCandidates.push(`user:${parts[1]}`);
    }
    const seen = new Set<string>();
    const result: Array<{
      _id: Id<"connections">;
      gmailRefreshToken?: string;
      gmailScopeGranted?: boolean;
      status: string;
      accountEmail?: string;
      lastGmailScanAt?: number;
      gmailHistoryId?: string;
      gmailWatchExpiration?: number;
      gmailBackfillSeededAt?: number;
      gmailBackfillQuery?: "narrow" | "broad";
      gmailBackfillPageToken?: string;
      gmailBackfillProcessed?: number;
    }> = [];
    for (const uid of userIdCandidates) {
      const rows = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      for (const c of rows) {
        if (c.provider !== "google") continue;
        if (seen.has(c._id)) continue;
        seen.add(c._id);
        result.push({
          _id: c._id,
          gmailRefreshToken: c.gmailRefreshToken,
          gmailScopeGranted: c.gmailScopeGranted,
          status: c.status,
          accountEmail: c.accountEmail,
          lastGmailScanAt: c.lastGmailScanAt,
          gmailHistoryId: c.gmailHistoryId,
          gmailWatchExpiration: (c as any).gmailWatchExpiration,
          gmailBackfillSeededAt: (c as any).gmailBackfillSeededAt,
          gmailBackfillQuery: (c as any).gmailBackfillQuery,
          gmailBackfillPageToken: (c as any).gmailBackfillPageToken,
          gmailBackfillProcessed: (c as any).gmailBackfillProcessed,
        });
      }
    }
    // Fallback: user email -> accountEmail lookup
    if (result.length === 0) {
      try {
        const user = await ctx.db.get(
          parts.length >= 2 ? (parts[1] as any) : (args.userId as any),
        );
        const email = (user as any)?.email?.toLowerCase();
        if (email) {
          const byEmail = await ctx.db
            .query("connections")
            .withIndex("by_accountEmail", (q) => q.eq("accountEmail", email))
            .collect();
          for (const c of byEmail) {
            if (c.provider !== "google") continue;
            if (seen.has(c._id)) continue;
            seen.add(c._id);
            result.push({
              _id: c._id,
              gmailRefreshToken: c.gmailRefreshToken,
              gmailScopeGranted: c.gmailScopeGranted,
              status: c.status,
              accountEmail: c.accountEmail,
              lastGmailScanAt: c.lastGmailScanAt,
              gmailHistoryId: c.gmailHistoryId,
              gmailWatchExpiration: (c as any).gmailWatchExpiration,
              gmailBackfillSeededAt: (c as any).gmailBackfillSeededAt,
              gmailBackfillQuery: (c as any).gmailBackfillQuery,
              gmailBackfillPageToken: (c as any).gmailBackfillPageToken,
              gmailBackfillProcessed: (c as any).gmailBackfillProcessed,
            });
          }
        }
      } catch {}
    }
    return result;
  },
});

export const getConnectionInternal = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("connections"),
      gmailRefreshToken: v.optional(v.string()),
      gmailScopeGranted: v.optional(v.boolean()),
      status: v.string(),
      lastGmailScanAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    let g = rows.find((c) => c.provider === "google");
    if (!g) {
      const parts = args.userId.split("|");
      const uid = parts.length >= 2 ? parts[1] : args.userId;
      const byPlain = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      g = byPlain.find((c) => c.provider === "google");
      if (!g) {
        const byPlain2 = await ctx.db
          .query("connections")
          .withIndex("by_user", (q) => q.eq("userId", `user:${uid}`))
          .collect();
        g = byPlain2.find((c) => c.provider === "google");
      }
      if (!g) {
        try {
          const user = await ctx.db.get(uid as any);
          const email = (user as any)?.email?.toLowerCase();
          if (email) {
            const byEmail = await ctx.db
              .query("connections")
              .withIndex("by_accountEmail", (q) => q.eq("accountEmail", email))
              .first();
            if (byEmail && byEmail.provider === "google") g = byEmail as any;
          }
        } catch {}
      }
    }
    if (!g) return null;
    return {
      _id: g._id,
      gmailRefreshToken: g.gmailRefreshToken,
      gmailScopeGranted: g.gmailScopeGranted,
      status: g.status,
      lastGmailScanAt: g.lastGmailScanAt,
    };
  },
});

export const touchScan = internalMutation({
  args: { connId: v.id("connections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, { lastGmailScanAt: Date.now() });
    return null;
  },
});

export const getConnectionByIdInternal = internalQuery({
  args: { connId: v.id("connections") },
  returns: v.union(
    v.object({
      _id: v.id("connections"),
      userId: v.string(),
      gmailRefreshToken: v.optional(v.string()),
      gmailScopeGranted: v.optional(v.boolean()),
      status: v.string(),
      accountEmail: v.optional(v.string()),
      lastGmailScanAt: v.optional(v.number()),
      gmailHistoryId: v.optional(v.string()),
      gmailWatchExpiration: v.optional(v.number()),
      gmailWatchTopic: v.optional(v.string()),
      gmailBackfillSeededAt: v.optional(v.number()),
      gmailBackfillQuery: v.optional(
        v.union(v.literal("narrow"), v.literal("broad")),
      ),
      gmailBackfillPageToken: v.optional(v.string()),
      gmailBackfillProcessed: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.connId);
    if (!c || c.provider !== "google") return null;
    return {
      _id: c._id,
      userId: c.userId,
      gmailRefreshToken: c.gmailRefreshToken,
      gmailScopeGranted: c.gmailScopeGranted,
      status: c.status,
      accountEmail: c.accountEmail,
      lastGmailScanAt: c.lastGmailScanAt,
      gmailHistoryId: c.gmailHistoryId,
      gmailWatchExpiration: (c as any).gmailWatchExpiration,
      gmailWatchTopic: (c as any).gmailWatchTopic,
      gmailBackfillSeededAt: c.gmailBackfillSeededAt,
      gmailBackfillQuery: c.gmailBackfillQuery,
      gmailBackfillPageToken: c.gmailBackfillPageToken,
      gmailBackfillProcessed: c.gmailBackfillProcessed,
    };
  },
});

export const listAllGmailConnectionsInternal = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("connections"),
      userId: v.string(),
      gmailRefreshToken: v.optional(v.string()),
      gmailScopeGranted: v.optional(v.boolean()),
      status: v.string(),
      accountEmail: v.optional(v.string()),
      lastGmailScanAt: v.optional(v.number()),
      gmailHistoryId: v.optional(v.string()),
      gmailWatchExpiration: v.optional(v.number()),
      gmailWatchTopic: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_provider", (q) => q.eq("provider", "google"))
      .collect();
    return rows.map((c) => ({
      _id: c._id,
      userId: c.userId,
      gmailRefreshToken: c.gmailRefreshToken,
      gmailScopeGranted: c.gmailScopeGranted,
      status: c.status,
      accountEmail: c.accountEmail,
      lastGmailScanAt: c.lastGmailScanAt,
      gmailHistoryId: c.gmailHistoryId,
      gmailWatchExpiration: (c as any).gmailWatchExpiration,
      gmailWatchTopic: (c as any).gmailWatchTopic,
    }));
  },
});

export const getConnectionsByEmailInternal = internalQuery({
  args: { email: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("connections"),
      userId: v.string(),
      gmailRefreshToken: v.optional(v.string()),
      gmailScopeGranted: v.optional(v.boolean()),
      status: v.string(),
      accountEmail: v.optional(v.string()),
      gmailHistoryId: v.optional(v.string()),
      lastGmailScanAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail", (q) =>
        q.eq("accountEmail", args.email.toLowerCase()),
      )
      .collect();
    return rows
      .filter((c) => c.provider === "google")
      .map((c) => ({
        _id: c._id,
        userId: c.userId,
        gmailRefreshToken: c.gmailRefreshToken,
        gmailScopeGranted: c.gmailScopeGranted,
        status: c.status,
        accountEmail: c.accountEmail,
        gmailHistoryId: c.gmailHistoryId,
        lastGmailScanAt: c.lastGmailScanAt,
      }));
  },
});

export const storeWatchState = internalMutation({
  args: {
    connId: v.id("connections"),
    historyId: v.string(),
    expiration: v.number(),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, {
      gmailHistoryId: args.historyId,
      gmailWatchExpiration: args.expiration,
      gmailWatchTopic: args.topic,
      gmailWatchLastRenewedAt: Date.now(),
      gmailWatchHistoryIdAtWatch: args.historyId,
    } as any);
  },
});

export const clearWatchState = internalMutation({
  args: { connId: v.id("connections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, {
      gmailWatchExpiration: undefined,
      gmailWatchTopic: undefined,
      gmailWatchLastRenewedAt: undefined,
      gmailWatchHistoryIdAtWatch: undefined,
    } as any);
  },
});

export const updateHistoryId = internalMutation({
  args: { connId: v.id("connections"), historyId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, {
      gmailHistoryId: args.historyId,
      lastGmailScanAt: Date.now(),
    });
  },
});

export const touchHistoryAndScan = internalMutation({
  args: { connId: v.id("connections"), historyId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, {
      gmailHistoryId: args.historyId,
      lastGmailScanAt: Date.now(),
    });
  },
});

// Resumable deep-backfill cursor. Seeded on connect, on dead history, and
// when a manual scan hits its per-run cap; cleared when exhausted.
