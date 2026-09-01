import { v } from "convex/values";
import { mutation, internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const getGmailStatus = query({
  args: {},
  returns: v.object({
    connected: v.boolean(),
    gmailScopeGranted: v.optional(v.boolean()),
    accountEmail: v.optional(v.string()),
    lastGmailScanAt: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { connected: false };
    const ident = await ctx.auth.getUserIdentity();
    const tokenId = ident?.tokenIdentifier ?? userId;
    let rows = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    if (rows.length === 0 && tokenId !== userId) {
      rows = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", tokenId)).collect();
    }
    let g = rows.find((c) => c.provider === "google");
    if (!g) {
      const email = ident?.email?.toLowerCase();
      if (email) {
        const byEmail = await ctx.db.query("connections").withIndex("by_accountEmail", (q) => q.eq("accountEmail", email)).first();
        if (byEmail && byEmail.provider === "google") g = byEmail as any;
      }
    }
    if (!g) return { connected: false };
    return {
      connected: g.status === "connected" && !!g.gmailScopeGranted,
      gmailScopeGranted: g.gmailScopeGranted,
      accountEmail: g.accountEmail,
      lastGmailScanAt: g.lastGmailScanAt,
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
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
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
        });
      }
    }
    // Fallback: user email -> accountEmail lookup
    if (result.length === 0) {
      try {
        const user = await ctx.db.get(parts.length >= 2 ? (parts[1] as any) : (args.userId as any));
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
    let rows = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    let g = rows.find((c) => c.provider === "google");
    if (!g) {
      const parts = args.userId.split("|");
      const uid = parts.length >= 2 ? parts[1] : args.userId;
      const byPlain = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
      g = byPlain.find((c) => c.provider === "google");
      if (!g) {
        const byPlain2 = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", `user:${uid}`)).collect();
        g = byPlain2.find((c) => c.provider === "google");
      }
      if (!g) {
        try {
          const user = await ctx.db.get(uid as any);
          const email = (user as any)?.email?.toLowerCase();
          if (email) {
            const byEmail = await ctx.db.query("connections").withIndex("by_accountEmail", (q) => q.eq("accountEmail", email)).first();
            if (byEmail && byEmail.provider === "google") g = byEmail as any;
          }
        } catch {}
      }
    }
    if (!g) return null;
    return { _id: g._id, gmailRefreshToken: g.gmailRefreshToken, gmailScopeGranted: g.gmailScopeGranted, status: g.status, lastGmailScanAt: g.lastGmailScanAt };
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
    const existingOwner = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail", (q) => q.eq("accountEmail", emailNorm))
      .first();
    if (existingOwner && existingOwner.provider === "google" && existingOwner.status === "connected") {
      const ownerRows = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", existingOwner.userId))
        .collect();
      const isSelf = ownerRows.some((r) => r._id === existingOwner._id && r.userId === args.userId);
      if (!isSelf) {
        throw new Error(
          "This email is already connected to another account. Each email can only be linked to one SubZero account.",
        );
      }
    }
    const rows = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    const existing = rows.find((c) => c.provider === "google");
    if (existing) {
      await ctx.db.patch(existing._id, {
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm || existing.accountEmail,
        status: "connected",
      });
    } else {
      await ctx.db.insert("connections", {
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
          await ctx.db.patch(rawUserId as any, { image: args.pictureUrl } as any);
        } else {
          if (emailNorm) {
            const byEmail = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", emailNorm)).first();
            if (byEmail) await ctx.db.patch(byEmail._id, { image: args.pictureUrl } as any);
          }
        }
      } catch {}
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
    if (!emailNorm || !emailNorm.includes("@")) throw new Error("Invalid accountEmail");
    // Allow Gmail different from sign-in email — Google OAuth already proves ownership of `emailNorm`.
    const refreshToken = args.refreshToken.trim();
    if (!refreshToken) throw new Error("Missing refreshToken");
    // Guard: block connecting an email already owned by a DIFFERENT user.
    // Prevents User B from hijacking/overwriting User A's connected Gmail.
    const existingOwner = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail", (q) => q.eq("accountEmail", emailNorm))
      .first();
    if (existingOwner && existingOwner.provider === "google" && existingOwner.status === "connected") {
      const ownerRows = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", existingOwner.userId))
        .collect();
      const isSelf = ownerRows.some((r) => r._id === existingOwner._id && r.userId === userId);
      if (!isSelf) {
        throw new Error(
          "This email is already connected to another account. Each email can only be linked to one SubZero account.",
        );
      }
    }
    // Find existing google connection for this user
    const rows = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const existing = rows.find((c: any) => c.provider === "google" && c.accountEmail === emailNorm);
    if (existing) {
      // Same email reconnecting — update tokens in place
      await ctx.db.patch(existing._id, {
        userId,
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm,
        status: "connected",
      });
    } else {
      // New email or no existing connection — insert a separate row
      await ctx.db.insert("connections", {
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
        if (user) await ctx.db.patch(rawUserId as any, { image: args.pictureUrl } as any);
      } catch {}
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
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error("Not authenticated");
    const tokenId = ident.tokenIdentifier;
    const emailLower = ident.email?.toLowerCase();

    // If a specific connection is requested, only disconnect that one (if it belongs to the caller).
    if (args.connectionId) {
      const target = await ctx.db.get(args.connectionId);
      // Verify ownership — must match this user's identity and be a google connection
      const owned =
        target &&
        target.provider === "google" &&
        (target.userId === tokenId ||
          target.userId === (tokenId.split("|").length >= 2 ? tokenId.split("|")[1] : tokenId) ||
          target.userId === `user:${tokenId.split("|").length >= 2 ? tokenId.split("|")[1] : tokenId}`) &&
        target.accountEmail?.toLowerCase() === emailLower;
      if (target && !owned) {
        throw new Error("You can only disconnect your own Gmail connections.");
      }
      if (target) {
        await ctx.db.patch(target._id, {
          status: "disconnected",
          gmailScopeGranted: false,
          gmailRefreshToken: undefined,
        });
        return { ok: true };
      }
      return { ok: false };
    }

    // No connectionId provided — backward-compatible: disconnect all of this user's google connections.
    const seen = new Set<string>();
    const toPatch: any[] = [];
    const add = (rows: any[]) => {
      for (const r of rows) {
        if (r.provider !== "google") continue;
        if (!seen.has(r._id)) {
          seen.add(r._id);
          toPatch.push(r);
        }
      }
    };
    const byToken = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", tokenId)).collect();
    add(byToken);
    const parts = tokenId.split("|");
    const uid = parts.length >= 2 ? parts[1] : tokenId;
    const byPlain = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
    add(byPlain);
    if (emailLower) {
      const byEmail = await ctx.db.query("connections").withIndex("by_accountEmail", (q) => q.eq("accountEmail", emailLower)).first();
      if (byEmail) add([byEmail]);
    }
    for (const g of toPatch) {
      await ctx.db.patch(g._id, { status: "disconnected", gmailScopeGranted: false, gmailRefreshToken: undefined });
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
