import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Retry schedule: failure #1 retries in 15m, #2 in 1h, #3 in 6h, #4 in
// 24h. Past that the message is dead. Weak AI results ("unparsed") get a
// shorter leash — 2 failures, then dead.
const RETRY_DELAYS_MS = [
  15 * 60 * 1000,
 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const MAX_FAILURES = 4;
const MAX_WEAK_FAILURES = 2;

function maxFailuresFor(errorKind: string): number {
  return errorKind === "weak" ? MAX_WEAK_FAILURES : MAX_FAILURES;
}

export const enqueueFailure = internalMutation({
  args: {
    userId: v.string(),
    connId: v.id("connections"),
    gmailMessageId: v.string(),
    errorKind: v.union(
      v.literal("fetch"),
      v.literal("extract"),
      v.literal("weak"),
    ),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gmailScanFailures")
      .withIndex("by_conn_message", (q) =>
        q.eq("connId", args.connId).eq("gmailMessageId", args.gmailMessageId),
      )
      .first();
    const attempts = (existing?.attempts ?? 0) + 1;
    // A dead row that fails again (e.g. reprocessed by backfill) re-enters
    // the queue only if it hasn't exhausted its budget.
    const cap = maxFailuresFor(args.errorKind);
    if (attempts > cap) {
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "dead",
          attempts,
          lastError: args.lastError,
        });
      } else {
        await ctx.db.insert("gmailScanFailures", {
          userId: args.userId,
          connId: args.connId,
          gmailMessageId: args.gmailMessageId,
          errorKind: args.errorKind,
          attempts,
          nextRetryAt: 0,
          status: "dead",
          lastError: args.lastError,
        });
      }
      return { status: "dead" as const, attempts };
    }
    const nextRetryAt = Date.now() + RETRY_DELAYS_MS[attempts - 1];
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "queued",
        attempts,
        nextRetryAt,
        errorKind: args.errorKind,
        lastError: args.lastError,
      });
    } else {
      await ctx.db.insert("gmailScanFailures", {
        userId: args.userId,
        connId: args.connId,
        gmailMessageId: args.gmailMessageId,
        errorKind: args.errorKind,
        attempts,
        nextRetryAt,
        status: "queued",
        lastError: args.lastError,
      });
    }
    return { status: "queued" as const, attempts };
  },
});

// A message that finally processed deletes its queue row — including dead
// rows, so a later backfill can clear the dead-letter record for real.
export const resolveForMessage = internalMutation({
  args: {
    connId: v.id("connections"),
    gmailMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gmailScanFailures")
      .withIndex("by_conn_message", (q) =>
        q.eq("connId", args.connId).eq("gmailMessageId", args.gmailMessageId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getDue = internalQuery({
  args: {
    connId: v.id("connections"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailScanFailures")
      .withIndex("by_conn_status_retry", (q) =>
        q
          .eq("connId", args.connId)
          .eq("status", "queued")
          .lt("nextRetryAt", Date.now() + 1),
      )
      .take(args.limit);
  },
});

// Shared purge helper (plain function — mutations call it inline, since a
// mutation can't invoke another mutation synchronously). Token revoked,
// re-authed, or disconnected: queued retries for this connection are
// pointless (old failures may succeed under new credentials via backfill,
// which re-enqueues on its own). Dead rows stay as history.
export async function purgeQueuedForConn(ctx: any, connId: any) {
  const rows = await ctx.db
    .query("gmailScanFailures")
    .withIndex("by_conn_status_retry", (q: any) =>
      q.eq("connId", connId).eq("status", "queued"),
    )
    .collect();
  for (const r of rows) await ctx.db.delete(r._id);
  return { purged: rows.length };
}

export const recordRun = internalMutation({
  args: {
    userId: v.string(),
    connId: v.id("connections"),
    trigger: v.union(
      v.literal("poll"),
      v.literal("push"),
      v.literal("manual"),
      v.literal("connect"),
    ),
    scanned: v.number(),
    created: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gmailScanRuns", {
      userId: args.userId,
      connId: args.connId,
      trigger: args.trigger,
      scanned: args.scanned,
      created: args.created,
      failed: args.failed,
      finishedAt: Date.now(),
    });
    // Runs are telemetry, not history — keep the recent window only.
    const old = await ctx.db
      .query("gmailScanRuns")
      .withIndex("by_conn", (q) => q.eq("connId", args.connId))
      .order("desc")
      .take(31);
    if (old.length > 30) {
      for (const r of old.slice(30)) await ctx.db.delete(r._id);
    }
  },
});

// Per-connection scan health for the Connections UI: dead-letter counts,
// backfill progress, and the latest run outcome.
export const getScanHealth = query({
  args: {},
  returns: v.array(
    v.object({
      connId: v.id("connections"),
      queued: v.number(),
      dead: v.number(),
      backfillActive: v.boolean(),
      backfillProcessed: v.number(),
      lastRunAt: v.optional(v.number()),
      lastScanned: v.optional(v.number()),
      lastCreated: v.optional(v.number()),
      lastFailed: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const conns = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const google = conns.filter((c) => c.provider === "google");
    const failures = await ctx.db
      .query("gmailScanFailures")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const c of google) {
      const queued = failures.filter(
        (f) => String(f.connId) === String(c._id) && f.status === "queued",
      ).length;
      const dead = failures.filter(
        (f) => String(f.connId) === String(c._id) && f.status === "dead",
      ).length;
      const lastRun = await ctx.db
        .query("gmailScanRuns")
        .withIndex("by_conn", (q) => q.eq("connId", c._id))
        .order("desc")
        .first();
      out.push({
        connId: c._id,
        queued,
        dead,
        backfillActive: c.gmailBackfillSeededAt !== undefined,
        backfillProcessed: c.gmailBackfillProcessed ?? 0,
        lastRunAt: lastRun?.finishedAt,
        lastScanned: lastRun?.scanned,
        lastCreated: lastRun?.created,
        lastFailed: lastRun?.failed,
      });
    }
    return out;
  },
});
