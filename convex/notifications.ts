import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const DAY = 24 * 60 * 60 * 1000;

export const scheduleNudgesForSubscription = internalMutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || !sub.nextRenewalAt || sub.status === "cancelled") return;

    const now = Date.now();
    const renewalAt = sub.nextRenewalAt;

    // Define milestones: 7d, 3d, 24h
    const milestones: Array<{ type: "7d" | "3d" | "24h"; time: number }> = [
      { type: "7d", time: renewalAt - 7 * DAY },
      { type: "3d", time: renewalAt - 3 * DAY },
      { type: "24h", time: renewalAt - 1 * DAY },
    ];

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
          await ctx.scheduler.runAfter(delay, internal.notifications.deliverNudge, {
            notificationId,
          });
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

    // Prefer the subscription's source email for delivery — matches the inbox
    // the subscription was detected from (multi-email aware).
    let recipientEmail: string | null = sub.sourceEmail ?? null;
    if (!recipientEmail) {
      // Fallback: find the connection matching this subscription's source email, else first connection
      const conns = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", notif.userId))
        .collect();
      const sourceMatch = conns.find(
        (c) => c.accountEmail?.toLowerCase() === sub.sourceEmail?.toLowerCase(),
      );
      const conn = sourceMatch ?? conns[0];
      recipientEmail = conn?.accountEmail ?? null;
    }

    return {
      notif,
      sub,
      userEmail: recipientEmail,
    };
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
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const details = await ctx.runQuery(internal.notifications.getNotificationDetails, {
      notificationId: args.notificationId,
    });

    if (!details || !details.notif || !details.sub) return;

    const { notif, sub, userEmail } = details;

    // Skip nudge if subscription was cancelled in the meantime
    if (sub.status === "cancelled" || notif.status !== "pending") return;

    const apiKey = process.env.AGENTMAIL_API_KEY;
    const recipient = userEmail || "user@example.com";

    const label =
      notif.type === "7d"
        ? "renews in 7 days"
        : notif.type === "3d"
          ? "renews in 3 days"
          : "renews tomorrow!";

    const subject = `⚡ Renewal Alert: ${sub.merchant} ${label}`;
    const body = `Hi there,

Your ${sub.merchant} subscription (${sub.currency} ${sub.price}/${sub.billingInterval}) is scheduled to renew soon.

Merchant: ${sub.merchant}
Price: $${sub.price}
Status: ${label}

${sub.cancellationUrl ? `Direct cancellation link: ${sub.cancellationUrl}` : "Open SubZero to view cancellation steps."}

Don't want to keep this? Open SubZero to cancel before you are charged:
http://localhost:3000/subscriptions/${sub._id}

Thanks,
SubZero Protection Engine`;

    if (apiKey) {
      try {
        const res = await fetch("https://api.agentmail.to/v1/messages/send", {
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
        });

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
      console.log(`[Mock AgentMail Outbound Nudge] Sent to ${recipient}:\nSubject: ${subject}\n\n${body}`);
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
    const upcomingSubs = await ctx.runQuery(internal.subscriptions.getUpcomingForSweep);
    for (const sub of upcomingSubs) {
      await ctx.runMutation(internal.notifications.scheduleNudgesForSubscription, {
        subscriptionId: sub._id,
      });
    }
  },
});
