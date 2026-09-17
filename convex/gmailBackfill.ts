import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  buildBroadInboxQuery,
  buildGmailQuery,
  listMessages,
} from "./lib/gmail";
import { fetchAndHandle, mapWithConcurrency, type ScanCounters } from "./lib/gmailProcess";

export const seedBackfill = internalMutation({
  args: {
    connId: v.id("connections"),
    query: v.optional(v.union(v.literal("narrow"), v.literal("broad"))),
    pageToken: v.optional(v.string()),
    processed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, {
      gmailBackfillSeededAt: Date.now(),
      gmailBackfillQuery: args.query ?? "narrow",
      gmailBackfillPageToken: args.pageToken,
      gmailBackfillProcessed: args.processed ?? 0,
    });
  },
});

export const updateBackfill = internalMutation({
  args: {
    connId: v.id("connections"),
    query: v.union(v.literal("narrow"), v.literal("broad")),
    pageToken: v.optional(v.string()),
    processed: v.number(),
  },
  handler: async (ctx, args) => {
    // Deliberately does NOT touch lastGmailScanAt: backfill progress must
    // not trip the manual-scan cooldown or the "last synced" display —
    // the Connections UI shows backfill progress separately.
    await ctx.db.patch(args.connId, {
      gmailBackfillQuery: args.query,
      gmailBackfillPageToken: args.pageToken,
      gmailBackfillProcessed: args.processed,
    });
  },
});

export const clearBackfill = internalMutation({
  args: { connId: v.id("connections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connId, {
      gmailBackfillSeededAt: undefined,
      gmailBackfillQuery: undefined,
      gmailBackfillPageToken: undefined,
      gmailBackfillProcessed: undefined,
    });
  },
});

// Deep-backfill bounds: 90-day window, max 50 emails per connection per
// backfill lifetime, max 25 per tick (after live mail). Each email costs
// ~1 AI extraction, hence the per-tick budget. First scans drain fast via
// the self-chaining drainBackfill worker (~5s between batches) instead of
// waiting on the 15-minute poll cron.
const BACKFILL_WINDOW_DAYS = 90;
const BACKFILL_TOTAL_CAP = 50;
export const BACKFILL_PER_TICK = 25;
export const DRAIN_DELAY_MS = 5 * 1000;

function backfillQueryFor(phase: string): string {
  return phase === "broad"
    ? buildBroadInboxQuery(BACKFILL_WINDOW_DAYS)
    : buildGmailQuery(BACKFILL_WINDOW_DAYS);
}

// Process one backfill batch for a connection. Narrow keyword query first,
// then always broad — narrow alone missed welcomes ("Welcome to Creative
// Cloud" has no receipt keyword in subject). Shared lifetime cap bounds cost.
export async function runBackfillBatch(
  ctx: any,
  userId: string,
  conn: any,
  accessToken: string,
  budget: number,
  counters: ScanCounters,
): Promise<void> {
  if (!conn.gmailBackfillSeededAt || budget <= 0) return;
  let phase = conn.gmailBackfillQuery ?? "narrow";
  let pageToken = conn.gmailBackfillPageToken as string | undefined;
  let processed = conn.gmailBackfillProcessed ?? 0;
  // Request one extra to detect remainder without another round-trip.
  const { messages, nextPageToken } = await listMessages(
    accessToken,
    backfillQueryFor(phase),
    Math.min(budget + 1, BACKFILL_TOTAL_CAP - processed + 1),
    pageToken,
  );
  const batch = messages.slice(0, budget);
  const room = Math.max(0, BACKFILL_TOTAL_CAP - processed);
  const todo = batch.slice(0, room);
  await mapWithConcurrency(todo, (m) =>
    fetchAndHandle(ctx, userId, conn, accessToken, m.id, counters),
  );
  processed += todo.length;
  const hasMore = processed < BACKFILL_TOTAL_CAP && (messages.length > batch.length || !!nextPageToken);
  // Narrow is a subset of broad (keyword-filtered inbox vs all inbox), so
  // switching phases never loses narrow remainder — broad re-surfaces it.
  // Cap the narrow phase to guarantee broad runs within the lifetime budget:
  // otherwise a 50-receipt narrow inbox starves welcomes forever.
  const NARROW_PHASE_CAP = 30;
  const narrowCapHit = phase === "narrow" && processed >= NARROW_PHASE_CAP && hasMore;
  if ((!hasMore && phase === "narrow") || narrowCapHit) {
    // Narrow exhausted — one broad pass over the window with the remainder
    // of this tick's budget so welcomes are never invisible.
    phase = "broad";
    pageToken = undefined;
    const remaining = Math.min(budget - todo.length, BACKFILL_TOTAL_CAP - processed);
    if (remaining <= 0) {
      await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
        connId: conn._id,
        query: phase,
        pageToken: undefined,
        processed,
      });
      return;
    }
    const broad = await listMessages(
      accessToken,
      backfillQueryFor(phase),
      Math.min(remaining + 1, BACKFILL_TOTAL_CAP - processed + 1),
      undefined,
    );
    const broadBatch = broad.messages.slice(0, remaining);
    await mapWithConcurrency(broadBatch, (m) =>
      fetchAndHandle(ctx, userId, conn, accessToken, m.id, counters),
    );
    processed += broadBatch.length;
    const broadHasMore =
      processed < BACKFILL_TOTAL_CAP &&
      (broad.messages.length > broadBatch.length || !!broad.nextPageToken);
    if (!broadHasMore) {
      await ctx.runMutation(internal.gmailBackfill.clearBackfill, { connId: conn._id });
    } else {
      await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
        connId: conn._id,
        query: phase,
        pageToken: broad.nextPageToken,
        processed,
      });
    }
    return;
  }
  if (!hasMore) {
    await ctx.runMutation(internal.gmailBackfill.clearBackfill, { connId: conn._id });
  } else {
    await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
      connId: conn._id,
      query: phase,
      pageToken: nextPageToken,
      processed,
    });
  }
}
