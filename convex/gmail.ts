import { v } from "convex/values";
import { mutation, internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error("Not authenticated");
    const emailNorm = args.accountEmail.trim().toLowerCase();
    if (!emailNorm || !emailNorm.includes("@")) throw new Error("Invalid accountEmail");
    // Allow Gmail different from sign-in email — Google OAuth already proves ownership of `emailNorm`.
    // Previously strict check caused "Email mismatch" when user signed in with A but connected Gmail B.
    const refreshToken = args.refreshToken.trim();
    if (!refreshToken) throw new Error("Missing refreshToken");
    const userId = ident.tokenIdentifier;
    // Find existing google connection for this user (check canonical + legacy)
    let existing: any = null;
    const byToken = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    existing = byToken.find((c: any) => c.provider === "google");
    if (!existing) {
      const parts = userId.split("|");
      const uid = parts.length >= 2 ? parts[1] : userId;
      const byPlain = await ctx.db.query("connections").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
      existing = byPlain.find((c: any) => c.provider === "google");
    }
    if (!existing) {
      const byEmail = await ctx.db.query("connections").withIndex("by_accountEmail", (q) => q.eq("accountEmail", emailNorm)).first();
      if (byEmail && byEmail.provider === "google") existing = byEmail;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId, // normalize to canonical tokenIdentifier
        gmailRefreshToken: refreshToken,
        gmailScopeGranted: true,
        accountEmail: emailNorm,
        status: "connected",
      });
    } else {
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
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error("Not authenticated");
    const tokenId = ident.tokenIdentifier;
    const emailLower = ident.email?.toLowerCase();
    // Collect all possible google connections for this user and disconnect them
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
