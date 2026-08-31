import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  env,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

import { getAuthUserId } from "@convex-dev/auth/server";

export const getInbox = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const all = await ctx.db.query("connections").collect();
    const agentmail = all.find(
      (c) => (c.userId === userId || c.userId.includes(userId)) && c.provider === "agentmail" && c.agentmailInbox,
    );
    return agentmail?.agentmailInbox ?? null;
  },
});

export const getOrCreateInbox = mutation({
  args: {},
  returns: v.object({ inbox: v.string() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const identity = await ctx.auth.getUserIdentity();

    const all = await ctx.db.query("connections").collect();
    const rows = all.filter((c) => c.userId === userId || c.userId.includes(userId));
    const existing = rows.find(
      (c) => c.provider === "agentmail" && c.agentmailInbox,
    );
    // Derive accountEmail: identity.email → users table → Google connection → any existing
    const googleConn = rows.find((c) => c.provider === "google" && c.accountEmail);
    let userEmail: string | undefined = identity?.email;
    if (!userEmail) {
      try {
        const userDoc = await ctx.db.get(userId as Id<"users">);
        const email = (userDoc as unknown as { email?: string } | null)?.email;
        if (email) {
          userEmail = email;
        }
      } catch {
        // ignore if userId is not an Id<"users">
      }
    }
    const accountEmail = (
      userEmail ??
      googleConn?.accountEmail ??
      rows.find((c) => c.accountEmail)?.accountEmail
    )?.trim().toLowerCase();

    // Read the inbox address from the deployment env (AGENTMAIL_INBOX).
    const defaultInbox =
      (env as unknown as { AGENTMAIL_INBOX?: string }).AGENTMAIL_INBOX ??
      process.env.AGENTMAIL_INBOX ??
      "subzero-agent@agentmail.to";
    const inboxAddr = defaultInbox.trim().toLowerCase();

    if (existing?.agentmailInbox) {
      console.log(`[agentmail] getOrCreateInbox: existing row found, existing.accountEmail="${existing.accountEmail ?? "null"}", identity.email="${identity?.email ?? "null"}", derived accountEmail="${accountEmail ?? "null"}"`);
      const patch: Record<string, unknown> = {};
      if (existing.userId !== userId) {
        patch.userId = userId;
      }
      if (!existing.accountEmail && accountEmail) {
        patch.accountEmail = accountEmail;
      }
      // If the stored inbox differs from the env, update it
      if (existing.agentmailInbox.toLowerCase() !== inboxAddr) {
        console.log(`[agentmail] Updating agentmailInbox from "${existing.agentmailInbox}" to "${inboxAddr}"`);
        patch.agentmailInbox = inboxAddr;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return { inbox: (patch.agentmailInbox as string) ?? existing.agentmailInbox.toLowerCase() };
    }

    console.log(`[agentmail] getOrCreateInbox: using inbox="${inboxAddr}", accountEmail="${accountEmail ?? "null"}"`);

    await ctx.db.insert("connections", {
      userId,
      provider: "agentmail",
      status: "connected",
      agentmailInbox: inboxAddr,
      accountEmail,
    });

    return { inbox: inboxAddr };
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

    // Helper: extract a normalized email from a from-address string
    const extractEmail = (raw: string): string | null => {
      if (!raw) return null;
      const emailMatch = raw.match(/<([^>]+)>/);
      const extracted = emailMatch ? emailMatch[1] : raw;
      const emailOnly = extracted.split(",")[0].trim().split(" ")[0].trim();
      const atMatch = raw.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
      const norm = (emailOnly || atMatch?.[1] || "").toLowerCase();
      return norm.includes("@") ? norm : null;
    };

    const fromEmail = extractEmail(args.fallbackFrom ?? "");
    const toEmail = extractEmail(args.fallbackTo ?? "");

    // 1. Try matching by agentmailInbox directly in connections table
    const byInbox = await ctx.db
      .query("connections")
      .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", inboxNorm))
      .first();
    if (byInbox) return byInbox.userId;

    if (toEmail && toEmail !== inboxNorm) {
      const byTo = await ctx.db
        .query("connections")
        .withIndex("by_agentmailInbox", (q) => q.eq("agentmailInbox", toEmail))
        .first();
      if (byTo) return byTo.userId;
    }

    // 2. Try matching fromEmail -> accountEmail in connections table
    if (fromEmail) {
      const byAccountEmail = await ctx.db
        .query("connections")
        .withIndex("by_accountEmail", (q) => q.eq("accountEmail", fromEmail))
        .first();
      if (byAccountEmail) return byAccountEmail.userId;

      // Broad scan of connections for case-insensitive match
      const allConns = await ctx.db.query("connections").take(100);
      const hitConn = allConns.find((c) => c.accountEmail?.toLowerCase() === fromEmail);
      if (hitConn) return hitConn.userId;

      // Check users table directly for matching email
      const allUsers = await ctx.db.query("users").take(100);
      const userMatch = allUsers.find((u) => u.email?.toLowerCase() === fromEmail);
      if (userMatch) {
        const userConn = await ctx.db
          .query("connections")
          .withIndex("by_user", (q) => q.eq("userId", userMatch._id))
          .first();
        if (userConn) return userConn.userId;
        return userMatch._id;
      }
    }

    // 3. Fallback for single-user setup / single agentmail connection
    const allConns = await ctx.db.query("connections").take(10);
    const agentmailConns = allConns.filter((c) => c.provider === "agentmail");
    if (agentmailConns.length === 1) {
      console.log(`[agentmail] Fallback: single agentmail connection found, returning userId=${agentmailConns[0].userId}`);
      return agentmailConns[0].userId;
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

export const sendCancellationEmail = action({
  args: {
    subscriptionId: v.id("subscriptions"),
    merchant: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.agentmail.to/v1/messages/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            to: `support@${args.merchant.toLowerCase().replace(/\s/g, "")}.com`,
            subject: `Cancellation Request: ${args.merchant} Subscription`,
            text: args.body,
          }),
        });
        if (!res.ok) {
          console.error("AgentMail send failed:", await res.text());
        }
      } catch (err) {
        console.error("AgentMail send error:", err);
      }
    } else {
      console.log(`[Mock AgentMail] Sent to ${args.merchant}:\n${args.body}`);
    }

    // Update status in the DB using an internal mutation
    await ctx.runMutation(internal.agentmail.markCancellationSent, {
      subscriptionId: args.subscriptionId,
    });
  },
});

export const markCancellationSent = internalMutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      status: "cancellation_pending",
    });
    const actionRec = await ctx.db
      .query("cancellationActions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
      .first();
    if (actionRec) {
      await ctx.db.patch(actionRec._id, { status: "pending" });
    }
  },
});
