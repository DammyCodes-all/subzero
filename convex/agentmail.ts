import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

export const getInbox = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.tokenIdentifier;
    const row = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const agentmail = row.find(
      (c) => c.provider === "agentmail" && c.agentmailInbox,
    );
    return agentmail?.agentmailInbox ?? null;
  },
});

export const getOrCreateInbox = mutation({
  args: {},
  returns: v.object({ inbox: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;

    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existing = rows.find(
      (c) => c.provider === "agentmail" && c.agentmailInbox,
    );
    if (existing?.agentmailInbox)
      return { inbox: existing.agentmailInbox.toLowerCase() };

    // Single shared inbox strategy (3-inbox free limit).
    // All users forward to subzero-agent@agentmail.to; routing is via
    // envelope `from` → accountEmail (see resolveUserByInbox fallback).
    // We store the shared address per user so the card is consistent.
    const sharedInbox = "subzero-agent@agentmail.to".toLowerCase();

    await ctx.db.insert("connections", {
      userId,
      provider: "agentmail",
      status: "connected",
      agentmailInbox: sharedInbox,
      accountEmail: identity.email?.toLowerCase(),
    });

    return { inbox: sharedInbox };
  },
});

export const provisionInbox = internalMutation({
  args: {
    userId: v.string(),
    inbox: v.string(),
    accountEmail: v.optional(v.string()),
  },
  returns: v.object({ inbox: v.string() }),
  handler: async (ctx, args) => {
    const inboxNorm = args.inbox.trim().toLowerCase();
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", inboxNorm))
      .unique();
    if (existing) return { inbox: (existing.agentmailInbox as string).toLowerCase() };

    await ctx.db.insert("connections", {
      userId: args.userId,
      provider: "agentmail",
      status: "connected",
      agentmailInbox: inboxNorm,
      accountEmail: args.accountEmail?.toLowerCase(),
    });
    return { inbox: inboxNorm };
  },
});

export const resolveUserByInbox = internalQuery({
  args: {
    inboxId: v.string(),
    fallbackFrom: v.optional(v.string()),
    fallbackTo: v.optional(v.string()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    // Shared inbox mode: `subzero-agent@agentmail.to` is same for all users,
    // so `by_agentmailInbox` would return an arbitrary first user. Prefer
    // routing via `from` (forwarder's Gmail) → accountEmail.
    const sharedInbox = "subzero-agent@agentmail.to";
    const inboxNorm = args.inboxId.trim().toLowerCase();
    const isShared = inboxNorm === sharedInbox;

    if (!isShared) {
      const byInbox = await ctx.db
        .query("connections")
        .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", inboxNorm))
        .first();
      if (byInbox) return byInbox.userId;
      if (args.fallbackTo) {
        const toNorm = args.fallbackTo.trim().toLowerCase();
        if (toNorm && toNorm !== inboxNorm) {
          const byTo = await ctx.db
            .query("connections")
            .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", toNorm))
            .first();
          if (byTo) return byTo.userId;
        }
      }
    }

    // Primary for shared inbox: match envelope `from` to accountEmail.
    // `from` often is "Display Name <email@...>" — extract email address.
    if (args.fallbackFrom) {
      const raw = args.fallbackFrom.trim();
      if (!raw) return null;
      const emailMatch = raw.match(/<([^>]+)>/);
      const extracted = emailMatch ? emailMatch[1] : raw;
      // Also handle "email (Name)" or bare email with commas
      const emailOnly = extracted.split(",")[0].trim().split(" ")[0].trim();
      const fromNorm = emailOnly.toLowerCase();
      // Also try to find @ in raw if above failed (e.g. "Name <a@b> (via gmail)")
      const atMatch = raw.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
      const fallbackNorm = atMatch ? atMatch[1].toLowerCase() : fromNorm;
      if (!fromNorm && !fallbackNorm) return null;
      for (const norm of [fromNorm, fallbackNorm]) {
        if (!norm || !norm.includes("@")) continue;
        const byEmail = await ctx.db
          .query("connections")
          .withIndex("by_accountEmail", (q) => q.eq("accountEmail", norm))
          .first();
        if (byEmail && byEmail.provider === "agentmail") return byEmail.userId;
        const all = await ctx.db.query("connections").take(100);
        const hit = all.find(
          (c) =>
            c.accountEmail?.toLowerCase() === norm &&
            c.provider === "agentmail",
        );
        if (hit) return hit.userId;
      }
    }

    // Last fallback: if we are on shared inbox and no `from` match, return null
    // (don't return arbitrary first user — would route to wrong person).
    return null;
  },
});

export const checkSvixId = internalQuery({
  args: { svixId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!args.svixId) return false;
    const hit = await ctx.db
      .query("evidence")
      .withIndex("by_svixId", (q) => q.eq("svixId", args.svixId))
      .first();
    return !!hit;
  },
});
