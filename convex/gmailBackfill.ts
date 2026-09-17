import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  buildBroadInboxQuery,
  buildGmailQuery,
  listMessages,
} from "./lib/gmail";
import { processBatch, type ScanCounters } from "./lib/gmailProcess";
import {
  INITIAL_SCAN_NARROW_CAP,
  INITIAL_SCAN_TOTAL_CAP,
  remainingScanBudget,
  takeWithinScanBudget,
} from "./lib/gmailScanBudget";

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
      lastGmailScanAt: Date.now(),
    });
  },
});

// Deep-backfill bounds: 90-day window, max 100 emails per connection per
// backfill lifetime, max 25 per tick (after live mail). Each email costs
// ~1 AI extraction, hence the per-tick budget. First scans drain fast via
// the self-chaining drainBackfill worker (~5s between batches) instead of
// waiting on the 15-minute poll cron.
const BACKFILL_WINDOW_DAYS = 90;
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

  // Self-heal cursors written by the old inline scan, which could seed 60
  // processed messages into a 100-message lifetime cap.
  if (remainingScanBudget(processed, INITIAL_SCAN_TOTAL_CAP) === 0) {
    await ctx.runMutation(internal.gmailBackfill.clearBackfill, {
      connId: conn._id,
    });
    return;
  }

  const phaseCap =
    phase === "narrow" ? INITIAL_SCAN_NARROW_CAP : INITIAL_SCAN_TOTAL_CAP;
  const phaseBudget = Math.min(
    budget,
    remainingScanBudget(processed, phaseCap),
    remainingScanBudget(processed, INITIAL_SCAN_TOTAL_CAP),
  );

  if (phaseBudget <= 0) {
    await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
      connId: conn._id,
      query: "broad",
      pageToken: undefined,
      processed,
    });
    return;
  }

  const { messages, nextPageToken } = await listMessages(
    accessToken,
    backfillQueryFor(phase),
    phaseBudget,
    pageToken,
  );
  const todo = takeWithinScanBudget(
    messages.slice(0, phaseBudget),
    processed,
    phaseCap,
  );
  await processBatch(
    ctx,
    userId,
    conn,
    accessToken,
    todo.map((m) => m.id),
    counters,
  );
  processed += todo.length;
  const phaseHasMore = processed < phaseCap && !!nextPageToken;

  if (phase === "narrow" && (!phaseHasMore || processed >= phaseCap)) {
    // Reserve the remaining lifetime budget for broad inbox recall instead of
    // allowing a large receipt-heavy inbox to consume the entire cap.
    phase = "broad";
    pageToken = undefined;
    const broadBudget = Math.min(
      budget - todo.length,
      remainingScanBudget(processed, INITIAL_SCAN_TOTAL_CAP),
    );
    if (broadBudget <= 0) {
      await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
        connId: conn._id,
        query: phase,
        pageToken,
        processed,
      });
      return;
    }
    const broad = await listMessages(
      accessToken,
      backfillQueryFor(phase),
      broadBudget,
      pageToken,
    );
    const broadTodo = takeWithinScanBudget(
      broad.messages.slice(0, broadBudget),
      processed,
      INITIAL_SCAN_TOTAL_CAP,
    );
    await processBatch(
      ctx,
      userId,
      conn,
      accessToken,
      broadTodo.map((m) => m.id),
      counters,
    );
    processed += broadTodo.length;
    const broadHasMore =
      processed < INITIAL_SCAN_TOTAL_CAP && !!broad.nextPageToken;
    if (broadHasMore) {
      await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
        connId: conn._id,
        query: phase,
        pageToken: broad.nextPageToken,
        processed,
      });
    } else {
      await ctx.runMutation(internal.gmailBackfill.clearBackfill, {
        connId: conn._id,
      });
    }
    return;
  }

  if (phaseHasMore) {
    await ctx.runMutation(internal.gmailBackfill.updateBackfill, {
      connId: conn._id,
      query: phase,
      pageToken: nextPageToken,
      processed,
    });
  } else {
    await ctx.runMutation(internal.gmailBackfill.clearBackfill, {
      connId: conn._id,
    });
  }
}
