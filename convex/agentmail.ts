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

    // Synthesize a per-user inbox alias that routes to the real shared inbox
    // via plus-addressing: subzero-agent+<hash>@agentmail.to. This ensures
    // AgentMail actually delivers it (shared inbox exists) while `to` stays
    // unique per user for routing.
    const baseShort =
      userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase() || "user";
    let inbox = `subzero-agent+${baseShort}@agentmail.to`.toLowerCase();
    let attempt = 0;
    let collision = null;
    while (attempt < 5) {
      collision = await ctx.db
        .query("connections")
        .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", inbox))
        .first();
      if (!collision) break;
      if (collision.userId === userId) {
        return { inbox: collision.agentmailInbox!.toLowerCase() };
      }
      const suffix = Math.random().toString(36).slice(2, 6).toLowerCase();
      inbox = `subzero-agent+${baseShort}-${suffix}@agentmail.to`.toLowerCase();
      attempt++;
    }
    if (collision) {
      const finalCheck = await ctx.db
        .query("connections")
        .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", inbox))
        .first();
      if (finalCheck) throw new Error("Inbox collision: retry getOrCreateInbox");
    }

    await ctx.db.insert("connections", {
      userId,
      provider: "agentmail",
      status: "connected",
      agentmailInbox: inbox,
      accountEmail: identity.email?.toLowerCase(),
    });

    return { inbox };
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
    const inboxNorm = args.inboxId.trim().toLowerCase();
    const byInbox = await ctx.db
      .query("connections")
      .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", inboxNorm))
      .first();
    if (byInbox) return byInbox.userId;

    // Try fallback `to` address (personal alias) before `from`.
    // In shared-inbox mode, inboxId is the shared inbox (same for all users)
    // while `to` carries the personal alias — that's the routing identity.
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

    // Last resort: match `from` (sender) to user's accountEmail via index.
    if (args.fallbackFrom) {
      const fromNorm = args.fallbackFrom.trim().toLowerCase();
      if (!fromNorm) return null;
      const byEmail = await ctx.db
        .query("connections")
        .withIndex("by_accountEmail", (q) => q.eq("accountEmail", fromNorm))
        .first();
      if (byEmail && byEmail.provider === "agentmail") return byEmail.userId;
      // Fallback bounded scan for legacy rows where accountEmail may be mixed case
      const all = await ctx.db.query("connections").take(100);
      const hit = all.find(
        (c) =>
          c.accountEmail?.toLowerCase() === fromNorm &&
          c.provider === "agentmail",
      );
      if (hit) return hit.userId;
    }

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
