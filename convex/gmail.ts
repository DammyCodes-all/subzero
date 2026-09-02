import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

function userIdCandidates(userId: string) {
  const parts = userId.split("|");
  const uid = parts.length >= 2 ? parts[1] : userId;
  return new Set([userId, uid, `user:${uid}`]);
}

export const getGmailStatus = query({
  args: {},
  returns: v.object({
    connected: v.boolean(),
    gmailScopeGranted: v.optional(v.boolean()),
    accountEmail: v.optional(v.string()),
    lastGmailScanAt: v.optional(v.number()),
    gmailWatchExpiration: v.optional(v.number()),
    hasHistoryId: v.optional(v.boolean()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { connected: false };
    const ident = await ctx.auth.getUserIdentity();
    const tokenId = ident?.tokenIdentifier ?? userId;
    let rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (rows.length === 0 && tokenId !== userId) {
      rows = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", tokenId))
        .collect();
    }
    let googleRows = rows.filter((c) => c.provider === "google");
    if (googleRows.length === 0) {
      const email = ident?.email?.toLowerCase();
      if (email) {
        const byEmail = await ctx.db
          .query("connections")
          .withIndex("by_accountEmail_status", (q) =>
            q.eq("accountEmail", email).eq("status", "connected"),
          )
          .collect();
        googleRows = byEmail.filter((c) => c.provider === "google");
      }
    }
    const connectedRows = googleRows.filter(
      (c) => c.status === "connected" && !!c.gmailScopeGranted,
    );
    const first = connectedRows[0] ?? googleRows[0];
    if (!first) return { connected: false };
    const oldestScan = connectedRows.some((c) => !c.lastGmailScanAt)
      ? undefined
      : connectedRows.reduce<number | undefined>((oldest, c) => {
          return oldest === undefined
            ? c.lastGmailScanAt
            : Math.min(oldest, c.lastGmailScanAt ?? oldest);
        }, undefined);
    const watchExp = (first as any)?.gmailWatchExpiration as number | undefined;
    const hasHist = !!(first as any)?.gmailHistoryId;
    return {
      connected: connectedRows.length > 0,
      gmailScopeGranted: first.gmailScopeGranted,
      accountEmail:
        connectedRows.length > 1
          ? `${connectedRows.length} Gmail accounts`
          : first.accountEmail,
      lastGmailScanAt: oldestScan,
      gmailWatchExpiration: watchExp,
      hasHistoryId: hasHist,
    };
  },
});

export const listConnections = query({
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

export const storeGmailToken = internalMutation({
  args: {
    userId: v.string(),
    refreshToken: v.string(),
    accountEmail: v.string(),
    pictureUrl: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const refreshToken = args.refreshToken.trim();
    if (!refreshToken) throw new Error("Missing refreshToken");
    const emailNorm = args.accountEmail.trim().toLowerCase();
    // Guard: block connecting an email already owned by a DIFFERENT user.
    const existingOwners = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail_status", (q) =>
        q.eq("accountEmail", emailNorm).eq("status", "connected"),
      )
      .collect();
    const ownerIds = userIdCandidates(args.userId);
    const ownedByOtherUser = existingOwners.some(
      (owner) => owner.provider === "google" && !ownerIds.has(owner.userId),
    );
    if (ownedByOtherUser) {
      throw new Error(
        "This email is already connected to another account. Each email can only be linked to one SubZero account.",
      );
    }
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existing = rows.find(
      (c) => c.provider === "google" && c.accountEmail === emailNorm,
    );
    let connId: Id<"connections"> | null = null;
    if (existing) {
      await ctx.db.patch(existing._id, {
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm || existing.accountEmail,
        status: "connected",
      });
      connId = existing._id;
    } else {
      connId = await ctx.db.insert("connections", {
        userId: args.userId,
        provider: "google",
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm,
        status: "connected",
      });
    }
    if (args.pictureUrl) {
      try {
        const parts = args.userId.split("|");
        const rawUserId = parts.length >= 2 ? parts[1] : args.userId;
        const user = await ctx.db.get(rawUserId as any);
        if (user) {
          await ctx.db.patch(
            rawUserId as any,
            { image: args.pictureUrl } as any,
          );
        } else {
          if (emailNorm) {
            const byEmail = await ctx.db
              .query("users")
              .withIndex("email", (q) => q.eq("email", emailNorm))
              .first();
            if (byEmail)
              await ctx.db.patch(byEmail._id, {
                image: args.pictureUrl,
              } as any);
          }
        }
      } catch {}
    }
    if (connId) {
      // Proactive: schedule immediate history-skip-aware poll and watch setup if topic configured
      await ctx.scheduler.runAfter(0, internal.gmailWatch.pollIncrementalForUser, { userId: args.userId });
      // Watch setup is best-effort — only if GMAIL_PUBSUB_TOPIC is set
      await ctx.scheduler.runAfter(0, internal.gmailWatch.ensureWatchForConn, { connId });
    }
    return { ok: true };
  },
});

export const storeByEmail = mutation({
  args: {
    accountEmail: v.string(),
    refreshToken: v.string(),
    pictureUrl: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const emailNorm = args.accountEmail.trim().toLowerCase();
    if (!emailNorm || !emailNorm.includes("@"))
      throw new Error("Invalid accountEmail");
    // Allow Gmail different from sign-in email — Google OAuth already proves ownership of `emailNorm`.
    const refreshToken = args.refreshToken.trim();
    if (!refreshToken) throw new Error("Missing refreshToken");
    // Guard: block connecting an email already owned by a DIFFERENT user.
    // Prevents User B from hijacking/overwriting User A's connected Gmail.
    const existingOwners = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail_status", (q) =>
        q.eq("accountEmail", emailNorm).eq("status", "connected"),
      )
      .collect();
    const ownerIds = userIdCandidates(userId);
    const ownedByOtherUser = existingOwners.some(
      (owner) => owner.provider === "google" && !ownerIds.has(owner.userId),
    );
    if (ownedByOtherUser) {
      throw new Error(
        "This email is already connected to another account. Each email can only be linked to one SubZero account.",
      );
    }
    // Find existing google connection for this user
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existing = rows.find(
      (c: any) => c.provider === "google" && c.accountEmail === emailNorm,
    );
    let connId2: Id<"connections"> | null = null;
    if (existing) {
      // Same email reconnecting — update tokens in place
      await ctx.db.patch(existing._id, {
        userId,
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm,
        status: "connected",
      });
      connId2 = existing._id;
    } else {
      // New email or no existing connection — insert a separate row
      connId2 = await ctx.db.insert("connections", {
        userId,
        provider: "google",
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm,
        status: "connected",
      } as any);
    }
    if (args.pictureUrl) {
      try {
        const parts = userId.split("|");
        const rawUserId = parts.length >= 2 ? parts[1] : userId;
        const user = await ctx.db.get(rawUserId as any);
        if (user)
          await ctx.db.patch(
            rawUserId as any,
            { image: args.pictureUrl } as any,
          );
      } catch {}
    }
    if (connId2) {
      await ctx.scheduler.runAfter(0, internal.gmailWatch.pollIncrementalForUser, { userId });
      await ctx.scheduler.runAfter(0, internal.gmailWatch.ensureWatchForConn, { connId: connId2 });
    }
    return { ok: true };
  },
});

export const disconnectGmail = mutation({
  args: {
    connectionId: v.optional(v.id("connections")),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ident = await ctx.auth.getUserIdentity();
    const tokenId = ident?.tokenIdentifier ?? userId;
    const emailLower = ident?.email?.toLowerCase();
    const tokenParts = tokenId.split("|");
    const plainId = tokenParts.length >= 2 ? tokenParts[1] : tokenId;
    const ownedUserIds = new Set([
      ...userIdCandidates(userId),
      tokenId,
      plainId,
      `user:${plainId}`,
    ]);

    // If a specific connection is requested, only disconnect that one (if it belongs to the caller).
    if (args.connectionId) {
      const target = await ctx.db.get(args.connectionId);
      // Verify ownership — must match this user's identity and be a google connection
      const owned =
        target &&
        target.provider === "google" &&
        ownedUserIds.has(target.userId);
      if (target && !owned) {
        throw new Error("You can only disconnect your own Gmail connections.");
      }
      if (target) {
        const tok = target.gmailRefreshToken;
        await ctx.db.patch(target._id, {
          status: "disconnected",
          gmailScopeGranted: false,
          gmailRefreshToken: undefined,
          gmailWatchExpiration: undefined,
          gmailWatchTopic: undefined,
          gmailWatchLastRenewedAt: undefined,
          gmailWatchHistoryIdAtWatch: undefined,
        } as any);
        if (tok) {
          try {
            await ctx.scheduler.runAfter(0, internal.gmailWatch.stopWatchForConn, { connId: target._id, refreshToken: tok });
          } catch {}
        }
        return { ok: true };
      }
      return { ok: false };
    }

    // No connectionId provided — backward-compatible: disconnect all of this user's google connections.
    const seen = new Set<string>();
    const toPatch: any[] = [];
    const add = (rows: any[]) => {
      for (const r of rows) {
        if (r.provider !== "google" || !ownedUserIds.has(r.userId)) continue;
        if (!seen.has(r._id)) {
          seen.add(r._id);
          toPatch.push(r);
        }
      }
    };
    const byToken = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", tokenId))
      .collect();
    add(byToken);
    const uid = plainId;
    const byPlain = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    add(byPlain);
    if (emailLower) {
      const byEmail = await ctx.db
        .query("connections")
        .withIndex("by_accountEmail", (q) => q.eq("accountEmail", emailLower))
        .collect();
      add(byEmail);
    }
    for (const g of toPatch) {
      const tok = g.gmailRefreshToken as string | undefined;
      await ctx.db.patch(g._id, {
        status: "disconnected",
        gmailScopeGranted: false,
        gmailRefreshToken: undefined,
        gmailWatchExpiration: undefined,
        gmailWatchTopic: undefined,
        gmailWatchLastRenewedAt: undefined,
        gmailWatchHistoryIdAtWatch: undefined,
      } as any);
      if (tok) {
        try {
          await ctx.scheduler.runAfter(0, internal.gmailWatch.stopWatchForConn, { connId: g._id, refreshToken: tok });
        } catch {}
      }
    }
    return { ok: true };
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
    const rows = await ctx.db.query("connections").collect();
    return rows
      .filter((c) => c.provider === "google")
      .map((c) => ({
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
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail", (q) => q.eq("accountEmail", args.email.toLowerCase()))
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
