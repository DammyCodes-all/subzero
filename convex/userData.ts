import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

/**
 * User data deletion.
 *
 * Scope (mirrors the privacy promise: excerpts, not the inbox):
 * - subscriptions
 * - evidence (receipt excerpts + research notes attached to subscriptions)
 * - cancellationActions (cancellation drafts attached to subscriptions)
 * - notifications (notification history)
 * - ingestionAttempts (scan history: sender + subject metadata, 7 day window)
 * - connections are deleted entirely (past Gmail inboxes and forwarding
 *   rows leave no email traces behind; the Gmail watch is stopped first)
 *
 * Auth records are intentionally untouched.
 */

function candidateIds(userId: string, tokenId?: string): Set<string> {
  const ids = new Set<string>([userId]);
  if (tokenId) ids.add(tokenId);
  for (const id of [...ids]) {
    const parts = id.split("|");
    const uid = parts.length >= 2 ? parts[1] : id;
    ids.add(uid);
    ids.add(`user:${uid}`);
  }
  return ids;
}

function belongsToUser(rowUserId: string, candidates: Set<string>): boolean {
  if (candidates.has(rowUserId)) return true;
  for (const c of candidates) {
    if (rowUserId.includes(c) || c.includes(rowUserId)) return true;
  }
  return false;
}

export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ident = await ctx.auth.getUserIdentity();
    const candidates = candidateIds(userId, ident?.tokenIdentifier);

    const allSubs = await ctx.db.query("subscriptions").collect();
    const subs = allSubs.filter((s) => belongsToUser(s.userId, candidates));

    let evidenceCount = 0;
    let draftCount = 0;
    let notificationCount = 0;

    for (const s of subs) {
      const ev = await ctx.db
        .query("evidence")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", s._id))
        .collect();
      for (const e of ev) {
        await ctx.db.delete(e._id);
        evidenceCount += 1;
      }
      const acts = await ctx.db
        .query("cancellationActions")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", s._id))
        .collect();
      for (const a of acts) {
        await ctx.db.delete(a._id);
        draftCount += 1;
      }
      const notifs = await ctx.db
        .query("notifications")
        .withIndex("by_subscription_and_type", (q) =>
          q.eq("subscriptionId", s._id),
        )
        .collect();
      for (const n of notifs) {
        await ctx.db.delete(n._id);
        notificationCount += 1;
      }
      await ctx.db.delete(s._id);
    }

    // Orphan notification history stored under a different id shape.
    const deletedNotifIds = new Set<string>();
    for (const uid of candidates) {
      const batch = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      for (const n of batch) {
        if (deletedNotifIds.has(n._id)) continue;
        deletedNotifIds.add(n._id);
        await ctx.db.delete(n._id);
        notificationCount += 1;
      }
    }

    // Scan history (sender + subject metadata, 7 day window).
    let scanCount = 0;
    const deletedAttemptIds = new Set<string>();
    for (const uid of candidates) {
      const batch = await ctx.db
        .query("ingestionAttempts")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      for (const a of batch) {
        if (deletedAttemptIds.has(a._id)) continue;
        deletedAttemptIds.add(a._id);
        await ctx.db.delete(a._id);
        scanCount += 1;
      }
    }

    // Full removal: delete the user's connection rows outright so past
    // Gmail inboxes leave no email traces behind. Watch shutdown is
    // scheduled first with the captured token (the action tolerates the
    // row already being gone). Forwarding rows recreate on demand via
    // getOrCreateInbox; Gmail rows recreate fresh on the next connect.
    let connectionsRemoved = 0;
    const seenConns = new Set<string>();
    for (const uid of candidates) {
      const batch = await ctx.db
        .query("connections")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      for (const c of batch) {
        if (seenConns.has(c._id)) continue;
        seenConns.add(c._id);
        if (!belongsToUser(c.userId, candidates)) continue;
        const tok = (c as { gmailRefreshToken?: string }).gmailRefreshToken;
        if (tok) {
          try {
            await ctx.scheduler.runAfter(
              0,
              internal.gmailWatch.stopWatchForConn,
              { connId: c._id, refreshToken: tok },
            );
          } catch {}
        }
        await ctx.db.delete(c._id);
        connectionsRemoved += 1;
      }
    }

    return {
      subscriptions: subs.length,
      evidence: evidenceCount,
      drafts: draftCount,
      notifications: notificationCount,
      scans: scanCount,
      connectionsRemoved,
    };
  },
});
