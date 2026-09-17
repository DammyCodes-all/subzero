"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { BACKFILL_PER_TICK, DRAIN_DELAY_MS, runBackfillBatch } from "./gmailBackfill";
import { getAccessToken, isAuthError } from "./lib/gmail";
import { newScanCounters } from "./lib/gmailProcess";

// Fast-drain worker for first/deep scans. Processes one backfill batch,
// then re-schedules itself ~5s later while work remains — so a 50-mail
// backfill finishes in ~1min instead of trickling via the 15-minute poll
// cron (which stays as the safety net for steady-state).
export const drainBackfill = internalAction({
  args: { connId: v.id("connections") },
  returns: v.object({
    drained: v.number(),
    stillActive: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const conn: any = await ctx.runQuery(
      internal.gmailConnectionState.getConnectionByIdInternal,
      { connId: args.connId } as any,
    );
    if (!conn || !conn.gmailBackfillSeededAt) {
      return { drained: 0, stillActive: false };
    }
    if (
      !conn.gmailRefreshToken ||
      conn.status !== "connected" ||
      !conn.gmailScopeGranted
    ) {
      return { drained: 0, stillActive: true, reason: "no_consent" };
    }
    let accessToken: string;
    try {
      const tok = await getAccessToken(conn.gmailRefreshToken);
      accessToken = tok.accessToken;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (isAuthError(msg)) {
        try {
          await ctx.runMutation(internal.gmail.markTokenInvalid, {
            connId: args.connId,
          });
        } catch {}
        return { drained: 0, stillActive: true, reason: "no_consent" };
      }
      await ctx.scheduler.runAfter(
        DRAIN_DELAY_MS,
        internal.gmailBackfillDrain.drainBackfill,
        { connId: args.connId },
      );
      return { drained: 0, stillActive: true, reason: "transient" };
    }
    const c = newScanCounters();
    await runBackfillBatch(ctx, conn.userId, conn, accessToken, BACKFILL_PER_TICK, c);
    const drained = c.scanned;
    const updated: any = await ctx.runQuery(
      internal.gmailConnectionState.getConnectionByIdInternal,
      { connId: args.connId } as any,
    );
    const stillActive = !!updated?.gmailBackfillSeededAt;
    if (stillActive) {
      await ctx.scheduler.runAfter(
        DRAIN_DELAY_MS,
        internal.gmailBackfillDrain.drainBackfill,
        { connId: args.connId },
      );
    }
    return { drained, stillActive };
  },
});
