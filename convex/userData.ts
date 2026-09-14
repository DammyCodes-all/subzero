import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { mutation, type MutationCtx } from "./_generated/server";

/**
 * User data deletion.
 *
 * Scope (mirrors the privacy promise: excerpts, not the inbox):
 * - subscriptions
 * - evidence (receipt excerpts + research notes attached to subscriptions)
 * - cancellationActions (cancellation drafts attached to subscriptions)
 * - notifications (notification history)
 * - ingestionAttempts (scan history: sender + subject metadata, 7 day window)
 * - gmailScanFailures / gmailScanRuns (per-connection scan history)
 * - userSettings (notification preferences)
 * - gmailOAuthStates (pending OAuth flows)
 * - connections are deleted entirely (past Gmail inboxes and forwarding
 *   rows leave no email traces behind; the Gmail watch is stopped first)
 *
 * Auth records are intentionally untouched by deleteMyData — use
 * deleteMyAccount for a full account wipe (data + login).
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

type WipeCounts = {
  subscriptions: number;
  evidence: number;
  drafts: number;
  notifications: number;
  scans: number;
  connectionsRemoved: number;
};

async function wipeUserAppData(
  ctx: MutationCtx,
  candidates: Set<string>,
): Promise<WipeCounts> {
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

  // Deletion tombstones (per-subscription delete memory).
  for (const uid of candidates) {
    const tombs = await ctx.db
      .query("deletedSubscriptions")
      .withIndex("by_user_and_dedup", (q) => q.eq("userId", uid))
      .collect();
    for (const t of tombs) await ctx.db.delete(t._id);
  }

  // Per-connection scan runs + retry queue (user-scoped scan history).
  const deletedRunIds = new Set<string>();
  for (const uid of candidates) {
    const batch = await ctx.db
      .query("gmailScanRuns")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const r of batch) {
      if (deletedRunIds.has(r._id)) continue;
      deletedRunIds.add(r._id);
      await ctx.db.delete(r._id);
    }
  }
  const deletedFailureIds = new Set<string>();
  for (const uid of candidates) {
    const batch = await ctx.db
      .query("gmailScanFailures")
      .withIndex("by_user_status", (q) => q.eq("userId", uid))
      .collect();
    for (const f of batch) {
      if (deletedFailureIds.has(f._id)) continue;
      deletedFailureIds.add(f._id);
      await ctx.db.delete(f._id);
      scanCount += 1;
    }
  }

  // Notification preferences.
  for (const uid of candidates) {
    const rows = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }

  // Pending OAuth flows.
  for (const uid of candidates) {
    const rows = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
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
      // Retry-queue + scan-run rows keyed by connection die with it.
      const failures = await ctx.db
        .query("gmailScanFailures")
        .withIndex("by_conn_message", (q) => q.eq("connId", c._id))
        .collect();
      for (const f of failures) {
        if (deletedFailureIds.has(f._id)) continue;
        await ctx.db.delete(f._id);
      }
      const runs = await ctx.db
        .query("gmailScanRuns")
        .withIndex("by_conn", (q) => q.eq("connId", c._id))
        .collect();
      for (const r of runs) {
        if (deletedRunIds.has(r._id)) continue;
        await ctx.db.delete(r._id);
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
}

export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ident = await ctx.auth.getUserIdentity();
    const candidates = candidateIds(userId, ident?.tokenIdentifier);
    return await wipeUserAppData(ctx, candidates);
  },
});

/**
 * Full account deletion: everything deleteMyData removes, plus the login
 * itself (auth accounts, sessions + refresh tokens, and the user row).
 * The client signs out and redirects to / afterwards.
 */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ident = await ctx.auth.getUserIdentity();
    const candidates = candidateIds(userId, ident?.tokenIdentifier);
    const counts = await wipeUserAppData(ctx, candidates);

    // Auth accounts + their verification codes.
    const accounts = (
      await ctx.db.query("authAccounts").collect()
    ).filter((a) => (a as { userId: string }).userId === userId);
    for (const a of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", a._id))
        .collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }

    // Sessions + their refresh tokens (this kills all active logins).
    const sessions = (await ctx.db.query("authSessions").collect()).filter(
      (s) => (s as { userId: string }).userId === userId,
    );
    for (const s of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
        .collect();
      for (const t of tokens) await ctx.db.delete(t._id);
      await ctx.db.delete(s._id);
    }

    // The user row itself.
    const user = await ctx.db.get(userId);
    if (user) await ctx.db.delete(user._id);

    return counts;
  },
});
