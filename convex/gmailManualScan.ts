"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  buildGmailQuery,
  getAccessToken,
  getMessage,
  getProfileHistoryId,
  isAuthError,
  listMessages,
} from "./lib/gmail";
import {
  handleFetchedMessage,
  newScanCounters,
  queueFailure,
} from "./lib/gmailProcess";
import { processOneEmail } from "./lib/processEmail";

const COOLDOWN_MS = 10 * 60 * 1000;

// Manual scan budget: 25 emails inline per run per connection. Anything
// beyond that chains into the resumable backfill so the cron finishes it.
const MANUAL_PER_RUN = 25;

export const scanGmail = action({
  args: { connectionId: v.optional(v.id("connections")) },
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
      // Per-connection cooldown — skip connections scanned recently, scan the rest
      if (
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
      const maxPages = 6;
      let connCompleted = false;
      let runProcessed = 0;
      let stoppedEarly = false;
      try {
        do {
          const { messages, nextPageToken } = await listMessages(
            accessToken,
            q,
            15,
            pageToken,
          );
          pageToken = nextPageToken;
          pages++;
          for (let i = 0; i < messages.length; i += 5) {
            const batch = messages.slice(i, i + 5);
            const fetched = await Promise.all(
              batch.map((m) => getMessage(accessToken, m.id).catch(() => null)),
            );
            for (let j = 0; j < batch.length; j++) {
              const msg = fetched[j];
              runProcessed++;
              if (!msg) {
                await queueFailure(
                  ctx,
                  userId,
                  conn,
                  batch[j].id,
                  "fetch",
                  "fetch_failed",
                  c,
                );
                continue;
              }
              anyScanned = true;
              await handleFetchedMessage(ctx, userId, conn, msg, c);
              // Throttle to stay under Groq 8000 TPM on large scans
              await new Promise((rr) => setTimeout(rr, 450));
            }
          }
          if (runProcessed >= MANUAL_PER_RUN && pageToken) {
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
        // resumable backfill instead of silently stopping. An already-active
        // backfill is left alone — the cron keeps working through it.
        if (stoppedEarly && pageToken && !conn.gmailBackfillSeededAt) {
          chainedAny = true;
          try {
            await ctx.runMutation(internal.gmailBackfill.seedBackfill as any, {
              connId: conn._id,
              query: "narrow",
              pageToken,
              processed: runProcessed,
            });
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
          await ctx.runMutation(internal.gmailConnectionState.updateHistoryId as any, {
            connId: conn._id,
            historyId: hid,
          });
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
      const allOnCooldown = active.every(
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
    return done(chainedAny ? { remaining: true } : undefined);
  },
});
