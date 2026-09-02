import { getAuthUserId } from "@convex-dev/auth/server";
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

function extractEmail(raw: string): string | null {
  if (!raw) return null;
  const emailMatch = raw.match(/<([^>]+)>/);
  const extracted = emailMatch ? emailMatch[1] : raw;
  const emailOnly = extracted.split(",")[0].trim().split(" ")[0].trim();
  const atMatch = raw.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  const norm = (emailOnly || atMatch?.[1] || "").toLowerCase();
  return norm.includes("@") ? norm : null;
}

function userIdCandidates(userId: string) {
  const parts = userId.split("|");
  const uid = parts.length >= 2 ? parts[1] : userId;
  return new Set([userId, uid, `user:${uid}`]);
}

async function getSourceConnectionForUser(
  ctx: any,
  userId: string,
  preferredEmail?: string | null,
) {
  const candidates = userIdCandidates(userId);
  if (preferredEmail) {
    const matches = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail_status", (q: any) =>
        q.eq("accountEmail", preferredEmail).eq("status", "connected"),
      )
      .collect();
    const match = matches.find(
      (c: any) => c.provider === "google" && candidates.has(c.userId),
    );
    if (match?.accountEmail) return match;
  }

  for (const uid of candidates) {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user", (q: any) => q.eq("userId", uid))
      .collect();
    const match = rows.find(
      (c: any) =>
        c.provider === "google" && c.status === "connected" && c.accountEmail,
    );
    if (match) return match;
  }
  return null;
}

async function resolveRouting(
  ctx: any,
  args: {
    inboxId: string;
    fallbackFrom?: string;
    fallbackTo?: string;
  },
) {
  const inboxNorm = args.inboxId.trim().toLowerCase();
  const fromEmail = extractEmail(args.fallbackFrom ?? "");
  const toEmail = extractEmail(args.fallbackTo ?? "");

  const byInboxCandidates = await ctx.db
    .query("connections")
    .withIndex("by_agentmailInbox", (q: any) =>
      q.eq("agentmailInbox", inboxNorm),
    )
    .collect();
  const validByInbox: typeof byInboxCandidates = [];
  for (const c of byInboxCandidates) {
    try {
      const u: any = await ctx.db.get(c.userId as any);
      if (u) validByInbox.push(c);
    } catch {}
  }
  const candidates = validByInbox.length ? validByInbox : byInboxCandidates;

  if (candidates.length === 1) {
    const candidate = candidates[0];
    const sourceConn = await getSourceConnectionForUser(
      ctx,
      candidate.userId,
      fromEmail,
    );
    return {
      userId: candidate.userId,
      sourceEmail: sourceConn?.accountEmail ?? candidate.accountEmail,
      sourceConnectionId: sourceConn?._id,
    };
  }

  if (candidates.length > 1) {
    if (fromEmail) {
      const byAccountEmail = await ctx.db
        .query("connections")
        .withIndex("by_accountEmail_status", (q: any) =>
          q.eq("accountEmail", fromEmail).eq("status", "connected"),
        )
        .collect();
      const candidateIds = new Set(candidates.map((c: any) => c.userId));
      const matchByFrom = byAccountEmail.find(
        (c: any) => c.provider === "google" && candidateIds.has(c.userId),
      );
      if (matchByFrom) {
        return {
          userId: matchByFrom.userId,
          sourceEmail: matchByFrom.accountEmail,
          sourceConnectionId: matchByFrom._id,
        };
      }
    }
    console.error(
      `[agentmail] Shared inbox with ${candidates.length} candidate users and ${fromEmail ? `unrecognized from "${fromEmail}"` : "no from-address"}. Refusing to guess.`,
    );
    return null;
  }

  if (toEmail && toEmail !== inboxNorm) {
    const byRecipientEmail = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail_status", (q: any) =>
        q.eq("accountEmail", toEmail).eq("status", "connected"),
      )
      .collect();
    const byRecipientGoogle = byRecipientEmail.find(
      (c: any) => c.provider === "google",
    );
    if (byRecipientGoogle) {
      return {
        userId: byRecipientGoogle.userId,
        sourceEmail: byRecipientGoogle.accountEmail,
        sourceConnectionId: byRecipientGoogle._id,
      };
    }

    const byTo = await ctx.db
      .query("connections")
      .withIndex("by_agentmailInbox", (q: any) =>
        q.eq("agentmailInbox", toEmail),
      )
      .first();
    if (byTo) {
      try {
        const u: any = await ctx.db.get(byTo.userId as any);
        if (u) {
          const sourceConn = await getSourceConnectionForUser(
            ctx,
            byTo.userId,
            fromEmail,
          );
          return {
            userId: byTo.userId,
            sourceEmail: sourceConn?.accountEmail ?? byTo.accountEmail,
            sourceConnectionId: sourceConn?._id,
          };
        }
      } catch {}
    }
  }

  if (fromEmail) {
    const byAccountEmail = await ctx.db
      .query("connections")
      .withIndex("by_accountEmail_status", (q: any) =>
        q.eq("accountEmail", fromEmail).eq("status", "connected"),
      )
      .collect();
    const byGoogle = byAccountEmail.find((c: any) => c.provider === "google");
    if (byGoogle) {
      return {
        userId: byGoogle.userId,
        sourceEmail: byGoogle.accountEmail,
        sourceConnectionId: byGoogle._id,
      };
    }

    const userMatch = await ctx.db
      .query("users")
      .withIndex("email", (q: any) => q.eq("email", fromEmail))
      .first();
    if (userMatch) {
      const sourceConn = await getSourceConnectionForUser(
        ctx,
        userMatch._id,
        fromEmail,
      );
      return {
        userId: userMatch._id,
        sourceEmail: sourceConn?.accountEmail ?? userMatch.email,
        sourceConnectionId: sourceConn?._id,
      };
    }
  }

  return null;
}

export const getInbox = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const all = await ctx.db.query("connections").collect();
    const agentmail = all.find(
      (c) =>
        (c.userId === userId || c.userId.includes(userId)) &&
        c.provider === "agentmail" &&
        c.agentmailInbox,
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
    const rows = all.filter(
      (c) => c.userId === userId || c.userId.includes(userId),
    );
    const existing = rows.find(
      (c) => c.provider === "agentmail" && c.agentmailInbox,
    );
    // Derive accountEmail: identity.email → users table → Google connection → any existing
    const googleConn = rows.find(
      (c) => c.provider === "google" && c.accountEmail,
    );
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
    )
      ?.trim()
      .toLowerCase();

    // Read the inbox address from the deployment env (AGENTMAIL_INBOX).
    const defaultInbox =
      (env as unknown as { AGENTMAIL_INBOX?: string }).AGENTMAIL_INBOX ??
      process.env.AGENTMAIL_INBOX ??
      "subzero-agent@agentmail.to";
    const inboxAddr = defaultInbox.trim().toLowerCase();

    if (existing?.agentmailInbox) {
      console.log(
        `[agentmail] getOrCreateInbox: existing row found, existing.accountEmail="${existing.accountEmail ?? "null"}", identity.email="${identity?.email ?? "null"}", derived accountEmail="${accountEmail ?? "null"}"`,
      );
      const patch: Record<string, unknown> = {};
      if (existing.userId !== userId) {
        patch.userId = userId;
      }
      if (!existing.accountEmail && accountEmail) {
        patch.accountEmail = accountEmail;
      }
      // If the stored inbox differs from the env, update it
      if (existing.agentmailInbox.toLowerCase() !== inboxAddr) {
        console.log(
          `[agentmail] Updating agentmailInbox from "${existing.agentmailInbox}" to "${inboxAddr}"`,
        );
        patch.agentmailInbox = inboxAddr;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return {
        inbox:
          (patch.agentmailInbox as string) ??
          existing.agentmailInbox.toLowerCase(),
      };
    }

    console.log(
      `[agentmail] getOrCreateInbox: using inbox="${inboxAddr}", accountEmail="${accountEmail ?? "null"}"`,
    );

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
    if (existing)
      return { inbox: (existing.agentmailInbox as string).toLowerCase() };

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

export const resolveRoutingByInbox = internalQuery({
  args: {
    inboxId: v.string(),
    fallbackFrom: v.optional(v.string()),
    fallbackTo: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      userId: v.string(),
      sourceEmail: v.optional(v.string()),
      sourceConnectionId: v.optional(v.id("connections")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await resolveRouting(ctx, args);
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
    const routing = await resolveRouting(ctx, args);
    return routing?.userId ?? null;
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

    // Verify researched route allows email — don't invent support@ address
    const sub = await ctx.runQuery(internal.subscriptions.getInternal, {
      id: args.subscriptionId,
    });
    if (!sub) throw new Error("Subscription not found");
    if (sub.cancellationMethod !== "send_email") {
      throw new Error(
        `Cannot send email: researched method is ${sub.cancellationMethod ?? "unknown"} (expected send_email). No verified email route.`,
      );
    }
    // Prefer researched cancellationUrl (mailto: or https with email) — never synthesize support@<merchant>.com
    let recipient: string | null = null;
    if (sub.cancellationUrl) {
      const url = sub.cancellationUrl.trim();
      if (url.startsWith("mailto:")) recipient = url.slice(7).split("?")[0];
      else if (url.includes("@")) {
        const m = url.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        if (m) recipient = m[0];
      }
    }
    if (!recipient) {
      throw new Error(
        "No verified support email found in research (cancellationUrl missing mailto). Check How to cancel for contact details.",
      );
    }

    // Include the source email context (which inbox this subscription was detected from)
    // so the merchant / user has full context in the cancellation thread.
    const sourceHint = sub.sourceEmail
      ? `\n\n(Subscription detected from: ${sub.sourceEmail})`
      : "";

    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (apiKey && recipient) {
      try {
        const inboxId =
          (process.env.AGENTMAIL_INBOX as string | undefined) ??
          "subzero-agent@agentmail.to";
        const res = await fetch(
          `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              to: recipient,
              subject: `Cancellation Request: ${args.merchant} Subscription`,
              text: `${args.body}${sourceHint}`,
            }),
          },
        );
        if (!res.ok) {
          console.error("AgentMail send failed:", await res.text());
          throw new Error("Failed to send via AgentMail");
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === "Failed to send via AgentMail"
        )
          throw err;
        console.error("AgentMail send error:", err);
        throw err;
      }
    } else if (recipient) {
      console.log(
        `[Mock AgentMail] Sent to ${recipient} (${args.merchant}):\n${args.body}${sourceHint}`,
      );
    }

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
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .first();
    if (actionRec) {
      await ctx.db.patch(actionRec._id, { status: "pending" });
    }
  },
});
