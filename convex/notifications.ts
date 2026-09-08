import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { cancelledTemplate } from "./lib/emailTemplates";

const DAY = 24 * 60 * 60 * 1000;

function userIdCandidates(userId: string) {
  const parts = userId.split("|");
  const uid = parts.length >= 2 ? parts[1] : userId;
  return new Set([userId, uid, `user:${uid}`]);
}

/**
 * Lead-time prefs for a user, defaulting to on. Checks every id shape
 * so rows created under any variant are honored.
 */
export const leadTimePrefs = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const prefs = { notify7d: true, notify3d: true, notify24h: true };
    for (const uid of userIdCandidates(args.userId)) {
      const row = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .first();
      if (!row) continue;
      if (row.notify7d === false) prefs.notify7d = false;
      if (row.notify3d === false) prefs.notify3d = false;
      if (row.notify24h === false) prefs.notify24h = false;
    }
    return prefs;
  },
});

export const scheduleNudgesForSubscription = internalMutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || !sub.nextRenewalAt || sub.status === "cancelled") return;
    if (sub.muted || sub.hidden) return;

    const now = Date.now();
    const renewalAt = sub.nextRenewalAt;

    const prefs = await ctx.runQuery(internal.notifications.leadTimePrefs, {
      userId: sub.userId,
    });

    // Define milestones: 7d, 3d, 24h (skipping any the user turned off)
    const allMilestones: Array<{ type: "7d" | "3d" | "24h"; time: number }> = [
      { type: "7d", time: renewalAt - 7 * DAY },
      { type: "3d", time: renewalAt - 3 * DAY },
      { type: "24h", time: renewalAt - 1 * DAY },
    ];
    const milestones = allMilestones.filter((m) =>
      m.type === "7d"
        ? prefs.notify7d
        : m.type === "3d"
          ? prefs.notify3d
          : prefs.notify24h,
    );

    for (const m of milestones) {
      // Only schedule if the milestone is in the future
      if (m.time > now) {
        // Check if already scheduled
        const existing = await ctx.db
          .query("notifications")
          .withIndex("by_subscription_and_type", (q) =>
            q.eq("subscriptionId", args.subscriptionId).eq("type", m.type),
          )
          .first();

        if (!existing) {
          const notificationId = await ctx.db.insert("notifications", {
            userId: sub.userId,
            subscriptionId: args.subscriptionId,
            scheduledAt: m.time,
            type: m.type,
            status: "pending",
          });

          // Schedule delivery at the milestone timestamp
          const delay = Math.max(0, m.time - now);
          await ctx.scheduler.runAfter(
            delay,
            internal.notifications.deliverNudge,
            {
              notificationId,
            },
          );
        }
      }
    }
  },
});

export const getNotificationDetails = internalQuery({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) return null;
    const sub = await ctx.db.get(notif.subscriptionId);
    if (!sub) return null;

    let recipientEmail: string | null = null;
    const ownerIds = userIdCandidates(notif.userId);

    if (sub.sourceConnectionId) {
      const sourceConn = await ctx.db.get(sub.sourceConnectionId);
      if (
        sourceConn?.provider === "google" &&
        sourceConn.status === "connected" &&
        ownerIds.has(sourceConn.userId)
      ) {
        recipientEmail = sourceConn.accountEmail ?? null;
      }
    }

    if (!recipientEmail && sub.sourceEmail) {
      const sourceMatches = await ctx.db
        .query("connections")
        .withIndex("by_accountEmail_status", (q) =>
          q.eq("accountEmail", sub.sourceEmail).eq("status", "connected"),
        )
        .collect();
      const sourceConn = sourceMatches.find(
        (c) => c.provider === "google" && ownerIds.has(c.userId),
      );
      recipientEmail = sourceConn?.accountEmail ?? sub.sourceEmail;
    }

    if (!recipientEmail) {
      const conns = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", notif.userId))
        .collect();
      for (const ownerId of ownerIds) {
        if (ownerId === notif.userId) continue;
        const aliasConns = await ctx.db
          .query("connections")
          .withIndex("by_user", (q) => q.eq("userId", ownerId))
          .collect();
        conns.push(...aliasConns);
      }
      const conn = conns.find(
        (c) =>
          c.provider === "google" && c.status === "connected" && c.accountEmail,
      );
      recipientEmail = conn?.accountEmail ?? null;
    }

    return {
      notif,
      sub,
      userEmail: recipientEmail,
    };
  },
});

/**
 * Tell the user a subscription was marked cancelled (auto-detected or manual).
 * Inserts a "confirmed" notification and delivers it immediately. Skips hidden
 * subs and skips re-notifying within 30 days so duplicate confirmation emails
 * or repeated taps stay quiet.
 */
export const notifyCancelled = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    origin: v.union(v.literal("auto"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.hidden) return;
    // Honor the user's cancellation-email preference (defaults to on).
    // User ids take several shapes across tables, so check every candidate.
    for (const uid of userIdCandidates(sub.userId)) {
      const setting = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .first();
      if (setting && setting.notifyOnCancel === false) return;
    }
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_subscription_and_type", (q) =>
        q.eq("subscriptionId", args.subscriptionId).eq("type", "confirmed"),
      )
      .collect();
    if (recent.some((n) => n.scheduledAt > Date.now() - 30 * DAY)) return;
    const notificationId = await ctx.db.insert("notifications", {
      userId: sub.userId,
      subscriptionId: args.subscriptionId,
      scheduledAt: Date.now(),
      type: "confirmed",
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.notifications.deliverNudge, {
      notificationId,
      origin: args.origin,
    });
  },
});

export const markNotificationSent = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      attemptedAt: Date.now(),
      error: args.error,
    });
  },
});

export const deliverNudge = internalAction({
  args: {
    notificationId: v.id("notifications"),
    origin: v.optional(v.union(v.literal("auto"), v.literal("manual"))),
  },
  handler: async (ctx, args) => {
    const details = await ctx.runQuery(
      internal.notifications.getNotificationDetails,
      {
        notificationId: args.notificationId,
      },
    );

    if (!details || !details.notif || !details.sub) return;

    const { notif, sub, userEmail } = details;
    const isConfirmation = notif.type === "confirmed";

    if (notif.status !== "pending" || sub.hidden) return;
    // Cancellation confirmations go out even for cancelled or muted subs.
    // That is the point: the user must hear when tracking stops.
    // Renewal nudges still stop at cancelled or muted.
    if (!isConfirmation && (sub.status === "cancelled" || sub.muted)) return;

    // Honor lead-time prefs at delivery too: the user may have turned
    // a warning off after it was scheduled. Record it plainly so the
    // history shows what happened instead of a stuck Pending row.
    if (!isConfirmation) {
      const prefs = await ctx.runQuery(internal.notifications.leadTimePrefs, {
        userId: sub.userId,
      });
      const allowed =
        notif.type === "7d"
          ? prefs.notify7d
          : notif.type === "3d"
            ? prefs.notify3d
            : prefs.notify24h;
      if (!allowed) {
        await ctx.runMutation(internal.notifications.markNotificationSent, {
          notificationId: args.notificationId,
          status: "failed",
          error: "Turned off in notification settings",
        });
        return;
      }
    }

    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!userEmail) {
      await ctx.runMutation(internal.notifications.markNotificationSent, {
        notificationId: args.notificationId,
        status: "failed",
        error: "No notification email available",
      });
      return;
    }
    const recipient = userEmail;

    const { subject, text } = isConfirmation
      ? cancelledTemplate(
          {
            merchant: sub.merchant,
            product: sub.product,
            price: sub.price,
            currency: sub.currency,
            billingInterval: sub.billingInterval,
            subscriptionId: sub._id,
          },
          args.origin ?? "auto",
        )
      : (() => {
          const label =
            notif.type === "7d"
              ? "renews in 7 days"
              : notif.type === "3d"
                ? "renews in 3 days"
                : "renews tomorrow!";
          return {
            subject: `⚡ Renewal Alert: ${sub.merchant} ${label}`,
            text: `Hi there,

Your ${sub.merchant} subscription (${sub.currency} ${sub.price}/${sub.billingInterval}) is scheduled to renew soon.

Merchant: ${sub.merchant}
Price: $${sub.price}
Status: ${label}

${sub.cancellationUrl ? `Direct cancellation link: ${sub.cancellationUrl}` : "Open SubZero to view cancellation steps."}

Don't want to keep this? Open SubZero to cancel before you are charged:
http://localhost:3000/subscriptions/${sub._id}

Thanks,
SubZero Protection Engine`,
          };
        })();
    const body = text;

    if (apiKey) {
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
              subject,
              text: body,
            }),
          },
        );

        if (res.ok) {
          await ctx.runMutation(internal.notifications.markNotificationSent, {
            notificationId: args.notificationId,
            status: "sent",
          });
        } else {
          const errText = await res.text();
          await ctx.runMutation(internal.notifications.markNotificationSent, {
            notificationId: args.notificationId,
            status: "failed",
            error: errText,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.runMutation(internal.notifications.markNotificationSent, {
          notificationId: args.notificationId,
          status: "failed",
          error: msg,
        });
      }
    } else {
      console.log(
        `[Mock AgentMail Outbound Nudge] Sent to ${recipient}:\nSubject: ${subject}\n\n${body}`,
      );
      await ctx.runMutation(internal.notifications.markNotificationSent, {
        notificationId: args.notificationId,
        status: "sent",
      });
    }
  },
});

export const sweepUpcomingNudges = internalAction({
  args: {},
  handler: async (ctx) => {
    const upcomingSubs = await ctx.runQuery(
      internal.subscriptions.getUpcomingForSweep,
    );
    for (const sub of upcomingSubs) {
      await ctx.runMutation(
        internal.notifications.scheduleNudgesForSubscription,
        {
          subscriptionId: sub._id,
        },
      );
    }
  },
});
