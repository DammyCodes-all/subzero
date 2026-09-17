"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  buildGmailQuery,
  getAccessToken,
  getProfileHistoryId,
  isAuthError,
  listMessages,
} from "./lib/gmail";
import {
  fetchAndHandle,
  mapWithConcurrency,
  newScanCounters,
} from "./lib/gmailProcess";
import {
  INITIAL_SCAN_INLINE_CAP,
  remainingScanBudget,
} from "./lib/gmailScanBudget";
import { processOneEmail } from "./lib/processEmail";

const COOLDOWN_MS = 10 * 60 * 1000;

// Keep the interactive pass to one Gmail page. The remaining historical
// budget moves to the resumable worker so the action returns quickly and the
// dashboard can render results as they arrive.

export const scanGmail = action({
  args: {
    connectionId: v.optional(v.id("connections")),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    merged: v.number(),
    skipped: v.number(),
    unparsed: v.number(),
    duplicate: v.number(),
    cancelled: v.number(),
    failed: v.number(),
    remaining: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conns: any[] = await ctx.runQuery(
      internal.gmailConnectionState.getConnectionsInternal,
      { userId },
    );
    const fixture = process.env.FIXTURE_GMAIL === "1";
    const c = newScanCounters();
    const done = (extra?: { reason?: string; remaining?: boolean }) => ({
      ...c,
      ...extra,
    });

    if (fixture) {
      // Fixtures are user-agnostic — scan once
      const first = conns[0];
      if (
        !args.force &&
        first?.lastGmailScanAt &&
        Date.now() - first.lastGmailScanAt < COOLDOWN_MS
      ) {
        return done({ reason: "cooldown" });
      }
      const { fixtures } = await import("./ingestion/fixtures");
      const list = Object.values(fixtures);
      for (const f of list) {
        c.scanned++;
        const r = await processOneEmail(
          ctx,
          userId,
          f.subject,
          f.text,
          f.html ?? "",
          `fixture:${f.subject.slice(0, 20)}`,
          undefined,
          undefined,
          f.from,
        );
        if (r.status === "created") c.created++;
        else if (r.status === "merged") c.merged++;
        else if (r.status === "skipped") c.skipped++;
        else if (r.status === "unparsed") c.unparsed++;
        else if (r.status === "duplicate") c.duplicate++;
        else if (r.status === "cancelled") c.cancelled++;
      }
      if (first?._id)
        await ctx.runMutation(internal.gmailConnectionState.touchScan as any, {
          connId: first._id,
        });
      return done();
    }

    const active = conns.filter(
      (c) =>
        c.gmailRefreshToken &&
        c.gmailScopeGranted &&
        c.status === "connected" &&
        (!args.connectionId || c._id === args.connectionId),
    );
    if (active.length === 0) {
      return done({ reason: "no_consent" });
    }

    let anyScanned = false;
    let authFailed = false;
    let completedAnyConn = false;
    let chainedAny = false;
    for (const conn of active) {
      // Per-connection cooldown — explicit Rescans pass force:true to bypass
      // (send-then-scan test loop); cron/poll keeps the guard.
      if (
        !args.force &&
        conn.lastGmailScanAt &&
        Date.now() - conn.lastGmailScanAt < COOLDOWN_MS
      ) {
        continue;
      }
      let accessToken: string;
      try {
        const tok = await getAccessToken(conn.gmailRefreshToken);
        accessToken = tok.accessToken;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (isAuthError(msg)) {
          authFailed = true;
          try {
            await ctx.runMutation(internal.gmail.markTokenInvalid, {
              connId: conn._id,
            });
          } catch {}
        }
        // Non-auth token failures fall through to scan_failed below —
        // don't misreport them as no_consent.
        continue;
      }

      // Same 90-day window as the backfill worker, so a pageToken can
      // chain straight into the resumable backfill when we hit the cap.
      const q = buildGmailQuery(90);
      let pageToken: string | undefined;
      let pages = 0;
      const maxPages = 8;
      let connCompleted = false;
      let runProcessed = 0;
      let stoppedEarly = false;
      try {
        do {
          const pageBudget = remainingScanBudget(
            runProcessed,
            INITIAL_SCAN_INLINE_CAP,
          );
          if (pageBudget <= 0) {
            stoppedEarly = !!pageToken;
            break;
          }
          const { messages, nextPageToken } = await listMessages(
            accessToken,
            q,
            Math.min(15, pageBudget),
            pageToken,
          );
          pageToken = nextPageToken;
          pages++;
          const scannedBefore = c.scanned;
          await mapWithConcurrency(messages, (message) =>
            fetchAndHandle(ctx, userId, conn, accessToken, message.id, c),
          );
          runProcessed += messages.length;
          if (c.scanned > scannedBefore) anyScanned = true;
          if (runProcessed >= INITIAL_SCAN_INLINE_CAP && pageToken) {
            stoppedEarly = true;
            break;
          }
          if (!pageToken) break;
        } while (pages < maxPages);
        connCompleted = true;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (isAuthError(msg)) {
          authFailed = true;
          try {
            await ctx.runMutation(internal.gmail.markTokenInvalid, {
              connId: conn._id,
            });
          } catch {}
        }
        // Transient list failure — don't touchScan so retry isn't blocked by cooldown.
        continue;
      }

      if (connCompleted && conn?._id) {
        completedAnyConn = true;
        // Hit the per-run cap with pages left: chain the rest into the
        // fast-drain backfill worker (~5s batches) instead of trickling
        // via the 15-minute poll cron. An already-active backfill is left
        // alone — its drain chain (or the cron) keeps working through it.
        if (stoppedEarly && pageToken && !conn.gmailBackfillSeededAt) {
          chainedAny = true;
          try {
            await ctx.runMutation(internal.gmailBackfill.seedBackfill as any, {
              connId: conn._id,
              query: "narrow",
              pageToken,
              processed: runProcessed,
            });
            await ctx.scheduler.runAfter(
              0,
              internal.gmailBackfillDrain.drainBackfill as any,
              { connId: conn._id },
            );
          } catch {}
        } else if (stoppedEarly && conn.gmailBackfillSeededAt) {
          // A backfill was already running — background work continues.
          chainedAny = true;
        }
        await ctx.runMutation(internal.gmailConnectionState.touchScan as any, {
          connId: conn._id,
        });
        try {
          await ctx.runMutation(internal.gmailRetries.recordRun as any, {
            userId,
            connId: conn._id,
            trigger: "manual",
            scanned: c.scanned,
            created: c.created,
            failed: c.failed,
          });
        } catch {}
        // Seed historyId for future incremental poll (proactive watching)
        try {
          const hid = await getProfileHistoryId(accessToken);
          await ctx.runMutation(
            internal.gmailConnectionState.updateHistoryId as any,
            {
              connId: conn._id,
              historyId: hid,
            },
          );
        } catch {}
        // Best-effort ensure watch if topic configured
        try {
          await ctx.scheduler.runAfter(
            0,
            internal.gmailWatch.ensureWatchForConn as any,
            { connId: conn._id },
          );
        } catch {}
      }
    }

    if (!anyScanned && c.scanned === 0) {
      if (authFailed && !completedAnyConn) {
        return done({ reason: "no_consent" });
      }
      const allOnCooldown =
        !args.force &&
        active.every(
          (conn) =>
            conn.lastGmailScanAt &&
            Date.now() - conn.lastGmailScanAt < COOLDOWN_MS,
        );
      if (allOnCooldown) {
        return done({ reason: "cooldown" });
      }
      if (!completedAnyConn) {
        return done({ reason: "scan_failed" });
      }
    }
    // Rescan re-fires rate-limit casualties: failed/stuck research for this
    // user goes pending again (max 3) instead of waiting on the 6h cron.
    if (completedAnyConn) {
      try {
        const failed: any[] = await ctx.runQuery(
          internal.subscriptions.getFailedForRetry as any,
          {},
        );
        const mine = failed.filter((s) => s.userId === userId).slice(0, 3);
        for (const s of mine) {
          try {
            await ctx.runMutation(
              internal.subscriptions.markResearchPending as any,
              {
                id: s._id,
              },
            );
            await ctx.scheduler.runAfter(
              60 * 1000,
              internal.research.researchCancellationRoute as any,
              { subscriptionId: s._id },
            );
          } catch {}
        }
      } catch {}
    }
    return done(chainedAny ? { remaining: true } : undefined);
  },
});
