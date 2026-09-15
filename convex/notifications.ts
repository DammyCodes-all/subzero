import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  actionReminderTemplate,
  cancelledTemplate,
  renewalNudgeTemplate,
  trialEndingTemplate,
} from "./lib/emailTemplates";

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
    if (!sub || sub.status === "cancelled") return;
    if (sub.muted || sub.hidden) return;

    const now = Date.now();
    const userId = sub.userId;
    const subscriptionId = args.subscriptionId;

    const prefs = await ctx.runQuery(internal.notifications.leadTimePrefs, {
      userId,
    });

    async function scheduleOne(
      type: "7d" | "3d" | "24h" | "trial_7d" | "trial_3d" | "trial_24h",
      time: number,
    ) {
      if (time <= now) return;
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_subscription_and_type", (q) =>
          q.eq("subscriptionId", subscriptionId).eq("type", type),
        )
        .first();
      if (existing) return;
      const notificationId = await ctx.db.insert("notifications", {
        userId,
        subscriptionId,
        scheduledAt: time,
        type,
        status: "pending",
      });
      const delay = Math.max(0, time - now);
      await ctx.scheduler.runAfter(delay, internal.notifications.deliverNudge, {
        notificationId,
      });
    }

    // Renewal milestones: 7d, 3d, 24h (skipping any the user turned off).
    // When the trial ends the same day the paid plan starts, the trial
    // copy already covers the charge — skip renewal rows so the user
    // doesn't get two mails for one event.
    const sameDay =
      sub.nextRenewalAt !== undefined &&
      sub.trialEndsAt !== undefined &&
      Math.abs(sub.nextRenewalAt - sub.trialEndsAt) < DAY;
    if (sub.nextRenewalAt && !sameDay) {
      const renewalAt = sub.nextRenewalAt;
      const allMilestones: Array<{ type: "7d" | "3d" | "24h"; time: number }> =
        [
          { type: "7d", time: renewalAt - 7 * DAY },
          { type: "3d", time: renewalAt - 3 * DAY },
          { type: "24h", time: renewalAt - 1 * DAY },
        ];
      for (const m of allMilestones) {
        const allowed =
          m.type === "7d"
            ? prefs.notify7d
            : m.type === "3d"
              ? prefs.notify3d
              : prefs.notify24h;
        if (!allowed) continue;
        await scheduleOne(m.type, m.time);
      }
    }

    // Trial milestones: same 7d/3d/24h pattern before trialEndsAt.
    // Reuses the same lead-time prefs. Skips past milestones.
    if (sub.trialEndsAt) {
      const trialAt = sub.trialEndsAt;
      const trialMilestones: Array<{
        type: "trial_7d" | "trial_3d" | "trial_24h";
        time: number;
        allowed: boolean;
      }> = [
        { type: "trial_7d", time: trialAt - 7 * DAY, allowed: prefs.notify7d },
        { type: "trial_3d", time: trialAt - 3 * DAY, allowed: prefs.notify3d },
        {
          type: "trial_24h",
          time: trialAt - 1 * DAY,
          allowed: prefs.notify24h,
        },
      ];
      for (const m of trialMilestones) {
        if (!m.allowed) continue;
        await scheduleOne(m.type, m.time);
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
 * subs. Auto-detected cancels dedup for 30 days so repeated Gmail forward
 * loops stay quiet; manual taps always mail (user explicitly asked).
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
    // Auto dedups for 30d; manual always sends (user explicitly tapped).
    if (args.origin === "auto") {
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_subscription_and_type", (q) =>
          q.eq("subscriptionId", args.subscriptionId).eq("type", "confirmed"),
        )
        .collect();
      if (recent.some((n) => n.scheduledAt > Date.now() - 30 * DAY)) return;
    }
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
    const isTrial =
      notif.type === "trial_7d" ||
      notif.type === "trial_3d" ||
      notif.type === "trial_24h";
    const isReminder = notif.type === "reminder";

    if (notif.status !== "pending" || sub.hidden) return;
    // Cancellation confirmations go out even for cancelled or muted subs.
    // That is the point: the user must hear when tracking stops.
    // Renewal, trial, and reminder nudges still stop at cancelled or muted.
    if (!isConfirmation && (sub.status === "cancelled" || sub.muted)) return;
    // Reminder only makes sense while still stuck in user_started.
    if (isReminder && sub.status !== "user_started") {
      await ctx.runMutation(internal.notifications.markNotificationSent, {
        notificationId: args.notificationId,
        status: "failed",
        error: "No longer stuck — status changed",
      });
      return;
    }

    // Honor lead-time prefs at delivery too: the user may have turned
    // a warning off after it was scheduled. Record it plainly so the
    // history shows what happened instead of a stuck Pending row.
    // Trial warnings reuse the same 7d/3d/24h prefs. Reminder has no pref.
    if (!isConfirmation && !isReminder) {
      const prefs = await ctx.runQuery(internal.notifications.leadTimePrefs, {
        userId: sub.userId,
      });
      const base =
        notif.type === "7d" || notif.type === "trial_7d"
          ? prefs.notify7d
          : notif.type === "3d" || notif.type === "trial_3d"
            ? prefs.notify3d
            : prefs.notify24h;
      if (!base) {
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

    const { subject, text, html } = isConfirmation
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
      : isTrial
        ? trialEndingTemplate({
            merchant: sub.merchant,
            product: sub.product,
            price: sub.price,
            currency: sub.currency,
            billingInterval: sub.billingInterval,
            trialEndsAt: sub.trialEndsAt,
            cancellationUrl: sub.cancellationUrl,
            subscriptionId: sub._id,
          })
        : isReminder
          ? actionReminderTemplate({
              merchant: sub.merchant,
              product: sub.product,
              price: sub.price,
              currency: sub.currency,
              billingInterval: sub.billingInterval,
              nextRenewalAt: sub.nextRenewalAt,
              subscriptionId: sub._id,
            })
          : renewalNudgeTemplate(
              {
                merchant: sub.merchant,
                product: sub.product,
                price: sub.price,
                currency: sub.currency,
                billingInterval: sub.billingInterval,
                nextRenewalAt: sub.nextRenewalAt,
                cancellationUrl: sub.cancellationUrl,
                subscriptionId: sub._id,
              },
              notif.type as "7d" | "3d" | "24h",
            );
    const body = text;

    const isProd = process.env.NODE_ENV === "production";
    if (!apiKey) {
      if (isProd) {
        await ctx.runMutation(internal.notifications.markNotificationSent, {
          notificationId: args.notificationId,
          status: "failed",
          error: "AGENTMAIL_API_KEY is not set",
        });
        return;
      }
      console.log(
        `[Mock AgentMail Outbound Nudge] Sent to ${recipient}:\nSubject: ${subject}\n\n${body}`,
      );
      await ctx.runMutation(internal.notifications.markNotificationSent, {
        notificationId: args.notificationId,
        status: "sent",
      });
      return;
    }
    // Durable send via the official AgentMail component. Enqueue-time
    // failures mark the row failed; delivery itself retries in the
    // component workpool and is observable via its outbound status.
    try {
      const inboxId =
        (process.env.AGENTMAIL_INBOX as string | undefined) ??
        "subzero-agent@agentmail.to";
      await ctx.runMutation(internal.lib.agentmail.enqueueSend, {
        inboxId,
        to: recipient,
        subject,
        text: body,
        html,
        labels: isConfirmation
          ? ["cancellation-confirmed"]
          : isTrial
            ? ["trial-ending"]
            : isReminder
              ? ["action-reminder"]
              : ["renewal-nudge"],
      });
      await ctx.runMutation(internal.notifications.markNotificationSent, {
        notificationId: args.notificationId,
        status: "sent",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.notifications.markNotificationSent, {
        notificationId: args.notificationId,
        status: "failed",
        error: msg,
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
    const trialSubs = await ctx.runQuery(
      internal.subscriptions.getTrialsUpcomingForSweep,
    );
    for (const sub of trialSubs) {
      await ctx.runMutation(
        internal.notifications.scheduleNudgesForSubscription,
        {
          subscriptionId: sub._id,
        },
      );
    }
  },
});

export const getStaleStartedInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * DAY;
    const rows = await ctx.db.query("subscriptions").collect();
    return rows
      .filter(
        (s) =>
          s.status === "user_started" &&
          !s.muted &&
          !s.hidden &&
          (s.startedAt ?? s._creationTime) < threeDaysAgo,
      )
      .map((s) => ({ _id: s._id }));
  },
});

export const sweepStaleReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const stale: Array<{ _id: string }> = await ctx.runQuery(
      internal.notifications.getStaleStartedInternal,
    );
    for (const s of stale) {
      const subId = s._id as never;
      const existing = await ctx.runQuery(
        internal.notifications.hasReminderInternal,
        { subscriptionId: subId as never },
      );
      if (existing) continue;
      const sub = await ctx.runQuery(internal.subscriptions.getInternal, {
        id: subId as never,
      });
      if (!sub || sub.status !== "user_started" || sub.muted || sub.hidden)
        continue;
      await ctx.runMutation(internal.notifications.scheduleReminderInternal, {
        subscriptionId: subId as never,
      });
    }
  },
});

export const hasReminderInternal = internalQuery({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("notifications")
      .withIndex("by_subscription_and_type", (q) =>
        q.eq("subscriptionId", args.subscriptionId).eq("type", "reminder"),
      )
      .first();
    return !!row;
  },
});

export const scheduleReminderInternal = internalMutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.status !== "user_started" || sub.muted || sub.hidden)
      return;
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_subscription_and_type", (q) =>
        q.eq("subscriptionId", args.subscriptionId).eq("type", "reminder"),
      )
      .first();
    if (existing) return;
    const notificationId = await ctx.db.insert("notifications", {
      userId: sub.userId,
      subscriptionId: args.subscriptionId,
      scheduledAt: Date.now(),
      type: "reminder",
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.notifications.deliverNudge, {
      notificationId,
    });
  },
});
