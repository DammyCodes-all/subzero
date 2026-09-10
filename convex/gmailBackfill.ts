import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  buildBroadInboxQuery,
  buildGmailQuery,
  listMessages,
} from "./lib/gmail";
import { fetchAndHandle, type ScanCounters } from "./lib/gmailProcess";

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
// backfill lifetime, max 10 per tick (after live mail). Each email costs
// ~1 AI extraction, hence the per-tick budget.
const BACKFILL_WINDOW_DAYS = 90;
const BACKFILL_TOTAL_CAP = 50;
export const BACKFILL_PER_TICK = 10;

function backfillQueryFor(phase: string): string {
  return phase === "broad"
    ? buildBroadInboxQuery(BACKFILL_WINDOW_DAYS)
    : buildGmailQuery(BACKFILL_WINDOW_DAYS);
}

// Process one backfill batch for a connection. Narrow subject query first;
// if it yields nothing at all, fall back to the broad inbox query once
// (mirrors the old 7-day fallback, extended to the full window).
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
  for (const m of batch) {
    if (processed >= BACKFILL_TOTAL_CAP) break;
    await fetchAndHandle(ctx, userId, conn, accessToken, m.id, counters);
    processed++;
    await new Promise((rr) => setTimeout(rr, 450));
  }
  const hasMore = processed < BACKFILL_TOTAL_CAP && (messages.length > batch.length || !!nextPageToken);
  if (!hasMore && phase === "narrow" && processed === 0) {
    // Narrow query found nothing at all — one broad pass over the window.
    phase = "broad";
    pageToken = undefined;
    const broad = await listMessages(
      accessToken,
      backfillQueryFor(phase),
      Math.min(budget + 1, BACKFILL_TOTAL_CAP - processed + 1),
      undefined,
    );
    const broadBatch = broad.messages.slice(0, budget);
    for (const m of broadBatch) {
      if (processed >= BACKFILL_TOTAL_CAP) break;
      await fetchAndHandle(ctx, userId, conn, accessToken, m.id, counters);
      processed++;
      await new Promise((rr) => setTimeout(rr, 450));
    }
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
